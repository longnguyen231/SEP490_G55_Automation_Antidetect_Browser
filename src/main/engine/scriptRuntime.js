/**
 * scriptRuntime.js — Engine nâng cao thực thi kịch bản tự động hóa (script).
 *
 * Cung cấp các đối tượng `page`/`context` (Playwright API) và proxy `actions`
 * cho các script của người dùng. Đồng thời thu thập và cấu trúc dữ liệu log.
 *
 * Kiến trúc tổng quan:
 *   1. Nhận profileId + code từ UI (IPC handler).
 *   2. Lấy Playwright Page/Context đang chạy của profile.
 *   3. Bọc chúng trong Rate-Limited Proxy (tối đa 20 action/giây).
 *   4. Đưa tất cả vào Sandbox VM cô lập (vm.createContext).
 *   5. Chạy code người dùng bên trong sandbox, với timeout bảo vệ.
 *   6. Trả về { success, result, logs, error } cho UI.
 */

// ═══════════════════════════════════════════════════════════════
// PHẦN 1: IMPORT CÁC PHỤ THUỘC (DEPENDENCIES)
// ═══════════════════════════════════════════════════════════════

const vm = require('vm');
// vm là module tích hợp sẵn của Node.js dùng để chạy code trong môi trường cô lập.
// Đây là cơ chế bảo mật chính: code người dùng KHÔNG được phép truy cập
// trực tiếp vào hệ thống file (fs), biến môi trường (process.env), hay
// các module Node.js nhạy cảm khác — trừ những gì ta cố ý cấp trong sandbox.

const path = require('path');
// Dùng để xây dựng đường dẫn tới thư mục node_modules của script-modules.

const { appendLog } = require('../logging/logger');
// Ghi log hoạt động thông thường của script vào file log của profile.

const { appendAuditLog } = require('../logging/auditLogger');
// Ghi log kiểm toán (audit) cho các sự kiện nhạy cảm như: bắt đầu script,
// vi phạm rate limit. Dùng cho mục đích truy vết và bảo mật.

const { performAction, getActionNames } = require('./actions');
// performAction: hàm thực thi một hành động tự động hóa cụ thể (click, type, navigate...).
// getActionNames: danh sách tên các action hợp lệ — dùng để validate trước khi gọi.

const { runningProfiles } = require('../state/runtime');
// Map lưu trạng thái các profile đang chạy (có Playwright context và browser handle).
// Key: profileId, Value: { browser, context, ... }.

const { getModulesDir } = require('../storage/scriptModules');
// Lấy đường dẫn tới thư mục chứa các NPM package mà người dùng đã cài thêm
// qua tab "Script Modules" trong giao diện.

// ═══════════════════════════════════════════════════════════════
// PHẦN 2: HÀM `require` AN TOÀN CHO SCRIPT NGƯỜI DÙNG
// ═══════════════════════════════════════════════════════════════

/**
 * Tạo hàm `require` tùy chỉnh dành cho code người dùng bên trong sandbox.
 *
 * TẠI SAO cần hàm này?
 *   - require() mặc định của Node.js cho phép load bất kỳ module nào,
 *     kể cả `fs`, `child_process`, `net`... — RẤT NGUY HIỂM nếu cấp cho script lạ.
 *   - Hàm này giới hạn chỉ cho phép:
 *       (a) Các built-in "vô hại" trong danh sách trắng ALLOWED_BUILTINS.
 *       (b) Các NPM package đã được người dùng cài thêm vào thư mục modulesDir.
 *
 * @param {string} profileId — dùng để log lỗi gắn với đúng profile.
 */
