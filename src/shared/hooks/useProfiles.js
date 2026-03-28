// useProfiles Hook - Manages profile state and operations

import { useState, useCallback, useEffect } from 'react';

/**
 * Hook for managing profiles
 * @param {Object} apiServices - API services object { profiles: ProfilesApi }
 */
export function useProfiles(apiServices) {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [runningProfiles, setRunningProfiles] = useState({});

  /**
   * Load all profiles
   */
  const loadProfiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await apiServices.profiles.getProfiles();
      setProfiles(data || []);
      return data;
    } catch (err) {
      setError(err.message || 'Failed to load profiles');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [apiServices]);

  /**
   * Create new profile
   */
  const createProfile = useCallback(async (profile) => {
    setError(null);
    
    try {
      const newProfile = await apiServices.profiles.createProfile(profile);
      setProfiles(prev => [...prev, newProfile]);
      return newProfile;
    } catch (err) {
      setError(err.message || 'Failed to create profile');
      throw err;
    }
  }, [apiServices]);

  /**
   * Update existing profile
   */
  const updateProfile = useCallback(async (id, updates) => {
    setError(null);
    
    try {
      const updated = await apiServices.profiles.updateProfile(id, updates);
      setProfiles(prev => prev.map(p => p.id === id ? updated : p));
      return updated;
    } catch (err) {
      setError(err.message || 'Failed to update profile');
      throw err;
    }
  }, [apiServices]);

  /**
   * Delete profile
   */
  const deleteProfile = useCallback(async (id) => {
    setError(null);
    
    try {
      await apiServices.profiles.deleteProfile(id);
      setProfiles(prev => prev.filter(p => p.id !== id));
      setRunningProfiles(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } catch (err) {
      setError(err.message || 'Failed to delete profile');
      throw err;
    }
  }, [apiServices]);

  /**
   * Clone profile
   */
  const cloneProfile = useCallback(async (id) => {
    setError(null);
    
    try {
      const cloned = await apiServices.profiles.cloneProfile(id);
      setProfiles(prev => [...prev, cloned]);
      return cloned;
    } catch (err) {
      setError(err.message || 'Failed to clone profile');
      throw err;
    }
  }, [apiServices]);

  /**
   * Launch profile
   */
  const launchProfile = useCallback(async (id, options = {}) => {
    setError(null);
    
    try {
      const result = await apiServices.profiles.launchProfile(id, options);
      
      if (result.success && result.wsEndpoint) {
        setRunningProfiles(prev => ({
          ...prev,
          [id]: {
            wsEndpoint: result.wsEndpoint,
            engine: options.engine || 'playwright',
            startTime: Date.now()
          }
        }));
      }
      
      return result;
    } catch (err) {
      setError(err.message || 'Failed to launch profile');
      throw err;
    }
  }, [apiServices]);

  /**
   * Stop profile
   */
  const stopProfile = useCallback(async (id) => {
    setError(null);
    
    try {
      await apiServices.profiles.stopProfile(id);
      setRunningProfiles(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } catch (err) {
      setError(err.message || 'Failed to stop profile');
      throw err;
    }
  }, [apiServices]);

  /**
   * Stop all profiles
   */
  const stopAllProfiles = useCallback(async () => {
    setError(null);
    
    try {
      await apiServices.profiles.stopAllProfiles();
      setRunningProfiles({});
    } catch (err) {
      setError(err.message || 'Failed to stop profiles');
      throw err;
    }
  }, [apiServices]);

  /**
   * Refresh running profiles status
   */
  const refreshRunningStatus = useCallback(async () => {
    try {
      const runningMap = await apiServices.profiles.getRunningProfiles();
      setRunningProfiles(runningMap || {});
    } catch (err) {
      console.error('Failed to refresh running status:', err);
    }
  }, [apiServices]);

  /**
   * Check if profile is running
   */
  const isProfileRunning = useCallback((id) => {
    return !!runningProfiles[id];
  }, [runningProfiles]);

  // Initial load
  useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);

  return {
    // State
    profiles,
    loading,
    error,
    runningProfiles,
    
    // Actions
    loadProfiles,
    createProfile,
    updateProfile,
    deleteProfile,
    cloneProfile,
    launchProfile,
    stopProfile,
    stopAllProfiles,
    refreshRunningStatus,
    
    // Helpers
    isProfileRunning
  };
}
