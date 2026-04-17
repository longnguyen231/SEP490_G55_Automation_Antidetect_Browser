/**
 * GET /api/admin/users
 * Lists Firebase Auth users, enriched with isPro from orders storage.
 * Requires FIREBASE_SERVICE_ACCOUNT env var (Firebase Admin SDK).
 * Falls back to empty list if SDK not available.
 */
import { getAllOrders } from '../lib/storage.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  try {
    // Build pro-email set from orders
    const orders = await getAllOrders();
    const proEmails = new Set(
      orders
        .filter(o => o.status === 'paid')
        .flatMap(o => [o.email, o.userEmail].filter(Boolean).map(e => e.toLowerCase()))
    );

    if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
      // No Firebase Admin — return only what we know from orders
      const usersFromOrders = orders.map(o => ({
        uid: null,
        email: o.userEmail || o.email,
        displayName: null,
        lastSignIn: null,
        createdAt: o.createdAt,
        isPro: proEmails.has((o.userEmail || o.email)?.toLowerCase()),
        provider: 'unknown',
      }));
      return res.status(200).json({ users: usersFromOrders, source: 'orders-fallback' });
    }

    // Firebase Admin — list all users
    const { getApps, initializeApp, cert } = await import('firebase-admin/app');
    const { getAuth } = await import('firebase-admin/auth');
    if (!getApps().length) {
      initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
    }

    const listResult = await getAuth().listUsers(1000);
    const users = listResult.users.map(u => ({
      uid: u.uid,
      email: u.email,
      displayName: u.displayName || null,
      lastSignIn: u.metadata.lastSignInTime,
      createdAt: u.metadata.creationTime,
      emailVerified: u.emailVerified,
      isPro: proEmails.has(u.email?.toLowerCase()),
      provider: u.providerData?.[0]?.providerId || 'password',
    }));

    // Sort: Pro first, then by lastSignIn desc
    users.sort((a, b) => {
      if (a.isPro !== b.isPro) return a.isPro ? -1 : 1;
      return new Date(b.lastSignIn || 0) - new Date(a.lastSignIn || 0);
    });

    return res.status(200).json({ users, source: 'firebase-admin' });
  } catch (err) {
    console.error('[admin/users]', err);
    return res.status(500).json({ error: 'Server error.' });
  }
}