function makeScriptRequire(profileId) {
  // Lấy thư mục script-modules một lần khi khởi tạo; nếu chưa cài đặt thì trả về null.
  const modulesDir = (() => { try { return getModulesDir(); } catch { return null; } })();

  // Danh sách trắng (whitelist) các built-in Node.js được phép dùng trong script.
  // Các module này không có khả năng truy cập hệ thống file hay spawn process.
  const ALLOWED_BUILTINS = new Set(['path', 'url', 'querystring', 'crypto', 'buffer', 'stream', 'events', 'util', 'os', 'zlib']);

  // Trả về hàm require() tùy chỉnh — hàm này sẽ được inject vào sandbox.
  return function scriptRequire(name) {
    // Nếu tên module nằm trong whitelist, cho phép require() bình thường.
    if (ALLOWED_BUILTINS.has(name)) return require(name);

    // Nếu modulesDir chưa được cấu hình, không thể load module bên ngoài.
    if (!modulesDir) throw new Error(`Script modules directory not available`);

    // Thử load NPM package từ thư mục script-modules của người dùng.
    try {
      // Ghép đường dẫn: <modulesDir>/node_modules/<tên package>
      const modPath = path.join(modulesDir, 'node_modules', name);
      return require(modPath);
    } catch (e) {
      // Nếu không tìm thấy, ghi log hướng dẫn người dùng cài đặt thêm.
      appendLog(profileId, `Script: require('${name}') failed — ${e.message}. Install it via Script Modules tab.`);
      throw new Error(`Module '${name}' not found. Install it via Script Modules tab first.`);
    }
  };
}

// ═══════════════════════════════════════════════════════════════
// PHẦN 3: HELPER TRẢ VỀ KẾT QUẢ CHUẨN HÓA
// ═══════════════════════════════════════════════════════════════

// ok() — tạo object kết quả thành công, luôn có success: true.
// Dùng ở cuối executeScript khi script chạy xong bình thường.
function ok(v = {}) { return { success: true, ...v }; }

// err() — tạo object kết quả thất bại, luôn có success: false và error message.
// Dùng khi script lỗi, timeout, bị dừng, hoặc thiếu tham số đầu vào.
function err(message, extra = {}) { return { success: false, error: String(message || 'unknown error'), ...extra }; }

// ═══════════════════════════════════════════════════════════════
// PHẦN 4: QUẢN LÝ TRẠNG THÁI ĐỒNG THỜI (CONCURRENCY STATE)
// ═══════════════════════════════════════════════════════════════

/**
 * Map lưu trạng thái điều khiển của TẤT CẢ script đang chạy.
 *
 * Key   : profileId (string) — mỗi profile chỉ được chạy 1 script tại một thời điểm.
 * Value : ctrl object với các trường:
 *   - aborted     : boolean — true khi người dùng bấm Stop.
 *   - paused      : boolean — true khi người dùng bấm Pause.
 *   - rejectAbort : function | null — hàm reject của Promise dừng khẩn cấp.
 *   - pageHandle  : object | null — tham chiếu tới page để đóng cưỡng bức khi Stop.
 *
 * Khi script kết thúc (dù thành công hay lỗi), profileId được xóa khỏi Map này.
 */
const _runningScripts = new Map(); // profileId -> ctrl

// ═══════════════════════════════════════════════════════════════
// PHẦN 5: HÀM ĐIỀU KHIỂN SCRIPT (STOP / PAUSE / RESUME)
// ═══════════════════════════════════════════════════════════════

/**
 * Dừng script đang chạy của profile ngay lập tức (force stop).
 *
 * Cơ chế hoạt động:
 *   1. Đặt ctrl.aborted = true — các vòng lặp sleep() và action proxy sẽ phát hiện
 *      cờ này ở lần tick tiếp theo và ném Error('Script stopped by user').
 *   2. Gọi ctrl.rejectAbort() — reject ngay lập tức Promise dừng trong Promise.race(),
 *      giúp thoát khỏi các lệnh Playwright đang chờ (await page.waitForNavigation...).
 *   3. Đóng cưỡng bức trang trình duyệt đang mở — khiến mọi lời gọi Playwright
 *      đang pending sẽ nhận TargetClosedError và throw ra, thoát khỏi await.
 *
 * @param {string} profileId
 */
