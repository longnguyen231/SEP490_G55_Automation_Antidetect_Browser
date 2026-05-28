// ════════════════════════════════════════════════════════════════════════════════
// actions.js — Tập hợp các hàm Tương tác Trình duyệt cấp cao thông qua Playwright API
// Mỗi action nhận `profileId` + object tham số riêng, và trả về:
//   { success: true, ...dữ liệu }   hoặc   { success: false, error: string }
// Toàn bộ tiến trình thực thi được ghi vào file log riêng của từng profile.
// ════════════════════════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');
const { runningProfiles } = require('../state/runtime');
const { appendLog } = require('../logging/logger');

// ────────────────────────────────────────────────────────────────────────────────
// HELPER UTILITIES — Chuẩn hóa kết quả trả về
// ────────────────────────────────────────────────────────────────────────────────

// Trả về object thành công, hợp nhất thêm các field tùy chọn vào `{ success: true }`
function ok(v = {}) { return { success: true, ...v }; }

// Trả về object lỗi với thông điệp dạng string, tránh để lỗi raw object lọt ra ngoài
function err(message, extra = {}) { return { success: false, error: String(message || 'unknown error'), ...extra }; }

// ────────────────────────────────────────────────────────────────────────────────
// withPage — Tiện ích lõi: Lấy đối tượng `Page` của Playwright cho profile đang chạy
//
// Tham số:
//   profileId — ID profile đang active trong runningProfiles map
//   index     — chỉ số tab (page) cần truy cập, mặc định là tab đầu tiên (0)
//   createIfMissing — nếu chưa có page nào, tự tạo mới thay vì báo lỗi
//
// Lý do dùng hàm này thay vì lấy page trực tiếp:
//   Vì tất cả action đều cần kiểm tra profile tồn tại + browser/context còn sống
//   trước khi thao tác. Tập trung logic kiểm tra ở đây giúp các action handler gọn hơn.
// ────────────────────────────────────────────────────────────────────────────────
async function withPage(profileId, { index = 0, createIfMissing = true } = {}) {
  const running = runningProfiles.get(profileId);
  if (!running) return err('Profile not running');
  const browser = running.browser; const context = running.context;
  // Kiểm tra browser/context còn sống không — context.isClosed() tránh thao tác trên browser đã đóng
  if (!browser || !context || context.isClosed?.()) return err('Browser context not available');
  // Lấy page theo chỉ số, fallback về page[0] nếu index vượt quá danh sách
  let page = context.pages()[index] || context.pages()[0];
  // Tự tạo tab mới nếu chưa có page nào (ví dụ: profile vừa khởi động xong)
  if (!page && createIfMissing) page = await context.newPage();
  if (!page) return err('No page available');
  // cleanup là hàm rỗng — thiết kế để mở rộng sau (ví dụ: giải phóng lock/resource nếu cần)
  return ok({ engine: 'playwright', browser, context, page, cleanup: async () => {} });
}

// ════════════════════════════════════════════════════════════════════════════════
// NHÓM 1: THAO TÁC CHUỘT (Mouse Actions)
// Các hàm di chuyển, click, kéo thả chuột ở tọa độ tuyệt đối hoặc theo phần trăm viewport
// ════════════════════════════════════════════════════════════════════════════════

// Di chuyển con trỏ chuột đến tọa độ (x, y) trên trang.
// `steps` kiểm soát số bước trung gian để mô phỏng di chuyển tự nhiên hơn (tránh bot detection).
async function mouseMove(profileId, { x, y, steps = 1 } = {}) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return err('x and y are required numbers');
  const { success, error, page, cleanup } = await withPage(profileId, {});
  if (!success) return err(error);
  try {
    await page.mouse.move(Number(x), Number(y), { steps });
    appendLog(profileId, `Action: mouseMove to (${x}, ${y}) steps=${steps}`);
    await cleanup();
    return ok();
  } catch (e) { await cleanup(); return err(e?.message || e); }
}

// Click chuột tại tọa độ tuyệt đối (x, y).
// Hỗ trợ: button (left/right/middle), clickCount (số lần click), delay (ms giữa mousedown và mouseup)
async function mouseClick(profileId, { x, y, button = 'left', clickCount = 1, delay = 0 } = {}) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return err('x and y are required numbers');
  const { success, error, page, cleanup } = await withPage(profileId, {});
  if (!success) return err(error);
  try {
    await page.mouse.click(Number(x), Number(y), { button, clickCount, delay });
    appendLog(profileId, `Action: mouseClick (${x}, ${y}) button=${button} count=${clickCount}`);
    await cleanup();
    return ok();
  } catch (e) { await cleanup(); return err(e?.message || e); }
}

// Double-click tại tọa độ tuyệt đối (x, y)
async function mouseDblclick(profileId, { x, y, button = 'left', delay = 0 } = {}) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return err('x and y are required numbers');
  const { success, error, page, cleanup } = await withPage(profileId, {});
  if (!success) return err(error);
  try {
    await page.mouse.dblclick(Number(x), Number(y), { button, delay });
    appendLog(profileId, `Action: mouseDblclick (${x}, ${y}) button=${button}`);
    await cleanup();
    return ok();
  } catch (e) { await cleanup(); return err(e?.message || e); }
}

// Nhấn giữ nút chuột xuống (không thả) — dùng kết hợp với mouseUp để kéo thả thủ công
async function mouseDown(profileId, { button = 'left', clickCount = 1 } = {}) {
  const { success, error, page, cleanup } = await withPage(profileId, {});
  if (!success) return err(error);
  try {
    await page.mouse.down({ button, clickCount });
    appendLog(profileId, `Action: mouseDown button=${button}`);
    await cleanup();
    return ok();
  } catch (e) { await cleanup(); return err(e?.message || e); }
}

// Thả nút chuột ra sau khi đã nhấn giữ
async function mouseUp(profileId, { button = 'left', clickCount = 1 } = {}) {
  const { success, error, page, cleanup } = await withPage(profileId, {});
  if (!success) return err(error);
  try {
    await page.mouse.up({ button, clickCount });
    appendLog(profileId, `Action: mouseUp button=${button}`);
    await cleanup();
    return ok();
  } catch (e) { await cleanup(); return err(e?.message || e); }
}

// Cuộn bánh xe chuột với độ lệch ngang (deltaX) và dọc (deltaY) tính bằng pixel
async function mouseWheel(profileId, { deltaX = 0, deltaY = 0 } = {}) {
  const { success, error, page, cleanup } = await withPage(profileId, {});
  if (!success) return err(error);
  try {
    await page.mouse.wheel(Number(deltaX), Number(deltaY));
    appendLog(profileId, `Action: mouseWheel deltaX=${deltaX} deltaY=${deltaY}`);
    await cleanup();
    return ok();
  } catch (e) { await cleanup(); return err(e?.message || e); }
}

// Di chuyển chuột tới (x,y) rồi click — kết hợp mouseMove + mouseClick
// Khác mouseClick ở chỗ luôn có bước di chuyển trước, giúp mô phỏng hành vi người dùng thực
async function clickAt(profileId, { x, y, button = 'left', clickCount = 1, delay } = {}) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return err('x and y are required numbers');
  const { success, error, page, cleanup } = await withPage(profileId, {});
  if (!success) return err(error);
  try {
    await page.mouse.move(x, y);
    await page.mouse.click(x, y, { button, clickCount, delay });
    appendLog(profileId, `Action: clickAt (${x}, ${y}) button=${button} count=${clickCount}`);
    await cleanup();
    return ok();
  } catch (e) { await cleanup(); return err(e?.message || e); }
}

// Click tại vị trí tương đối (theo phần trăm 0.0→1.0) so với viewport hoặc một element cụ thể.
// Ví dụ: xPercent=0.5, yPercent=0.5 là click vào chính giữa.
// Nếu có `selector`: tính toán tọa độ tương đối so với bounding box của element đó.
// Nếu không có `selector`: tính tương đối so với kích thước toàn bộ viewport.
async function clickByPercent(profileId, { xPercent, yPercent, selector, button = 'left', clickCount = 1, delay, timeout = 10000 } = {}) {
  const { success, error, page, cleanup } = await withPage(profileId, {});
  if (!success) return err(error);
  try {
    if (selector) {
      // Dùng page.locator().first() để lấy element đầu tiên khớp selector
      // Ưu tiên locator hơn page.$() vì locator hỗ trợ retry và waitFor tích hợp sẵn
      const el = page.locator(selector).first();
      await el.waitFor({ state: 'visible', timeout });
      const box = await el.boundingBox();
      if (!box) throw new Error('Element not visible');
      // Tính tọa độ tuyệt đối từ phần trăm trong phạm vi bounding box của element
      const cx = box.x + Math.max(0, Math.min(1, Number(xPercent || 0.5))) * box.width;
      const cy = box.y + Math.max(0, Math.min(1, Number(yPercent || 0.5))) * box.height;
      await page.mouse.move(cx, cy);
      await page.mouse.click(cx, cy, { button, clickCount, delay });
      appendLog(profileId, `Action: clickByPercent on ${selector} at ${xPercent || 0.5},${yPercent || 0.5}`);
    } else {
      // Không có selector: dùng kích thước viewport làm mốc tính toán
      const vp = page.viewportSize?.();
      if (!vp) throw new Error('Viewport size not available');
      const cx = Math.round(Math.max(0, Math.min(1, Number(xPercent || 0.5))) * (vp.width - 1));
      const cy = Math.round(Math.max(0, Math.min(1, Number(yPercent || 0.5))) * (vp.height - 1));
      await page.mouse.move(cx, cy);
      await page.mouse.click(cx, cy, { button, clickCount, delay });
      appendLog(profileId, `Action: clickByPercent viewport at ${xPercent || 0.5},${yPercent || 0.5}`);
    }
    await cleanup();
    return ok();
  } catch (e) { await cleanup(); return err(e?.message || e); }
}

