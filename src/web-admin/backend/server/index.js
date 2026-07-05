import express from 'express';
import createPayment from '../api/create-payment.js';
import getOrder from '../api/get-order.js';
import payosWebhook from '../api/payos-webhook.js';
import verifyPayment from '../api/verify-payment.js';
import activateLicense from '../api/activate-license.js';
import userStatus from '../api/user-status.js';
import myLicense from '../api/my-license.js';
import requestTrial from '../api/request-trial.js';
import verifyMachine from '../api/verify-machine.js';
import deactivateMachine from '../api/deactivate-machine.js';
import reactivateMachine from '../api/reactivate-machine.js';
import { downloadRedirect, downloadStats, downloadInfo } from '../api/download.js';
import adminConfig from '../api/admin/config.js';
import adminStats from '../api/admin/stats.js';
import { listOrders, markPaid } from '../api/admin/orders.js';
import { listLicenses, resetMachine, revokeLicense } from '../api/admin/licenses.js';
import adminUsers from '../api/admin/users.js';
import adminNotifications from '../api/admin/notifications.js';
import { requireAdmin } from '../api/admin/middleware.js';
import { requireAdminOrUploadToken } from '../api/admin/uploadAuth.js';
import {
  listReleases,
  createRelease,
  deleteRelease,
  uploadMiddleware,
} from '../api/admin/releases.js';
import { getLatestRelease, downloadRelease } from '../api/releases.js';
import { serveUpdateFile } from '../api/updates.js';
import {
  uploadUpdatesMiddleware,
  listUpdateFiles,
  createUpdateFiles,
  deleteUpdateFile,
} from '../api/admin/updates.js';
import { listGithubReleases, publishGithubRelease } from '../api/admin/githubReleases.js';
import statusHandler from '../api/status.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

// ── Public API routes ─────────────────────────────────────────────────────────
app.get('/api/status', statusHandler);
app.post('/api/create-payment', createPayment);
app.get('/api/get-order', getOrder);
app.post('/api/payos-webhook', payosWebhook);
app.get('/api/verify-payment', verifyPayment);
app.post('/api/activate-license', activateLicense);
app.get('/api/user-status', userStatus);
app.post('/api/my-license', myLicense);
app.post('/api/request-trial', requestTrial);
app.post('/api/verify-machine', verifyMachine);
app.post('/api/deactivate-machine', deactivateMachine);
app.post('/api/reactivate-machine', reactivateMachine);

// Download tracking + redirect
app.get('/api/download/info', downloadInfo);
app.get('/api/download/stats', downloadStats);
app.get('/api/download/:platform', downloadRedirect);

// Self-hosted releases (public reads, admin/token writes)
app.get('/api/releases/latest', getLatestRelease);
app.get('/api/releases/:id/download', downloadRelease);

// electron-updater feed (public reads; hỗ trợ Range cho delta download)
app.get('/api/updates/:file', serveUpdateFile);

// ── Admin API routes (bearer token required) ──────────────────────────────────
app.get('/api/admin/stats', requireAdmin, adminStats);
app.get('/api/admin/orders', requireAdmin, listOrders);
app.post('/api/admin/orders/:code/mark-paid', requireAdmin, markPaid);
app.get('/api/admin/licenses', requireAdmin, listLicenses);
app.post('/api/admin/licenses/:email/reset', requireAdmin, resetMachine);
app.post('/api/admin/licenses/:email/revoke', requireAdmin, revokeLicense);
app.get('/api/admin/users', requireAdmin, adminUsers);
app.get('/api/admin/notifications', requireAdmin, adminNotifications);
app.get('/api/admin/config', requireAdmin, adminConfig);
app.post('/api/admin/config', requireAdmin, adminConfig);

// Release management: list requires admin, upload/delete accept admin OR upload token
app.get('/api/admin/releases', requireAdminOrUploadToken, listReleases);
app.post('/api/admin/releases', requireAdminOrUploadToken, uploadMiddleware, createRelease);
app.delete('/api/admin/releases/:id', requireAdminOrUploadToken, deleteRelease);

// Update-feed management (latest.yml + installer + blockmap cho electron-updater)
app.get('/api/admin/updates', requireAdminOrUploadToken, listUpdateFiles);
app.post('/api/admin/updates', requireAdminOrUploadToken, uploadUpdatesMiddleware, createUpdateFiles);
app.delete('/api/admin/updates/:file', requireAdminOrUploadToken, deleteUpdateFile);

// GitHub Releases feed (gate B): liệt kê draft/published + phát hành draft thành latest
app.get('/api/admin/github-releases', requireAdmin, listGithubReleases);
app.post('/api/admin/github-releases/:id/publish', requireAdmin, publishGithubRelease);

// ── Start ─────────────────────────────────────────────────────────────────────
const server = app.listen(PORT, () => {
  const hasFirebase = Boolean(process.env.FIREBASE_SERVICE_ACCOUNT);
  const useFirestore = hasFirebase && process.env.USE_FIRESTORE === 'true';
  console.log(`\n[API Server] http://localhost:${PORT}`);
  console.log(`[Storage]    ${useFirestore ? 'Firestore (Firebase Admin)' : 'JSON file (.data/orders.json)'}${hasFirebase && !useFirestore ? ' | Firebase Auth: enabled' : ''}`);
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