function stopScript(profileId) {
  const ctrl = _runningScripts.get(profileId);
  if (ctrl) {
    // Bước 1: Đặt cờ dừng để sleep() và action proxy nhận ra ở vòng lặp tiếp theo.
    ctrl.aborted = true;
    ctrl.paused = false; // Nếu đang pause, cũng phải gỡ pause để tick() tiếp tục chạy

    // Bước 2: Reject ngay Promise dừng khẩn cấp — thoát khỏi Promise.race() ngay lập tức.
    // rejectAbort được gán khi khởi tạo Promise thứ ba trong Promise.race() bên dưới.
    if (ctrl.rejectAbort) {
      ctrl.rejectAbort(new Error('Script stopped by user'));
    }

    // Bước 3: Đóng cưỡng bức trang để "đánh thức" các lệnh Playwright đang bị treo.
    // Ví dụ: nếu script đang await page.waitForNavigation(), việc đóng page sẽ khiến
    // Playwright ném lỗi ngay, không cần chờ timeout.
    try {
      if (ctrl.pageHandle && ctrl.pageHandle.page && !ctrl.pageHandle.page.isClosed()) {
        ctrl.pageHandle.page.close().catch(() => {});
        // .catch(() => {}) để tránh UnhandledPromiseRejection nếu close() lỗi
      }
    } catch (e) {
      // Bỏ qua lỗi dọn dẹp — ta đang trong trạng thái dừng khẩn cấp,
      // không cần xử lý lỗi phụ ở đây.
    }
  }
}

/**
 * Tạm dừng script đang chạy.
 *
 * Chỉ đặt ctrl.paused = true. Hàm sleep() kiểm tra cờ này mỗi 100ms
 * và nếu thấy paused = true sẽ lặp lại tick() mà không đếm thời gian —
 * hiệu quả là "đóng băng" tiến trình chạy script cho đến khi resume().
 *
 * @param {string} profileId
 */
function pauseScript(profileId) {
  const ctrl = _runningScripts.get(profileId);
  if (ctrl) ctrl.paused = true;
}

/**
 * Tiếp tục script đã bị tạm dừng.
 *
 * Gỡ cờ paused = false. Hàm sleep() ở tick tiếp theo sẽ thấy paused = false
 * và tiếp tục đếm thời gian bình thường.
 *
 * @param {string} profileId
 */
function resumeScript(profileId) {
  const ctrl = _runningScripts.get(profileId);
  if (ctrl) ctrl.paused = false;
}

/**
 * Kiểm tra xem profile có đang chạy script không.
 * Dùng bởi UI để hiển thị trạng thái và ngăn chạy đồng thời.
 *
 * @param {string} profileId
 * @returns {boolean}
 */
function isScriptRunning(profileId) {
  return _runningScripts.has(profileId);
}

// ═══════════════════════════════════════════════════════════════
// PHẦN 6: LẤY PLAYWRIGHT PAGE TỪ PROFILE ĐANG CHẠY
// ═══════════════════════════════════════════════════════════════

/**
 * Lấy đối tượng Page (và Context, Browser) từ profile đang hoạt động.
 *
 * TẠI SAO cần profileId?
 *   Hệ thống có thể chạy NHIỀU profile cùng lúc, mỗi profile có browser riêng.
 *   profileId là khóa tra cứu trong runningProfiles Map để lấy đúng browser/context.
 *
 * Logic:
 *   - Nếu không có context → báo lỗi (profile chưa được launch).
 *   - Nếu có context nhưng chưa có page → tự tạo page mới (context.newPage()).
 *   - Trả về { page, context, browser, cleanup } để caller dùng và dọn dẹp.
 *
 * @param {string} profileId
 * @returns {Promise<{page, context, browser, cleanup}|null>}
 */
async function getPageForProfile(profileId) {
  const running = runningProfiles.get(profileId);
  if (!running) {
    appendLog(profileId, 'Script: profile is not running');
    return null;
  }

  // runningProfiles lưu Playwright BrowserContext trực tiếp cho tất cả engine
  // (chromium, firefox, camoufox). Đây là điểm thống nhất để lấy page.
  const context = running.context;
  if (!context) {
    appendLog(profileId, 'Script: Playwright context not available');
    return null;
  }

  // Kiểm tra context có còn mở không (tránh crash khi profile đã bị đóng sau đó).
  if (context.isClosed?.()) {
    appendLog(profileId, 'Script: Playwright context is closed');
    return null;
  }

  // Lấy page đầu tiên đang mở. Nếu không có page nào, tạo mới một page trống.
  let page = context.pages()[0];
  if (!page) {
    appendLog(profileId, 'Script: no open page found — creating new page');
    page = await context.newPage();
  }

  // cleanup là hàm no-op vì page thuộc về profile, không nên đóng sau khi script kết thúc.
  // Profile vẫn tiếp tục chạy sau khi script xong.
  return { page, context, browser: running.browser, cleanup: async () => {} };
}

