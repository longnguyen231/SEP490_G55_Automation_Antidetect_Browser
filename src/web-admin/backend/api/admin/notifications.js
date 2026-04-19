/**
 * GET /api/admin/notifications?limit=30&since=<iso>
 *
 * Returns a list of recent events (newest first):
 *   - New trial registrations
 *   - New paid orders
 *   - Download events (grouped per platform per day)
 *
 * Does NOT require a separate notifications store —
 * derives everything from existing orders.json + downloads.json.
 */
import { getAllOrders } from '../lib/storage.js';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DOWNLOADS_FILE = join(__dirname, '../../.data/downloads.json');

function loadDownloads() {
  try {
    if (!existsSync(DOWNLOADS_FILE)) return {};
    return JSON.parse(readFileSync(DOWNLOADS_FILE, 'utf8'));
  } catch { return {}; }
}

const PLATFORM_LABEL = {
  windows: 'Windows',
  portable: 'Portable (zip)',
  linux: 'Linux (AppImage)',
  macos: 'macOS',
};

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const limit = Math.min(parseInt(req.query.limit || '50', 10), 200);
  const since = req.query.since ? new Date(req.query.since).getTime() : 0;

  try {
    const events = [];

    // ── 1. Order events (trial + paid) ───────────────────────────────────────
    const orders = await getAllOrders();
    for (const o of orders) {
      const t = new Date(o.createdAt || o.trialStartedAt || 0).getTime();
      if (t < since) continue;

      if (o.status === 'trial') {
        events.push({
          id: `trial-${o._orderCode}`,
          type: 'trial',
          icon: 'rocket_launch',
          color: 'text-cyan-400',
          bg: 'bg-cyan-500/10',
          title: 'Đăng ký trial mới',
          body: o.userEmail || o.email || 'Unknown',
          meta: `30 ngày · hết ${o.trialExpiresAt ? new Date(o.trialExpiresAt).toLocaleDateString('vi-VN') : '—'}`,
          time: t,
          iso: new Date(t).toISOString(),
        });
      } else if (o.status === 'paid') {
        events.push({
          id: `paid-${o._orderCode}`,
          type: 'paid',
          icon: 'payments',
          color: 'text-emerald-400',
          bg: 'bg-emerald-500/10',
          title: 'Đơn thanh toán mới',
          body: o.userEmail || o.email || 'Unknown',
          meta: `Pro License · ${o.amount ? new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(o.amount) : '—'}`,
          time: t,
          iso: new Date(t).toISOString(),
        });
      }
    }

    // ── 2. Download events (from daily buckets) ───────────────────────────────
    const downloads = loadDownloads();
    for (const [platform, data] of Object.entries(downloads)) {
      const label = PLATFORM_LABEL[platform] || platform;
      if (data.daily) {
        for (const [day, count] of Object.entries(data.daily)) {
          // Treat each day as a notification at midnight of that day
          const t = new Date(day + 'T00:00:00.000Z').getTime();
          if (t < since) continue;
          events.push({
            id: `dl-${platform}-${day}`,
            type: 'download',
            icon: 'download',
            color: 'text-primary',
            bg: 'bg-primary/10',
            title: `Download ${label}`,
            body: `${count} lượt tải`,
            meta: day,
            time: t,
            iso: new Date(t).toISOString(),
          });
        }
      } else if (data.count && data.lastAt) {
        // Fallback: single entry using lastAt
        const t = new Date(data.lastAt).getTime();
        if (t >= since) {
          events.push({
            id: `dl-${platform}`,
            type: 'download',
            icon: 'download',
            color: 'text-primary',
            bg: 'bg-primary/10',
            title: `Download ${label}`,
            body: `${data.count} lượt tải`,
            meta: data.lastAt ? new Date(data.lastAt).toLocaleDateString('vi-VN') : '',
            time: t,
            iso: new Date(t).toISOString(),
          });
        }
      }
    }

    // Sort newest first, take limit
    events.sort((a, b) => b.time - a.time);
    const result = events.slice(0, limit);

    return res.status(200).json({
      notifications: result,
      total: result.length,
      latestAt: result[0]?.iso || null,
    });
  } catch (err) {
    console.error('[admin/notifications]', err);
    return res.status(500).json({ error: 'Server error.' });
  }
}
