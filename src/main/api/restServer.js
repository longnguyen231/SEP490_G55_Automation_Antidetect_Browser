const path = require("path");
const Fastify = require("fastify");
const fastifyCors = require("@fastify/cors");
const { WebSocketServer } = require("ws");

async function buildFastifyApp(rest, openapiPath, handlers) {
  const apiKey = rest.apiKey || process.env.REST_API_KEY;
  const appx = Fastify({ logger: false, bodyLimit: 2097152, ignoreTrailingSlash: true });
  await appx.register(fastifyCors, { origin: rest.allowedOrigins || true });

  function broadcastProfilesUpdated() {
    try {
      const { BrowserWindow } = require("electron");
      for (const w of BrowserWindow.getAllWindows()) {
        try {
          w.webContents.send("profiles-updated");
        } catch {}
      }
    } catch {}
  }

  // API key hook (optional) — docs are always public
  appx.addHook("preHandler", async (req, reply) => {
    const reqPath = req.url.split("?")[0];
    const isPublic = reqPath === "/openapi.json" || reqPath.startsWith("/docs") || reqPath === "/api/health";
    if (apiKey && !isPublic && req.headers["x-api-key"] !== apiKey) {
      return reply.code(401).send({ success: false, error: "Unauthorized" });
    }
  });

  // Health
  appx.get("/api/health", (_req, reply) => reply.send({ ok: true }));

  // Profiles CRUD
  appx.get("/api/profiles", async (_req, reply) => {
    const list = await handlers.getProfilesInternal();
    reply.send(list);
  });
  // Bulk operations (must be registered before /:id routes)
  appx.post("/api/profiles/bulk", async (req, reply) => {
    if (!handlers.saveProfilesBulkInternal) return reply.code(501).send({ success: false, error: 'Not implemented' });
    const result = await handlers.saveProfilesBulkInternal(req.body || []);
    if (result.success) broadcastProfilesUpdated();
    reply.code().send(result);
  });
  appx.delete("/api/profiles/bulk", async (req, reply) => {
    if (!handlers.deleteProfilesBulkInternal) return reply.code(501).send({ success: false, error: 'Not implemented' });
    const ids = req.body?.ids || [];
    // Stop running profiles first
    if (handlers.stopProfileInternal) {
      for (const id of ids) { try { await handlers.stopProfileInternal(id); } catch { } }
    }
    const result = await handlers.deleteProfilesBulkInternal(ids);
    if (result.success) broadcastProfilesUpdated();
    reply.code().send(result);
  });
  appx.post("/api/profiles/bulk-clone", async (req, reply) => {
    if (!handlers.cloneProfilesBulkInternal) return reply.code(501).send({ success: false, error: 'Not implemented' });
    const { ids, overrides } = req.body || {};
    const result = await handlers.cloneProfilesBulkInternal(ids || [], overrides || {});
    if (result.success) broadcastProfilesUpdated();
    reply.code().send(result);
  });
  appx.post("/api/profiles", async (req, reply) => {
    const result = await handlers.saveProfileInternal(req.body || {});
    if (result.success) broadcastProfilesUpdated();
    reply.code().send(result);
  });
  appx.put("/api/profiles/:id", async (req, reply) => {
    const list = await handlers.getProfilesInternal();
    if (!list.find((p) => p.id === req.params.id)) {
      return reply.code(404).send({ error: "Profile not found" });
    }
    const body = { ...(req.body || {}), id: req.params.id };
    const result = await handlers.saveProfileInternal(body);
    if (result.success) broadcastProfilesUpdated();
    reply.code().send(result);
  });
  appx.delete("/api/profiles/:id", async (req, reply) => {
    const list = await handlers.getProfilesInternal();
    if (!list.find((p) => p.id === req.params.id)) {
      return reply.code(404).send({ error: "Profile not found" });
    }
    const id = req.params.id;
    const result = await handlers.deleteProfileInternal(id);
    if (result.success) broadcastProfilesUpdated();
    reply.code().send(result);
  });

  // Launch/stop
  appx.post("/api/profiles/:id/launch", async (req, reply) => {
    const result = await handlers.launchProfileInternal(
      req.params.id,
      req.body || {},
    );
    reply.code().send(result);
  });
  appx.post("/api/profiles/:id/stop", async (req, reply) => {
    const result = await handlers.stopProfileInternal(req.params.id);
    reply.code().send(result);
  });
  // Run automation now
  appx.post("/api/profiles/:id/automation/run", async (req, reply) => {
    if (!handlers.runAutomationNowInternal)
      return reply.code(501).send({ success: false, error: "Not implemented" });
    const result = await handlers.runAutomationNowInternal(req.params.id);
    reply.code().send(result);
  });
  appx.post("/api/stop-all", async (_req, reply) => {
    const result = await handlers.stopAllProfilesInternal();
    reply.code().send(result);
  });

  // ── Browsers API (matching instructor spec) ──
  // POST /api/browsers/:profileId/launch
  appx.post("/api/browsers/:profileId/launch", async (req, reply) => {
    try {
      const { profileId } = req.params;
      const body = req.body || {};
      const opts = {};
      if (body.headless !== undefined) opts.headless = !!body.headless;
      const result = await handlers.launchProfileInternal(profileId, opts);
      reply.code().send(result);
    } catch (e) {
      reply.code(500).send({ success: false, error: e?.message || String(e) });
    }
  });

  // POST /api/browsers/:profileId/close
  appx.post("/api/browsers/:profileId/close", async (req, reply) => {
    try {
      const result = await handlers.stopProfileInternal(req.params.profileId);
      reply.code().send(result);
    } catch (e) {
      reply.code(500).send({ success: false, error: e?.message || String(e) });
    }
  });

  // GET /api/browsers/:profileId/status
  appx.get("/api/browsers/:profileId/status", async (req, reply) => {
    try {
      const { profileId } = req.params;
      const { runningProfiles } = require("../state/runtime");
      const running = runningProfiles.get(profileId);
      reply.send({ success: true, running: !!running, profileId });
    } catch (e) {
      reply.code(400).send({ error: e?.message || String(e) });
    }
  });

  // POST /api/browsers/:profileId/execute — generic Playwright page method dispatcher
  appx.post("/api/browsers/:profileId/execute", async (req, reply) => {
    try {
      const { profileId } = req.params;
      const { method, args = [], chain = [] } = req.body || {};
      if (!method) return reply.code(400).send({ success: false, error: '"method" is required' });

      const { runningProfiles } = require("../state/runtime");
      const running = runningProfiles.get(profileId);
      if (!running) return reply.code(404).send({ success: false, error: 'Profile not running' });

      // Get active page
      let page;
      if (running.engine === 'playwright' && running.context) {
        const pages = running.context.pages();
        page = pages[pages.length - 1] || pages[0];
      } else if (running.cdpControl?.context) {
        const pages = running.cdpControl.context.pages();
        page = pages[pages.length - 1] || pages[0];
      }
      if (!page) return reply.code(400).send({ success: false, error: 'No active page available' });

      // Execute method on page
      let target = page;
      if (typeof target[method] !== 'function') {
        // Try special sub-objects like keyboard, mouse, etc.
        const subObjs = ['keyboard', 'mouse', 'touchscreen'];
        let found = false;
        for (const sub of subObjs) {
          if (page[sub] && typeof page[sub][method] === 'function') {
            target = page[sub];
            found = true;
            break;
          }
        }
        if (!found) return reply.code(400).send({ success: false, error: `Method "${method}" not found on page` });
      }

      let result = await target[method](...args);

      // Execute chained methods
      for (const step of chain) {
        if (!step.method) continue;
        if (typeof result[step.method] !== 'function') {
          return reply.code(400).send({ success: false, error: `Chain method "${step.method}" not found` });
        }
        result = await result[step.method](...(step.args || []));
      }

      // Serialize result (Buffer → base64, etc.)
      let serialized = result;
      if (Buffer.isBuffer(result)) serialized = result.toString('base64');
      else if (typeof result === 'function') serialized = '[Function]';

      reply.send({ success: true, result: serialized });
    } catch (e) {
      reply.code(400).send({ success: false, error: e?.message || String(e) });
    }
  });

  // Running and WS
  appx.get("/api/running-map", async (_req, reply) => {
    const r = await handlers.getRunningMapInternal();
    reply.send(r);
  });
  appx.get("/api/profiles/:id/ws", async (req, reply) => {
    const r = await handlers.getProfileWsInternal(req.params.id);
    reply.send(r);
  });

  // Cookies
  appx.get("/api/profiles/:id/cookies", async (req, reply) => {
    const r = await handlers.getCookiesInternal(req.params.id);
    reply.send(r);
  });
  appx.post("/api/profiles/:id/cookies", async (req, reply) => {
    const r = await handlers.importCookiesInternal(
      req.params.id,
      req.body || [],
    );
    reply.send(r);
  });
  appx.put("/api/profiles/:id/cookies", async (req, reply) => {
    const r = await handlers.editCookieInternal(req.params.id, req.body || {});
    reply.send(r);
  });
  appx.delete("/api/profiles/:id/cookies", async (req, reply) => {
    const { name, domain, path: p } = req.query || {};
    if (name && domain) {
      const r = await handlers.deleteCookieInternal(req.params.id, {
        name,
        domain,
        path: p,
      });
      reply.send(r);
    } else {
      const r = await handlers.clearCookiesInternal(req.params.id);
      reply.send(r);
    }
  });

  // Logs and clone
  appx.get("/api/profiles/:id/log", async (req, reply) => {
    const r = await handlers.getProfileLogInternal(req.params.id);
    reply.send(r);
  });
  appx.post("/api/profiles/:id/clone", async (req, reply) => {
    const r = await handlers.cloneProfileInternal(
      req.params.id,
      req.body || {},
    );
    reply.send(r);
  });

  // Browser control endpoints (Mapped from Swagger)
  const mapAction = (actionName) => async (req, reply) => {
    try {
      const { performAction } = require("../engine/actions");
      const param = req.method === "GET" ? req.query : req.body;
      const result = await performAction(req.params.profileId, actionName, param || {});
      reply.code().send(result);
    } catch (e) {
      reply.code(500).send({ success: false, error: e?.message || String(e) });
    }
  };

  // Image 1: Basic Browser Navigation & Interactions
  appx.post("/api/browsers/:profileId/actions/navigate", mapAction("nav.goto"));
  appx.post("/api/browsers/:profileId/actions/reload", mapAction("nav.reload"));
  appx.post("/api/browsers/:profileId/actions/go-back", mapAction("nav.back"));
  appx.post("/api/browsers/:profileId/actions/go-forward", mapAction("nav.forward"));
  appx.get("/api/browsers/:profileId/actions/page-info", mapAction("page.info"));
  appx.get("/api/browsers/:profileId/actions/content", mapAction("page.content"));
  appx.post("/api/browsers/:profileId/actions/screenshot", mapAction("capture.screen"));
  appx.post("/api/browsers/:profileId/actions/click", mapAction("click.element"));
  appx.post("/api/browsers/:profileId/actions/double-click", mapAction("element.dblclick"));
  appx.post("/api/browsers/:profileId/actions/hover", mapAction("hover"));
  appx.post("/api/browsers/:profileId/actions/focus", mapAction("element.focus"));
  appx.post("/api/browsers/:profileId/actions/fill", mapAction("input.fill"));
  appx.post("/api/browsers/:profileId/actions/type", mapAction("input.type"));
  appx.post("/api/browsers/:profileId/actions/press-key", mapAction("keyboard.send"));
  appx.post("/api/browsers/:profileId/actions/select-option", mapAction("select.option"));

  // Image 2: Element checks, scrolling and waiting
  appx.post("/api/browsers/:profileId/actions/check", mapAction("input.check"));
  appx.post("/api/browsers/:profileId/actions/scroll", mapAction("scroll.elementToElement")); 
  appx.post("/api/browsers/:profileId/actions/tap", mapAction("click.tap"));
  appx.post("/api/browsers/:profileId/actions/drag-and-drop", mapAction("dragAndDrop"));
  appx.post("/api/browsers/:profileId/actions/dispatch-event", mapAction("element.dispatchEvent"));
  appx.post("/api/browsers/:profileId/actions/set-viewport-size", mapAction("viewport.set"));
  appx.post("/api/browsers/:profileId/actions/set-content", mapAction("page.setContent"));
  appx.post("/api/browsers/:profileId/actions/wait-for-navigation", mapAction("wait.navigation"));
  appx.post("/api/browsers/:profileId/actions/wait-for-selector", mapAction("wait")); 
  appx.post("/api/browsers/:profileId/actions/wait-for-url", mapAction("wait-for-url"));
  appx.post("/api/browsers/:profileId/actions/get-text", mapAction("element.text"));
  appx.post("/api/browsers/:profileId/actions/get-attribute", mapAction("element.attr"));
  appx.post("/api/browsers/:profileId/actions/get-value", mapAction("element.value"));
  appx.post("/api/browsers/:profileId/actions/get-inner-html", mapAction("element.html"));
  appx.post("/api/browsers/:profileId/actions/evaluate", mapAction("js.eval"));

  // Image 3: Cookies, scripts and visibility checks
  appx.post("/api/browsers/:profileId/actions/run-script", mapAction("script.runInline"));
  appx.get("/api/browsers/:profileId/actions/cookies", mapAction("cookies.get"));
  appx.post("/api/browsers/:profileId/actions/cookies", mapAction("cookies.set"));
  appx.delete("/api/browsers/:profileId/actions/cookies", mapAction("cookies.clear"));
  appx.post("/api/browsers/:profileId/actions/is-visible", mapAction("element.isVisible"));
  appx.post("/api/browsers/:profileId/actions/is-hidden", mapAction("element.isHidden"));
  appx.post("/api/browsers/:profileId/actions/is-checked", mapAction("element.isChecked"));
  appx.post("/api/browsers/:profileId/actions/is-enabled", mapAction("element.isEnabled"));
  appx.post("/api/browsers/:profileId/actions/is-disabled", mapAction("element.isDisabled"));
  appx.post("/api/browsers/:profileId/actions/is-editable", mapAction("element.isEditable"));
  appx.post("/api/browsers/:profileId/actions/text-content", mapAction("element.textContent"));
  appx.post("/api/browsers/:profileId/actions/wait-for-timeout", mapAction("wait")); 
  appx.post("/api/browsers/:profileId/actions/wait-for-load-state", mapAction("wait.loadState"));
  appx.post("/api/browsers/:profileId/actions/set-extra-http-headers", mapAction("headers.setExtra"));

  // Image 4: Keyboard & Mouse specifics
  appx.post("/api/browsers/:profileId/actions/add-init-script", mapAction("page.addInitScript"));
  appx.post("/api/browsers/:profileId/actions/keyboard/down", mapAction("keyboard.down"));
  appx.post("/api/browsers/:profileId/actions/keyboard/up", mapAction("keyboard.up"));
  appx.post("/api/browsers/:profileId/actions/keyboard/type", mapAction("keyboard.type"));
  appx.post("/api/browsers/:profileId/actions/keyboard/insert-text", mapAction("keyboard.insertText"));
  appx.post("/api/browsers/:profileId/actions/mouse/click", mapAction("click.at"));
  appx.post("/api/browsers/:profileId/actions/mouse/move", mapAction("mouse.move"));
  appx.post("/api/browsers/:profileId/actions/mouse/dblclick", mapAction("mouse.dblclick"));
  appx.post("/api/browsers/:profileId/actions/mouse/down", mapAction("mouse.down"));
  appx.post("/api/browsers/:profileId/actions/mouse/up", mapAction("mouse.up"));
  appx.post("/api/browsers/:profileId/actions/mouse/wheel", mapAction("mouse.wheel"));

  // Context endpoints
  appx.get("/api/browsers/:profileId/context/storage-state", async (req, reply) => {
    const r = await (handlers.getStorageStateInternal
      ? handlers.getStorageStateInternal(req.params.profileId)
      : { success: false, error: "Not implemented" });
    reply.send(r);
  });
  appx.post("/api/browsers/:profileId/context/new-page", mapAction("tab.new"));
  appx.get("/api/browsers/:profileId/context/pages", async (req, reply) => {
    const r = await handlers.listPagesInternal(req.params.profileId);
    reply.send(r);
  });
  appx.post("/api/browsers/:profileId/context/extra-http-headers", mapAction("headers.setExtra"));
  appx.post("/api/browsers/:profileId/context/grant-permissions", async (req, reply) => {
    const r = await handlers.grantPermissionsInternal(req.params.profileId, req.body || {});
    reply.send(r);
  });
  appx.post("/api/browsers/:profileId/context/clear-permissions", async (req, reply) => {
    const r = await handlers.clearPermissionsInternal(req.params.profileId);
    reply.send(r);
  });
  appx.post("/api/browsers/:profileId/context/geolocation", mapAction("geolocation.set"));

  // Generic action dispatcher and helpers
  appx.get("/api/actions", async (_req, reply) => {
    try {
      const { getActionNames } = require("../engine/actions");
      reply.send({ success: true, actions: getActionNames() });
    } catch (e) {
      reply.code(500).send({ success: false, error: e?.message || String(e) });
    }
  });
  appx.post("/api/profiles/:id/action/:name", async (req, reply) => {
    try {
      const { performAction } = require("../engine/actions");
      const result = await performAction(
        req.params.id,
        req.params.name,
        req.body || {},
      );
      reply.code().send(result);
    } catch (e) {
      reply.code(500).send({ success: false, error: e?.message || String(e) });
    }
  });

  // ── Tasks API ──
  // GET /api/tasks/ — list tasks (optionally filtered by profileId)
  appx.get("/api/tasks", async (req, reply) => {
    try {
      const { getTaskLogs } = require("../storage/taskLogs");
      let list = await getTaskLogs();
      if (req.query.profileId) list = list.filter(t => t.profileId === req.query.profileId);
      reply.send({ success: true, tasks: list });
    } catch (e) {
      reply.code(500).send({ success: false, error: e?.message || String(e) });
    }
  });


  // POST /api/tasks/ — create a new task
  appx.post("/api/tasks", async (req, reply) => {
    try {
      const { addTaskLog } = require("../storage/taskLogs");
      const body = req.body || {};
      if (!body.profileId) return reply.code(400).send({ success: false, error: '"profileId" is required' });
      if (!body.name) return reply.code(400).send({ success: false, error: '"name" is required' });
      if (!body.scriptContent) return reply.code(400).send({ success: false, error: '"scriptContent" is required' });

      const entry = {
        scriptId: body.scriptId || '',
        scriptName: body.name,
        profileId: body.profileId,
        status: 'pending',
        startedAt: new Date().toISOString(),
        finishedAt: null,
        logs: [],
        _scriptType: body.scriptType || 'inline',
        _scriptContent: body.scriptContent,
      };
      const r = await addTaskLog(entry);
      reply.code().send(r);
    } catch (e) {
      reply.code(500).send({ success: false, error: e?.message || String(e) });
    }
  });


  // POST /api/tasks/:id/run — enqueue a task for execution
  appx.post("/api/tasks/:id/run", async (req, reply) => {
    try {
      const { getTaskLogById, addTaskLog } = require("../storage/taskLogs");
      const { executeScript } = require("../engine/scriptRuntime");
      const found = await getTaskLogById(req.params.id);
      if (!found.success) return reply.code(404).send(found);
      const task = found.taskLog;
      if (!task._scriptContent) {
        return reply.code(400).send({ success: false, error: 'Task has no scriptContent to execute' });
      }
      // Run async (fire and forget — update status after)
      executeScript(task.profileId, task._scriptContent, { timeoutMs: 120000 }).then(async (result) => {
        await addTaskLog({
          ...task,
          id: undefined,
          status: result.success ? 'completed' : 'error',
          finishedAt: new Date().toISOString(),
          error: result.error || null,
          logs: result.logs || [],
        });
      }).catch(() => {});
      reply.send({ success: true, message: 'Task enqueued', taskId: req.params.id });
    } catch (e) {
      reply.code(500).send({ success: false, error: e?.message || String(e) });
    }
  });

  // POST /api/tasks/:id/cancel
  appx.post("/api/tasks/:id/cancel", async (req, reply) => {
    try {
      const { stopScript } = require("../engine/scriptRuntime");
      const r = stopScript ? stopScript(req.params.id) : { success: true };
      reply.send({ success: true, message: 'Cancel requested', result: r });
    } catch (e) {
      reply.code(500).send({ success: false, error: e?.message || String(e) });
    }
  });

  // DELETE /api/tasks/:id
  appx.delete("/api/tasks/:id", async (req, reply) => {
    try {
      const { deleteTaskLog } = require("../storage/taskLogs");
      const r = await deleteTaskLog(req.params.id);
      reply.code().send(r);
    } catch (e) {
      reply.code(500).send({ success: false, error: e?.message || String(e) });
    }
  });

  // ── Proxies API ──
  // GET /api/proxies/
  appx.get("/api/proxies", async (_req, reply) => {
    try {
      const { getProxiesInternal } = require("../storage/proxies");
      const list = await getProxiesInternal();
      reply.send({ success: true, proxies: list });
    } catch (e) {
      reply.code(500).send({ success: false, error: e?.message || String(e) });
    }
  });


  // GET /api/proxies/unassigned — proxies not assigned to any profile
  appx.get("/api/proxies/unassigned", async (_req, reply) => {
    try {
      const { getProxiesInternal } = require("../storage/proxies");
      const { getProfilesInternal } = require("../storage/profiles");
      const proxies = await getProxiesInternal();
      const profiles = await getProfilesInternal();
      // Collect all proxy IDs that are assigned to profiles
      const assignedIds = new Set(
        profiles.map(p => p.proxy?.id).filter(Boolean)
      );
      const unassigned = proxies.filter(px => !assignedIds.has(px.id));
      reply.send({ success: true, proxies: unassigned });
    } catch (e) {
      reply.code(500).send({ success: false, error: e?.message || String(e) });
    }
  });

  // POST /api/proxies/ — create a new proxy
  appx.post("/api/proxies", async (req, reply) => {
    try {
      const { createProxyInternal } = require("../storage/proxies");
      const r = await createProxyInternal(req.body || {});
      reply.code().send(r);
    } catch (e) {
      reply.code(500).send({ success: false, error: e?.message || String(e) });
    }
  });


  // PUT /api/proxies/:id
  appx.put("/api/proxies/:id", async (req, reply) => {
    try {
      const { updateProxyInternal } = require("../storage/proxies");
      const r = await updateProxyInternal(req.params.id, req.body || {});
      reply.code(r.success ? 200 : (r.error === 'Proxy not found' ? 404 : 400)).send(r);
    } catch (e) {
      reply.code(500).send({ success: false, error: e?.message || String(e) });
    }
  });

  // DELETE /api/proxies/:id
  appx.delete("/api/proxies/:id", async (req, reply) => {
    try {
      const { deleteProxyInternal } = require("../storage/proxies");
      const r = await deleteProxyInternal(req.params.id);
      reply.code().send(r);
    } catch (e) {
      reply.code(500).send({ success: false, error: e?.message || String(e) });
    }
  });

  // POST /api/proxies/:id/assign — assign proxy to a profile
  appx.post("/api/proxies/:id/assign", async (req, reply) => {
    try {
      const { getProxyByIdInternal } = require("../storage/proxies");
      const { profileId } = req.body || {};
      if (!profileId) return reply.code(400).send({ success: false, error: '"profileId" is required' });

      const proxyResult = await getProxyByIdInternal(req.params.id);
      if (!proxyResult.success) return reply.code(404).send(proxyResult);

      const profiles = await handlers.getProfilesInternal();
      const profile = profiles.find(p => p.id === profileId);
      if (!profile) return reply.code(404).send({ success: false, error: 'Profile not found' });

      const updated = { ...profile, proxy: proxyResult.proxy };
      const r = await handlers.saveProfileInternal(updated);
      if (r.success) broadcastProfilesUpdated();
      reply.code().send({ success: r.success, message: 'Proxy assigned', proxy: proxyResult.proxy });
    } catch (e) {
      reply.code(500).send({ success: false, error: e?.message || String(e) });
    }
  });

  // POST /api/proxies/unassign — remove proxy from a profile
  appx.post("/api/proxies/unassign", async (req, reply) => {
    try {
      const { profileId } = req.body || {};
      if (!profileId) return reply.code(400).send({ success: false, error: '"profileId" is required' });

      const profiles = await handlers.getProfilesInternal();
      const profile = profiles.find(p => p.id === profileId);
      if (!profile) return reply.code(404).send({ success: false, error: 'Profile not found' });

      const updated = { ...profile, proxy: null };
      const r = await handlers.saveProfileInternal(updated);
      if (r.success) broadcastProfilesUpdated();
      reply.code().send({ success: r.success, message: 'Proxy unassigned' });
    } catch (e) {
      reply.code(500).send({ success: false, error: e?.message || String(e) });
    }
  });

  // ── Fingerprints API ──
  // POST /api/fingerprints/preview — generate fingerprint without saving
  appx.post("/api/fingerprints/preview", async (req, reply) => {
    try {
      const { generateFingerprint } = require("../engine/fingerprintGenerator");
      const body = req.body || {};
      // Map API os names (lowercase) to internal names (capitalized)
      const osMap = { windows: 'Windows', macos: 'macOS', linux: 'Linux' };
      const browserMap = { chrome: 'Chrome', firefox: 'Firefox', edge: 'Chrome' };
      const opts = {};
      if (body.os) opts.os = osMap[body.os] || body.os;
      if (body.browser) opts.browser = browserMap[body.browser] || body.browser;
      if (body.locale) opts.language = body.locale;
      const result = generateFingerprint(opts);
      reply.send({ success: true, ...result });
    } catch (e) {
      reply.code(500).send({ success: false, error: e?.message || String(e) });
    }
  });

  // POST /api/fingerprints/:profileId/generate — generate and save for a profile
  appx.post("/api/fingerprints/:profileId/generate", async (req, reply) => {
    try {
      const { generateFingerprint } = require("../engine/fingerprintGenerator");
      const { profileId } = req.params;
      const body = req.body || {};
      const osMap = { windows: 'Windows', macos: 'macOS', linux: 'Linux' };
      const browserMap = { chrome: 'Chrome', firefox: 'Firefox', edge: 'Chrome' };
      const opts = {};
      if (body.os) opts.os = osMap[body.os] || body.os;
      if (body.browser) opts.browser = browserMap[body.browser] || body.browser;
      if (body.locale) opts.language = body.locale;

      const fp = generateFingerprint(opts);
      const profiles = await handlers.getProfilesInternal();
      const profile = profiles.find(p => p.id === profileId);
      if (!profile) return reply.code(404).send({ success: false, error: 'Profile not found' });

      const updated = {
        ...profile,
        fingerprint: { ...profile.fingerprint, ...fp.fingerprint },
        settings: { ...profile.settings, ...fp.settings },
      };
      const r = await handlers.saveProfileInternal(updated);
      if (r.success) broadcastProfilesUpdated();
      reply.code().send({ success: r.success, fingerprint: fp.fingerprint, settings: fp.settings });
    } catch (e) {
      reply.code(500).send({ success: false, error: e?.message || String(e) });
    }
  });

  // PUT /api/fingerprints/:profileId — save manual fingerprint config
  appx.put("/api/fingerprints/:profileId", async (req, reply) => {
    try {
      const { profileId } = req.params;
      const fingerprintConfig = req.body || {};
      const profiles = await handlers.getProfilesInternal();
      const profile = profiles.find(p => p.id === profileId);
      if (!profile) return reply.code(404).send({ success: false, error: 'Profile not found' });

      const updated = { ...profile, fingerprint: { ...profile.fingerprint, ...fingerprintConfig } };
      const r = await handlers.saveProfileInternal(updated);
      if (r.success) broadcastProfilesUpdated();
      reply.code().send(r);
    } catch (e) {
      reply.code(500).send({ success: false, error: e?.message || String(e) });
    }
  });

  // Scripts management (CRUD + execute)
  appx.get("/api/scripts", async (_req, reply) => {
    try {
      const { listScriptsInternal } = require("../storage/scripts");
      const list = await listScriptsInternal();
      reply.send(list);
    } catch (e) {
      reply.code(500).send({ success: false, error: e?.message || String(e) });
    }
  });
  appx.get("/api/scripts/:id", async (req, reply) => {
    try {
      const { getScriptInternal } = require("../storage/scripts");
      const r = await getScriptInternal(req.params.id);
      reply.code().send(r);
    } catch (e) {
      reply.code(500).send({ success: false, error: e?.message || String(e) });
    }
  });
  appx.post("/api/scripts", async (req, reply) => {
    try {
      const { saveScriptInternal } = require("../storage/scripts");
      const r = await saveScriptInternal(req.body || {});
      reply.code().send(r);
    } catch (e) {
      reply.code(500).send({ success: false, error: e?.message || String(e) });
    }
  });
  appx.put("/api/scripts/:id", async (req, reply) => {
    try {
      const { saveScriptInternal } = require("../storage/scripts");
      const payload = { ...(req.body || {}), id: req.params.id };
      const r = await saveScriptInternal(payload);
      reply.code().send(r);
    } catch (e) {
      reply.code(500).send({ success: false, error: e?.message || String(e) });
    }
  });
  appx.delete("/api/scripts/:id", async (req, reply) => {
    try {
      const { deleteScriptInternal } = require("../storage/scripts");
      const r = await deleteScriptInternal(req.params.id);
      reply.code().send(r);
    } catch (e) {
      reply.code(500).send({ success: false, error: e?.message || String(e) });
    }
  });
  // Execute a script for a profile
  appx.post("/api/profiles/:id/scripts/:sid/execute", async (req, reply) => {
    try {
      const { getScriptInternal } = require("../storage/scripts");
      const { executeScript } = require("../engine/scriptRuntime");
      const g = await getScriptInternal(req.params.sid);
      if (!g.success) return reply.code(404).send(g);
      const r = await executeScript(req.params.id, g.script.code || "", {
        timeoutMs: Math.min(300000, Number(req.body?.timeoutMs || 120000)),
      });
      reply.code().send(r);
    } catch (e) {
      reply.code(500).send({ success: false, error: e?.message || String(e) });
    }
  });

  // Locales/timezones
  appx.get("/api/locales-timezones", async (_req, reply) => {
    const r = await handlers.getLocalesTimezonesInternal();
    reply.send(r);
  });

  // ── Fingerprint Generator ──
  // Generate a random fingerprint (optionally constrained by os/language/timezone)
  appx.post("/api/fingerprint/generate", async (req, reply) => {
    try {
      const { generateFingerprint } = require("../engine/fingerprintGenerator");
      const opts = req.body || {};
      const result = generateFingerprint({
        os: opts.os,
        language: opts.language,
        timezone: opts.timezone,
        seed: opts.seed ? Number(opts.seed) : undefined,
      });
      reply.send({ success: true, ...result });
    } catch (e) {
      reply.code(500).send({ success: false, error: e?.message || String(e) });
    }
  });

  // Generate multiple fingerprints at once
  appx.post("/api/fingerprint/generate-batch", async (req, reply) => {
    try {
      const { generateBatch } = require("../engine/fingerprintGenerator");
      const count = Math.min(50, Math.max(1, Number(req.body?.count || 1)));
      const opts = req.body || {};
      const results = generateBatch(count, {
        os: opts.os,
        language: opts.language,
        timezone: opts.timezone,
      });
      reply.send({ success: true, count: results.length, fingerprints: results });
    } catch (e) {
      reply.code(500).send({ success: false, error: e?.message || String(e) });
    }
  });

  // ── Behavior Simulator ──
  // Execute a behavior simulation on a running profile
  appx.post("/api/profiles/:id/behavior/simulate", async (req, reply) => {
    try {
      const profileId = req.params.id;
      const { runningProfiles } = require("../state/runtime");
      const running = runningProfiles.get(profileId);
      if (!running)
        return res
          .status(404)
          .json({ success: false, error: "Profile not running" });
      if (running.engine !== "playwright" || !running.context) {
        return res
          .status(400)
          .json({
            success: false,
            error:
              "Behavior simulation requires Playwright engine with active context",
          });
      }
      const pages = running.context.pages();
      const pageIndex = Number(req.body?.pageIndex || 0);
      const page = pages[pageIndex] || pages[0];
      if (!page)
        return res
          .status(400)
          .json({ success: false, error: "No page available" });

      const behavior = require("../engine/behaviorSimulator");
      const seed = (profileId || "default")
        .split("")
        .reduce((h, c) => (h << 5) - h + c.charCodeAt(0), 0);
      const rng = behavior.createRng(Math.abs(seed) + Date.now());

      const action = req.body?.action || "browse";
      const opts = req.body?.options || {};

      switch (action) {
        case "browse":
          await behavior.simulateBrowsing(page, rng, opts);
          break;
        case "scroll":
          await behavior.naturalScroll(page, rng, opts);
          break;
        case "move":
          await behavior.moveMouseCurved(
            page,
            rng,
            opts.x || 500,
            opts.y || 300,
            opts,
          );
          break;
        case "click":
          if (!opts.selector)
            return res
              .status(400)
              .json({
                success: false,
                error: "selector is required for click action",
              });
          await behavior.humanClick(page, rng, opts.selector, opts);
          break;
        case "type":
          if (!opts.selector || !opts.text)
            return res
              .status(400)
              .json({
                success: false,
                error: "selector and text are required for type action",
              });
          await behavior.humanType(page, rng, opts.selector, opts.text, opts);
          break;
        case "idle":
          await behavior.simulateIdle(page, rng, opts);
          break;
        default:
          return res
            .status(400)
            .json({ success: false, error: `Unknown action: ${action}` });
      }

      reply.send({ success: true, action });
    } catch (e) {
      reply.code(500).send({ success: false, error: e?.message || String(e) });
    }
  });

  // ── Blocked Page Detection ──
  // Check if a running profile's current page is blocked
  appx.get("/api/profiles/:id/blocked", async (req, reply) => {
    try {
      const profileId = req.params.id;
      const { runningProfiles } = require("../state/runtime");
      const running = runningProfiles.get(profileId);
      if (!running)
        return res
          .status(404)
          .json({ success: false, error: "Profile not running" });

      const { detectBlockedPage } = require("../engine/blockedPageDetector");
      let page;

      if (running.engine === "playwright" && running.context) {
        const pages = running.context.pages();
        page = pages[0];
      } else if (running.engine === "cdp" && running.cdpControl?.context) {
        const pages = running.cdpControl.context.pages();
        page = pages[0];
      }

      if (!page)
        return res
          .status(400)
          .json({ success: false, error: "No page available" });
      const detection = await detectBlockedPage(page);
      reply.send({ success: true, ...detection });
    } catch (e) {
      reply.code(500).send({ success: false, error: e?.message || String(e) });
    }
  });

  // ── Proxy Checker ──
  appx.post("/api/proxy/check", async (req, reply) => {
    try {
      const { checkProxy } = require("../services/ProxyChecker");
      const cfg = req.body || {};
      if (!cfg.host || !cfg.port)
        return reply.code(400).send({ success: false, error: "host and port are required" });
      const result = await checkProxy(cfg);
      reply.send(result);
    } catch (e) {
      reply.code(500).send({ success: false, error: e?.message || String(e) });
    }
  });

  // ── OpenAPI spec at /openapi.json ──
  appx.get("/openapi.json", async (_req, reply) => {
    try {
      reply.type("application/json").send(require("fs").readFileSync(openapiPath, "utf8"));
    } catch {
      reply.code(404).send({ error: "openapi not found" });
    }
  });

  // ── Fastify Swagger UI (@fastify/swagger + @fastify/swagger-ui) ──
  try {
    const spec = require("fs").existsSync(openapiPath)
      ? JSON.parse(require("fs").readFileSync(openapiPath, "utf8"))
      : { openapi: "3.0.0", info: { title: "HL-MCK API", version: "1.0.0" } };

    await appx.register(require("@fastify/swagger"), {
      mode: "static",
      specification: { document: spec },
    });

    await appx.register(require("@fastify/swagger-ui"), {
      routePrefix: "/docs",
      uiConfig: {
        docExpansion: "list",
        deepLinking: true,
        defaultModelsExpandDepth: -1,
      },
      staticCSP: false,
    });
  } catch (e) {
    console.error("Swagger registration error:", e?.message || e);
  }

  return appx;
}

