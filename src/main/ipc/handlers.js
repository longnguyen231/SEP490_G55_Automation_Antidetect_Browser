const { ipcMain, shell } = require('electron');
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
const { getProfilesInternal, saveProfileInternal, deleteProfileInternal, cloneProfileInternal } = require('../storage/profiles');
const { loadSettings, saveSettings } = require('../storage/settings');
const { listPresetsInternal, addPresetInternal, deletePresetInternal } = require('../storage/presets');
const { performAction } = require('../engine/actions');
const { listScriptsInternal, getScriptInternal, saveScriptInternal, deleteScriptInternal } = require('../storage/scripts');
const { addTaskLog, getTaskLogs, getTaskLogById, deleteTaskLog, clearTaskLogs } = require('../storage/taskLogs');
const { listModules, installModule, uninstallModule } = require('../storage/scriptModules');
const { executeScript, stopScript, pauseScript, resumeScript, isScriptRunning } = require('../engine/scriptRuntime');
const {
  getProxiesInternal, getProxyByIdInternal,
  createProxyInternal, updateProxyInternal,
  deleteProxyInternal, deleteProxiesBulkInternal,
  importProxiesInternal, exportProxiesInternal,
} = require('../storage/proxies');
const { checkProxy, checkProxiesBatch } = require('../services/ProxyChecker');
const { getMachineCode, validateLicenseKey } = require('../services/machineId');
const { checkBrowserStatus, installBrowser, uninstallBrowser, reinstallBrowser } = require('../services/browserManagerService');

