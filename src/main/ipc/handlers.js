const { ipcMain, shell, BrowserWindow } = require('electron');
const { appendLog } = require('../logging/logger');
const {
  launchProfileInternal,
  stopProfileInternal,
  stopAllProfilesInternal,
  listPagesInternal,
  navigateInternal,
  newPageInternal,
  closePageInternal,
  screenshotInternal,
  evalInternal,
  getProfileLogInternal,
  getCookiesInternal,
  importCookiesInternal,
  deleteCookieInternal,
  clearCookiesInternal,
  editCookieInternal,
  getProfileWsInternal,
  getRunningMapInternal,
  getStatusMapInternal,
  getLocalesTimezonesInternal,
  runAutomationNowInternal,
} = require('../controllers/profiles');
const { getProfilesInternal, saveProfileInternal, deleteProfileInternal, cloneProfileInternal, saveProfilesBulkInternal, deleteProfilesBulkInternal, cloneProfilesBulkInternal } = require('../storage/profiles');
const { loadSettings, saveSettings } = require('../storage/settings');
const { listPresetsInternal, addPresetInternal, deletePresetInternal } = require('../storage/presets');
const { performAction } = require('../engine/actions');
const { listScriptsInternal, getScriptInternal, saveScriptInternal, deleteScriptInternal } = require('../storage/scripts');
const { addTaskLog, updateTaskLog, getTaskLogs, getTaskLogById, deleteTaskLog, clearTaskLogs } = require('../storage/taskLogs');
const { listModules, installModule, uninstallModule } = require('../storage/scriptModules');
const { executeScript, stopScript, pauseScript, resumeScript, isScriptRunning } = require('../engine/scriptRuntime');
// scriptRunner: helper tập trung áp dụng ethical linter + task log + skip detection (Bug #1/#2/#3)
const { runScriptWithFullChecks } = require('../engine/scriptRunner');
const { getAuditLogContent } = require('../logging/auditLogger');
const {
  getProxiesInternal, getProxyByIdInternal,
  createProxyInternal, updateProxyInternal,
  deleteProxyInternal, deleteProxiesBulkInternal,
  importProxiesInternal, exportProxiesInternal,
} = require('../storage/proxies');
const { checkProxy, checkProxiesBatch } = require('../services/ProxyChecker');
const { getMachineCode, validateLicenseKey, deactivateLicense } = require('../services/machineId');
const { checkBrowserStatus, installBrowser, uninstallBrowser, reinstallBrowser } = require('../services/browserManagerService');

const macroRecorders = new Map();

