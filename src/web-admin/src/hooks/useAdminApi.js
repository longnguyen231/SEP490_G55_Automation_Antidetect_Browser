/**
 * useAdminApi — fetches admin endpoints with Firebase ID token.
 * Import and call inside admin pages.
 */
import { useCallback } from 'react';
import { auth } from '../services/firebase';

async function getIdToken(forceRefresh = false) {
  // Wait for Firebase to restore session after page refresh before checking currentUser
  await auth.authStateReady();
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  return user.getIdToken(forceRefresh);
}

async function adminFetch(path, options = {}) {
  // Try with cached token first, retry once with fresh token on 401
  for (let attempt = 0; attempt < 2; attempt++) {
    const token = await getIdToken(attempt > 0);
    const res = await fetch(path, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(options.headers || {}),
      },
    });
    if (res.status === 401 && attempt === 0) continue; // retry with refreshed token
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  }
}

export function useAdminApi() {
  const getStats = useCallback(() => adminFetch('/api/admin/stats'), []);
  const getOrders = useCallback(() => adminFetch('/api/admin/orders'), []);
  const markPaid = useCallback((code) => adminFetch(`/api/admin/orders/${code}/mark-paid`, { method: 'POST' }), []);
  const getLicenses = useCallback(() => adminFetch('/api/admin/licenses'), []);
  const resetMachine = useCallback((email) => adminFetch(`/api/admin/licenses/${encodeURIComponent(email)}/reset`, { method: 'POST' }), []);
  const revokeLicense = useCallback((email) => adminFetch(`/api/admin/licenses/${encodeURIComponent(email)}/revoke`, { method: 'POST' }), []);
  const getUsers = useCallback(() => adminFetch('/api/admin/users'), []);
  const getNotifications = useCallback((limit = 30) => adminFetch(`/api/admin/notifications?limit=${limit}`), []);
  const getConfig = useCallback(() => adminFetch('/api/admin/config'), []);
  const saveConfig = useCallback((body) => adminFetch('/api/admin/config', { method: 'POST', body: JSON.stringify(body) }), []);

  // Release management
  const listReleases = useCallback(() => adminFetch('/api/admin/releases'), []);
  const deleteRelease = useCallback((id) => adminFetch(`/api/admin/releases/${encodeURIComponent(id)}`, { method: 'DELETE' }), []);

  /**
   * Upload an Electron build (.exe/.zip/.dmg/.AppImage) from the admin UI.
   * Uses XHR so we can surface upload progress for large (>100MB) files.
   * @param {File} file
   * @param {{version?: string, notes?: string, platform?: string, onProgress?: (ratio:number)=>void}} opts
   */
  const uploadRelease = useCallback(async (file, { version, notes, platform, onProgress } = {}) => {
    await auth.authStateReady();
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');
    const token = await user.getIdToken();

    const form = new FormData();
    form.append('file', file);
    if (version) form.append('version', version);
    if (notes) form.append('notes', notes);
    if (platform) form.append('platform', platform);

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/admin/releases');
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      if (onProgress) {
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) onProgress(e.loaded / e.total);
        };
      }
      xhr.onload = () => {
        let data = {};
        try { data = JSON.parse(xhr.responseText || '{}'); } catch {}
        if (xhr.status >= 200 && xhr.status < 300) resolve(data);
        else reject(new Error(data.error || `HTTP ${xhr.status}`));
      };
      xhr.onerror = () => reject(new Error('Network error'));
      xhr.send(form);
    });
  }, []);

  return {
    getStats, getOrders, markPaid, getLicenses, resetMachine, revokeLicense,
    getUsers, getNotifications, getConfig, saveConfig,
    listReleases, uploadRelease, deleteRelease,
  };
}