// Click vào element tìm theo CSS/XPath selector.
// Dùng page.click() thay vì locator().click() vì page.click() tích hợp sẵn waitFor + retry.
async function clickOnElement(profileId, { selector, button = 'left', clickCount = 1, timeout = 10000, position } = {}) {
  if (!selector) return err('selector is required');
  const { success, error, page, cleanup } = await withPage(profileId, {});
  if (!success) return err(error);
  try {
    // `position` cho phép click lệch khỏi tâm element (ví dụ: { x: 5, y: 10 })
    await page.click(selector, { button, clickCount, timeout, position });
    appendLog(profileId, `Action: clickOnElement ${selector}`);
    await cleanup();
    return ok();
  } catch (e) { await cleanup(); return err(e?.message || e); }
}

// ════════════════════════════════════════════════════════════════════════════════
// NHÓM 2: CUỘN TRANG (Scroll Actions)
// Cuộn viewport hoặc element theo pixel, phần trăm, hoặc từ element này sang element khác
// ════════════════════════════════════════════════════════════════════════════════

// Cuộn đến vị trí tương đối (theo phần trăm 0.0→1.0) của tổng chiều dài/rộng có thể cuộn.
// Dùng page.evaluate() để gọi scrollTo() trực tiếp trong DOM — tránh dùng mouse.wheel
// vì wheel không cuộn được element con, chỉ cuộn window.
async function scrollByPercent(profileId, { xPercent = 0, yPercent = 0, selector } = {}) {
  const { success, error, page, cleanup } = await withPage(profileId, {});
  if (!success) return err(error);
  try {
    if (selector) {
      // Cuộn bên trong một element có scrollbar riêng (ví dụ: div overflow-y: auto)
      await page.evaluate(({ selector, xPercent, yPercent }) => {
        const el = document.querySelector(selector);
        if (!el) throw new Error('Element not found');
        const dx = Math.round((el.scrollWidth - el.clientWidth) * xPercent);
        const dy = Math.round((el.scrollHeight - el.clientHeight) * yPercent);
        el.scrollTo({ left: dx, top: dy, behavior: 'auto' });
      }, { selector, xPercent: clamp01(xPercent), yPercent: clamp01(yPercent) });
    } else {
      // Cuộn toàn bộ trang (window)
      await page.evaluate(({ xPercent, yPercent }) => {
        const dx = Math.round((document.documentElement.scrollWidth - window.innerWidth) * xPercent);
        const dy = Math.round((document.documentElement.scrollHeight - window.innerHeight) * yPercent);
        window.scrollTo({ left: dx, top: dy, behavior: 'auto' });
      }, { xPercent: clamp01(xPercent), yPercent: clamp01(yPercent) });
    }
    appendLog(profileId, `Action: scrollByPercent ${xPercent},${yPercent} ${selector ? 'in ' + selector : 'viewport'}`);
    await cleanup();
    return ok();
  } catch (e) { await cleanup(); return err(e?.message || e); }
}

// Cuộn từ điểm (x1,y1) đến điểm (x2,y2) bằng cách dùng mouse.wheel().
// Di chuyển chuột về điểm xuất phát trước để wheel xảy ra đúng vị trí trên trang.
// `steps` chia nhỏ delta thành nhiều lần wheel để cuộn mượt hơn (mô phỏng người dùng thực).
async function scrollFromTo(profileId, { x1, y1, x2, y2, steps = 2 }) {
  if (![x1, y1, x2, y2].every(Number.isFinite)) return err('x1,y1,x2,y2 are required numbers');
  const { success, error, page, cleanup } = await withPage(profileId, {});
  if (!success) return err(error);
  try {
    await page.mouse.move(x1, y1);
    // Wheel lần đầu bằng toàn bộ delta để bắt đầu cuộn
    await page.mouse.wheel(x2 - x1, y2 - y1);
    // Nếu steps > 1: chia nhỏ thành nhiều bước wheel nhỏ hơn để mượt hơn
    if (steps > 1) {
      const dx = (x2 - x1) / steps; const dy = (y2 - y1) / steps;
      for (let i = 0; i < steps - 1; i++) { // eslint-disable-line no-plusplus
        // eslint-disable-next-line no-await-in-loop
        await page.mouse.wheel(dx, dy);
      }
    }
    appendLog(profileId, `Action: scrollFromTo (${x1},${y1}) -> (${x2},${y2})`);
    await cleanup();
    return ok();
  } catch (e) { await cleanup(); return err(e?.message || e); }
}

// Cuộn trang để cả hai element (fromSelector và toSelector) đều xuất hiện trong viewport.
// Gọi scrollIntoView() trên cả hai trong cùng một page.evaluate() để tránh race condition.
// `block` và `inline` kiểm soát căn chỉnh: 'center', 'start', 'end', 'nearest'.
async function scrollElementToElement(profileId, { fromSelector, toSelector, behavior = 'auto', block = 'center', inline = 'nearest', timeout = 10000 } = {}) {
  if (!fromSelector || !toSelector) return err('fromSelector and toSelector are required');
  const { success, error, page, cleanup } = await withPage(profileId, {});
  if (!success) return err(error);
  try {
    // Chờ cả hai element có mặt trong DOM trước khi cuộn
    await page.waitForSelector(fromSelector, { state: 'attached', timeout });
    await page.waitForSelector(toSelector, { state: 'attached', timeout });
    await page.evaluate(({ fromSelector, toSelector, behavior, block, inline }) => {
      const from = document.querySelector(fromSelector);
      const to = document.querySelector(toSelector);
      if (!from || !to) throw new Error('Element(s) not found');
      from.scrollIntoView({ behavior, block, inline });
      to.scrollIntoView({ behavior, block, inline });
    }, { fromSelector, toSelector, behavior, block, inline });
    appendLog(profileId, `Action: scrollElementToElement ${fromSelector} -> ${toSelector}`);
    await cleanup();
    return ok();
  } catch (e) { await cleanup(); return err(e?.message || e); }
}

// ════════════════════════════════════════════════════════════════════════════════
// NHÓM 3: BÀN PHÍM (Keyboard Actions)
// Gõ văn bản, nhấn phím đơn, hoặc chuỗi phím tuần tự
// ════════════════════════════════════════════════════════════════════════════════

// Gửi input bàn phím đến trang hiện tại, hỗ trợ 3 chế độ:
//   - text: gõ từng ký tự như người dùng thực (có delay giữa các ký tự nếu cần)
//   - press: nhấn một phím hoặc tổ hợp phím (ví dụ: 'Enter', 'Control+A')
//   - sequence: mảng các phím, nhấn lần lượt theo thứ tự
async function sendKeyboard(profileId, { text, press, sequence, delay = 0 } = {}) {
  const { success, error, page, cleanup } = await withPage(profileId, {});
  if (!success) return err(error);
  try {
    // Chế độ 1: Gõ văn bản — page.keyboard.type() mô phỏng gõ từng ký tự
    if (typeof text === 'string' && text.length) {
      await page.keyboard.type(text, { delay });
      appendLog(profileId, `Action: keyboard type '${text.slice(0,50)}'`);
    }
    // Chế độ 2: Nhấn một phím/tổ hợp — press() xử lý cả modifier keys (Ctrl, Shift, Alt)
    if (typeof press === 'string' && press.length) {
      await page.keyboard.press(press);
      appendLog(profileId, `Action: keyboard press ${press}`);
    }
    // Chế độ 3: Chuỗi phím — nhấn tuần tự, await từng phím để đảm bảo thứ tự đúng
    if (Array.isArray(sequence) && sequence.length) {
      for (const key of sequence) { // eslint-disable-line no-restricted-syntax
        // eslint-disable-next-line no-await-in-loop
        await page.keyboard.press(String(key));
      }
      appendLog(profileId, `Action: keyboard sequence ${sequence.join(',')}`);
    }
    await cleanup();
    return ok();
  } catch (e) { await cleanup(); return err(e?.message || e); }
}

