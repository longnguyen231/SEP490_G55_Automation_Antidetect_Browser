// API Services Index - Single export point

export { ApiClient, ApiError } from './client';
export { ProfilesApi } from './profiles';
export { AutomationApi } from './automation';
export { SettingsApi } from './settings';
export { PresetsApi } from './presets';

/**
 * Create API services with client
 */
export function createApiServices(client) {
  return {
    profiles: new ProfilesApi(client),
    automation: new AutomationApi(client),
    settings: new SettingsApi(client),
    presets: new PresetsApi(client)
  };
}
