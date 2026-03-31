/**
 * fingerprintInit.js — Browser-side fingerprint injection scripts.
 *
 * All functions passed to context.addInitScript() execute inside the browser
 * context BEFORE any page scripts. They must be completely self-contained
 * (no Node.js APIs, no closures over outer scope).
 */

function parseResolution(res) {
  try {
    if (!res || typeof res !== 'string') return null;
    const m = res.match(/^(\d+)x(\d+)$/);
    if (!m) return null;
    const width = Math.max(1, parseInt(m[1], 10));
    const height = Math.max(1, parseInt(m[2], 10));
    return { width, height };
  } catch { return null; }
}

// Simple string hash for generating seed from profile ID
function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return Math.abs(hash);
}

async function applyFingerprintInitScripts(context, profile, settings, { overrideUserAgent } = {}) {
  // Support both new structure (profile.identity, profile.display, etc.)
  // and old structure (profile.fingerprint, profile.settings) for stored profiles.
  const fp = (profile && profile.fingerprint) || {};
  const adv = (settings && settings.advanced) || {};
  const identity = profile.identity || settings.identity || {};
  const display = profile.display || settings.display || {};
  const hardware = profile.hardware || settings.hardware || {};
  const canvas = profile.canvas || settings.canvas || {};
  const webgl = profile.webgl || settings.webgl || {};
  const audio = profile.audio || settings.audio || {};
  const media = profile.media || settings.media || {};
  const network = profile.network || settings.network || {};
  const battery = profile.battery || settings.battery || {};

  const locale = identity.locale || fp.language || settings?.language || 'en-US';
  const userAgent = overrideUserAgent || identity.userAgent || fp.userAgent || undefined;
  const cpuCores = Number(hardware.cpuCores || settings?.cpuCores || 4);
  const deviceMemory = Number(hardware.memoryGB || settings?.memoryGB || 8);
  const apply = (settings && settings.applyOverrides) || {};
  const applyHardware = hardware.enabled !== false && apply.hardware !== false;
  const applyNavigator = identity.enabled !== false && apply.navigator !== false;
  const applyUA = identity.enabled !== false && apply.userAgent !== false;
  const applyWebgl = webgl.enabled !== false && apply.webgl !== false;
  const applyLang = identity.enabled !== false && apply.language !== false;
  const applyViewport = display.enabled !== false && apply.viewport !== false;
  const applyCanvas = canvas.enabled !== false && (fp.canvas !== false);
  const applyAudio = audio.enabled !== false && (fp.audio !== false);
  const applyAntiDetection = network.antiDetection !== false && apply.antiDetection !== false;

  // Generate a stable per-profile seed for consistent noise
  const profileSeed = hashCode(profile?.id || 'default');

  // ═══════════════════════════════════════════════════════════════════════
  // 0. ANTI-AUTOMATION DETECTION (must run FIRST, before anything else)
  //    Cloudflare, DataDome, PerimeterX all check these signals.
  //    Can be disabled via network.antiDetection=false or applyOverrides.antiDetection=false
  // ═══════════════════════════════════════════════════════════════════════
  if (applyAntiDetection) try {
    await context.addInitScript(() => {
      try {
        // ── navigator.webdriver ──
        // Real Chrome: navigator.webdriver === false (not undefined, not true).
        // Playwright/CDP set it to true. We must make it false to match real Chrome.
        // Also must survive Object.getOwnPropertyDescriptor checks.
        const proto = Object.getPrototypeOf(navigator);
        if (proto) {
          try {
            delete proto.webdriver;
            Object.defineProperty(proto, 'webdriver', {
              get: () => false,
              configurable: true,
              enumerable: true,
            });
          } catch {}
        }
        try {
          Object.defineProperty(navigator, 'webdriver', {
            get: () => false,
            configurable: true,
            enumerable: true,
          });
        } catch {}

        // ── Remove Playwright/CDP artifacts ──
        try { delete window.__playwright; } catch {}
        try { delete window.__pw_manual; } catch {}
        try { delete window.__PW_inspect; } catch {}
        try { delete window.cdc_adoQpoasnfa76pfcZLmcfl_Array; } catch {}
        try { delete window.cdc_adoQpoasnfa76pfcZLmcfl_Promise; } catch {}
        try { delete window.cdc_adoQpoasnfa76pfcZLmcfl_Symbol; } catch {}
        // Remove any window property starting with 'cdc_' or '__'playwright markers
        try {
          for (const key of Object.keys(window)) {
            if (key.startsWith('cdc_') || key.startsWith('__cdc_') ||
                key.startsWith('__playwright') || key.startsWith('__pw')) {
              try { delete window[key]; } catch {}
            }
          }
        } catch {}

        // ── Remove CDP Runtime.enable detection ──
        // Google checks for the existence of CDP debugging artifacts.
        // Intercept calls that reveal CDP is active.
        try {
          // Some sites check Error.stack for devtools/CDP traces
          const origCaptureStack = Error.captureStackTrace;
          if (origCaptureStack) {
            Error.captureStackTrace = function (target, constructorOpt) {
              origCaptureStack.call(Error, target, constructorOpt);
              if (target && target.stack) {
                // Remove any lines referencing playwright, puppeteer, or CDP internals
                target.stack = target.stack.split('\n').filter(function (line) {
                  return !(/playwright|puppeteer|__puppeteer|devtools|pptr:/).test(line);
                }).join('\n');
              }
            };
          }
        } catch {}

        // ── window.chrome — Complete mock matching real Chrome ──
        if (!window.chrome) window.chrome = {};

        // chrome.app
        if (!window.chrome.app) {
          window.chrome.app = {
            isInstalled: false,
            InstallState: { DISABLED: 'disabled', INSTALLED: 'installed', NOT_INSTALLED: 'not_installed' },
            RunningState: { CANNOT_RUN: 'cannot_run', READY_TO_RUN: 'ready_to_run', RUNNING: 'running' },
            getDetails: function () { return null; },
            getIsInstalled: function () { return false; },
            installState: function (cb) { if (cb) cb('not_installed'); },
          };
        }

        // chrome.runtime — must have connect/sendMessage AND proper id/getManifest
        // Google specifically checks chrome.runtime.id existence and type
        if (!window.chrome.runtime) {
          window.chrome.runtime = {};
        }
        const rt = window.chrome.runtime;
        if (!rt.connect) rt.connect = function () {
          return {
            onMessage: { addListener: function () {}, removeListener: function () {} },
            onDisconnect: { addListener: function () {}, removeListener: function () {} },
            postMessage: function () {},
            disconnect: function () {},
          };
        };
        if (!rt.sendMessage) rt.sendMessage = function (id, msg, opts, cb) {
          // Real Chrome calls callback with undefined for unknown extensions
          if (typeof cb === 'function') cb();
          else if (typeof opts === 'function') opts();
        };
        if (!rt.getManifest) rt.getManifest = function () { return {}; };
        if (!rt.getURL) rt.getURL = function (p) { return ''; };
        if (!rt.id) rt.id = undefined; // Real Chrome: undefined when no extension context
        if (!rt.OnInstalledReason) rt.OnInstalledReason = { CHROME_UPDATE: 'chrome_update', INSTALL: 'install', SHARED_MODULE_UPDATE: 'shared_module_update', UPDATE: 'update' };
        if (!rt.OnRestartRequiredReason) rt.OnRestartRequiredReason = { APP_UPDATE: 'app_update', OS_UPDATE: 'os_update', PERIODIC: 'periodic' };
        if (!rt.PlatformArch) rt.PlatformArch = { ARM: 'arm', ARM64: 'arm64', MIPS: 'mips', MIPS64: 'mips64', X86_32: 'x86-32', X86_64: 'x86-64' };
        if (!rt.PlatformNaclArch) rt.PlatformNaclArch = { ARM: 'arm', MIPS: 'mips', MIPS64: 'mips64', X86_32: 'x86-32', X86_64: 'x86-64' };
        if (!rt.PlatformOs) rt.PlatformOs = { ANDROID: 'android', CROS: 'cros', FUCHSIA: 'fuchsia', LINUX: 'linux', MAC: 'mac', OPENBSD: 'openbsd', WIN: 'win' };
        if (!rt.RequestUpdateCheckStatus) rt.RequestUpdateCheckStatus = { NO_UPDATE: 'no_update', THROTTLED: 'throttled', UPDATE_AVAILABLE: 'update_available' };

        // chrome.csi
        if (!window.chrome.csi) {
          window.chrome.csi = function () {
            return {
              onloadT: Date.now(),
              startE: Date.now(),
              pageT: performance.now(),
              tran: 15,
            };
          };
        }

        // chrome.loadTimes
        if (!window.chrome.loadTimes) {
          window.chrome.loadTimes = function () {
            const navEntry = performance.getEntriesByType('navigation')[0] || {};
            return {
              commitLoadTime: Date.now() / 1000,
              connectionInfo: 'h2',
              finishDocumentLoadTime: (navEntry.domContentLoadedEventEnd || Date.now()) / 1000,
              finishLoadTime: (navEntry.loadEventEnd || Date.now()) / 1000,
              firstPaintAfterLoadTime: 0,
              firstPaintTime: (navEntry.domContentLoadedEventEnd || Date.now()) / 1000,
              navigationType: 'Other',
              npnNegotiatedProtocol: 'h2',
              requestTime: (navEntry.requestStart || Date.now()) / 1000,
              startLoadTime: (navEntry.fetchStart || Date.now()) / 1000,
              wasAlternateProtocolAvailable: false,
              wasFetchedViaSpdy: true,
              wasNpnNegotiated: true,
            };
          };
        }

        // ── Notification.permission ──
        try {
          if (typeof Notification !== 'undefined') {
            Object.defineProperty(Notification, 'permission', {
              get: () => 'default',
              configurable: true,
            });
          }
        } catch {}

        // ── Permissions API — make 'notifications' query return 'prompt' not 'denied' ──
        try {
          if (navigator.permissions && navigator.permissions.query) {
            const origQuery = navigator.permissions.query.bind(navigator.permissions);
            Object.defineProperty(navigator.permissions, 'query', {
              value: function (desc) {
                if (desc && desc.name === 'notifications') {
                  return Promise.resolve({
                    state: 'prompt',
                    onchange: null,
                    addEventListener: function () {},
                    removeEventListener: function () {},
                  });
                }
                return origQuery(desc).catch(function () {
                  return {
                    state: 'prompt',
                    onchange: null,
                    addEventListener: function () {},
                    removeEventListener: function () {},
                  };
                });
              },
              configurable: true,
              writable: true,
            });
          }
        } catch {}

        // ── Prevent Error.stack from leaking Playwright paths ──
        try {
          const origPrepare = Error.prepareStackTrace;
          Error.prepareStackTrace = function (err, stack) {
            if (origPrepare) {
              try { return origPrepare(err, stack); } catch {}
            }
            return err.toString();
          };
        } catch {}

        // ── SourceBuffer / MediaSource detection (some bots lack these) ──
        try {
          if (typeof MediaSource === 'undefined') {
            window.MediaSource = window.WebKitMediaSource || function () {};
          }
        } catch {}

        // ── Prevent CDP detection via Runtime.evaluate artifacts ──
        // Google/Cloudflare check for stale references left by CDP Runtime.enable
        try {
          // Patch Function.prototype.toString to hide native code overrides
          const origFnToString = Function.prototype.toString;
          const overrides = new Set();
          Function.prototype.toString = function () {
            if (overrides.has(this)) return `function ${this.name || ''}() { [native code] }`;
            return origFnToString.call(this);
          };
          overrides.add(Function.prototype.toString);

          // Mark our overridden functions as "native" to pass toString() checks
          // This must be called on any function we define that sites may inspect
          window.__markNative = function (fn) { overrides.add(fn); return fn; };
        } catch {}

        // ── Patch console.debug to prevent CDP detection ──
        // Some sites do console.debug('something') and check if the DevTools protocol intercepted it
        try {
          const origDebug = console.debug;
          console.debug = function () { return origDebug.apply(console, arguments); };
        } catch {}

        // ── Ensure window.clientInformation === navigator ──
        // Some detection scripts check this alias exists (it does in real Chrome)
        try {
          if (!window.clientInformation) {
            Object.defineProperty(window, 'clientInformation', {
              get: () => navigator,
              configurable: true,
              enumerable: true,
            });
          }
        } catch {}

        // ── Ensure document.hasFocus() returns true ──
        // Automated browsers sometimes return false because window isn't focused
        try {
          Object.defineProperty(document, 'hasFocus', {
            value: function () { return true; },
            configurable: true,
            writable: true,
          });
        } catch {}

        // ── Ensure PerformanceObserver exists (Google uses it) ──
        try {
          if (typeof PerformanceObserver === 'undefined') {
            window.PerformanceObserver = function (cb) {
              this.observe = function () {};
              this.disconnect = function () {};
              this.takeRecords = function () { return []; };
            };
          }
        } catch {}

      } catch {}
    });
  } catch {}

  // ═══════════════════════════════════════════════════════════════════════
  // 1. HARDWARE: CPU cores & device memory
  // ═══════════════════════════════════════════════════════════════════════
  if (applyHardware) {
    try {
      await context.addInitScript(({ cores, mem }) => {
        try { Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => cores, configurable: true }); } catch {}
        try { Object.defineProperty(navigator, 'deviceMemory', { get: () => mem, configurable: true }); } catch {}
      }, { cores: cpuCores, mem: deviceMemory });
    } catch {}
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 2. NAVIGATOR: platform, DNT, touchPoints, languages, plugins
  // ═══════════════════════════════════════════════════════════════════════
  if (applyNavigator) {
    try {
      await context.addInitScript(({ adv, primaryLang, ua, flags }) => {
      try {
          if (flags.applyNavigator && adv && typeof adv === 'object') {
            if (adv.platform) { try { Object.defineProperty(navigator, 'platform', { get: () => adv.platform }); } catch {} }
            if (typeof adv.dnt === 'boolean') { try { Object.defineProperty(navigator, 'doNotTrack', { get: () => (adv.dnt ? '1' : '0') }); } catch {} }
            if (typeof adv.maxTouchPoints === 'number') { try { Object.defineProperty(navigator, 'maxTouchPoints', { get: () => adv.maxTouchPoints }); } catch {} }
            if (flags.applyLang) {
              try {
                const langs = Array.isArray(adv.languages) ? adv.languages : (typeof adv.languages === 'string' ? adv.languages.split(',').map(s=>s.trim()).filter(Boolean) : []);
                const finalLangs = langs.length ? langs : (primaryLang ? [primaryLang, primaryLang.split('-')[0]].filter((v,i,a)=>a.indexOf(v)===i) : navigator.languages);
                if (finalLangs && finalLangs.length) {
                  // Override navigator.language (single) and navigator.languages (array) — must match
                  try { Object.defineProperty(navigator, 'language', { get: () => finalLangs[0] }); } catch {}
                  try { Object.defineProperty(navigator, 'languages', { get: () => finalLangs }); } catch {}
                }
              } catch {}
            }
            if (typeof adv.plugins === 'number') {
              try {
                const length = adv.plugins;
                const fakeArray = { length, item: () => undefined, namedItem: () => undefined };
                Object.defineProperty(navigator, 'plugins', { get: () => fakeArray });
                Object.defineProperty(navigator, 'mimeTypes', { get: () => ({ length: 0, item: () => undefined, namedItem: () => undefined }) });
              } catch {}
            }
          }

          // Do Not Track — prefer network.doNotTrack, fall back to adv.dnt
          const dntVal = (network && network.doNotTrack) || (typeof adv.dnt === 'boolean' ? (adv.dnt ? 'true' : 'false') : null);
          if (dntVal === 'true') {
            try { Object.defineProperty(navigator, 'doNotTrack', { get: () => '1', configurable: true }); } catch {}
          } else if (dntVal === 'false') {
            try { Object.defineProperty(navigator, 'doNotTrack', { get: () => null, configurable: true }); } catch {}
          }

          // Max Touch Points — prefer network.maxTouchPoints, fall back to adv.maxTouchPoints
          const touchPoints = (network && typeof network.maxTouchPoints === 'number') ? network.maxTouchPoints : adv.maxTouchPoints;
          if (typeof touchPoints === 'number') {
            try { Object.defineProperty(navigator, 'maxTouchPoints', { get: () => touchPoints, configurable: true }); } catch {}
          }

          // Languages — prefer identity.languages, fall back to adv.languages
          const langStr = (identity && identity.languages) || adv.languages;
          if (flags.applyLang && langStr) {
            try {
              const langs = Array.isArray(langStr) ? langStr : (typeof langStr === 'string' ? langStr.split(',').map(s => s.trim()).filter(Boolean) : []);
              const finalLangs = langs.length ? langs : (primaryLang ? [primaryLang] : []);
              if (finalLangs && finalLangs.length) {
                const frozen = Object.freeze([...finalLangs]);
                Object.defineProperty(navigator, 'languages', { get: () => frozen, configurable: true });
                Object.defineProperty(navigator, 'language', { get: () => frozen[0], configurable: true });
              }
            } catch {}
          }

          // ── Realistic Plugins (matching real Chrome 120+) ──
          if (typeof adv.plugins === 'number' && adv.plugins >= 0) {
            try {
              const pluginDefs = [
                { name: 'PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
                { name: 'Chrome PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
                { name: 'Chromium PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
                { name: 'Microsoft Edge PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
                { name: 'WebKit built-in PDF', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
              ];
              const count = Math.min(adv.plugins, pluginDefs.length);
              const selectedPlugins = pluginDefs.slice(0, count);
              const mimeType = 'application/pdf';
              const mimeDesc = 'Portable Document Format';
              const mimeExt = 'pdf';

              const mimeTypes = [];
              const plugins = [];

              for (const def of selectedPlugins) {
                // Build MimeType
                const mt = Object.create(MimeType.prototype);
                Object.defineProperties(mt, {
                  type: { get: () => mimeType, enumerable: true },
                  suffixes: { get: () => mimeExt, enumerable: true },
                  description: { get: () => mimeDesc, enumerable: true },
                });

                // Build Plugin
                const plugin = Object.create(Plugin.prototype);
                Object.defineProperties(plugin, {
                  name: { get: () => def.name, enumerable: true },
                  filename: { get: () => def.filename, enumerable: true },
                  description: { get: () => def.description, enumerable: true },
                  length: { get: () => 1, enumerable: true },
                  0: { get: () => mt, enumerable: true },
                });

                // Cross-link
                Object.defineProperty(mt, 'enabledPlugin', { get: () => plugin, enumerable: true });
                plugin[Symbol.iterator] = function* () { yield mt; };

                mimeTypes.push(mt);
                plugins.push(plugin);
              }

              // PluginArray
              const fakePluginArray = Object.create(PluginArray.prototype);
              Object.defineProperty(fakePluginArray, 'length', { get: () => plugins.length, enumerable: true });
              plugins.forEach((p, i) => {
                Object.defineProperty(fakePluginArray, i, { get: () => p, enumerable: true });
              });
              fakePluginArray.item = (idx) => plugins[idx] || null;
              fakePluginArray.namedItem = (name) => plugins.find(p => p.name === name) || null;
              fakePluginArray.refresh = () => {};
              fakePluginArray[Symbol.iterator] = function* () { for (const p of plugins) yield p; };

              // MimeTypeArray
              const fakeMimeArray = Object.create(MimeTypeArray.prototype);
              Object.defineProperty(fakeMimeArray, 'length', { get: () => mimeTypes.length, enumerable: true });
              mimeTypes.forEach((m, i) => {
                Object.defineProperty(fakeMimeArray, i, { get: () => m, enumerable: true });
              });
              fakeMimeArray.item = (idx) => mimeTypes[idx] || null;
              fakeMimeArray.namedItem = (type) => mimeTypes.find(m => m.type === type) || null;
              fakeMimeArray[Symbol.iterator] = function* () { for (const m of mimeTypes) yield m; };

              Object.defineProperty(navigator, 'plugins', { get: () => fakePluginArray, configurable: true });
              Object.defineProperty(navigator, 'mimeTypes', { get: () => fakeMimeArray, configurable: true });
              Object.defineProperty(navigator, 'pdfViewerEnabled', { get: () => count > 0, configurable: true });
            } catch {}
          }
        } catch {}
      }, { adv, primaryLang: locale, flags: { applyLang: !!applyLang }, identity, network });
    } catch {}
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 3. USER-AGENT + appVersion consistency
  // ═══════════════════════════════════════════════════════════════════════
  if (applyUA && userAgent) {
    try {
      await context.addInitScript(({ ua }) => {
        try {
          Object.defineProperty(navigator, 'userAgent', { get: () => ua, configurable: true });
          // appVersion must match (everything after "Mozilla/")
          const appVer = ua.indexOf('Mozilla/') === 0 ? ua.substring(8) : ua;
          Object.defineProperty(navigator, 'appVersion', { get: () => appVer, configurable: true });
        } catch {}
      }, { ua: userAgent });
    } catch {}
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 4. VIEWPORT & SCREEN properties
  // ═══════════════════════════════════════════════════════════════════════
  if (applyViewport) {
    try {
      const resolution = display.width && display.height ? { width: display.width, height: display.height } : parseResolution(fp.screenResolution);
      const colorDepthVal = display.colorDepth || 24;
      await context.addInitScript(({ dpr, res, colorDepth }) => {
        try {
          if (typeof dpr === 'number' && dpr > 0) {
            Object.defineProperty(window, 'devicePixelRatio', { get: () => dpr, configurable: true });
          }
          if (res) {
            const w = res.width, h = res.height;
            const taskbar = 40;
            try { Object.defineProperty(screen, 'width', { get: () => w, configurable: true }); } catch {}
            try { Object.defineProperty(screen, 'height', { get: () => h, configurable: true }); } catch {}
            try { Object.defineProperty(screen, 'availWidth', { get: () => w, configurable: true }); } catch {}
            try { Object.defineProperty(screen, 'availHeight', { get: () => h - taskbar, configurable: true }); } catch {}
            try { Object.defineProperty(screen, 'colorDepth', { get: () => colorDepth, configurable: true }); } catch {}
            try { Object.defineProperty(screen, 'pixelDepth', { get: () => colorDepth, configurable: true }); } catch {}
            try { Object.defineProperty(window, 'outerWidth', { get: () => w, configurable: true }); } catch {}
            try { Object.defineProperty(window, 'outerHeight', { get: () => h, configurable: true }); } catch {}
            // screenX / screenY — top-left of browser window on the monitor
            try { Object.defineProperty(window, 'screenX', { get: () => 0, configurable: true }); } catch {}
            try { Object.defineProperty(window, 'screenY', { get: () => 0, configurable: true }); } catch {}
            try { Object.defineProperty(window, 'screenLeft', { get: () => 0, configurable: true }); } catch {}
            try { Object.defineProperty(window, 'screenTop', { get: () => 0, configurable: true }); } catch {}
          }
        } catch {}
      }, { dpr: Number(display.pixelRatio || adv.devicePixelRatio || 1), res: resolution, colorDepth: colorDepthVal });
    } catch {}
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 5. WEBGL vendor & renderer spoofing
  // ═══════════════════════════════════════════════════════════════════════
  if (applyWebgl && (hardware.gpuVendor || hardware.gpuRenderer || adv.webglVendor || adv.webglRenderer)) {
    try {
      await context.addInitScript(({ vendor, renderer }) => {
        try {
          const patch = (proto) => {
            if (!proto || !proto.getParameter) return;
            const origGetParam = proto.getParameter;

            Object.defineProperty(proto, 'getParameter', {
              value: function (param) {
                if (param === 0x9245 && vendor) return vendor;   // UNMASKED_VENDOR_WEBGL
                if (param === 0x9246 && renderer) return renderer; // UNMASKED_RENDERER_WEBGL
                if (param === 0x1F01 && renderer) return renderer; // RENDERER
                if (param === 0x1F00 && vendor) return vendor;     // VENDOR
                return origGetParam.apply(this, arguments);
              },
              configurable: true,
            });
          };

          if (window.WebGLRenderingContext) patch(WebGLRenderingContext.prototype);
          if (window.WebGL2RenderingContext) patch(WebGL2RenderingContext.prototype);
        } catch {}
      }, { vendor: hardware.gpuVendor || adv.webglVendor, renderer: hardware.gpuRenderer || adv.webglRenderer });
    } catch {}
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 6. CANVAS fingerprint noise
  //    Uses a flag to prevent recursion (toDataURL → getImageData → noise)
  // ═══════════════════════════════════════════════════════════════════════
  if (applyCanvas) {
    try {
      await context.addInitScript(({ seed }) => {
        try {
          // Seeded PRNG — deterministic per profile
          function mulberry32(a) {
            return function () {
              a |= 0; a = a + 0x6D2B79F5 | 0;
              let t = Math.imul(a ^ a >>> 15, 1 | a);
              t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
              return ((t ^ t >>> 14) >>> 0) / 4294967296;
            };
          }
          const rng = mulberry32(seed);

          // ── Noise function (subtle ±1 on sparse pixels) ──
          function perturbImageData(imageData) {
            const data = imageData.data;
            const len = data.length;
            const step = Math.max(4, Math.floor(len / 400) * 4);
            for (let i = 0; i < len; i += step) {
              for (let c = 0; c < 3; c++) {
                const noise = rng() < 0.5 ? -1 : 1;
                const val = data[i + c] + noise;
                data[i + c] = val < 0 ? 0 : val > 255 ? 255 : val;
              }
            }
            return imageData;
          }

          // Use a flag to prevent recursion when toDataURL calls getImageData internally
          let _isPerturbing = false;

          // Patch getImageData (the core extraction API)
          const origGetImageData = CanvasRenderingContext2D.prototype.getImageData;
          Object.defineProperty(CanvasRenderingContext2D.prototype, 'getImageData', {
            value: function () {
              const imageData = origGetImageData.apply(this, arguments);
              if (!_isPerturbing) {
                _isPerturbing = true;
                try { perturbImageData(imageData); } finally { _isPerturbing = false; }
              }
              return imageData;
            },
            configurable: true,
          });

          // Patch toDataURL — perturb pixels, then call original
          const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
          Object.defineProperty(HTMLCanvasElement.prototype, 'toDataURL', {
            value: function () {
              if (!_isPerturbing) {
                _isPerturbing = true;
                try {
                  const ctx = this.getContext('2d');
                  if (ctx) {
                    const imgData = origGetImageData.call(ctx, 0, 0, this.width, this.height);
                    perturbImageData(imgData);
                    ctx.putImageData(imgData, 0, 0);
                  }
                } catch {} finally { _isPerturbing = false; }
              }
              return origToDataURL.apply(this, arguments);
            },
            configurable: true,
          });

          // Patch toBlob
          const origToBlob = HTMLCanvasElement.prototype.toBlob;
          Object.defineProperty(HTMLCanvasElement.prototype, 'toBlob', {
            value: function () {
              if (!_isPerturbing) {
                _isPerturbing = true;
                try {
                  const ctx = this.getContext('2d');
                  if (ctx) {
                    const imgData = origGetImageData.call(ctx, 0, 0, this.width, this.height);
                    perturbImageData(imgData);
                    ctx.putImageData(imgData, 0, 0);
                  }
                } catch {} finally { _isPerturbing = false; }
              }
              return origToBlob.apply(this, arguments);
            },
            configurable: true,
          });

          // Patch OffscreenCanvas.convertToBlob
          if (typeof OffscreenCanvas !== 'undefined' && OffscreenCanvas.prototype.convertToBlob) {
            const origConvert = OffscreenCanvas.prototype.convertToBlob;
            Object.defineProperty(OffscreenCanvas.prototype, 'convertToBlob', {
              value: function () {
                if (!_isPerturbing) {
                  _isPerturbing = true;
                  try {
                    const ctx = this.getContext('2d');
                    if (ctx && ctx.getImageData) {
                      const imgData = ctx.getImageData(0, 0, this.width, this.height);
                      perturbImageData(imgData);
                      ctx.putImageData(imgData, 0, 0);
                    }
                  } catch {} finally { _isPerturbing = false; }
                }
                return origConvert.apply(this, arguments);
              },
              configurable: true,
            });
          }
        } catch {}
      }, { seed: profileSeed });
    } catch {}
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 7. AUDIOCONTEXT fingerprint noise
  // ═══════════════════════════════════════════════════════════════════════
  if (applyAudio) {
    try {
      await context.addInitScript(({ seed }) => {
        try {
          function mulberry32(a) {
            return function () {
              a |= 0; a = a + 0x6D2B79F5 | 0;
              let t = Math.imul(a ^ a >>> 15, 1 | a);
              t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
              return ((t ^ t >>> 14) >>> 0) / 4294967296;
            };
          }
          const rng = mulberry32(seed + 7919);

          // Patch AnalyserNode
          if (typeof AnalyserNode !== 'undefined') {
            const proto = AnalyserNode.prototype;

            const origFFD = proto.getFloatFrequencyData;
            if (origFFD) {
              Object.defineProperty(proto, 'getFloatFrequencyData', {
                value: function (array) {
                  origFFD.call(this, array);
                  for (let i = 0; i < array.length; i += 3) {
                    array[i] += (rng() - 0.5) * 0.1;
                  }
                },
                configurable: true,
              });
            }

            const origBFD = proto.getByteFrequencyData;
            if (origBFD) {
              Object.defineProperty(proto, 'getByteFrequencyData', {
                value: function (array) {
                  origBFD.call(this, array);
                  for (let i = 0; i < array.length; i += 3) {
                    array[i] = Math.max(0, Math.min(255, array[i] + (rng() < 0.5 ? -1 : 1)));
                  }
                },
                configurable: true,
              });
            }

            const origFTD = proto.getFloatTimeDomainData;
            if (origFTD) {
              Object.defineProperty(proto, 'getFloatTimeDomainData', {
                value: function (array) {
                  origFTD.call(this, array);
                  for (let i = 0; i < array.length; i += 3) {
                    array[i] += (rng() - 0.5) * 0.0001;
                  }
                },
                configurable: true,
              });
            }
          }

          // Patch AudioBuffer.getChannelData (fingerprinting buffers are tiny)
          if (typeof AudioBuffer !== 'undefined') {
            const origGCD = AudioBuffer.prototype.getChannelData;
            if (origGCD) {
              Object.defineProperty(AudioBuffer.prototype, 'getChannelData', {
                value: function () {
                  const data = origGCD.apply(this, arguments);
                  if (data.length < 50000) {
                    for (let i = 0; i < data.length; i += 2) {
                      data[i] += (rng() - 0.5) * 0.0000001;
                    }
                  }
                  return data;
                },
                configurable: true,
              });
            }
          }
        } catch {}
      }, { seed: profileSeed });
    } catch {}
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 8. CLIENTRECTS noise (element dimension fingerprinting)
  // ═══════════════════════════════════════════════════════════════════════
  if (applyNavigator) {
    try {
      await context.addInitScript(({ seed }) => {
        try {
          function mulberry32(a) {
            return function () {
              a |= 0; a = a + 0x6D2B79F5 | 0;
              let t = Math.imul(a ^ a >>> 15, 1 | a);
              t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
              return ((t ^ t >>> 14) >>> 0) / 4294967296;
            };
          }
          const rng = mulberry32(seed + 1337);

          function patchDOMRect(rect) {
            if (!rect || typeof rect.x !== 'number') return rect;
            // Very small noise that won't break layouts
            const nx = rect.x + (rng() - 0.5) * 0.00001;
            const ny = rect.y + (rng() - 0.5) * 0.00001;
            const nw = rect.width + (rng() - 0.5) * 0.00001;
            const nh = rect.height + (rng() - 0.5) * 0.00001;
            return new DOMRect(nx, ny, nw, nh);
          }

          const origGBCR = Element.prototype.getBoundingClientRect;
          Object.defineProperty(Element.prototype, 'getBoundingClientRect', {
            value: function () { return patchDOMRect(origGBCR.call(this)); },
            configurable: true,
          });

          const origGCR = Element.prototype.getClientRects;
          Object.defineProperty(Element.prototype, 'getClientRects', {
            value: function () {
              const rects = origGCR.call(this);
              const result = [];
              for (let i = 0; i < rects.length; i++) result.push(patchDOMRect(rects[i]));
              result.item = (idx) => result[idx] || null;
              Object.defineProperty(result, 'length', { value: result.length });
              return result;
            },
            configurable: true,
          });

          // Range.getClientRects / getBoundingClientRect
          if (typeof Range !== 'undefined') {
            const origRGBCR = Range.prototype.getBoundingClientRect;
            Object.defineProperty(Range.prototype, 'getBoundingClientRect', {
              value: function () { return patchDOMRect(origRGBCR.call(this)); },
              configurable: true,
            });
            const origRGCR = Range.prototype.getClientRects;
            Object.defineProperty(Range.prototype, 'getClientRects', {
              value: function () {
                const rects = origRGCR.call(this);
                const result = [];
                for (let i = 0; i < rects.length; i++) result.push(patchDOMRect(rects[i]));
                result.item = (idx) => result[idx] || null;
                Object.defineProperty(result, 'length', { value: result.length });
                return result;
              },
              configurable: true,
            });
          }
        } catch {}
      }, { seed: profileSeed });
    } catch {}
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 9. WEBRTC IP leak protection (JS-level)
  // ═══════════════════════════════════════════════════════════════════════
  const webrtcMode = network.webrtcPolicy || settings?.webrtc || 'default';
  if (webrtcMode === 'disable_udp' || webrtcMode === 'proxy_only') {
    try {
      await context.addInitScript(({ mode }) => {
        try {
          if (mode === 'disable_udp') {
            // Completely remove WebRTC APIs
            const noop = function () { throw new DOMException('WebRTC is disabled', 'NotSupportedError'); };
            Object.defineProperty(window, 'RTCPeerConnection', { value: noop, configurable: true, writable: true });
            Object.defineProperty(window, 'webkitRTCPeerConnection', { value: noop, configurable: true, writable: true });
            Object.defineProperty(window, 'mozRTCPeerConnection', { value: noop, configurable: true, writable: true });
          } else if (mode === 'proxy_only') {
            const OrigRTC = window.RTCPeerConnection || window.webkitRTCPeerConnection;
            if (OrigRTC) {
              const WrappedRTC = function (config, constraints) {
                config = Object.assign({}, config || {});
                config.iceTransportPolicy = 'relay';
                if (config.iceServers) {
                  config.iceServers = config.iceServers.filter(function (s) {
                    const urls = Array.isArray(s.urls) ? s.urls : [s.urls || s.url || ''];
                    return urls.some(function (u) { return typeof u === 'string' && u.startsWith('turn'); });
                  });
                }
                return new OrigRTC(config, constraints);
              };
              WrappedRTC.prototype = OrigRTC.prototype;
              if (OrigRTC.generateCertificate) WrappedRTC.generateCertificate = OrigRTC.generateCertificate;
              Object.defineProperty(window, 'RTCPeerConnection', { value: WrappedRTC, configurable: true, writable: true });
              Object.defineProperty(window, 'webkitRTCPeerConnection', { value: WrappedRTC, configurable: true, writable: true });
            }
          }
        } catch {}
      }, { mode: webrtcMode });
    } catch {}
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 10. BATTERY API spoofing
  // ═══════════════════════════════════════════════════════════════════════
  if (battery.enabled !== false) {
  try {
    await context.addInitScript(({ seed, batteryData }) => {
      try {
        // Use profile-specified battery data if available, else seed-based random
        let bat;
        if (batteryData && typeof batteryData === 'object' && batteryData.charging !== undefined) {
          bat = {
            charging: batteryData.charging === 'charging',
            chargingTime: batteryData.charging === 'charging' ? (Number(batteryData.chargingTime) || 0) : Infinity,
            dischargingTime: batteryData.charging !== 'charging' ? (Number(batteryData.dischargingTime) || Infinity) : Infinity,
            level: Math.max(0, Math.min(1, Number(batteryData.level) || 1)),
            addEventListener: function () {},
            removeEventListener: function () {},
            dispatchEvent: function () { return false; },
          };
        } else {
          function mulberry32(a) {
            return function () {
              a |= 0; a = a + 0x6D2B79F5 | 0;
              let t = Math.imul(a ^ a >>> 15, 1 | a);
              t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
              return ((t ^ t >>> 14) >>> 0) / 4294967296;
            };
          }
          const rng = mulberry32(seed + 4201);
          const level = 0.5 + rng() * 0.5;
          bat = {
            charging: rng() > 0.3,
            chargingTime: rng() > 0.5 ? Infinity : Math.floor(rng() * 7200),
            dischargingTime: Infinity,
            level: Math.round(level * 100) / 100,
            addEventListener: function () {},
            removeEventListener: function () {},
            dispatchEvent: function () { return false; },
          };
        }
        if (navigator.getBattery) {
          Object.defineProperty(navigator, 'getBattery', {
            value: function () { return Promise.resolve(bat); },
            configurable: true,
          });
        }
      } catch {}
    }, { seed: profileSeed, batteryData: battery });
  } catch {}
  } // end if (battery.enabled !== false)

  // ═══════════════════════════════════════════════════════════════════════
  // 11. NETWORK INFORMATION API
  // ═══════════════════════════════════════════════════════════════════════
  try {
    await context.addInitScript(({ seed }) => {
      try {
        function mulberry32(a) {
          return function () {
            a |= 0; a = a + 0x6D2B79F5 | 0;
            let t = Math.imul(a ^ a >>> 15, 1 | a);
            t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
          };
        }
        const rng = mulberry32(seed + 5303);
        const types = ['4g', '4g', '4g', '4g', 'wifi'];
        const effectiveType = types[Math.floor(rng() * types.length)];
        const downlinks = { '4g': 10, 'wifi': 30 };
        const rtts = { '4g': 50, 'wifi': 20 };

        const fakeConn = {
          effectiveType: effectiveType,
          downlink: downlinks[effectiveType] || 10,
          rtt: rtts[effectiveType] || 50,
          saveData: false,
          addEventListener: function () {},
          removeEventListener: function () {},
          dispatchEvent: function () { return false; },
        };
        Object.defineProperty(navigator, 'connection', { get: () => fakeConn, configurable: true });
      } catch {}
    }, { seed: profileSeed });
  } catch {}

  // ═══════════════════════════════════════════════════════════════════════
  // 12. SPEECH SYNTHESIS fingerprint protection
  // ═══════════════════════════════════════════════════════════════════════
  try {
    await context.addInitScript(({ seed }) => {
      try {
        if (typeof speechSynthesis !== 'undefined' && speechSynthesis.getVoices) {
          const origGetVoices = speechSynthesis.getVoices.bind(speechSynthesis);
          function mulberry32(a) {
            return function () {
              a |= 0; a = a + 0x6D2B79F5 | 0;
              let t = Math.imul(a ^ a >>> 15, 1 | a);
              t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
              return ((t ^ t >>> 14) >>> 0) / 4294967296;
            };
          }
          const rng = mulberry32(seed + 8191);
          let cached = null;
          Object.defineProperty(speechSynthesis, 'getVoices', {
            value: function () {
              if (cached) return cached;
              const voices = origGetVoices();
              if (!voices || voices.length === 0) return voices;
              const arr = [].concat(voices);
              // Deterministic Fisher-Yates shuffle
              for (let i = arr.length - 1; i > 0; i--) {
                const j = Math.floor(rng() * (i + 1));
                const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
              }
              cached = arr.slice(0, Math.min(arr.length, 20 + Math.floor(rng() * 10)));
              return cached;
            },
            configurable: true,
          });
        }
      } catch {}
    }, { seed: profileSeed });
  } catch {}

  // ═══════════════════════════════════════════════════════════════════════
  // 13. KEYBOARD LAYOUT fingerprint protection
  // ═══════════════════════════════════════════════════════════════════════
  try {
    await context.addInitScript(() => {
      try {
        if (navigator.keyboard && navigator.keyboard.getLayoutMap) {
          Object.defineProperty(navigator.keyboard, 'getLayoutMap', {
            value: function () { return Promise.reject(new DOMException('Not allowed', 'SecurityError')); },
            configurable: true,
          });
        }
      } catch {}
    });
  } catch {}

  // ═══════════════════════════════════════════════════════════════════════
  // 14. IFRAME contentWindow protection
  //     Ensures iframes inherit the same spoofed properties.
  // ═══════════════════════════════════════════════════════════════════════
  try {
    await context.addInitScript(() => {
      try {
        // Monitor iframe creation and patch contentWindow
        const origAppend = Element.prototype.appendChild;
        Object.defineProperty(Element.prototype, 'appendChild', {
          value: function (child) {
            const result = origAppend.call(this, child);
            if (child && child.tagName === 'IFRAME' && child.contentWindow) {
              try {
                const iframeNav = child.contentWindow.navigator;
                if (iframeNav) {
                  // Copy webdriver override
                  try {
                    Object.defineProperty(iframeNav, 'webdriver', {
                      get: () => false,
                      configurable: true,
                      enumerable: true,
                    });
                  } catch {}
                  // Copy chrome object
                  try {
                    if (!child.contentWindow.chrome) {
                      child.contentWindow.chrome = window.chrome;
                    }
                  } catch {}
                }
              } catch {} // cross-origin iframes will throw, that's fine
            }
            return result;
          },
          configurable: true,
          writable: true,
        });
      } catch {}
    });
  } catch {}

  // ═══════════════════════════════════════════════════════════════════════
  // 15. PERFORMANCE & TIMING consistency
  // ═══════════════════════════════════════════════════════════════════════
  try {
    await context.addInitScript(() => {
      try {
        // Make performance.now() slightly less precise to match real browser behavior
        // (Chrome rounds to 100μs for cross-origin isolation)
        const origNow = performance.now.bind(performance);
        Object.defineProperty(performance, 'now', {
          value: function () {
            const val = origNow();
            // Round to 100μs (0.1ms) precision — matches Chrome's default
            return Math.round(val * 10) / 10;
          },
          configurable: true,
          writable: true,
        });
      } catch {}
    });
  } catch {}

  // ═══════════════════════════════════════════════════════════════════════
  // 16. FONT FINGERPRINT SPOOFING
  //     Font enumeration is a major fingerprinting vector. Sites use
  //     CSS fallback detection (measuring text width with/without a font)
  //     to build a list of installed fonts.
  //     We intercept measureText and element sizing to inject per-profile
  //     noise, making each profile appear to have a slightly different
  //     set of fonts — even on the same machine.
  // ═══════════════════════════════════════════════════════════════════════
  try {
    // Get OS-appropriate font list from the generator (if available)
    const os = fp.os || 'Windows';
    let fontList;
    try {
      const { FONTS_BY_OS } = require('./fingerprintGenerator');
      fontList = FONTS_BY_OS[os] || FONTS_BY_OS.Windows;
    } catch {
      // Fallback font list if generator not available
      fontList = [
        'Arial', 'Arial Black', 'Calibri', 'Cambria', 'Comic Sans MS',
        'Consolas', 'Courier New', 'Georgia', 'Impact', 'Lucida Console',
        'Palatino Linotype', 'Segoe UI', 'Tahoma', 'Times New Roman',
        'Trebuchet MS', 'Verdana',
      ];
    }

    await context.addInitScript(({ seed, fonts }) => {
      try {
        // Seeded PRNG for consistent per-profile font behavior
        function mulberry32(a) {
          return function () {
            a |= 0; a = a + 0x6D2B79F5 | 0;
            let t = Math.imul(a ^ a >>> 15, 1 | a);
            t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
          };
        }
        const rng = mulberry32(seed + 6173);

        // Build a deterministic set of "available" fonts for this profile.
        // Remove 2-4 random fonts from the full list to create uniqueness.
        const removedCount = 2 + Math.floor(rng() * 3);
        const fontSet = new Set(fonts);
        const fontArray = [...fontSet];
        for (let i = 0; i < removedCount && fontArray.length > 5; i++) {
          const idx = Math.floor(rng() * fontArray.length);
          fontSet.delete(fontArray.splice(idx, 1)[0]);
        }

        // Patch CanvasRenderingContext2D.measureText to introduce tiny
        // per-profile noise in text width measurements.
        // This defeats CSS-based font detection without visually breaking layouts.
        const origMeasure = CanvasRenderingContext2D.prototype.measureText;
        Object.defineProperty(CanvasRenderingContext2D.prototype, 'measureText', {
          value: function (text) {
            const result = origMeasure.call(this, text);
            // Only apply noise when testing with specific fallback fonts
            // (the typical fingerprinting pattern)
            const font = this.font || '';
            const isProbing = font.includes('monospace') || font.includes('sans-serif') || font.includes('serif');
            if (isProbing && text && text.length < 100) {
              const noise = (rng() - 0.5) * 0.3; // ±0.15px — invisible but unique
              const origWidth = result.width;
              try {
                Object.defineProperty(result, 'width', {
                  get: () => origWidth + noise,
                  configurable: true,
                });
              } catch {}
            }
            return result;
          },
          configurable: true,
        });

        // Override document.fonts.check() to reflect our spoofed font set.
        // Some fingerprinters use this API directly.
        try {
          if (document.fonts && document.fonts.check) {
            const origCheck = document.fonts.check.bind(document.fonts);
            Object.defineProperty(document.fonts, 'check', {
              value: function (fontSpec, text) {
                // Extract font family name from CSS font shorthand
                try {
                  const parts = fontSpec.split(/\s+/);
                  const familyPart = parts[parts.length - 1].replace(/['"]/g, '');
                  // If it's in our "removed" list, report as not available
                  if (!fontSet.has(familyPart) && fonts.includes(familyPart)) {
                    return false;
                  }
                } catch {}
                return origCheck(fontSpec, text || '');
              },
              configurable: true,
            });
          }
        } catch {}
      } catch {}
    }, { seed: profileSeed, fonts: fontList });
  } catch {}
}

module.exports = { applyFingerprintInitScripts, parseResolution };
