const path = require("path");
const Fastify = require("fastify");
const fastifyCors = require("@fastify/cors");
const { WebSocketServer } = require("ws");

async function buildFastifyApp(rest, openapiPath, handlers) {
  const apiKey = rest.apiKey || process.env.REST_API_KEY;
  const appx = Fastify({
    logger: false,
    bodyLimit: 2097152,
    ignoreTrailingSlash: true,
  });
  await appx.register(fastifyCors, { origin: rest.allowedOrigins || true });

  // ── Fault-tolerant JSON body parser ──
  // Swagger UI / curl sometimes sends bodies with literal newlines or invalid escape
  // sequences inside string values (e.g. \' which is not valid JSON).
  // This parser sanitizes those before JSON.parse so API calls don't fail with 400.
  appx.addContentTypeParser(
    "application/json",
    { parseAs: "string" },
    (req, body, done) => {
      try {
        done(null, JSON.parse(body));
      } catch (_e) {
        // Second attempt: scan char-by-char to escape control chars inside JSON strings
        try {
          let out = "";
          let inStr = false;
          let escaped = false;
          const s =
            (body || "").charCodeAt(0) === 0xfeff ? body.slice(1) : body;
          for (let i = 0; i < s.length; i++) {
            const ch = s[i];
            if (escaped) {
              out += ch;
              escaped = false;
              continue;
            }
            if (ch === "\\" && inStr) {
              escaped = true;
              out += ch;
              continue;
            }
            if (ch === '"') {
              inStr = !inStr;
              out += ch;
              continue;
            }
            if (inStr) {
              if (ch === "\n") {
                out += "\\n";
                continue;
              }
              if (ch === "\r") {
                out += "\\r";
                continue;
              }
              if (ch === "\t") {
                out += "\\t";
                continue;
              }
              if (ch === "\b") {
                out += "\\b";
                continue;
              }
              if (ch === "\f") {
                out += "\\f";
                continue;
              }
            }
            out += ch;
          }
          done(null, JSON.parse(out));
        } catch (e2) {
          const err = new Error("Body is not valid JSON");
          err.statusCode = 400;
          done(err, undefined);
        }
      }
    },
  );

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

  function broadcastScriptsUpdated() {
    try {
      const { BrowserWindow } = require("electron");
      for (const w of BrowserWindow.getAllWindows()) {
        try {
          w.webContents.send("scripts-updated");
        } catch {}
      }
    } catch {}
  }

  function broadcastTaskLogsUpdated() {
    try {
      const { BrowserWindow } = require("electron");
      for (const w of BrowserWindow.getAllWindows()) {
        try {
          w.webContents.send("task-logs-updated");
        } catch {}
      }
    } catch {}
  }

  function broadcastProxiesUpdated() {
    try {
      const { BrowserWindow } = require("electron");
      for (const w of BrowserWindow.getAllWindows()) {
        try {
          w.webContents.send("proxies-updated");
        } catch {}
      }
    } catch {}
  }

  // API key hook (optional) — docs are always public
  appx.addHook("preHandler", async (req, reply) => {
    const reqPath = req.url.split("?")[0];
    const isPublic =
      reqPath === "/openapi.json" ||
      reqPath.startsWith("/docs") ||
      reqPath === "/api/health";
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
    if (!handlers.saveProfilesBulkInternal)
      return reply.code(501).send({ success: false, error: "Not implemented" });
    const result = await handlers.saveProfilesBulkInternal(req.body || []);
    if (result.success) broadcastProfilesUpdated();
    reply.send(result);
  });
  appx.delete("/api/profiles/bulk", async (req, reply) => {
    if (!handlers.deleteProfilesBulkInternal)
      return reply.code(501).send({ success: false, error: "Not implemented" });
    const ids = req.body?.ids || [];
    // Stop running profiles first
    if (handlers.stopProfileInternal) {
      for (const id of ids) {
        try {
          await handlers.stopProfileInternal(id);
        } catch {}
      }
    }
    const result = await handlers.deleteProfilesBulkInternal(ids);
    if (result.success) broadcastProfilesUpdated();
    reply.send(result);
  });
  appx.post("/api/profiles/bulk-clone", async (req, reply) => {
    if (!handlers.cloneProfilesBulkInternal)
      return reply.code(501).send({ success: false, error: "Not implemented" });
    const { ids, overrides } = req.body || {};
    const result = await handlers.cloneProfilesBulkInternal(
      ids || [],
      overrides || {},
    );
    if (result.success) broadcastProfilesUpdated();
    reply.send(result);
  });
  appx.post("/api/profiles", async (req, reply) => {
    try {
      const body = req.body || {};
      if (!body.name || !String(body.name).trim()) {
        return reply
          .code(400)
          .send({ success: false, error: '"name" is required' });
      }
      // Check license limit for new profile creation
      const { readProfiles } = require("../storage/profiles");
      const existing = readProfiles();
      const { isLicenseOk } = (() => {
        try {
          const fs = require("fs");
          const path = require("path");
          const { app } = require("electron");
          const licensePath = path.join(
            app.getPath("userData"),
            "license.json",
          );
          if (fs.existsSync(licensePath)) {
            const lic = JSON.parse(fs.readFileSync(licensePath, "utf8"));
            return { isLicenseOk: lic && lic.activated === true };
          }
        } catch {}
        return { isLicenseOk: false };
      })();
      if (!isLicenseOk && existing.length >= 5) {
        return reply.code(403).send({
          success: false,
          error:
            "Free plan giới hạn tối đa 5 profiles. Vui lòng kích hoạt license để tạo thêm.",
        });
      }

      // ── Map fingerprintOptions → generateFingerprint opts ──
      const fpOpts = body.fingerprintOptions || {};
      const osMap = { windows: "Windows", macos: "macOS", linux: "Linux" };
      const browserMap = {
        chrome: "Chrome",
        firefox: "Firefox",
        edge: "Chrome",
      };

      const genOpts = {};
      if (fpOpts.os) genOpts.os = osMap[fpOpts.os] || fpOpts.os;
      if (fpOpts.browser)
        genOpts.browser = browserMap[fpOpts.browser] || fpOpts.browser;

      // Validate locale: must be a real BCP-47 tag (e.g. "en-US", "vi-VN")
      // Reject placeholder values like "string", "locale", single words without hyphen, etc.
      const BCP47_RE = /^[a-z]{2,3}-[A-Z]{2,4}(-[A-Za-z0-9]+)*$/;
      if (
        fpOpts.locale &&
        typeof fpOpts.locale === "string" &&
        BCP47_RE.test(fpOpts.locale)
      ) {
        genOpts.language = fpOpts.locale;
      }
      // If locale is invalid/placeholder → let generator pick a random realistic locale

      // Generate base fingerprint
      const { generateFingerprint } = require("../engine/fingerprintGenerator");
      const generated = generateFingerprint(genOpts);
      const fp = generated.fingerprint;
      const genSettings = generated.settings;

      // ── Enrich fingerprint to match ALL fields UI's generateConsistentFingerprint() produces ──
      // The backend generator only produces basic fields. UI adds canvas/webgl/audio noise,
      // fonts, colorDepth, pixelRatio, etc. Missing fields = browser leaks real values.
      const randInt = (min, max) =>
        Math.floor(Math.random() * (max - min + 1)) + min;
      const randFrom = (arr) => arr[Math.floor(Math.random() * arr.length)];

      const enrichedFingerprint = {
        ...fp,
        canvasNoise: randInt(100000000, 2100000000),
        canvasNoiseIntensity: randFrom([1, 2, 3, 4, 5]),
        webglNoise: randInt(100000000, 2100000000),
        maxTextureSize: randFrom([4096, 8192, 16384]),
        webglExtensions: randFrom([
          "EXT_texture_compression_bptc, ANGLE_instanced_arrays, OES_texture_float",
          "ANGLE_instanced_arrays, OES_texture_float, WEBGL_depth_texture, OES_vertex_array_object",
          "EXT_texture_filter_anisotropic, WEBGL_compressed_texture_s3tc, OES_element_index_uint",
        ]),
        audioNoise: randInt(100000000, 2100000000),
        audioSampleRate: randFrom([44100, 48000, 96000]),
        audioChannels: randFrom(["Mono", "Stereo", "Surround"]),
        colorDepth: randFrom([24, 32]),
        pixelRatio: randFrom([1, 1, 1, 1.25, 1.5, 2]),
        maxTouchPoints: 0,
        connectionType: randFrom(["Ethernet", "Wi-Fi"]),
        pdfViewer: "Enabled",
        batteryCharging: "No",
        batteryLevel: Number((Math.random() * 0.9 + 0.1).toFixed(2)),
        batteryChargingTime: 0,
        batteryDischargingTime: randInt(5000, 20000),
        fonts:
          "Cambria, Microsoft New Tai Lue, Constantia, Palatino Linotype, Corbel, Arial, Arial Black, Comic Sans MS, Courier New, Georgia, Impact, Lucida Console, Lucida Sans Unicode, Tahoma, Times New Roman, Trebuchet MS, Verdana, Consolas, Segoe UI, Calibri, Candara, Franklin Gothic Medium, Garamond",
      };

      // ── Map proxy from API format → settings.proxy ──
      let proxySettings = { server: "", username: "", password: "" };
      if (
        body.proxy &&
        body.proxy.host &&
        body.proxy.port &&
        body.proxy.host !== "string"
      ) {
        const px = body.proxy;
        const scheme = px.type || "http";
        proxySettings = {
          server: `${scheme}://${px.host}:${px.port}`,
          username: px.username && px.username !== "string" ? px.username : "",
          password: px.password && px.password !== "string" ? px.password : "",
        };
      }

      // ── Build profile payload that mirrors UI exactly ──
      // IMPORTANT: Do NOT set applyOverrides here.
      // normalizeProfileInput() will merge with DEFAULT_SETTINGS which has:
      //   hardware/navigator/userAgent/webgl/language/timezone/viewport = true
      //   antiDetection = false (controls network-level spoofing, NOT webdriver cleanup)
      // The webdriver cleanup in fingerprintInit.js block-0 runs via applyAntiDetection
      // which is driven by applyOverrides.antiDetection. Default_settings leaves it undefined
      // so the engine treats it as enabled (undefined !== false === true).
      const profilePayload = {
        name: String(body.name).trim(),
        fingerprint: enrichedFingerprint,
        settings: {
          ...genSettings,
          headless: body.headless === true,
          engine: "playwright",
          proxy: proxySettings,
          webrtc: "default",
          geolocation: {
            enabled: false,
            latitude: 0,
            longitude: 0,
            accuracy: 50,
          },
          mediaDevices: {
            audio: true,
            video: true,
            speakers: 2,
            microphones: 1,
            webcams: 0,
          },
          network: { antiDetection: false },
          // Section toggles: all OFF by default (same as UI new-profile state)
          identity: { enabled: false },
          display: { enabled: false },
          hardware: { enabled: false },
          canvas: { enabled: false },
          audio: { enabled: false },
          media: { enabled: false },
          battery: { enabled: false },
          // injectFingerprint true = normalizeProfileInput uses DEFAULT_SETTINGS.applyOverrides
          injectFingerprint: true,
        },
      };

      const result = await handlers.saveProfileInternal(profilePayload);
      if (result.success) broadcastProfilesUpdated();
      reply.code(result.success ? 201 : 400).send(result);
    } catch (e) {
      reply.code(500).send({ success: false, error: e?.message || String(e) });
    }
  });
  appx.put("/api/profiles/:id", async (req, reply) => {
    try {
      const profileId = req.params.id;
      const list = await handlers.getProfilesInternal();
      const existing = list.find((p) => p.id === profileId);
      if (!existing) {
        return reply
          .code(404)
          .send({ success: false, error: "Profile not found" });
      }

      const body = req.body || {};

      // ── Build the update payload by merging only provided fields ──
      // We start with the existing profile and overlay only what the caller sent.
      const updatePayload = { id: profileId };

      // name — only update if provided and non-empty
      if (body.name != null && String(body.name).trim()) {
        updatePayload.name = String(body.name).trim();
      }

      // description — update if provided
      if (body.description != null) {
        updatePayload.description = String(body.description);
      }

      // startUrl — update if provided
      if (body.startUrl != null) {
        updatePayload.startUrl = body.startUrl;
      }

      // Build partial settings — only overlay provided settings fields
      const settingsUpdate = {};

      // headless lives in settings.headless
      if (body.headless != null) {
        settingsUpdate.headless = !!body.headless;
      }

      // engine
      if (body.engine != null) {
        settingsUpdate.engine = body.engine;
      }

      // proxy — map from API format { type, host, port, username, password }
      if (body.proxy != null) {
        const px = body.proxy;
        if (px.host && px.host !== "string" && px.port) {
          const scheme = px.type || "http";
          settingsUpdate.proxy = {
            server: `${scheme}://${px.host}:${px.port}`,
            username:
              px.username && px.username !== "string" ? px.username : "",
            password:
              px.password && px.password !== "string" ? px.password : "",
          };
        } else if (px.server != null) {
          // Also accept raw server string format
          settingsUpdate.proxy = {
            server: px.server || "",
            username: px.username || "",
            password: px.password || "",
          };
        }
      }

      // webrtc
      if (body.webrtc != null) {
        settingsUpdate.webrtc = body.webrtc;
      }

      // Pass through any raw settings fields the caller provides
      if (body.settings && typeof body.settings === "object") {
        Object.assign(settingsUpdate, body.settings);
      }

      if (Object.keys(settingsUpdate).length > 0) {
        updatePayload.settings = settingsUpdate;
      }

      // fingerprintOptions — regenerate or merge fingerprint
      if (
        body.fingerprintOptions &&
        typeof body.fingerprintOptions === "object"
      ) {
        const fpOpts = body.fingerprintOptions;
        const osMap = { windows: "Windows", macos: "macOS", linux: "Linux" };
        const browserMap = {
          chrome: "Chrome",
          firefox: "Firefox",
          edge: "Chrome",
        };
        const BCP47_RE = /^[a-z]{2,3}-[A-Z]{2,4}(-[A-Za-z0-9]+)*$/;

        const genOpts = {};
        if (fpOpts.os) genOpts.os = osMap[fpOpts.os] || fpOpts.os;
        if (fpOpts.browser)
          genOpts.browser = browserMap[fpOpts.browser] || fpOpts.browser;
        if (fpOpts.locale && BCP47_RE.test(fpOpts.locale)) {
          genOpts.language = fpOpts.locale;
        }

        // Regenerate fingerprint with new options, merging over existing
        const {
          generateFingerprint,
        } = require("../engine/fingerprintGenerator");
        const generated = generateFingerprint(genOpts);
        const randInt = (min, max) =>
          Math.floor(Math.random() * (max - min + 1)) + min;
        const randFrom = (arr) => arr[Math.floor(Math.random() * arr.length)];

        updatePayload.fingerprint = {
          ...existing.fingerprint,
          ...generated.fingerprint,
          canvasNoise: randInt(100000000, 2100000000),
          canvasNoiseIntensity: randFrom([1, 2, 3, 4, 5]),
          webglNoise: randInt(100000000, 2100000000),
          maxTextureSize: randFrom([4096, 8192, 16384]),
          webglExtensions: randFrom([
            "EXT_texture_compression_bptc, ANGLE_instanced_arrays, OES_texture_float",
            "ANGLE_instanced_arrays, OES_texture_float, WEBGL_depth_texture, OES_vertex_array_object",
            "EXT_texture_filter_anisotropic, WEBGL_compressed_texture_s3tc, OES_element_index_uint",
          ]),
          audioNoise: randInt(100000000, 2100000000),
          audioSampleRate: randFrom([44100, 48000, 96000]),
          audioChannels: randFrom(["Mono", "Stereo", "Surround"]),
          colorDepth: randFrom([24, 32]),
          pixelRatio: randFrom([1, 1, 1, 1.25, 1.5, 2]),
        };
        // Also update settings with new generated hardware values
        updatePayload.settings = {
          ...settingsUpdate,
          ...generated.settings,
          ...(settingsUpdate.proxy ? { proxy: settingsUpdate.proxy } : {}),
        };
      }

      // Pass through raw fingerprint fields if caller provides them directly
      if (body.fingerprint && typeof body.fingerprint === "object") {
        updatePayload.fingerprint = {
          ...(existing.fingerprint || {}),
          ...body.fingerprint,
        };
      }

      const result = await handlers.saveProfileInternal(updatePayload);
      if (result.success) broadcastProfilesUpdated();
      reply.code(result.success ? 200 : 400).send(result);
    } catch (e) {
      reply.code(500).send({ success: false, error: e?.message || String(e) });
    }
  });
  appx.delete("/api/profiles/:id", async (req, reply) => {
    try {
      const list = await handlers.getProfilesInternal();
      if (!list.find((p) => p.id === req.params.id)) {
        return reply
          .code(404)
          .send({ success: false, error: "Profile not found" });
      }
      const id = req.params.id;

      // Stop the profile first if it's currently running
      if (handlers.stopProfileInternal) {
        try {
          await handlers.stopProfileInternal(id);
        } catch (e) {}
      }

      const result = await handlers.deleteProfileInternal(id);
      if (result.success) broadcastProfilesUpdated();
      reply.code(result.success ? 200 : 400).send(result);
    } catch (e) {
      reply.code(500).send({ success: false, error: e?.message || String(e) });
    }
  });

  // Launch/stop
  appx.post("/api/profiles/:id/launch", async (req, reply) => {
    const result = await handlers.launchProfileInternal(
      req.params.id,
      req.body || {},
    );
    reply.send(result);
  });
  appx.post("/api/profiles/:id/stop", async (req, reply) => {
    const result = await handlers.stopProfileInternal(req.params.id);
    reply.send(result);
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

      if (body.headless !== undefined) {
        // Handle both boolean and string representations
        opts.headless =
          body.headless === true ||
          String(body.headless).toLowerCase() === "true";
      }

      const result = await handlers.launchProfileInternal(profileId, opts);
      if (result && result.success === false) {
        return reply.code(400).send(result);
      }
      reply.send(result);
    } catch (e) {
      reply.code(500).send({ success: false, error: e?.message || String(e) });
    }
  });

  // POST /api/browsers/:profileId/close
  appx.post("/api/browsers/:profileId/close", async (req, reply) => {
    try {
      const result = await handlers.stopProfileInternal(req.params.profileId);
      if (result && result.success === false) {
        return reply.code(400).send(result);
      }
      reply.send(result);
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
      reply.send({ running: !!running });
    } catch (e) {
      reply.code(400).send({ error: e?.message || String(e) });
    }
  });

  // POST /api/browsers/:profileId/execute — generic Playwright page method dispatcher
  appx.post("/api/browsers/:profileId/execute", async (req, reply) => {
    try {
      const { profileId } = req.params;
      const { method, args = [], chain = [] } = req.body || {};
      if (!method)
        return reply
          .code(400)
          .send({ success: false, error: '"method" is required' });

      const { runningProfiles } = require("../state/runtime");
      const running = runningProfiles.get(profileId);
      if (!running)
        return reply
          .code(404)
          .send({ success: false, error: "Profile not running" });

      // Get active page
      let page;
      if (running.context) {
        const pages = running.context.pages();
        page = pages[pages.length - 1] || pages[0];
      }
      if (!page)
        return reply
          .code(400)
          .send({ success: false, error: "No active page available" });

      // Execute method on page
      let target = page;
      if (typeof target[method] !== "function") {
        // Try special sub-objects like keyboard, mouse, etc.
        const subObjs = ["keyboard", "mouse", "touchscreen"];
        let found = false;
        for (const sub of subObjs) {
          if (page[sub] && typeof page[sub][method] === "function") {
            target = page[sub];
            found = true;
            break;
          }
        }
        if (!found)
          return reply
            .code(400)
            .send({
              success: false,
              error: `Method "${method}" not found on page`,
            });
      }

      let result = await target[method](...args);

      // Execute chained methods
      for (const step of chain) {
        if (!step.method) continue;
        if (typeof result[step.method] !== "function") {
          return reply
            .code(400)
            .send({
              success: false,
              error: `Chain method "${step.method}" not found`,
            });
        }
        result = await result[step.method](...(step.args || []));
      }

      // Serialize result (Buffer → base64, etc.)
      let serialized = result;
      if (Buffer.isBuffer(result)) serialized = result.toString("base64");
      else if (typeof result === "function") serialized = "[Function]";

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
      const result = await performAction(
        req.params.profileId,
        actionName,
        param || {},
      );
      if (result && result.success === false) {
        return reply.code(400).send(result);
      }
      reply.send(result);
    } catch (e) {
      reply.code(500).send({ success: false, error: e?.message || String(e) });
    }
  };

  // Image 1: Basic Browser Navigation & Interactions
  appx.post("/api/browsers/:profileId/actions/navigate", mapAction("nav.goto"));
  appx.post("/api/browsers/:profileId/actions/reload", mapAction("nav.reload"));
  appx.post("/api/browsers/:profileId/actions/go-back", mapAction("nav.back"));
  appx.post(
    "/api/browsers/:profileId/actions/go-forward",
    mapAction("nav.forward"),
  );
  appx.get(
    "/api/browsers/:profileId/actions/page-info",
    mapAction("page.info"),
  );
  appx.get(
    "/api/browsers/:profileId/actions/content",
    mapAction("page.content"),
  );
  appx.post(
    "/api/browsers/:profileId/actions/screenshot",
    mapAction("capture.screen"),
  );
  appx.post(
    "/api/browsers/:profileId/actions/click",
    mapAction("click.element"),
  );
  appx.post(
    "/api/browsers/:profileId/actions/double-click",
    mapAction("element.dblclick"),
  );
  appx.post("/api/browsers/:profileId/actions/hover", mapAction("hover"));
  appx.post(
    "/api/browsers/:profileId/actions/focus",
    mapAction("element.focus"),
  );
  appx.post("/api/browsers/:profileId/actions/fill", mapAction("input.fill"));
  appx.post("/api/browsers/:profileId/actions/type", mapAction("input.type"));
  appx.post(
    "/api/browsers/:profileId/actions/press-key",
    mapAction("keyboard.pressKey"),
  );
  appx.post(
    "/api/browsers/:profileId/actions/select-option",
    mapAction("select.option"),
  );

  // Image 2: Element checks, scrolling and waiting
  appx.post("/api/browsers/:profileId/actions/check", mapAction("input.check"));
  appx.post(
    "/api/browsers/:profileId/actions/scroll",
    mapAction("page.scroll"),
  );
  appx.post("/api/browsers/:profileId/actions/tap", mapAction("click.tap"));
  appx.post(
    "/api/browsers/:profileId/actions/drag-and-drop",
    mapAction("dragAndDrop"),
  );
  appx.post(
    "/api/browsers/:profileId/actions/dispatch-event",
    mapAction("element.dispatchEvent"),
  );
  appx.post(
    "/api/browsers/:profileId/actions/set-viewport-size",
    mapAction("viewport.set"),
  );
  appx.post(
    "/api/browsers/:profileId/actions/set-content",
    mapAction("page.setContent"),
  );
  appx.post(
    "/api/browsers/:profileId/actions/wait-for-navigation",
    mapAction("wait.navigation"),
  );
  appx.post(
    "/api/browsers/:profileId/actions/wait-for-selector",
    mapAction("wait"),
  );
  appx.post(
    "/api/browsers/:profileId/actions/wait-for-url",
    mapAction("wait-for-url"),
  );
  appx.post(
    "/api/browsers/:profileId/actions/get-text",
    mapAction("element.text"),
  );
  appx.post(
    "/api/browsers/:profileId/actions/get-attribute",
    mapAction("element.attr"),
  );
  appx.post(
    "/api/browsers/:profileId/actions/get-value",
    mapAction("element.value"),
  );
  appx.post(
    "/api/browsers/:profileId/actions/get-inner-html",
    mapAction("element.html"),
  );
  appx.post("/api/browsers/:profileId/actions/evaluate", mapAction("js.eval"));

  // Image 3: Cookies, scripts and visibility checks
  appx.post(
    "/api/browsers/:profileId/actions/run-script",
    mapAction("script.runInline"),
  );
  appx.get(
    "/api/browsers/:profileId/actions/cookies",
    mapAction("cookies.get"),
  );
  appx.post(
    "/api/browsers/:profileId/actions/cookies",
    mapAction("cookies.set"),
  );
  appx.delete(
    "/api/browsers/:profileId/actions/cookies",
    mapAction("cookies.clear"),
  );
  appx.post(
    "/api/browsers/:profileId/actions/is-visible",
    mapAction("element.isVisible"),
  );
  appx.post(
    "/api/browsers/:profileId/actions/is-hidden",
    mapAction("element.isHidden"),
  );
  appx.post(
    "/api/browsers/:profileId/actions/is-checked",
    mapAction("element.isChecked"),
  );
  appx.post(
    "/api/browsers/:profileId/actions/is-enabled",
    mapAction("element.isEnabled"),
  );
  appx.post(
    "/api/browsers/:profileId/actions/is-disabled",
    mapAction("element.isDisabled"),
  );
  appx.post(
    "/api/browsers/:profileId/actions/is-editable",
    mapAction("element.isEditable"),
  );
  appx.post(
    "/api/browsers/:profileId/actions/text-content",
    mapAction("element.textContent"),
  );
  appx.post(
    "/api/browsers/:profileId/actions/wait-for-timeout",
    mapAction("wait"),
  );
  appx.post(
    "/api/browsers/:profileId/actions/wait-for-load-state",
    mapAction("wait.loadState"),
  );
  appx.post(
    "/api/browsers/:profileId/actions/set-extra-http-headers",
    mapAction("headers.setExtra"),
  );

  // Image 4: Keyboard & Mouse specifics
  appx.post(
    "/api/browsers/:profileId/actions/add-init-script",
    mapAction("page.addInitScript"),
  );
  appx.post(
    "/api/browsers/:profileId/actions/keyboard/down",
    mapAction("keyboard.down"),
  );
  appx.post(
    "/api/browsers/:profileId/actions/keyboard/up",
    mapAction("keyboard.up"),
  );
  appx.post(
    "/api/browsers/:profileId/actions/keyboard/type",
    mapAction("keyboard.type"),
  );
  appx.post(
    "/api/browsers/:profileId/actions/keyboard/insert-text",
    mapAction("keyboard.insertText"),
  );
  appx.post(
    "/api/browsers/:profileId/actions/mouse/click",
    mapAction("click.at"),
  );
  appx.post(
    "/api/browsers/:profileId/actions/mouse/move",
    mapAction("mouse.move"),
  );
  appx.post(
    "/api/browsers/:profileId/actions/mouse/dblclick",
    mapAction("mouse.dblclick"),
  );
  appx.post(
    "/api/browsers/:profileId/actions/mouse/down",
    mapAction("mouse.down"),
  );
  appx.post("/api/browsers/:profileId/actions/mouse/up", mapAction("mouse.up"));
  appx.post(
    "/api/browsers/:profileId/actions/mouse/wheel",
    mapAction("mouse.wheel"),
  );

  // Context endpoints
  appx.get(
    "/api/browsers/:profileId/context/storage-state",
    async (req, reply) => {
      const r = await (handlers.getStorageStateInternal
        ? handlers.getStorageStateInternal(req.params.profileId)
        : { success: false, error: "Not implemented" });
      reply.send(r);
    },
  );
  appx.post("/api/browsers/:profileId/context/new-page", mapAction("tab.new"));
  appx.get("/api/browsers/:profileId/context/pages", async (req, reply) => {
    const r = await handlers.listPagesInternal(req.params.profileId);
    reply.send(r);
  });
  appx.post(
    "/api/browsers/:profileId/context/extra-http-headers",
    mapAction("headers.setExtra"),
  );
  appx.post(
    "/api/browsers/:profileId/context/grant-permissions",
    async (req, reply) => {
      const r = await handlers.grantPermissionsInternal(
        req.params.profileId,
        req.body || {},
      );
      reply.send(r);
    },
  );
  appx.post(
    "/api/browsers/:profileId/context/clear-permissions",
    async (req, reply) => {
      const r = await handlers.clearPermissionsInternal(req.params.profileId);
      reply.send(r);
    },
  );
  appx.post(
    "/api/browsers/:profileId/context/geolocation",
    mapAction("geolocation.set"),
  );

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
      reply.send(result);
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
      if (req.query.profileId)
        list = list.filter((t) => t.profileId === req.query.profileId);
      reply.send({ success: true, tasks: list });
    } catch (e) {
      reply.code(500).send({ success: false, error: e?.message || String(e) });
    }
  });

  // POST /api/tasks/ — create a new task
  appx.post("/api/tasks", async (req, reply) => {
    try {
      const { addTaskLog } = require("../storage/taskLogs");
      const { readProfiles } = require("../storage/profiles");
      const body = req.body || {};
      if (!body.profileId)
        return reply
          .code(400)
          .send({ success: false, error: '"profileId" is required' });
      if (!body.name)
        return reply
          .code(400)
          .send({ success: false, error: '"name" is required' });
      if (!body.scriptContent)
        return reply
          .code(400)
          .send({ success: false, error: '"scriptContent" is required' });

      const profiles = readProfiles();
      const profile = profiles.find((p) => p.id === body.profileId);
      if (!profile)
        return reply
          .code(404)
          .send({ success: false, error: `Profile "${body.profileId}" not found` });

      const entry = {
        profileId: body.profileId,
        name: body.name,
        scriptType: body.scriptType || "inline",
        scriptContent: body.scriptContent,
        headless: body.headless !== undefined ? body.headless : true,
        status: "queued",
        output: null,
        error: null,
        startedAt: null,
        completedAt: null,
      };
      const r = await addTaskLog(entry);
      if (!r.success)
        return reply.code(500).send(r);
      broadcastTaskLogsUpdated();
      reply.code(201).send(r.taskLog);
    } catch (e) {
      reply.code(500).send({ success: false, error: e?.message || String(e) });
    }
  });

  // POST /api/tasks/:id/run — run or re-run a task, update existing record
  appx.post("/api/tasks/:id/run", async (req, reply) => {
    try {
      const { getTaskLogById, updateTaskLog } = require("../storage/taskLogs");
      const { executeScript } = require("../engine/scriptRuntime");
      const found = await getTaskLogById(req.params.id);
      if (!found.success) return reply.code(404).send({ success: false, error: "Task not found" });
      const task = found.taskLog;
      if (task.status === "running")
        return reply.code(400).send({ success: false, error: "Task is already running" });
      const scriptContent = task.scriptContent || task._scriptContent;
      if (!scriptContent)
        return reply.code(400).send({ success: false, error: "Task has no scriptContent to execute" });

      const taskId = req.params.id;
      const startedAt = new Date().toISOString();
      const prevLogs = task.logs || [];
      const runSeparator = { time: startedAt, message: `── Run ${new Date(startedAt).toLocaleString()} ──` };
      await updateTaskLog(taskId, { status: "running", startedAt, completedAt: null, error: null });
      broadcastTaskLogsUpdated();

      // Fire and forget — update task record when done
      executeScript(task.profileId, scriptContent, { timeoutMs: 120000, headless: task.headless })
        .then(async (result) => {
          await updateTaskLog(taskId, {
            status: result.success ? "completed" : "error",
            completedAt: new Date().toISOString(),
            error: result.error || null,
            logs: [...prevLogs, runSeparator, ...(result.logs || [])],
          });
          broadcastTaskLogsUpdated();
        })
        .catch(async (e) => {
          await updateTaskLog(taskId, {
            status: "error",
            completedAt: new Date().toISOString(),
            error: e?.message || String(e),
            logs: [...prevLogs, runSeparator],
          });
          broadcastTaskLogsUpdated();
        });

      reply.send({ success: true, message: "Task started", taskId });
    } catch (e) {
      reply.code(500).send({ success: false, error: e?.message || String(e) });
    }
  });

  // POST /api/tasks/:id/cancel — stop if running, always return success
  appx.post("/api/tasks/:id/cancel", async (req, reply) => {
    try {
      const { getTaskLogById, updateTaskLog } = require("../storage/taskLogs");
      const { stopScript, isScriptRunning } = require("../engine/scriptRuntime");
      const found = await getTaskLogById(req.params.id);
      if (!found.success) return reply.code(404).send({ success: false, error: "Task not found" });
      const task = found.taskLog;
      if (isScriptRunning(task.profileId)) {
        stopScript(task.profileId);
        await updateTaskLog(req.params.id, {
          status: "stopped",
          completedAt: new Date().toISOString(),
          error: "Cancelled by user",
        });
        broadcastTaskLogsUpdated();
      }
      reply.send({ success: true });
    } catch (e) {
      reply.code(500).send({ success: false, error: e?.message || String(e) });
    }
  });

  // DELETE /api/tasks/:id — remove task record from log
  appx.delete("/api/tasks/:id", async (req, reply) => {
    try {
      const { deleteTaskLog } = require("../storage/taskLogs");
      const r = await deleteTaskLog(req.params.id);
      if (!r.success) return reply.code(404).send(r);
      broadcastTaskLogsUpdated();
      reply.send({ success: true });
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
        profiles.map((p) => p.proxy?.id).filter(Boolean),
      );
      const unassigned = proxies.filter((px) => !assignedIds.has(px.id));
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
      if (r.success) broadcastProxiesUpdated();
      reply.code(r.success ? 201 : 400).send(r);
    } catch (e) {
      reply.code(500).send({ success: false, error: e?.message || String(e) });
    }
  });

  // PUT /api/proxies/:id
  appx.put("/api/proxies/:id", async (req, reply) => {
    try {
      const { updateProxyInternal } = require("../storage/proxies");
      const r = await updateProxyInternal(req.params.id, req.body || {});
      if (r.success) broadcastProxiesUpdated();
      reply
        .code(r.success ? 200 : r.error === "Proxy not found" ? 404 : 400)
        .send(r);
    } catch (e) {
      reply.code(500).send({ success: false, error: e?.message || String(e) });
    }
  });

  // DELETE /api/proxies/:id
  appx.delete("/api/proxies/:id", async (req, reply) => {
    try {
      const { deleteProxyInternal } = require("../storage/proxies");
      const r = await deleteProxyInternal(req.params.id);
      if (r.success) broadcastProxiesUpdated();
      reply.send(r);
    } catch (e) {
      reply.code(500).send({ success: false, error: e?.message || String(e) });
    }
  });

  // POST /api/proxies/:id/assign — assign proxy to a profile
  appx.post("/api/proxies/:id/assign", async (req, reply) => {
    try {
      const { getProxyByIdInternal } = require("../storage/proxies");
      const { profileId } = req.body || {};
      if (!profileId)
        return reply
          .code(400)
          .send({ success: false, error: '"profileId" is required' });

      const proxyResult = await getProxyByIdInternal(req.params.id);
      if (!proxyResult.success) return reply.code(404).send(proxyResult);

      const profiles = await handlers.getProfilesInternal();
      const profile = profiles.find((p) => p.id === profileId);
      if (!profile)
        return reply
          .code(404)
          .send({ success: false, error: "Profile not found" });

      const updated = { ...profile, proxy: proxyResult.proxy };
      const r = await handlers.saveProfileInternal(updated);
      if (r.success) broadcastProfilesUpdated();
      reply
        .code()
        .send({
          success: r.success,
          message: "Proxy assigned",
          proxy: proxyResult.proxy,
        });
    } catch (e) {
      reply.code(500).send({ success: false, error: e?.message || String(e) });
    }
  });

  // POST /api/proxies/unassign — remove proxy from a profile
  appx.post("/api/proxies/unassign", async (req, reply) => {
    try {
      const { profileId } = req.body || {};
      if (!profileId)
        return reply
          .code(400)
          .send({ success: false, error: '"profileId" is required' });

      const profiles = await handlers.getProfilesInternal();
      const profile = profiles.find((p) => p.id === profileId);
      if (!profile)
        return reply
          .code(404)
          .send({ success: false, error: "Profile not found" });

      const updated = { ...profile, proxy: null };
      const r = await handlers.saveProfileInternal(updated);
      if (r.success) broadcastProfilesUpdated();
      reply.code().send({ success: r.success, message: "Proxy unassigned" });
    } catch (e) {
      reply.code(500).send({ success: false, error: e?.message || String(e) });
    }
  });

  // ── Fingerprints API ──

  // Helper: flatten fingerprint response to match external API expectations
  function formatFingerprintResponse(fp) {
    const f = fp.fingerprint || {};
    const s = fp.settings || {};
    const adv = s.advanced || {};
    const meta = fp._meta || {};

    let width = 1920,
      height = 1080;
    if (f.screenResolution) {
      const parts = f.screenResolution.split("x");
      if (parts.length === 2) {
        width = parseInt(parts[0], 10) || 1920;
        height = parseInt(parts[1], 10) || 1080;
      }
    }

    const langs = adv.languages
      ? adv.languages.split(",").map((l) => l.trim())
      : [f.language || "en-US"];

    const webglExts = [
      "EXT_frag_depth",
      "OES_element_index_uint",
      "KHR_parallel_shader_compile",
      "ANGLE_instanced_arrays",
      "OES_vertex_array_object",
      "WEBGL_compressed_texture_s3tc",
      "WEBGL_draw_buffers",
      "EXT_blend_minmax",
      "WEBGL_color_buffer_float",
      "OES_texture_float_linear",
      "OES_texture_half_float_linear",
      "EXT_color_buffer_half_float",
      "WEBGL_lose_context",
      "EXT_disjoint_timer_query",
      "WEBGL_compressed_texture_s3tc_srgb",
      "EXT_sRGB",
      "OES_standard_derivatives",
      "OES_texture_float",
      "EXT_texture_compression_bptc",
      "WEBGL_multi_draw",
      "EXT_shader_texture_lod",
      "OES_fbo_render_mipmap",
      "EXT_texture_compression_rgtc",
    ];
    const webglParams = {
      MAX_TEXTURE_SIZE: 4096,
      MAX_RENDERBUFFER_SIZE: 8192,
      MAX_VIEWPORT_DIMS: 32768,
      MAX_VERTEX_ATTRIBS: 32,
      MAX_VERTEX_UNIFORM_VECTORS: 256,
      MAX_FRAGMENT_UNIFORM_VECTORS: 4096,
      MAX_VARYING_VECTORS: 30,
      MAX_VERTEX_TEXTURE_IMAGE_UNITS: 32,
      MAX_TEXTURE_IMAGE_UNITS: 16,
      MAX_COMBINED_TEXTURE_IMAGE_UNITS: 64,
      ALIASED_LINE_WIDTH_RANGE_MAX: 10,
      ALIASED_POINT_SIZE_RANGE_MAX: 255,
      MAX_CUBE_MAP_TEXTURE_SIZE: 8192,
    };

    const isFirefox = f.browser === "Firefox";
    const pluginCount = typeof adv.plugins === "number" ? adv.plugins : 5;
    const plugins = isFirefox
      ? []
      : [
          {
            name: "Microsoft Edge PDF Viewer",
            filename: "internal-pdf-viewer",
            description: "Portable Document Format",
          },
          {
            name: "PDF Viewer",
            filename: "internal-pdf-viewer",
            description: "Portable Document Format",
          },
          {
            name: "Chrome PDF Viewer",
            filename: "internal-pdf-viewer",
            description: "Portable Document Format",
          },
          {
            name: "Chromium PDF Viewer",
            filename: "internal-pdf-viewer",
            description: "Portable Document Format",
          },
          {
            name: "WebKit built-in PDF",
            filename: "internal-pdf-viewer",
            description: "Portable Document Format",
          },
        ].slice(0, pluginCount);

    const mainBrand = isFirefox ? "Firefox" : "Google Chrome";
    const bv = meta.browserVersion || (isFirefox ? "138.0.0.0" : "144.0.0.0");
    const majorVersion = bv.split(".")[0];

    const userAgentData = {
      brands: [
        { brand: "Not(A:Brand", version: "8" },
        { brand: isFirefox ? "Firefox" : "Chromium", version: majorVersion },
        { brand: mainBrand, version: majorVersion },
      ],
      fullVersionList: [
        { brand: "Not(A:Brand", version: "8.0.0.0" },
        { brand: isFirefox ? "Firefox" : "Chromium", version: bv },
        { brand: mainBrand, version: bv },
      ],
      platform: f.os || "Windows",
      platformVersion: "19.0.0",
      architecture: "x86",
      model: "",
      mobile: false,
      bitness: "64",
    };

    return {
      userAgent: f.userAgent || "",
      platform: adv.platform || "Win32",
      languages: langs,
      timezone: f.timezone || "UTC",
      locale: f.language || "en-US",
      screen: {
        width,
        height,
        colorDepth: 24,
        pixelRatio: adv.devicePixelRatio || 1,
      },
      hardwareConcurrency: s.cpuCores || 8,
      deviceMemory: s.memoryGB || 8,
      vendor: adv.webglVendor || "Google Inc. (Intel)",
      renderer: adv.webglRenderer || "ANGLE (Intel, Intel(R) HD Graphics)",
      fonts: meta.fonts || [],
      webgl: {
        extensions: webglExts,
        params: webglParams,
        noiseSeed: meta.seed ? meta.seed + 1 : 1361946073,
      },
      canvas: {
        noiseSeed: meta.seed ? meta.seed + 2 : 1213244272,
        noiseIntensity: 4,
      },
      audio: {
        sampleRate: isFirefox ? 48000 : 44100,
        channelCount: 2,
        noiseSeed: meta.seed ? meta.seed + 3 : 615301415,
      },
      mediaDevices: { speakers: 1, microphones: 0, webcams: 2 },
      navigator: {
        doNotTrack: adv.dnt ? "1" : null,
        maxTouchPoints: adv.maxTouchPoints || 0,
        connectionType: "wifi",
        pdfViewerEnabled: plugins.length > 0,
        cookieEnabled: true,
      },
      battery: {
        charging: true,
        chargingTime: 0,
        dischargingTime: null,
        level: 0.99,
      },
      plugins: plugins,
      webrtcPolicy: "default_public_interface_only",
      userAgentData: userAgentData,
    };
  }

  // POST /api/fingerprints/preview — generate fingerprint without saving
  appx.post("/api/fingerprints/preview", async (req, reply) => {
    try {
      const { generateFingerprint } = require("../engine/fingerprintGenerator");
      const body = req.body || {};
      const osMap = { windows: "Windows", macos: "macOS", linux: "Linux" };
      const browserMap = {
        chrome: "Chrome",
        firefox: "Firefox",
        edge: "Chrome",
      };
      const opts = {};
      if (body.os) opts.os = osMap[body.os] || body.os;
      if (body.browser) opts.browser = browserMap[body.browser] || body.browser;
      if (body.locale) opts.language = body.locale;
      const result = generateFingerprint(opts);
      reply.send(formatFingerprintResponse(result));
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
      const osMap = { windows: "Windows", macos: "macOS", linux: "Linux" };
      const browserMap = {
        chrome: "Chrome",
        firefox: "Firefox",
        edge: "Chrome",
      };
      const opts = {};
      if (body.os) opts.os = osMap[body.os] || body.os;
      if (body.browser) opts.browser = browserMap[body.browser] || body.browser;
      if (body.locale) opts.language = body.locale;

      const fp = generateFingerprint(opts);
      const profiles = await handlers.getProfilesInternal();
      const profile = profiles.find((p) => p.id === profileId);
      if (!profile)
        return reply
          .code(404)
          .send({ success: false, error: "Profile not found" });

      const seed = fp._meta?.seed || Math.floor(Math.random() * 2100000000);
      let fonts =
        fp._meta?.fonts || profile.fingerprint?.fonts || "Arial, Courier New";
      if (Array.isArray(fonts)) {
        fonts = fonts.join(", ");
      }
      const gpuV =
        fp.settings?.advanced?.webglVendor ||
        profile.settings?.gpuVendor ||
        "Google Inc. (Intel)";
      const gpuR =
        fp.settings?.advanced?.webglRenderer ||
        profile.settings?.gpuRenderer ||
        "ANGLE (Intel, Intel(R) HD Graphics)";

      // Bật tất cả các cờ enabled cho các section giống như khi bấm Generate trong UI
      const toggles = {
        identity: { enabled: true },
        display: { enabled: true },
        hardware: { enabled: true },
        canvas: { enabled: true },
        webgl: { enabled: true },
        audio: { enabled: true },
        media: { enabled: true },
        network: { enabled: true },
        battery: { enabled: true },
      };

      const updated = {
        ...profile,
        fingerprint: {
          ...profile.fingerprint,
          ...fp.fingerprint,
          device:
            fp.fingerprint?.device || profile.fingerprint?.device || "Desktop",
          fonts: fonts,
          webglNoise: seed,
          canvasNoise: seed,
          audioNoise: seed,
          maxTextureSize: profile.fingerprint?.maxTextureSize || 8192,
          webglExtensions:
            profile.fingerprint?.webglExtensions ||
            "EXT_texture_compression_bptc, ANGLE_instanced_arrays, OES_texture_float",
          canvasNoiseIntensity: profile.fingerprint?.canvasNoiseIntensity || 2,
          audioSampleRate: profile.fingerprint?.audioSampleRate || 48000,
          audioChannels: profile.fingerprint?.audioChannels || "Stereo",
          connectionType: profile.fingerprint?.connectionType || "Wi-Fi",
          pdfViewer: profile.fingerprint?.pdfViewer || "Enabled",
          batteryCharging: profile.fingerprint?.batteryCharging || "No",
          batteryLevel: profile.fingerprint?.batteryLevel || 0.99,
          batteryChargingTime: profile.fingerprint?.batteryChargingTime || 0,
          batteryDischargingTime:
            profile.fingerprint?.batteryDischargingTime || 15000,
          colorDepth:
            fp.fingerprint?.colorDepth || profile.fingerprint?.colorDepth || 24,
          pixelRatio:
            fp.fingerprint?.pixelRatio ||
            fp.settings?.advanced?.devicePixelRatio ||
            profile.fingerprint?.pixelRatio ||
            1,
        },
        settings: {
          ...profile.settings,
          ...fp.settings,
          ...toggles,
          gpuVendor: gpuV,
          gpuRenderer: gpuR,
          mediaDevices: fp.settings?.mediaDevices ||
            profile.settings?.mediaDevices || {
              speakers: 1,
              microphones: 0,
              webcams: 1,
            },
          webrtc:
            fp.settings?.webrtc ||
            profile.settings?.webrtc ||
            "Public + private",
        },
      };
      const r = await handlers.saveProfileInternal(updated);
      if (r.success) broadcastProfilesUpdated();

      reply.send(formatFingerprintResponse(fp));
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
      reply.code(r.success ? 200 : 404).send(r);
    } catch (e) {
      reply.code(500).send({ success: false, error: e?.message || String(e) });
    }
  });
  appx.post("/api/scripts", async (req, reply) => {
    try {
      const { saveScriptInternal } = require("../storage/scripts");
      const body = req.body || {};
      if (!body.name || !String(body.name).trim())
        return reply
          .code(400)
          .send({ success: false, error: '"name" is required' });
      if (!body.content || !String(body.content).trim())
        return reply
          .code(400)
          .send({ success: false, error: '"content" is required' });
      // Map API fields → internal schema
      const payload = {
        name: String(body.name).trim(),
        description: body.description ? String(body.description) : "",
        code: String(body.content),
        browserMode: body.headless === true ? "headless" : "visible",
        schedule: {
          enabled: body.cronEnabled === true,
          cron: body.cronSchedule ? String(body.cronSchedule) : "",
          profileId: body.cronProfileId ? String(body.cronProfileId) : "",
        },
      };
      const r = await saveScriptInternal(payload);
      if (r.success) {
        // Start cron job if schedule is enabled
        try {
          const { scheduleScript } = require("../engine/scriptScheduler");
          scheduleScript(r.script);
        } catch {}
        broadcastScriptsUpdated();
      }
      reply.code(r.success ? 201 : 400).send(r);
    } catch (e) {
      reply.code(500).send({ success: false, error: e?.message || String(e) });
    }
  });
  // PUT /api/scripts/:id — Update a script (partial update, all fields optional except id)
  appx.put("/api/scripts/:id", async (req, reply) => {
    try {
      const {
        saveScriptInternal,
        getScriptInternal,
      } = require("../storage/scripts");
      const existing = await getScriptInternal(req.params.id);
      if (!existing.success) return reply.code(404).send(existing);
      const body = req.body || {};
      // Merge only provided fields over existing script
      const base = existing.script;
      const payload = {
        id: req.params.id,
        name: body.name != null ? String(body.name).trim() : base.name,
        description:
          body.description != null
            ? String(body.description)
            : base.description,
        code: body.content != null ? String(body.content) : base.code,
        browserMode:
          body.headless != null
            ? body.headless === true
              ? "headless"
              : "visible"
            : base.browserMode,
        schedule: {
          enabled:
            body.cronEnabled != null
              ? body.cronEnabled === true
              : base.schedule?.enabled,
          cron:
            body.cronSchedule != null
              ? String(body.cronSchedule)
              : base.schedule?.cron,
          profileId:
            body.cronProfileId != null
              ? String(body.cronProfileId)
              : base.schedule?.profileId,
        },
      };
      const r = await saveScriptInternal(payload);
      if (r.success) {
        // Reload cron job (cancel old, start new if schedule enabled)
        try {
          const { scheduleScript } = require("../engine/scriptScheduler");
          scheduleScript(r.script); // scheduleScript cancels old job automatically
        } catch {}
        broadcastScriptsUpdated();
      }
      reply.send(r);
    } catch (e) {
      reply.code(500).send({ success: false, error: e?.message || String(e) });
    }
  });
  // DELETE /api/scripts/:id — Delete a script and cancel its cron job
  appx.delete("/api/scripts/:id", async (req, reply) => {
    try {
      const { deleteScriptInternal } = require("../storage/scripts");
      const scriptId = req.params.id;
      // Cancel cron job BEFORE deleting so scheduler doesn't fire after deletion
      try {
        const { cancelScript } = require("../engine/scriptScheduler");
        cancelScript(scriptId);
      } catch {}
      const r = await deleteScriptInternal(scriptId);
      if (r.success) broadcastScriptsUpdated();
      reply.send(r);
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
      reply.send(r);
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
      reply.send({
        success: true,
        count: results.length,
        fingerprints: results,
      });
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
      if (!running.context) {
        return res.status(400).json({
          success: false,
          error: "Behavior simulation requires an active Playwright context",
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
            return res.status(400).json({
              success: false,
              error: "selector is required for click action",
            });
          await behavior.humanClick(page, rng, opts.selector, opts);
          break;
        case "type":
          if (!opts.selector || !opts.text)
            return res.status(400).json({
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

      if (running.context) {
        const pages = running.context.pages();
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
        return reply
          .code(400)
          .send({ success: false, error: "host and port are required" });
      const result = await checkProxy(cfg);
      reply.send(result);
    } catch (e) {
      reply.code(500).send({ success: false, error: e?.message || String(e) });
    }
  });

  // ── OpenAPI spec at /openapi.json ──
  appx.get("/openapi.json", async (_req, reply) => {
    try {
      reply
        .type("application/json")
        .send(require("fs").readFileSync(openapiPath, "utf8"));
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
      try {
        await restFastifyInstance.close();
      } catch {}
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
      try {
        attachPreviewWebSocket();
      } catch (e) {
        appendLog(
          "system",
          `Preview WebSocket attach failed: ${e?.message || e}`,
        );
      }
      appendLog(
        "system",
        `REST API server started on ${host}:${port} — Fastify Swagger UI at /docs`,
      );
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
      appendLog(
        "system",
        `REST API server failed to start: ${restServerState.error}`,
      );
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
    try {
      await inst.close();
    } catch {}
    // Reset WS broadcast so screencast knows frames cannot be delivered
    try {
      const { setWsBroadcast } = require('../engine/screencast');
      setWsBroadcast(null);
    } catch {}
    restServerState.running = false;
    broadcast();
    appendLog('system', 'REST API server stopped');
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

  function setBroadcaster(fn) {
    broadcaster = fn;
  }

  /**
   * Attach WebSocket server on /preview path for live screenshot streaming.
   * Uses noServer mode to share port 4000 with Express.
   */
  function attachPreviewWebSocket() {
    if (!restHttpServer) return;
    // Clean up previous WSS if server was restarted
    if (wss) {
      try {
        wss.close();
      } catch {}
      wss = null;
      wsClients.clear();
    }
    wss = new WebSocketServer({ noServer: true });

    // Prevent stacked upgrade listeners on server restart
    restHttpServer.removeAllListeners('upgrade');

    restHttpServer.on('upgrade', (request, socket, head) => {
      const url = new URL(request.url || '', 'http://localhost');
      appendLog('system', `[ws-upgrade] url=${request.url} pathname=${url.pathname}`);
      if (url.pathname === '/preview') {
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit('connection', ws, request);
        });
      } else {
        socket.destroy();
      }
    });

    wss.on("connection", (ws, request) => {
      // Client sends { action: 'subscribe', profileId } to start receiving frames
      ws.on("message", (data) => {
        try {
          const msg = JSON.parse(String(data));
          if (msg.action === "subscribe" && msg.profileId) {
            wsClients.set(ws, msg.profileId);
          } else if (msg.action === "unsubscribe") {
            wsClients.delete(ws);
          }
        } catch (e) {
          appendLog('system', `[ws] message parse error: ${e?.message || e}`);
        }
      });

      ws.on("close", () => {
        wsClients.delete(ws);
      });

      ws.on("error", () => {
        wsClients.delete(ws);
      });
    });

    // Register broadcast function with ScreencastManager
    try {
      const { setWsBroadcast } = require("../engine/screencast");
      setWsBroadcast(broadcastPreviewFrame);
    } catch (e) {
      appendLog(
        "system",
        `ScreencastManager broadcast setup failed: ${e?.message || e}`,
      );
    }

    appendLog("system", "Preview WebSocket server attached on /preview");
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
      // Use server-side _socket.writableLength instead of browser-only bufferedAmount
      const buffered = client._socket?.writableLength ?? 0;
      if (buffered > 131072) continue;
      try {
        client.send(message);
      } catch (e) {
        appendLog('system', `[ws] send error for profile ${profileId}: ${e?.message || e}`);
      }
    }
  }

  return {
    start,
    stop,
    setEnabled,
    setPort,
    getState,
    startWithPassword,
    setBroadcaster,
  };
}

module.exports = { createRestServer };