function registerIpcHandlers(extra = {}) {
  // Machine Code & License
  ipcMain.handle('get-machine-code', () => getMachineCode());
  ipcMain.handle('validate-license', (_e, key) => validateLicenseKey(key));
  ipcMain.handle('open-external', (_e, url) => shell.openExternal(url));

  // Browser Runtime Manager
  ipcMain.handle('browser-runtime-status', async (_e, name) => checkBrowserStatus(name));
  ipcMain.handle('browser-runtime-install', async (_e, name) => {
    appendLog('system', `Browser runtime: installing "${name}"...`);
    const r = await installBrowser(name);
    if (r?.success) appendLog('system', `Browser runtime: "${name}" installed OK`);
    else appendLog('system', `Browser runtime: install "${name}" failed — ${r?.error || 'unknown'}`);
    return r;
  });
  ipcMain.handle('browser-runtime-uninstall', async (_e, name) => {
    appendLog('system', `Browser runtime: uninstalling "${name}"`);
    const r = await uninstallBrowser(name);
    if (r?.success) appendLog('system', `Browser runtime: "${name}" uninstalled`);
    return r;
  });
  ipcMain.handle('browser-runtime-reinstall', async (_e, name) => {
    appendLog('system', `Browser runtime: reinstalling "${name}"...`);
    const r = await reinstallBrowser(name);
    if (r?.success) appendLog('system', `Browser runtime: "${name}" reinstalled OK`);
    else appendLog('system', `Browser runtime: reinstall "${name}" failed — ${r?.error || 'unknown'}`);
    return r;
  });

  ipcMain.handle('get-profiles', async () => await getProfilesInternal());
  ipcMain.handle('save-profile', async (_e, profile) => {
    const r = await saveProfileInternal(profile);
    if (r?.success) appendLog('system', `Profile saved: ${profile.name || profile.id}`);
    return r;
  });
  ipcMain.handle('delete-profile', async (_e, profileId) => {
    try { await stopProfileInternal(profileId); } catch { }
    const r = await deleteProfileInternal(profileId);
    if (r?.success) appendLog('system', `Profile deleted: ${profileId}`);
    return r;
  });
  ipcMain.handle('launch-profile', async (_e, profileId, options = {}) => {
    appendLog(profileId, `Profile launch requested (engine=${options.engine || 'default'}, headless=${!!options.headless})`);
    const r = await launchProfileInternal(profileId, options);
    if (!r?.success) appendLog(profileId, `Profile launch failed: ${r?.error || 'unknown'}`);
    return r;
  });
  ipcMain.handle('stop-profile', async (_e, profileId) => {
    appendLog(profileId, 'Profile stop requested');
    return await stopProfileInternal(profileId);
  });
  ipcMain.handle('stop-all-profiles', async () => {
    appendLog('system', 'Stop all profiles requested');
    return await stopAllProfilesInternal();
  });
  ipcMain.handle('get-profile-log', async (_e, profileId) => await getProfileLogInternal(profileId));
  ipcMain.handle('get-cookies', async (_e, profileId) => await getCookiesInternal(profileId));
  ipcMain.handle('import-cookies', async (_e, profileId, cookies) => {
    const r = await importCookiesInternal(profileId, cookies);
    if (r?.success) appendLog(profileId, `Cookies imported: ${Array.isArray(cookies) ? cookies.length : 0} cookie(s)`);
    else appendLog(profileId, `Cookies import failed: ${r?.error || 'unknown'}`);
    return r;
  });
  ipcMain.handle('delete-cookie', async (_e, profileId, cookie) => {
    const r = await deleteCookieInternal(profileId, cookie);
    if (r?.success) appendLog(profileId, `Cookie deleted: ${cookie?.name} (${cookie?.domain})`);
    return r;
  });
  ipcMain.handle('clear-cookies', async (_e, profileId) => {
    const r = await clearCookiesInternal(profileId);
    if (r?.success) appendLog(profileId, 'All cookies cleared');
    return r;
  });
  ipcMain.handle('edit-cookie', async (_e, profileId, cookie) => {
    const r = await editCookieInternal(profileId, cookie);
    if (r?.success) appendLog(profileId, `Cookie edited: ${cookie?.name} (${cookie?.domain})`);
    return r;
  });
  ipcMain.handle('get-profile-ws', async (_e, profileId) => await getProfileWsInternal(profileId));
  ipcMain.handle('get-running-map', async () => await getRunningMapInternal());
  ipcMain.handle('get-status-map', async () => getStatusMapInternal());
  ipcMain.handle('get-locales-timezones', async () => await getLocalesTimezonesInternal());
  ipcMain.handle('clone-profile', async (_e, sourceProfileId, overrides = {}) => {
    const r = await cloneProfileInternal(sourceProfileId, overrides);
    if (r?.success) appendLog('system', `Profile cloned: ${sourceProfileId} → ${r.profile?.id} "${r.profile?.name}"`);
    else appendLog('system', `Profile clone failed: ${r?.error || 'unknown'}`);
    return r;
  });

  // Automation
  ipcMain.handle('run-automation-now', async (_e, profileId) => await runAutomationNowInternal(profileId));

  // Generic action performer: (profileId, actionName, params)
  ipcMain.handle('profile-action', async (_e, profileId, actionName, params = {}) => {
    try { return await performAction(profileId, String(actionName), params || {}); }
    catch (e) { return { success: false, error: e?.message || String(e) }; }
  });

  // Presets management
  ipcMain.handle('presets-list', async () => await listPresetsInternal());
  ipcMain.handle('presets-add', async (_e, preset) => {
    const r = await addPresetInternal(preset || {});
    if (r?.success) appendLog('system', `Preset added: "${preset?.name || 'unnamed'}"`);
    return r;
  });
  ipcMain.handle('presets-delete', async (_e, id) => {
    const r = await deletePresetInternal(String(id));
    if (r?.success) appendLog('system', `Preset deleted: ${id}`);
    return r;
  });

  // Scripts management
  ipcMain.handle('scripts-list', async () => await listScriptsInternal());
  ipcMain.handle('scripts-get', async (_e, id) => await getScriptInternal(id));
  ipcMain.handle('scripts-save', async (_e, script) => {
    const r = await saveScriptInternal(script);
    if (r?.success) appendLog('system', `Script saved: "${script?.name || script?.id || 'unnamed'}"`);
    else appendLog('system', `Script save failed: ${r?.error || 'unknown'}`);
    return r;
  });
  ipcMain.handle('scripts-delete', async (_e, id) => {
    const r = await deleteScriptInternal(id);
    if (r?.success) appendLog('system', `Script deleted: ${id}`);
    return r;
  });
  ipcMain.handle('scripts-execute', async (_e, profileId, scriptId, opts) => {
    const startedAt = new Date().toISOString();
    try {
      const scriptResult = await getScriptInternal(scriptId);
      if (!scriptResult?.success || !scriptResult.script) {
        return { success: false, error: 'Script not found: ' + scriptId };
      }
      const code = scriptResult.script.code || '';
      const scriptName = scriptResult.script.name || scriptId;
      appendLog(profileId, `Script execute: "${scriptName}"`);

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

      const result = await executeScript(profileId, code, opts || {});
      const finishedAt = new Date().toISOString();
      if (result.success) {
        appendLog(profileId, `Script finished OK: "${scriptName}"`);
        await addTaskLog({ scriptId, scriptName, profileId, status: 'completed', startedAt, finishedAt, logs: result.logs || [] });
      } else {
        appendLog(profileId, `Script error: ${result.error}`);
        await addTaskLog({ scriptId, scriptName, profileId, status: 'error', startedAt, finishedAt, logs: result.logs || [], error: result.error });
      }
      return result;
    }
    catch (e) {
      await addTaskLog({ scriptId, scriptName: scriptId, profileId, status: 'error', startedAt, finishedAt: new Date().toISOString(), logs: [], error: e?.message || String(e) });
      return { success: false, error: e?.message || String(e) };
    }
  });

  // Script execution control
  ipcMain.handle('script-stop', (_e, profileId) => {
    stopScript(profileId);
    return { success: true };
  });
  ipcMain.handle('script-pause', (_e, profileId) => {
    pauseScript(profileId);
    return { success: true };
  });
  ipcMain.handle('script-resume', (_e, profileId) => {
    resumeScript(profileId);
    return { success: true };
  });
  ipcMain.handle('script-is-running', (_e, profileId) => {
    return { running: isScriptRunning(profileId) };
  });

  // Task logs
  ipcMain.handle('task-logs-list', async () => getTaskLogs());
  ipcMain.handle('task-logs-get', async (_e, id) => getTaskLogById(id));
  ipcMain.handle('task-logs-delete', async (_e, id) => {
    const r = await deleteTaskLog(id);
    if (r?.success) appendLog('system', `Task log deleted: ${id}`);
    return r;
  });
  ipcMain.handle('task-logs-clear', async () => {
    const r = await clearTaskLogs();
    if (r?.success) appendLog('system', 'All task logs cleared');
    return r;
  });

  // Script modules (npm packages)
  ipcMain.handle('script-modules-list', async () => {
    try { return { success: true, modules: listModules() }; }
    catch (e) { return { success: false, error: e.message }; }
  });
  ipcMain.handle('script-modules-install', async (_e, packageName) => {
    try { return await installModule(packageName); }
    catch (e) { return { success: false, error: e.message }; }
  });
  ipcMain.handle('script-modules-uninstall', async (_e, packageName) => {
    try { return await uninstallModule(packageName); }
    catch (e) { return { success: false, error: e.message }; }
  });

  // Proxy management
  ipcMain.handle('proxy-get-all', async () => await getProxiesInternal());
  ipcMain.handle('proxy-get-by-id', async (_e, id) => await getProxyByIdInternal(id));
  ipcMain.handle('proxy-create', async (_e, data) => {
    const r = await createProxyInternal(data);
    if (r?.success) appendLog('system', `Proxy created: "${data?.name || data?.host || 'unnamed'}"`);
    else appendLog('system', `Proxy create failed: ${r?.error || 'unknown'}`);
    return r;
  });
  ipcMain.handle('proxy-update', async (_e, id, data) => await updateProxyInternal(id, data));
  ipcMain.handle('proxy-delete', async (_e, id) => {
    const r = await deleteProxyInternal(id);
    if (r?.success) appendLog('system', `Proxy deleted: ${id}`);
    return r;
  });
  ipcMain.handle('proxy-delete-bulk', async (_e, ids) => await deleteProxiesBulkInternal(ids));
  ipcMain.handle('proxy-import', async (_e, text, format) => {
    const r = await importProxiesInternal(text, format);
    if (r?.success) appendLog('system', `Proxies imported: ${r?.count || 0} item(s)`);
    else appendLog('system', `Proxy import failed: ${r?.error || 'unknown'}`);
    return r;
  });
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

  // Proxy Rotator (from huy branch)
  ipcMain.handle('proxy-rotate', async (_e, id) => {
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

  ipcMain.handle('proxy-rotate-url', async (_e, url) => {
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

  // Settings direct save (optional future use)
  ipcMain.handle('load-settings', async () => {
    try { const s = loadSettings(); return { success: true, settings: s || {} }; }
    catch (e) { return { success: false, error: e?.message || String(e) }; }
  });
  ipcMain.handle('save-settings', async (_e, partial) => {
    const current = loadSettings();
    const ok = saveSettings({ ...current, ...partial });
    if (ok) appendLog('system', `Settings saved (keys: ${Object.keys(partial || {}).join(', ') || 'none'})`);
    else appendLog('system', 'Settings save failed');
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
