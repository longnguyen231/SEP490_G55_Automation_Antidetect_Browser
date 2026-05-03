import { findOrderByLicenseKey, updateOrder } from './lib/storage.js';

/**
 * POST /api/reactivate-machine
 * Body: { licenseKey, machineCode }
 *
 * Called by the desktop app when a user re-enters their license key after
 * having deactivated. Re-binds the machine so the admin sees it as active again.
 * Rejected if the license is bound to a DIFFERENT machine (409).
 */
export default async function handler(req, res) {
  const origin = process.env.VITE_WEB_URL || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { licenseKey, machineCode } = req.body || {};
  if (!licenseKey || !machineCode) {
    return res.status(400).json({ error: 'licenseKey and machineCode required' });
  }

  const normalizedMachine = machineCode.trim().toUpperCase();

  try {
    const entry = await findOrderByLicenseKey(licenseKey);
    if (!entry) return res.status(404).json({ error: 'License not found.' });

    const { orderCode, order } = entry;

    // Already bound to a different machine — reject
    if (order.activatedMachine && order.activatedMachine !== normalizedMachine) {
      return res.status(409).json({ error: 'License is active on another machine.' });
    }

    // Re-bind (or idempotent if already bound to same machine)
    await updateOrder(orderCode, {
      activatedMachine: normalizedMachine,
      activatedAt: order.activatedAt || new Date().toISOString(),
      deactivatedAt: null,
    });

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('[reactivate-machine]', err);
    return res.status(500).json({ error: 'Server error.' });
  }
}