// ════════════════════════════════════════════════════════════════════════════════
// NHÓM 4: CHỤP MÀN HÌNH (Screenshot / Capture Actions)
// Chụp toàn trang hoặc một element cụ thể, trả về base64 hoặc lưu file
// ════════════════════════════════════════════════════════════════════════════════

// Chụp ảnh màn hình trang hiện tại.
// Nếu có `path`: lưu file PNG ra đĩa. Nếu không: trả về base64 string để frontend dùng trực tiếp.
// `fullPage = true` cuộn và chụp toàn bộ trang kể cả phần ngoài viewport.
async function captureScreen(profileId, { index = 0, path: outPath, fullPage = false } = {}) {
  const { success, error, page, cleanup } = await withPage(profileId, { index });
  if (!success) return err(error);
  try {
    // Tạo thư mục đích trước nếu chưa tồn tại (tránh lỗi ENOENT khi ghi file)
    if (outPath) { try { fs.mkdirSync(path.dirname(outPath), { recursive: true }); } catch {} }
    const result = await page.screenshot({ path: outPath, fullPage: !!fullPage, type: 'png' });
    await cleanup();
    // Trả về đường dẫn file nếu đã lưu, hoặc base64 nếu không có path
    return ok(outPath ? { path: outPath } : { base64: Buffer.from(result).toString('base64') });
  } catch (e) { await cleanup(); return err(e?.message || e); }
}

// Chụp ảnh một element cụ thể (crop theo bounding box của element đó).
// Dùng locator().first() để tìm element — locator tốt hơn page.$() vì hỗ trợ waitFor tích hợp.
async function captureElement(profileId, { selector, path: outPath, timeout = 10000 } = {}) {
  if (!selector) return err('selector is required');
  const { success, error, page, cleanup } = await withPage(profileId, {});
  if (!success) return err(error);
  try {
    const el = page.locator(selector).first();
    // Đợi element hiển thị trước khi chụp (state: 'visible' đảm bảo element trong viewport và không bị ẩn)
    await el.waitFor({ state: 'visible', timeout });
    if (outPath) { try { fs.mkdirSync(path.dirname(outPath), { recursive: true }); } catch {} }
    const result = await el.screenshot({ path: outPath, type: 'png' });
    await cleanup();
    return ok(outPath ? { path: outPath } : { base64: Buffer.from(result).toString('base64') });
  } catch (e) { await cleanup(); return err(e?.message || e); }
}

// ════════════════════════════════════════════════════════════════════════════════
// NHÓM 5: CHỜ ĐỢI (Wait Actions)
// Dừng thực thi trong một khoảng thời gian hoặc đến khi selector xuất hiện
// ════════════════════════════════════════════════════════════════════════════════

// Chờ theo 3 cách:
//   - ms: chờ một khoảng thời gian cố định (tối đa 10 phút để tránh treo vô hạn)
//   - selector: chờ đến khi element đạt trạng thái `state` (visible/hidden/attached/detached)
//   - không có gì: chờ mặc định 500ms (fallback tối thiểu)
async function waitAction(profileId, { ms, selector, state = 'visible', timeout } = {}) {
  const { success, error, page, cleanup } = await withPage(profileId, {});
  if (!success) return err(error);
  try {
    if (Number.isFinite(ms) && ms > 0) {
      // Giới hạn tối đa 10 phút để tránh script chạy vô hạn do lỗi config
      await page.waitForTimeout(Math.min(ms, 10 * 60 * 1000));
      appendLog(profileId, `Action: waited ${ms}ms`);
    } else if (selector) {
      await page.waitForSelector(selector, { state, timeout: Number.isFinite(timeout) ? timeout : 15000 });
      appendLog(profileId, `Action: waitFor ${selector} state=${state}`);
    } else {
      await page.waitForTimeout(500);
    }
    await cleanup();
    return ok();
  } catch (e) { await cleanup(); return err(e?.message || e); }
}

// ════════════════════════════════════════════════════════════════════════════════
// NHÓM 6: TƯƠNG TÁC ELEMENT NÂNG CAO (Element Interaction)
// Hover, kéo thả, điền form, chọn option
// ════════════════════════════════════════════════════════════════════════════════

// Di chuyển chuột đến vị trí element (hover) — thường dùng để kích hoạt tooltip hoặc dropdown
async function hoverOnElement(profileId, { selector, timeout = 10000 } = {}) {
  if (!selector) return err('selector is required');
  const { success, error, page, cleanup } = await withPage(profileId, {});
  if (!success) return err(error);
  try { await page.hover(selector, { timeout }); await cleanup(); appendLog(profileId, `Action: hover ${selector}`); return ok(); } catch (e) { await cleanup(); return err(e?.message || e); }
}

// Kéo element `from` và thả vào element `to` — dùng Playwright's dragAndDrop API
// Playwright tự tính bounding box của cả hai element nên không cần tọa độ thủ công
async function dragAndDrop(profileId, { from, to, steps = 10, timeout = 10000 } = {}) {
  if (!from || !to) return err('from and to selectors are required');
  const { success, error, page, cleanup } = await withPage(profileId, {});
  if (!success) return err(error);
  try { await page.dragAndDrop(from, to, { sourcePosition: undefined, targetPosition: undefined, force: false, timeout }); await cleanup(); appendLog(profileId, `Action: dragAndDrop ${from} -> ${to}`); return ok(); } catch (e) { await cleanup(); return err(e?.message || e); }
}

// Điền giá trị vào input/textarea bằng page.fill() — xóa nội dung cũ và gán giá trị mới ngay lập tức.
// Khác với typeInto (gõ từng ký tự), fill() không kích hoạt keyboard events — phù hợp điền nhanh.
async function fillInput(profileId, { selector, value, timeout = 10000 } = {}) {
  if (!selector) return err('selector is required');
  const { success, error, page, cleanup } = await withPage(profileId, {});
  if (!success) return err(error);
  try { await page.fill(selector, String(value ?? '')); await cleanup(); appendLog(profileId, `Action: fill ${selector}`); return ok(); } catch (e) { await cleanup(); return err(e?.message || e); }
}

// Chọn option trong thẻ <select> — `values` có thể là string, array, hoặc object { label/value/index }
async function selectOption(profileId, { selector, values, timeout = 10000 } = {}) {
  if (!selector) return err('selector is required');
  const { success, error, page, cleanup } = await withPage(profileId, {});
  if (!success) return err(error);
  try { await page.selectOption(selector, values); await cleanup(); appendLog(profileId, `Action: selectOption ${selector}`); return ok(); } catch (e) { await cleanup(); return err(e?.message || e); }
}

// ════════════════════════════════════════════════════════════════════════════════
// NHÓM 7: THÔNG TIN TRANG & ELEMENT (Page/Element Queries) — Proxy functions
// Các hàm truy vấn trạng thái, giá trị, thuộc tính của trang và element
// Được định nghĩa dạng một dòng (proxy) cho gọn vì logic đơn giản và lặp lại tương tự nhau
// ════════════════════════════════════════════════════════════════════════════════

// Lấy URL và tiêu đề (title) của trang hiện tại
async function getPageInfoProxy(profileId, { index = 0 } = {}) { const { success, error, page, cleanup } = await withPage(profileId, { index }); if (!success) return err(error); try { const url = page.url(); const title = await page.title(); await cleanup(); return ok({ url, title }); } catch (e) { await cleanup(); return err(e?.message || e); } }

// Double-click vào element theo selector — dùng page.dblclick() thay vì mouse.dblclick() để có waitFor tích hợp
async function doubleClickElementProxy(profileId, { selector, button = 'left', delay, timeout = 10000, position } = {}) { if (!selector) return err('selector is required'); const { success, error, page, cleanup } = await withPage(profileId, {}); if (!success) return err(error); try { await page.dblclick(selector, { button, delay, timeout, position }); appendLog(profileId, `Action: doubleClick on ${selector}`); await cleanup(); return ok(); } catch (e) { await cleanup(); return err(e?.message || e); } }

// Tap (chạm) vào element — dùng cho thiết bị cảm ứng hoặc mô phỏng mobile
async function tapElementProxy(profileId, { selector, timeout = 10000 } = {}) { if (!selector) return err('selector is required'); const { success, error, page, cleanup } = await withPage(profileId, {}); if (!success) return err(error); try { await page.tap(selector, { timeout }); appendLog(profileId, `Action: tap on ${selector}`); await cleanup(); return ok(); } catch (e) { await cleanup(); return err(e?.message || e); } }

// Gửi DOM event tùy chỉnh đến element — `type` là tên event (ví dụ: 'click', 'input', 'change')
// `eventInit` là object khởi tạo event (ví dụ: { bubbles: true, cancelable: true })
async function dispatchEventProxy(profileId, { selector, type, eventInit, timeout = 10000 } = {}) { if (!selector) return err('selector is required'); const { success, error, page, cleanup } = await withPage(profileId, {}); if (!success) return err(error); try { await page.dispatchEvent(selector, type, eventInit, { timeout }); appendLog(profileId, `Action: dispatchEvent ${type} on ${selector}`); await cleanup(); return ok(); } catch (e) { await cleanup(); return err(e?.message || e); } }

