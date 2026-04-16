import { createHash } from 'crypto';
import { findOrderEntryByEmail, updateOrder } from './lib/storage.js';

const LICENSE_SECRET = 'HL-MCK-SEP490-G55-2024';

/** Must match deriveLicenseKey in the Electron app's machineId.js */
function deriveLicenseKey(machineCode) {
  const raw = machineCode.replace(/\s/g, '') + LICENSE_SECRET;
  const hash = createHash('sha256').update(raw).digest('hex').toUpperCase();
  return `HL-${hash.slice(0, 4)}-${hash.slice(4, 8)}-${hash.slice(8, 12)}`;
}

const MACHINE_CODE_RE = /^[0-9A-F\s]{4,}$/i;

/**
 * POST /api/my-license
 * Body: { email, machineCode }
 *
 * Lets a Pro user retrieve or generate their license key at any time.
 * - If already activated on THIS machine → returns same key (idempotent)
 * - If a different machine already activated → 409
 * - If not yet activated → binds machine, derives and returns key
 */
export default async function handler(req, res) {
  const origin = process.env.VITE_WEB_URL || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { email, machineCode } = req.body || {};

  if (!email) return res.status(400).json({ error: 'Email is required.' });
  if (!machineCode || !MACHINE_CODE_RE.test(machineCode.trim())) {
    return res.status(400).json({
      error: 'Invalid machine code. Copy it from the app: Settings → License tab.',
    });
  }

  const normalizedMachine = machineCode.trim().toUpperCase();

  try {
    const entry = await findOrderEntryByEmail(email);

    if (!entry) {
      return res.status(404).json({ error: 'No Pro license found for this account.' });
    }

    const { orderCode, order } = entry;

    // Already activated on THIS machine → idempotent
    if (order.activatedMachine) {
      if (order.activatedMachine === normalizedMachine) {
        return res.status(200).json({ licenseKey: deriveLicenseKey(normalizedMachine) });
      }
      return res.status(409).json({
        error: 'License already activated on another machine. One license = one machine.',
      });
    }

    // First activation — bind machine and derive key
    const licenseKey = deriveLicenseKey(normalizedMachine);
    await updateOrder(orderCode, {
      activatedMachine: normalizedMachine,
      licenseKey,
      activatedAt: new Date().toISOString(),
      userEmail: email.toLowerCase().trim(),
    });

    console.log(`[my-license] ${email} activated on new machine → ${licenseKey}`);
    return res.status(200).json({ licenseKey });
  } catch (err) {
    console.error('[my-license]', err);
    return res.status(500).json({ error: 'Server error. Please try again.' });
  }
}
