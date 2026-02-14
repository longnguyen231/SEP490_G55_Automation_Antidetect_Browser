const fs = require('fs');
const { chromium } = require('playwright');
const { appendLog } = require('../logging/logger');
const { storageStatePath, getDataRoot } = require('../storage/paths');
const { loadSettings, resolveChromeExecutable } = require('../storage/settings');
const { runningProfiles } = require('../state/runtime');
const { applyCdpOverrides } = require('../engine/cdpOverrides');
const { findFreePort, fetchJsonVersion, killProcessTreeWin, userDataDirFor, launchChromeCdp } = require('../engine/cdp');
const { readProfiles, writeProfiles } = require('../storage/profiles');

async function runPlaywrightInstall(browser = 'chromium') {
  appendLog('system', `Running Playwright install for ${browser}...`);
  return new Promise((resolve) => {
    try {
      const cmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
      const args = ['playwright', 'install', browser];
      const child = require('child_process').spawn(cmd, args, { stdio: 'ignore', windowsHide: true });
      child.once('exit', (code) => resolve(code === 0));
      child.once('error', () => resolve(false));
    } catch { resolve(false); }
  });
}

function broadcastRunningMap() {
  const { BrowserWindow } = require('electron');
  const payload = { map: Object.fromEntries([...runningProfiles.entries()].map(([id, info]) => [id, info.wsEndpoint || null])) };
  for (const w of BrowserWindow.getAllWindows()) {
    try { w.webContents.send('running-map-changed', payload); } catch { }
  }
}