// Ghi đè toàn bộ HTML của trang — thường dùng để inject trang tùy chỉnh vào tab trống
async function setContentProxy(profileId, { html, timeout = 10000 } = {}) { const { success, error, page, cleanup } = await withPage(profileId, {}); if (!success) return err(error); try { await page.setContent(html || '', { timeout }); appendLog(profileId, `Action: setContent`); await cleanup(); return ok(); } catch (e) { await cleanup(); return err(e?.message || e); } }

// Chờ đến khi navigation (chuyển trang) hoàn thành — dùng sau click gây redirect
// `waitUntil` nhận: 'load', 'domcontentloaded', 'networkidle', 'commit'
async function waitForNavigationProxy(profileId, { url, waitUntil, timeout = 30000 } = {}) { const { success, error, page, cleanup } = await withPage(profileId, {}); if (!success) return err(error); try { await page.waitForNavigation({ url, waitUntil, timeout }); appendLog(profileId, `Action: waitForNavigation`); await cleanup(); return ok(); } catch (e) { await cleanup(); return err(e?.message || e); } }

// Lấy giá trị hiện tại của input/textarea/select theo selector
async function getInputValueProxy(profileId, { selector, timeout = 10000 } = {}) { if (!selector) return err('selector is required'); const { success, error, page, cleanup } = await withPage(profileId, {}); if (!success) return err(error); try { const value = await page.inputValue(selector, { timeout }); await cleanup(); return ok({ value }); } catch (e) { await cleanup(); return err(e?.message || e); } }

// Kiểm tra trạng thái hiển thị / ẩn / checked / enabled / disabled / editable của element
// Các hàm này không throw nếu element không tồn tại — trả về false thay vì lỗi
async function isVisibleProxy(profileId, { selector } = {}) { if (!selector) return err('selector is required'); const { success, error, page, cleanup } = await withPage(profileId, {}); if (!success) return err(error); try { const visible = await page.isVisible(selector); await cleanup(); return ok({ visible }); } catch (e) { await cleanup(); return err(e?.message || e); } }
async function isHiddenProxy(profileId, { selector } = {}) { if (!selector) return err('selector is required'); const { success, error, page, cleanup } = await withPage(profileId, {}); if (!success) return err(error); try { const hidden = await page.isHidden(selector); await cleanup(); return ok({ hidden }); } catch (e) { await cleanup(); return err(e?.message || e); } }
async function isCheckedProxy(profileId, { selector } = {}) { if (!selector) return err('selector is required'); const { success, error, page, cleanup } = await withPage(profileId, {}); if (!success) return err(error); try { const checked = await page.isChecked(selector); await cleanup(); return ok({ checked }); } catch (e) { await cleanup(); return err(e?.message || e); } }
async function isEnabledProxy(profileId, { selector } = {}) { if (!selector) return err('selector is required'); const { success, error, page, cleanup } = await withPage(profileId, {}); if (!success) return err(error); try { const enabled = await page.isEnabled(selector); await cleanup(); return ok({ enabled }); } catch (e) { await cleanup(); return err(e?.message || e); } }
async function isDisabledProxy(profileId, { selector } = {}) { if (!selector) return err('selector is required'); const { success, error, page, cleanup } = await withPage(profileId, {}); if (!success) return err(error); try { const disabled = await page.isDisabled(selector); await cleanup(); return ok({ disabled }); } catch (e) { await cleanup(); return err(e?.message || e); } }
async function isEditableProxy(profileId, { selector } = {}) { if (!selector) return err('selector is required'); const { success, error, page, cleanup } = await withPage(profileId, {}); if (!success) return err(error); try { const editable = await page.isEditable(selector); await cleanup(); return ok({ editable }); } catch (e) { await cleanup(); return err(e?.message || e); } }

// Lấy nội dung text (bao gồm text con) của element — khác innerText ở chỗ lấy raw text kể cả hidden
async function textContentProxy(profileId, { selector, timeout = 10000 } = {}) { if (!selector) return err('selector is required'); const { success, error, page, cleanup } = await withPage(profileId, {}); if (!success) return err(error); try { const text = await page.textContent(selector, { timeout }); await cleanup(); return ok({ text }); } catch (e) { await cleanup(); return err(e?.message || e); } }

// Thêm init script chạy trước mỗi lần trang load — inject vào context để áp dụng cho mọi page/frame
async function addInitScriptProxy(profileId, { script, path } = {}) { const { success, error, page, context, cleanup } = await withPage(profileId, {}); if (!success) return err(error); try { await context.addInitScript(script || { path }); await cleanup(); return ok(); } catch (e) { await cleanup(); return err(e?.message || e); } }

// Nhấn giữ / thả một phím đơn (dùng kết hợp để giữ phím modifier như Shift/Ctrl trong khi thao tác khác)
async function keyboardDownProxy(profileId, { key } = {}) { const { success, error, page, cleanup } = await withPage(profileId, {}); if (!success) return err(error); try { await page.keyboard.down(key); await cleanup(); return ok(); } catch (e) { await cleanup(); return err(e?.message || e); } }
async function keyboardUpProxy(profileId, { key } = {}) { const { success, error, page, cleanup } = await withPage(profileId, {}); if (!success) return err(error); try { await page.keyboard.up(key); await cleanup(); return ok(); } catch (e) { await cleanup(); return err(e?.message || e); } }

// Gõ văn bản từng ký tự (có delay giữa các ký tự) — giống người dùng gõ thật
async function keyboardTypeProxy(profileId, { text, delay } = {}) { const { success, error, page, cleanup } = await withPage(profileId, {}); if (!success) return err(error); try { await page.keyboard.type(text, { delay }); await cleanup(); return ok(); } catch (e) { await cleanup(); return err(e?.message || e); } }

// Insert text vào vị trí con trỏ hiện tại mà không kích hoạt keyboard events — nhanh hơn type()
async function keyboardInsertTextProxy(profileId, { text } = {}) { const { success, error, page, cleanup } = await withPage(profileId, {}); if (!success) return err(error); try { await page.keyboard.insertText(text); await cleanup(); return ok(); } catch (e) { await cleanup(); return err(e?.message || e); } }

// ════════════════════════════════════════════════════════════════════════════════
// NHÓM 8: THỰC THI SCRIPT NỘI TUYẾN (Inline Script Execution)
// Chạy đoạn code JavaScript tùy chỉnh qua scriptRuntime — dùng cho các logic phức tạp
// ════════════════════════════════════════════════════════════════════════════════

// Thực thi một đoạn script JS tùy chỉnh trong ngữ cảnh Playwright của profile.
// Delegate sang scriptRuntime.executeScript() — không chạy trực tiếp trong browser page
// mà chạy trong Node.js với quyền truy cập vào page, context, playwright API.
async function runInlineScriptProxy(profileId, { code, timeoutMs = 60000 } = {}) {
  // Bug #1 fix: Ethical linter check — endpoint này expose qua REST /actions/run-script
  // trước đây bỏ qua linter hoàn toàn
  const { checkEthical } = require('./scriptRunner');
  const lint = checkEthical(code || '');
  if (!lint.ok) {
    const { appendAuditLog } = require('../logging/auditLogger');
    appendAuditLog('VIOLATION_BLOCKED', `[rest/actions/run-script] ${lint.reason}`, profileId);
    return err(`EthicalViolationError: ${lint.reason}`);
  }
  // Require động để tránh circular dependency (scriptRuntime cũng import từ actions.js)
  const { executeScript } = require('./scriptRuntime');
  try {
    const res = await executeScript(profileId, code, { timeoutMs });
    return res;
  } catch(e) { return err(e?.message || e); }
}

// Nhấn một phím (hoặc tổ hợp phím) với tùy chọn focus vào selector trước khi nhấn.
// Khác sendKeyboard({ press }) ở chỗ có thể focus đúng element trước — tránh nhấn phím nhầm chỗ.
async function pressKeyAction(profileId, { key, selector, timeout = 10000 } = {}) {
  if (!key) return err('"key" is required');
  const { success, error, page, cleanup } = await withPage(profileId, {});
  if (!success) return err(error);
  try {
    // Focus vào element trước nếu có selector — đảm bảo keyboard event đến đúng element
    if (selector) await page.focus(selector, { timeout });
    await page.keyboard.press(key);
    appendLog(profileId, `Action: pressKey ${key}${selector ? ' on ' + selector : ''}`);
    await cleanup();
    return ok();
  } catch (e) { await cleanup(); return err(e?.message || e); }
}

