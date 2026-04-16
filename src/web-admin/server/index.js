import 'dotenv/config';
import express from 'express';
import createPayment from '../api/create-payment.js';
import getOrder from '../api/get-order.js';
import payosWebhook from '../api/payos-webhook.js';
import verifyPayment from '../api/verify-payment.js';

const app = express();
const PORT = 3001;

app.use(express.json());

// ── API routes ────────────────────────────────────────────────────────────────
app.post('/api/create-payment', createPayment);
app.get('/api/get-order', getOrder);
app.post('/api/payos-webhook', payosWebhook);
app.get('/api/verify-payment', verifyPayment);

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  const hasFirebase = Boolean(process.env.FIREBASE_SERVICE_ACCOUNT);
  console.log(`\n[API Server] http://localhost:${PORT}`);
  console.log(`[Storage]    ${hasFirebase ? 'Firestore (Firebase Admin)' : 'In-memory (local dev)'}`);
  console.log(`[PayOS]      ClientID = ${process.env.PAYOS_CLIENT_ID?.slice(0, 8)}...\n`);
});
