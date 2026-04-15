/**
 * License Service
 *
 * Handles JWT generation (Web Crypto API - HMAC-SHA256) and
 * Firestore CRUD for license requests.
 *
 * Shared secret key MUST match tools/generate-jwt.js and licenseValidator.js in the app.
 */

import {
  collection,
  addDoc,
  updateDoc,
  doc,
  query,
  where,
  orderBy,
  getDocs,
  getDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';

// ─── Secret key (same as tools/generate-jwt.js) ───────────────────────────────
const JWT_SECRET = 'HL-JWT-SECRET-KEY-SEP490-G55-2024-CHANGE-ME-IN-PRODUCTION';

// ─── Tier configuration (must match licenseValidator.js in the desktop app) ───
export const TIER_CONFIG = {
  free: {
    label: 'Free',
    maxProfiles: 5,
    features: [],
    price: 'Free',
    description: 'Try it out, no payment required',
    durationOptions: [{ label: '7 days', value: 7 }, { label: '30 days', value: 30 }],
    defaultDuration: 7,
    color: 'text-slate-400',
    badge: 'bg-slate-700/50 text-slate-400',
  },
  pro: {
    label: 'Pro',
    maxProfiles: -1,
    features: ['unlimited_profiles', 'automation', 'api_access', 'priority_support'],
    featureLabels: ['Unlimited profiles', 'Browser automation', 'REST API access', 'Priority support'],
    price: '$29.99/month',
    description: 'For individuals and small teams',
    durationOptions: [
      { label: '30 days', value: 30 },
      { label: '90 days', value: 90 },
      { label: '1 year', value: 365 },
    ],
    defaultDuration: 30,
    color: 'text-primary',
    badge: 'bg-primary/15 text-primary',
  },
};

// ─── Firestore collection name ─────────────────────────────────────────────────
const COLLECTION = 'licenseRequests';

// ─── JWT Helpers (Web Crypto API) ──────────────────────────────────────────────

/** base64url encode a string */
function base64url(str) {
  return btoa(unescape(encodeURIComponent(str)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Generate a real HMAC-SHA256 signed JWT using the Web Crypto API.
 * Compatible with the app's licenseValidator.js (which does base64 decode).
 */
export async function generateJWT(payload) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const b64Header = base64url(JSON.stringify(header));
  const b64Payload = base64url(JSON.stringify(payload));
  const data = `${b64Header}.${b64Payload}`;

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(JWT_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const sigBuffer = await crypto.subtle.sign('HMAC', keyMaterial, new TextEncoder().encode(data));
  const b64Sig = btoa(String.fromCharCode(...new Uint8Array(sigBuffer)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  return `${data}.${b64Sig}`;
}

/**
 * Build the license payload from request params.
 * durationDays = null means lifetime (no expiresAt field).
 */
export function buildLicensePayload({ tier, durationDays, userId, email }) {
  const config = TIER_CONFIG[tier];
  const now = Math.floor(Date.now() / 1000);

  const payload = {
    tier,
    maxProfiles: config.maxProfiles,
    features: config.features,
    issuedAt: now,
    iat: now,
    userId,
    email,
  };

  if (durationDays !== null && durationDays !== undefined) {
    payload.expiresAt = now + durationDays * 24 * 60 * 60;
  }

  return payload;
}

// ─── Firestore Operations ───────────────────────────────────────────────────────

/**
 * User submits a license request.
 * Returns the new document ID.
 */
export async function createLicenseRequest({ userId, email, name, tier, durationDays, reason }) {
  const docRef = await addDoc(collection(db, COLLECTION), {
    userId,
    email,
    name,
    requestedTier: tier,
    durationDays: durationDays ?? null,
    reason: reason || '',
    status: 'pending',
    jwt: null,
    approvedTier: null,
    approvedBy: null,
    approvedAt: null,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

/**
 * Admin approves a request → generates JWT → saves to Firestore.
 * Returns the generated JWT string.
 */
export async function approveLicenseRequest({ requestId, adminEmail, tier, durationDays, userId, email }) {
  const payload = buildLicensePayload({ tier, durationDays, userId, email });
  const jwt = await generateJWT(payload);

  await updateDoc(doc(db, COLLECTION, requestId), {
    status: 'approved',
    approvedTier: tier,
    durationDays: durationDays ?? null,
    jwt,
    approvedBy: adminEmail,
    approvedAt: serverTimestamp(),
  });

  return jwt;
}

/**
 * Admin rejects a request.
 */
export async function rejectLicenseRequest({ requestId, adminEmail, reason }) {
  await updateDoc(doc(db, COLLECTION, requestId), {
    status: 'rejected',
    rejectedBy: adminEmail,
    rejectedAt: serverTimestamp(),
    rejectionReason: reason || '',
  });
}

/**
 * Get all license requests (admin).
 * Returns sorted by createdAt desc.
 */
export async function getAllLicenseRequests() {
  const q = query(collection(db, COLLECTION), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Get license requests for a specific user.
 */
export async function getUserLicenseRequests(userId) {
  const q = query(
    collection(db, COLLECTION),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Get a single license request by ID.
 */
export async function getLicenseRequest(requestId) {
  const snap = await getDoc(doc(db, COLLECTION, requestId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

/**
 * Count pending requests (for sidebar badge).
 */
export async function getPendingCount() {
  const q = query(collection(db, COLLECTION), where('status', '==', 'pending'));
  const snap = await getDocs(q);
  return snap.size;
}