// Cuộn trang hoặc cuộn element vào tầm nhìn.
// Nếu có selector: dùng locator().scrollIntoViewIfNeeded() — cuộn đúng nếu element chưa trong viewport
// Nếu không có selector: dùng window.scrollBy() với smooth behavior để cuộn cả trang
async function scrollPageAction(profileId, { x = 0, y = 0, selector, timeout = 10000 } = {}) {
  const { success, error, page, cleanup } = await withPage(profileId, {});
  if (!success) return err(error);
  try {
    if (selector) {
      const loc = page.locator(selector).first();
      // state: 'attached' — chỉ cần có trong DOM, không cần phải visible
      await loc.waitFor({ state: 'attached', timeout });
      // scrollIntoViewIfNeeded: chỉ cuộn nếu element chưa trong viewport (tối ưu hơn scrollIntoView)
      await loc.scrollIntoViewIfNeeded({ timeout });
      appendLog(profileId, `Action: scroll ${selector} into view`);
    } else {
      // Bug #2 fix: đổi scrollBy (tương đối) → scrollTo (tuyệt đối) để phát lại macro đúng vị trí đã ghi
      await page.evaluate(({ dx, dy }) => window.scrollTo({ left: dx, top: dy, behavior: 'smooth' }), { dx: Number(x), dy: Number(y) });
      appendLog(profileId, `Action: scrollPage to (${x}, ${y})`);
    }
    await cleanup();
    return ok();
  } catch (e) { await cleanup(); return err(e?.message || e); }
}

// ════════════════════════════════════════════════════════════════════════════════
// ACTION_MAP — Bộ điều phối trung tâm: ánh xạ tên action (string) → hàm thực thi
//
// Đây là registry duy nhất cho toàn bộ hệ thống action.
// Frontend (Workflow Builder) và Backend (scriptRuntime.js) đều gọi qua đây
// thay vì import trực tiếp từng hàm — giúp dễ mở rộng mà không cần sửa nhiều chỗ.
//
// Quy ước đặt tên key: <nhóm>.<hành_động> (ví dụ: 'mouse.click', 'storage.local.set')
// ════════════════════════════════════════════════════════════════════════════════
const ACTION_MAP = {

  // ── Thông tin trang & element ─────────────────────────────────────────────────
  'page.info': getPageInfoProxy,
  'element.dblclick': doubleClickElementProxy,
  'click.tap': tapElementProxy,
  'element.dispatchEvent': dispatchEventProxy,
  'page.setContent': setContentProxy,
  'wait.navigation': waitForNavigationProxy,
  'element.value': getInputValueProxy,
  'element.isVisible': isVisibleProxy,
  'element.isHidden': isHiddenProxy,
  'element.isChecked': isCheckedProxy,
  'element.isEnabled': isEnabledProxy,
  'element.isDisabled': isDisabledProxy,
  'element.isEditable': isEditableProxy,
  'element.textContent': textContentProxy,
  'page.addInitScript': addInitScriptProxy,

  // ── Bàn phím nâng cao ─────────────────────────────────────────────────────────
  'keyboard.down': keyboardDownProxy,
  'keyboard.up': keyboardUpProxy,
  'keyboard.type': keyboardTypeProxy,
  'keyboard.insertText': keyboardInsertTextProxy,

  // ── Script nội tuyến ──────────────────────────────────────────────────────────
  'script.runInline': runInlineScriptProxy,

  'keyboard.pressKey': pressKeyAction,
  'page.scroll': scrollPageAction,

  // ── Chuột ─────────────────────────────────────────────────────────────────────
  'mouse.move': mouseMove,
  'mouse.click': mouseClick,
  'mouse.dblclick': mouseDblclick,
  'mouse.down': mouseDown,
  'mouse.up': mouseUp,
  'mouse.wheel': mouseWheel,
  'click.at': clickAt,
  'click.percent': clickByPercent,
  'click.element': clickOnElement,

  // ── Cuộn trang ───────────────────────────────────────────────────────────────
  'scroll.percent': scrollByPercent,
  'scroll.fromTo': scrollFromTo,
  'scroll.elementToElement': scrollElementToElement,

  // ── Bàn phím ─────────────────────────────────────────────────────────────────
  'keyboard.send': sendKeyboard,

  // ── Chụp màn hình ────────────────────────────────────────────────────────────
  'capture.screen': captureScreen,
  'capture.element': captureElement,

  // ── Chờ đợi ──────────────────────────────────────────────────────────────────
  'wait': waitAction,

  // ── Tương tác element ────────────────────────────────────────────────────────
  'hover': hoverOnElement,
  'dragAndDrop': dragAndDrop,
  'input.fill': fillInput,
  'select.option': selectOption,

  // ── Điều hướng & vòng đời trang ──────────────────────────────────────────────
  'nav.goto': navigateTo,
  'nav.back': goBack,
  'nav.forward': goForward,
  'nav.reload': reloadPage,
  'wait.loadState': waitLoadState,
  'wait-for-url': waitForUrl,

  // ── Tiện ích element ─────────────────────────────────────────────────────────
  'element.focus': focusElement,
  'input.type': typeInto,
  'input.clear': clearInput,
  'input.check': checkElement,
  'input.uncheck': uncheckElement,
  'input.setFiles': setFiles,

  // ── Lưu trữ & Cookie ─────────────────────────────────────────────────────────
  'storage.local.set': storageLocalSet,
  'storage.local.get': storageLocalGet,
  'storage.local.remove': storageLocalRemove,
  'storage.local.clear': storageLocalClear,
  'storage.session.set': storageSessionSet,
  'storage.session.get': storageSessionGet,
  'storage.session.remove': storageSessionRemove,
  'storage.session.clear': storageSessionClear,
  'cookies.get': cookiesGet,
  'cookies.set': cookiesSet,
  'cookies.clear': cookiesClear,

  // ── Mạng & Môi trường ────────────────────────────────────────────────────────
  'network.setOffline': networkSetOffline,
  'geolocation.set': geolocationSet,
  'viewport.set': viewportSet,
  'headers.setExtra': headersSetExtra,

  // ── Quản lý Tab ──────────────────────────────────────────────────────────────
  'tab.new': tabNew,
  'tab.close': tabClose,
  'page.front': bringToFront,

  // ── JavaScript & Nội dung trang ──────────────────────────────────────────────
  'js.eval': evaluateJS,
  'element.eval': elementEval,
  'page.content': getPageContent,
  'page.title': getPageTitle,
  'page.url': getPageUrl,
  'element.text': elementGetText,
  'element.html': elementGetHtml,
  'element.attr': elementGetAttr,

  // ── Inject & Xuất file ───────────────────────────────────────────────────────
  'page.script.add': addScriptTag,
  'page.style.add': addStyleTag,
  'page.pdf': exportPdf,
};

// ════════════════════════════════════════════════════════════════════════════════
// performAction — Hàm điều phối chính (Public API duy nhất cần gọi từ bên ngoài)
//
// Nhận tên action dạng string, tra cứu hàm tương ứng trong ACTION_MAP, rồi thực thi.
// Thiết kế này cho phép Workflow Builder và scriptRuntime gọi bất kỳ action nào
// mà không cần biết cụ thể hàm nào đứng sau — chỉ cần biết tên action.
//
// Lỗi từ hàm handler được bắt ở đây làm lớp bảo vệ cuối cùng — không để lỗi throw ra ngoài.
// ════════════════════════════════════════════════════════════════════════════════
async function performAction(profileId, action, params = {}) {
  const fn = ACTION_MAP[action];
  // Trả về lỗi rõ ràng nếu action không tồn tại — giúp debug dễ hơn là silent fail
  if (!fn) return err(`Unknown action '${action}'`);
  try { return await fn(profileId, params || {}); } catch (e) { return err(e?.message || e); }
}

// Clamp giá trị về đoạn [0, 1] — dùng cho tọa độ phần trăm tránh vượt ngoài viewport
function clamp01(v) { const n = Number(v); if (!Number.isFinite(n)) return 0; return Math.max(0, Math.min(1, n)); }

// Trả về danh sách tất cả tên action được hỗ trợ — dùng để validate hoặc hiển thị trong UI
function getActionNames() { return Object.keys(ACTION_MAP); }

// ════════════════════════════════════════════════════════════════════════════════
// NHÓM 9: ĐIỀU HƯỚNG TRANG (Navigation Actions)
// goto, back, forward, reload, waitForURL, waitLoadState
// ════════════════════════════════════════════════════════════════════════════════

