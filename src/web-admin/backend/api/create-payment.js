import { PayOS } from '@payos/node';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { saveOrder } from './lib/storage.js';

const payos = new PayOS({
  clientId: process.env.PAYOS_CLIENT_ID,
  apiKey: process.env.PAYOS_API_KEY,
  checksumKey: process.env.PAYOS_CHECKSUM_KEY,
});

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_FILE = join(__dirname, '../.data/config.json');

// Read price from admin config.json on every request so price changes take
// effect immediately without restarting the server.
function getProPrice() {
  try {
    if (existsSync(CONFIG_FILE)) {
      const cfg = JSON.parse(readFileSync(CONFIG_FILE, 'utf8'));
      if (typeof cfg.proPriceVnd === 'number') return cfg.proPriceVnd;
    }
  } catch {}
  return parseInt(process.env.PRO_PRICE_VND || '299000', 10);
}

export default async function handler(req, res) {
  const origin = process.env.VITE_WEB_URL || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { email, tier = 'pro' } = req.body;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Valid email is required' });
    }
    const TIER_PRICES = { pro: getProPrice() };
    const amount = TIER_PRICES[tier];
    if (!amount) return res.status(400).json({ error: 'Invalid tier' });
    const orderCode = Date.now();
    const webUrl = process.env.VITE_WEB_URL || 'http://localhost:5174';
    const payment = await payos.paymentRequests.create({
      orderCode, amount,
      description: `HL-MCK ${tier.toUpperCase()} License`,
      buyerEmail: email,
      returnUrl: `${webUrl}/checkout/success?orderCode=${orderCode}`,
      cancelUrl: `${webUrl}/checkout?tier=${tier}&cancelled=true`,
    });
    await saveOrder(orderCode, { email, tier, amount, status: 'pending' });
    return res.status(200).json({ checkoutUrl: payment.checkoutUrl, orderCode });
  } catch (err) {
    console.error('[create-payment]', err);
    return res.status(500).json({ error: 'Failed to create payment. Please try again.' });
  }
}
