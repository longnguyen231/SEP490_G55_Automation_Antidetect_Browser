const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const { safeStorage } = require('electron');
const { getDataRoot } = require('../storage/paths');

function buildExpressApp(rest, swaggerUi, openapiPath, handlers) {
  const apiKey = rest.apiKey || process.env.REST_API_KEY;
  const appx = express();
  appx.use(express.json({ limit: '2mb' }));
  appx.use(cors({ origin: rest.allowedOrigins || true }));

  // API key middleware (optional)
  appx.use((req, res, next) => {
    if (apiKey && req.headers['x-api-key'] !== apiKey) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    next();
  });

  // Health
  appx.get('/api/health', (_req, res) => res.json({ ok: true }));

  // Profiles CRUD
  appx.get('/api/profiles', async (_req, res) => {
    const list = await handlers.getProfilesInternal();
    res.json(list);
  });
  appx.post('/api/profiles', async (req, res) => {
    const result = await handlers.saveProfileInternal(req.body || {});
    res.status(result.success ? 200 : 500).json(result);
  });
  appx.put('/api/profiles/:id', async (req, res) => {
    const body = { ...(req.body || {}), id: req.params.id };
    const result = await handlers.saveProfileInternal(body);
    res.status(result.success ? 200 : 500).json(result);
  });
  appx.delete('/api/profiles/:id', async (req, res) => {
    const id = req.params.id;
    const result = await handlers.deleteProfileInternal(id);
    res.status(result.success ? 200 : 500).json(result);
  });

  // Launch/stop
  appx.post('/api/profiles/:id/launch', async (req, res) => {
    const result = await handlers.launchProfileInternal(req.params.id, req.body || {});
    res.status(result.success ? 200 : 500).json(result);
  });
  appx.post('/api/profiles/:id/stop', async (req, res) => {
    const result = await handlers.stopProfileInternal(req.params.id);
    res.status(result.success ? 200 : 500).json(result);
  });
  // Run automation now
  appx.post('/api/profiles/:id/automation/run', async (req, res) => {
    if (!handlers.runAutomationNowInternal) return res.status(501).json({ success: false, error: 'Not implemented' });
    const result = await handlers.runAutomationNowInternal(req.params.id);
    res.status(result.success ? 200 : 500).json(result);
  });
  appx.post('/api/stop-all', async (_req, res) => {
    const result = await handlers.stopAllProfilesInternal();
    res.status(result.success ? 200 : 500).json(result);
  });

  // Running and WS
  appx.get('/api/running-map', async (_req, res) => {
    const r = await handlers.getRunningMapInternal(); res.json(r);
  });
  appx.get('/api/profiles/:id/ws', async (req, res) => {
    const r = await handlers.getProfileWsInternal(req.params.id); res.json(r);
  });

  // Cookies
  appx.get('/api/profiles/:id/cookies', async (req, res) => {
    const r = await handlers.getCookiesInternal(req.params.id); res.json(r);
  });
  appx.post('/api/profiles/:id/cookies', async (req, res) => {
    const r = await handlers.importCookiesInternal(req.params.id, req.body || []); res.json(r);
  });

  // Logs and clone
  appx.get('/api/profiles/:id/log', async (req, res) => {
    const r = await handlers.getProfileLogInternal(req.params.id); res.json(r);
  });
  appx.post('/api/profiles/:id/clone', async (req, res) => {
    const r = await handlers.cloneProfileInternal(req.params.id, req.body || {}); res.json(r);
  });

  // Browser control endpoints
  appx.get('/api/profiles/:id/pages', async (req, res) => {
    const r = await handlers.listPagesInternal(req.params.id); res.json(r);
  });
  appx.post('/api/profiles/:id/navigate', async (req, res) => {
    const r = await handlers.navigateInternal(req.params.id, req.body || {}); res.json(r);
  });
  appx.post('/api/profiles/:id/new-page', async (req, res) => {
    const r = await handlers.newPageInternal(req.params.id, req.body || {}); res.json(r);
  });
  appx.post('/api/profiles/:id/close-page', async (req, res) => {
    const r = await handlers.closePageInternal(req.params.id, req.body || {}); res.json(r);
  });
  appx.post('/api/profiles/:id/screenshot', async (req, res) => {
    const r = await handlers.screenshotInternal(req.params.id, req.body || {}); res.json(r);
  });
  appx.post('/api/profiles/:id/eval', async (req, res) => {
    const r = await handlers.evalInternal(req.params.id, req.body || {}); res.json(r);
  });

  // Generic action dispatcher and helpers
  appx.get('/api/actions', async (_req, res) => {
    try {
      const { getActionNames } = require('../engine/actions');
      res.json({ success: true, actions: getActionNames() });
    } catch (e) { res.status(500).json({ success: false, error: e?.message || String(e) }); }
  });
  appx.post('/api/profiles/:id/action/:name', async (req, res) => {
    try {
      const { performAction } = require('../engine/actions');
      const result = await performAction(req.params.id, req.params.name, req.body || {});
      res.status(result.success ? 200 : 500).json(result);
    } catch (e) { res.status(500).json({ success: false, error: e?.message || String(e) }); }
  });

  // Scripts management (CRUD + execute)
  appx.get('/api/scripts', async (_req, res) => {
    try {
      const { listScriptsInternal } = require('../storage/scripts');
      const list = await listScriptsInternal();
      res.json(list);
    } catch (e) { res.status(500).json({ success: false, error: e?.message || String(e) }); }
  });
  appx.get('/api/scripts/:id', async (req, res) => {
    try {
      const { getScriptInternal } = require('../storage/scripts');
      const r = await getScriptInternal(req.params.id);
      res.status(r.success === false ? 404 : 200).json(r);
    } catch (e) { res.status(500).json({ success: false, error: e?.message || String(e) }); }
  });
  appx.post('/api/scripts', async (req, res) => {
    try {
      const { saveScriptInternal } = require('../storage/scripts');
      const r = await saveScriptInternal(req.body || {});
      res.status(r.success ? 200 : 400).json(r);
    } catch (e) { res.status(500).json({ success: false, error: e?.message || String(e) }); }
  });
  appx.put('/api/scripts/:id', async (req, res) => {
    try {
      const { saveScriptInternal } = require('../storage/scripts');
      const payload = { ...(req.body || {}), id: req.params.id };
      const r = await saveScriptInternal(payload);
      res.status(r.success ? 200 : 400).json(r);
    } catch (e) { res.status(500).json({ success: false, error: e?.message || String(e) }); }
  });
  appx.delete('/api/scripts/:id', async (req, res) => {
    try {
      const { deleteScriptInternal } = require('../storage/scripts');
      const r = await deleteScriptInternal(req.params.id);
      res.status(r.success ? 200 : 404).json(r);
    } catch (e) { res.status(500).json({ success: false, error: e?.message || String(e) }); }
  });
  // Execute a script for a profile
  appx.post('/api/profiles/:id/scripts/:sid/execute', async (req, res) => {
    try {
      const { getScriptInternal } = require('../storage/scripts');
      const { executeScript } = require('../engine/scriptRuntime');
      const g = await getScriptInternal(req.params.sid);
      if (!g.success) return res.status(404).json(g);
      const r = await executeScript(req.params.id, g.script.code || '', { timeoutMs: Math.min(300000, Number(req.body?.timeoutMs || 120000)) });
      res.status(r.success ? 200 : 500).json(r);
    } catch (e) { res.status(500).json({ success: false, error: e?.message || String(e) }); }
  });

  // Locales/timezones
  appx.get('/api/locales-timezones', async (_req, res) => {
    const r = await handlers.getLocalesTimezonesInternal(); res.json(r);
  });

  // OpenAPI + Swagger UI
  appx.get('/openapi.json', (_req, res) => {
    try { res.type('application/json').send(require('fs').readFileSync(openapiPath, 'utf8')); }
    catch { res.status(404).json({ error: 'openapi not found' }); }
  });
  if (swaggerUi) {
    try {
      const spec = require('fs').existsSync(openapiPath) ? JSON.parse(require('fs').readFileSync(openapiPath, 'utf8')) : { openapi: '3.0.0', info: { title: 'OBT API', version: '1.0.0' } };
      appx.use('/api-docs', swaggerUi.serve, swaggerUi.setup(spec));
    } catch {}
  }

  return appx;
}