// ═══════════════════════════════════════════════════════════════
// PHẦN 7: HÀM CHÍNH — THỰC THI SCRIPT
// ═══════════════════════════════════════════════════════════════

/**
 * Thực thi một đoạn code JavaScript tùy ý trong môi trường sandbox an toàn.
 *
 * @param {string} profileId  — ID profile cần chạy script. Bắt buộc vì:
 *                              (a) cần lấy đúng Playwright page của profile đó,
 *                              (b) log và audit log gắn với profile,
 *                              (c) ngăn chạy đồng thời 2 script trên cùng 1 profile.
 * @param {string} code       — Code JavaScript của người dùng (chưa được tin cậy).
 * @param {object} options
 *   @param {number} options.timeoutMs — Thời gian tối đa cho phép script chạy (ms).
 *                                       Mặc định 120 giây, tối đa 300 giây (5 phút).
 * @returns {Promise<{success, result, logs, error}>}
 */
async function executeScript(profileId, code, { timeoutMs = 120000 } = {}) {
  // ── Validate đầu vào ──────────────────────────────────────────
  if (!profileId) return err('profileId is required');
  const src = String(code || '').trim();
  if (!src) return err('code is empty');

  // Ngăn chạy đồng thời 2 script trên cùng 1 profile — tránh race condition
  // giữa 2 script cùng điều khiển 1 trình duyệt.
  if (_runningScripts.has(profileId)) return err('A script is already running for this profile');

  // ── Khởi tạo Control State ────────────────────────────────────
  // ctrl là "remote control" của script này — các hàm stop/pause/resume
  // giao tiếp với script đang chạy thông qua object này.
  const ctrl = { aborted: false, paused: false, rejectAbort: null, pageHandle: null };
  _runningScripts.set(profileId, ctrl);

  appendLog(profileId, `Script: starting execution (timeout=${timeoutMs}ms)`);

  // ── Thu thập Log ──────────────────────────────────────────────
  // Mảng logs lưu tất cả output của console.log() / log() trong script.
  // Mỗi entry có dạng { time: ISO string, message: string }.
  // Mảng này được trả về trong kết quả để UI hiển thị cho người dùng.
  const logs = [];

  /**
   * Hàm log được inject vào sandbox — thay thế console.log() của Node.js.
   * Mọi tham số được chuyển thành string (JSON.stringify nếu là object)
   * rồi join bằng khoảng trắng, giống behavior của console.log() thực.
   */
  const log = (...args) => {
    const msg = args.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' ');
    const entry = { time: new Date().toISOString(), message: msg };
    logs.push(entry);
    // Đồng thời ghi vào file log của profile (hiển thị trong log panel chung).
    try { appendLog(profileId, '[script] ' + msg); } catch {}
  };

  // ── Hàm sleep() có hỗ trợ abort và pause ─────────────────────
  /**
   * sleep(ms) — dừng script trong ms mili-giây, nhưng:
   *   - Nếu ctrl.aborted = true → reject ngay với Error('Script stopped by user').
   *   - Nếu ctrl.paused = true → giữ nguyên (không đếm thời gian), lặp lại tick() mỗi 100ms.
   *   - Thời gian tối đa là 10 phút (bảo vệ tránh sleep vô hạn).
   *
   * Cơ chế: thay vì setTimeout một lần duy nhất, chia nhỏ thành các bước 100ms
   * để có thể kiểm tra cờ abort/pause sau mỗi bước.
   */
  const sleep = (ms) => new Promise((resolve, reject) => {
    // Giới hạn thời gian sleep: tối thiểu 0ms, tối đa 10 phút (600.000ms).
    const total = Math.min(Math.max(0, Number(ms) || 0), 10 * 60 * 1000);
    let elapsed = 0;
    const tick = () => {
      // Nếu script đã bị dừng → throw ra ngay, thoát khỏi await sleep().
      if (ctrl.aborted) return reject(new Error('Script stopped by user'));
      // Nếu đang pause → đợi 100ms rồi kiểm tra lại, không tính vào thời gian sleep.
      if (ctrl.paused) { setTimeout(tick, 100); return; }
      // Đã ngủ đủ thời gian → resolve để script tiếp tục.
      if (elapsed >= total) return resolve();
      // Bước nhỏ nhất là 100ms (hoặc phần còn lại nếu < 100ms).
      const step = Math.min(100, total - elapsed);
      elapsed += step;
      setTimeout(tick, step);
    };
    tick();
  });

  // ── Rate Limiter: Bộ đếm Token Bucket (BR_02) ─────────────────
  // TẠI SAO giới hạn 20 action/giây?
  //   - Ngăn script chạy quá nhanh, gây stress lên website target (ethical limit).
  //   - Làm cho hành vi tự động hóa trông tự nhiên hơn, khó bị phát hiện hơn.
  //   - Giới hạn thiệt hại nếu script bị lỗi vô tình gọi action lặp lại.
  // Bộ đếm này được chia sẻ giữa cả actions proxy VÀ rate-limited page/cdp proxy,
  // tức là tổng tất cả các loại hành động không được vượt quá 20/giây.
  let actionCountThisSecond = 0;
  let lastActionTime = Date.now();

  // ── Actions Proxy ─────────────────────────────────────────────
  /**
   * Proxy động bọc toàn bộ thư viện actions (actions.js).
   *
   * Cách hoạt động:
   *   Khi script người dùng viết `await actions.click({ selector: '#btn' })`,
   *   Proxy trap `get` được kích hoạt với prop = 'click'.
   *   Proxy kiểm tra 'click' có trong getActionNames() không, rồi trả về
   *   một async function gọi performAction(profileId, 'click', params).
   *
   * Tại sao dùng Proxy thay vì object tĩnh?
   *   - actions.js có thể thêm action mới mà không cần sửa file này.
   *   - Tất cả action đều tự động được áp dụng rate limit và abort check.
   */
  const actions = new Proxy({}, {
    get(_t, prop) {
      const name = String(prop);

      // Từ chối sớm nếu tên action không tồn tại — tránh lỗi khó hiểu ở tầng dưới.
      if (!getActionNames().includes(name)) {
        appendLog(profileId, `Script: unknown action requested — '${name}'`);
        return async () => ({ success: false, error: `Unknown action '${name}'` });
      }

      // Trả về async function sẽ được gọi khi script thực thi `await actions.<name>(params)`.
      return async (params) => {
        // Kiểm tra cờ abort trước khi thực hiện bất kỳ action nào.
        if (ctrl.aborted) throw new Error('Script stopped by user');

        // ── Kiểm tra Rate Limit (BR_02) ──────────────────────────
        const now = Date.now();
        // Reset bộ đếm nếu đã qua 1 giây kể từ lần action gần nhất.
        if (now - lastActionTime > 1000) {
            actionCountThisSecond = 0;
            lastActionTime = now;
        }
        actionCountThisSecond++;

        // Nếu vượt quá 20 action trong 1 giây → từ chối và ghi audit log.
        if (actionCountThisSecond > 20) {
            appendAuditLog('RATE_LIMIT_EXCEEDED', `Action '${name}' exceeded 20/sec limit`, profileId);
            throw new Error('RateLimitExceeded: Automation actions exceed 20/sec ethical limit.');
        }

        // ── Gọi action thực sự ───────────────────────────────────
        try { return await performAction(profileId, name, params || {}); }
        catch (e) {
          // Không throw ra ngoài — trả về { success: false } để script có thể xử lý lỗi.
          appendLog(profileId, `Script: action '${name}' threw — ${e?.message || e}`);
          return { success: false, error: e?.message || String(e) };
        }
      };
    },
  });

  // assert() — helper kiểm tra điều kiện, throw Error nếu condition = false.
  // Giúp script người dùng viết test assertions ngắn gọn.
  const assert = (cond, msg = 'Assertion failed') => { if (!cond) throw new Error(String(msg)); };

  // ── Khởi tạo Playwright Handles ───────────────────────────────
  // Lấy page/context/cdp từ profile đang chạy để inject vào sandbox.
  let pageHandle = null;
  let rawPage = null;
  let rawContext = null;
  let rawCdpSession = null;
  try {
    pageHandle = await getPageForProfile(profileId);

    // Lưu pageHandle vào ctrl để stopScript() có thể đóng trang cưỡng bức.
    ctrl.pageHandle = pageHandle;

    if (pageHandle) {
      rawPage = pageHandle.page;
      rawContext = pageHandle.context;

      // CDP (Chrome DevTools Protocol) — cấp quyền truy cập protocol-level cho script.
      // Không phải tất cả engine đều hỗ trợ CDP (ví dụ: Firefox không hỗ trợ đầy đủ),
      // nên bọc trong try/catch và để cdp = null nếu không available.
      try {
        rawCdpSession = await rawContext.newCDPSession(rawPage);
      } catch (e) {
        appendLog(profileId, `Script: CDP session unavailable — ${e?.message || e}. cdp will be null.`);
      }
    } else {
      // Profile có thể đang chạy nhưng chưa có page mở (edge case).
      // Script vẫn có thể chạy với page = null (ví dụ: script chỉ dùng actions).
      appendLog(profileId, 'Script: page not available — page/context will be null in script');
    }
  } catch (e) {
    appendLog(profileId, `Script: failed to get page — ${e?.message || e}`);
  }

  // ── Rate-Limited Proxy cho Page và CDP ────────────────────────
  /**
   * Bọc đối tượng Playwright gốc (page, context, cdp) trong một Proxy
   * để các lời gọi trực tiếp như `await page.click()` cũng bị đếm vào
   * bộ đếm rate limit CHUNG với actions proxy.
   *
   * TẠI SAO cần điều này?
   *   Nếu script người dùng dùng `actions.click()` → đã có rate limit.
   *   Nhưng nếu họ dùng `page.click()` trực tiếp → sẽ BYPASS rate limit.
   *   Proxy này đảm bảo TẤT CẢ các hành động đều được tính, bất kể cách gọi.
   *
   * Kỹ thuật quan trọng:
   *   - `val.apply(targetObj, args)` — bind về đối tượng GỐC (không phải proxy)
   *     để tránh lỗi "Illegal Invocation" của Playwright khi `this` không đúng.
   *   - Nếu kết quả trả về là Playwright object (Page, Frame, Locator...),
   *     bọc tiếp trong proxy để các phương thức chained cũng được rate-limit.
   *
   * @param {object} targetObj — Playwright object cần bọc.
   * @param {string} objectName — Tên để log (ví dụ: 'page', 'cdp').
   */
  function createRateLimitedProxy(targetObj, objectName) {
    // Nếu object là null/undefined (ví dụ: cdp không available), trả về nguyên.
    if (!targetObj) return targetObj;
    return new Proxy(targetObj, {
      get(target, prop) {
        const val = target[prop];

        // Chỉ bọc các method (function). Các property tĩnh (như page.url) giữ nguyên.
        if (typeof val === 'function') {
          return function(...args) {
            // ── Kiểm tra Rate Limit cho lời gọi trực tiếp vào Playwright ──
            const now = Date.now();
            if (now - lastActionTime > 1000) {
                actionCountThisSecond = 0;
                lastActionTime = now;
            }
            actionCountThisSecond++;
            if (actionCountThisSecond > 20) {
                appendAuditLog('RATE_LIMIT_EXCEEDED', `Method '${objectName}.${String(prop)}' exceeded 20/sec limit`, profileId);
                throw new Error('RateLimitExceeded: Automation actions exceed 20/sec ethical limit.');
            }

            // Gọi method gốc, bind về targetObj (Playwright object thực) để tránh lỗi `this`.
            // Bind methods to original target to avoid Playwright "Illegal Invocation" errors
            const result = val.apply(targetObj, args);

            // Nếu kết quả là Promise và resolve về Playwright object,
            // bọc tiếp vào proxy để method chaining cũng được rate-limit.
            // Also recursively wrap promises to ensure chained actions are bound to original objects
            if (result instanceof Promise) {
                 return result.then(res => {
                    if (res && res.constructor && ['Page', 'BrowserContext', 'Frame', 'Locator', 'ElementHandle'].includes(res.constructor.name)) {
                       return createRateLimitedProxy(res, res.constructor.name.toLowerCase());
                    }
                    return res;
                 });
            }
            return result;
          };
        }
        // Property không phải function (ví dụ: page.keyboard, page.mouse) — trả về nguyên.
        return val;
      }
    });
  }

  // Tạo các phiên bản rate-limited của page, context, cdp để inject vào sandbox.
  const page = createRateLimitedProxy(rawPage, 'page');
  const context = createRateLimitedProxy(rawContext, 'context');
  const cdpSession = createRateLimitedProxy(rawCdpSession, 'cdp');

  // ── Sandbox Context (Môi trường cô lập) ──────────────────────
  /**
   * sandboxCtx là object chứa TẤT CẢ những gì script người dùng được phép dùng.
   * Mọi thứ không có trong object này sẽ là `undefined` hoặc ReferenceError
   * bên trong sandbox — đây là cơ chế cô lập quyền hạn chính.
   *
   * Danh sách đầy đủ:
   *   profileId  — ID profile (read-only info, hữu ích để log).
   *   log        — Thay thế console.log(), thu thập vào mảng logs.
   *   sleep      — Dừng có kiểm soát abort/pause.
   *   actions    — Proxy tới toàn bộ thư viện hành động tự động hóa.
   *   assert     — Kiểm tra điều kiện, throw nếu sai.
   *   require    — require() an toàn, chỉ cho phép whitelist + script-modules.
   *   page       — Playwright Page (rate-limited), null nếu profile chưa mở page.
   *   context    — Playwright BrowserContext (rate-limited).
   *   cdp        — CDP Session (rate-limited), null nếu engine không hỗ trợ.
   *   console    — Giả lập console (log/warn/error/info đều gọi vào log()).
   *   setTimeout, clearTimeout, setInterval, clearInterval — Timer APIs.
   *   JSON, Date, Math, Array, Object, String, Number, Boolean,
   *   RegExp, Error, Promise, Map, Set, Buffer — Built-in JS globals an toàn.
   *   parseInt, parseFloat, isNaN, isFinite — Utility functions.
   *   encodeURIComponent, decodeURIComponent, encodeURI, decodeURI — URL encoding.
   *
   * KHÔNG CÓ: fs, path, process, child_process, net, http, require (Node.js gốc),
   *            global, __dirname, __filename, module, exports.
   */
  const sandbox = {
    profileId,
    log,
    sleep,
    actions,
    assert,
    require: makeScriptRequire(profileId),
    page,
    context,
    cdp: cdpSession,
    // Giả lập console để tránh ReferenceError khi script dùng console.log().
    // Tất cả đều trỏ về log() để output được thu thập vào mảng logs.
    console: { log, warn: log, error: log, info: log },
    // Timer APIs — cần thiết cho async script, nhưng không cấp thêm quyền hạn.
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    // Built-in JavaScript globals vô hại — script cần chúng để hoạt động bình thường.
    JSON,
    Date,
    Math,
    Array,
    Object,
    String,
    Number,
    Boolean,
    RegExp,
    Error,
    Promise,
    Map,
    Set,
    Buffer,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    encodeURIComponent,
    decodeURIComponent,
    encodeURI,
    decodeURI,
  };

  // vm.createContext() tạo V8 context hoàn toàn cô lập cho sandbox.
  // Sau lệnh này, sandbox object trở thành global scope của vm context đó.
  // Code chạy trong context này KHÔNG THỂ leo lên global scope của Node.js.
  const vmContext = vm.createContext(sandbox, { name: 'scriptSandbox' });

  // ── Bọc code người dùng trong Async IIFE ─────────────────────
  // TẠI SAO dùng `(async () => { ... })()`?
  //   1. async: Script cần dùng `await` (cho Playwright, sleep, actions...).
  //      Không có `async`, `await` sẽ là SyntaxError.
  //   2. IIFE (Immediately Invoked Function Expression): Đảm bảo code chạy
  //      ngay lập tức và trả về Promise — Promise này được await ở bên ngoài.
  //   3. Bọc trong function: Các `return` trong script người dùng sẽ trả về
  //      giá trị của IIFE (không crash), và biến local không bị rò ra ngoài.
  const wrapped = `(async () => {\n${src}\n})()`;

  // ── Thực thi trong Sandbox với Timeout và Abort ───────────────
  try {
    // Ghi audit log khi bắt đầu — dùng để truy vết ai đã chạy script nào.
    appendAuditLog('SCRIPT_RUN', `Started execution`, profileId);

    // Biên dịch code thành vm.Script một lần (tách bước compile và run để rõ ràng).
    // filename giả ('automation-script.js') giúp stack trace dễ đọc hơn.
    const script = new vm.Script(wrapped, { filename: 'automation-script.js', displayErrors: true });

    /**
     * Promise.race() — chạy song song 3 Promise, cái nào resolve/reject trước thì thắng:
     *
     *   [0] script.runInContext()  — Promise chạy script người dùng.
     *                                Resolve khi script return.
     *                                Reject khi script throw Error.
     *
     *   [1] timeout Promise        — Reject sau timeoutMs (tối đa 300 giây).
     *                                Bảo vệ khỏi script vô hạn không dùng sleep.
     *                                Lưu ý: vm timeout không kill async code bên ngoài,
     *                                nên dùng Promise.race() thay vì options.timeout của vm.
     *
     *   [2] abort Promise          — Reject ngay khi ctrl.rejectAbort() được gọi.
     *                                Đây là cơ chế Stop khẩn cấp từ stopScript().
     *                                rejectAbort được lưu vào ctrl để stopScript() gọi được.
     */
    const result = await Promise.race([
      script.runInContext(vmContext, { displayErrors: true }),
      new Promise((_, reject) => setTimeout(() => reject(new Error(`Script timeout after ${timeoutMs}ms`)), Math.min(timeoutMs, 300000))),
      new Promise((_, reject) => { ctrl.rejectAbort = reject; })
    ]);

    // ── Thành công ────────────────────────────────────────────────
    // Xóa script khỏi Map để đánh dấu đã kết thúc (cho phép profile chạy script mới).
    _runningScripts.delete(profileId);
    if (pageHandle?.cleanup) await pageHandle.cleanup();
    appendLog(profileId, `Script: completed successfully (${logs.length} log entries)`);

    // Trả về kết quả chuẩn hóa: success=true, kết quả return của script, và toàn bộ logs.
    return ok({ result, logs });

  } catch (e) {
    // ── Xử lý Lỗi ─────────────────────────────────────────────────
    // Dù lỗi là gì (throw, timeout, abort, assert...), đều phải dọn dẹp trước.
    _runningScripts.delete(profileId);
    const errMsg = e?.message || String(e);

    // Phân loại lỗi để ghi log có ngữ nghĩa hơn — giúp debug dễ hơn.
    if (errMsg.includes('stopped by user')) {
      // Script bị dừng bởi người dùng (Stop button).
      appendLog(profileId, `Script: STOPPED by user`);
    } else if (errMsg.includes('timeout')) {
      // Script chạy quá thời gian cho phép.
      appendLog(profileId, `Script: TIMEOUT — ${errMsg}`);
    } else if (errMsg.includes('is not defined')) {
      // Script dùng biến hoặc function không tồn tại trong sandbox.
      appendLog(profileId, `Script: REFERENCE ERROR — ${errMsg}`);
    } else if (errMsg.includes('Cannot read')) {
      // Script gọi property trên null hoặc undefined.
      appendLog(profileId, `Script: NULL/UNDEFINED ERROR — ${errMsg}`);
    } else if (errMsg.includes('Assertion failed') || errMsg.startsWith('assert')) {
      // assert() trong script thất bại.
      appendLog(profileId, `Script: ASSERTION FAILED — ${errMsg}`);
    } else {
      // Lỗi không xác định — log toàn bộ message.
      appendLog(profileId, `Script: ERROR — ${errMsg}`);
    }

    // Ghi lỗi vào mảng logs để hiển thị trong UI (người dùng thấy được).
    log('ERROR: ' + errMsg);

    if (pageHandle?.cleanup) await pageHandle.cleanup();

    // Trả về kết quả thất bại kèm logs đã thu thập (hữu ích để debug).
    return err(errMsg, { logs });
  }
}

// ═══════════════════════════════════════════════════════════════
// PHẦN 8: EXPORT PUBLIC API
// ═══════════════════════════════════════════════════════════════

// executeScript   — hàm chính, được gọi từ IPC handler khi người dùng bấm Run.
// stopScript      — dừng script đang chạy ngay lập tức.
// pauseScript     — tạm dừng script (có thể resume sau).
// resumeScript    — tiếp tục script đã tạm dừng.
// isScriptRunning — kiểm tra trạng thái để UI hiển thị nút đúng.
module.exports = { executeScript, stopScript, pauseScript, resumeScript, isScriptRunning };
