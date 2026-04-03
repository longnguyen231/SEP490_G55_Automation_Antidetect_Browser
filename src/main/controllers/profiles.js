const fs = require('fs');
const { execFile } = require('child_process');
const { chromium } = require('playwright');
const { appendLog } = require('../logging/logger');
const { storageStatePath, getDataRoot } = require('../storage/paths');
const { loadSettings, resolveChromeExecutable, resolveVendorChromePath } = require('../storage/settings');
const { runningProfiles, launchingProfiles } = require('../state/runtime');
const { applyCdpOverrides } = require('../engine/cdpOverrides');
const { findFreePort, fetchJsonVersion, killProcessTreeWin, userDataDirFor, launchChromeCdp } = require('../engine/cdp');
const { readProfiles, writeProfiles, updateProfileSettings } = require('../storage/profiles');

/**
 * Reads the actual Chrome version from a binary by running `chrome --version`.
 * Returns full version string e.g. "136.0.7103.113" or null on failure.
 * Result is cached per path to avoid repeated spawns.
 */
const _chromeVersionCache = new Map();
function getChromeVersion(chromePath) {
  if (_chromeVersionCache.has(chromePath)) return Promise.resolve(_chromeVersionCache.get(chromePath));
  return new Promise((resolve) => {
    try {
      execFile(chromePath, ['--version'], { timeout: 5000, windowsHide: true }, (err, stdout) => {
        if (err) { resolve(null); return; }
        // stdout: "Google Chrome 136.0.7103.113" or "Chromium 136.0.7103.113"
        const m = String(stdout).match(/(\d+\.\d+\.\d+\.\d+)/);
        const version = m ? m[1] : null;
        _chromeVersionCache.set(chromePath, version);
        resolve(version);
      });
    } catch { resolve(null); }
  });
}

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
  if (runningProfiles.has(profileId)) {
    return { success: true, wsEndpoint: runningProfiles.get(profileId).wsEndpoint };
  }
  if (launchingProfiles.has(profileId)) {
    return { success: false, error: 'Profile is already starting up' };
  }
  launchingProfiles.add(profileId);
  try {
    const profiles = readProfiles();
    const profile = profiles.find(p => p.id === profileId);
    if (!profile) return { success: false, error: 'Profile not found' };
    const settings = profile.settings || {};
    let startUrl = profile.startUrl || 'https://www.google.com/?hl=en';
    if (startUrl === 'https://www.google.com' || startUrl === 'https://www.google.com/') {
      startUrl = 'https://www.google.com/?hl=en';
    }
    const engine = (options && options.engine) ? String(options.engine).toLowerCase() : (settings.engine === 'cdp' ? 'cdp' : 'playwright');
  const requestedHeadless = (options && typeof options.headless === 'boolean') ? options.headless : undefined;
  const headless = (requestedHeadless !== undefined) ? requestedHeadless : !!settings.headless;

    // Persist engine/headless — use atomic single-profile update to avoid
    // race conditions when multiple profiles are launched concurrently.
    try {
      updateProfileSettings(profileId, {
        engine: engine === 'cdp' ? 'cdp' : 'playwright',
        headless: !!headless,
      });
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
      const extraArgs = ['--lang=en-US'];
      // Parity flags with Playwright
      if (settings.webrtc === 'proxy_only' || settings.webrtc === 'disable_udp') {
        extraArgs.push('--force-webrtc-ip-handling-policy=disable_non_proxied_udp', '--enforce-webrtc-ip-permission-check');
      }
      const fp = profile.fingerprint || {};
      if (settings.webgl === false || fp.webgl === false) { extraArgs.push('--disable-3d-apis'); }
      if (headless) { extraArgs.push('--headless=new'); }
      // Proxy handling: start local forwarder when auth is present or using SOCKS
      let proxyForChrome = settings.proxy;
      let forwarder = null;
      try {
        const serverStr = (settings.proxy && settings.proxy.server) ? String(settings.proxy.server) : '';
        const hasAuth = !!(settings.proxy && (settings.proxy.username || settings.proxy.password));
        const proxyType = (settings.proxy?.type || '').toLowerCase();
        const isSocks = proxyType.startsWith('socks') || /^socks\d?:\/\//i.test(serverStr);
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
            else { 
              await pruneDeadCdp(runningProfiles, appendLog, broadcastRunningMap); 
              
              // Periodically save open tabs for session restore
              try {
                const info = runningProfiles.get(profileId);
                if (info && info.cdpControl && info.cdpControl.context) {
                  const pages = info.cdpControl.context.pages();
                  if (pages && pages.length > 0) {
                    const { saveSessionTabs } = require('../storage/sessionTabs');
                    saveSessionTabs(profileId, pages.map(p => p.url()));
                  }
                }
              } catch {}
            }
          } catch { }
        }, 8000);
      } catch { }
  runningProfiles.set(profileId, { engine: 'cdp', childProc: child, wsEndpoint, host, port, forwarder, heartbeat, startedAt: Date.now() });
      broadcastRunningMap();
      // Load saved tabs
      const { loadSessionTabs } = require('../storage/sessionTabs');
      const savedTabs = loadSessionTabs(profileId);

      // Always apply CDP overrides; InitScript can be toggled inside cdpOverrides based on settings.cdpApplyInitScript
      try { await applyCdpOverrides(profileId, wsEndpoint, profile, settings, startUrl, { appendLog, runningProfiles, broadcastRunningMap, savedTabs }); } catch (e) { appendLog(profileId, `CDP overrides failed: ${e?.message || e}`); }
      // Post-launch automation script (if configured)
      try { await runAutomationPostLaunch(profile, { engine: 'cdp', wsEndpoint }); } catch (e) { appendLog(profileId, `Automation post-launch error (CDP): ${e?.message || e}`); }
      return { success: true, wsEndpoint };
    }

    // Playwright flow — rebrowser-playwright (pipe mode).
    // rebrowser-playwright patches CDP leak at network level (Runtime.enable, bindings).
    // Combined with safeMode ON (no JS Object.defineProperty overrides), this bypasses
    // Cloudflare enterprise WAF.
    const engineMode = settings.engine || 'playwright';
    const isFirefox = engineMode === 'playwright-firefox' || engineMode === 'firefox';
    const { chromium, firefox } = require('playwright'); // rebrowser-playwright — must NOT use playwright-core (standard, unpatched)
    const pwEngine = isFirefox ? firefox : chromium;

    const fp = profile.fingerprint || {};
    const args = isFirefox ? [] : [
      '--lang=en-US',
      // ── Core anti-detect: hide automation signals ──
      '--disable-blink-features=AutomationControlled',
      // Single --disable-features flag — Chrome only honours the last occurrence, so all values must be merged here
      '--disable-features=AutomationControlled,ChromeWhatsNewUI,AutofillServerCommunication,TranslateUI',
      '--disable-infobars',
      '--exclude-switches=enable-automation',
      // ── Performance / background throttling ──
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--disable-ipc-flooding-protection',
      '--disable-hang-monitor',
      '--disable-prompt-on-repost',
      // ── Privacy / noise reduction ──
      '--disable-domain-reliability',
      '--disable-component-update',
      '--metrics-recording-only',
      '--no-service-autorun',
      '--password-store=basic',
      '--use-mock-keychain',
      '--export-tagged-pdf',
      // ── Misc ──
      '--no-default-browser-check',
      '--no-first-run',
    ];
    // Window size (Chromium flags only)
    if (!isFirefox && settings.windowWidth > 0 && settings.windowHeight > 0) {
      args.push(`--window-size=${settings.windowWidth},${settings.windowHeight}`);
    } else if (!isFirefox && settings.windowWidth === 0 && settings.windowHeight === 0) {
      args.push('--start-maximized');
    }
    if (settings.webrtc === 'proxy_only' || settings.webrtc === 'disable_udp') {
      if (!isFirefox) args.push('--force-webrtc-ip-handling-policy=disable_non_proxied_udp', '--enforce-webrtc-ip-permission-check');
    }
    if (settings.webgl === false || fp.webgl === false) { if (!isFirefox) args.push('--disable-3d-apis'); }
    const permissions = [];
    // Firefox only supports 'geolocation' and 'notifications' — skip microphone/camera for Firefox
    if (!isFirefox) {
      if (settings.mediaDevices?.audio) permissions.push('microphone');
      if (settings.mediaDevices?.video) permissions.push('camera');
    }
    // Grant geolocation permission only when we intend to override and have valid coords
    try {
      const apply = (settings && settings.applyOverrides) || {};
      const applyGeo = apply.geolocation !== false;
      const g = settings?.geolocation || {};
      const wantGeo = Number.isFinite(Number(g.latitude)) && Number.isFinite(Number(g.longitude));
      if (applyGeo && wantGeo) permissions.push('geolocation');
    } catch {}
    // Proxy handling
    let proxy;
    let forwarder = null;
    if (settings.proxy?.server) {
      const proxyType = (settings.proxy.type || '').toLowerCase();
      const isSocks = proxyType.startsWith('socks') || /^socks\d?:\/\//i.test(settings.proxy.server);
      const hasAuth = !!(settings.proxy.username || settings.proxy.password);
      if (hasAuth || isSocks) {
        try {
          const { startProxyForwarder } = require('../engine/proxyForwarder');
          forwarder = await startProxyForwarder(settings.proxy, { appendLog, profileId });
          proxy = { server: forwarder.url };
          appendLog(profileId, `Playwright using proxy forwarder: ${forwarder.url}`);
        } catch (e) {
          appendLog(profileId, `Proxy forwarder failed, falling back to direct: ${e?.message || e}`);
          let serverUrl = settings.proxy.server;
          if (!/^(https?|socks\d?):\/\//i.test(serverUrl)) serverUrl = `${isSocks ? 'socks5' : 'http'}://${serverUrl}`;
          proxy = { server: serverUrl };
          if (settings.proxy.username) proxy.username = settings.proxy.username;
          if (settings.proxy.password) proxy.password = settings.proxy.password;
        }
      } else {
        let serverUrl = settings.proxy.server;
        if (!/^(https?|socks\d?):\/\//i.test(serverUrl)) serverUrl = `http://${serverUrl}`;
        proxy = { server: serverUrl };
      }
    }
    // Resolve Chrome binary for Chromium engine.
    // Priority: 1) vendor folder  2) system-installed Chrome/Edge  3) bundled Playwright Chromium (last resort).
    let executablePath;
    let binarySource = 'bundled';
    let detectedChromeVersion = null;
    if (!isFirefox) {
      const vendorPath = resolveVendorChromePath();
      if (vendorPath) {
        executablePath = vendorPath;
        binarySource = 'vendor';
      } else {
        const systemPath = resolveChromeExecutable();
        if (systemPath) {
          executablePath = systemPath;
          binarySource = 'system';
        }
      }
      if (executablePath) {
        appendLog(profileId, `[binary] source=${binarySource} path=${executablePath}`);
        // Detect actual Chrome version from binary to ensure UA matches
        try {
          detectedChromeVersion = await getChromeVersion(executablePath);
          if (detectedChromeVersion) appendLog(profileId, `[binary] detected version=${detectedChromeVersion}`);
        } catch {}
      } else {
        appendLog(profileId, `[binary] source=bundled WARNING: no vendor or system Chrome found — icon will appear blue Chromium. Place Chrome at vendor/chrome-win/Chrome-bin/chrome.exe`);
      }
    }

    const chromiumLaunchOpts = {
      headless,
      args,
      proxy,
      ignoreDefaultArgs: ['--enable-automation'],
      // channel: undefined — never use installed Chrome channel, always use executablePath or bundled
      ...(executablePath ? { executablePath } : {}),
    };

    // Firefox about:config prefs to disable automation signals
    const firefoxUserPrefs = isFirefox ? {
      'dom.webdriver.enabled': false,
      'useAutomationExtension': false,
      // NOTE: do NOT set marionette.enabled=false — Playwright needs Marionette to control Firefox
      'toolkit.telemetry.enabled': false,
      'toolkit.telemetry.unified': false,
      'datareporting.policy.dataSubmissionEnabled': false,
      'datareporting.healthreport.uploadEnabled': false,
      'browser.newtabpage.activity-stream.telemetry': false,
      'browser.ping-centre.telemetry': false,
      'browser.send_pings': false,
      'media.peerconnection.ice.no_host': false,
      'privacy.resistFingerprinting': false,   // leave off — causes inconsistent FP values
      'privacy.trackingprotection.enabled': false,
      'geo.enabled': false,
      'browser.safebrowsing.enabled': false,
      'browser.safebrowsing.malware.enabled': false,
      'network.cookie.cookieBehavior': 0,
      'browser.aboutConfig.showWarning': false,
      'general.warnOnAboutConfig': false,
    } : undefined;

    let server;
    let browser;
    try {
      if (isFirefox) {
        server = await pwEngine.launchServer({ headless, args, proxy, firefoxUserPrefs });
        browser = await pwEngine.connect(server.wsEndpoint());
      } else {
        browser = await pwEngine.launch(chromiumLaunchOpts);
      }
    }
    catch (e) {
      const msg = e?.message || String(e);
      appendLog(profileId, `Playwright launch failed: ${msg}`);
      if (/playwright\s+install|executable|not\s+found|Please run/i.test(msg)) {
        const bname = isFirefox ? 'firefox' : 'chromium';
        appendLog(profileId, `Attempting auto-install playwright browsers (${bname})...`);
        const ok = await runPlaywrightInstall(bname);
        if (!ok) { try { await forwarder?.stop?.(); } catch {} return { success: false, error: 'Playwright browsers not installed.' }; }
        if (isFirefox) {
          server = await pwEngine.launchServer({ headless, args, proxy, firefoxUserPrefs });
          browser = await pwEngine.connect(server.wsEndpoint());
        } else {
          browser = await pwEngine.launch(chromiumLaunchOpts);
        }
      } else { try { await forwarder?.stop?.(); } catch {} throw e; }
    }
    // Log actual binary version for verification — should show Chrome/1xx not HeadlessChrome
    try { appendLog(profileId, `[binary] version=${browser.version()}`); } catch {}
    const wsEndpoint = isFirefox ? server.wsEndpoint() : null; // pipe mode for chromium
    appendLog(profileId, `Launched Playwright ${isFirefox ? 'Firefox server: ' + wsEndpoint : 'browser (pipe mode, no external WS)'}`);
    
    // safeMode: true (default) → skip CDP emulation commands (userAgent, locale,
    // timezone, geolocation) that Cloudflare enterprise detects.
    // Only viewport and proxy are safe because they don't use CDP Emulation APIs.
    // safeMode: skip Object.defineProperty overrides to bypass Cloudflare Enterprise (Chrome only).
    // Firefox can't bypass Cloudflare regardless (TLS fingerprint), so force safeMode=false
    // to enable full fingerprint injection on Firefox.
    const safeMode = isFirefox ? false : (settings?.safeMode !== false);
    const apply = (settings && settings.applyOverrides) || {};
    const applyUA = !safeMode && apply.userAgent !== false;
    const applyLang = !safeMode && apply.language !== false;
    const applyTz = !safeMode && apply.timezone !== false;
    const applyViewport = apply.viewport !== false; // viewport is safe even in safeMode
    const applyGeo = !safeMode && apply.geolocation !== false;
    const contextOptions = { proxy, extraHTTPHeaders: {} };

    // Force UA to match the actual binary version — prevents binary/UA mismatch detection.
    // If detectedChromeVersion is available, rebuild the UA with the real version number.
    if (!isFirefox && detectedChromeVersion && fp.userAgent) {
      const fixedUA = fp.userAgent.replace(/Chrome\/[\d.]+/, `Chrome/${detectedChromeVersion}`);
      if (fixedUA !== fp.userAgent) {
        fp.userAgent = fixedUA;
        appendLog(profileId, `[binary] UA synced to binary version: Chrome/${detectedChromeVersion}`);
      }
    }

    if (applyLang) {
      const spoofLang = fp.language || settings.language || 'en-US';
      contextOptions.locale = spoofLang;
      const langBase = spoofLang.split('-')[0];
      if (spoofLang.toLowerCase().startsWith('en')) {
        contextOptions.extraHTTPHeaders['Accept-Language'] = `${spoofLang},en;q=0.9`;
      } else {
        contextOptions.extraHTTPHeaders['Accept-Language'] = `${spoofLang},${langBase};q=0.9,en;q=0.8`;
      }
    }
    if (applyTz) contextOptions.timezoneId = fp.timezone || settings.timezone || 'UTC';
    if (applyUA && fp.userAgent) contextOptions.userAgent = fp.userAgent;
    // Apply viewport and device scale like CDP DeviceMetricsOverride
    try {
      if (applyViewport) {
        const m = (fp.screenResolution || '').match(/^(\d+)x(\d+)$/);
        if (m) contextOptions.viewport = { width: Math.max(1, parseInt(m[1], 10)), height: Math.max(1, parseInt(m[2], 10)) };
        const dpr = Number((settings.advanced || {}).devicePixelRatio || 1);
        if (dpr > 0) contextOptions.deviceScaleFactor = dpr;
      }
    } catch {}
    if (applyGeo && settings.geolocation && settings.geolocation.latitude != null && settings.geolocation.longitude != null) {
      contextOptions.geolocation = {
        latitude: Number(settings.geolocation.latitude),
        longitude: Number(settings.geolocation.longitude),
        accuracy: Number(settings.geolocation.accuracy || 50),
      };
    }
    const statePath = storageStatePath(profileId);
    if (fs.existsSync(statePath)) { try { contextOptions.storageState = statePath; } catch {} }
    const context = await browser.newContext(contextOptions);
    if (permissions.length) { await context.grantPermissions(permissions); }
    // Apply fingerprint init scripts (reuse safeMode from context options above)
    try {
      const { applyFingerprintInitScripts } = require('../engine/fingerprintInit');
      await applyFingerprintInitScripts(context, profile, settings, { safeMode, isFirefox });
    } catch {}
    // Inject mouse position tracker for behavior simulator
    try {
      const { injectMouseTracker } = require('../engine/behaviorSimulator');
      await injectMouseTracker(context);
    } catch {}

    // Inject mouse position tracker for behavior simulator
    try {
      const { injectMouseTracker } = require('../engine/behaviorSimulator');
      await injectMouseTracker(context);
    } catch {}

    const { loadSessionTabs, saveSessionTabs } = require('../storage/sessionTabs');
    const rawSavedTabs = loadSessionTabs(profileId);
    // Only restore valid http/https URLs — filter out about:blank, en-us, and other garbage
    const savedTabs = (rawSavedTabs || []).filter(u => typeof u === 'string' && /^https?:\/\//i.test(u));
    let page;
    if (savedTabs && savedTabs.length > 0) {
      appendLog(profileId, `Restoring ${savedTabs.length} saved tabs...`);
      let first = true;
      for (const url of savedTabs) {
        try {
          const p = first ? ((context.pages() || [])[0] || await context.newPage()) : await context.newPage();
          first = false;
          p.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(err => {
            appendLog(profileId, `Failed to load restored tab ${url}: ${err?.message || err}`);
          });
        } catch (e) {
          appendLog(profileId, `Failed to create tab for ${url}: ${e?.message || e}`);
        }
      }
    } else {
      // Reuse the default tab that Playwright opens (avoids double-tab on Firefox)
      const existingPages = context.pages();
      if (existingPages && existingPages.length > 0) {
        page = existingPages[0];
      } else {
        page = await context.newPage();
      }
      try {
        const { navigateWithRetry, installBlockDetector } = require('../engine/blockedPageDetector');
        const navResult = await navigateWithRetry(page, startUrl, profileId, {
          maxRetries: 2, retryDelayMs: 5000, waitUntil: 'domcontentloaded', timeout: 30000,
        });
        if (navResult.blocked) {
          appendLog(profileId, `Warning: page may be blocked (${navResult.pattern}). Browser is open for manual interaction.`);
        }
        installBlockDetector(page, profileId);
      } catch (navErr) {
        appendLog(profileId, `First navigation attempt failed: ${navErr?.message || navErr}. Retrying...`);
        try {
          await new Promise(r => setTimeout(r, 2000));
          await page.goto(startUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        } catch (retryErr) {
          appendLog(profileId, `Second navigation attempt failed: ${retryErr?.message || retryErr}. Browser is open but page not loaded.`);
        }
      }
      appendLog(profileId, `Opened page: ${startUrl}`);
    }

    const saveState = async () => {
      try {
        const state = await context.storageState();
        fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
        appendLog(profileId, `Saved storage state (${(state.cookies || []).length} cookies)`);
      } catch (e) {
        const msg = e?.message || String(e);
        if (/has been closed/i.test(msg)) appendLog(profileId, 'Storage save skipped: context closed');
        else appendLog(profileId, `Error saving storage state: ${msg}`);
      }
      try {
        const pages = context.pages();
        if (pages && pages.length > 0) saveSessionTabs(profileId, pages.map(p => p.url()));
      } catch {}
    };
    // Cleanup helper
    let playwrightCleaned = false;
    const cleanupPlaywright = async (reason) => {
      if (playwrightCleaned) return;
      playwrightCleaned = true;
      await saveState();
      try { await forwarder?.stop?.(); } catch {}
      runningProfiles.delete(profileId);
      appendLog(profileId, reason);
      try { await context.close(); } catch {}
      try { await browser?.close?.(); } catch {}
      broadcastRunningMap();
    };
    context.on('close', () => cleanupPlaywright('Context closed'));
    try { browser.on?.('disconnected', () => cleanupPlaywright('Browser disconnected')); } catch {}
    // Detect when user closes all browser tabs via "X" button
    const onPageClose = () => {
      try {
        const pages = context.pages();
        if (!pages || pages.length === 0) {
          appendLog(profileId, 'All browser pages closed by user');
          cleanupPlaywright('All pages closed — browser stopped');
        }
      } catch { cleanupPlaywright('Page close check failed — browser stopped'); }
    };
    try { for (const p of context.pages()) { p.on('close', onPageClose); } } catch {}
    context.on('page', (newPage) => { try { newPage.on('close', onPageClose); } catch {} });
    runningProfiles.set(profileId, { engine: 'playwright', server, browser, context, wsEndpoint, forwarder, startedAt: Date.now() });
    broadcastRunningMap();
    // Post-launch automation script (if configured)
    try { await runAutomationPostLaunch(profile, { engine: 'playwright', wsEndpoint, context, browser }); } catch (e) { appendLog(profileId, `Automation post-launch error: ${e?.message || e}`); }
    return { success: true, wsEndpoint };
  } catch (error) {
    appendLog(profileId, `Launch error: ${error.message}`);
    return { success: false, error: error.message };
  } finally {
    launchingProfiles.delete(profileId);
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
        case 'behavior': {
          // Human-like behavior simulation step
          // Supported types: browse, scroll, idle, click, type
          try {
            const behavior = require('../engine/behaviorSimulator');
            const seed = (profileId || '').split('').reduce((h, c) => ((h << 5) - h) + c.charCodeAt(0), 0);
            const rng = behavior.createRng(Math.abs(seed) + Date.now());
            let page;
            if (launchCtx.engine === 'playwright' && launchCtx.context) {
              page = launchCtx.context.pages()[0];
            } else if (launchCtx.engine === 'cdp') {
              const { chromium } = require('playwright');
              const browser = await chromium.connectOverCDP(launchCtx.wsEndpoint);
              const ctx = browser.contexts()[0];
              page = ctx?.pages()[0];
            }
            if (page) {
              const behaviorType = step.behaviorType || 'browse';
              switch (behaviorType) {
                case 'browse': await behavior.simulateBrowsing(page, rng, step); break;
                case 'scroll': await behavior.naturalScroll(page, rng, step); break;
                case 'idle': await behavior.simulateIdle(page, rng, step); break;
                case 'click': if (step.selector) await behavior.humanClick(page, rng, step.selector, step); break;
                case 'type': if (step.selector && step.text) await behavior.humanType(page, rng, step.selector, step.text, step); break;
                default: await behavior.simulateBrowsing(page, rng, step);
              }
              appendLog(profileId, `Automation: behavior simulation (${behaviorType})`);
            } else {
              appendLog(profileId, 'Automation: behavior step skipped — no page available');
            }
          } catch (e) {
            appendLog(profileId, `Automation: behavior step failed: ${e?.message || e}`);
          }
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

async function reloadPageInternal(profileId, { index = 0, timeout, waitUntil = 'load' } = {}) { return await withConnectedBrowserForProfile(profileId, async ({ context, cleanup }) => { try { const pages = context.pages(); const page = pages[index] || pages[0]; if (!page) { await cleanup(); return { success: false, error: 'No page available' }; } const opts = { waitUntil }; if (timeout != null) opts.timeout = Number(timeout); await page.reload(opts); const title = await page.title().catch(() => ''); await cleanup(); return { success: true, url: page.url(), title }; } catch (e) { await cleanup(); return { success: false, error: e?.message || String(e) }; } }); }

async function goBackInternal(profileId, { index = 0, waitUntil = 'load' } = {}) { return await withConnectedBrowserForProfile(profileId, async ({ context, cleanup }) => { try { const pages = context.pages(); const page = pages[index] || pages[0]; if (!page) { await cleanup(); return { success: false, error: 'No page available' }; } const response = await page.goBack({ waitUntil }); await cleanup(); return { success: true, url: page.url(), navigated: !!response }; } catch (e) { await cleanup(); return { success: false, error: e?.message || String(e) }; } }); }

async function goForwardInternal(profileId, { index = 0, waitUntil = 'load' } = {}) { return await withConnectedBrowserForProfile(profileId, async ({ context, cleanup }) => { try { const pages = context.pages(); const page = pages[index] || pages[0]; if (!page) { await cleanup(); return { success: false, error: 'No page available' }; } const response = await page.goForward({ waitUntil }); await cleanup(); return { success: true, url: page.url(), navigated: !!response }; } catch (e) { await cleanup(); return { success: false, error: e?.message || String(e) }; } }); }

async function getPageInfoInternal(profileId, { index = 0 } = {}) { return await withConnectedBrowserForProfile(profileId, async ({ context, cleanup }) => { try { const pages = context.pages(); const page = pages[Number(index)] || pages[0]; if (!page) { await cleanup(); return { success: false, error: 'No page available' }; } const [title, url] = await Promise.all([page.title().catch(() => ''), Promise.resolve(page.url())]); await cleanup(); return { success: true, url, title }; } catch (e) { await cleanup(); return { success: false, error: e?.message || String(e) }; } }); }

async function getPageContentInternal(profileId, { index = 0 } = {}) { return await withConnectedBrowserForProfile(profileId, async ({ context, cleanup }) => { try { const pages = context.pages(); const page = pages[Number(index)] || pages[0]; if (!page) { await cleanup(); return { success: false, error: 'No page available' }; } const content = await page.content(); await cleanup(); return { success: true, content }; } catch (e) { await cleanup(); return { success: false, error: e?.message || String(e) }; } }); }

async function clickElementInternal(profileId, { selector, index = 0, button = 'left', clickCount = 1, delay } = {}) {
  if (!selector) return { success: false, error: 'selector is required' };
  return await withConnectedBrowserForProfile(profileId, async ({ context, cleanup }) => {
    try {
      const pages = context.pages();
      const page = pages[Number(index)] || pages[0];
      if (!page) { await cleanup(); return { success: false, error: 'No page available' }; }
      const opts = { button, clickCount };
      if (delay != null) opts.delay = Number(delay);
      await page.click(selector, opts);
      await cleanup();
      return { success: true };
    } catch (e) { await cleanup(); return { success: false, error: e?.message || String(e) }; }
  });
}

async function doubleClickElementInternal(profileId, { selector, index = 0, delay } = {}) {
  if (!selector) return { success: false, error: 'selector is required' };
  return await withConnectedBrowserForProfile(profileId, async ({ context, cleanup }) => {
    try {
      const pages = context.pages();
      const page = pages[Number(index)] || pages[0];
      if (!page) { await cleanup(); return { success: false, error: 'No page available' }; }
      const opts = {};
      if (delay != null) opts.delay = Number(delay);
      await page.dblclick(selector, opts);
      await cleanup();
      return { success: true };
    } catch (e) { await cleanup(); return { success: false, error: e?.message || String(e) }; }
  });
}

async function grantPermissionsInternal(profileId, { permissions = [], origin } = {}) {
  return await withConnectedBrowserForProfile(profileId, async ({ context, cleanup }) => {
    try {
      await context.grantPermissions(permissions, origin ? { origin } : undefined);
      await cleanup();
      return { success: true };
    } catch (e) {
      await cleanup();
      return { success: false, error: e?.message || String(e) };
    }
  });
}

async function clearPermissionsInternal(profileId) {
  return await withConnectedBrowserForProfile(profileId, async ({ context, cleanup }) => {
    try {
      await context.clearPermissions();
      await cleanup();
      return { success: true };
    } catch (e) {
      await cleanup();
      return { success: false, error: e?.message || String(e) };
    }
  });
}

async function setExtraHTTPHeadersInternal(profileId, { headers } = {}) {
  if (!headers || typeof headers !== 'object') return { success: false, error: 'headers must be an object' };
  return await withConnectedBrowserForProfile(profileId, async ({ context, cleanup }) => {
    try {
      await context.setExtraHTTPHeaders(headers);
      await cleanup();
      return { success: true };
    } catch (e) {
      await cleanup();
      return { success: false, error: e?.message || String(e) };
    }
  });
}

async function setGeolocationInternal(profileId, { latitude, longitude, accuracy } = {}) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { success: false, error: 'latitude and longitude are required numbers' };
  const geo = { latitude: lat, longitude: lng, accuracy: Number(accuracy ?? 50) };
  return await withConnectedBrowserForProfile(profileId, async ({ context, cleanup }) => {
    try {
      await context.setGeolocation(geo);
      await cleanup();
      return { success: true, geolocation: geo };
    } catch (e) {
      await cleanup();
      return { success: false, error: e?.message || String(e) };
    }
  });
}

async function getProfileLogInternal(profileId) { try { const p = require('path').join(getDataRoot(), 'logs', `${profileId}.log`); if (!fs.existsSync(p)) return { success: true, log: '' }; return { success: true, log: fs.readFileSync(p, 'utf8') }; } catch (error) { return { success: false, error: error.message }; } }

async function getCookiesInternal(profileId) { try { if (runningProfiles.has(profileId)) { const running = runningProfiles.get(profileId); if (running.engine === 'playwright' && running.context) { const cookies = await running.context.cookies(); return { success: true, cookies }; } } const statePath = storageStatePath(profileId); if (fs.existsSync(statePath)) { const state = JSON.parse(fs.readFileSync(statePath, 'utf8')); return { success: true, cookies: state.cookies || [] }; } return { success: true, cookies: [] }; } catch (error) { return { success: false, error: error.message }; } }

async function importCookiesInternal(profileId, cookies) { try { if (!Array.isArray(cookies)) throw new Error('Invalid cookies payload'); const validated = cookies.map(c => { if (!c.name || !c.value || !c.domain) throw new Error('Each cookie must have name, value, and domain'); return { name: String(c.name), value: String(c.value), domain: String(c.domain), path: String(c.path || '/'), expires: c.expires ? Number(c.expires) : -1, httpOnly: !!c.httpOnly, secure: !!c.secure, sameSite: ['Strict','Lax','None'].includes(c.sameSite) ? c.sameSite : 'Lax' }; }); if (runningProfiles.has(profileId)) { const running = runningProfiles.get(profileId); if (running.engine === 'playwright' && running.context) { await running.context.addCookies(validated); const statePath = storageStatePath(profileId); const state = await running.context.storageState(); fs.writeFileSync(statePath, JSON.stringify(state, null, 2)); return { success: true, count: validated.length }; } } const statePath = storageStatePath(profileId); let state = { cookies: [], origins: [] }; if (fs.existsSync(statePath)) { try { state = JSON.parse(fs.readFileSync(statePath, 'utf8')); } catch { } } const existing = state.cookies || []; for (const nc of validated) { const idx = existing.findIndex(e => e.name === nc.name && e.domain === nc.domain && e.path === nc.path); if (idx >= 0) existing[idx] = nc; else existing.push(nc); } state.cookies = existing; fs.writeFileSync(statePath, JSON.stringify(state, null, 2)); return { success: true, count: validated.length }; } catch (error) { return { success: false, error: error.message }; } }

async function deleteCookieInternal(profileId, { name, domain, path: cookiePath }) { try { if (!name || !domain) throw new Error('name and domain are required'); const targetPath = cookiePath || '/'; if (runningProfiles.has(profileId)) { const running = runningProfiles.get(profileId); if (running.engine === 'playwright' && running.context) { await running.context.addCookies([{ name, domain, path: targetPath, value: '', expires: 0 }]); const statePath = storageStatePath(profileId); const state = await running.context.storageState(); fs.writeFileSync(statePath, JSON.stringify(state, null, 2)); return { success: true }; } } const statePath = storageStatePath(profileId); if (!fs.existsSync(statePath)) return { success: true }; const state = JSON.parse(fs.readFileSync(statePath, 'utf8')); state.cookies = (state.cookies || []).filter(c => !(c.name === name && c.domain === domain && (c.path || '/') === targetPath)); fs.writeFileSync(statePath, JSON.stringify(state, null, 2)); return { success: true }; } catch (error) { return { success: false, error: error.message }; } }

async function clearCookiesInternal(profileId) { try { if (runningProfiles.has(profileId)) { const running = runningProfiles.get(profileId); if (running.engine === 'playwright' && running.context) { await running.context.clearCookies(); const statePath = storageStatePath(profileId); const state = await running.context.storageState(); fs.writeFileSync(statePath, JSON.stringify(state, null, 2)); return { success: true }; } } const statePath = storageStatePath(profileId); if (fs.existsSync(statePath)) { const state = JSON.parse(fs.readFileSync(statePath, 'utf8')); state.cookies = []; fs.writeFileSync(statePath, JSON.stringify(state, null, 2)); } return { success: true }; } catch (error) { return { success: false, error: error.message }; } }

async function editCookieInternal(profileId, cookie) { try { if (!cookie || !cookie.name || !cookie.domain) throw new Error('cookie with name and domain is required'); const validated = { name: String(cookie.name), value: String(cookie.value || ''), domain: String(cookie.domain), path: String(cookie.path || '/'), expires: cookie.expires ? Number(cookie.expires) : -1, httpOnly: !!cookie.httpOnly, secure: !!cookie.secure, sameSite: ['Strict','Lax','None'].includes(cookie.sameSite) ? cookie.sameSite : 'Lax' }; if (runningProfiles.has(profileId)) { const running = runningProfiles.get(profileId); if (running.engine === 'playwright' && running.context) { await running.context.addCookies([validated]); const statePath = storageStatePath(profileId); const state = await running.context.storageState(); fs.writeFileSync(statePath, JSON.stringify(state, null, 2)); return { success: true }; } } const statePath = storageStatePath(profileId); let state = { cookies: [], origins: [] }; if (fs.existsSync(statePath)) { try { state = JSON.parse(fs.readFileSync(statePath, 'utf8')); } catch { } } const existing = state.cookies || []; const idx = existing.findIndex(e => e.name === validated.name && e.domain === validated.domain && (e.path || '/') === validated.path); if (idx >= 0) existing[idx] = validated; else existing.push(validated); state.cookies = existing; fs.writeFileSync(statePath, JSON.stringify(state, null, 2)); return { success: true }; } catch (error) { return { success: false, error: error.message }; } }

async function getStorageStateInternal(profileId) { try { if (runningProfiles.has(profileId)) { const running = runningProfiles.get(profileId); if (running.engine === 'playwright' && running.context) { const state = await running.context.storageState(); return { success: true, state }; } } const statePath = storageStatePath(profileId); if (fs.existsSync(statePath)) { const state = JSON.parse(fs.readFileSync(statePath, 'utf8')); return { success: true, state }; } return { success: true, state: { cookies: [], origins: [] } }; } catch (error) { return { success: false, error: error.message }; } }

async function getProfileWsInternal(profileId) {
  try {
    const running = runningProfiles.get(profileId);
    if (!running) return { success: true, wsEndpoint: null };

    // Skip health check for recently-started profiles
    const age = running.startedAt ? (Date.now() - running.startedAt) : Infinity;
    if (age < 20000) return { success: true, wsEndpoint: running.wsEndpoint };

    if (running.engine === 'playwright') {
      if (running.context?.isClosed?.() || running.browser?.isConnected?.() === false) {
        runningProfiles.delete(profileId);
        appendLog(profileId, 'getProfileWs: Playwright browser disconnected');
        broadcastRunningMap();
        return { success: true, wsEndpoint: null };
      }
      return { success: true, wsEndpoint: running.wsEndpoint };
    }

    const alive = await require('../engine/health').isWsAlive(running.wsEndpoint);
    if (!alive) {
      runningProfiles.delete(profileId);
      appendLog(profileId, 'getProfileWs: CDP heartbeat failed, removed');
      broadcastRunningMap();
      return { success: true, wsEndpoint: null };
    }
    return { success: true, wsEndpoint: running.wsEndpoint };
  } catch (error) { return { success: false, error: error.message }; }
}

async function getRunningMapInternal() {
  try {
    const GRACE_MS = 15000;
    const result = {};
    for (const [id, info] of runningProfiles.entries()) {
      // Always include recently-started profiles regardless of health check
      const age = info.startedAt ? (Date.now() - info.startedAt) : Infinity;
      if (age < GRACE_MS) { result[id] = info.wsEndpoint; continue; }

      let alive = true;
      if (info.engine === 'playwright') {
        if (info.context?.isClosed?.() || info.browser?.isConnected?.() === false) alive = false;
      } else {
        if (!(await require('../engine/health').isWsAlive(info.wsEndpoint))) alive = false;
      }
      if (!alive) {
        runningProfiles.delete(id);
        appendLog(id, 'Bulk heartbeat: stale, clearing');
        broadcastRunningMap();
      } else {
        result[id] = info.wsEndpoint;
      }
    }
    return { success: true, map: result };
  } catch (error) { return { success: false, error: error.message }; }
}

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
  reloadPageInternal,
  goBackInternal,
  goForwardInternal,
  getPageInfoInternal,
  getPageContentInternal,
  clickElementInternal,
  doubleClickElementInternal,
  grantPermissionsInternal,
  clearPermissionsInternal,
  setExtraHTTPHeadersInternal,
  setGeolocationInternal,
  getProfileLogInternal,
  getCookiesInternal,
  importCookiesInternal,
  getStorageStateInternal,
  getProfileWsInternal,
  getRunningMapInternal,
  getLocalesTimezonesInternal,
};
