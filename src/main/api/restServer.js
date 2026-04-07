const path = require('path');
const express = require('express');
const cors = require('cors');

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
  appx.put('/api/profiles/:id/cookies', async (req, res) => {
    const r = await handlers.editCookieInternal(req.params.id, req.body || {}); res.json(r);
  });
  appx.delete('/api/profiles/:id/cookies', async (req, res) => {
    const { name, domain, path: p } = req.query || {};
    if (name && domain) {
      const r = await handlers.deleteCookieInternal(req.params.id, { name, domain, path: p }); res.json(r);
    } else {
      const r = await handlers.clearCookiesInternal(req.params.id); res.json(r);
    }
  });

  // Logs and clone
  appx.get('/api/profiles/:id/log', async (req, res) => {
    const r = await handlers.getProfileLogInternal(req.params.id); res.json(r);
  });
  appx.post('/api/profiles/:id/clone', async (req, res) => {
    const r = await handlers.cloneProfileInternal(req.params.id, req.body || {}); res.json(r);
  });

  // Browser control endpoints
  // Sample App Aliases mapping requested by user

  appx.post('/api/profiles/:id/navigate', async (req, res) => {
    const r = await handlers.navigateInternal(req.params.id, req.body || {}); res.json(r);
  });
  appx.post('/api/profiles/:id/close-page', async (req, res) => {
    const r = await handlers.closePageInternal(req.params.id, req.body || {}); res.json(r);
  });
  appx.post('/api/profiles/:id/eval', async (req, res) => {
    const r = await handlers.evalInternal(req.params.id, req.body || {}); res.json(r);
  });

  // Native mouse actions
  appx.post('/api/profiles/:id/actions/mouse/move', async (req, res) => {
    try {
      const { mouseMove } = require('../engine/actions');
      const result = await mouseMove(req.params.id, req.body || {});
      res.status(result.success ? 200 : 500).json(result);
    } catch (e) { res.status(500).json({ success: false, error: e?.message || String(e) }); }
  });
  appx.post('/api/profiles/:id/actions/mouse/click', async (req, res) => {
    try {
      const { mouseClick } = require('../engine/actions');
      const result = await mouseClick(req.params.id, req.body || {});
      res.status(result.success ? 200 : 500).json(result);
    } catch (e) { res.status(500).json({ success: false, error: e?.message || String(e) }); }
  });
  appx.post('/api/profiles/:id/actions/mouse/dblclick', async (req, res) => {
    try {
      const { mouseDblclick } = require('../engine/actions');
      const result = await mouseDblclick(req.params.id, req.body || {});
      res.status(result.success ? 200 : 500).json(result);
    } catch (e) { res.status(500).json({ success: false, error: e?.message || String(e) }); }
  });
  appx.post('/api/profiles/:id/actions/mouse/down', async (req, res) => {
    try {
      const { mouseDown } = require('../engine/actions');
      const result = await mouseDown(req.params.id, req.body || {});
      res.status(result.success ? 200 : 500).json(result);
    } catch (e) { res.status(500).json({ success: false, error: e?.message || String(e) }); }
  });
  appx.post('/api/profiles/:id/actions/mouse/up', async (req, res) => {
    try {
      const { mouseUp } = require('../engine/actions');
      const result = await mouseUp(req.params.id, req.body || {});
      res.status(result.success ? 200 : 500).json(result);
    } catch (e) { res.status(500).json({ success: false, error: e?.message || String(e) }); }
  });
  appx.post('/api/profiles/:id/actions/mouse/wheel', async (req, res) => {
    try {
      const { mouseWheel } = require('../engine/actions');
      const result = await mouseWheel(req.params.id, req.body || {});
      res.status(result.success ? 200 : 500).json(result);
    } catch (e) { res.status(500).json({ success: false, error: e?.message || String(e) }); }
  });
  appx.post('/api/profiles/:id/actions/reload', async (req, res) => {
    const r = await handlers.reloadPageInternal(req.params.id, req.body || {});
    res.status(r.success ? 200 : 500).json(r);
  });
  appx.post('/api/profiles/:id/actions/go-back', async (req, res) => {
    const r = await handlers.goBackInternal(req.params.id, req.body || {});
    res.status(r.success ? 200 : 500).json(r);
  });
  appx.post('/api/profiles/:id/actions/go-forward', async (req, res) => {
    const r = await handlers.goForwardInternal(req.params.id, req.body || {});
    res.status(r.success ? 200 : 500).json(r);
  });
  appx.get('/api/profiles/:id/actions/page-info', async (req, res) => {
    const r = await handlers.getPageInfoInternal(req.params.id, req.query || {});
    res.status(r.success ? 200 : 500).json(r);
  });
  appx.get('/api/profiles/:id/actions/content', async (req, res) => {
    const r = await handlers.getPageContentInternal(req.params.id, req.query || {});
    res.status(r.success ? 200 : 500).json(r);
  });
  appx.post('/api/profiles/:id/actions/screenshot', async (req, res) => {
    const r = await handlers.screenshotInternal(req.params.id, req.body || {});
    res.status(r.success ? 200 : 500).json(r);
  });
  appx.post('/api/profiles/:id/actions/click', async (req, res) => {
    const r = await handlers.clickElementInternal(req.params.id, req.body || {});
    res.status(r.success ? 200 : 500).json(r);
  });
  appx.post('/api/profiles/:id/actions/double-click', async (req, res) => {
    const r = await handlers.doubleClickElementInternal(req.params.id, req.body || {});
    res.status(r.success ? 200 : 500).json(r);
  });

  // Browser context actions
  appx.get('/api/profiles/:id/context/storage-state', async (req, res) => {
    const r = await (handlers.getStorageStateInternal ? handlers.getStorageStateInternal(req.params.id) : { success: false, error: 'Not implemented' });
    res.json(r);
  });
  appx.post('/api/profiles/:id/context/new-page', async (req, res) => {
    const r = await handlers.newPageInternal(req.params.id, req.body || {});
    res.json(r);
  });
  appx.post('/api/profiles/:id/context/grant-permissions', async (req, res) => {
    const r = await handlers.grantPermissionsInternal(req.params.id, req.body || {});
    res.json(r);
  });
  appx.post('/api/profiles/:id/context/clear-permissions', async (req, res) => {
    const r = await handlers.clearPermissionsInternal(req.params.id);
    res.json(r);
  });
  appx.get('/api/profiles/:id/context/pages', async (req, res) => {
    const r = await handlers.listPagesInternal(req.params.id);
    res.json(r);
  });
  appx.post('/api/profiles/:id/context/extra-http-headers', async (req, res) => {
    const r = await handlers.setExtraHTTPHeadersInternal(req.params.id, req.body || {});
    res.json(r);
  });
  appx.post('/api/profiles/:id/context/geolocation', async (req, res) => {
    const r = await handlers.setGeolocationInternal(req.params.id, req.body || {});
    res.json(r);
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

  // ── Fingerprint Generator ──
  // Generate a random fingerprint (optionally constrained by os/language/timezone)
  appx.post('/api/fingerprint/generate', async (req, res) => {
    try {
      const { generateFingerprint } = require('../engine/fingerprintGenerator');
      const opts = req.body || {};
      const result = generateFingerprint({
        os: opts.os,
        language: opts.language,
        timezone: opts.timezone,
        seed: opts.seed ? Number(opts.seed) : undefined,
      });
      res.json({ success: true, ...result });
    } catch (e) { res.status(500).json({ success: false, error: e?.message || String(e) }); }
  });

  // Generate multiple fingerprints at once
  appx.post('/api/fingerprint/generate-batch', async (req, res) => {
    try {
      const { generateBatch } = require('../engine/fingerprintGenerator');
      const count = Math.min(50, Math.max(1, Number(req.body?.count || 1)));
      const opts = req.body || {};
      const results = generateBatch(count, { os: opts.os, language: opts.language, timezone: opts.timezone });
      res.json({ success: true, count: results.length, fingerprints: results });
    } catch (e) { res.status(500).json({ success: false, error: e?.message || String(e) }); }
  });

  // ── Behavior Simulator ──
  // Execute a behavior simulation on a running profile
  appx.post('/api/profiles/:id/behavior/simulate', async (req, res) => {
    try {
      const profileId = req.params.id;
      const { runningProfiles } = require('../state/runtime');
      const running = runningProfiles.get(profileId);
      if (!running) return res.status(404).json({ success: false, error: 'Profile not running' });
      if (running.engine !== 'playwright' || !running.context) {
        return res.status(400).json({ success: false, error: 'Behavior simulation requires Playwright engine with active context' });
      }
      const pages = running.context.pages();
      const pageIndex = Number(req.body?.pageIndex || 0);
      const page = pages[pageIndex] || pages[0];
      if (!page) return res.status(400).json({ success: false, error: 'No page available' });

      const behavior = require('../engine/behaviorSimulator');
      const seed = (profileId || 'default').split('').reduce((h, c) => ((h << 5) - h) + c.charCodeAt(0), 0);
      const rng = behavior.createRng(Math.abs(seed) + Date.now());

      const action = req.body?.action || 'browse';
      const opts = req.body?.options || {};

      switch (action) {
        case 'browse':
          await behavior.simulateBrowsing(page, rng, opts);
          break;
        case 'scroll':
          await behavior.naturalScroll(page, rng, opts);
          break;
        case 'move':
          await behavior.moveMouseCurved(page, rng, opts.x || 500, opts.y || 300, opts);
          break;
        case 'click':
          if (!opts.selector) return res.status(400).json({ success: false, error: 'selector is required for click action' });
          await behavior.humanClick(page, rng, opts.selector, opts);
          break;
        case 'type':
          if (!opts.selector || !opts.text) return res.status(400).json({ success: false, error: 'selector and text are required for type action' });
          await behavior.humanType(page, rng, opts.selector, opts.text, opts);
          break;
        case 'idle':
          await behavior.simulateIdle(page, rng, opts);
          break;
        default:
          return res.status(400).json({ success: false, error: `Unknown action: ${action}` });
      }

      res.json({ success: true, action });
    } catch (e) { res.status(500).json({ success: false, error: e?.message || String(e) }); }
  });

  // ── Blocked Page Detection ──
  // Check if a running profile's current page is blocked
  appx.get('/api/profiles/:id/blocked', async (req, res) => {
    try {
      const profileId = req.params.id;
      const { runningProfiles } = require('../state/runtime');
      const running = runningProfiles.get(profileId);
      if (!running) return res.status(404).json({ success: false, error: 'Profile not running' });

      const { detectBlockedPage } = require('../engine/blockedPageDetector');
      let page;

      if (running.engine === 'playwright' && running.context) {
        const pages = running.context.pages();
        page = pages[0];
      } else if (running.engine === 'cdp' && running.cdpControl?.context) {
        const pages = running.cdpControl.context.pages();
        page = pages[0];
      }

      if (!page) return res.status(400).json({ success: false, error: 'No page available' });
      const detection = await detectBlockedPage(page);
      res.json({ success: true, ...detection });
    } catch (e) { res.status(500).json({ success: false, error: e?.message || String(e) }); }
  });

  // ── Proxy Checker ──
  appx.post('/api/proxy/check', async (req, res) => {
    try {
      const { checkProxy } = require('../services/ProxyChecker');
      const cfg = req.body || {};
      if (!cfg.host || !cfg.port) return res.status(400).json({ success: false, error: 'host and port are required' });
      const result = await checkProxy(cfg);
      res.json(result);
    } catch (e) { res.status(500).json({ success: false, error: e?.message || String(e) }); }
  });

  // OpenAPI + Swagger UI
  appx.get('/openapi.json', (_req, res) => {
    try { res.type('application/json').send(require('fs').readFileSync(openapiPath, 'utf8')); }
    catch { res.status(404).json({ error: 'openapi not found' }); }
  });
  if (swaggerUi) {
    try {
      const spec = require('fs').existsSync(openapiPath) ? JSON.parse(require('fs').readFileSync(openapiPath, 'utf8')) : { openapi: '3.0.0', info: { title: 'HL-MCK API', version: '1.0.0' } };
      appx.use('/api-docs', swaggerUi.serve, swaggerUi.setup(spec));
    } catch { }
  }

  return appx;
}

function createRestServer({ settingsProvider, broadcaster, swaggerUi }) {
  let restHttpServer = null;
  const restServerState = { enabled: true, running: false, host: '127.0.0.1', port: 5478, error: null };
  const openapiPath = path.join(__dirname, '../api', 'openapi.json');
  const { appendLog } = require('../logging/logger');

  function broadcast() { broadcaster && broadcaster({ ...restServerState }); }

  async function start(handlers) {
    const settings = settingsProvider();
    const rest = settings.restApi || {};
    const enabled = rest.enabled !== false;
    const host = rest.host || '127.0.0.1';
    const port = Number(rest.port || 5478);
    restServerState.enabled = enabled; restServerState.host = host; restServerState.port = port; restServerState.error = null;
    if (!enabled) { restServerState.running = false; broadcast(); return { ok: false, disabled: true }; }

    if (restHttpServer) {
      try { const addr = restHttpServer.address(); if (addr && Number(addr.port) === port) { restServerState.running = true; restServerState.error = null; broadcast(); return { ok: true }; } } catch { }
      try { restHttpServer.close(); } catch { }
      restHttpServer = null; restServerState.running = false;
    }

    const appx = buildExpressApp(rest, swaggerUi, openapiPath, handlers);
    return new Promise((resolve) => {
      restHttpServer = appx.listen(port, host, () => {
        restServerState.running = true; restServerState.error = null; broadcast();
        appendLog('system', `REST API server started on ${host}:${port} — Swagger UI at /api-docs`);
        resolve({ ok: true });
      });
      restHttpServer.on('error', (err) => {
        restServerState.running = false;
        restServerState.error = err?.code === 'EADDRINUSE' ? `Port ${port} is already in use` : (err?.message || String(err));
        try { restHttpServer.close(); } catch { }
        restHttpServer = null; broadcast();
        appendLog('system', `REST API server failed to start: ${restServerState.error}`);
        resolve({ ok: false, error: restServerState.error });
      });
    });
  }

  async function stop() {
    if (!restHttpServer) { restServerState.running = false; broadcast(); return true; }
    const srv = restHttpServer; restHttpServer = null;
    return new Promise((resolve) => { try { srv.close(() => resolve(true)); } catch { resolve(false); } }).finally(() => {
      restServerState.running = false; broadcast();
      appendLog('system', 'REST API server stopped');
    });
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

  async function startWithPassword(handlers) {
    return await start(handlers);
  }

  function getState() { return { ...restServerState }; }

  return { start, stop, setEnabled, setPort, getState, startWithPassword };
}

module.exports = { createRestServer };
