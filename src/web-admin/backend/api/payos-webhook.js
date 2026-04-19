import { PayOS } from '@payos/node';
import { randomUUID } from 'crypto';
import { getOrder, updateOrder } from './lib/storage.js';

const payos = new PayOS({
  clientId: process.env.PAYOS_CLIENT_ID,
  apiKey: process.env.PAYOS_API_KEY,
  checksumKey: process.env.PAYOS_CHECKSUM_KEY,
});

function generateLicenseKey() {
  const hex = randomUUID().replace(/-/g, '').toUpperCase();
  return `HL-MCK-PRO-${hex.slice(0, 8)}-${hex.slice(8, 16)}-${hex.slice(16, 24)}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const webhookData = await payos.webhooks.verify(req.body);
    if (!webhookData || webhookData.code !== '00') return res.status(200).json({ message: 'acknowledged' });
    const { orderCode } = webhookData.data;
    const order = await getOrder(orderCode);
    if (!order) return res.status(200).json({ message: 'order not found' });
    if (order.status === 'paid') return res.status(200).json({ message: 'already processed' });
    const licenseKey = generateLicenseKey();
    await updateOrder(orderCode, { status: 'paid', licenseKey });
    console.log(`[payos-webhook] Order ${orderCode} paid. License: ${licenseKey}`);
    return res.status(200).json({ message: 'success' });
  } catch (err) {
    console.error('[payos-webhook]', err);
    return res.status(200).json({ error: err.message });
  }
}
