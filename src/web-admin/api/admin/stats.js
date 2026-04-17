/**
 * GET /api/admin/stats
 * Returns revenue overview computed from orders storage.
 */
import { getAllOrders } from '../lib/storage.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  try {
    const orders = await getAllOrders();

    const paid = orders.filter(o => o.status === 'paid');
    const pending = orders.filter(o => o.status === 'pending');
    const revoked = orders.filter(o => o.status === 'revoked');
    const totalRevenue = paid.reduce((sum, o) => sum + (o.amount || 0), 0);
    const activated = paid.filter(o => o.activatedMachine);

    // Orders per day — last 7 days
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

    return res.status(200).json({
      totalRevenue,
      totalOrders: orders.length,
      paidOrders: paid.length,
      pendingOrders: pending.length,
      revokedOrders: revoked.length,
      activatedLicenses: activated.length,
      conversionRate: orders.length > 0 ? Math.round((paid.length / orders.length) * 100) : 0,
      last7Days: last7,
    });
  } catch (err) {
    console.error('[admin/stats]', err);
    return res.status(500).json({ error: 'Server error.' });
  }
}
