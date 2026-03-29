// useApiClient Hook - Create API client based on environment

import { useMemo } from 'react';
import { ApiClient, createApiServices } from '@services/api';
import { IpcBridge, IpcApiClient } from '@services/ipc';

/**
 * Hook to create API client
 * Automatically detects if running in Electron and uses IPC or REST
 * 
 * @param {Object} options - Configuration options
 * @param {string} options.baseURL - REST API base URL (default: http://localhost:5478)
 * @param {string} options.apiKey - API key for authentication
 * @param {boolean} options.preferIpc - Prefer IPC over REST when available (default: true)
 */
export function useApiClient(options = {}) {
  const {
    baseURL = 'http://localhost:5478',
    apiKey,
    preferIpc = true
  } = options;

  const apiServices = useMemo(() => {
    // Check if IPC is available (running in Electron)
    const hasIpc = IpcBridge.isAvailable();
    
    if (hasIpc && preferIpc) {
      // Use IPC for faster communication
      const ipcClient = new IpcApiClient();
      return createApiServices(ipcClient);
    }
    
    // Use REST API
    const restClient = new ApiClient(baseURL);
    
    if (apiKey) {
      restClient.setApiKey(apiKey);
    }
    
    return createApiServices(restClient);
  }, [baseURL, apiKey, preferIpc]);

  return apiServices;
}

/**
 * Hook for IPC-specific features (Electron only)
 */
export function useIpc() {
  const ipc = useMemo(() => {
    if (!IpcBridge.isAvailable()) {
      return null;
    }
    return new IpcBridge();
  }, []);

  return ipc;
}
