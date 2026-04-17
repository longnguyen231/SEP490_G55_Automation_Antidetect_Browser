import 'dotenv/config';
import express from 'express';
import createPayment from '../api/create-payment.js';
import getOrder from '../api/get-order.js';
import payosWebhook from '../api/payos-webhook.js';
import verifyPayment from '../api/verify-payment.js';
import activateLicense from '../api/activate-license.js';
import userStatus from '../api/user-status.js';
import myLicense from '../api/my-license.js';
import adminConfig from '../api/admin/config.js';
import adminStats from '../api/admin/stats.js';
import { listOrders, markPaid } from '../api/admin/orders.js';
import { listLicenses, resetMachine, revokeLicense } from '../api/admin/licenses.js';
import adminUsers from '../api/admin/users.js';
import { requireAdmin } from '../api/admin/middleware.js';

const app = express();
const PORT = 3001;

app.use(express.json());

// ── Public API routes ─────────────────────────────────────────────────────────
app.post('/api/create-payment', createPayment);
app.get('/api/get-order', getOrder);
app.post('/api/payos-webhook', payosWebhook);
app.get('/api/verify-payment', verifyPayment);
app.post('/api/activate-license', activateLicense);
app.get('/api/user-status', userStatus);
app.post('/api/my-license', myLicense);

// ── Admin API routes (bearer token required) ──────────────────────────────────
app.get('/api/admin/stats', requireAdmin, adminStats);
app.get('/api/admin/orders', requireAdmin, listOrders);
app.post('/api/admin/orders/:code/mark-paid', requireAdmin, markPaid);
app.get('/api/admin/licenses', requireAdmin, listLicenses);
app.post('/api/admin/licenses/:email/reset', requireAdmin, resetMachine);
app.post('/api/admin/licenses/:email/revoke', requireAdmin, revokeLicense);
app.get('/api/admin/users', requireAdmin, adminUsers);
app.get('/api/admin/config', requireAdmin, adminConfig);
app.post('/api/admin/config', requireAdmin, adminConfig);

// ── Start ─────────────────────────────────────────────────────────────────────
const server = app.listen(PORT, () => {
  const hasFirebase = Boolean(process.env.FIREBASE_SERVICE_ACCOUNT);
  console.log(`\n[API Server] http://localhost:${PORT}`);
  console.log(`[Storage]    ${hasFirebase ? 'Firestore (Firebase Admin)' : 'In-memory (local dev)'}`);
  console.log(`[PayOS]      ClientID = ${process.env.PAYOS_CLIENT_ID?.slice(0, 8)}...\n`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n[API Server] ERROR: Port ${PORT} is already in use.`);
    console.error(`[API Server] Run: Get-Process -Name node | Stop-Process -Force\n`);
  } else {
    console.error('[API Server] Fatal error:', err.message);
  }
  process.exit(1);
});