async function launchProfileInternal(profileId, options = {}) {
  try {
    const profiles = readProfiles();
    const profile = profiles.find(p => p.id === profileId);
    if (!profile) return { success: false, error: 'Profile not found' };
    if (runningProfiles.has(profileId)) {
      const running = runningProfiles.get(profileId);
      return { success: true, wsEndpoint: running.wsEndpoint };
    }
    const settings = profile.settings || {};
    const startUrl = profile.startUrl || 'https://www.google.com';
    const engine = (options && options.engine) ? String(options.engine).toLowerCase() : (settings.engine === 'cdp' ? 'cdp' : 'playwright');
  // Headless only meaningful for Playwright engine; ignore for CDP
  const requestedHeadless = (options && typeof options.headless === 'boolean') ? options.headless : undefined;
  const headless = engine === 'playwright' ? ((requestedHeadless !== undefined) ? requestedHeadless : !!settings.headless) : false;

    // Persist engine/headless
    try {
      const idx = profiles.findIndex(p => p.id === profileId);
      if (idx !== -1) {
  const persist = { ...(profile.settings || {}), engine: (engine === 'cdp' ? 'cdp' : 'playwright') };
  if (engine === 'playwright') persist.headless = !!headless; else delete persist.headless;
  profiles[idx] = { ...profile, settings: persist };
        writeProfiles(profiles);
      }
    } catch { }

    if (engine === 'cdp') {
      const chromePath = resolveChromeExecutable();
      if (!chromePath) {
        const msg = 'Chrome/Edge executable not found. Set CHROME_PATH or configure settings.json.';
        appendLog(profileId, msg);
        return { success: false, error: msg };
      }
      // Debug paths to help vendor portable troubleshooting
      try {
        const vendorRoot = require('path').join(__dirname, '../../vendor');
        const exists = fs.existsSync(vendorRoot);
        appendLog(profileId, `Vendor root: ${vendorRoot} (exists: ${exists})`);
        appendLog(profileId, `resourcesPath: ${process.resourcesPath || ''}`);
        appendLog(profileId, `Resolved Chrome path: ${chromePath}`);
      } catch { }
      const host = options.cdpHost || '127.0.0.1';
      const port = options.cdpPort ? Number(options.cdpPort) : await findFreePort(9222, host);
      const userDataDir = userDataDirFor(profileId);
      const extraArgs = [];
      // Parity flags with Playwright
      if (settings.webrtc === 'proxy_only' || settings.webrtc === 'disable_udp') {
        extraArgs.push('--force-webrtc-ip-handling-policy=disable_non_proxied_udp', '--enforce-webrtc-ip-permission-check');
      }
      const fp = profile.fingerprint || {};
      if (settings.webgl === false || fp.webgl === false) { extraArgs.push('--disable-3d-apis'); }
      // Proxy handling: start local forwarder when auth is present or using SOCKS
      let proxyForChrome = settings.proxy;
      let forwarder = null;
      try {
        const serverStr = (settings.proxy && settings.proxy.server) ? String(settings.proxy.server) : '';
        const hasAuth = !!(settings.proxy && (settings.proxy.username || settings.proxy.password));
        const isSocks = /^socks\d?:\/\//i.test(serverStr);
        if (settings.proxy && (hasAuth || isSocks)) {
          const { startProxyForwarder } = require('../engine/proxyForwarder');
          forwarder = await startProxyForwarder(settings.proxy, { appendLog, profileId });
          proxyForChrome = { server: forwarder.url };
        }
      } catch (e) {
        appendLog(profileId, `Proxy forwarder failed, falling back to direct proxy: ${e?.message || e}`);
      }

  const { child, wsPromise } = await launchChromeCdp({ profileId, chromePath, host, port, userDataDir, startUrl, proxy: proxyForChrome, appendLog, extraArgs });
      // Add periodic vendor path log for troubleshooting
      try {
        const vendorRoot = require('path').join(__dirname, '../../vendor');
        appendLog(profileId, `CDP launch vendorRoot check: ${vendorRoot} exists=${fs.existsSync(vendorRoot)}`);
        appendLog(profileId, `Using chromePath: ${chromePath}`);
      } catch {}
      const onChildExit = async (code, signal) => {
        if (runningProfiles.has(profileId)) {
          try { const info = runningProfiles.get(profileId); info?.heartbeat && clearInterval(info.heartbeat); } catch {}
          try { const info = runningProfiles.get(profileId); await info?.forwarder?.stop?.(); } catch {}
          runningProfiles.delete(profileId);
          appendLog(profileId, `Chrome exited (${code || ''} ${signal || ''}); clearing running state`);
          broadcastRunningMap();
        }
      };
      child.once('exit', onChildExit);
      try { child.once('close', onChildExit); } catch { }
      try { child.once('error', (e) => { appendLog(profileId, `Chrome process error: ${e?.message || e}`); onChildExit('ERR', 'error'); }); } catch { }
      let wsEndpoint = null;
      try {
        const json = await fetchJsonVersion(host, port, 12000);
        wsEndpoint = json.webSocketDebuggerUrl || null;
      } catch (e) {
        appendLog(profileId, `DevTools version fetch failed, trying stderr-parsed WS: ${e?.message || e}`);
      }
      if (!wsEndpoint) {
        try {
          wsEndpoint = await Promise.race([
            wsPromise,
            (async () => { await new Promise(r => setTimeout(r, 8000)); throw new Error('timeout waiting for DevTools WS on stderr'); })(),
          ]);
        } catch (e) {
          await killProcessTreeWin(child.pid);
          const msg = 'DevTools WS endpoint not found';
          appendLog(profileId, `${msg}: ${e?.message || e}`);
          return { success: false, error: msg };
        }
      }
      if (!wsEndpoint) {
        await killProcessTreeWin(child.pid);
        const msg = 'DevTools WS endpoint not found';
        appendLog(profileId, msg);
        return { success: false, error: msg };
      }
      appendLog(profileId, `Chrome DevTools WS: ${wsEndpoint}`);
      // Setup heartbeat to detect abrupt disconnects if events miss
      let heartbeat = null;
      try {
        const { isWsAlive, pruneDeadCdp } = require('../engine/health');
        heartbeat = setInterval(async () => {
          try {
            const ok = await isWsAlive(wsEndpoint);
            if (!ok) {
              clearInterval(heartbeat);
              heartbeat = null;
              if (runningProfiles.has(profileId)) {
                try { await runningProfiles.get(profileId)?.forwarder?.stop?.(); } catch { }
                runningProfiles.delete(profileId);
                appendLog(profileId, 'Heartbeat: CDP endpoint down; clearing running state');
                broadcastRunningMap();
              }
            }
            // Periodically prune other dead CDP sessions as well
            else { await pruneDeadCdp(runningProfiles, appendLog, broadcastRunningMap); }
          } catch { }
        }, 2500);
      } catch { }
  runningProfiles.set(profileId, { engine: 'cdp', childProc: child, wsEndpoint, host, port, forwarder, heartbeat });
      broadcastRunningMap();
      // Always apply CDP overrides; InitScript can be toggled inside cdpOverrides based on settings.cdpApplyInitScript
      try { await applyCdpOverrides(profileId, wsEndpoint, profile, settings, startUrl, { appendLog, runningProfiles, broadcastRunningMap }); } catch (e) { appendLog(profileId, `CDP overrides failed: ${e?.message || e}`); }
      // Post-launch automation script (if configured)
      try { await runAutomationPostLaunch(profile, { engine: 'cdp', wsEndpoint }); } catch (e) { appendLog(profileId, `Automation post-launch error (CDP): ${e?.message || e}`); }
      return { success: true, wsEndpoint };
    }

    // Playwright flow
    const fp = profile.fingerprint || {};
    const args = [];
    if (settings.webrtc === 'proxy_only' || settings.webrtc === 'disable_udp') {
      args.push('--force-webrtc-ip-handling-policy=disable_non_proxied_udp', '--enforce-webrtc-ip-permission-check');
    }
    if (settings.webgl === false || fp.webgl === false) { args.push('--disable-3d-apis'); }
    const permissions = [];
    if (settings.mediaDevices?.audio) permissions.push('microphone');
    if (settings.mediaDevices?.video) permissions.push('camera');
    // Grant geolocation permission only when we intend to override and have valid coords
    try {
      const apply = (settings && settings.applyOverrides) || {};
      const applyGeo = apply.geolocation !== false;
      const g = settings?.geolocation || {};
      const wantGeo = Number.isFinite(Number(g.latitude)) && Number.isFinite(Number(g.longitude));
      if (applyGeo && wantGeo) permissions.push('geolocation');
    } catch {}
    let proxy;
    if (settings.proxy?.server) {
      proxy = { server: settings.proxy.server.startsWith('http') ? settings.proxy.server : `http://${settings.proxy.server}` };
      if (settings.proxy.username) proxy.username = settings.proxy.username;
      if (settings.proxy.password) proxy.password = settings.proxy.password;
    }
    let server;
    try { server = await chromium.launchServer({ headless, args, proxy }); }
    catch (e) {
      const msg = e?.message || String(e);
      appendLog(profileId, `Playwright launch failed: ${msg}`);
      if (/playwright\s+install|executable|not\s+found|Please run/i.test(msg)) {
        appendLog(profileId, 'Attempting auto-install playwright browsers (chromium)...');
        const ok = await runPlaywrightInstall('chromium');
        if (!ok) return { success: false, error: 'Playwright browsers not installed.' };
        server = await chromium.launchServer({ headless, args, proxy });
      } else throw e;
    }
    const wsEndpoint = server.wsEndpoint();
    const browser = await chromium.connect(wsEndpoint);
    appendLog(profileId, `Launched Playwright server: ${wsEndpoint}`);
    const apply = (settings && settings.applyOverrides) || {};
    const applyUA = apply.userAgent !== false;
    const applyLang = apply.language !== false;
    const applyTz = apply.timezone !== false;
    const applyViewport = apply.viewport !== false;
    const applyGeo = apply.geolocation !== false;
    const contextOptions = { proxy };
    if (applyLang) contextOptions.locale = fp.language || settings.language || 'en-US';
    if (applyTz) contextOptions.timezoneId = fp.timezone || settings.timezone || 'UTC';
    if (applyUA && fp.userAgent) contextOptions.userAgent = fp.userAgent;
    // Apply viewport and device scale like CDP DeviceMetricsOverride
    try {
      if (applyViewport) {
        const m = (fp.screenResolution || '').match(/^(\d+)x(\d+)$/);
        if (m) {
          contextOptions.viewport = { width: Math.max(1, parseInt(m[1], 10)), height: Math.max(1, parseInt(m[2], 10)) };
        }
        const dpr = Number((settings.advanced || {}).devicePixelRatio || 1);
        if (dpr > 0) contextOptions.deviceScaleFactor = dpr;
      }
    } catch { }
    if (applyGeo && settings.geolocation && settings.geolocation.latitude != null && settings.geolocation.longitude != null) {
      contextOptions.geolocation = {
        latitude: Number(settings.geolocation.latitude),
        longitude: Number(settings.geolocation.longitude),
        accuracy: Number(settings.geolocation.accuracy || 50),
      };
    }
    const statePath = storageStatePath(profileId);
    if (fs.existsSync(statePath)) { try { contextOptions.storageState = statePath; } catch { } }
    const context = await browser.newContext(contextOptions);
    if (permissions.length) { await context.grantPermissions(permissions); }
    try {
      const { applyFingerprintInitScripts } = require('../engine/fingerprintInit');
      await applyFingerprintInitScripts(context, profile, settings);
    } catch {}
    const page = await context.newPage();
    await page.goto(startUrl, { waitUntil: 'domcontentloaded' });
    appendLog(profileId, `Opened page: ${startUrl}`);

    const saveState = async () => {
      try {
        const state = await context.storageState();
        fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
        appendLog(profileId, `Saved storage state (${(state.cookies || []).length} cookies)`);
      } catch (e) {
        const msg = e?.message || String(e);
        if (/has been closed/i.test(msg)) appendLog(profileId, 'Storage save skipped: context closed'); else appendLog(profileId, `Error saving storage state: ${msg}`);
      }
    };
    page.on('close', async () => { await saveState(); try { await context.close(); } catch { } });
    context.on('close', async () => { await saveState(); runningProfiles.delete(profileId); appendLog(profileId, 'Context closed'); try { await server.close(); } catch { }; broadcastRunningMap(); });
    try { browser.on?.('disconnected', () => { if (runningProfiles.has(profileId)) { runningProfiles.delete(profileId); appendLog(profileId, 'Browser disconnected'); try { server.close(); } catch { }; broadcastRunningMap(); } }); } catch { }
    try { const proc = server.process?.(); proc && proc.once && proc.once('exit', (code, signal) => { if (runningProfiles.has(profileId)) { runningProfiles.delete(profileId); appendLog(profileId, `Browser server exited (${code || ''} ${signal || ''})`); broadcastRunningMap(); } }); } catch { }
    runningProfiles.set(profileId, { engine: 'playwright', server, browser, context, wsEndpoint });
    broadcastRunningMap();
    // Post-launch automation script (if configured)
    try { await runAutomationPostLaunch(profile, { engine: 'playwright', wsEndpoint, context, browser }); } catch (e) { appendLog(profileId, `Automation post-launch error: ${e?.message || e}`); }
    return { success: true, wsEndpoint };
  } catch (error) {
    appendLog(profileId, `Launch error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// Helper to execute automation steps / script after launch
async function runAutomationPostLaunch(profile, launchCtx) {
  if (!profile || !profile.automation || !profile.automation.enabled) return;
  const { automation } = profile;
  if (!automation.runOnLaunch && !(automation.schedule && automation.schedule.enabled)) return; // nothing immediate
  // Only run immediate steps if runOnLaunch
  if (!automation.runOnLaunch) return;
  const steps = Array.isArray(automation.steps) ? automation.steps : [];
  if (!steps.length) return;
  const profileId = profile.id;
  appendLog(profileId, `Automation: executing ${steps.length} step(s) post-launch`);
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    try {
      if (!step || typeof step !== 'object') continue;
      switch (step.action) {
        case 'wait': {
          const ms = Number(step.ms || step.duration || 0);
          if (ms > 0 && ms < 10 * 60 * 1000) await new Promise(r => setTimeout(r, ms));
          appendLog(profileId, `Automation: waited ${ms}ms`);
          break;
        }
        case 'navigate': {
          const url = step.url || step.href;
            if (!url) { appendLog(profileId, 'Automation: navigate step missing url'); break; }
          if (launchCtx.engine === 'playwright') {
            const context = launchCtx.context;
            const page = context.pages()[0] || await context.newPage();
            await page.goto(url, { waitUntil: step.waitUntil || 'domcontentloaded' });
          } else if (launchCtx.engine === 'cdp') {
            // Connect over CDP and create a new page (Target.createTarget) – simplified fallback: use navigateInternal via handlers if desired.
            try {
              const { chromium } = require('playwright');
              const browser = await chromium.connectOverCDP(launchCtx.wsEndpoint);
              const context = browser.contexts()[0];
              const page = context.pages()[0] || await context.newPage();
              await page.goto(url, { waitUntil: step.waitUntil || 'domcontentloaded' });
              await browser.close();
            } catch (e) { appendLog(profileId, `Automation navigate (CDP) failed: ${e?.message || e}`); }
          }
          appendLog(profileId, `Automation: navigated to ${url}`);
          break;
        }
        case 'eval': {
          const expression = step.expression || step.code;
          if (!expression) { appendLog(profileId, 'Automation: eval step missing expression'); break; }
          if (launchCtx.engine === 'playwright') {
            const context = launchCtx.context;
            const page = context.pages()[0] || await context.newPage();
            const value = await page.evaluate(expr => {
              try { return { ok: true, value: eval(expr) }; } catch (e) { return { ok: false, error: e?.message || String(e) }; }
            }, expression);
            appendLog(profileId, `Automation eval: ${value.ok ? JSON.stringify(value.value).slice(0,200) : ('ERR ' + value.error)}`);
          } else {
            try {
              const { chromium } = require('playwright');
              const browser = await chromium.connectOverCDP(launchCtx.wsEndpoint);
              const context = browser.contexts()[0];
              const page = context.pages()[0] || await context.newPage();
              const value = await page.evaluate(expr => { try { return { ok: true, value: eval(expr) }; } catch (e) { return { ok: false, error: e?.message || String(e) }; } }, expression);
              appendLog(profileId, `Automation eval (CDP): ${value.ok ? JSON.stringify(value.value).slice(0,200) : ('ERR ' + value.error)}`);
              await browser.close();
            } catch (e) { appendLog(profileId, `Automation eval (CDP) failed: ${e?.message || e}`); }
          }
          break;
        }
        case 'screenshot': {
          // Optional future implementation; currently no-op except log
          appendLog(profileId, 'Automation: screenshot step (not yet implemented)');
          break;
        }
        default:
          appendLog(profileId, `Automation: unknown step action '${step.action}'`);
      }
    } catch (e) {
      appendLog(profileId, `Automation step ${i} error: ${e?.message || e}`);
    }
  }
}

async function stopProfileInternal(profileId) {
  try {
    const running = runningProfiles.get(profileId);
    if (!running) return { success: true, message: 'Profile not running' };
    if (running.engine === 'cdp') {
      try { running.heartbeat && clearInterval(running.heartbeat); } catch { }
      try { await running.forwarder?.stop?.(); } catch { }
      try { await running.cdpControl?.browser?.close?.(); } catch { }
      const pid = running.childProc?.pid; if (pid) await killProcessTreeWin(pid); else { try { running.childProc?.kill?.('SIGKILL'); } catch { } }
      runningProfiles.delete(profileId);
      appendLog(profileId, 'Stopped CDP profile');
      broadcastRunningMap();
      return { success: true };
    }
    const { server, context, browser } = running;
    try {
      const statePath = storageStatePath(profileId);
      const state = await context.storageState();
      fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
      appendLog(profileId, 'Saved storage state before stop');
    } catch (e) { appendLog(profileId, `Failed saving state on stop: ${e.message}`); }
    try { await context.close(); } catch { }
    try { await browser?.close?.(); } catch { }
    try { await server.close(); } catch { }
    runningProfiles.delete(profileId);
    appendLog(profileId, 'Stopped profile');
    broadcastRunningMap();
    return { success: true };
  } catch (error) {
    appendLog(profileId, `Stop error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function stopAllProfilesInternal() {
  const ids = [...runningProfiles.keys()];
  let stopped = 0;
  for (const id of ids) {
    try {
      const running = runningProfiles.get(id);
      if (!running) continue;
      if (running.engine === 'cdp') {
        try { running.heartbeat && clearInterval(running.heartbeat); } catch { }
        try { await running.forwarder?.stop?.(); } catch { }
        const pid = running.childProc?.pid; if (pid) await killProcessTreeWin(pid);
        runningProfiles.delete(id);
        appendLog(id, 'Stopped CDP by stop-all');
      } else {
        const { server, context, browser } = running;
        try { const state = await context.storageState(); fs.writeFileSync(storageStatePath(id), JSON.stringify(state, null, 2)); appendLog(id, 'Saved storage state before stop-all'); } catch (e) { appendLog(id, `Failed save state on stop-all: ${e.message}`); }
        try { await context.close(); } catch { }
        try { await browser?.close?.(); } catch { }
        try { await server.close(); } catch { }
        runningProfiles.delete(id); appendLog(id, 'Stopped by stop-all');
      }
      stopped++;
    } catch (e) { appendLog(id, `Stop-all error: ${e.message}`); }
  }
  broadcastRunningMap();
  return { success: true, stopped };
}

// Browser control helpers
async function withConnectedBrowserForProfile(profileId, fn) {
  const running = runningProfiles.get(profileId);
  if (!running) return { success: false, error: 'Profile not running' };
  if (running.engine === 'playwright') {
    try {
      const browser = running.browser; const context = running.context;
      if (!browser || !context || context.isClosed?.()) return { success: false, error: 'Browser context not available' };
      const r = await fn({ engine: 'playwright', browser, context, cleanup: async () => { } });
      return r;
    } catch (e) { return { success: false, error: e?.message || String(e) }; }
  }
  try {
    const ws = running.wsEndpoint; const browser = await chromium.connectOverCDP(ws); const context = browser.contexts?.()[0];
    if (!context) { try { await browser.close(); } catch { }; return { success: false, error: 'No browser context found (CDP)' }; }
    const r = await fn({ engine: 'cdp', browser, context, cleanup: async () => { try { await browser.close(); } catch { } } });
    try { await browser.close(); } catch { }
    return r;
  } catch (e) { return { success: false, error: e?.message || String(e) }; }
}

async function listPagesInternal(profileId) { return await withConnectedBrowserForProfile(profileId, async ({ context, cleanup }) => { try { const pages = context.pages(); const out = []; let i = 0; for (const p of pages) { const title = await p.title().catch(() => ''); out.push({ index: i, url: p.url(), title }); i++; } await cleanup(); return { success: true, pages: out }; } catch (e) { await cleanup(); return { success: false, error: e?.message || String(e) }; } }); }

async function navigateInternal(profileId, { url, newPage = false, waitUntil = 'load' } = {}) { if (!url) return { success: false, error: 'url is required' }; return await withConnectedBrowserForProfile(profileId, async ({ context, cleanup }) => { try { let page; if (newPage || context.pages().length === 0) { page = await context.newPage(); } else { page = context.pages()[0]; } await page.goto(url, { waitUntil }); const title = await page.title().catch(() => ''); const currentUrl = page.url(); await cleanup(); return { success: true, url: currentUrl, title }; } catch (e) { await cleanup(); return { success: false, error: e?.message || String(e) }; } }); }

async function newPageInternal(profileId, { url, waitUntil = 'domcontentloaded' } = {}) { return await withConnectedBrowserForProfile(profileId, async ({ context, cleanup }) => { try { const page = await context.newPage(); if (url) await page.goto(url, { waitUntil }); const index = context.pages().indexOf(page); const title = await page.title().catch(() => ''); const currentUrl = page.url(); await cleanup(); return { success: true, index, url: currentUrl, title }; } catch (e) { await cleanup(); return { success: false, error: e?.message || String(e) }; } }); }

async function closePageInternal(profileId, { index = 0 } = {}) { return await withConnectedBrowserForProfile(profileId, async ({ context, cleanup }) => { try { const pages = context.pages(); if (index < 0 || index >= pages.length) { await cleanup(); return { success: false, error: 'Invalid page index' }; } const page = pages[index]; await page.close({ runBeforeUnload: true }); await cleanup(); return { success: true }; } catch (e) { await cleanup(); return { success: false, error: e?.message || String(e) }; } }); }

async function screenshotInternal(profileId, { index = 0, path: outPath, fullPage = false } = {}) { return await withConnectedBrowserForProfile(profileId, async ({ context, cleanup }) => { try { const pages = context.pages(); const page = pages[index] || pages[0] || (await context.newPage()); if (!page) { await cleanup(); return { success: false, error: 'No page available' }; } let result = {}; if (outPath) { try { require('fs').mkdirSync(require('path').dirname(outPath), { recursive: true }); } catch { } await page.screenshot({ path: outPath, fullPage: !!fullPage, type: 'png' }); result = { path: outPath }; } else { const buf = await page.screenshot({ fullPage: !!fullPage, type: 'png' }); result = { base64: buf.toString('base64') }; } await cleanup(); return { success: true, ...result }; } catch (e) { await cleanup(); return { success: false, error: e?.message || String(e) }; } }); }

async function evalInternal(profileId, { index = 0, expression } = {}) { if (typeof expression !== 'string') return { success: false, error: 'expression must be a string' }; return await withConnectedBrowserForProfile(profileId, async ({ context, cleanup }) => { try { const pages = context.pages(); const page = pages[index] || pages[0] || (await context.newPage()); const value = await page.evaluate(expr => { try { return eval(expr); } catch (e) { return { __error: true, message: e?.message || String(e) }; } }, expression); await cleanup(); if (value && value.__error) return { success: false, error: value.message }; return { success: true, value }; } catch (e) { await cleanup(); return { success: false, error: e?.message || String(e) }; } }); }

async function getProfileLogInternal(profileId) { try { const p = require('path').join(getDataRoot(), 'logs', `${profileId}.log`); if (!fs.existsSync(p)) return { success: true, log: '' }; return { success: true, log: fs.readFileSync(p, 'utf8') }; } catch (error) { return { success: false, error: error.message }; } }

async function getCookiesInternal(profileId) { try { if (runningProfiles.has(profileId)) { const running = runningProfiles.get(profileId); if (running.engine === 'playwright' && running.context) { const cookies = await running.context.cookies(); return { success: true, cookies }; } } const statePath = storageStatePath(profileId); if (fs.existsSync(statePath)) { const state = JSON.parse(fs.readFileSync(statePath, 'utf8')); return { success: true, cookies: state.cookies || [] }; } return { success: true, cookies: [] }; } catch (error) { return { success: false, error: error.message }; } }

async function importCookiesInternal(profileId, cookies) { try { if (!Array.isArray(cookies)) throw new Error('Invalid cookies payload'); if (runningProfiles.has(profileId)) { const running = runningProfiles.get(profileId); if (running.engine === 'playwright' && running.context) { await running.context.addCookies(cookies); const statePath = storageStatePath(profileId); const state = await running.context.storageState(); fs.writeFileSync(statePath, JSON.stringify(state, null, 2)); return { success: true }; } } const statePath = storageStatePath(profileId); let state = { cookies: [], origins: [] }; if (fs.existsSync(statePath)) { try { state = JSON.parse(fs.readFileSync(statePath, 'utf8')); } catch { } } state.cookies = cookies; fs.writeFileSync(statePath, JSON.stringify(state, null, 2)); return { success: true }; } catch (error) { return { success: false, error: error.message }; } }

async function getProfileWsInternal(profileId) { try { const running = runningProfiles.get(profileId); if (!running) return { success: true, wsEndpoint: null }; const ws = running.wsEndpoint; if (running.engine === 'playwright' && (running.context?.isClosed?.() || running.browser?.isConnected?.() === false)) { runningProfiles.delete(profileId); appendLog(profileId, 'Heartbeat: context/browser disconnected'); broadcastRunningMap(); return { success: true, wsEndpoint: null }; } const alive = await require('../engine/health').isWsAlive(ws); if (!alive) { runningProfiles.delete(profileId); appendLog(profileId, 'Heartbeat failed; removed stale running state'); broadcastRunningMap(); return { success: true, wsEndpoint: null }; } return { success: true, wsEndpoint: ws }; } catch (error) { return { success: false, error: error.message }; } }

async function getRunningMapInternal() { try { const result = {}; for (const [id, info] of runningProfiles.entries()) { let alive = true; if (info.engine === 'playwright' && (info.context?.isClosed?.() || info.browser?.isConnected?.() === false)) alive = false; else if (!(await require('../engine/health').isWsAlive(info.wsEndpoint))) alive = false; if (!alive) { runningProfiles.delete(id); appendLog(id, 'Bulk heartbeat: stale, clearing'); result[id] = null; } else { result[id] = info.wsEndpoint; } } return { success: true, map: result }; } catch (error) { return { success: false, error: error.message }; } }

async function getLocalesTimezonesInternal() { try { const locales = ['en-US', 'en-GB', 'en-CA', 'en-AU', 'vi-VN', 'fr-FR', 'de-DE', 'es-ES', 'it-IT', 'pt-BR', 'pt-PT', 'ru-RU', 'ja-JP', 'ko-KR', 'zh-CN', 'zh-TW', 'th-TH', 'id-ID', 'ms-MY', 'hi-IN', 'tr-TR', 'nl-NL', 'pl-PL']; const timezones = ['UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Madrid', 'Europe/Rome', 'Europe/Amsterdam', 'Europe/Warsaw', 'Asia/Tokyo', 'Asia/Seoul', 'Asia/Shanghai', 'Asia/Taipei', 'Asia/Bangkok', 'Asia/Jakarta', 'Asia/Kuala_Lumpur', 'Asia/Ho_Chi_Minh', 'Asia/Singapore', 'Asia/Kolkata', 'Australia/Sydney']; return { success: true, locales, timezones }; } catch (error) { return { success: false, error: error.message }; } }

// Manual trigger of automation steps for a profile. If not running, launch it first.
async function runAutomationNowInternal(profileId) {
  try {
    const { readProfiles } = require('../storage/profiles');
    const profiles = readProfiles();
    const profile = profiles.find(p => p.id === profileId);
    if (!profile) return { success: false, error: 'Profile not found' };
    if (!profile.automation || !profile.automation.enabled) return { success: false, error: 'Automation not enabled for this profile' };
    // Ensure running; launch if needed
    if (!runningProfiles.has(profileId)) {
      const res = await launchProfileInternal(profileId, { engine: profile.settings?.engine, headless: profile.settings?.headless });
      if (!res.success) return res;
      // runAutomationPostLaunch already ran; return success
      return { success: true, launched: true };
    }
    // Connect to current session and execute steps
    const running = runningProfiles.get(profileId);
    const engine = running.engine;
    const wsEndpoint = running.wsEndpoint;
    const steps = Array.isArray(profile.automation.steps) ? profile.automation.steps : [];
    appendLog(profileId, `Automation: manual run (${steps.length} steps)`);
    if (!steps.length) return { success: true, steps: 0 };
    const launchCtx = { engine, wsEndpoint };
    if (engine === 'playwright') {
      launchCtx.browser = running.browser;
      launchCtx.context = running.context;
    }
    await runAutomationPostLaunch(profile, launchCtx);
    return { success: true, steps: steps.length };
  } catch (e) { return { success: false, error: e?.message || String(e) }; }
}

module.exports = {
  launchProfileInternal,
  stopProfileInternal,
  stopAllProfilesInternal,
  runAutomationNowInternal,
  listPagesInternal,
  navigateInternal,
  newPageInternal,
  closePageInternal,
  screenshotInternal,
  evalInternal,
  getProfileLogInternal,
  getCookiesInternal,
  importCookiesInternal,
  getProfileWsInternal,
  getRunningMapInternal,
  getLocalesTimezonesInternal,
};