// Điều hướng đến URL chỉ định, có thể mở trong tab hiện tại hoặc tab mới.
// `waitUntil` kiểm soát khi nào coi là navigation xong:
//   'load' — đợi window load event, 'domcontentloaded' — đợi DOM parse xong,
//   'networkidle' — đợi không còn request mạng trong 500ms
async function navigateTo(profileId, { url, waitUntil = 'load', timeout, index = 0, newPage = false } = {}) {
  if (!url) return err('url is required');
  const { success, error, page, context, cleanup } = await withPage(profileId, { index, createIfMissing: true });
  if (!success) return err(error);
  try {
    let target = page;
    // Mở tab mới nếu cần — không đóng tab cũ, chỉ tạo thêm
    if (newPage) target = await context.newPage();
    const gotoOpts = { waitUntil };
    // Chỉ thêm timeout vào options khi được cung cấp — tránh override default timeout của Playwright
    if (typeof timeout === 'number') gotoOpts.timeout = timeout;
    await target.goto(url, gotoOpts);
    appendLog(profileId, `Action: goto ${url}`);
    // Lấy title sau navigation để trả về cho caller (tiện kiểm tra đã đến đúng trang)
    const title = await target.title().catch(() => '');
    const currentUrl = target.url();
    await cleanup();
    return ok({ url: currentUrl, title });
  } catch (e) { await cleanup(); return err(e?.message || e); }
}

// Quay lại trang trước (goBack), tiến đến trang sau (goForward), hoặc tải lại (reload)
// Tất cả đều dùng hàm navHistory() chung để tránh code lặp lại
async function goBack(profileId, { waitUntil = 'load', timeout, index = 0 } = {}) { return await navHistory(profileId, 'back', { waitUntil, timeout, index }); }
async function goForward(profileId, { waitUntil = 'load', timeout, index = 0 } = {}) { return await navHistory(profileId, 'forward', { waitUntil, timeout, index }); }
async function reloadPage(profileId, { waitUntil = 'load', timeout, index = 0 } = {}) { return await navHistory(profileId, 'reload', { waitUntil, timeout, index }); }

// Hàm nội bộ xử lý các thao tác lịch sử điều hướng (back/forward/reload)
// Trả về { url, title } sau khi navigation hoàn thành để caller có thể xác nhận trạng thái
async function navHistory(profileId, kind, { waitUntil = 'load', timeout, index = 0 } = {}) {
  const { success, error, page, cleanup } = await withPage(profileId, { index });
  if (!success) return err(error);
  try {
    const opts = { waitUntil };
    if (typeof timeout === 'number') opts.timeout = timeout;
    if (kind === 'back') await page.goBack(opts);
    else if (kind === 'forward') await page.goForward(opts);
    else if (kind === 'reload') await page.reload(opts);
    const title = await page.title().catch(() => '');
    const currentUrl = page.url();
    appendLog(profileId, `Action: nav ${kind}`);
    await cleanup();
    return ok({ url: currentUrl, title });
  } catch (e) { await cleanup(); return err(e?.message || e); }
}

// Chờ đến khi trang đạt trạng thái load nhất định.
// `state` nhận: 'load', 'domcontentloaded', 'networkidle'
async function waitLoadState(profileId, { state = 'load', index = 0, timeout = 30000 } = {}) {
  const { success, error, page, cleanup } = await withPage(profileId, { index });
  if (!success) return err(error);
  try { await page.waitForLoadState(state, { timeout }); await cleanup(); return ok(); } catch (e) { await cleanup(); return err(e?.message || e); }
}

// Chờ đến khi URL của trang khớp với pattern chỉ định (string, regex, hoặc glob)
async function waitForUrl(profileId, { url, index = 0, timeout = 30000, waitUntil = 'load' } = {}) {
  if (!url) return err('url is required');
  const { success, error, page, cleanup } = await withPage(profileId, { index });
  if (!success) return err(error);
  try {
    await page.waitForURL(url, { timeout, waitUntil });
    appendLog(profileId, `Action: waitForUrl ${url}`);
    await cleanup();
    return ok({ url: page.url() });
  } catch (e) { await cleanup(); return err(e?.message || e); }
}

// ════════════════════════════════════════════════════════════════════════════════
// NHÓM 10: TIỆN ÍCH ELEMENT (Element Utilities)
// Focus, gõ phím, xóa input, check/uncheck checkbox, upload file
// ════════════════════════════════════════════════════════════════════════════════

// Đặt focus keyboard vào element — cần thiết trước khi gõ phím nếu element chưa được focus
async function focusElement(profileId, { selector, timeout = 10000 } = {}) {
  if (!selector) return err('selector is required');
  const { success, error, page, cleanup } = await withPage(profileId, {});
  if (!success) return err(error);
  try { await page.focus(selector, { timeout }); await cleanup(); appendLog(profileId, `Action: focus ${selector}`); return ok(); } catch (e) { await cleanup(); return err(e?.message || e); }
}

// Gõ text vào element từng ký tự (mô phỏng bàn phím thật) — khác fillInput ở chỗ kích hoạt keyboard events.
// Dùng khi trang cần nhận keyboard events để xử lý (ví dụ: autocomplete, real-time validation)
async function typeInto(profileId, { selector, text, delay = 0, timeout = 10000 } = {}) {
  if (!selector) return err('selector is required');
  const { success, error, page, cleanup } = await withPage(profileId, {});
  if (!success) return err(error);
  try { await page.type(selector, String(text ?? ''), { delay, timeout }); await cleanup(); appendLog(profileId, `Action: type into ${selector}`); return ok(); } catch (e) { await cleanup(); return err(e?.message || e); }
}

// Xóa toàn bộ nội dung input — thực chất là fill với chuỗi rỗng
async function clearInput(profileId, { selector, timeout = 10000 } = {}) {
  if (!selector) return err('selector is required');
  const { success, error, page, cleanup } = await withPage(profileId, {});
  if (!success) return err(error);
  try { await page.fill(selector, ''); await cleanup(); appendLog(profileId, `Action: clear ${selector}`); return ok(); } catch (e) { await cleanup(); return err(e?.message || e); }
}

// Đánh dấu checkbox/radio button — page.check() tự xử lý việc click nếu chưa được check
async function checkElement(profileId, { selector, timeout = 10000 } = {}) {
  if (!selector) return err('selector is required');
  const { success, error, page, cleanup } = await withPage(profileId, {});
  if (!success) return err(error);
  try { await page.check(selector, { timeout }); await cleanup(); appendLog(profileId, `Action: check ${selector}`); return ok(); } catch (e) { await cleanup(); return err(e?.message || e); }
}

// Bỏ đánh dấu checkbox — page.uncheck() chỉ click nếu đang ở trạng thái checked
async function uncheckElement(profileId, { selector, timeout = 10000 } = {}) {
  if (!selector) return err('selector is required');
  const { success, error, page, cleanup } = await withPage(profileId, {});
  if (!success) return err(error);
  try { await page.uncheck(selector, { timeout }); await cleanup(); appendLog(profileId, `Action: uncheck ${selector}`); return ok(); } catch (e) { await cleanup(); return err(e?.message || e); }
}

// Upload file(s) vào input[type=file] — `files` là string path hoặc mảng string paths
async function setFiles(profileId, { selector, files, timeout = 10000 } = {}) {
  if (!selector) return err('selector is required');
  if (!files || (Array.isArray(files) && !files.length)) return err('files is required');
  const { success, error, page, cleanup } = await withPage(profileId, {});
  if (!success) return err(error);
  try { await page.setInputFiles(selector, files); await cleanup(); appendLog(profileId, `Action: setFiles ${selector}`); return ok(); } catch (e) { await cleanup(); return err(e?.message || e); }
}

// ════════════════════════════════════════════════════════════════════════════════
// NHÓM 11: LƯU TRỮ TRÌNH DUYỆT (Browser Storage Actions)
// Đọc/ghi/xóa localStorage và sessionStorage trong browser context
// ════════════════════════════════════════════════════════════════════════════════

// Các hàm wrapper gọn cho storageEval() — phân biệt localStorage vs sessionStorage
// và các operation: set (ghi), get (đọc), remove (xóa key), clear (xóa toàn bộ)
async function storageLocalSet(profileId, { items = {} } = {}) { return await storageEval(profileId, 'localStorage', 'set', items); }
async function storageLocalGet(profileId, { keys } = {}) { return await storageEval(profileId, 'localStorage', 'get', keys); }
async function storageLocalRemove(profileId, { keys } = {}) { return await storageEval(profileId, 'localStorage', 'remove', keys); }
async function storageLocalClear(profileId) { return await storageEval(profileId, 'localStorage', 'clear'); }
async function storageSessionSet(profileId, { items = {} } = {}) { return await storageEval(profileId, 'sessionStorage', 'set', items); }
async function storageSessionGet(profileId, { keys } = {}) { return await storageEval(profileId, 'sessionStorage', 'get', keys); }
async function storageSessionRemove(profileId, { keys } = {}) { return await storageEval(profileId, 'sessionStorage', 'remove', keys); }
async function storageSessionClear(profileId) { return await storageEval(profileId, 'sessionStorage', 'clear'); }

