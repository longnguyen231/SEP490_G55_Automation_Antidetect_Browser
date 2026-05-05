const fs = require('fs');
const { appendLog } = require('../logging/logger');
const { storageStatePath, getDataRoot } = require('../storage/paths');
const { loadSettings, resolveChromeExecutable, resolveVendorChromePath } = require('../storage/settings');
const { runningProfiles, setProfileStatus, generateInstanceId, buildStatusMap } = require('../state/runtime');
const { readProfiles, writeProfiles, updateProfileSettings } = require('../storage/profiles');

// Lock set to prevent concurrent launches of the same profile
const launchingProfiles = new Set();

/**
 * Reads the actual Chrome version from a binary by running `chrome --version`.
 * Returns full version string e.g. "136.0.7103.113" or null on failure.
 * Result is cached per path to avoid repeated spawns.
 */
const _chromeVersionCache = new Map();
function getChromeVersion(chromePath) {
  if (_chromeVersionCache.has(chromePath)) return Promise.resolve(_chromeVersionCache.get(chromePath));
  return new Promise((resolve) => {
    try {
      execFile(chromePath, ['--version'], { timeout: 5000, windowsHide: true }, (err, stdout) => {
        if (err) { resolve(null); return; }
        // stdout: "Google Chrome 136.0.7103.113" or "Chromium 136.0.7103.113"
        const m = String(stdout).match(/(\d+\.\d+\.\d+\.\d+)/);
        const version = m ? m[1] : null;
        _chromeVersionCache.set(chromePath, version);
        resolve(version);
      });
    } catch { resolve(null); }
  });
}

async function runPlaywrightInstall(browser = 'chromium') {
  appendLog('system', `Running Playwright install for ${browser}...`);
  return new Promise((resolve) => {
    try {
      const cmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
      const args = ['playwright', 'install', browser];
      const child = require('child_process').spawn(cmd, args, { stdio: 'ignore', windowsHide: true });
      child.once('exit', (code) => resolve(code === 0));
      child.once('error', () => resolve(false));
    } catch { resolve(false); }
  });
}

/**
 * Phát sóng (broadcast) trạng thái tất cả profile đang chạy đến mọi cửa sổ Electron.
 * Vai trò: Đồng bộ hóa giao diện người dùng (UI) theo thời gian thực — mỗi khi có profile
 * khởi động, dừng, hoặc thay đổi trạng thái, hàm này gửi sự kiện 'running-map-changed'
 * kèm theo bản đồ wsEndpoint, map trạng thái chi tiết (STARTING/RUNNING/STOPPED)
 * và cờ headless để UI ẩn/hiện nút Live Screen tương ứng.
 */
function broadcastRunningMap() {
  const { BrowserWindow } = require('electron');
  const map = Object.fromEntries(
    [...runningProfiles.entries()].map(([id, info]) => [id, info.wsEndpoint || 'pipe'])
  );
  const statuses = buildStatusMap();
  // Include headless flag so renderer can derive Live Screen button visibility
  const headlessFlags = {};
  for (const [id, info] of runningProfiles.entries()) {
    headlessFlags[id] = !!(info.headless);
  }
  const payload = { map, statuses, headlessFlags };
  for (const w of BrowserWindow.getAllWindows()) {
    try { w.webContents.send('running-map-changed', payload); } catch { }
  }
}

/**
 * Khởi động trình duyệt cho một profile chống phát hiện (anti-detect).
 * Các bước chính:
 *   1. Kiểm tra lock (launchingProfiles Set) — tránh khởi động đồng thời cùng một profile
 *   2. Đọc thông tin profile từ storage (readProfiles)
 *   3. Chuẩn bị Chrome launch args — các anti-detect flags (tắt AutomationControlled, v.v.)
 *   4. Khởi động proxy forwarder nếu proxy có xác thực hoặc là SOCKS
 *   5. Tìm Chrome binary theo thứ tự ưu tiên: vendor → system → bundled Playwright
 *   6. Gọi Playwright launch (Chromium) hoặc launchServer/connect (Firefox/Camoufox)
 *   7. Inject fingerprint qua applyFingerprintInitScripts (UA, ngôn ngữ, timezone, WebGL, v.v.)
 *   8. Lưu profile đang chạy vào runningProfiles Map với engine, context, wsEndpoint
 *   9. Broadcast trạng thái RUNNING về UI qua broadcastRunningMap()
 */
