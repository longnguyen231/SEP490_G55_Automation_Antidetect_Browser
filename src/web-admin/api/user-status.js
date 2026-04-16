import { getActivatedOrderByEmail } from './lib/storage.js';

/**
 * GET /api/user-status?email=xxx
 * Returns { isPro: boolean, activatedAt?: string, licenseKey?: string }
 */
export default async function handler(req, res) {
  const origin = process.env.VITE_WEB_URL || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).end();

  const { email } = req.query;
  if (!email) return res.status(400).json({ error: 'email required' });

  try {
    const order = await getActivatedOrderByEmail(email);
    if (order) {
      return res.status(200).json({
        isPro: true,
        licenseKey: order.licenseKey || null,
        activatedAt: order.activatedAt || null,
      });
    }
    return res.status(200).json({ isPro: false });
  } catch (err) {
    console.error('[user-status]', err);
    return res.status(500).json({ error: err.message });
  }
}
