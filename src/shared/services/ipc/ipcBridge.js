// IPC Bridge - Wraps Electron IPC as API-like interface

/**
 * IPC Client that bridges Electron IPC to look like REST API
 */
export class IpcBridge {
  constructor() {
    this.electronAPI = window.electronAPI;
    
    if (!this.electronAPI) {
      throw new Error('Electron API not available. Are you running in Electron?');
    }
  }

  /**
   * Check if IPC is available
   */
  static isAvailable() {
    return !!(window.electronAPI && typeof window.electronAPI === 'object');
  }

  /**
   * Generic invoke wrapper
   */
  async invoke(channel, ...args) {
    if (!this.electronAPI[channel]) {
      throw new Error(`IPC channel '${channel}' not available`);
    }
    
    try {
      const result = await this.electronAPI[channel](...args);
      
      // Handle error responses from IPC
      if (result && result.error) {
        throw new Error(result.error);
      }
      
      return result;
    } catch (error) {
      throw new Error(`IPC Error [${channel}]: ${error.message}`);
    }
  }

  /**
   * Subscribe to IPC event
   */
  on(channel, callback) {
    const handlerName = `on${channel.charAt(0).toUpperCase()}${channel.slice(1)}`;
    
    if (!this.electronAPI[handlerName]) {
      console.warn(`IPC event handler '${handlerName}' not available`);
      return () => {};
    }
    
    return this.electronAPI[handlerName](callback);
  }

  /**
   * Remove event listener
   */
  off(channel) {
    const handlerName = `removeAll${channel.charAt(0).toUpperCase()}${channel.slice(1)}`;
    
    if (this.electronAPI[handlerName]) {
      this.electronAPI[handlerName]();
    }
  }

  // ========== Profile Methods ==========

  async getProfiles() {
    return this.invoke('getProfiles');
  }

  async saveProfile(profile) {
    return this.invoke('saveProfile', profile);
  }

  async deleteProfile(profileId) {
    return this.invoke('deleteProfile', profileId);
  }

  async cloneProfile(profileId) {
    return this.invoke('cloneProfile', profileId);
  }

  async launchProfile(profileId, options = {}) {
    return this.invoke('launchProfile', profileId, options);
  }

  async stopProfile(profileId) {
    return this.invoke('stopProfile', profileId);
  }

  async stopAllProfiles() {
    return this.invoke('stopAllProfiles');
  }

  async getProfileLog(profileId) {
    return this.invoke('getProfileLog', profileId);
  }

  async getRunningProfiles() {
    return this.invoke('getRunningMap');
  }

  // ========== Automation Methods ==========

  async runAutomation(profileId, steps) {
    return this.invoke('runAutomationNow', profileId, steps);
  }

  async executeAction(profileId, action, params) {
    return this.invoke('profileAction', profileId, action, params);
  }

  async getScripts() {
    return this.invoke('getScripts');
  }

  async saveScript(script) {
    return this.invoke('saveScript', script);
  }

  async deleteScript(scriptId) {
    return this.invoke('deleteScript', scriptId);
  }

  // ========== Cookie Methods ==========

  async getCookies(profileId) {
    return this.invoke('getCookies', profileId);
  }

  async setCookies(profileId, cookies) {
    return this.invoke('setCookies', profileId, cookies);
  }

  // ========== Settings Methods ==========

  async getSettings() {
    return this.invoke('loadSettings');
  }

  async saveSettings(settings) {
    return this.invoke('saveSettings', settings);
  }

  async getApiServerStatus() {
    return this.invoke('getApiServerStatus');
  }

  async enableApiServer(enable) {
    return this.invoke('enableApiServer', enable);
  }

  async changeApiPort(port) {
    return this.invoke('changeApiPort', port);
  }

  async startApiWithPassword(password) {
    return this.invoke('startApiWithPassword', password);
  }

  // ========== Presets Methods ==========

  async getPresets() {
    return this.invoke('getPresets');
  }

  async savePreset(preset) {
    return this.invoke('savePreset', preset);
  }

  async deletePreset(presetId) {
    return this.invoke('deletePreset', presetId);
  }

  // ========== Event Subscriptions ==========

  onRunningMapChanged(callback) {
    return this.on('runningMapChanged', callback);
  }

  onApiServerStatus(callback) {
    return this.on('apiServerStatus', callback);
  }

  offRunningMapChanged() {
    this.off('runningMapChanged');
  }

  offApiServerStatus() {
    this.off('apiServerStatus');
  }
}

/**
 * API Client adapter that uses IPC instead of HTTP
 */
export class IpcApiClient {
  constructor() {
    this.ipc = new IpcBridge();
  }

  async get(endpoint) {
    // Map REST endpoints to IPC methods
    if (endpoint === '/api/profiles') {
      return this.ipc.getProfiles();
    }
    if (endpoint === '/api/running-map') {
      return this.ipc.getRunningProfiles();
    }
    if (endpoint === '/api/settings') {
      return this.ipc.getSettings();
    }
    if (endpoint === '/api/presets') {
      return this.ipc.getPresets();
    }
    if (endpoint === '/api/automation/scripts') {
      return this.ipc.getScripts();
    }
    
    // Profile specific endpoints
    const profileMatch = endpoint.match(/^\/api\/profiles\/([^\/]+)$/);
    if (profileMatch) {
      const profiles = await this.ipc.getProfiles();
      return profiles.find(p => p.id === profileMatch[1]);
    }
    
    throw new Error(`IPC GET not implemented for: ${endpoint}`);
  }

  async post(endpoint, data) {
    // Profile endpoints
    if (endpoint === '/api/profiles') {
      return this.ipc.saveProfile(data);
    }
    
    const launchMatch = endpoint.match(/^\/api\/profiles\/([^\/]+)\/launch$/);
    if (launchMatch) {
      return this.ipc.launchProfile(launchMatch[1], data);
    }
    
    const stopMatch = endpoint.match(/^\/api\/profiles\/([^\/]+)\/stop$/);
    if (stopMatch) {
      return this.ipc.stopProfile(stopMatch[1]);
    }
    
    const automationMatch = endpoint.match(/^\/api\/profiles\/([^\/]+)\/automation\/run$/);
    if (automationMatch) {
      return this.ipc.runAutomation(automationMatch[1], data.steps);
    }
    
    throw new Error(`IPC POST not implemented for: ${endpoint}`);
  }

  async put(endpoint, data) {
    const profileMatch = endpoint.match(/^\/api\/profiles\/([^\/]+)$/);
    if (profileMatch) {
      return this.ipc.saveProfile({ id: profileMatch[1], ...data });
    }
    
    if (endpoint === '/api/settings') {
      return this.ipc.saveSettings(data);
    }
    
    throw new Error(`IPC PUT not implemented for: ${endpoint}`);
  }

  async delete(endpoint) {
    const profileMatch = endpoint.match(/^\/api\/profiles\/([^\/]+)$/);
    if (profileMatch) {
      return this.ipc.deleteProfile(profileMatch[1]);
    }
    
    throw new Error(`IPC DELETE not implemented for: ${endpoint}`);
  }
}
