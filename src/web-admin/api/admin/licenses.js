/**
 * GET  /api/admin/licenses               — all activated licenses
 * POST /api/admin/licenses/:email/reset  — remove machine binding (user can re-activate on new machine)
 * POST /api/admin/licenses/:email/revoke — set status to revoked
 */
import { getAllOrders, findOrderEntryByEmail, updateOrder } from '../lib/storage.js';

export async function listLicenses(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  try {
    const orders = await getAllOrders();
    const licenses = orders
      .filter(o => o.status === 'paid')
      .map(o => ({
        orderCode: o._orderCode,
        email: o.userEmail || o.email,
        licenseKey: o.licenseKey,
        activatedMachine: o.activatedMachine,
        activatedAt: o.activatedAt,
        createdAt: o.createdAt,
        amount: o.amount,
        status: o.status,
      }))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return res.status(200).json({ licenses });
  } catch (err) {
    console.error('[admin/licenses]', err);
    return res.status(500).json({ error: 'Server error.' });
  }
}

export async function resetMachine(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const email = decodeURIComponent(req.params.email);
  if (!email) return res.status(400).json({ error: 'Email required.' });

  try {
    const entry = await findOrderEntryByEmail(email);
    if (!entry) return res.status(404).json({ error: 'No paid order found for this email.' });

    await updateOrder(entry.orderCode, {
      activatedMachine: null,
      licenseKey: null,
      activatedAt: null,
      resetByAdmin: req.adminEmail,
      resetAt: new Date().toISOString(),
    });
    console.log(`[admin/licenses] reset machine for ${email} by ${req.adminEmail}`);
    return res.status(200).json({ success: true, message: 'Machine binding cleared. User can activate on a new machine.' });
  } catch (err) {
    console.error('[admin/licenses/reset]', err);
    return res.status(500).json({ error: 'Server error.' });
  }
}

export async function revokeLicense(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const email = decodeURIComponent(req.params.email);
  if (!email) return res.status(400).json({ error: 'Email required.' });

  try {
    const entry = await findOrderEntryByEmail(email);
    if (!entry) return res.status(404).json({ error: 'No paid order found for this email.' });

    await updateOrder(entry.orderCode, {
      status: 'revoked',
      revokedByAdmin: req.adminEmail,
      revokedAt: new Date().toISOString(),
    });
    console.log(`[admin/licenses] revoked license for ${email} by ${req.adminEmail}`);
    return res.status(200).json({ success: true, message: 'License revoked.' });
  } catch (err) {
    console.error('[admin/licenses/revoke]', err);
    return res.status(500).json({ error: 'Server error.' });
  }
}
