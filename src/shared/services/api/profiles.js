// Profiles API Service

import { API_ENDPOINTS } from '@utils/constants';

export class ProfilesApi {
  constructor(client) {
    this.client = client;
  }

  /**
   * Get all profiles
   */
  async getProfiles() {
    return this.client.get(API_ENDPOINTS.PROFILES);
  }

  /**
   * Get single profile by ID
   */
  async getProfile(id) {
    return this.client.get(`${API_ENDPOINTS.PROFILES}/${id}`);
  }

  /**
   * Create new profile
   */
  async createProfile(profile) {
    return this.client.post(API_ENDPOINTS.PROFILES, profile);
  }

  /**
   * Update existing profile
   */
  async updateProfile(id, updates) {
    return this.client.put(`${API_ENDPOINTS.PROFILES}/${id}`, updates);
  }

  /**
   * Delete profile
   */
  async deleteProfile(id) {
    return this.client.delete(`${API_ENDPOINTS.PROFILES}/${id}`);
  }

  /**
   * Clone profile
   */
  async cloneProfile(id) {
    return this.client.post(`${API_ENDPOINTS.PROFILES}/${id}/clone`);
  }

  /**
   * Launch profile
   */
  async launchProfile(id, options = {}) {
    return this.client.post(`${API_ENDPOINTS.PROFILES}/${id}/launch`, options);
  }

  /**
   * Stop profile
   */
  async stopProfile(id) {
    return this.client.post(`${API_ENDPOINTS.PROFILES}/${id}/stop`);
  }

  /**
   * Get profile log
   */
  async getProfileLog(id) {
    return this.client.get(`${API_ENDPOINTS.PROFILES}/${id}/log`);
  }

  /**
   * Get running profiles map
   */
  async getRunningProfiles() {
    return this.client.get('/api/running-map');
  }

  /**
   * Stop all profiles
   */
  async stopAllProfiles() {
    return this.client.post('/api/stop-all');
  }

  /**
   * Navigate profile to URL
   */
  async navigate(id, url) {
    return this.client.post(`${API_ENDPOINTS.PROFILES}/${id}/navigate`, { url });
  }

  /**
   * Take screenshot
   */
  async screenshot(id, options = {}) {
    return this.client.post(`${API_ENDPOINTS.PROFILES}/${id}/screenshot`, options);
  }

  /**
   * Get cookies
   */
  async getCookies(id) {
    return this.client.get(`${API_ENDPOINTS.PROFILES}/${id}/cookies`);
  }

  /**
   * Set cookies
   */
  async setCookies(id, cookies) {
    return this.client.post(`${API_ENDPOINTS.PROFILES}/${id}/cookies`, { cookies });
  }

  /**
   * Clear cookies
   */
  async clearCookies(id) {
    return this.client.delete(`${API_ENDPOINTS.PROFILES}/${id}/cookies`);
  }
}
