import { findOrderByMachine } from './lib/storage.js';

/**
 * POST /api/verify-machine
 * Body: { machineCode }
 *
 * Called by the desktop app on activation and on startup to sync license state.
 * Returns the server-side status for the machine so the app can:
 *  - Reject activation if the license was revoked
 *  - Persist expiresAt for offline trial-expiry checks
 */
export default async function handler(req, res) {
  const origin = process.env.VITE_WEB_URL || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { machineCode } = req.body || {};
  if (!machineCode) return res.status(400).json({ error: 'machineCode required' });

  try {
    const entry = await findOrderByMachine(machineCode);
    if (!entry) return res.status(200).json({ status: 'not_found' });

    const { order } = entry;

    if (order.status === 'revoked') {
      return res.status(200).json({ status: 'revoked' });
    }
    if (order.status === 'trial') {
      return res.status(200).json({
        status: 'trial',
        expiresAt: order.trialExpiresAt || null,
        tier: 'trial',
      });
    }
    return res.status(200).json({ status: 'active', tier: order.tier || 'pro' });
  } catch (err) {
    console.error('[verify-machine]', err);
    return res.status(500).json({ error: 'Server error.' });
  }
}