function createRestServer({ settingsProvider, broadcaster }) {
  let restHttpServer = null;
  let restFastifyInstance = null;
  let wss = null;
  // Map<WebSocket, string> — tracks which profileId each client is subscribed to
  const wsClients = new Map();
  const restServerState = {
    enabled: true,
    running: false,
    host: "127.0.0.1",
    port: 4000,
    error: null,
  };
  const openapiPath = path.join(__dirname, "../api", "openapi.json");
  const { appendLog } = require("../logging/logger");

  function broadcast() {
    broadcaster && broadcaster({ ...restServerState });
  }

  async function start(handlers) {
    const settings = settingsProvider();
    const rest = settings.restApi || {};
    const enabled = rest.enabled !== false;
    const host = rest.host || "127.0.0.1";
    const port = Number(rest.port || 4000);
    restServerState.enabled = enabled;
    restServerState.host = host;
    restServerState.port = port;
    restServerState.error = null;
    if (!enabled) {
      restServerState.running = false;
      broadcast();
      return { ok: false, disabled: true };
    }

    if (restFastifyInstance) {
      try {
        const addr = restFastifyInstance.server?.address();
        if (addr && Number(addr.port) === port) {
          restServerState.running = true;
          restServerState.error = null;
          broadcast();
          return { ok: true };
        }
      } catch {}
      try { await restFastifyInstance.close(); } catch {}
      restFastifyInstance = null;
      restHttpServer = null;
      restServerState.running = false;
    }

    try {
      const appx = await buildFastifyApp(rest, openapiPath, handlers);
      await appx.listen({ port, host });
      restFastifyInstance = appx;
      restHttpServer = appx.server;
      restServerState.running = true;
      restServerState.error = null;
      broadcast();
      try { attachPreviewWebSocket(); } catch (e) {
        appendLog("system", `Preview WebSocket attach failed: ${e?.message || e}`);
      }
      appendLog("system", `REST API server started on ${host}:${port} — Fastify Swagger UI at /docs`);
      return { ok: true };
    } catch (err) {
      restServerState.running = false;
      restServerState.error =
        err?.code === "EADDRINUSE"
          ? `Port ${port} is already in use`
          : err?.message || String(err);
      restFastifyInstance = null;
      restHttpServer = null;
      broadcast();
      appendLog("system", `REST API server failed to start: ${restServerState.error}`);
      return { ok: false, error: restServerState.error };
    }
  }

  async function stop() {
    if (!restFastifyInstance) {
      restServerState.running = false;
      broadcast();
      return true;
    }
    const inst = restFastifyInstance;
    restFastifyInstance = null;
    restHttpServer = null;
    try { await inst.close(); } catch {}
    restServerState.running = false;
    broadcast();
    appendLog("system", "REST API server stopped");
    return true;
  }

  async function setEnabled(enabled, handlers) {
    const st = settingsProvider();
    const rest = st.restApi || {};
    rest.enabled = !!enabled;
    st.restApi = rest;
    settingsProvider.set?.(st);
    restServerState.enabled = !!enabled;
    if (enabled) return await start(handlers);
    else {
      await stop();
      return { ok: true };
    }
  }

  async function setPort(port, handlers) {
    const n = Number(port);
    if (!Number.isInteger(n) || n < 1 || n > 65535)
      return { ok: false, error: "Invalid port" };
    const st = settingsProvider();
    const rest = st.restApi || {};
    rest.port = n;
    st.restApi = rest;
    settingsProvider.set?.(st);
    restServerState.port = n;
    await stop();
    return await start(handlers);
  }

  async function startWithPassword(handlers) {
    return await start(handlers);
  }

  function getState() {
    return { ...restServerState };
  }

  function setBroadcaster(fn) { broadcaster = fn; }

  /**
   * Attach WebSocket server on /preview path for live screenshot streaming.
   * Uses noServer mode to share port 4000 with Express.
   */
  function attachPreviewWebSocket() {
    if (!restHttpServer) return;
    // Clean up previous WSS if server was restarted
    if (wss) {
      try { wss.close(); } catch {}
      wss = null;
      wsClients.clear();
    }
    wss = new WebSocketServer({ noServer: true });

    restHttpServer.on('upgrade', (request, socket, head) => {
      const url = new URL(request.url || '', 'http://localhost');
      if (url.pathname === '/preview') {
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit('connection', ws, request);
        });
      } else {
        socket.destroy();
      }
    });

    wss.on('connection', (ws, request) => {
      // Client sends { action: 'subscribe', profileId } to start receiving frames
      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(String(data));
          if (msg.action === 'subscribe' && msg.profileId) {
            wsClients.set(ws, msg.profileId);
          } else if (msg.action === 'unsubscribe') {
            wsClients.delete(ws);
          }
        } catch { /* ignore non-JSON messages */ }
      });

      ws.on('close', () => {
        wsClients.delete(ws);
      });

      ws.on('error', () => {
        wsClients.delete(ws);
      });
    });

    // Register broadcast function with ScreencastManager
    try {
      const { setWsBroadcast } = require('../engine/screencast');
      setWsBroadcast(broadcastPreviewFrame);
    } catch (e) {
      appendLog('system', `ScreencastManager broadcast setup failed: ${e?.message || e}`);
    }

    appendLog('system', 'Preview WebSocket server attached on /preview');
  }

  /**
   * Broadcast a JPEG frame (base64) to all WebSocket clients subscribed to this profile.
   * Implements backpressure: skips frame if client's send buffer > 128KB.
   */
  function broadcastPreviewFrame(profileId, base64Frame) {
    if (!wss) return;
    const message = JSON.stringify({ profileId, frame: base64Frame });
    for (const [client, subscribedId] of wsClients.entries()) {
      if (subscribedId !== profileId) continue;
      if (client.readyState !== 1) continue; // WebSocket.OPEN = 1
      // Backpressure: skip frame if client is behind (> 128KB buffered)
      if (client.bufferedAmount > 131072) continue;
      try {
        client.send(message);
      } catch { /* client may have disconnected */ }
    }
  }

  return { start, stop, setEnabled, setPort, getState, startWithPassword, setBroadcaster };
}

module.exports = { createRestServer };
