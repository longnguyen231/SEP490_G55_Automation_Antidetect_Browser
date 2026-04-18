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

  return { getStats, getOrders, markPaid, getLicenses, resetMachine, revokeLicense, getUsers, getNotifications, getConfig, saveConfig };
}
