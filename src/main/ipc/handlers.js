const { ipcMain, shell } = require('electron');
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
  getLocalesTimezonesInternal,
  runAutomationNowInternal,
} = require('../controllers/profiles');
const { getProfilesInternal, saveProfileInternal, deleteProfileInternal, cloneProfileInternal } = require('../storage/profiles');
const { loadSettings, saveSettings } = require('../storage/settings');
const { listPresetsInternal, addPresetInternal, deletePresetInternal } = require('../storage/presets');
const { performAction } = require('../engine/actions');
const { listScriptsInternal, getScriptInternal, saveScriptInternal, deleteScriptInternal } = require('../storage/scripts');
const { addTaskLog, getTaskLogs, getTaskLogById, clearTaskLogs } = require('../storage/taskLogs');
const { executeScript } = require('../engine/scriptRuntime');
const {
  getProxiesInternal, getProxyByIdInternal,
  createProxyInternal, updateProxyInternal,
  deleteProxyInternal, deleteProxiesBulkInternal,
  importProxiesInternal, exportProxiesInternal,
} = require('../storage/proxies');
const { checkProxy, checkProxiesBatch } = require('../services/ProxyChecker');

function registerIpcHandlers(extra = {}) {
  ipcMain.handle('get-profiles', async () => await getProfilesInternal());
  ipcMain.handle('save-profile', async (_e, profile) => await saveProfileInternal(profile));
  ipcMain.handle('delete-profile', async (_e, profileId) => {
    try { await stopProfileInternal(profileId); } catch { }
    return await deleteProfileInternal(profileId);
  });
  ipcMain.handle('launch-profile', async (_e, profileId, options = {}) => await launchProfileInternal(profileId, options));
  ipcMain.handle('stop-profile', async (_e, profileId) => await stopProfileInternal(profileId));
  ipcMain.handle('stop-all-profiles', async () => await stopAllProfilesInternal());
  ipcMain.handle('get-profile-log', async (_e, profileId) => await getProfileLogInternal(profileId));
  ipcMain.handle('get-cookies', async (_e, profileId) => await getCookiesInternal(profileId));
  ipcMain.handle('import-cookies', async (_e, profileId, cookies) => await importCookiesInternal(profileId, cookies));
  ipcMain.handle('delete-cookie', async (_e, profileId, cookie) => await deleteCookieInternal(profileId, cookie));
  ipcMain.handle('clear-cookies', async (_e, profileId) => await clearCookiesInternal(profileId));
  ipcMain.handle('edit-cookie', async (_e, profileId, cookie) => await editCookieInternal(profileId, cookie));
  ipcMain.handle('get-profile-ws', async (_e, profileId) => await getProfileWsInternal(profileId));
  ipcMain.handle('get-running-map', async () => await getRunningMapInternal());
  ipcMain.handle('get-locales-timezones', async () => await getLocalesTimezonesInternal());
  ipcMain.handle('clone-profile', async (_e, sourceProfileId, overrides = {}) => await cloneProfileInternal(sourceProfileId, overrides));

  // Automation
  ipcMain.handle('run-automation-now', async (_e, profileId) => await runAutomationNowInternal(profileId));

  // Generic action performer: (profileId, actionName, params)
  ipcMain.handle('profile-action', async (_e, profileId, actionName, params = {}) => {
    try { return await performAction(profileId, String(actionName), params || {}); }
    catch (e) { return { success: false, error: e?.message || String(e) }; }
  });

  // Presets management
  ipcMain.handle('presets-list', async () => await listPresetsInternal());
  ipcMain.handle('presets-add', async (_e, preset) => await addPresetInternal(preset || {}));
  ipcMain.handle('presets-delete', async (_e, id) => await deletePresetInternal(String(id)));

  
  // Proxy management
  ipcMain.handle('proxy-get-all', async () => await getProxiesInternal());
  ipcMain.handle('proxy-get-by-id', async (_e, id) => await getProxyByIdInternal(id));
  ipcMain.handle('proxy-create', async (_e, data) => await createProxyInternal(data));
  ipcMain.handle('proxy-update', async (_e, id, data) => await updateProxyInternal(id, data));
  ipcMain.handle('proxy-delete', async (_e, id) => await deleteProxyInternal(id));
  ipcMain.handle('proxy-delete-bulk', async (_e, ids) => await deleteProxiesBulkInternal(ids));
  ipcMain.handle('proxy-import', async (_e, text, format) => await importProxiesInternal(text, format));
  ipcMain.handle('proxy-export', async (_e, ids) => await exportProxiesInternal(ids));

  // Proxy checker
  ipcMain.handle('proxy-check', async (_e, cfg) => {
    try { return await checkProxy(cfg); }
    catch (e) { return { success: false, alive: false, error: e?.message || String(e) }; }
  });
  ipcMain.handle('proxy-check-all', async () => {
    try {
      const proxies = await getProxiesInternal();
      const results = {};
      await checkProxiesBatch(proxies, (id, result) => {
        results[id] = result;
        // Update proxy status in storage
        try {
          updateProxyInternal(id, {
            status: result.alive ? 'alive' : 'dead',
            latency: result.latency || null,
            lastChecked: new Date().toISOString(),
            country: result.countryCode || '',
          }).catch(() => {});
        } catch {}
      });
      return { success: true, results };
    } catch (e) { return { success: false, error: e?.message || String(e) }; }
  });

  // Fingerprint generator
  ipcMain.handle('generate-fingerprint', async (_e, opts = {}) => {
    try {
      const { generateFingerprint } = require('../engine/fingerprintGenerator');
      return { success: true, ...generateFingerprint(opts) };
    } catch (e) { return { success: false, error: e?.message || String(e) }; }
  });
  ipcMain.handle('generate-fingerprint-batch', async (_e, count = 1, opts = {}) => {
    try {
      const { generateBatch } = require('../engine/fingerprintGenerator');
      const results = generateBatch(Math.min(50, Math.max(1, count)), opts);
      return { success: true, fingerprints: results };
    } catch (e) { return { success: false, error: e?.message || String(e) }; }
  });

  // Behavior simulator (for running Playwright profiles)
  ipcMain.handle('simulate-behavior', async (_e, profileId, action = 'browse', opts = {}) => {
    try {
      const { runningProfiles } = require('../state/runtime');
      const running = runningProfiles.get(profileId);
      if (!running) return { success: false, error: 'Profile not running' };
      if (running.engine !== 'playwright' || !running.context) {
        return { success: false, error: 'Behavior simulation requires Playwright engine' };
      }
      const pages = running.context.pages();
      const page = pages[opts.pageIndex || 0] || pages[0];
      if (!page) return { success: false, error: 'No page available' };

      const behavior = require('../engine/behaviorSimulator');
      const seed = (profileId || '').split('').reduce((h, c) => ((h << 5) - h) + c.charCodeAt(0), 0);
      const rng = behavior.createRng(Math.abs(seed) + Date.now());

      switch (action) {
        case 'browse': await behavior.simulateBrowsing(page, rng, opts); break;
        case 'scroll': await behavior.naturalScroll(page, rng, opts); break;
        case 'click': await behavior.humanClick(page, rng, opts.selector, opts); break;
        case 'type': await behavior.humanType(page, rng, opts.selector, opts.text, opts); break;
        case 'idle': await behavior.simulateIdle(page, rng, opts); break;
        case 'move': await behavior.moveMouseCurved(page, rng, opts.x || 500, opts.y || 300, opts); break;
        default: return { success: false, error: `Unknown action: ${action}` };
      }
      return { success: true, action };
    } catch (e) { return { success: false, error: e?.message || String(e) }; }
  });

  // Blocked page detection
  ipcMain.handle('detect-blocked-page', async (_e, profileId) => {
    try {
      const { runningProfiles } = require('../state/runtime');
      const running = runningProfiles.get(profileId);
      if (!running) return { success: false, error: 'Profile not running' };
      let page;
      if (running.engine === 'playwright' && running.context) {
        page = running.context.pages()[0];
      } else if (running.cdpControl?.context) {
        page = running.cdpControl.context.pages()[0];
      }
      if (!page) return { success: false, error: 'No page available' };
      const { detectBlockedPage } = require('../engine/blockedPageDetector');
      const result = await detectBlockedPage(page);
      return { success: true, ...result };
    } catch (e) { return { success: false, error: e?.message || String(e) }; }
  });

  // Settings direct save (optional future use)
  ipcMain.handle('load-settings', async () => {
    try { const s = loadSettings(); return { success: true, settings: s || {} }; }
    catch (e) { return { success: false, error: e?.message || String(e) }; }
  });
  ipcMain.handle('save-settings', async (_e, partial) => {
    const current = loadSettings();
    const ok = saveSettings({ ...current, ...partial });
    return { success: ok };
  });

  // Open external link
  ipcMain.handle('open-external', async (_e, url) => {
    try { await shell.openExternal(String(url)); return { success: true }; }
    catch (e) { return { success: false, error: e?.message || String(e) }; }
  });

  // REST API server control handlers if restServer provided
  if (extra.restServer) {
    const rest = extra.restServer;
    const handlers = extra.handlers || {};
    ipcMain.handle('get-api-server-status', async () => {
      try { return { success: true, state: rest.getState() }; } catch (e) { return { success: false, error: e.message }; }
    });
    ipcMain.handle('set-api-server-enabled', async (_e, enabled) => {
      try { const r = await rest.setEnabled(!!enabled, handlers); return { success: !!r.ok, state: rest.getState(), error: r.error }; } catch (e) { return { success: false, error: e.message }; }
    });
    ipcMain.handle('set-api-server-port', async (_e, port) => {
      try { const r = await rest.setPort(Number(port), handlers); return { success: !!r.ok, state: rest.getState(), error: r.error }; } catch (e) { return { success: false, error: e.message }; }
    });
    ipcMain.handle('restart-api-server', async () => {
      try { await rest.stop(); const r = await rest.start(handlers); return { success: !!r.ok, state: rest.getState(), error: r.error }; } catch (e) { return { success: false, error: e.message }; }
    });
    ipcMain.handle('start-api-server-with-password', async (_e, passwordPlain) => {
      try { const r = await rest.startWithPassword(handlers, String(passwordPlain || '')); return { success: !!r.ok, state: rest.getState(), error: r.error }; }
      catch (e) { return { success: false, error: e.message }; }
    });
  }

  if (extra.register) { try { extra.register(ipcMain); } catch { } }
}

module.exports = { registerIpcHandlers };
