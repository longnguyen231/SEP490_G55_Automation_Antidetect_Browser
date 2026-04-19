import { createHash } from 'crypto';
import { findActiveOrderByEmail, saveOrder } from './lib/storage.js';

/**
 * POST /api/request-trial
 * Body: { email }
 *
 * Grants a free 30-day trial license to a new user.
 * Rules:
 *  - User must be authenticated (email required)
 *  - One trial per email address ever
 *  - Creates an order with status: 'trial' in storage
 *
 * On success: { success: true, status: 'trial', expiresAt: ISO string }
 * On duplicate: { error: '...', alreadyHasLicense: true }
 */

const TRIAL_DAYS = 30;

function trialOrderCode(email) {
  // Stable, unique code per email for trial orders
  return 'TRIAL-' + createHash('sha256').update(email.toLowerCase().trim()).digest('hex').slice(0, 12).toUpperCase();
}

export default async function handler(req, res) {
  const origin = process.env.VITE_WEB_URL || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { email } = req.body || {};
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return res.status(400).json({ error: 'A valid email address is required.' });
  }

  const normalised = email.toLowerCase().trim();

  try {
    // Check if user already has an active license (trial or paid)
    const existing = await findActiveOrderByEmail(normalised);
    if (existing) {
      const isTrial = existing.order.status === 'trial';
      return res.status(409).json({
        error: isTrial
          ? 'You already have an active trial license.'
          : 'You already have a Pro license.',
        alreadyHasLicense: true,
        status: existing.order.status,
        expiresAt: existing.order.trialExpiresAt || null,
      });
    }

    // Create trial order
    const orderCode = trialOrderCode(normalised);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString();

    await saveOrder(orderCode, {
      status: 'trial',
      tier: 'trial',
      email: normalised,
      userEmail: normalised,
      trialStartedAt: now.toISOString(),
      trialExpiresAt: expiresAt,
      trialDays: TRIAL_DAYS,
    });

    console.log(`[request-trial] Created trial for ${normalised}, expires ${expiresAt}`);
    return res.status(200).json({
      success: true,
      status: 'trial',
      trialDays: TRIAL_DAYS,
      expiresAt,
    });
  } catch (err) {
    console.error('[request-trial]', err);
    return res.status(500).json({ error: 'Server error. Please try again.' });
  }
}
