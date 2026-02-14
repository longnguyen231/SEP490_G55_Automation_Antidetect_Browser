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
const { executeScript } = require('../engine/scriptRuntime');

function registerIpcHandlers(extra = {}) {
  ipcMain.handle('get-profiles', async () => await getProfilesInternal());
  ipcMain.handle('save-profile', async (_e, profile) => await saveProfileInternal(profile));
  ipcMain.handle('delete-profile', async (_e, profileId) => {
    try { await stopProfileInternal(profileId); } catch {}
    return await deleteProfileInternal(profileId);
  });
  ipcMain.handle('launch-profile', async (_e, profileId, options = {}) => await launchProfileInternal(profileId, options));
  ipcMain.handle('stop-profile', async (_e, profileId) => await stopProfileInternal(profileId));
  ipcMain.handle('stop-all-profiles', async () => await stopAllProfilesInternal());
  ipcMain.handle('get-profile-log', async (_e, profileId) => await getProfileLogInternal(profileId));
  ipcMain.handle('get-cookies', async (_e, profileId) => await getCookiesInternal(profileId));
  ipcMain.handle('import-cookies', async (_e, profileId, cookies) => await importCookiesInternal(profileId, cookies));
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

  // Scripts CRUD
  ipcMain.handle('scripts-list', async () => await listScriptsInternal());
  ipcMain.handle('scripts-get', async (_e, id) => await getScriptInternal(String(id)));
  ipcMain.handle('scripts-save', async (_e, script) => await saveScriptInternal(script || {}));
  ipcMain.handle('scripts-delete', async (_e, id) => await deleteScriptInternal(String(id)));
  ipcMain.handle('scripts-execute', async (_e, profileId, scriptId, opts = {}) => {
    try {
      const g = await getScriptInternal(String(scriptId));
      if (!g.success) return g;
      return await executeScript(String(profileId), String(g.script.code || ''), { timeoutMs: Number(opts.timeoutMs || 120000) });
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

  if (extra.register) { try { extra.register(ipcMain); } catch {} }
}

module.exports = { registerIpcHandlers };
