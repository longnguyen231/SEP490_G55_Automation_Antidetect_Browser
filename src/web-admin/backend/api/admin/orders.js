/**
 * GET  /api/admin/orders        — list all orders (newest first)
 * POST /api/admin/orders/:code/mark-paid  — manually mark a stuck order as paid
 */
import { getAllOrders, getOrder, updateOrder } from '../lib/storage.js';

export async function listOrders(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  try {
    const orders = await getAllOrders();
    // Sort newest first
    orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return res.status(200).json({ orders });
  } catch (err) {
    console.error('[admin/orders]', err);
    return res.status(500).json({ error: 'Server error.' });
  }
}

export async function markPaid(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { code } = req.params;
  if (!code) return res.status(400).json({ error: 'orderCode required.' });

  try {
    const order = await getOrder(code);
    if (!order) return res.status(404).json({ error: 'Order not found.' });
    if (order.status === 'paid') return res.status(200).json({ message: 'Already paid.' });

    await updateOrder(code, { status: 'paid', markedPaidByAdmin: true, markedPaidAt: new Date().toISOString() });
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('[admin/orders/mark-paid]', err);
    return res.status(500).json({ error: 'Server error.' });
  }
}