function createRestServer({ settingsProvider, broadcaster, swaggerUi }) {
  let restHttpServer = null;
  const restServerState = { enabled: true, running: false, host: '127.0.0.1', port: 5478, error: null };
  const openapiPath = path.join(__dirname, '../api', 'openapi.json');

  function broadcast() { broadcaster && broadcaster({ ...restServerState }); }

  function sha256Hex(str) {
    try { return crypto.createHash('sha256').update(String(str), 'utf8').digest('hex'); } catch { return ''; }
  }

  // Fixed password hardcoded in code. Change this value to your desired password.
  // Optionally override via environment variable OBT_REST_PASSWORD for development.
  const FIXED_PASSWORD = process.env.OBT_REST_PASSWORD || 'OBT@2025_STR0NGP4SS';
  const FIXED_PASSWORD_HASH = sha256Hex(FIXED_PASSWORD);

  // Hidden encrypted password persistence (so user doesn't need to re-enter).
  // Stored under a nested dot directory in data root to reduce discoverability.
  function secretDir() {
    try {
      const dir = path.join(getDataRoot(), '.sys', '.sec');
      fs.mkdirSync(dir, { recursive: true });
      return dir;
    } catch { return getDataRoot(); }
  }
  function secretFilePath() { return path.join(secretDir(), '.restpwd.bin'); }
  function loadStoredPassword() {
    try {
      if (!safeStorage?.isEncryptionAvailable()) return null;
      const p = secretFilePath();
      if (!fs.existsSync(p)) return null;
      const buf = fs.readFileSync(p);
      return safeStorage.decryptString(buf);
    } catch { return null; }
  }
  function persistPassword(plain) {
    try {
      if (!plain || !safeStorage?.isEncryptionAvailable()) return false;
      const enc = safeStorage.encryptString(String(plain));
      fs.writeFileSync(secretFilePath(), enc);
      return true;
    } catch { return false; }
  }

  function verifyPassword(inputPlain) {
    const actual = sha256Hex(inputPlain || '');
    try {
      const a = Buffer.from(actual, 'hex');
      const b = Buffer.from(FIXED_PASSWORD_HASH, 'hex');
      if (a.length !== b.length) return false;
      return crypto.timingSafeEqual(a, b);
    } catch { return false; }
  }

  async function start(handlers, opts = {}) {
    const settings = settingsProvider();
    const rest = settings.restApi || {};
    const requirePassword = true; // always require password
    const enabled = rest.enabled !== false;
    const host = rest.host || '127.0.0.1';
    const port = Number(rest.port || 5478);
    restServerState.enabled = enabled; restServerState.host = host; restServerState.port = port; restServerState.error = null;
    if (!enabled) { restServerState.running = false; broadcast(); return { ok: false, disabled: true }; }

    if (requirePassword) {
      // Attempt stored secret first
      let supplied = loadStoredPassword();
      if (!supplied) supplied = (opts && opts.passwordPlain) || process.env.REST_START_PASSWORD || null;
      if (!supplied || !verifyPassword(supplied)) {
        restServerState.running = false; restServerState.error = 'PASSWORD_REQUIRED'; broadcast();
        return { ok: false, error: 'PASSWORD_REQUIRED' };
      }
      // Persist if this was a freshly provided password (not already stored)
      try {
        if ((opts && opts.passwordPlain) && !loadStoredPassword()) persistPassword(opts.passwordPlain);
      } catch {}
    }

    if (restHttpServer) {
      try { const addr = restHttpServer.address(); if (addr && Number(addr.port) === port) { restServerState.running = true; restServerState.error = null; broadcast(); return { ok: true }; } } catch {}
      try { restHttpServer.close(); } catch {}
      restHttpServer = null; restServerState.running = false;
    }

    const appx = buildExpressApp(rest, swaggerUi, openapiPath, handlers);
    return new Promise((resolve) => {
      restHttpServer = appx.listen(port, host, () => {
        restServerState.running = true; restServerState.error = null; broadcast(); resolve({ ok: true });
      });
      restHttpServer.on('error', (err) => {
        restServerState.running = false;
        restServerState.error = err?.code === 'EADDRINUSE' ? `Port ${port} is already in use` : (err?.message || String(err));
        try { restHttpServer.close(); } catch {}
        restHttpServer = null; broadcast(); resolve({ ok: false, error: restServerState.error });
      });
    });
  }

  async function stop() {
    if (!restHttpServer) { restServerState.running = false; broadcast(); return true; }
    const srv = restHttpServer; restHttpServer = null;
    return new Promise((resolve) => { try { srv.close(() => resolve(true)); } catch { resolve(false); } }).finally(() => { restServerState.running = false; broadcast(); });
  }

  async function setEnabled(enabled, handlers) {
    const st = settingsProvider(); const rest = st.restApi || {}; rest.enabled = !!enabled; settingsProvider.set?.(st);
    restServerState.enabled = !!enabled; if (enabled) return await start(handlers); else { await stop(); return { ok: true }; }
  }

  async function setPort(port, handlers) {
    const n = Number(port); if (!Number.isInteger(n) || n < 1 || n > 65535) return { ok: false, error: 'Invalid port' };
    const st = settingsProvider(); const rest = st.restApi || {}; rest.port = n; settingsProvider.set?.(st);
    restServerState.port = n; await stop(); return await start(handlers);
  }

  async function startWithPassword(handlers, passwordPlain) {
    return await start(handlers, { passwordPlain });
  }

  function getState() { return { ...restServerState }; }

  return { start, stop, setEnabled, setPort, getState, startWithPassword };
}

module.exports = { createRestServer };
