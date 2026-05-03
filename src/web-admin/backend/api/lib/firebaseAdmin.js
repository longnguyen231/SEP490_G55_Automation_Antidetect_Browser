let _appInitialized = false;

async function initAdminApp() {
  if (_appInitialized) return;
  const { getApps, initializeApp, cert } = await import('firebase-admin/app');
  if (!getApps().length) {
    initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
  }
  _appInitialized = true;
}

/**
 * Verify a Firebase ID token.
 * Returns the token's email on success, null on failure.
 * Falls back to JWT decode (dev only) when FIREBASE_SERVICE_ACCOUNT is absent.
 */
export async function verifyFirebaseToken(token) {
  try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      await initAdminApp();
      const { getAuth } = await import('firebase-admin/auth');
      const decoded = await getAuth().verifyIdToken(token);
      return decoded.email?.toLowerCase() || null;
    }
    // Dev fallback: decode without verification
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
    return payload.email?.toLowerCase() || null;
  } catch {
    return null;
  }
}
