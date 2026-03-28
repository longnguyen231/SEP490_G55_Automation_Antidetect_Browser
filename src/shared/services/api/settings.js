// Settings API Service

export class SettingsApi {
  constructor(client) {
    this.client = client;
  }

  /**
   * Get application settings
   */
  async getSettings() {
    return this.client.get('/api/settings');
  }

  /**
   * Update settings
   */
  async updateSettings(settings) {
    return this.client.put('/api/settings', settings);
  }

  /**
   * Get API server status
   */
  async getApiServerStatus() {
    return this.client.get('/api/server/status');
  }

  /**
   * Start API server
   */
  async startApiServer(config = {}) {
    return this.client.post('/api/server/start', config);
  }

  /**
   * Stop API server
   */
  async stopApiServer() {
    return this.client.post('/api/server/stop');
  }
}
