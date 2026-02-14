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
  getLocalesTimezones: () => ipcRenderer.invoke('get-locales-timezones'),
  getProfileWs: (profileId) => ipcRenderer.invoke('get-profile-ws', profileId),
  getRunningMap: () => ipcRenderer.invoke('get-running-map'),
  stopProfile: (profileId) => ipcRenderer.invoke('stop-profile', profileId),
  stopAllProfiles: () => ipcRenderer.invoke('stop-all-profiles'),
  getProfileLog: (profileId) => ipcRenderer.invoke('get-profile-log', profileId),
  cloneProfile: (profileId, overrides) => ipcRenderer.invoke('clone-profile', profileId, overrides),
  runAutomationNow: (profileId) => ipcRenderer.invoke('run-automation-now', profileId),
  onRunningMapChanged: (callback) => {
    const listener = (_event, payload) => callback && callback(payload);
    ipcRenderer.on('running-map-changed', listener);
    return () => ipcRenderer.removeListener('running-map-changed', listener);
  },
  removeAllRunningMapChanged: () => ipcRenderer.removeAllListeners('running-map-changed'),

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

  // Scripts
  listScripts: () => ipcRenderer.invoke('scripts-list'),
  getScript: (id) => ipcRenderer.invoke('scripts-get', id),
  saveScript: (script) => ipcRenderer.invoke('scripts-save', script),
  deleteScript: (id) => ipcRenderer.invoke('scripts-delete', id),
  executeScript: (profileId, scriptId, opts) => ipcRenderer.invoke('scripts-execute', profileId, scriptId, opts || {}),
});
