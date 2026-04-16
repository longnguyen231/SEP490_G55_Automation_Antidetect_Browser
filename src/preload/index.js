const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  getProfiles: () => ipcRenderer.invoke('get-profiles'),
  saveProfile: (profile) => ipcRenderer.invoke('save-profile', profile),
  deleteProfile: (profileId) => ipcRenderer.invoke('delete-profile', profileId),
  launchProfile: (profileId, options) => ipcRenderer.invoke('launch-profile', profileId, options || {}),
  getCookies: (profileId) => ipcRenderer.invoke('get-cookies', profileId),
  importCookies: (profileId, cookies) => ipcRenderer.invoke('import-cookies', profileId, cookies),
  deleteCookie: (profileId, cookie) => ipcRenderer.invoke('delete-cookie', profileId, cookie),
  clearCookies: (profileId) => ipcRenderer.invoke('clear-cookies', profileId),
  editCookie: (profileId, cookie) => ipcRenderer.invoke('edit-cookie', profileId, cookie),
  getLocalesTimezones: () => ipcRenderer.invoke('get-locales-timezones'),
  getProfileWs: (profileId) => ipcRenderer.invoke('get-profile-ws', profileId),
  getRunningMap: () => ipcRenderer.invoke('get-running-map'),
  getStatusMap: () => ipcRenderer.invoke('get-status-map'),
  stopProfile: (profileId) => ipcRenderer.invoke('stop-profile', profileId),
  stopAllProfiles: () => ipcRenderer.invoke('stop-all-profiles'),
  getProfileLog: (profileId) => ipcRenderer.invoke('get-profile-log', profileId),
  cloneProfile: (profileId, overrides) => ipcRenderer.invoke('clone-profile', profileId, overrides),
  saveProfilesBulk: (profiles) => ipcRenderer.invoke('save-profiles-bulk', profiles),
  deleteProfilesBulk: (ids) => ipcRenderer.invoke('delete-profiles-bulk', ids),
  cloneProfilesBulk: (sourceIds, overrides) => ipcRenderer.invoke('clone-profiles-bulk', sourceIds, overrides || {}),
  runAutomationNow: (profileId) => ipcRenderer.invoke('run-automation-now', profileId),
  onRunningMapChanged: (callback) => {
    const listener = (_event, payload) => callback && callback(payload);
    ipcRenderer.on('running-map-changed', listener);
    return () => ipcRenderer.removeListener('running-map-changed', listener);
  },
  removeAllRunningMapChanged: () => ipcRenderer.removeAllListeners('running-map-changed'),

  onProfilesUpdated: (callback) => {
    const listener = () => callback && callback();
    ipcRenderer.on('profiles-updated', listener);
    return () => ipcRenderer.removeListener('profiles-updated', listener);
  },
  removeAllProfilesUpdated: () => ipcRenderer.removeAllListeners('profiles-updated'),

  // Open external links in default browser (via main)
  openExternal: (url) => ipcRenderer.invoke('open-external', url),

  // REST API server controls
  getApiServerStatus: () => ipcRenderer.invoke('get-api-server-status'),
  setApiServerEnabled: (enabled) => ipcRenderer.invoke('set-api-server-enabled', !!enabled),
  setApiServerPort: (port) => ipcRenderer.invoke('set-api-server-port', port),
  restartApiServer: () => ipcRenderer.invoke('restart-api-server'),
  startApiServerWithPassword: (password) => ipcRenderer.invoke('start-api-server-with-password', password),
  onApiServerStatus: (callback) => {
    const listener = (_event, payload) => callback && callback(payload);
    ipcRenderer.on('api-server-status', listener);
    return () => ipcRenderer.removeListener('api-server-status', listener);
  },
  removeAllApiServerStatus: () => ipcRenderer.removeAllListeners('api-server-status'),

  // Presets
  listPresets: () => ipcRenderer.invoke('presets-list'),
  addPreset: (preset) => ipcRenderer.invoke('presets-add', preset),
  deletePreset: (id) => ipcRenderer.invoke('presets-delete', id),

  // App settings (language, etc.)
  loadSettings: () => ipcRenderer.invoke('load-settings'),
  saveSettings: (partial) => ipcRenderer.invoke('save-settings', partial),

  // Machine License
  getMachineCode: () => ipcRenderer.invoke('get-machine-code'),
  validateLicense: (key) => ipcRenderer.invoke('validate-license', key),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),

  // Scripts
  listScripts: () => ipcRenderer.invoke('scripts-list'),
  getScript: (id) => ipcRenderer.invoke('scripts-get', id),
  saveScript: (script) => ipcRenderer.invoke('scripts-save', script),
  deleteScript: (id) => ipcRenderer.invoke('scripts-delete', id),
  executeScript: (profileId, scriptId, opts) => ipcRenderer.invoke('scripts-execute', profileId, scriptId, opts || {}),
  stopScript: (profileId) => ipcRenderer.invoke('script-stop', profileId),
  pauseScript: (profileId) => ipcRenderer.invoke('script-pause', profileId),
  resumeScript: (profileId) => ipcRenderer.invoke('script-resume', profileId),
  isScriptRunning: (profileId) => ipcRenderer.invoke('script-is-running', profileId),
  getTaskLogs: () => ipcRenderer.invoke('task-logs-list'),
  getTaskLog: (id) => ipcRenderer.invoke('task-logs-get', id),
  deleteTaskLog: (id) => ipcRenderer.invoke('task-logs-delete', id),
  clearTaskLogs: () => ipcRenderer.invoke('task-logs-clear'),

  // Proxy management
  getProxies: () => ipcRenderer.invoke('proxy-get-all'),
  getProxyById: (id) => ipcRenderer.invoke('proxy-get-by-id', id),
  createProxy: (data) => ipcRenderer.invoke('proxy-create', data),
  updateProxy: (id, data) => ipcRenderer.invoke('proxy-update', id, data),
  deleteProxy: (id) => ipcRenderer.invoke('proxy-delete', id),
  deleteProxiesBulk: (ids) => ipcRenderer.invoke('proxy-delete-bulk', ids),
  importProxies: (text, format) => ipcRenderer.invoke('proxy-import', text, format),
  exportProxies: (ids) => ipcRenderer.invoke('proxy-export', ids),
  checkProxy: (cfg) => ipcRenderer.invoke('proxy-check', cfg),
  checkAllProxies: () => ipcRenderer.invoke('proxy-check-all'),
  rotateProxy: (id) => ipcRenderer.invoke('proxy-rotate', id),
  rotateProxyByUrl: (url) => ipcRenderer.invoke('proxy-rotate-url', url),

  // Browser Runtimes
  checkBrowserStatus: (name) => ipcRenderer.invoke('browser-runtime-status', name),
  installBrowser: (name) => ipcRenderer.invoke('browser-runtime-install', name),
  uninstallBrowser: (name) => ipcRenderer.invoke('browser-runtime-uninstall', name),
  reinstallBrowser: (name) => ipcRenderer.invoke('browser-runtime-reinstall', name),
  onBrowserProgress: (callback) => {
    const listener = (_e, data) => callback(data);
    ipcRenderer.on('browser-runtime-progress', listener);
    return () => ipcRenderer.removeListener('browser-runtime-progress', listener);
  },
  onBrowserInstallProgress: (callback) => {
    const listener = (_e, data) => callback(data);
    ipcRenderer.on('browser-runtime-progress', listener);
    return () => ipcRenderer.removeListener('browser-runtime-progress', listener);
  },
  removeAllBrowserProgress: () => ipcRenderer.removeAllListeners('browser-runtime-progress'),

  // Script modules (npm packages for automation)
  listScriptModules: () => ipcRenderer.invoke('script-modules-list'),
  installScriptModule: (packageName) => ipcRenderer.invoke('script-modules-install', packageName),
  uninstallScriptModule: (packageName) => ipcRenderer.invoke('script-modules-uninstall', packageName),

  // Application logs stream from main process
  onAppLog: (callback) => {
    const listener = (_event, payload) => callback && callback(payload);
    ipcRenderer.on('app-log', listener);
    return () => ipcRenderer.removeListener('app-log', listener);
  },
  removeAllAppLog: () => ipcRenderer.removeAllListeners('app-log'),

  // Backend ready signal — fired when all IPC handlers are registered
  onBackendReady: (callback) => {
    const listener = (_event, ready) => callback && callback(ready);
    ipcRenderer.on('backend-ready', listener);
    return () => ipcRenderer.removeListener('backend-ready', listener);
  },
  // Live preview screencast controls
  startPreview: (profileId) => ipcRenderer.invoke('start-preview', profileId),
  stopPreview: (profileId) => ipcRenderer.invoke('stop-preview', profileId),
  getScreencastStatus: (profileId) => ipcRenderer.invoke('screencast-status', profileId),
});
