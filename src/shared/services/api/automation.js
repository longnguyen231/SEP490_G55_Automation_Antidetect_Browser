// Automation API Service

import { API_ENDPOINTS } from '@utils/constants';

export class AutomationApi {
  constructor(client) {
    this.client = client;
  }

  /**
   * Get all automation scripts
   */
  async getScripts() {
    return this.client.get(`${API_ENDPOINTS.AUTOMATION}/scripts`);
  }

  /**
   * Get single script
   */
  async getScript(id) {
    return this.client.get(`${API_ENDPOINTS.AUTOMATION}/scripts/${id}`);
  }

  /**
   * Create new script
   */
  async createScript(script) {
    return this.client.post(`${API_ENDPOINTS.AUTOMATION}/scripts`, script);
  }

  /**
   * Update script
   */
  async updateScript(id, updates) {
    return this.client.put(`${API_ENDPOINTS.AUTOMATION}/scripts/${id}`, updates);
  }

  /**
   * Delete script
   */
  async deleteScript(id) {
    return this.client.delete(`${API_ENDPOINTS.AUTOMATION}/scripts/${id}`);
  }

  /**
   * Run automation on profile
   */
  async runAutomation(profileId, steps) {
    return this.client.post(`/api/profiles/${profileId}/automation/run`, { steps });
  }

  /**
   * Run script on profiles
   */
  async runScript(scriptId, profileIds = []) {
    return this.client.post(
      `${API_ENDPOINTS.AUTOMATION}/scripts/${scriptId}/run`,
      { profileIds }
    );
  }

  /**
   * Stop running script
   */
  async stopScript(scriptId) {
    return this.client.post(`${API_ENDPOINTS.AUTOMATION}/scripts/${scriptId}/stop`);
  }

  /**
   * Get script execution history
   */
  async getScriptHistory(scriptId) {
    return this.client.get(`${API_ENDPOINTS.AUTOMATION}/scripts/${scriptId}/history`);
  }

  /**
   * Execute profile action
   */
  async executeAction(profileId, action, params = {}) {
    return this.client.post(`/api/profiles/${profileId}/action`, {
      action,
      params
    });
  }
}
