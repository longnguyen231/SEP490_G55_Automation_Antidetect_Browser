import { getOrder } from './lib/storage.js';

export default async function handler(req, res) {
  const origin = process.env.VITE_WEB_URL || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  if (req.method !== 'GET') return res.status(405).end();
  const { orderCode } = req.query;
  if (!orderCode) return res.status(400).json({ error: 'orderCode required' });
  try {
    const order = await getOrder(orderCode);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    const { status, licenseKey, tier, email } = order;
    return res.status(200).json({
      status, tier,
      email: email.replace(/(.{2})[^@]+(@.+)/, '$1***$2'),
      licenseKey: status === 'paid' ? licenseKey : null,
    });
  } catch (err) {
    console.error('[get-order]', err);
    return res.status(500).json({ error: err.message });
  }
}