async function launchProfileInternal(profileId, options = {}) {
  // Bước 1a: Nếu profile đã đang chạy, trả về ngay wsEndpoint hiện tại — tránh khởi động trùng lặp
  if (runningProfiles.has(profileId)) {
    return { success: true, wsEndpoint: runningProfiles.get(profileId).wsEndpoint };
  }
  // Bước 1b: Kiểm tra lock — nếu profile đang trong quá trình khởi động thì từ chối yêu cầu mới
  if (launchingProfiles.has(profileId)) {
    return { success: false, error: 'Profile is already starting up' };
  }
  // Bước 1b.5: Kiểm tra giới hạn số lượng browser đồng thời (maxConcurrentBrowsers từ Settings)
  const { maxConcurrentBrowsers } = loadSettings();
  const maxAllowed = Math.max(1, parseInt(maxConcurrentBrowsers, 10) || 5);
  if (runningProfiles.size + launchingProfiles.size >= maxAllowed) {
    return { success: false, error: `Đã đạt giới hạn ${maxAllowed} browser đồng thời. Dừng profile khác trước khi mở thêm.` };
  }
  // Bước 1c: Đặt lock và cập nhật trạng thái sang STARTING, broadcast ngay về UI
  launchingProfiles.add(profileId);
  const instanceId = generateInstanceId();
  setProfileStatus(profileId, 'STARTING', instanceId);
  broadcastRunningMap();
  try {
    // Bước 2: Đọc toàn bộ danh sách profile từ storage và tìm profile theo ID
    const profiles = readProfiles();
    const profile = profiles.find(p => p.id === profileId);
    if (!profile) return { success: false, error: 'Profile not found' };
    if (runningProfiles.has(profileId)) {
      const running = runningProfiles.get(profileId);
      return { success: true, wsEndpoint: running.wsEndpoint || 'pipe' };
    }
    const settings = profile.settings || {};
    let startUrl = settings.startupPage || profile.startUrl || 'https://hlmck.vercel.app/';
    if (startUrl === 'https://www.google.com' || startUrl === 'https://www.google.com/') {
      startUrl = 'https://www.google.com/?hl=en';
    }
    // Xác định engine sẽ dùng: ưu tiên tham số truyền vào (options.engine),
    // nếu không có thì lấy từ cài đặt profile, mặc định là 'playwright' (Chromium).
    const engine = (options && options.engine) ? String(options.engine).toLowerCase() : (settings.engine || 'playwright');
    // headless: chế độ ẩn cửa sổ trình duyệt (true = không hiện UI, chỉ chạy ngầm).
    // Ưu tiên: tham số truyền vào → cài đặt profile → mặc định false (hiện cửa sổ).
    const requestedHeadless = (options && typeof options.headless === 'boolean') ? options.headless : undefined;
    const headless = (requestedHeadless !== undefined) ? requestedHeadless : !!settings.headless;

    // Lưu lại engine và headless vào storage để lần sau mở lại profile sẽ nhớ cấu hình.
    // Dùng updateProfileSettings thay vì ghi toàn bộ mảng profiles — tránh race condition
    // khi nhiều profile cùng khởi động song song và ghi đè dữ liệu của nhau.
    // Persist engine/headless — use atomic single-profile update to avoid
    // race conditions when multiple profiles are launched concurrently.
    try {
      updateProfileSettings(profileId, {
        engine: engine,
        headless: !!headless,
      });
    } catch { }

    // Playwright flow — rebrowser-playwright (pipe mode).
    // rebrowser-playwright patches CDP leak at network level (Runtime.enable, bindings).
    // Combined with safeMode ON (no JS Object.defineProperty overrides), this bypasses
    // Cloudflare enterprise WAF.
    //
    // Giải thích pipe mode: Chromium được điều khiển qua stdin/stdout (pipe) thay vì mở
    // WebSocket ra ngoài (wsEndpoint). Điều này ẩn cổng kết nối, tránh website phát hiện
    // debugger đang kết nối thông qua quét cổng mạng.
    //
    // rebrowser-playwright là bản fork của Playwright đã vá lỗi để loại bỏ các tín hiệu
    // CDP (Chrome DevTools Protocol) mà website có thể dùng để phát hiện automation.
    const engineMode = settings.engine || 'playwright';
    // Camoufox: trình duyệt Firefox đặc biệt, được tối ưu hóa chống phát hiện fingerprint.
    const isCamoufox = engineMode === 'camoufox';
    // isFirefox: gom tất cả các engine dựa trên Firefox (playwright-firefox, firefox, camoufox).
    const isFirefox = engineMode === 'playwright-firefox' || engineMode === 'firefox' || isCamoufox;
    // Phải dùng 'playwright' (rebrowser-playwright đã patch), KHÔNG dùng 'playwright-core' (bản gốc chưa patch).
    const { chromium, firefox } = require('playwright'); // rebrowser-playwright — must NOT use playwright-core (standard, unpatched)
    // Chọn engine phù hợp: Firefox cho Firefox/Camoufox, Chromium cho còn lại.
    const pwEngine = isFirefox ? firefox : chromium;

    // fp (fingerprint): đối tượng chứa toàn bộ thông số giả mạo của profile —
    // bao gồm userAgent, ngôn ngữ, timezone, độ phân giải màn hình, WebGL, Canvas, v.v.
    const fp = profile.fingerprint || {};
    // Bước 3: Chuẩn bị danh sách Chrome launch args — tắt các tín hiệu tự động hóa (anti-detect flags)
    // Firefox không cần args này vì sử dụng about:config prefs riêng
    const args = isFirefox ? [] : [
      '--lang=en-US',
      // ── Core anti-detect: hide automation signals ──
      '--disable-blink-features=AutomationControlled',
      // Single --disable-features flag — Chrome only honours the last occurrence, so all values must be merged here
      '--disable-features=AutomationControlled,ChromeWhatsNewUI,AutofillServerCommunication,TranslateUI',
      '--disable-infobars',
      '--exclude-switches=enable-automation',
      // ── Performance / background throttling ──
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--disable-ipc-flooding-protection',
      '--disable-hang-monitor',
      '--disable-prompt-on-repost',
      // ── Privacy / noise reduction ──
      '--disable-domain-reliability',
      '--disable-component-update',
      '--metrics-recording-only',
      '--no-service-autorun',
      '--password-store=basic',
      '--use-mock-keychain',
      '--export-tagged-pdf',
      // ── Misc ──
      '--no-default-browser-check',
      '--no-first-run',
      // ── Startup speed ──
      '--disable-extensions',
      '--disable-default-apps',
      '--disable-sync',
      '--disable-background-networking',
      // ── Prevent session restore (stops multiple windows from crashed/killed sessions) ──
      '--no-restore-session-state',
    ];
    // Thiết lập kích thước cửa sổ trình duyệt (chỉ cho Chromium, không áp dụng Firefox).
    // Nếu cả hai chiều đều = 0 thì mở toàn màn hình (--start-maximized).
    // Window size (Chromium flags only)
    if (!isFirefox && settings.windowWidth > 0 && settings.windowHeight > 0) {
      args.push(`--window-size=${settings.windowWidth},${settings.windowHeight}`);
    } else if (!isFirefox && settings.windowWidth === 0 && settings.windowHeight === 0) {
      args.push('--start-maximized');
    }
    // Giới hạn WebRTC để tránh rò rỉ địa chỉ IP thật khi dùng proxy.
    // 'proxy_only' / 'disable_udp': buộc Chrome chỉ dùng IP của proxy, không dùng IP máy thật.
    if (settings.webrtc === 'proxy_only' || settings.webrtc === 'disable_udp') {
      if (!isFirefox) args.push('--force-webrtc-ip-handling-policy=disable_non_proxied_udp', '--enforce-webrtc-ip-permission-check');
    }
    // Tắt WebGL nếu người dùng chọn không dùng — tránh website đọc thông tin GPU thật.
    if (settings.webgl === false || fp.webgl === false) { if (!isFirefox) args.push('--disable-3d-apis'); }
    // Danh sách quyền (permissions) sẽ được cấp cho browser context sau khi tạo.
    // Playwright cần cấp quyền rõ ràng mới cho phép trình duyệt truy cập micro/camera/vị trí.
    const permissions = [];
    // Firefox only supports 'geolocation' and 'notifications' — skip microphone/camera for Firefox
    if (!isFirefox) {
      if (settings.mediaDevices?.audio) permissions.push('microphone');
      if (settings.mediaDevices?.video) permissions.push('camera');
    }
    // Chỉ cấp quyền geolocation khi người dùng bật override VÀ tọa độ hợp lệ.
    // Tránh cấp quyền thừa (có thể gây lỗi hoặc popup xác nhận không mong muốn).
    // Grant geolocation permission only when we intend to override and have valid coords
    try {
      const apply = (settings && settings.applyOverrides) || {};
      const applyGeo = apply.geolocation !== false;
      const g = settings?.geolocation || {};
      const wantGeo = Number.isFinite(Number(g.latitude)) && Number.isFinite(Number(g.longitude));
      if (applyGeo && wantGeo) permissions.push('geolocation');
    } catch { }
    // Bước 4: Xử lý proxy — nếu proxy có xác thực (username/password) hoặc là SOCKS,
    // khởi động proxy forwarder nội bộ để Playwright kết nối qua localhost thay vì trực tiếp.
    // Điều này giải quyết giới hạn của Chromium: không hỗ trợ SOCKS với xác thực trực tiếp.
    let proxy;
    let forwarder = null;
    if (settings.proxy?.server) {
      const proxyType = (settings.proxy.type || '').toLowerCase();
      const isSocks = proxyType.startsWith('socks') || /^socks\d?:\/\//i.test(settings.proxy.server);
      const hasAuth = !!(settings.proxy.username || settings.proxy.password);
      if (hasAuth || isSocks) {
        try {
          const { startProxyForwarder } = require('../engine/proxyForwarder');
          forwarder = await startProxyForwarder(settings.proxy, { appendLog, profileId });
          proxy = { server: forwarder.url };
          appendLog(profileId, `Playwright using proxy forwarder: ${forwarder.url}`);
        } catch (e) {
          appendLog(profileId, `Proxy forwarder failed, falling back to direct: ${e?.message || e}`);
          let serverUrl = settings.proxy.server;
          if (!/^(https?|socks\d?):\/\//i.test(serverUrl)) serverUrl = `${isSocks ? 'socks5' : 'http'}://${serverUrl}`;
          proxy = { server: serverUrl };
          if (settings.proxy.username) proxy.username = settings.proxy.username;
          if (settings.proxy.password) proxy.password = settings.proxy.password;
        }
      } else {
        let serverUrl = settings.proxy.server;
        if (!/^(https?|socks\d?):\/\//i.test(serverUrl)) serverUrl = `http://${serverUrl}`;
        proxy = { server: serverUrl };
      }
    }
    // Bước 5: Tìm Chrome binary theo thứ tự ưu tiên:
    //   1) Thư mục vendor (vendor/chrome-win/Chrome-bin/chrome.exe) — phiên bản đóng gói sẵn
    //   2) Chrome/Edge đã cài đặt trên hệ thống (system-installed)
    //   3) Chromium bundled của Playwright — phương án dự phòng cuối cùng (icon xanh Chromium)
    // Resolve Chrome binary for Chromium engine.
    // Priority: 1) vendor folder  2) system-installed Chrome/Edge  3) bundled Playwright Chromium (last resort).
    let executablePath;
    let binarySource = 'bundled';
    let detectedChromeVersion = null;
    if (isCamoufox) {
      const { getCamoufoxExecutable } = require('../services/camoufoxManager');
      const cfExe = getCamoufoxExecutable();
      if (!cfExe) {
        appendLog(profileId, 'Camoufox executable not found. Please install it first.');
        if (forwarder) { try { await forwarder.stop(); } catch {} }
        return { success: false, error: 'Camoufox not installed' };
      }
      executablePath = cfExe;
      binarySource = 'camoufox';
      appendLog(profileId, `[binary] source=${binarySource} path=${executablePath}`);
    } else if (!isFirefox) {
      const vendorPath = resolveVendorChromePath();
      if (vendorPath) {
        executablePath = vendorPath;
        binarySource = 'vendor';
      } else {
        const systemPath = resolveChromeExecutable();
        if (systemPath) {
          executablePath = systemPath;
          binarySource = 'system';
        }
      }
      if (executablePath) {
        appendLog(profileId, `[binary] source=${binarySource} path=${executablePath}`);
        // Start version detection now — result awaited AFTER browser.launch() so it runs in parallel.
        // getChromeVersion can take up to 5s on first call; caching means subsequent launches are instant.
      } else {
        appendLog(profileId, `[binary] source=bundled WARNING: no vendor or system Chrome found — icon will appear blue Chromium. Place Chrome at vendor/chrome-win/Chrome-bin/chrome.exe`);
      }
    }
    // Kick off version detection early so it runs concurrently with browser launch
    const _chromeVersionPromise = (!isFirefox && executablePath)
      ? getChromeVersion(executablePath).catch(() => null)
      : Promise.resolve(null);

    // Tổng hợp toàn bộ tùy chọn khởi động cho Chromium.
    // ignoreDefaultArgs: Playwright mặc định thêm '--enable-automation' — cần loại bỏ vì đây
    // là tín hiệu rõ ràng nhất để website nhận ra trình duyệt đang bị điều khiển tự động.
    // executablePath: đường dẫn tới Chrome binary (vendor/system); nếu không có thì Playwright
    // dùng Chromium tích hợp sẵn (bundled) — icon sẽ hiện màu xanh Chromium thay vì Chrome.
    const chromiumLaunchOpts = {
      headless,
      args,
      proxy,
      ignoreDefaultArgs: ['--enable-automation'],
      // channel: undefined — never use installed Chrome channel, always use executablePath or bundled
      ...(executablePath ? { executablePath } : {}),
    };

    // Firefox about:config prefs — tương đương Chrome flags nhưng theo định dạng riêng của Firefox.
    // Các giá trị này ghi đè about:config ngay khi trình duyệt khởi động.
    // Firefox about:config prefs to disable automation signals
    const firefoxUserPrefs = isFirefox ? {
      'dom.webdriver.enabled': false,         // Ẩn cờ WebDriver — website dùng cờ này để nhận ra Selenium/Playwright
      'useAutomationExtension': false,        // Tắt extension tự động hóa mặc định của Firefox
      // NOTE: do NOT set marionette.enabled=false — Playwright needs Marionette to control Firefox
      // KHÔNG tắt marionette vì đây là giao thức Playwright dùng để điều khiển Firefox
      'toolkit.telemetry.enabled': false,     // Tắt telemetry (gửi thông tin sử dụng về Mozilla)
      'toolkit.telemetry.unified': false,
      'datareporting.policy.dataSubmissionEnabled': false,
      'datareporting.healthreport.uploadEnabled': false,
      'browser.newtabpage.activity-stream.telemetry': false,
      'browser.ping-centre.telemetry': false,
      'browser.send_pings': false,            // Tắt ping tracking khi click link
      'media.peerconnection.ice.no_host': false, // Cho phép ICE host candidates (cần cho WebRTC đúng cách)
      'privacy.resistFingerprinting': false,  // leave off — causes inconsistent FP values
      // Tắt resistFingerprinting: tính năng này của Firefox tự sửa nhiều giá trị FP,
      // gây mâu thuẫn với FP chúng ta muốn inject vào — tắt để kiểm soát hoàn toàn.
      'privacy.trackingprotection.enabled': false,
      'geo.enabled': false,                   // Tắt geolocation thật của Firefox; ta sẽ inject giả qua CDP
      'browser.safebrowsing.enabled': false,  // Tắt safe browsing — tránh request đến Google gây delay
      'browser.safebrowsing.malware.enabled': false,
      'network.cookie.cookieBehavior': 0,     // Cho phép tất cả cookie (không chặn third-party)
      'browser.aboutConfig.showWarning': false, // Tắt cảnh báo khi mở about:config
      'general.warnOnAboutConfig': false,
    } : undefined;

    // Bước 6: Gọi Playwright để khởi động trình duyệt
    //   - Chromium: dùng pwEngine.launch() ở pipe mode (không mở WebSocket ra ngoài)
    //   - Firefox/Camoufox: dùng launchServer() sau đó connect() qua wsEndpoint
    //   Nếu lỗi "not installed", tự động chạy `npx playwright install` rồi thử lại
    let server;
    let browser;
    try {
      if (isFirefox) {
        const ffOpts = { headless, args, proxy, firefoxUserPrefs };
        if (executablePath) ffOpts.executablePath = executablePath;
        server = await pwEngine.launchServer(ffOpts);
        browser = await pwEngine.connect(server.wsEndpoint());
      } else {
        browser = await pwEngine.launch(chromiumLaunchOpts);
      }
    }
    catch (e) {
      const msg = e?.message || String(e);
      appendLog(profileId, `Playwright launch failed: ${msg}`);
      if (/playwright\s+install|executable|not\s+found|Please run/i.test(msg)) {
        const bname = isFirefox ? 'firefox' : 'chromium';
        appendLog(profileId, `Attempting auto-install playwright browsers (${bname})...`);
        const ok = await runPlaywrightInstall(bname);
        if (!ok) { try { await forwarder?.stop?.(); } catch { } return { success: false, error: 'Playwright browsers not installed.' }; }
        if (isFirefox) {
          const ffOpts = { headless, args, proxy, firefoxUserPrefs };
          if (executablePath) ffOpts.executablePath = executablePath;
          server = await pwEngine.launchServer(ffOpts);
          browser = await pwEngine.connect(server.wsEndpoint());
        } else {
          browser = await pwEngine.launch(chromiumLaunchOpts);
        }
      } else { try { await forwarder?.stop?.(); } catch { } throw e; }
    }
    // Log actual binary version for verification — should show Chrome/1xx not HeadlessChrome
    // Nếu log hiện "HeadlessChrome" thay vì "Chrome" nghĩa là Chrome binary không được tìm thấy,
    // Playwright đang dùng Chromium bundled — website có thể phát hiện đây là headless browser.
    try { appendLog(profileId, `[binary] version=${browser.version()}`); } catch { }
    // wsEndpoint: địa chỉ WebSocket để kết nối đến Firefox server (vd: ws://127.0.0.1:PORT/...).
    // Chromium dùng pipe mode nên wsEndpoint = null — không có WebSocket bên ngoài.
    // Giá trị 'pipe' trong runningProfiles Map báo hiệu cho renderer biết đây là pipe mode.
    const wsEndpoint = isFirefox ? server.wsEndpoint() : null; // pipe mode for chromium
    appendLog(profileId, `Launched Playwright ${isFirefox ? 'Firefox server: ' + wsEndpoint : 'browser (pipe mode, no external WS)'}`);

    // Await version detection — started before launch, so usually already resolved by now
    detectedChromeVersion = await _chromeVersionPromise;
    if (detectedChromeVersion) appendLog(profileId, `[binary] detected version=${detectedChromeVersion}`);


    // safeMode: opt-in Cloudflare Enterprise bypass mode — skips CDP emulation (UA, locale,
    // timezone, geolocation) and Object.defineProperty overrides that CF detects.
    // Disabled by default so fingerprint injection works normally.
    // Enable via settings.safeMode=true only when targeting Cloudflare Enterprise.
    // Firefox: always false (CF blocks Firefox by TLS regardless; need full injection).
    //
    // Giải thích safeMode: Cloudflare Enterprise có thể phát hiện các override CDP (như đặt
    // UA giả, timezone giả qua DevTools Protocol). safeMode=true bỏ qua các override đó,
    // chỉ giữ lại những thứ Cloudflare không kiểm tra — giúp vượt WAF enterprise.
    // Tuy nhiên đây là sự đánh đổi: FP sẽ ít "giả" hơn, phù hợp cho Cloudflare nhưng
    // không đủ để qua các hệ thống FP detection khác như Pixelscan, CreepJS.
    const safeMode = isFirefox ? false : (settings?.safeMode === true);
    // apply: object kiểm soát từng loại override có bật không (vd: apply.userAgent=false thì không giả UA).
    const apply = (settings && settings.applyOverrides) || {};
    // Identity section toggle controls UA, language, timezone at context (CDP) level
    // identitySectionEnabled: toggle tổng của nhóm "Identity" trong UI —
    // tắt toàn bộ nhóm này sẽ tắt luôn UA, ngôn ngữ, timezone.
    const identitySectionEnabled = settings?.identity?.enabled !== false;
    // Các cờ applyXxx: kết hợp safeMode + toggle nhóm + toggle riêng từng mục.
    // Chỉ khi tất cả điều kiện đều true thì override tương ứng mới được áp dụng.
    const applyUA = !safeMode && apply.userAgent !== false && identitySectionEnabled;
    const applyLang = !safeMode && apply.language !== false && identitySectionEnabled;
    const applyTz = !safeMode && apply.timezone !== false && identitySectionEnabled;
    const applyViewport = apply.viewport !== false; // viewport is safe even in safeMode
    const applyGeo = !safeMode && apply.geolocation !== false;
    // contextOptions: tập hợp tất cả tùy chọn sẽ truyền vào browser.newContext() —
    // đây là nơi Playwright áp dụng giả mạo ở cấp độ browser context (UA, locale, timezone,
    // viewport, proxy, geolocation, storageState, extraHTTPHeaders).
    const contextOptions = { proxy, extraHTTPHeaders: {} };

    // Force UA to match the actual binary version — prevents binary/UA mismatch detection.
    // If detectedChromeVersion is available, rebuild the UA with the real version number.
    //
    // Giải thích: website có thể dùng JavaScript (navigator.userAgent) và HTTP header (User-Agent)
    // để đọc phiên bản Chrome. Nếu UA giả trong profile ghi "Chrome/120" nhưng binary thật là
    // Chrome/136, hai giá trị sẽ mâu thuẫn — website phát hiện bất thường này.
    // Đoạn code này tự động cập nhật phần số phiên bản trong UA giả để khớp với binary thật.
    if (!isFirefox && detectedChromeVersion && fp.userAgent) {
      const fixedUA = fp.userAgent.replace(/Chrome\/[\d.]+/, `Chrome/${detectedChromeVersion}`);
      if (fixedUA !== fp.userAgent) {
        fp.userAgent = fixedUA;
        appendLog(profileId, `[binary] UA synced to binary version: Chrome/${detectedChromeVersion}`);
      }
    }

    // Thiết lập ngôn ngữ giả (locale) cho context và HTTP header Accept-Language.
    // Cả hai phải khớp nhau — nếu locale='vi-VN' nhưng header vẫn là 'en-US' thì website
    // sẽ phát hiện mâu thuẫn qua Intl.DateTimeFormat().resolvedOptions().locale vs navigator.language.
    if (applyLang) {
      const spoofLang = fp.language || settings.language || 'en-US';
      contextOptions.locale = spoofLang;
      const langBase = spoofLang.split('-')[0]; // lấy phần gốc ngôn ngữ, vd: 'vi' từ 'vi-VN'
      if (spoofLang.toLowerCase().startsWith('en')) {
        // Tiếng Anh: chỉ gửi một q-factor (không cần fallback sang ngôn ngữ khác)
        contextOptions.extraHTTPHeaders['Accept-Language'] = `${spoofLang},en;q=0.9`;
      } else {
        // Ngôn ngữ khác: thêm fallback theo thứ tự ưu tiên giảm dần
        contextOptions.extraHTTPHeaders['Accept-Language'] = `${spoofLang},${langBase};q=0.9,en;q=0.8`;
      }
    }
    // Thiết lập múi giờ giả — JavaScript Date và Intl API sẽ dùng timezone này.
    if (applyTz) contextOptions.timezoneId = fp.timezone || settings.timezone || 'UTC';
    // Thiết lập User-Agent giả — cả HTTP header lẫn navigator.userAgent sẽ trả về giá trị này.
    if (applyUA && fp.userAgent) contextOptions.userAgent = fp.userAgent;
    // Apply viewport and device scale like CDP DeviceMetricsOverride
    // Thiết lập độ phân giải màn hình giả (viewport) và tỷ lệ pixel (devicePixelRatio).
    // screenResolution dạng "1920x1080" sẽ được parse thành width=1920, height=1080.
    // devicePixelRatio: Retina display = 2, màn hình thường = 1 — website dùng để đoán loại thiết bị.
    try {
      if (applyViewport) {
        const m = (fp.screenResolution || '').match(/^(\d+)x(\d+)$/);
        if (m) contextOptions.viewport = { width: Math.max(1, parseInt(m[1], 10)), height: Math.max(1, parseInt(m[2], 10)) };
        const dpr = Number((settings.advanced || {}).devicePixelRatio || 1);
        if (dpr > 0) contextOptions.deviceScaleFactor = dpr;
      }
    } catch { }
    // Thiết lập vị trí địa lý giả — Playwright inject vào browser context.
    // accuracy (độ chính xác tính bằng mét): thấp = GPS tốt, cao = định vị kém chính xác.
    if (applyGeo && settings.geolocation && settings.geolocation.latitude != null && settings.geolocation.longitude != null) {
      contextOptions.geolocation = {
        latitude: Number(settings.geolocation.latitude),
        longitude: Number(settings.geolocation.longitude),
        accuracy: Number(settings.geolocation.accuracy || 50),
      };
    }
    // storageState: đường dẫn tới file JSON chứa cookie, localStorage, sessionStorage của profile.
    // Playwright tự động nạp state này vào context để tiếp tục phiên đăng nhập từ lần trước —
    // người dùng không cần đăng nhập lại mỗi lần mở profile.
    const statePath = storageStatePath(profileId);
    if (fs.existsSync(statePath)) { try { contextOptions.storageState = statePath; } catch { } }
    // Tạo browser context mới với toàn bộ tùy chọn đã chuẩn bị.
    // Đây là bước quan trọng nhất: từ đây trở đi mọi tab/page trong context này sẽ
    // dùng UA giả, timezone giả, locale giả, cookie đã lưu, v.v.
    const context = await browser.newContext(contextOptions);
    // Cấp quyền cho context (micro/camera/geolocation) — nếu không cấp, trình duyệt
    // sẽ hỏi người dùng popup, hoặc tự từ chối nếu ở headless mode.
    if (permissions.length) { await context.grantPermissions(permissions); }
    // Bước 7: Inject fingerprint qua applyFingerprintInitScripts —
    // Tiêm các init script vào mọi trang mới để giả mạo (spoof) các thuộc tính trình duyệt:
    // UserAgent, Navigator (platform, plugins, hardwareConcurrency), WebGL renderer/vendor,
    // Canvas noise, AudioContext fingerprint, Screen resolution, Fonts, v.v.
    // safeMode=true sẽ bỏ qua Object.defineProperty overrides (dùng cho Cloudflare Enterprise).
    // Apply fingerprint init scripts (reuse safeMode from context options above)
    try {
      const { applyFingerprintInitScripts } = require('../engine/fingerprintInit');
      await applyFingerprintInitScripts(context, profile, settings, { safeMode, isFirefox });
    } catch { }
    // Inject mouse position tracker for behavior simulator
    try {
      const { injectMouseTracker } = require('../engine/behaviorSimulator');
      await injectMouseTracker(context);
    } catch { }

    // Bước 7b: Khôi phục các tab đã lưu từ phiên trước (session restore).
    // Khi người dùng đóng profile, hệ thống lưu lại danh sách URL các tab đang mở.
    // Lần sau mở profile, các tab này sẽ được mở lại tự động — giống behavior của Chrome bình thường.
    const { loadSessionTabs, saveSessionTabs } = require('../storage/sessionTabs');
    const rawSavedTabs = loadSessionTabs(profileId);
    // Lọc chỉ giữ URL http/https hợp lệ — loại bỏ 'about:blank', chrome://, và rác khác
    // để tránh lỗi khi cố navigate đến các URL không phải trang web thực.
    // Only restore valid http/https URLs — filter out about:blank, en-us, and other garbage
    const savedTabs = (rawSavedTabs || []).filter(u => typeof u === 'string' && /^https?:\/\//i.test(u));
    appendLog(profileId, `Session tabs: found ${savedTabs.length} saved tab(s)${savedTabs.length > 0 ? ': ' + savedTabs.join(', ') : ''}`);
    let page;
    if (savedTabs && savedTabs.length > 0) {
      // Có tab đã lưu: mở lại từng tab. Tab đầu tiên dùng tab mặc định của context,
      // các tab tiếp theo tạo mới. goto() không await để các tab load song song.
      appendLog(profileId, `Restoring ${savedTabs.length} saved tabs...`);
      let first = true;
      for (const url of savedTabs) {
        try {
          // Tab đầu tiên: tái dùng tab mặc định Playwright tạo sẵn (tránh mở thêm tab trắng thừa)
          const p = first ? ((context.pages() || [])[0] || await context.newPage()) : await context.newPage();
          first = false;
          // Không await — để các tab load song song thay vì tuần tự (nhanh hơn)
          p.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(err => {
            appendLog(profileId, `Failed to load restored tab ${url}: ${err?.message || err}`);
          });
        } catch (e) {
          appendLog(profileId, `Failed to create tab for ${url}: ${e?.message || e}`);
        }
      }
    } else {
      // Không có tab đã lưu: mở trang khởi động (startUrl) được cấu hình trong profile.
      // Reuse the default tab that Playwright opens (avoids double-tab on Firefox)
      // Tái dùng tab mặc định thay vì tạo mới — tránh Firefox mở 2 tab trắng trùng lặp.
      const existingPages = context.pages();
      if (existingPages && existingPages.length > 0) {
        page = existingPages[0];
      } else {
        page = await context.newPage();
      }
      try {
        // navigateWithRetry: điều hướng có retry tự động — nếu trang bị chặn hoặc timeout,
        // tự thử lại tối đa maxRetries lần trước khi báo lỗi.
        // installBlockDetector: theo dõi nếu trang bị chặn (Cloudflare, 403...) và ghi log.
        const { navigateWithRetry, installBlockDetector } = require('../engine/blockedPageDetector');
        const navResult = await navigateWithRetry(page, startUrl, profileId, {
          maxRetries: 2, retryDelayMs: 5000, waitUntil: 'domcontentloaded', timeout: 30000,
        });
        if (navResult.blocked) {
          // Cảnh báo bị chặn nhưng không đóng browser — người dùng vẫn có thể thao tác thủ công
          appendLog(profileId, `Warning: page may be blocked (${navResult.pattern}). Browser is open for manual interaction.`);
        }
        installBlockDetector(page, profileId);
      } catch (navErr) {
        // Navigation thất bại lần 1: đợi 2 giây rồi thử lại lần 2 (đơn giản, không retry logic)
        appendLog(profileId, `First navigation attempt failed: ${navErr?.message || navErr}. Retrying...`);
        try {
          await new Promise(r => setTimeout(r, 2000));
          await page.goto(startUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        } catch (retryErr) {
          // Thất bại cả hai lần: browser vẫn mở để người dùng tự điều hướng thủ công
          appendLog(profileId, `Second navigation attempt failed: ${retryErr?.message || retryErr}. Browser is open but page not loaded.`);
        }
      }
      appendLog(profileId, `Opened page: ${startUrl}`);
    }

    // Track last-known URL per page so we can save session tabs when user closes browser window
    // pageUrls: Map<Page, string> — lưu URL cuối cùng của từng tab.
    // Cần thiết vì khi tất cả tab đóng, context.pages() sẽ trả về mảng rỗng —
    // không còn cách nào lấy URL nữa. Map này giữ lại URL trước khi tab bị đóng.
    const pageUrls = new Map();
    const trackPageUrls = (p) => {
      try {
        // Cập nhật URL mỗi khi frame chính điều hướng (bỏ qua iframe con và about:blank)
        const update = () => { try { const u = p.url(); if (u && u !== 'about:blank' && !/^chrome(-error)?:\/\//.test(u)) pageUrls.set(p, u); } catch {} };
        update(); // lấy URL hiện tại ngay lập tức (tab vừa được tạo/restore)
        p.on('framenavigated', f => { if (f === p.mainFrame()) update(); });
      } catch {}
    };

    // saveState: lưu toàn bộ trạng thái phiên làm việc của profile trước khi đóng.
    // Gồm 2 phần:
    //   1) storageState (cookie, localStorage, sessionStorage) → file JSON trên disk
    //   2) Danh sách URL các tab đang mở → sessionTabs storage
    // Được gọi tự động khi browser đóng (qua cleanupPlaywright bên dưới).
    const saveState = async () => {
      try {
        // context.storageState() trả về object chứa cookies và origins (localStorage).
        // Ghi ra file để lần sau mở profile sẽ nạp lại (contextOptions.storageState).
        const state = await context.storageState();
        fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
        appendLog(profileId, `Saved storage state (${(state.cookies || []).length} cookies)`);
      } catch (e) {
        const msg = e?.message || String(e);
        // Nếu context đã đóng trước khi save xong thì bỏ qua — không phải lỗi nghiêm trọng
        if (/has been closed/i.test(msg)) appendLog(profileId, 'Storage save skipped: context closed');
        else appendLog(profileId, `Error saving storage state: ${msg}`);
      }
      try {
        // Lưu danh sách URL tab: ưu tiên lấy từ context.pages() (tab còn sống),
        // nếu đã đóng hết thì lấy từ pageUrls Map (URL cuối cùng được track).
        const pages = context.pages();
        const urlsToSave = pages.length > 0 ? pages.map(p => p.url()) : [...pageUrls.values()].filter(u => u);
        if (urlsToSave.length > 0) saveSessionTabs(profileId, urlsToSave);
      } catch { }
    };
    // cleanupPlaywright: dọn dẹp toàn bộ tài nguyên khi profile dừng chạy (bất kể lý do).
    // playwrightCleaned flag đảm bảo cleanup chỉ chạy đúng 1 lần, dù nhiều sự kiện
    // (context close + browser disconnect + page close) có thể kích hoạt cùng lúc.
    // Cleanup helper
    let playwrightCleaned = false;
    const cleanupPlaywright = async (reason) => {
      if (playwrightCleaned) return; // bảo vệ: không chạy cleanup lần 2
      playwrightCleaned = true;
      await saveState(); // lưu session trước khi đóng
      try { await forwarder?.stop?.(); } catch { } // dừng proxy forwarder nếu có
      runningProfiles.delete(profileId); // xóa khỏi Map profiles đang chạy
      setProfileStatus(profileId, 'STOPPED');
      appendLog(profileId, reason);
      try { await context.close(); } catch { } // đóng browser context (tắt tất cả tab)
      try { await browser?.close?.(); } catch { } // đóng browser process
      broadcastRunningMap(); // thông báo UI cập nhật trạng thái profile thành STOPPED
    };
    // Lắng nghe sự kiện đóng từ phía Playwright — context.close() hoặc browser crash/disconnect
    context.on('close', () => cleanupPlaywright('Context closed'));
    try { browser.on?.('disconnected', () => cleanupPlaywright('Browser disconnected')); } catch { }
    // Detect when user closes all browser tabs via "X" button
    // Phát hiện khi người dùng đóng tất cả tab bằng nút "X" trên cửa sổ trình duyệt.
    // Playwright không có sự kiện "window closed" trực tiếp — phải kiểm tra sau mỗi
    // tab đóng: nếu không còn tab nào (pages.length === 0) thì coi như browser đã đóng.
    const onPageClose = () => {
      try {
        const pages = context.pages();
        if (!pages || pages.length === 0) {
          // Tất cả tab đã đóng: lưu URL từ pageUrls Map trước khi cleanup
          const trackedUrls = [...pageUrls.values()].filter(u => /^https?:\/\//i.test(u));
          if (trackedUrls.length > 0) {
            try { saveSessionTabs(profileId, trackedUrls); appendLog(profileId, `Saved ${trackedUrls.length} session tab(s) on browser close`); } catch {}
          }
          appendLog(profileId, 'All browser pages closed by user');
          cleanupPlaywright('All pages closed — browser stopped');
        }
      } catch { cleanupPlaywright('Page close check failed — browser stopped'); }
    };
    // Gắn tracker và listener vào các tab hiện có và tất cả tab mới được tạo sau này
    try { for (const p of context.pages()) { trackPageUrls(p); p.on('close', onPageClose); } } catch { }
    // context.on('page'): kích hoạt khi người dùng mở tab mới (Ctrl+T hoặc popup)
    context.on('page', (newPage) => { try { trackPageUrls(newPage); newPage.on('close', onPageClose); } catch { } });
    // Bước 8: Lưu thông tin phiên đang chạy vào runningProfiles Map —
    // Map này là nguồn dữ liệu thực đơn nhất (single source of truth) cho mọi handler
    // cần truy cập browser/context của một profile đang hoạt động.
    runningProfiles.set(profileId, { engine: 'playwright', server, browser, context, wsEndpoint, forwarder, headless: !!headless, startedAt: Date.now() });
    // Bước 9: Cập nhật trạng thái sang RUNNING và broadcast về tất cả cửa sổ UI
    setProfileStatus(profileId, 'RUNNING', instanceId);
    broadcastRunningMap();
    // Auto-start screencast for headless Playwright profiles
    // Khi chạy headless (không có cửa sổ UI), người dùng cần "Live Screen" để xem trình duyệt.
    // Screencast stream frame từ Playwright CDP về UI Electron qua IPC để hiển thị.
    if (headless) {
      try {
        const { startScreencast } = require('../engine/screencast');
        startScreencast(profileId);
        appendLog(profileId, '[lifecycle] Auto-started screencast for headless profile');
      } catch (e) {
        appendLog(profileId, `[lifecycle] Auto-start screencast failed: ${e?.message || e}`);
      }
    }
    // Chạy automation script được cấu hình sẵn trong profile (nếu có).
    // Ví dụ: sau khi mở browser, tự động navigate đến URL nào đó, điền form, chờ N giây...
    // Post-launch automation script (if configured)
    try { await runAutomationPostLaunch(profile, { engine: 'playwright', wsEndpoint, context, browser }); } catch (e) { appendLog(profileId, `Automation post-launch error: ${e?.message || e}`); }
    // Trả về kết quả thành công kèm wsEndpoint.
    // wsEndpoint = null (pipe mode, Chromium) hoặc URL WebSocket (Firefox server).
    // Caller (IPC handler) dùng wsEndpoint để cho phép kết nối automation từ bên ngoài.
    return { success: true, wsEndpoint };
  } catch (error) {
    // Nếu có lỗi bất kỳ trong quá trình khởi động: cập nhật trạng thái ERROR và báo UI
    setProfileStatus(profileId, 'ERROR', instanceId);
    broadcastRunningMap();
    appendLog(profileId, `Launch error: ${error.message}`);
    return { success: false, error: error.message };
  } finally {
    // finally luôn chạy dù thành công hay thất bại — giải phóng lock launchingProfiles.
    // Nếu không xóa lock ở đây, profile sẽ bị kẹt ở trạng thái "đang khởi động"
    // và mọi yêu cầu mở tiếp theo đều bị từ chối với lỗi "Profile is already starting up".
    launchingProfiles.delete(profileId);
  }
}

// Helper to execute automation steps / script after launch
async function runAutomationPostLaunch(profile, launchCtx) {
  if (!profile || !profile.automation || !profile.automation.enabled) return;
  const { automation } = profile;
  if (!automation.runOnLaunch && !(automation.schedule && automation.schedule.enabled)) return; // nothing immediate
  // Only run immediate steps if runOnLaunch
  if (!automation.runOnLaunch) return;
  const steps = Array.isArray(automation.steps) ? automation.steps : [];
  if (!steps.length) return;
  const profileId = profile.id;
  appendLog(profileId, `Automation: executing ${steps.length} step(s) post-launch`);
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    try {
      if (!step || typeof step !== 'object') continue;
      switch (step.action) {
        case 'wait': {
          const ms = Number(step.ms || step.duration || 0);
          if (ms > 0 && ms < 10 * 60 * 1000) await new Promise(r => setTimeout(r, ms));
          appendLog(profileId, `Automation: waited ${ms}ms`);
          break;
        }
        case 'navigate': {
          const url = step.url || step.href;
          if (!url) { appendLog(profileId, 'Automation: navigate step missing url'); break; }
          {
            const context = launchCtx.context;
            const page = context.pages()[0] || await context.newPage();
            await page.goto(url, { waitUntil: step.waitUntil || 'domcontentloaded' });
          }
          appendLog(profileId, `Automation: navigated to ${url}`);
          break;
        }
        case 'eval': {
          const expression = step.expression || step.code;
          if (!expression) { appendLog(profileId, 'Automation: eval step missing expression'); break; }
          {
            const context = launchCtx.context;
            const page = context.pages()[0] || await context.newPage();
            const value = await page.evaluate(expr => {
              try { return { ok: true, value: eval(expr) }; } catch (e) { return { ok: false, error: e?.message || String(e) }; }
            }, expression);
            appendLog(profileId, `Automation eval: ${value.ok ? JSON.stringify(value.value).slice(0, 200) : ('ERR ' + value.error)}`);
          }
          break;
        }
        case 'screenshot': {
          // Optional future implementation; currently no-op except log
          appendLog(profileId, 'Automation: screenshot step (not yet implemented)');
          break;
        }
        case 'behavior': {
          // Human-like behavior simulation step
          // Supported types: browse, scroll, idle, click, type
          try {
            const behavior = require('../engine/behaviorSimulator');
            const seed = (profileId || '').split('').reduce((h, c) => ((h << 5) - h) + c.charCodeAt(0), 0);
            const rng = behavior.createRng(Math.abs(seed) + Date.now());
            let page;
            if (launchCtx.context) {
              page = launchCtx.context.pages()[0];
            }
            if (page) {
              const behaviorType = step.behaviorType || 'browse';
              switch (behaviorType) {
                case 'browse': await behavior.simulateBrowsing(page, rng, step); break;
                case 'scroll': await behavior.naturalScroll(page, rng, step); break;
                case 'idle': await behavior.simulateIdle(page, rng, step); break;
                case 'click': if (step.selector) await behavior.humanClick(page, rng, step.selector, step); break;
                case 'type': if (step.selector && step.text) await behavior.humanType(page, rng, step.selector, step.text, step); break;
                default: await behavior.simulateBrowsing(page, rng, step);
              }
              appendLog(profileId, `Automation: behavior simulation (${behaviorType})`);
            } else {
              appendLog(profileId, 'Automation: behavior step skipped — no page available');
            }
          } catch (e) {
            appendLog(profileId, `Automation: behavior step failed: ${e?.message || e}`);
          }
          break;
        }
        default:
          appendLog(profileId, `Automation: unknown step action '${step.action}'`);
      }
    } catch (e) {
      appendLog(profileId, `Automation step ${i} error: ${e?.message || e}`);
    }
  }
}

/**
 * Dừng trình duyệt đang chạy của một profile cụ thể.
 * Các bước thực hiện:
 *   1. Kiểm tra xem profile có đang chạy không — nếu không, trả về ngay với thành công
 *   2. Cập nhật trạng thái sang STOPPING và broadcast về UI
 *   3. Dừng luồng screencast (nếu đang phát) để tránh zombie loop
 *   4. Lưu storage state (cookies, localStorage) vào file trước khi đóng
 *   5. Đóng context → browser → server theo thứ tự an toàn
 *   6. Xóa profile khỏi runningProfiles Map, cập nhật trạng thái STOPPED
 *   7. Broadcast trạng thái mới về tất cả cửa sổ UI
 */
async function stopProfileInternal(profileId) {
  try {
    // Bước 1: Kiểm tra profile có đang chạy không
    const running = runningProfiles.get(profileId);
    if (!running) {
      setProfileStatus(profileId, 'STOPPED');
      broadcastRunningMap();
      return { success: true, message: 'Profile not running' };
    }
    // Bước 2: Đánh dấu STOPPING và thông báo UI ngay lập tức
    setProfileStatus(profileId, 'STOPPING');
    broadcastRunningMap();

    // Bước 3: Stop screencast loop before cleanup (prevents zombie loops)
    try {
      const { stopScreencast } = require('../engine/screencast');
      stopScreencast(profileId);
    } catch { }

    // Bước 4: Lưu toàn bộ storage state (cookies, localStorage, sessionStorage) ra file
    // Playwright: close context/browser/server
    const { server, context, browser } = running;
    try {
      const statePath = storageStatePath(profileId);
      const state = await context.storageState();
      fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
      appendLog(profileId, 'Saved storage state before stop');
    } catch (e) { appendLog(profileId, `Failed saving state on stop: ${e.message}`); }
    // Lưu session tabs TRƯỚC khi đóng context — sau khi context.close() thì pages() = []
    try {
      const { saveSessionTabs } = require('../storage/sessionTabs');
      const pages = context.pages();
      if (pages && pages.length > 0) {
        saveSessionTabs(profileId, pages.map(p => p.url()));
        appendLog(profileId, `Saved ${pages.length} session tab(s) before stop`);
      }
    } catch (e) { appendLog(profileId, `Failed saving session tabs on stop: ${e.message}`); }
    // Bước 5: Đóng context → browser → server theo thứ tự từ trong ra ngoài
    try { await context.close(); } catch { }
    try { await browser?.close?.(); } catch { }
    try { await server?.close?.(); } catch { }
    // Bước 6: Xóa khỏi Map và cập nhật trạng thái STOPPED
    runningProfiles.delete(profileId);
    setProfileStatus(profileId, 'STOPPED');
    appendLog(profileId, 'Stopped profile');
    // Bước 7: Broadcast trạng thái mới về UI
    broadcastRunningMap();
    return { success: true };
  } catch (error) {
    setProfileStatus(profileId, 'ERROR');
    broadcastRunningMap();
    appendLog(profileId, `Stop error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function stopAllProfilesInternal() {
  const ids = [...runningProfiles.keys()];
  let stopped = 0;
  for (const id of ids) {
    try {
      const running = runningProfiles.get(id);
      if (!running) continue;
      const { server, context, browser } = running;
      try { const state = await context.storageState(); fs.writeFileSync(storageStatePath(id), JSON.stringify(state, null, 2)); appendLog(id, 'Saved storage state before stop-all'); } catch (e) { appendLog(id, `Failed save state on stop-all: ${e.message}`); }
      try { const { saveSessionTabs } = require('../storage/sessionTabs'); const pages = context.pages(); if (pages && pages.length > 0) { saveSessionTabs(id, pages.map(p => p.url())); appendLog(id, `Saved ${pages.length} session tab(s) before stop-all`); } } catch (e) { appendLog(id, `Failed saving session tabs on stop-all: ${e.message}`); }
      try { await context.close(); } catch { }
      try { await browser?.close?.(); } catch { }
      try { await server?.close?.(); } catch { }
      runningProfiles.delete(id); setProfileStatus(id, 'STOPPED'); appendLog(id, 'Stopped by stop-all');
      stopped++;
    } catch (e) { appendLog(id, `Stop-all error: ${e.message}`); }
  }
  broadcastRunningMap();
  return { success: true, stopped };
}

// Browser control helpers
async function withConnectedBrowserForProfile(profileId, fn) {
  const running = runningProfiles.get(profileId);
  if (!running) return { success: false, error: 'Profile not running' };
  try {
    const browser = running.browser; const context = running.context;
    if (!browser || !context || context.isClosed?.()) return { success: false, error: 'Browser context not available' };
    const r = await fn({ browser, context, cleanup: async () => { } });
    return r;
  } catch (e) { return { success: false, error: e?.message || String(e) }; }
}

async function listPagesInternal(profileId) { return await withConnectedBrowserForProfile(profileId, async ({ context, cleanup }) => { try { const pages = context.pages(); const out = []; let i = 0; for (const p of pages) { const title = await p.title().catch(() => ''); out.push({ index: i, url: p.url(), title }); i++; } await cleanup(); return { success: true, pages: out }; } catch (e) { await cleanup(); return { success: false, error: e?.message || String(e) }; } }); }

async function navigateInternal(profileId, { url, newPage = false, waitUntil = 'load' } = {}) { if (!url) return { success: false, error: 'url is required' }; return await withConnectedBrowserForProfile(profileId, async ({ context, cleanup }) => { try { let page; if (newPage || context.pages().length === 0) { page = await context.newPage(); } else { page = context.pages()[0]; } await page.goto(url, { waitUntil }); const title = await page.title().catch(() => ''); const currentUrl = page.url(); await cleanup(); return { success: true, url: currentUrl, title }; } catch (e) { await cleanup(); return { success: false, error: e?.message || String(e) }; } }); }

async function newPageInternal(profileId, { url, waitUntil = 'domcontentloaded' } = {}) { return await withConnectedBrowserForProfile(profileId, async ({ context, cleanup }) => { try { const page = await context.newPage(); if (url) await page.goto(url, { waitUntil }); const index = context.pages().indexOf(page); const title = await page.title().catch(() => ''); const currentUrl = page.url(); await cleanup(); return { success: true, index, url: currentUrl, title }; } catch (e) { await cleanup(); return { success: false, error: e?.message || String(e) }; } }); }

async function closePageInternal(profileId, { index = 0 } = {}) { return await withConnectedBrowserForProfile(profileId, async ({ context, cleanup }) => { try { const pages = context.pages(); if (index < 0 || index >= pages.length) { await cleanup(); return { success: false, error: 'Invalid page index' }; } const page = pages[index]; await page.close({ runBeforeUnload: true }); await cleanup(); return { success: true }; } catch (e) { await cleanup(); return { success: false, error: e?.message || String(e) }; } }); }

async function screenshotInternal(profileId, { index = 0, path: outPath, fullPage = false } = {}) { return await withConnectedBrowserForProfile(profileId, async ({ context, cleanup }) => { try { const pages = context.pages(); const page = pages[index] || pages[0] || (await context.newPage()); if (!page) { await cleanup(); return { success: false, error: 'No page available' }; } let result = {}; if (outPath) { try { require('fs').mkdirSync(require('path').dirname(outPath), { recursive: true }); } catch { } await page.screenshot({ path: outPath, fullPage: !!fullPage, type: 'png' }); result = { path: outPath }; } else { const buf = await page.screenshot({ fullPage: !!fullPage, type: 'png' }); result = { base64: buf.toString('base64') }; } await cleanup(); return { success: true, ...result }; } catch (e) { await cleanup(); return { success: false, error: e?.message || String(e) }; } }); }

async function evalInternal(profileId, { index = 0, expression } = {}) { if (typeof expression !== 'string') return { success: false, error: 'expression must be a string' }; return await withConnectedBrowserForProfile(profileId, async ({ context, cleanup }) => { try { const pages = context.pages(); const page = pages[index] || pages[0] || (await context.newPage()); const value = await page.evaluate(expr => { try { return eval(expr); } catch (e) { return { __error: true, message: e?.message || String(e) }; } }, expression); await cleanup(); if (value && value.__error) return { success: false, error: value.message }; return { success: true, value }; } catch (e) { await cleanup(); return { success: false, error: e?.message || String(e) }; } }); }

async function reloadPageInternal(profileId, { index = 0, timeout, waitUntil = 'load' } = {}) { return await withConnectedBrowserForProfile(profileId, async ({ context, cleanup }) => { try { const pages = context.pages(); const page = pages[index] || pages[0]; if (!page) { await cleanup(); return { success: false, error: 'No page available' }; } const opts = { waitUntil }; if (timeout != null) opts.timeout = Number(timeout); await page.reload(opts); const title = await page.title().catch(() => ''); await cleanup(); return { success: true, url: page.url(), title }; } catch (e) { await cleanup(); return { success: false, error: e?.message || String(e) }; } }); }

async function goBackInternal(profileId, { index = 0, waitUntil = 'load' } = {}) { return await withConnectedBrowserForProfile(profileId, async ({ context, cleanup }) => { try { const pages = context.pages(); const page = pages[index] || pages[0]; if (!page) { await cleanup(); return { success: false, error: 'No page available' }; } const response = await page.goBack({ waitUntil }); await cleanup(); return { success: true, url: page.url(), navigated: !!response }; } catch (e) { await cleanup(); return { success: false, error: e?.message || String(e) }; } }); }

async function goForwardInternal(profileId, { index = 0, waitUntil = 'load' } = {}) { return await withConnectedBrowserForProfile(profileId, async ({ context, cleanup }) => { try { const pages = context.pages(); const page = pages[index] || pages[0]; if (!page) { await cleanup(); return { success: false, error: 'No page available' }; } const response = await page.goForward({ waitUntil }); await cleanup(); return { success: true, url: page.url(), navigated: !!response }; } catch (e) { await cleanup(); return { success: false, error: e?.message || String(e) }; } }); }

async function getPageInfoInternal(profileId, { index = 0 } = {}) { return await withConnectedBrowserForProfile(profileId, async ({ context, cleanup }) => { try { const pages = context.pages(); const page = pages[Number(index)] || pages[0]; if (!page) { await cleanup(); return { success: false, error: 'No page available' }; } const [title, url] = await Promise.all([page.title().catch(() => ''), Promise.resolve(page.url())]); await cleanup(); return { success: true, url, title }; } catch (e) { await cleanup(); return { success: false, error: e?.message || String(e) }; } }); }

async function getPageContentInternal(profileId, { index = 0 } = {}) { return await withConnectedBrowserForProfile(profileId, async ({ context, cleanup }) => { try { const pages = context.pages(); const page = pages[Number(index)] || pages[0]; if (!page) { await cleanup(); return { success: false, error: 'No page available' }; } const content = await page.content(); await cleanup(); return { success: true, content }; } catch (e) { await cleanup(); return { success: false, error: e?.message || String(e) }; } }); }

async function clickElementInternal(profileId, { selector, index = 0, button = 'left', clickCount = 1, delay } = {}) {
  if (!selector) return { success: false, error: 'selector is required' };
  return await withConnectedBrowserForProfile(profileId, async ({ context, cleanup }) => {
    try {
      const pages = context.pages();
      const page = pages[Number(index)] || pages[0];
      if (!page) { await cleanup(); return { success: false, error: 'No page available' }; }
      const opts = { button, clickCount };
      if (delay != null) opts.delay = Number(delay);
      await page.click(selector, opts);
      await cleanup();
      return { success: true };
    } catch (e) { await cleanup(); return { success: false, error: e?.message || String(e) }; }
  });
}

async function doubleClickElementInternal(profileId, { selector, index = 0, delay } = {}) {
  if (!selector) return { success: false, error: 'selector is required' };
  return await withConnectedBrowserForProfile(profileId, async ({ context, cleanup }) => {
    try {
      const pages = context.pages();
      const page = pages[Number(index)] || pages[0];
      if (!page) { await cleanup(); return { success: false, error: 'No page available' }; }
      const opts = {};
      if (delay != null) opts.delay = Number(delay);
      await page.dblclick(selector, opts);
      await cleanup();
      return { success: true };
    } catch (e) { await cleanup(); return { success: false, error: e?.message || String(e) }; }
  });
}

async function grantPermissionsInternal(profileId, { permissions = [], origin } = {}) {
  return await withConnectedBrowserForProfile(profileId, async ({ context, cleanup }) => {
    try {
      await context.grantPermissions(permissions, origin ? { origin } : undefined);
      await cleanup();
      return { success: true };
    } catch (e) {
      await cleanup();
      return { success: false, error: e?.message || String(e) };
    }
  });
}

async function clearPermissionsInternal(profileId) {
  return await withConnectedBrowserForProfile(profileId, async ({ context, cleanup }) => {
    try {
      await context.clearPermissions();
      await cleanup();
      return { success: true };
    } catch (e) {
      await cleanup();
      return { success: false, error: e?.message || String(e) };
    }
  });
}

async function setExtraHTTPHeadersInternal(profileId, { headers } = {}) {
  if (!headers || typeof headers !== 'object') return { success: false, error: 'headers must be an object' };
  return await withConnectedBrowserForProfile(profileId, async ({ context, cleanup }) => {
    try {
      await context.setExtraHTTPHeaders(headers);
      await cleanup();
      return { success: true };
    } catch (e) {
      await cleanup();
      return { success: false, error: e?.message || String(e) };
    }
  });
}

async function setGeolocationInternal(profileId, { latitude, longitude, accuracy } = {}) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { success: false, error: 'latitude and longitude are required numbers' };
  const geo = { latitude: lat, longitude: lng, accuracy: Number(accuracy ?? 50) };
  return await withConnectedBrowserForProfile(profileId, async ({ context, cleanup }) => {
    try {
      await context.setGeolocation(geo);
      await cleanup();
      return { success: true, geolocation: geo };
    } catch (e) {
      await cleanup();
      return { success: false, error: e?.message || String(e) };
    }
  });
}

async function getProfileLogInternal(profileId) { try { const p = require('path').join(getDataRoot(), 'logs', `${profileId}.log`); if (!fs.existsSync(p)) return { success: true, log: '' }; return { success: true, log: fs.readFileSync(p, 'utf8') }; } catch (error) { return { success: false, error: error.message }; } }

async function getCookiesInternal(profileId) { try { if (runningProfiles.has(profileId)) { const running = runningProfiles.get(profileId); if (running.context) { const cookies = await running.context.cookies(); return { success: true, cookies }; } } const statePath = storageStatePath(profileId); if (fs.existsSync(statePath)) { const state = JSON.parse(fs.readFileSync(statePath, 'utf8')); return { success: true, cookies: state.cookies || [] }; } return { success: true, cookies: [] }; } catch (error) { return { success: false, error: error.message }; } }

async function importCookiesInternal(profileId, cookies) { try { if (!Array.isArray(cookies)) throw new Error('Invalid cookies payload'); const validated = cookies.map(c => { if (!c.name || !c.value || !c.domain) throw new Error('Each cookie must have name, value, and domain'); return { name: String(c.name), value: String(c.value), domain: String(c.domain), path: String(c.path || '/'), expires: c.expires ? Number(c.expires) : -1, httpOnly: !!c.httpOnly, secure: !!c.secure, sameSite: ['Strict', 'Lax', 'None'].includes(c.sameSite) ? c.sameSite : 'Lax' }; }); if (runningProfiles.has(profileId)) { const running = runningProfiles.get(profileId); if (running.context) { await running.context.addCookies(validated); const statePath = storageStatePath(profileId); const state = await running.context.storageState(); fs.writeFileSync(statePath, JSON.stringify(state, null, 2)); return { success: true, count: validated.length }; } } const statePath = storageStatePath(profileId); let state = { cookies: [], origins: [] }; if (fs.existsSync(statePath)) { try { state = JSON.parse(fs.readFileSync(statePath, 'utf8')); } catch { } } const existing = state.cookies || []; for (const nc of validated) { const idx = existing.findIndex(e => e.name === nc.name && e.domain === nc.domain && e.path === nc.path); if (idx >= 0) existing[idx] = nc; else existing.push(nc); } state.cookies = existing; fs.writeFileSync(statePath, JSON.stringify(state, null, 2)); return { success: true, count: validated.length }; } catch (error) { return { success: false, error: error.message }; } }

async function deleteCookieInternal(profileId, { name, domain, path: cookiePath }) { try { if (!name || !domain) throw new Error('name and domain are required'); const targetPath = cookiePath || '/'; if (runningProfiles.has(profileId)) { const running = runningProfiles.get(profileId); if (running.context) { await running.context.addCookies([{ name, domain, path: targetPath, value: '', expires: 0 }]); const statePath = storageStatePath(profileId); const state = await running.context.storageState(); fs.writeFileSync(statePath, JSON.stringify(state, null, 2)); return { success: true }; } } const statePath = storageStatePath(profileId); if (!fs.existsSync(statePath)) return { success: true }; const state = JSON.parse(fs.readFileSync(statePath, 'utf8')); state.cookies = (state.cookies || []).filter(c => !(c.name === name && c.domain === domain && (c.path || '/') === targetPath)); fs.writeFileSync(statePath, JSON.stringify(state, null, 2)); return { success: true }; } catch (error) { return { success: false, error: error.message }; } }

async function clearCookiesInternal(profileId) { try { if (runningProfiles.has(profileId)) { const running = runningProfiles.get(profileId); if (running.context) { await running.context.clearCookies(); const statePath = storageStatePath(profileId); const state = await running.context.storageState(); fs.writeFileSync(statePath, JSON.stringify(state, null, 2)); return { success: true }; } } const statePath = storageStatePath(profileId); if (fs.existsSync(statePath)) { const state = JSON.parse(fs.readFileSync(statePath, 'utf8')); state.cookies = []; fs.writeFileSync(statePath, JSON.stringify(state, null, 2)); } return { success: true }; } catch (error) { return { success: false, error: error.message }; } }

async function editCookieInternal(profileId, cookie) { try { if (!cookie || !cookie.name || !cookie.domain) throw new Error('cookie with name and domain is required'); const validated = { name: String(cookie.name), value: String(cookie.value || ''), domain: String(cookie.domain), path: String(cookie.path || '/'), expires: cookie.expires ? Number(cookie.expires) : -1, httpOnly: !!cookie.httpOnly, secure: !!cookie.secure, sameSite: ['Strict', 'Lax', 'None'].includes(cookie.sameSite) ? cookie.sameSite : 'Lax' }; if (runningProfiles.has(profileId)) { const running = runningProfiles.get(profileId); if (running.context) { await running.context.addCookies([validated]); const statePath = storageStatePath(profileId); const state = await running.context.storageState(); fs.writeFileSync(statePath, JSON.stringify(state, null, 2)); return { success: true }; } } const statePath = storageStatePath(profileId); let state = { cookies: [], origins: [] }; if (fs.existsSync(statePath)) { try { state = JSON.parse(fs.readFileSync(statePath, 'utf8')); } catch { } } const existing = state.cookies || []; const idx = existing.findIndex(e => e.name === validated.name && e.domain === validated.domain && (e.path || '/') === validated.path); if (idx >= 0) existing[idx] = validated; else existing.push(validated); state.cookies = existing; fs.writeFileSync(statePath, JSON.stringify(state, null, 2)); return { success: true }; } catch (error) { return { success: false, error: error.message }; } }

async function getStorageStateInternal(profileId) { try { if (runningProfiles.has(profileId)) { const running = runningProfiles.get(profileId); if (running.context) { const state = await running.context.storageState(); return { success: true, state }; } } const statePath = storageStatePath(profileId); if (fs.existsSync(statePath)) { const state = JSON.parse(fs.readFileSync(statePath, 'utf8')); return { success: true, state }; } return { success: true, state: { cookies: [], origins: [] } }; } catch (error) { return { success: false, error: error.message }; } }

async function getProfileWsInternal(profileId) {
  try {
    const running = runningProfiles.get(profileId);
    if (!running) return { success: true, wsEndpoint: null, running: false };
    // Skip health check for recently-started profiles
    const age = running.startedAt ? (Date.now() - running.startedAt) : Infinity;
    if (age < 20000) return { success: true, wsEndpoint: running.wsEndpoint || 'pipe', running: true };

    if (running.context?.isClosed?.() || running.browser?.isConnected?.() === false) {
      runningProfiles.delete(profileId);
      setProfileStatus(profileId, 'STOPPED');
      appendLog(profileId, 'getProfileWs: Playwright browser disconnected');
      broadcastRunningMap();
      return { success: true, wsEndpoint: null, running: false };
    }
    return { success: true, wsEndpoint: running.wsEndpoint || 'pipe', running: true };
  } catch (error) { return { success: false, error: error.message }; }
}

async function getRunningMapInternal() {
  try {
    const GRACE_MS = 15000;
    const result = {};
    for (const [id, info] of runningProfiles.entries()) {
      // Always include recently-started profiles regardless of health check
      const age = info.startedAt ? (Date.now() - info.startedAt) : Infinity;
      if (age < GRACE_MS) { result[id] = info.wsEndpoint || 'pipe'; continue; }

      let alive = true;
      if (info.context?.isClosed?.() || info.browser?.isConnected?.() === false) alive = false;
      if (!alive) {
        runningProfiles.delete(id);
        setProfileStatus(id, 'STOPPED');
        appendLog(id, 'Bulk heartbeat: stale, clearing');
        broadcastRunningMap();
      } else {
        result[id] = info.wsEndpoint || 'pipe';
      }
    }
    const statuses = buildStatusMap();
    return { success: true, map: result, statuses };
  } catch (error) { return { success: false, error: error.message }; }
}

async function getLocalesTimezonesInternal() { try { const locales = ['en-US', 'en-GB', 'en-CA', 'en-AU', 'vi-VN', 'fr-FR', 'de-DE', 'es-ES', 'it-IT', 'pt-BR', 'pt-PT', 'ru-RU', 'ja-JP', 'ko-KR', 'zh-CN', 'zh-TW', 'th-TH', 'id-ID', 'ms-MY', 'hi-IN', 'tr-TR', 'nl-NL', 'pl-PL']; const timezones = ['UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Madrid', 'Europe/Rome', 'Europe/Amsterdam', 'Europe/Warsaw', 'Asia/Tokyo', 'Asia/Seoul', 'Asia/Shanghai', 'Asia/Taipei', 'Asia/Bangkok', 'Asia/Jakarta', 'Asia/Kuala_Lumpur', 'Asia/Ho_Chi_Minh', 'Asia/Singapore', 'Asia/Kolkata', 'Australia/Sydney']; return { success: true, locales, timezones }; } catch (error) { return { success: false, error: error.message }; } }

// Manual trigger of automation steps for a profile. If not running, launch it first.
async function runAutomationNowInternal(profileId) {
  try {
    const { readProfiles } = require('../storage/profiles');
    const profiles = readProfiles();
    const profile = profiles.find(p => p.id === profileId);
    if (!profile) return { success: false, error: 'Profile not found' };
    if (!profile.automation || !profile.automation.enabled) return { success: false, error: 'Automation not enabled for this profile' };
    // Ensure running; launch if needed
    if (!runningProfiles.has(profileId)) {
      const res = await launchProfileInternal(profileId, { engine: profile.settings?.engine, headless: profile.settings?.headless });
      if (!res.success) return res;
      // runAutomationPostLaunch already ran; return success
      return { success: true, launched: true };
    }
    // Connect to current session and execute steps
    const running = runningProfiles.get(profileId);
    const wsEndpoint = running.wsEndpoint;
    const steps = Array.isArray(profile.automation.steps) ? profile.automation.steps : [];
    appendLog(profileId, `Automation: manual run (${steps.length} steps)`);
    if (!steps.length) return { success: true, steps: 0 };
    const launchCtx = { engine: 'playwright', wsEndpoint, browser: running.browser, context: running.context };
    await runAutomationPostLaunch(profile, launchCtx);
    return { success: true, steps: steps.length };
  } catch (e) { return { success: false, error: e?.message || String(e) }; }
}

function getStatusMapInternal() {
  return { success: true, statuses: buildStatusMap() };
}

module.exports = {
  launchProfileInternal,
  stopProfileInternal,
  stopAllProfilesInternal,
  runAutomationNowInternal,
  listPagesInternal,
  navigateInternal,
  newPageInternal,
  closePageInternal,
  screenshotInternal,
  evalInternal,
  reloadPageInternal,
  goBackInternal,
  goForwardInternal,
  getPageInfoInternal,
  getPageContentInternal,
  clickElementInternal,
  doubleClickElementInternal,
  grantPermissionsInternal,
  clearPermissionsInternal,
  setExtraHTTPHeadersInternal,
  setGeolocationInternal,
  getProfileLogInternal,
  getCookiesInternal,
  importCookiesInternal,
  deleteCookieInternal,
  clearCookiesInternal,
  editCookieInternal,
  getStorageStateInternal,
  getProfileWsInternal,
  getRunningMapInternal,
  getStatusMapInternal,
  getLocalesTimezonesInternal,
};
