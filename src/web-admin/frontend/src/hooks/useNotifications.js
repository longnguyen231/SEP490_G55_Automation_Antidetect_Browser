/**
 * useNotifications — polls /api/admin/notifications every 30s.
 * Tracks "last seen" timestamp in localStorage to count unread items.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useAdminApi } from './useAdminApi';

const STORAGE_KEY = 'admin-notifications-last-seen';
const POLL_INTERVAL = 30_000; // 30 seconds

export function useNotifications() {
  const { getNotifications } = useAdminApi();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const pollRef = useRef(null);

  const getLastSeen = () => {
    try { return parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10); } catch { return 0; }
  };

  const markAllRead = useCallback(() => {
    try { localStorage.setItem(STORAGE_KEY, String(Date.now())); } catch {}
    setUnreadCount(0);
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      const data = await getNotifications(30);
      const items = data.notifications || [];
      setNotifications(items);
      const lastSeen = getLastSeen();
      const unread = items.filter(n => n.time > lastSeen).length;
      setUnreadCount(unread);
    } catch {
      // Silently fail — don't block the UI
    } finally {
      setLoading(false);
    }
  }, [getNotifications]);

  // Initial fetch + polling
  useEffect(() => {
    fetchNotifications();
    pollRef.current = setInterval(fetchNotifications, POLL_INTERVAL);
    return () => clearInterval(pollRef.current);
  }, [fetchNotifications]);

  // When panel opens → mark all read after a short delay
  useEffect(() => {
    if (open && unreadCount > 0) {
      const t = setTimeout(markAllRead, 800);
      return () => clearTimeout(t);
    }
  }, [open, unreadCount, markAllRead]);

  const toggle = useCallback(() => setOpen(v => !v), []);
  const close = useCallback(() => setOpen(false), []);

  return { notifications, loading, unreadCount, open, toggle, close, refresh: fetchNotifications };
}
