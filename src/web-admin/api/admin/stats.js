/**
 * GET /api/admin/stats
 * Returns revenue + user/trial overview computed from orders storage.
 */
import { getAllOrders } from '../lib/storage.js';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DOWNLOADS_FILE = join(__dirname, '../../.data/downloads.json');

function getDownloadStats() {
  try {
    if (!existsSync(DOWNLOADS_FILE)) return { total: 0, platforms: {} };
    const data = JSON.parse(readFileSync(DOWNLOADS_FILE, 'utf8'));
    const total = Object.values(data).reduce((s, c) => s + (c.count || 0), 0);
    return { total, platforms: data };
  } catch { return { total: 0, platforms: {} }; }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  try {
    const orders = await getAllOrders();

    const paid = orders.filter(o => o.status === 'paid');
    const trial = orders.filter(o => o.status === 'trial');
    const pending = orders.filter(o => o.status === 'pending');
    const revoked = orders.filter(o => o.status === 'revoked');
    const totalRevenue = paid.reduce((sum, o) => sum + (o.amount || 0), 0);
    const activated = [...paid, ...trial].filter(o => o.activatedMachine);

    // Orders + trials per day — last 7 days
    const now = Date.now();
    const dayMs = 86400000;
    const last7 = Array.from({ length: 7 }, (_, i) => {
      const dayStart = now - (6 - i) * dayMs;
      const dayEnd = dayStart + dayMs;
      const label = new Date(dayStart).toLocaleDateString('vi-VN', { month: 'short', day: 'numeric' });
      const count = orders.filter(o => {
        const t = new Date(o.createdAt).getTime();
        return t >= dayStart && t < dayEnd;
      }).length;
      return { label, count };
    });

    const downloads = getDownloadStats();

    return res.status(200).json({
      totalRevenue,
      totalOrders: orders.length,
      paidOrders: paid.length,
      trialOrders: trial.length,
      pendingOrders: pending.length,
      revokedOrders: revoked.length,
      activatedLicenses: activated.length,
      conversionRate: orders.length > 0 ? Math.round(((paid.length + trial.length) / orders.length) * 100) : 0,
      last7Days: last7,
      totalDownloads: downloads.total,
      downloadsByPlatform: downloads.platforms,
    });
  } catch (err) {
    console.error('[admin/stats]', err);
    return res.status(500).json({ error: 'Server error.' });
  }
}