// Hàm lõi thực hiện thao tác storage bằng cách inject code vào browser qua page.evaluate().
// Lý do dùng page.evaluate() thay vì CDP: cross-browser compatible (Firefox/Camoufox cũng chạy được).
// Tham số `which`: 'localStorage' hoặc 'sessionStorage'
// Tham số `op`: 'set' | 'get' | 'remove' | 'clear'
// Tham số `payload`: object (cho set), array/string key (cho get/remove)
async function storageEval(profileId, which, op, payload) {
  const { success, error, page, cleanup } = await withPage(profileId, {});
  if (!success) return err(error);
  try {
    const result = await page.evaluate(({ which, op, payload }) => {
      const store = which === 'sessionStorage' ? window.sessionStorage : window.localStorage;
      switch (op) {
        case 'set':
          // Tự động JSON.stringify nếu value không phải string — hỗ trợ lưu object/array
          Object.entries(payload || {}).forEach(([k, v]) => store.setItem(String(k), typeof v === 'string' ? v : JSON.stringify(v)));
          return true;
        case 'get':
          // Không có keys: trả về toàn bộ storage dưới dạng object
          if (!payload) return Object.fromEntries(Object.entries(store).map(([k, v]) => [k, v]));
          const keys = Array.isArray(payload) ? payload : [payload];
          const out = {};
          keys.forEach(k => { const v = store.getItem(String(k)); if (v != null) out[k] = v; });
          return out;
        case 'remove':
          (Array.isArray(payload) ? payload : [payload]).forEach(k => store.removeItem(String(k)));
          return true;
        case 'clear':
          store.clear(); return true;
        default:
          return false;
      }
    }, { which, op, payload });
    await cleanup();
    return ok({ result });
  } catch (e) { await cleanup(); return err(e?.message || e); }
}

// ════════════════════════════════════════════════════════════════════════════════
// NHÓM 12: COOKIE (Cookie Management)
// Đọc, ghi, xóa cookie qua Playwright BrowserContext API (không qua JS để tránh HttpOnly bị chặn)
// ════════════════════════════════════════════════════════════════════════════════

// Lấy danh sách cookie — `urls` lọc cookie theo domain/URL, bỏ qua để lấy tất cả
// Dùng context.cookies() thay vì document.cookie vì context API lấy được cả HttpOnly cookie
async function cookiesGet(profileId, { urls } = {}) {
  const { success, error, context, cleanup } = await withPage(profileId, {});
  if (!success) return err(error);
  try { const cookies = await context.cookies(urls); await cleanup(); return ok({ cookies }); } catch (e) { await cleanup(); return err(e?.message || e); }
}

// Thêm/ghi đè cookie — `cookies` là mảng object với các field: name, value, domain, path, expires, httpOnly, secure, sameSite
async function cookiesSet(profileId, { cookies = [] } = {}) {
  const { success, error, context, cleanup } = await withPage(profileId, {});
  if (!success) return err(error);
  try { await context.addCookies(cookies); await cleanup(); return ok(); } catch (e) { await cleanup(); return err(e?.message || e); }
}

// Xóa toàn bộ cookie trong browser context của profile — dùng khi cần reset session
async function cookiesClear(profileId) {
  const { success, error, context, cleanup } = await withPage(profileId, {});
  if (!success) return err(error);
  try {
    await context.clearCookies();
    await cleanup();
    return ok();
  } catch (e) { await cleanup(); return err(e?.message || e); }
}

// ════════════════════════════════════════════════════════════════════════════════
// NHÓM 13: MẠNG & MÔI TRƯỜNG (Network & Environment Actions)
// Giả lập offline, set vị trí địa lý, thay đổi viewport, inject HTTP headers
// ════════════════════════════════════════════════════════════════════════════════

// Bật/tắt chế độ offline cho toàn bộ context — khi offline mọi network request đều thất bại
async function networkSetOffline(profileId, { offline = true } = {}) {
  const { success, error, context, cleanup } = await withPage(profileId, {});
  if (!success) return err(error);
  try { await context.setOffline(!!offline); await cleanup(); appendLog(profileId, `Action: offline=${!!offline}`); return ok(); } catch (e) { await cleanup(); return err(e?.message || e); }
}

// Giả lập vị trí địa lý GPS — cần browser được cấp quyền 'geolocation' khi tạo context
// `accuracy` là sai số tính bằng mét — ảnh hưởng đến độ tin cậy của tọa độ
async function geolocationSet(profileId, { latitude, longitude, accuracy = 100 } = {}) {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return err('latitude and longitude are required numbers');
  const { success, error, context, cleanup } = await withPage(profileId, {});
  if (!success) return err(error);
  try { await context.setGeolocation({ latitude: Number(latitude), longitude: Number(longitude), accuracy: Number(accuracy) }); await cleanup(); return ok(); } catch (e) { await cleanup(); return err(e?.message || e); }
}

// Thay đổi kích thước viewport và Device Pixel Ratio (DPR) của tất cả tab trong context.
// Dùng CDP session để override DPR — chỉ hoạt động trên Chromium, Firefox/Camoufox bỏ qua.
async function viewportSet(profileId, { width, height, deviceScaleFactor } = {}) {
  if (!Number.isFinite(width) || !Number.isFinite(height)) return err('width and height are required numbers');
  const { success, error, context, cleanup } = await withPage(profileId, {});
  if (!success) return err(error);
  try {
    const w = Math.max(1, Math.floor(width));
    const h = Math.max(1, Math.floor(height));
    const pages = context.pages();
    // Áp dụng viewport mới cho tất cả tab đang mở trong context
    for (const p of pages) { // eslint-disable-line no-restricted-syntax
      // eslint-disable-next-line no-await-in-loop
      await p.setViewportSize({ width: w, height: h });
      if (Number.isFinite(deviceScaleFactor) && deviceScaleFactor > 0) {
        try {
          // DPR override via CDP — chromium-only; silently no-ops on firefox/camoufox
          // eslint-disable-next-line no-await-in-loop
          const session = await context.newCDPSession(p);
          // eslint-disable-next-line no-await-in-loop
          await session.send('Emulation.setDeviceMetricsOverride', {
            width: w,
            height: h,
            deviceScaleFactor: Number(deviceScaleFactor),
            mobile: false,
            screenWidth: w,
            screenHeight: h,
          });
        } catch { /* bỏ qua lỗi CDP trên non-Chromium browser */ }
      }
    }
    await cleanup();
    return ok();
  } catch (e) { await cleanup(); return err(e?.message || e); }
}

// Thêm HTTP headers vào mọi request từ context — dùng để inject token, User-Agent tùy chỉnh, v.v.
// Headers này được merge với headers có sẵn, không thay thế hoàn toàn
async function headersSetExtra(profileId, { headers = {} } = {}) {
  const { success, error, context, cleanup } = await withPage(profileId, {});
  if (!success) return err(error);
  try { await context.setExtraHTTPHeaders(headers); await cleanup(); return ok(); } catch (e) { await cleanup(); return err(e?.message || e); }
}

// ════════════════════════════════════════════════════════════════════════════════
// NHÓM 14: QUẢN LÝ TAB (Tab Management)
// Mở tab mới, đóng tab, đưa tab ra foreground
// ════════════════════════════════════════════════════════════════════════════════

// Mở tab mới trong context hiện tại, tùy chọn điều hướng đến URL ngay lập tức.
// Trả về `index` của tab mới trong danh sách context.pages() để caller có thể tham chiếu sau
async function tabNew(profileId, { url, waitUntil = 'domcontentloaded' } = {}) {
  const { success, error, context, cleanup } = await withPage(profileId, {});
  if (!success) return err(error);
  try { const page = await context.newPage(); if (url) await page.goto(url, { waitUntil }); const index = context.pages().indexOf(page); await cleanup(); return ok({ index, url: page.url() }); } catch (e) { await cleanup(); return err(e?.message || e); }
}

// Đóng tab theo index — `runBeforeUnload: true` cho phép trang chạy beforeunload event (xác nhận đóng)
async function tabClose(profileId, { index = 0 } = {}) {
  const { success, error, context, cleanup } = await withPage(profileId, {});
  if (!success) return err(error);
  try { const pages = context.pages(); const page = pages[index]; if (!page) { await cleanup(); return err('Invalid page index'); } await page.close({ runBeforeUnload: true }); await cleanup(); return ok(); } catch (e) { await cleanup(); return err(e?.message || e); }
}

// Đưa tab chỉ định lên foreground (focus) — hữu ích khi đang thao tác nhiều tab song song
async function bringToFront(profileId, { index = 0 } = {}) {
  const { success, error, context, cleanup } = await withPage(profileId, {});
  if (!success) return err(error);
  try { const page = context.pages()[index] || context.pages()[0]; if (!page) { await cleanup(); return err('No page available'); } await page.bringToFront(); await cleanup(); return ok(); } catch (e) { await cleanup(); return err(e?.message || e); }
}

// ════════════════════════════════════════════════════════════════════════════════
// NHÓM 15: JAVASCRIPT & NỘI DUNG TRANG (JS Evaluation & Page Content)
// Chạy JS trong browser, lấy HTML/text/attribute của trang và element
// ════════════════════════════════════════════════════════════════════════════════

