// useAutomation Hook - Manage automation scripts

import { useState, useCallback, useEffect } from 'react';

/**
 * Hook for managing automation scripts
 */
export function useAutomation(apiServices) {
  const [scripts, setScripts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [runningScripts, setRunningScripts] = useState({});

  /**
   * Load all scripts
   */
  const loadScripts = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await apiServices.automation.getScripts();
      setScripts(data || []);
      return data;
    } catch (err) {
      setError(err.message || 'Failed to load scripts');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [apiServices]);

  /**
   * Create new script
   */
  const createScript = useCallback(async (script) => {
    setError(null);
    
    try {
      const newScript = await apiServices.automation.createScript(script);
      setScripts(prev => [...prev, newScript]);
      return newScript;
    } catch (err) {
      setError(err.message || 'Failed to create script');
      throw err;
    }
  }, [apiServices]);

  /**
   * Update script
   */
  const updateScript = useCallback(async (id, updates) => {
    setError(null);
    
    try {
      const updated = await apiServices.automation.updateScript(id, updates);
      setScripts(prev => prev.map(s => s.id === id ? updated : s));
      return updated;
    } catch (err) {
      setError(err.message || 'Failed to update script');
      throw err;
    }
  }, [apiServices]);

  /**
   * Delete script
   */
  const deleteScript = useCallback(async (id) => {
    setError(null);
    
    try {
      await apiServices.automation.deleteScript(id);
      setScripts(prev => prev.filter(s => s.id !== id));
    } catch (err) {
      setError(err.message || 'Failed to delete script');
      throw err;
    }
  }, [apiServices]);

  /**
   * Run script on profiles
   */
  const runScript = useCallback(async (scriptId, profileIds = []) => {
    setError(null);
    
    try {
      const result = await apiServices.automation.runScript(scriptId, profileIds);
      
      setRunningScripts(prev => ({
        ...prev,
        [scriptId]: {
          profileIds,
          startTime: Date.now()
        }
      }));
      
      return result;
    } catch (err) {
      setError(err.message || 'Failed to run script');
      throw err;
    }
  }, [apiServices]);

  /**
   * Stop script
   */
  const stopScript = useCallback(async (scriptId) => {
    setError(null);
    
    try {
      await apiServices.automation.stopScript(scriptId);
      
      setRunningScripts(prev => {
        const next = { ...prev };
        delete next[scriptId];
        return next;
      });
    } catch (err) {
      setError(err.message || 'Failed to stop script');
      throw err;
    }
  }, [apiServices]);

  /**
   * Run automation on profile
   */
  const runAutomation = useCallback(async (profileId, steps) => {
    setError(null);
    
    try {
      const result = await apiServices.automation.runAutomation(profileId, steps);
      return result;
    } catch (err) {
      setError(err.message || 'Failed to run automation');
      throw err;
    }
  }, [apiServices]);

  /**
   * Execute single action on profile
   */
  const executeAction = useCallback(async (profileId, action, params) => {
    setError(null);
    
    try {
      const result = await apiServices.automation.executeAction(profileId, action, params);
      return result;
    } catch (err) {
      setError(err.message || 'Failed to execute action');
      throw err;
    }
  }, [apiServices]);

  /**
   * Check if script is running
   */
  const isScriptRunning = useCallback((scriptId) => {
    return !!runningScripts[scriptId];
  }, [runningScripts]);

  // Initial load
  useEffect(() => {
    loadScripts();
  }, [loadScripts]);

  return {
    // State
    scripts,
    loading,
    error,
    runningScripts,
    
    // Actions
    loadScripts,
    createScript,
    updateScript,
    deleteScript,
    runScript,
    stopScript,
    runAutomation,
    executeAction,
    
    // Helpers
    isScriptRunning
  };
}
