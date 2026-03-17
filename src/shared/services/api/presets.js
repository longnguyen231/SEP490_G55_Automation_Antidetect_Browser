// Presets API Service

export class PresetsApi {
  constructor(client) {
    this.client = client;
  }

  /**
   * Get all presets
   */
  async getPresets() {
    return this.client.get('/api/presets');
  }

  /**
   * Get single preset
   */
  async getPreset(id) {
    return this.client.get(`/api/presets/${id}`);
  }

  /**
   * Create preset
   */
  async createPreset(preset) {
    return this.client.post('/api/presets', preset);
  }

  /**
   * Update preset
   */
  async updatePreset(id, updates) {
    return this.client.put(`/api/presets/${id}`, updates);
  }

  /**
   * Delete preset
   */
  async deletePreset(id) {
    return this.client.delete(`/api/presets/${id}`);
  }
}