async function injectMacroRecorderScript(page) {
  await page.evaluate(() => {
    function getCssSelector(el) {
      try {
        if (el.id) return '#' + CSS.escape(el.id);
        const dt = el.getAttribute && el.getAttribute('data-testid');
        if (dt) return '[data-testid="' + dt.replace(/"/g, '\\"') + '"]';
        const tag = el.tagName.toLowerCase();
        if (el.classList && el.classList.length > 0) {
          const cls = Array.from(el.classList).slice(0, 3)
            .map(c => { try { return '.' + CSS.escape(c); } catch { return ''; } }).join('');
          return tag + cls;
        }
        const parts = [];
        let cur = el;
        while (cur && cur.nodeType === 1 && cur !== document.documentElement) {
          if (cur.id) { parts.unshift('#' + CSS.escape(cur.id)); break; }
          let sel = cur.nodeName.toLowerCase();
          let nth = 1, sib = cur.previousElementSibling;
          while (sib) { nth++; sib = sib.previousElementSibling; }
          if (nth > 1) sel += ':nth-child(' + nth + ')';
          parts.unshift(sel);
          cur = cur.parentElement;
        }
        return parts.join(' > ') || tag;
      } catch { return el.tagName ? el.tagName.toLowerCase() : 'unknown'; }
    }
    if (window.__obt_rec_click) { document.removeEventListener('click', window.__obt_rec_click, true); window.__obt_rec_click = null; }
    if (window.__obt_rec_change) { document.removeEventListener('change', window.__obt_rec_change, true); window.__obt_rec_change = null; }
    if (window.__obt_rec_keydown) { document.removeEventListener('keydown', window.__obt_rec_keydown, true); window.__obt_rec_keydown = null; }
    if (!window.__obt_macro_rec) return;
    window.__obt_rec_click = function(e) {
      try {
        const el = e.target;
        if (!el || !el.tagName) return;
        const tag = el.tagName.toLowerCase();
        if (['input', 'textarea', 'select', 'option'].includes(tag)) return;
        window.__obt_macro_rec({
          type: 'click.element',
          params: { selector: getCssSelector(el) },
          label: (el.innerText || el.getAttribute('aria-label') || el.getAttribute('title') || '').trim().slice(0, 60),
          delay: 0,
        });
      } catch {}
    };
    window.__obt_rec_change = function(e) {
      try {
        const el = e.target;
        if (!el || !el.tagName) return;
        if (!['input', 'textarea', 'select'].includes(el.tagName.toLowerCase())) return;
        window.__obt_macro_rec({
          type: 'input.fill',
          params: { selector: getCssSelector(el), value: el.value || '' },
          label: (el.placeholder || el.name || el.getAttribute('aria-label') || '').trim().slice(0, 60),
          delay: 0,
        });
      } catch {}
    };
    const SKEYS = new Set(['Enter', 'Tab', 'Escape', 'F1', 'F2', 'F3', 'F4', 'F5', 'F12', 'Backspace', 'Delete', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown']);
    window.__obt_rec_keydown = function(e) {
      try {
        if (SKEYS.has(e.key)) {
          window.__obt_macro_rec({ type: 'keyboard.pressKey', params: { key: e.key }, label: 'Press ' + e.key, delay: 0 });
        }
      } catch {}
    };
    document.addEventListener('click', window.__obt_rec_click, true);
    document.addEventListener('change', window.__obt_rec_change, true);
    document.addEventListener('keydown', window.__obt_rec_keydown, true);
  });
}

function registerIpcHandlers(extra = {}) {
  // Hàm đăng ký an toàn: Xóa handler cũ nếu có để hỗ trợ tính năng hot-reload (tải lại nóng) trong quá trình dev
  const handle = (channel, fn) => {
    try { ipcMain.removeHandler(channel); } catch {}
    ipcMain.handle(channel, fn);
  };

  // Quản lý Mã máy (Machine Code) & Giấy phép (License)
  handle('get-machine-code', () => getMachineCode());
  handle('validate-license', (_e, key) => validateLicenseKey(key));
  handle('deactivate-license', () => deactivateLicense());

  // Quản lý Môi trường chạy Trình duyệt (Browser Runtime Manager)
  handle('browser-runtime-status', async (_e, name) => checkBrowserStatus(name));
  handle('browser-runtime-install', async (_e, name) => {
    appendLog('system', `Browser runtime: installing "${name}"...`);
    const r = await installBrowser(name);
    if (r?.success) appendLog('system', `Browser runtime: "${name}" installed OK`);
    else appendLog('system', `Browser runtime: install "${name}" failed — ${r?.error || 'unknown'}`);
    return r;
  });
  handle('browser-runtime-uninstall', async (_e, name) => {
    appendLog('system', `Browser runtime: uninstalling "${name}"`);
    const r = await uninstallBrowser(name);
    if (r?.success) appendLog('system', `Browser runtime: "${name}" uninstalled`);
    return r;
  });
  handle('browser-runtime-reinstall', async (_e, name) => {
    appendLog('system', `Browser runtime: reinstalling "${name}"...`);
    const r = await reinstallBrowser(name);
    if (r?.success) appendLog('system', `Browser runtime: "${name}" reinstalled OK`);
    else appendLog('system', `Browser runtime: reinstall "${name}" failed — ${r?.error || 'unknown'}`);
    return r;
  });

  // [UC_08 / UC_14.01] Lấy danh sách tất cả profile từ file lưu trữ
  handle('get-profiles', async () => await getProfilesInternal());
  // [UC_08.01 / UC_08.02 / UC_14.02 / UC_14.03] Tạo mới hoặc cập nhật profile — gọi saveProfileInternal() trong storage/profiles.js
  handle('save-profile', async (_e, profile) => {
    const r = await saveProfileInternal(profile);
    if (r?.success) appendLog('system', `Profile saved: ${profile.name || profile.id}`);
    return r;
  });
  // [UC_08.03 / UC_14.04] Xóa profile — dừng profile đang chạy trước, sau đó xóa khỏi storage
  handle('delete-profile', async (_e, profileId) => {
    try { await stopProfileInternal(profileId); } catch { }
    const r = await deleteProfileInternal(profileId);
    if (r?.success) appendLog('system', `Profile deleted: ${profileId}`);
    return r;
  });
  // [UC_08.04 / UC_08.05 / UC_15.01] Mở trình duyệt cho profile — gọi launchProfileInternal() trong controllers/profiles.js
  handle('launch-profile', async (_e, profileId, options = {}) => {
    appendLog(profileId, `Profile launch requested (engine=${options.engine || 'default'}, headless=${!!options.headless})`);
    const r = await launchProfileInternal(profileId, options);
    if (!r?.success) appendLog(profileId, `Profile launch failed: ${r?.error || 'unknown'}`);
    return r;
  });
  // [UC_08.06 / UC_15.02] Dừng trình duyệt đang chạy của profile
  handle('stop-profile', async (_e, profileId) => {
    appendLog(profileId, 'Profile stop requested');
    return await stopProfileInternal(profileId);
  });
  // [UC_08.06] Dừng tất cả trình duyệt đang chạy
  handle('stop-all-profiles', async () => {
    appendLog('system', 'Stop all profiles requested');
    return await stopAllProfilesInternal();
  });
  handle('get-profile-log', async (_e, profileId) => await getProfileLogInternal(profileId));
  handle('get-cookies', async (_e, profileId) => await getCookiesInternal(profileId));
  handle('import-cookies', async (_e, profileId, cookies) => {
    const r = await importCookiesInternal(profileId, cookies);
    if (r?.success) appendLog(profileId, `Cookies imported: ${Array.isArray(cookies) ? cookies.length : 0} cookie(s)`);
    else appendLog(profileId, `Cookies import failed: ${r?.error || 'unknown'}`);
    return r;
  });
  handle('delete-cookie', async (_e, profileId, cookie) => {
    const r = await deleteCookieInternal(profileId, cookie);
    if (r?.success) appendLog(profileId, `Cookie deleted: ${cookie?.name} (${cookie?.domain})`);
    return r;
  });
  handle('clear-cookies', async (_e, profileId) => {
    const r = await clearCookiesInternal(profileId);
    if (r?.success) appendLog(profileId, 'All cookies cleared');
    return r;
  });
  handle('edit-cookie', async (_e, profileId, cookie) => {
    const r = await editCookieInternal(profileId, cookie);
    if (r?.success) appendLog(profileId, `Cookie edited: ${cookie?.name} (${cookie?.domain})`);
    return r;
  });
  handle('get-profile-ws', async (_e, profileId) => await getProfileWsInternal(profileId));
  // [UC_15.03] Kiểm tra trạng thái đang chạy của tất cả profile
  handle('get-running-map', async () => await getRunningMapInternal());
  // [UC_15.03] Lấy map trạng thái chi tiết (STARTING/RUNNING/STOPPED) của các profile
  handle('get-status-map', async () => getStatusMapInternal());
  handle('get-locales-timezones', async () => await getLocalesTimezonesInternal());
  handle('clone-profile', async (_e, sourceProfileId, overrides = {}) => {
    const r = await cloneProfileInternal(sourceProfileId, overrides);
    if (r?.success) appendLog('system', `Profile cloned: ${sourceProfileId} → ${r.profile?.id} "${r.profile?.name}"`);
    else appendLog('system', `Profile clone failed: ${r?.error || 'unknown'}`);
    return r;
  });

  // Xử lý Profile hàng loạt (Thêm, Sửa, Xóa nhiều Profile cùng lúc)
  handle('save-profiles-bulk', async (_e, profiles) => {
    const r = await saveProfilesBulkInternal(profiles);
    if (r?.success) appendLog('system', `Bulk saved ${r.profiles?.length || 0} profile(s)`);
    return r;
  });
  handle('delete-profiles-bulk', async (_e, ids) => {
    // Ép dừng các profile đang chạy trước khi xóa
    if (Array.isArray(ids)) {
      for (const id of ids) {
        try { await stopProfileInternal(id); } catch { }
      }
    }
    const r = await deleteProfilesBulkInternal(ids);
    if (r?.success) appendLog('system', `Bulk deleted ${r.deleted || 0} profile(s)`);
    return r;
  });
  handle('clone-profiles-bulk', async (_e, sourceIds, overrides = {}) => {
    const r = await cloneProfilesBulkInternal(sourceIds, overrides);
    if (r?.success) appendLog('system', `Bulk cloned ${r.profiles?.length || 0} profile(s)`);
    return r;
  });

  // Tự động hóa (Automation)
  handle('run-automation-now', async (_e, profileId) => await runAutomationNowInternal(profileId));

  // [UC_16.xx] Dispatcher chung cho tất cả hành động tương tác trình duyệt (navigate, click, fill, screenshot...)
  // Bộ thực thi hành động chung nhận từ Frontend: (profileId, actionName, params)
  handle('profile-action', async (_e, profileId, actionName, params = {}) => {
    try { return await performAction(profileId, String(actionName), params || {}); }
    catch (e) { return { success: false, error: e?.message || String(e) }; }
  });

  // Điều khiển truyền phát Stream màn hình trực tiếp (Screencast / Live Preview)
  handle('start-preview', async (_e, profileId) => {
    try {
      const { startScreencast, isScreencasting } = require('../engine/screencast');
      if (isScreencasting(profileId)) return { success: true, already: true };
      startScreencast(profileId);
      return { success: true };
    } catch (e) { return { success: false, error: e?.message || String(e) }; }
  });
  handle('stop-preview', async (_e, profileId) => {
    try {
      const { stopScreencast } = require('../engine/screencast');
      stopScreencast(profileId);
      return { success: true };
    } catch (e) { return { success: false, error: e?.message || String(e) }; }
  });
  handle('screencast-status', async (_e, profileId) => {
    try {
      const { isScreencasting } = require('../engine/screencast');
      return { success: true, streaming: isScreencasting(profileId) };
    } catch (e) { return { success: false, streaming: false }; }
  });

  // Quản lý bộ Cấu hình mẫu (Presets)
  handle('presets-list', async () => await listPresetsInternal());
  handle('presets-add', async (_e, preset) => {
    const r = await addPresetInternal(preset || {});
    if (r?.success) appendLog('system', `Preset added: "${preset?.name || 'unnamed'}"`);
    return r;
  });
  handle('presets-delete', async (_e, id) => {
    const r = await deletePresetInternal(String(id));
    if (r?.success) appendLog('system', `Preset deleted: ${id}`);
    return r;
  });

  // Quản lý Kịch bản Tự động hóa (Scripts)
  // [UC_19.01] Lấy danh sách tất cả script
  handle('scripts-list', async () => await listScriptsInternal());
  handle('scripts-get', async (_e, id) => await getScriptInternal(id));
  // [UC_19.02 / UC_19.03] Tạo mới hoặc cập nhật script
  handle('scripts-save', async (_e, script) => {
    const r = await saveScriptInternal(script);
    if (r?.success) {
      appendLog('system', `Script saved: "${script?.name || script?.id || 'unnamed'}"`);
      // Đồng bộ cron job với schedule mới (scheduleScript tự cancel job cũ nếu có)
      try {
        const { scheduleScript } = require('../engine/scriptScheduler');
        scheduleScript(r.script);
      } catch (e) {
        appendLog('system', `scheduleScript error after save: ${e?.message || e}`);
      }
    } else {
      appendLog('system', `Script save failed: ${r?.error || 'unknown'}`);
    }
    return r;
  });
  // [UC_19.04] Xóa script — hủy cron job trước rồi mới xóa file
  handle('scripts-delete', async (_e, id) => {
    // Cancel cron job BEFORE deleting so scheduler doesn't fire after deletion
    try {
      const { cancelScript } = require('../engine/scriptScheduler');
      cancelScript(String(id));
    } catch {}
    const r = await deleteScriptInternal(id);
    if (r?.success) appendLog('system', `Script deleted: ${id}`);
    return r;
  });

  // [Inspect Fingerprint] Đọc fingerprint thực tế từ browser đang chạy
  handle('profile-inspect-fingerprint', async (_e, profileId) => {
    const { inspectFingerprintInternal } = require('../controllers/profiles');
    return await inspectFingerprintInternal(profileId);
  });

  // [Bug #5 fix] Validate cron expression trên main process dùng node-cron.validate()
  // Được gọi từ UI trước khi save — đảm bảo expression hợp lệ trước khi ghi xuống file
  handle('validate-cron', (_e, expr) => {
    try {
      const nodeCron = require('node-cron');
      const valid = typeof expr === 'string' && expr.trim().length > 0 && nodeCron.validate(expr.trim());
      return { valid, expr: expr?.trim() };
    } catch (e) {
      return { valid: false, expr: expr?.trim(), error: e?.message };
    }
  });

  // [Bug #6 fix] "Test Run Now" — chạy ngay script theo lịch mà không cần đợi cron tick
  // Dùng đúng profileId đã cấu hình trong schedule của script
  handle('script-run-now', async (_e, scriptId) => {
    try {
      const scriptResult = await getScriptInternal(scriptId);
      if (!scriptResult?.success || !scriptResult.script) {
        return { success: false, error: 'Script not found: ' + scriptId };
      }
      const script = scriptResult.script;
      const profileId = script.schedule?.profileId;
      if (!profileId) return { success: false, error: 'No profile configured for this schedule. Please set a profile first.' };

      const code       = script.code || '';
      const scriptName = script.name || scriptId;
      appendLog(profileId, `[Run Now] Manual trigger for scheduled script "${scriptName}"`);

      // Launch profile nếu chưa chạy
      const { runningProfiles } = require('../state/runtime');
      if (!runningProfiles.has(profileId)) {
        const { readProfiles } = require('../storage/profiles');
        const profileData  = readProfiles().find(p => p.id === profileId);
        if (!profileData) return { success: false, error: `Profile "${profileId}" not found. It may have been deleted.` };
        const engine       = profileData?.settings?.engine || 'playwright';
        const headless     = script.browserMode === 'headless';
        const launchResult = await launchProfileInternal(profileId, { headless, engine });
        if (!launchResult.success) return { success: false, error: 'Failed to launch profile: ' + (launchResult.error || 'unknown') };
        await new Promise(r => setTimeout(r, 1500));
      }

      // Thực thi qua helper đầy đủ (linter + task log + skip detection)
      return await runScriptWithFullChecks(profileId, code, {
        scriptId,
        scriptName,
        source: 'run-now',
        timeoutMs: 120000,
      });
    } catch (e) {
      return { success: false, error: e?.message || String(e) };
    }
  });
  // [UC_17.03] Thực thi script automation trên profile — kiểm tra ethical, tự launch profile nếu chưa chạy
  handle('scripts-execute', async (_e, profileId, scriptId, opts) => {
    const startedAt = new Date().toISOString();
    try {
      const scriptResult = await getScriptInternal(scriptId);
      if (!scriptResult?.success || !scriptResult.script) {
        return { success: false, error: 'Script not found: ' + scriptId };
      }
      const code = scriptResult.script.code || '';
      const scriptName = scriptResult.script.name || scriptId;
      appendLog(profileId, `Script execute: "${scriptName}"`);

      // ── Launch profile nếu chưa chạy (logic này giữ nguyên tại IPC handler) ──────
      const { runningProfiles } = require('../state/runtime');
      if (!runningProfiles.has(profileId)) {
        const headless = !!(opts && opts.headless);
        const { readProfiles } = require('../storage/profiles');
        const profileForEngine = readProfiles().find(p => p.id === profileId);
        const profileEngine = profileForEngine?.settings?.engine || 'playwright';
        const launchResult = await launchProfileInternal(profileId, { headless, engine: profileEngine });
        if (!launchResult.success) {
          appendLog(profileId, `Script execute failed — could not launch profile: ${launchResult.error || 'unknown'}`);
          await addTaskLog({ scriptId, scriptName, profileId, status: 'error', startedAt, finishedAt: new Date().toISOString(), logs: [], error: 'Failed to launch profile: ' + (launchResult.error || 'unknown') });
          return { success: false, error: 'Failed to launch profile: ' + (launchResult.error || 'unknown') };
        }
        await new Promise(r => setTimeout(r, 1500));
      }

      // ── runScriptWithFullChecks: ethical linter + skip detection + task log + execute ──
      // Bug #1: linter giờ được áp dụng ở scriptRunner.js thay vì inline tại đây
      // Bug #2: task log được ghi bên trong helper (không cần ghi thêm ở đây)
      // Bug #3: nếu script đang chạy sẽ log rõ tick bị skip thay vì nuốt im lặng
      const result = await runScriptWithFullChecks(profileId, code, {
        scriptId,
        scriptName,
        source: 'ipc',
        timeoutMs: Math.min(opts?.timeoutMs || 120000, 300000),
      });
      if (result.success) {
        appendLog(profileId, `Script finished OK: "${scriptName}"`);
      } else if (!result.skipped) {
        const isStopped = result.error && String(result.error).includes('stopped by user');
        appendLog(profileId, isStopped ? `Script stopped by user` : `Script error: ${result.error}`);
      }
      return result;
    }
    catch (e) {
      // Catch dành cho lỗi xảy ra TRƯỚC khi runScriptWithFullChecks được gọi
      // (ví dụ: getScriptInternal throw, hoặc launchProfile throw)
      await addTaskLog({ scriptId, scriptName: scriptId, profileId, status: 'error', startedAt, finishedAt: new Date().toISOString(), logs: [], error: e?.message || String(e) });
      return { success: false, error: e?.message || String(e) };
    }
  });

  // Điều khiển tiến trình chạy Kịch bản (Thực thi, Dừng, Tạm dừng, Tiếp tục)
  handle('script-stop', (_e, profileId) => {
    stopScript(profileId);
    return { success: true };
  });
  handle('script-pause', (_e, profileId) => {
    pauseScript(profileId);
    return { success: true };
  });
  handle('script-resume', (_e, profileId) => {
    resumeScript(profileId);
    return { success: true };
  });
  handle('script-is-running', (_e, profileId) => {
    return { running: isScriptRunning(profileId) };
  });

  // Quản lý nhật ký tác vụ theo thời gian thực (Task logs)
  // [UC_17.01] Lấy danh sách task log
  handle('task-logs-list', async () => getTaskLogs());
  handle('task-logs-get', async (_e, id) => getTaskLogById(id));
  // [UC_17.05] Xóa task record
  handle('task-logs-delete', async (_e, id) => {
    const r = await deleteTaskLog(id);
    if (r?.success) appendLog('system', `Task log deleted: ${id}`);
    return r;
  });
  handle('task-logs-clear', async () => {
    const r = await clearTaskLogs();
    if (r?.success) appendLog('system', 'All task logs cleared');
    return r;
  });

  // Chạy task được tạo từ API — cập nhật trực tiếp bản ghi hiện tại, không tạo mới
  handle('task-run', async (_e, taskId) => {
    const startedAt = new Date().toISOString();
    try {
      const found = await getTaskLogById(taskId);
      if (!found.success) return { success: false, error: 'Task not found: ' + taskId };
      const task = found.taskLog;
      const code = task.scriptContent || task._scriptContent || '';
      if (!code) return { success: false, error: 'Task has no scriptContent' };
      const profileId = task.profileId;
      const taskName = task.name || task.scriptName || taskId;

      const restrictedDomainPattern = /\.gov|\.mil|\.edu|\b(bank|paypal|vnpay|momo|zalopay|shopeepay|viettelpay|agribank|vietcombank|techcombank|mbbank|sacombank|vpbank|bidv|crypto|binance|bitcoin|usdt)\b/i;
      const ddosPattern = /while\s*\(\s*true\s*\)\s*\{[^{}]*(fetch|actions\.)/i;
      if (restrictedDomainPattern.test(code) || ddosPattern.test(code)) {
        const { appendAuditLog } = require('../logging/auditLogger');
        appendAuditLog('VIOLATION_BLOCKED', `Task attempted to access restricted patterns`, profileId);
        return { success: false, error: 'EthicalViolationError: Restricted domain access or sensitive patterns are strictly prohibited.' };
      }

      appendLog(profileId, `Task execute: "${taskName}"`);
      const prevLogs = task.logs || [];
      const runSeparator = { time: startedAt, message: `── Run ${new Date(startedAt).toLocaleString()} ──` };
      await updateTaskLog(taskId, { status: 'running', startedAt, completedAt: null, error: null });

      const { runningProfiles } = require('../state/runtime');
      if (!runningProfiles.has(profileId)) {
        const headless = task.headless !== undefined ? task.headless : false;
        const { readProfiles } = require('../storage/profiles');
        const profileForEngine = readProfiles().find(p => p.id === profileId);
        const profileEngine = profileForEngine?.settings?.engine || 'playwright';
        const launchResult = await launchProfileInternal(profileId, { headless, engine: profileEngine });
        if (!launchResult.success) {
          appendLog(profileId, `Task execute failed — could not launch profile: ${launchResult.error || 'unknown'}`);
          await updateTaskLog(taskId, { status: 'error', completedAt: new Date().toISOString(), error: 'Failed to launch profile: ' + (launchResult.error || 'unknown'), logs: [...prevLogs, runSeparator] });
          return { success: false, error: 'Failed to launch profile: ' + (launchResult.error || 'unknown') };
        }
        await new Promise(r => setTimeout(r, 1500));
      }

      const result = await executeScript(profileId, code, {});
      const completedAt = new Date().toISOString();
      const combinedLogs = [...prevLogs, runSeparator, ...(result.logs || [])];
      if (result.success) {
        appendLog(profileId, `Task finished OK: "${taskName}"`);
        await updateTaskLog(taskId, { status: 'completed', startedAt, completedAt, logs: combinedLogs, error: null });
      } else {
        const isStopped = result.error && String(result.error).includes('stopped by user');
        appendLog(profileId, isStopped ? 'Task stopped by user' : `Task error: ${result.error}`);
        await updateTaskLog(taskId, { status: isStopped ? 'stopped' : 'error', startedAt, completedAt, logs: combinedLogs, error: result.error || null });
      }
      return result;
    } catch (e) {
      await updateTaskLog(taskId, { status: 'error', completedAt: new Date().toISOString(), error: e?.message || String(e) });
      return { success: false, error: e?.message || String(e) };
    }
  });

  // Hỗ trợ xuất Audit Log (Ethical Rule UC_11.03)
  handle('system-export-audit', async () => {
    const result = getAuditLogContent();
    if (result.success) {
      appendLog('system', 'System Audit Log exported by user.');
    } else {
      appendLog('system', `System Audit Log export blocked: ${result.error}`);
    }
    return result;
  });

  // Quản lý thư viện bổ sung cho Kịch bản (NPM Packages / Script modules)
  handle('script-modules-list', async () => {
    try { return { success: true, modules: listModules() }; }
    catch (e) { return { success: false, error: e.message }; }
  });
  handle('script-modules-install', async (_e, packageName) => {
    try { return await installModule(packageName); }
    catch (e) { return { success: false, error: e.message }; }
  });
  handle('script-modules-uninstall', async (_e, packageName) => {
    try { return await uninstallModule(packageName); }
    catch (e) { return { success: false, error: e.message }; }
  });

  // Quản lý danh sách Proxy
  handle('proxy-get-all', async () => await getProxiesInternal());
  handle('proxy-get-by-id', async (_e, id) => await getProxyByIdInternal(id));
  handle('proxy-create', async (_e, data) => {
    const r = await createProxyInternal(data);
    if (r?.success) appendLog('system', `Proxy created: "${data?.name || data?.host || 'unnamed'}"`);
    else appendLog('system', `Proxy create failed: ${r?.error || 'unknown'}`);
    return r;
  });
  handle('proxy-update', async (_e, id, data) => await updateProxyInternal(id, data));
  handle('proxy-delete', async (_e, id) => {
    const r = await deleteProxyInternal(id);
    if (r?.success) appendLog('system', `Proxy deleted: ${id}`);
    return r;
  });
  handle('proxy-delete-bulk', async (_e, ids) => await deleteProxiesBulkInternal(ids));
  handle('proxy-import', async (_e, text, format) => {
    const r = await importProxiesInternal(text, format);
    if (r?.success) appendLog('system', `Proxies imported: ${r?.count || 0} item(s)`);
    else appendLog('system', `Proxy import failed: ${r?.error || 'unknown'}`);
    return r;
  });
  handle('proxy-export', async (_e, ids) => await exportProxiesInternal(ids));

  // Trình kiểm tra trạng thái sống chết của Proxy (Checker)
  handle('proxy-check', async (_e, cfg) => {
    try { return await checkProxy(cfg); }
    catch (e) { return { success: false, alive: false, error: e?.message || String(e) }; }
  });
  handle('proxy-check-all', async () => {
    try {
      const proxies = await getProxiesInternal();
      const results = {};
      await checkProxiesBatch(proxies, (id, result) => {
        results[id] = result;
        // Cập nhật trạng thái mới nhất của proxy vào máy chủ lưu trữ (JSON/DB)
        try {
          updateProxyInternal(id, {
            status: result.alive ? 'alive' : 'dead',
            latency: result.latency || null,
            lastChecked: new Date().toISOString(),
            country: result.country || result.countryCode || '',
            countryCode: result.countryCode || '',
            ip: result.ip || '',
            city: result.city || '',
          }).catch(() => {});
        } catch {}
      });
      return { success: true, results };
    } catch (e) { return { success: false, error: e?.message || String(e) }; }
  });

  // Trình xoay vòng Proxy (Được gộp từ nhánh phát triển huy)
  handle('proxy-rotate', async (_e, id) => {
    try {
      const getRes = await getProxyByIdInternal(id);
      if (!getRes.success) return getRes;
      const proxy = getRes.proxy;
      if (!proxy.rotateUrl) return { success: false, error: 'No rotate URL configured' };
      appendLog('system', `Proxy rotate: ${proxy.name || id}`);
      const axios = require('axios');
      const startTime = Date.now();
      const response = await axios.get(proxy.rotateUrl, { timeout: 15000 });
      const latency = Date.now() - startTime;
      await updateProxyInternal(id, { lastRotated: new Date().toISOString() });
      appendLog('system', `Proxy rotated OK: ${proxy.name || id} (${latency}ms)`);
      return { success: true, latency, data: response.data };
    } catch (e) {
      appendLog('system', `Proxy rotate failed: ${e?.message || e}`);
      return { success: false, error: e?.message || e };
    }
  });

  handle('proxy-rotate-url', async (_e, url) => {
    try {
      if (!url) return { success: false, error: 'No URL provided' };
      appendLog('system', `Proxy rotate URL: ${url}`);
      const axios = require('axios');
      const startTime = Date.now();
      const response = await axios.get(url, { timeout: 15000 });
      const latency = Date.now() - startTime;
      appendLog('system', `Proxy rotate URL OK (${latency}ms)`);
      return { success: true, latency, data: response.data };
    } catch (e) {
      appendLog('system', `Proxy rotate URL failed: ${e?.message || String(e)}`);
      return { success: false, error: e?.message || String(e) };
    }
  });

  // Lưu trữ cài đặt trực tiếp (Dự phòng cho quá trình mở rộng sau này)
  handle('load-settings', async () => {
    try { const s = loadSettings(); return { success: true, settings: s || {} }; }
    catch (e) { return { success: false, error: e?.message || String(e) }; }
  });
  handle('save-settings', async (_e, partial) => {
    const current = loadSettings();
    const ok = saveSettings({ ...current, ...partial });
    if (ok) appendLog('system', `Settings saved (keys: ${Object.keys(partial || {}).join(', ') || 'none'})`);
    else appendLog('system', 'Settings save failed');
    return { success: ok };
  });

  // Mở liên kết ngoài mạng bằng trình duyệt mặc định của hệ điều hành OS
  handle('open-external', async (_e, url) => {
    try { await shell.openExternal(String(url)); return { success: true }; }
    catch (e) { return { success: false, error: e?.message || String(e) }; }
  });

  // ── Element Picker: điều khiển browser từ UI picker panel ───────────────────

  // Lấy URL trang hiện tại của profile đang chạy
  handle('element-picker:get-url', async (_e, profileId) => {
    try {
      const { runningProfiles } = require('../state/runtime');
      const running = runningProfiles.get(profileId);
      if (!running) return { success: false, error: 'Profile not running' };
      const pages = (running.context?.pages() || []).filter(p => !p.isClosed?.());
      if (!pages.length) return { success: false, error: 'No pages open' };
      return { success: true, url: pages[0].url() };
    } catch (e) { return { success: false, error: e?.message || String(e) }; }
  });

  // Điều hướng trang browser tới URL mới
  handle('element-picker:navigate', async (_e, profileId, url) => {
    try {
      const { runningProfiles } = require('../state/runtime');
      const running = runningProfiles.get(profileId);
      if (!running) return { success: false, error: 'Profile not running' };
      const context = running.context;
      if (!context) return { success: false, error: 'No context' };
      let page = context.pages().find(p => !p.isClosed?.());
      if (!page) page = await context.newPage();
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      return { success: true, url: page.url() };
    } catch (e) { return { success: false, error: e?.message || String(e) }; }
  });

  // Đưa cửa sổ browser lên foreground
  handle('element-picker:bring-to-front', async (_e, profileId) => {
    try {
      const { runningProfiles } = require('../state/runtime');
      const running = runningProfiles.get(profileId);
      if (!running) return { success: false, error: 'Profile not running' };
      const page = (running.context?.pages() || []).find(p => !p.isClosed?.());
      if (page) await page.bringToFront();
      return { success: true };
    } catch (e) { return { success: false, error: e?.message || String(e) }; }
  });

  // Bật chế độ hover-pick: inject script lắng nghe Ctrl+mouseover, tạo đầy đủ CSS/XPath/Text selectors
  handle('element-picker:start-picking', async (_e, profileId) => {
    try {
      const { runningProfiles } = require('../state/runtime');
      const running = runningProfiles.get(profileId);
      if (!running) return { success: false, error: 'Profile not running' };
      const page = (running.context?.pages() || []).find(p => !p.isClosed?.());
      if (!page) return { success: false, error: 'No pages open' };

      // Expose callback Node.js → browser (ignore if already exposed from previous picker open)
      try {
        await page.exposeFunction('__obt_ep_pick', (data) => {
          for (const w of BrowserWindow.getAllWindows()) {
            try { w.webContents.send('element-picker:selector-picked', data); } catch {}
          }
        });
      } catch { /* already exposed — safe to ignore */ }

      // Inject idempotent event listener with full selector generation
      await page.evaluate(() => {
        // ── CSS selector: tag + all classes (Tailwind-friendly), fallback to structural path
        function getCssSelector(el) {
          if (el.id) return '#' + CSS.escape(el.id);
          const tag = el.tagName.toLowerCase();
          if (el.classList && el.classList.length > 0) {
            return tag + Array.from(el.classList).map(c => '.' + CSS.escape(c)).join('');
          }
          // structural fallback
          const parts = [];
          let cur = el;
          while (cur && cur.nodeType === 1 && cur !== document.documentElement) {
            if (cur.id) { parts.unshift('#' + CSS.escape(cur.id)); break; }
            let sel = cur.nodeName.toLowerCase();
            let nth = 1, sib = cur.previousElementSibling;
            while (sib) { nth++; sib = sib.previousElementSibling; }
            if (nth > 1) sel += ':nth-child(' + nth + ')';
            parts.unshift(sel);
            cur = cur.parentElement;
          }
          return parts.join(' > ') || tag;
        }

        // ── XPath: walk up to nearest ancestor with ID, then build path
        function getXPath(el) {
          const parts = [];
          let cur = el;
          while (cur && cur.nodeType === 1) {
            if (cur.id) { parts.unshift('*[@id="' + cur.id + '"]'); break; }
            const tag = cur.nodeName.toLowerCase();
            const parent = cur.parentElement;
            if (parent) {
              const sameTag = Array.from(parent.children).filter(c => c.nodeName === cur.nodeName);
              parts.unshift(sameTag.length > 1 ? tag + '[' + (sameTag.indexOf(cur) + 1) + ']' : tag);
            } else {
              parts.unshift(tag);
            }
            cur = parent;
          }
          return '//' + parts.join('/');
        }

        // ── Text selector: only for short single-line text
        function getTextSelector(el) {
          const text = (el.innerText || '').trim();
          if (!text || text.length > 80 || text.includes('\n')) return null;
          return 'text=' + text;
        }

        // Remove old listener before re-injecting (idempotent)
        if (window.__obt_ep_handler) {
          document.removeEventListener('mouseover', window.__obt_ep_handler, true);
        }
        // Highlight style
        if (!document.getElementById('__obt_ep_style')) {
          const s = document.createElement('style');
          s.id = '__obt_ep_style';
          s.textContent = '.__obt_ep_hl{outline:2px solid #00d2d3!important;outline-offset:2px!important;background:rgba(0,210,211,0.07)!important}';
          document.head.appendChild(s);
        }

        window.__obt_ep_handler = function(e) {
          if (!e.ctrlKey && !e.metaKey) return;
          e.stopPropagation();
          e.preventDefault();
          const el = e.target;
          document.querySelectorAll('.__obt_ep_hl').forEach(x => x.classList.remove('__obt_ep_hl'));
          el.classList.add('__obt_ep_hl');

          const rect = el.getBoundingClientRect();
          const cssSelector = getCssSelector(el);

          window.__obt_ep_pick({
            // Selector variants
            cssSelector,
            xpath:        getXPath(el),
            textSelector: getTextSelector(el),
            // Element identity
            tagName:     el.tagName.toLowerCase(),
            id:          el.id || null,
            classes:     el.className || null,
            text:        (el.innerText || el.textContent || '').trim().slice(0, 300),
            // Attributes
            href:        el.getAttribute('href') || null,
            src:         el.getAttribute('src') || null,
            type:        el.getAttribute('type') || null,
            name:        el.getAttribute('name') || null,
            placeholder: el.getAttribute('placeholder') || null,
            value:       el.value !== undefined ? String(el.value) : null,
            // Geometry
            position:    { x: Math.round(e.clientX), y: Math.round(e.clientY) },
            boundingBox: {
              x:      Math.round(rect.left),
              y:      Math.round(rect.top),
              width:  Math.round(rect.width),
              height: Math.round(rect.height),
            },
          });
        };
        document.addEventListener('mouseover', window.__obt_ep_handler, true);
      });
      return { success: true };
    } catch (e) { return { success: false, error: e?.message || String(e) }; }
  });

  // Tắt chế độ hover-pick, xoá listener và highlight
  handle('element-picker:stop-picking', async (_e, profileId) => {
    try {
      const { runningProfiles } = require('../state/runtime');
      const running = runningProfiles.get(profileId);
      if (!running) return { success: true };
      const page = (running.context?.pages() || []).find(p => !p.isClosed?.());
      if (page) {
        await page.evaluate(() => {
          if (window.__obt_ep_handler) {
            document.removeEventListener('mouseover', window.__obt_ep_handler, true);
            window.__obt_ep_handler = null;
          }
          document.querySelectorAll('.__obt_ep_hl').forEach(x => x.classList.remove('__obt_ep_hl'));
        }).catch(() => {});
      }
      return { success: true };
    } catch (e) { return { success: true }; }
  });

  // Lấy thông tin chi tiết của element theo selector
  handle('element-picker:get-element-info', async (_e, profileId, selector) => {
    try {
      const { runningProfiles } = require('../state/runtime');
      const running = runningProfiles.get(profileId);
      if (!running) return { success: false, error: 'Profile not running' };
      const page = (running.context?.pages() || []).find(p => !p.isClosed?.());
      if (!page) return { success: false, error: 'No pages' };
      const info = await page.evaluate((sel) => {
        try {
          const el = document.querySelector(sel);
          if (!el) return null;
          const rect = el.getBoundingClientRect();
          const attrs = {};
          for (const a of el.attributes) attrs[a.name] = a.value;
          return {
            tagName: el.tagName.toLowerCase(),
            id: el.id || null,
            className: el.className || null,
            text: (el.textContent || '').trim().slice(0, 300),
            href: el.getAttribute('href') || null,
            src: el.getAttribute('src') || null,
            type: el.getAttribute('type') || null,
            name: el.getAttribute('name') || null,
            placeholder: el.getAttribute('placeholder') || null,
            value: el.value !== undefined ? String(el.value) : null,
            visible: el.offsetParent !== null,
            rect: { top: Math.round(rect.top), left: Math.round(rect.left), width: Math.round(rect.width), height: Math.round(rect.height) },
            attrs,
          };
        } catch { return null; }
      }, selector);
      return { success: true, info };
    } catch (e) { return { success: false, error: e?.message || String(e) }; }
  });

  // Thực thi các action từ Element Picker (click, hover, fill, press key, scroll, nav)
  handle('element-picker:action', async (_e, profileId, action, ...args) => {
    try {
      if (action === 'click-element') return await performAction(profileId, 'click.element', { selector: args[0], timeout: 5000 });
      if (action === 'hover-element') return await performAction(profileId, 'hover', { selector: args[0], timeout: 5000 });
      if (action === 'double-click') return await performAction(profileId, 'element.dblclick', { selector: args[0], timeout: 5000 });
      if (action === 'click-point') return await performAction(profileId, 'mouse.click', { x: args[0], y: args[1] });
      if (action === 'fill') return await performAction(profileId, 'input.fill', { selector: args[0], value: args[1], timeout: 5000 });
      if (action === 'press-key') return await performAction(profileId, 'keyboard.pressKey', { key: args[0] });
      if (action === 'nav-back') return await performAction(profileId, 'nav.back', {});
      if (action === 'nav-forward') return await performAction(profileId, 'nav.forward', {});
      if (action === 'nav-reload') return await performAction(profileId, 'nav.reload', {});
      if (action === 'scroll') {
        const { runningProfiles } = require('../state/runtime');
        const running = runningProfiles.get(profileId);
        if (!running) return { success: false, error: 'Profile not running' };
        const page = (running.context?.pages() || []).find(p => !p.isClosed?.());
        if (!page) return { success: false, error: 'No pages' };
        await page.evaluate((dir) => window.scrollBy({ top: dir === 'up' ? -300 : 300, behavior: 'smooth' }), args[0]);
        return { success: true };
      }
      return { success: false, error: `Unknown action: ${action}` };
    } catch (e) { return { success: false, error: e?.message || String(e) }; }
  });

  // ── Macro CRUD & execution ──────────────────────────────────────────────
  const { listMacrosInternal, getMacroInternal, saveMacroInternal, deleteMacroInternal } = require('../storage/macros');

  handle('macro-list', async () => {
    try { return { success: true, macros: await listMacrosInternal() }; }
    catch (e) { return { success: false, error: e?.message || String(e) }; }
  });

  handle('macro-get', async (_e, id) => {
    try { return await getMacroInternal(id); }
    catch (e) { return { success: false, error: e?.message || String(e) }; }
  });

  handle('macro-save', async (_e, macro) => {
    try { return await saveMacroInternal(macro); }
    catch (e) { return { success: false, error: e?.message || String(e) }; }
  });

  handle('macro-delete', async (_e, id) => {
    try { return await deleteMacroInternal(id); }
    catch (e) { return { success: false, error: e?.message || String(e) }; }
  });

  handle('macro-run', async (_e, macroId, profileId) => {
    try {
      const result = await getMacroInternal(macroId);
      if (!result.success) return result;
      const macro = result.macro;
      const { runningProfiles } = require('../state/runtime');
      if (!runningProfiles.has(profileId)) return { success: false, error: 'Profile is not running' };
      for (let i = 0; i < macro.steps.length; i++) {
        const step = macro.steps[i];
        if (step.delay && step.delay > 0) {
          await new Promise(r => setTimeout(r, step.delay));
        }
        try {
          await performAction(profileId, step.type, step.params || {});
        } catch (e) {
          return { success: false, error: `Step ${i + 1} "${step.label || step.type}" failed: ${e?.message || e}`, stepIndex: i };
        }
      }
      return { success: true };
    } catch (e) { return { success: false, error: e?.message || String(e) }; }
  });

  // ── Macro Recording ──────────────────────────────────────────────────────
  handle('macro-record-start', async (_e, profileId) => {
    try {
      const { runningProfiles } = require('../state/runtime');
      const running = runningProfiles.get(profileId);
      if (!running) return { success: false, error: 'Profile is not running. Please launch the profile first.' };
      const page = (running.context?.pages() || []).find(p => !p.isClosed?.());
      if (!page) return { success: false, error: 'No pages open in this profile.' };

      const prev = macroRecorders.get(profileId);
      if (prev) { try { prev.cleanup(); } catch {} }

      const sendStep = (step) => {
        for (const w of BrowserWindow.getAllWindows()) {
          try { w.webContents.send('macro:record-step', { profileId, step }); } catch {}
        }
      };

      try { await page.exposeFunction('__obt_macro_rec', (data) => sendStep(data)); } catch { /* already exposed */ }

      let lastUrl = page.url();
      let navActive = false;
      setTimeout(() => { navActive = true; }, 400);

      const navHandler = (frame) => {
        try {
          if (!navActive || frame.parentFrame()) return;
          const url = frame.url();
          if (!url || url === 'about:blank') return;
          const base = u => u.split('#')[0];
          if (base(url) === base(lastUrl)) { lastUrl = url; return; }
          lastUrl = url;
          sendStep({ type: 'nav.goto', params: { url }, label: '', delay: 0 });
        } catch {}
      };

      const loadHandler = async () => { try { await injectMacroRecorderScript(page); } catch {} };

      page.on('framenavigated', navHandler);
      page.on('load', loadHandler);
      await injectMacroRecorderScript(page);

      macroRecorders.set(profileId, {
        cleanup: () => {
          try { page.off('framenavigated', navHandler); } catch {}
          try { page.off('load', loadHandler); } catch {}
          page.evaluate(() => {
            if (window.__obt_rec_click) { document.removeEventListener('click', window.__obt_rec_click, true); window.__obt_rec_click = null; }
            if (window.__obt_rec_change) { document.removeEventListener('change', window.__obt_rec_change, true); window.__obt_rec_change = null; }
            if (window.__obt_rec_keydown) { document.removeEventListener('keydown', window.__obt_rec_keydown, true); window.__obt_rec_keydown = null; }
          }).catch(() => {});
          macroRecorders.delete(profileId);
        },
      });
      return { success: true };
    } catch (e) { return { success: false, error: e?.message || String(e) }; }
  });

  handle('macro-record-stop', async (_e, profileId) => {
    try {
      const rec = macroRecorders.get(profileId);
      if (rec) rec.cleanup();
      return { success: true };
    } catch { return { success: true }; }
  });

  // Các bộ điều khiển Máy chủ Local REST API (Chỉ kích hoạt nếu restServer được truyền vào lúc khởi động)
  if (extra.restServer) {
    const rest = extra.restServer;
    const handlers = extra.handlers || {};
    handle('get-api-server-status', async () => {
      try { return { success: true, state: rest.getState() }; } catch (e) { return { success: false, error: e.message }; }
    });
    handle('set-api-server-enabled', async (_e, enabled) => {
      try { const r = await rest.setEnabled(!!enabled, handlers); return { success: !!r.ok, state: rest.getState(), error: r.error }; } catch (e) { return { success: false, error: e.message }; }
    });
    handle('set-api-server-port', async (_e, port) => {
      try { const r = await rest.setPort(Number(port), handlers); return { success: !!r.ok, state: rest.getState(), error: r.error }; } catch (e) { return { success: false, error: e.message }; }
    });
    handle('restart-api-server', async () => {
      try { await rest.stop(); const r = await rest.start(handlers); return { success: !!r.ok, state: rest.getState(), error: r.error }; } catch (e) { return { success: false, error: e.message }; }
    });
    handle('start-api-server-with-password', async (_e, passwordPlain) => {
      try { const r = await rest.startWithPassword(handlers, String(passwordPlain || '')); return { success: !!r.ok, state: rest.getState(), error: r.error }; }
      catch (e) { return { success: false, error: e.message }; }
    });
  }

  if (extra.register) { try { extra.register(ipcMain); } catch { } }

  // ── Auto-update ─────────────────────────────────────────────────────────────
  const { checkForUpdate, downloadAndInstall } = require('../services/UpdateService');

  handle('update:check', async () => {
    try {
      return await checkForUpdate();
    } catch (e) {
      return { hasUpdate: false, error: e?.message };
    }
  });

  handle('update:install', async (_e, release) => {
    try {
      appendLog('system', `[Update] Downloading v${release?.version}...`);
      await downloadAndInstall(release);
      return { success: true };
    } catch (e) {
      appendLog('system', `[Update] Download failed: ${e?.message}`);
      return { success: false, error: e?.message };
    }
  });
}

module.exports = { registerIpcHandlers };
