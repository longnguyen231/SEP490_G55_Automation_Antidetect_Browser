import { createHash } from 'crypto';
import { PayOS } from '@payos/node';
import { getOrder, updateOrder, saveOrder } from './lib/storage.js';

const payos = new PayOS({
  clientId: process.env.PAYOS_CLIENT_ID,
  apiKey: process.env.PAYOS_API_KEY,
  checksumKey: process.env.PAYOS_CHECKSUM_KEY,
});

// Must match machineId.js in the Electron app exactly
const LICENSE_SECRET = 'HL-MCK-SEP490-G55-2024';

function deriveLicenseKey(machineCode) {
  const raw = machineCode.replace(/\s/g, '') + LICENSE_SECRET;
  const hash = createHash('sha256').update(raw).digest('hex').toUpperCase();
  return `HL-${hash.slice(0, 4)}-${hash.slice(4, 8)}-${hash.slice(8, 12)}`;
}

// Machine code format: "XXXX XXXX XXXX XXXX" (hex, shown in the app)
const MACHINE_CODE_RE = /^[0-9A-F\s]{4,}$/i;

export default async function handler(req, res) {
  const origin = process.env.VITE_WEB_URL || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { orderCode, machineCode, userEmail } = req.body || {};

  if (!orderCode) return res.status(400).json({ error: 'orderCode required' });
  if (!machineCode || !MACHINE_CODE_RE.test(machineCode.trim())) {
    return res.status(400).json({ error: 'Invalid machine code format. Copy it from the app: Settings → License tab.' });
  }

  const normalizedMachine = machineCode.trim().toUpperCase();

  try {
    let order = await getOrder(String(orderCode));

    // Verify payment is PAID (check local store first, then PayOS)
    let isPaid = order?.status === 'paid';
    if (!isPaid) {
      const info = await payos.paymentRequests.get(parseInt(orderCode, 10));
      isPaid = info.status === 'PAID';
      if (isPaid) {
        // Persist so future calls don't need to hit PayOS
        if (order) {
          await updateOrder(String(orderCode), { status: 'paid' });
          order = { ...order, status: 'paid' };
        } else {
          await saveOrder(String(orderCode), { status: 'paid', tier: 'pro', email: '' });
          order = { status: 'paid', tier: 'pro', email: '' };
        }
      }
    }

    if (!isPaid) {
      return res.status(402).json({ error: 'Payment not completed for this order.' });
    }

    // Already activated on THIS machine → idempotent (return same key)
    if (order?.activatedMachine) {
      if (order.activatedMachine === normalizedMachine) {
        const key = deriveLicenseKey(normalizedMachine);
        console.log(`[activate-license] Already activated order ${orderCode} for same machine → ${key}`);
        return res.status(200).json({ licenseKey: key });
      }
      // Already bound to a DIFFERENT machine
      return res.status(409).json({
        error: 'This license is already activated on another machine. One license = one machine.',
      });
    }

    // First activation — bind machine and derive key
    const licenseKey = deriveLicenseKey(normalizedMachine);
    await updateOrder(String(orderCode), {
      activatedMachine: normalizedMachine,
      licenseKey,
      activatedAt: new Date().toISOString(),
      ...(userEmail ? { userEmail: userEmail.toLowerCase().trim() } : {}),
    });

    console.log(`[activate-license] Order ${orderCode} activated → ${licenseKey}`);
    return res.status(200).json({ licenseKey });
  } catch (err) {
    console.error('[activate-license]', err);
    return res.status(500).json({ error: err.message });
  }
}
