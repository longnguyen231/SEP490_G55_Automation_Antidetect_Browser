import { PayOS } from '@payos/node';
import { randomUUID } from 'crypto';
import { getOrder, updateOrder, saveOrder } from './lib/storage.js';

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
  const origin = process.env.VITE_WEB_URL || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).end();

  const { orderCode } = req.query;
  if (!orderCode) return res.status(400).json({ error: 'orderCode required' });

  try {
    const order = await getOrder(orderCode);

    // Idempotency: already verified locally
    if (order?.status === 'paid' && order?.licenseKey) {
      return res.status(200).json({ status: 'paid', licenseKey: order.licenseKey, tier: order.tier });
    }

    // Query PayOS directly (works even if local store was lost on restart)
    const info = await payos.paymentRequests.get(parseInt(orderCode, 10));

    if (info.status === 'PAID') {
      const licenseKey = generateLicenseKey();
      // Save/update so future calls return instantly
      if (order) {
        await updateOrder(orderCode, { status: 'paid', licenseKey });
      } else {
        await saveOrder(orderCode, { status: 'paid', licenseKey, tier: 'pro', email: '' });
      }
      console.log(`[verify-payment] Order ${orderCode} paid → ${licenseKey}`);
      return res.status(200).json({ status: 'paid', licenseKey, tier: order?.tier || 'pro' });
    }

    return res.status(200).json({ status: info.status?.toLowerCase() || 'pending' });
  } catch (err) {
    console.error('[verify-payment]', err);
    return res.status(500).json({ error: err.message });
  }
}

