import { findOrderByMachine, updateOrder } from './lib/storage.js';

/**
 * POST /api/deactivate-machine
 * Body: { machineCode }
 *
 * Called by the desktop app when the user deactivates their license.
 * Clears the machine binding so the admin sees the license as inactive,
 * and the user can later activate on a new machine.
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
    if (!entry) return res.status(200).json({ success: true }); // already unbound — idempotent

    await updateOrder(entry.orderCode, {
      activatedMachine: null,
      activatedAt: null,
      deactivatedAt: new Date().toISOString(),
    });

    console.log(`[deactivate-machine] Cleared binding for machine ${machineCode.slice(0, 8)}...`);
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('[deactivate-machine]', err);
    return res.status(500).json({ error: 'Server error.' });
  }
}
