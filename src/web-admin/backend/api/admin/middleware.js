/**
 * Admin middleware — verifies the request comes from an admin user.
 * Uses ADMIN_EMAILS from env or hardcoded fallback list.
 * 
 * Frontend sends: Authorization: Bearer <firebase_id_token>
 * We verify via Firebase Admin SDK.
 */

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || 'xuankien090103@gmail.com')
  .split(',')
  .map(e => e.trim().toLowerCase());

export async function requireAdmin(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization token.' });
  }
  const token = auth.slice(7);

  try {
    // Try Firebase Admin Auth verification if service account is available
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      await initAdminApp();
      const { getAuth } = await import('firebase-admin/auth');
      const decoded = await getAuth().verifyIdToken(token);
      const email = decoded.email?.toLowerCase();
      if (!ADMIN_EMAILS.includes(email)) {
        return res.status(403).json({ error: 'Admin access required.' });
      }
      req.adminEmail = email;
      return next();
    }

    // Fallback: decode without verification (dev only — no Firebase Admin SDK)
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
    const email = payload.email?.toLowerCase();
    if (!ADMIN_EMAILS.includes(email)) {
      return res.status(403).json({ error: 'Admin access required.' });
    }
    req.adminEmail = email;
    return next();
  } catch (err) {
    console.error('[admin-middleware]', err.message);
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

// Initialize Firebase Admin App (Auth only — does NOT require Firestore API)
let _appInitialized = false;
async function initAdminApp() {
  if (_appInitialized) return;
  const { getApps, initializeApp, cert } = await import('firebase-admin/app');
  if (!getApps().length) {
    initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
  }
  _appInitialized = true;
}
