/**
 * Storage abstraction — in-memory for local dev, Firestore for production.
 * Uses in-memory Map when FIREBASE_SERVICE_ACCOUNT env var is not set.
 */

// ── In-memory fallback ────────────────────────────────────────────────────────
const mem = new Map();

// ── Firestore (lazy init) ─────────────────────────────────────────────────────
let _db = null;

async function getDb() {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) return null;
  if (_db) return _db;

  const { initializeApp, getApps, cert } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');

  if (!getApps().length) {
    initializeApp({
      credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
    });
  }
  _db = getFirestore();
  return _db;
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function saveOrder(orderCode, data) {
  const key = String(orderCode);
  const db = await getDb();

  if (db) {
    const { Timestamp } = await import('firebase-admin/firestore');
    await db.collection('orders').doc(key).set({ ...data, createdAt: Timestamp.now() });
  } else {
    mem.set(key, { ...data, createdAt: new Date().toISOString() });
    console.log(`[storage:mem] saved order ${key}`);
  }
}

export async function getOrder(orderCode) {
  const key = String(orderCode);
  const db = await getDb();

  if (db) {
    const doc = await db.collection('orders').doc(key).get();
    return doc.exists ? doc.data() : null;
  }
  return mem.get(key) ?? null;
}

export async function updateOrder(orderCode, updates) {
  const key = String(orderCode);
  const db = await getDb();

  if (db) {
    const { Timestamp } = await import('firebase-admin/firestore');
    await db.collection('orders').doc(key).update({ ...updates, updatedAt: Timestamp.now() });
  } else {
    const existing = mem.get(key) ?? {};
    mem.set(key, { ...existing, ...updates });
    console.log(`[storage:mem] updated order ${key}`, updates);
  }
}
