// useSettings Hook - Manage application settings

import { useState, useCallback, useEffect } from 'react';

/**
 * Hook for managing application settings
 */
export function useSettings(apiServices) {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Load settings
   */
  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await apiServices.settings.getSettings();
      setSettings(data);
      return data;
    } catch (err) {
      setError(err.message || 'Failed to load settings');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [apiServices]);

  /**
   * Update settings
   */
  const updateSettings = useCallback(async (updates) => {
    setError(null);
    
    try {
      const updated = await apiServices.settings.updateSettings(updates);
      setSettings(updated);
      return updated;
    } catch (err) {
      setError(err.message || 'Failed to update settings');
      throw err;
    }
  }, [apiServices]);

  /**
   * Update single setting
   */
  const updateSetting = useCallback(async (key, value) => {
    return updateSettings({ [key]: value });
  }, [updateSettings]);

  // Initial load
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  return {
    settings,
    loading,
    error,
    loadSettings,
    updateSettings,
    updateSetting
  };
}
