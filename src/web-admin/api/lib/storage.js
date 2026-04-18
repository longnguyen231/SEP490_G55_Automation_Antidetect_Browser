/**
 * Storage abstraction — JSON file for local dev, Firestore for production.
 * Uses a local JSON file when FIREBASE_SERVICE_ACCOUNT env var is not set,
 * so data persists across server restarts.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── JSON file fallback ────────────────────────────────────────────────────────
const DATA_DIR = join(__dirname, '../../.data');
const ORDERS_FILE = join(DATA_DIR, 'orders.json');

function loadFile() {
  try {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    if (!existsSync(ORDERS_FILE)) return {};
    return JSON.parse(readFileSync(ORDERS_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function saveFile(data) {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(ORDERS_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// ── Firestore (lazy init) ─────────────────────────────────────────────────────
let _db = null;

async function getDb() {
  // Only use Firestore if explicitly opted in via USE_FIRESTORE=true
  // FIREBASE_SERVICE_ACCOUNT alone only enables Firebase Auth (users list)
  if (!process.env.FIREBASE_SERVICE_ACCOUNT || process.env.USE_FIRESTORE !== 'true') return null;
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
    const all = loadFile();
    all[key] = { ...data, createdAt: new Date().toISOString() };
    saveFile(all);
    console.log(`[storage:file] saved order ${key}`);
  }
}

export async function getOrder(orderCode) {
  const key = String(orderCode);
  const db = await getDb();

  if (db) {
    const doc = await db.collection('orders').doc(key).get();
    return doc.exists ? doc.data() : null;
  }
  const all = loadFile();
  return all[key] ?? null;
}

export async function updateOrder(orderCode, updates) {
  const key = String(orderCode);
  const db = await getDb();

  if (db) {
    const { Timestamp } = await import('firebase-admin/firestore');
    await db.collection('orders').doc(key).update({ ...updates, updatedAt: Timestamp.now() });
  } else {
    const all = loadFile();
    all[key] = { ...(all[key] ?? {}), ...updates, updatedAt: new Date().toISOString() };
    saveFile(all);
    console.log(`[storage:file] updated order ${key}`, updates);
  }
}

/**
 * Find any activated order belonging to an email.
 * Checks both `email` (set at checkout) and `userEmail` (set at activation).
 */
export async function getActivatedOrderByEmail(email) {
  const entry = await findOrderEntryByEmail(email);
  return entry ? entry.order : null;
}

/**
 * Like getActivatedOrderByEmail but also returns the orderCode key.
 * Returns { orderCode, order } or null.
 */
export async function findOrderEntryByEmail(email) {
  if (!email) return null;
  const normalised = email.toLowerCase().trim();
  const db = await getDb();

  if (db) {
    // Try userEmail first
    let snap = await db.collection('orders')
      .where('userEmail', '==', normalised)
      .where('status', '==', 'paid')
      .limit(1)
      .get();
    if (!snap.empty) return { orderCode: snap.docs[0].id, order: snap.docs[0].data() };

    // Fallback: checkout email
    snap = await db.collection('orders')
      .where('email', '==', normalised)
      .where('status', '==', 'paid')
      .limit(1)
      .get();
    if (!snap.empty) return { orderCode: snap.docs[0].id, order: snap.docs[0].data() };
    return null;
  }

  // JSON file scan — match userEmail OR checkout email
  const all = loadFile();
  for (const [orderCode, order] of Object.entries(all)) {
    const matchUser = order.userEmail?.toLowerCase() === normalised;
    const matchCheckout = order.email?.toLowerCase() === normalised;
    if ((matchUser || matchCheckout) && order.status === 'paid') {
      return { orderCode, order };
    }
  }
  return null;
}

/**
 * Like findOrderEntryByEmail but also matches 'trial' status (not just 'paid').
 * Returns { orderCode, order } or null.
 */
export async function findActiveOrderByEmail(email) {
  if (!email) return null;
  const normalised = email.toLowerCase().trim();
  const db = await getDb();

  if (db) {
    for (const status of ['paid', 'trial']) {
      let snap = await db.collection('orders')
        .where('userEmail', '==', normalised)
        .where('status', '==', status)
        .limit(1)
        .get();
      if (!snap.empty) return { orderCode: snap.docs[0].id, order: snap.docs[0].data() };

      snap = await db.collection('orders')
        .where('email', '==', normalised)
        .where('status', '==', status)
        .limit(1)
        .get();
      if (!snap.empty) return { orderCode: snap.docs[0].id, order: snap.docs[0].data() };
    }
    return null;
  }

  const all = loadFile();
  for (const [orderCode, order] of Object.entries(all)) {
    const matchUser = order.userEmail?.toLowerCase() === normalised;
    const matchCheckout = order.email?.toLowerCase() === normalised;
    const isActive = order.status === 'paid' || order.status === 'trial';
    if ((matchUser || matchCheckout) && isActive) {
      return { orderCode, order };
    }
  }
  return null;
}

/**
 * Returns all orders as a flat array, each item augmented with _orderCode.
 */
export async function getAllOrders() {
  const db = await getDb();

  if (db) {
    const snap = await db.collection('orders').get();
    return snap.docs.map(d => ({ _orderCode: d.id, ...d.data() }));
  }

  const all = loadFile();
  return Object.entries(all).map(([orderCode, order]) => ({ _orderCode: orderCode, ...order }));
}