// Thực thi biểu thức JavaScript trong context của browser page và trả về kết quả.
// Dùng eval() bên trong page.evaluate() để chạy code động — cẩn thận injection nếu `expression` từ user input.
// `arg` là tham số truyền vào expression (serializable) — tránh dùng closure từ Node.js vì không serialize được
async function evaluateJS(profileId, { expression, arg, returnByValue = true, index = 0 } = {}) {
  if (typeof expression !== 'string') return err('expression must be a string');
  const { success, error, page, cleanup } = await withPage(profileId, { index });
  if (!success) return err(error);
  try {
    const result = await page.evaluate((expr, arg) => {
      try { return { ok: true, value: eval(expr) }; }
      // Bọc lỗi eval thành object để trả về Node.js thay vì throw — tránh unhandled promise rejection
      catch (e) { return { ok: false, error: e?.message || String(e) }; }
    }, expression, arg);
    await cleanup();
    if (!result?.ok) return err(result?.error || 'eval failed');
    return ok({ value: result.value });
  } catch (e) { await cleanup(); return err(e?.message || e); }
}

// Chạy JavaScript trong ngữ cảnh của một element cụ thể (`el` là element được truyền vào eval).
// Dùng locator().evaluate() thay vì page.evaluate() để có reference đến DOM element trực tiếp.
// state: 'attached' — chỉ cần element tồn tại trong DOM, không cần visible (phù hợp cho element ẩn)
async function elementEval(profileId, { selector, expression, index = 0, timeout = 10000 } = {}) {
  if (!selector) return err('selector is required');
  if (typeof expression !== 'string') return err('expression must be a string');
  const { success, error, page, cleanup } = await withPage(profileId, { index });
  if (!success) return err(error);
  try {
    const loc = page.locator(selector).first();
    await loc.waitFor({ state: 'attached', timeout });
    const result = await loc.evaluate((el, expr) => {
      try { return { ok: true, value: eval(expr) }; }
      catch (e) { return { ok: false, error: e?.message || String(e) }; }
    }, expression);
    await cleanup();
    if (!result?.ok) return err(result?.error || 'element eval failed');
    return ok({ value: result.value });
  } catch (e) { await cleanup(); return err(e?.message || e); }
}

// Lấy toàn bộ HTML source của trang (outerHTML của <html>)
async function getPageContent(profileId, { index = 0 } = {}) { const { success, error, page, cleanup } = await withPage(profileId, { index }); if (!success) return err(error); try { const html = await page.content(); await cleanup(); return ok({ html }); } catch (e) { await cleanup(); return err(e?.message || e); } }

// Lấy tiêu đề trang (thẻ <title>)
async function getPageTitle(profileId, { index = 0 } = {}) { const { success, error, page, cleanup } = await withPage(profileId, { index }); if (!success) return err(error); try { const title = await page.title(); await cleanup(); return ok({ title }); } catch (e) { await cleanup(); return err(e?.message || e); } }

// Lấy URL hiện tại của trang (đồng bộ — không cần await vì page.url() không phải async)
async function getPageUrl(profileId, { index = 0 } = {}) { const { success, error, page, cleanup } = await withPage(profileId, { index }); if (!success) return err(error); try { const url = page.url(); await cleanup(); return ok({ url }); } catch (e) { await cleanup(); return err(e?.message || e); } }

// Lấy text hiển thị của element (innerText — chỉ text visible, loại bỏ hidden elements)
// Dùng locator().first() để tránh lỗi khi có nhiều element khớp selector
async function elementGetText(profileId, { selector, index = 0, timeout = 10000 } = {}) { if (!selector) return err('selector is required'); const { success, error, page, cleanup } = await withPage(profileId, { index }); if (!success) return err(error); try { const loc = page.locator(selector).first(); await loc.waitFor({ state: 'visible', timeout }); const text = await loc.innerText(); await cleanup(); return ok({ text }); } catch (e) { await cleanup(); return err(e?.message || e); } }

// Lấy HTML bên trong element (innerHTML — không bao gồm outer tag của chính element đó)
// state: 'attached' vì không cần element visible để lấy HTML
async function elementGetHtml(profileId, { selector, index = 0, timeout = 10000 } = {}) { if (!selector) return err('selector is required'); const { success, error, page, cleanup } = await withPage(profileId, { index }); if (!success) return err(error); try { const loc = page.locator(selector).first(); await loc.waitFor({ state: 'attached', timeout }); const html = await loc.innerHTML(); await cleanup(); return ok({ html }); } catch (e) { await cleanup(); return err(e?.message || e); } }

// Lấy giá trị một attribute của element theo tên — trả về null nếu attribute không tồn tại
async function elementGetAttr(profileId, { selector, name, index = 0, timeout = 10000 } = {}) { if (!selector) return err('selector is required'); if (!name) return err('name is required'); const { success, error, page, cleanup } = await withPage(profileId, { index }); if (!success) return err(error); try { const loc = page.locator(selector).first(); await loc.waitFor({ state: 'attached', timeout }); const value = await loc.getAttribute(name); await cleanup(); return ok({ value }); } catch (e) { await cleanup(); return err(e?.message || e); } }

// ════════════════════════════════════════════════════════════════════════════════
// NHÓM 16: INJECT & XUẤT FILE (Script/Style Injection & PDF Export)
// Thêm thẻ <script>/<link> vào trang, xuất PDF
// ════════════════════════════════════════════════════════════════════════════════

// Inject thẻ <script> vào trang — có thể từ URL, file path trên disk, hoặc inline content
// `type` cho phép set script type (ví dụ: 'module' để dùng ES modules)
async function addScriptTag(profileId, { url, path: filePath, content, type, index = 0 } = {}) {
  const { success, error, page, cleanup } = await withPage(profileId, { index });
  if (!success) return err(error);
  try { await page.addScriptTag({ url, path: filePath, content, type }); await cleanup(); return ok(); } catch (e) { await cleanup(); return err(e?.message || e); }
}

// Inject thẻ <link rel="stylesheet"> hoặc <style> vào trang — từ URL, file, hoặc inline CSS
async function addStyleTag(profileId, { url, path: filePath, content, index = 0 } = {}) {
  const { success, error, page, cleanup } = await withPage(profileId, { index });
  if (!success) return err(error);
  try { await page.addStyleTag({ url, path: filePath, content }); await cleanup(); return ok(); } catch (e) { await cleanup(); return err(e?.message || e); }
}

// Xuất trang ra file PDF — chỉ hoạt động trên Chromium (Playwright limitation).
// `format`: kích thước giấy ('A4', 'Letter', ...), `printBackground`: in màu nền,
// `landscape`: in ngang, `scale`: tỷ lệ thu phóng, `margin`: lề trang
async function exportPdf(profileId, { path: outPath, format = 'A4', printBackground = true, landscape = false, scale = 1, margin } = {}) {
  const { success, error, page, cleanup } = await withPage(profileId, {});
  if (!success) return err(error);
  try {
    if (!outPath) return err('path is required');
    // Tạo thư mục đích trước để tránh lỗi ghi file
    fs.mkdirSync(require('path').dirname(outPath), { recursive: true });
    await page.pdf({ path: outPath, format, printBackground, landscape, scale, margin });
    await cleanup();
    return ok({ path: outPath });
  } catch (e) { await cleanup(); return err(e?.message || e); }
}

// ════════════════════════════════════════════════════════════════════════════════
// EXPORTS — Xuất public API của module
// performAction() là entry point chính; các hàm còn lại export để test và import trực tiếp
// ════════════════════════════════════════════════════════════════════════════════
module.exports = {
  performAction,
  mouseMove,
  mouseClick,
  mouseDblclick,
  mouseDown,
  mouseUp,
  mouseWheel,
  clickAt,
  clickByPercent,
  clickOnElement,
  scrollByPercent,
  scrollFromTo,
  scrollElementToElement,
  sendKeyboard,
  captureScreen,
  captureElement,
  waitAction,
  hoverOnElement,
  dragAndDrop,
  fillInput,
  selectOption,
  navigateTo,
  goBack,
  goForward,
  reloadPage,
  waitLoadState,
  focusElement,
  typeInto,
  clearInput,
  checkElement,
  uncheckElement,
  setFiles,
  storageLocalSet,
  storageLocalGet,
  storageLocalRemove,
  storageLocalClear,
  storageSessionSet,
  storageSessionGet,
  storageSessionRemove,
  storageSessionClear,
  cookiesGet,
  cookiesSet,
  cookiesClear,
  networkSetOffline,
  geolocationSet,
  viewportSet,
  headersSetExtra,
  tabNew,
  tabClose,
  bringToFront,
  evaluateJS,
  elementEval,
  getPageContent,
  getPageTitle,
  getPageUrl,
  elementGetText,
  elementGetHtml,
  elementGetAttr,
  addScriptTag,
  addStyleTag,
  exportPdf,
  getActionNames,
};
