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
  const fp = (profile && profile.fingerprint) || {};
  const adv = (settings && settings.advanced) || {};
  const locale = fp.language || settings?.language || 'en-US';
  const userAgent = overrideUserAgent || fp.userAgent || undefined;
  const cpuCores = Number(settings?.cpuCores || 4);
  const deviceMemory = Number(settings?.memoryGB || 8);
  const apply = (settings && settings.applyOverrides) || {};
  const applyHardware = apply.hardware !== false;
  const applyNavigator = apply.navigator !== false;
  const applyUA = apply.userAgent !== false;
  const applyWebgl = apply.webgl !== false;
  const applyLang = apply.language !== false;
  const applyViewport = apply.viewport !== false;
  const applyCanvas = fp.canvas !== false;
  const applyAudio = fp.audio !== false;

  // Generate a stable per-profile seed for consistent noise
  const profileSeed = hashCode(profile?.id || 'default');

  // ═══════════════════════════════════════════════════════════════════════
  // 0. ANTI-AUTOMATION DETECTION (must run FIRST, before anything else)
  //    Cloudflare, DataDome, PerimeterX all check these signals.
  // ═══════════════════════════════════════════════════════════════════════
  try {
    await context.addInitScript(() => {
      try {
        // ── navigator.webdriver ──
        // Real Chrome: property exists on prototype with value false, not configurable.
        // Automation sets it to true. We delete + redefine on prototype to match real browser.
        const proto = Object.getPrototypeOf(navigator);
        if (proto) {
          try {
            delete proto.webdriver;
            Object.defineProperty(proto, 'webdriver', {
              get: () => undefined,
              configurable: true,
              enumerable: true,
            });
          } catch {}
        }
        // Also override instance level
        try {
          Object.defineProperty(navigator, 'webdriver', {
            get: () => undefined,
            configurable: true,
          });
        } catch {}

        // ── Remove Playwright/CDP artifacts ──
        try { delete window.__playwright; } catch {}
        try { delete window.__pw_manual; } catch {}
        try { delete window.__PW_inspect; } catch {}
        try { delete window.cdc_adoQpoasnfa76pfcZLmcfl_Array; } catch {}
        try { delete window.cdc_adoQpoasnfa76pfcZLmcfl_Promise; } catch {}
        try { delete window.cdc_adoQpoasnfa76pfcZLmcfl_Symbol; } catch {}
        // Remove any window property starting with 'cdc_'
        try {
          for (const key of Object.keys(window)) {
            if (key.startsWith('cdc_') || key.startsWith('__cdc_')) {
              try { delete window[key]; } catch {}
            }
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

        // chrome.runtime — must have connect/sendMessage but also id
        if (!window.chrome.runtime) {
          window.chrome.runtime = {};
        }
        const rt = window.chrome.runtime;
        if (!rt.connect) rt.connect = function () { return { onMessage: { addListener: function () {} }, postMessage: function () {}, disconnect: function () {} }; };
        if (!rt.sendMessage) rt.sendMessage = function () {};
        // OnInstalledReason, OnRestartRequiredReason, PlatformArch, PlatformNaclArch, PlatformOs, RequestUpdateCheckStatus
        if (!rt.OnInstalledReason) rt.OnInstalledReason = { CHROME_UPDATE: 'chrome_update', INSTALL: 'install', SHARED_MODULE_UPDATE: 'shared_module_update', UPDATE: 'update' };
        if (!rt.OnRestartRequiredReason) rt.OnRestartRequiredReason = { APP_UPDATE: 'app_update', OS_UPDATE: 'os_update', PERIODIC: 'periodic' };
        if (!rt.PlatformArch) rt.PlatformArch = { ARM: 'arm', ARM64: 'arm64', MIPS: 'mips', MIPS64: 'mips64', X86_32: 'x86-32', X86_64: 'x86-64' };
        if (!rt.PlatformOs) rt.PlatformOs = { ANDROID: 'android', CROS: 'cros', LINUX: 'linux', MAC: 'mac', OPENBSD: 'openbsd', WIN: 'win' };
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
        // Ensure they exist to look like a real browser
        try {
          if (typeof MediaSource === 'undefined') {
            window.MediaSource = window.WebKitMediaSource || function () {};
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
      await context.addInitScript(({ adv, primaryLang, flags }) => {
        try {
          if (!adv || typeof adv !== 'object') return;

          // Platform
          if (adv.platform) {
            try { Object.defineProperty(navigator, 'platform', { get: () => adv.platform, configurable: true }); } catch {}
          }

          // Do Not Track
          if (typeof adv.dnt === 'boolean') {
            try { Object.defineProperty(navigator, 'doNotTrack', { get: () => (adv.dnt ? '1' : null), configurable: true }); } catch {}
          }

          // Max Touch Points
          if (typeof adv.maxTouchPoints === 'number') {
            try { Object.defineProperty(navigator, 'maxTouchPoints', { get: () => adv.maxTouchPoints, configurable: true }); } catch {}
          }

          // Languages
          if (flags.applyLang) {
            try {
              const langs = Array.isArray(adv.languages) ? adv.languages : (typeof adv.languages === 'string' ? adv.languages.split(',').map(s => s.trim()).filter(Boolean) : []);
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
      }, { adv, primaryLang: locale, flags: { applyLang: !!applyLang } });
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
      const resolution = parseResolution(fp.screenResolution);
      await context.addInitScript(({ dpr, res }) => {
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
            try { Object.defineProperty(screen, 'colorDepth', { get: () => 24, configurable: true }); } catch {}
            try { Object.defineProperty(screen, 'pixelDepth', { get: () => 24, configurable: true }); } catch {}
            try { Object.defineProperty(window, 'outerWidth', { get: () => w, configurable: true }); } catch {}
            try { Object.defineProperty(window, 'outerHeight', { get: () => h, configurable: true }); } catch {}
            // screenX / screenY — top-left of browser window on the monitor
            try { Object.defineProperty(window, 'screenX', { get: () => 0, configurable: true }); } catch {}
            try { Object.defineProperty(window, 'screenY', { get: () => 0, configurable: true }); } catch {}
            try { Object.defineProperty(window, 'screenLeft', { get: () => 0, configurable: true }); } catch {}
            try { Object.defineProperty(window, 'screenTop', { get: () => 0, configurable: true }); } catch {}
          }
        } catch {}
      }, { dpr: Number(adv.devicePixelRatio || 1), res: resolution });
    } catch {}
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 5. WEBGL vendor & renderer spoofing
  // ═══════════════════════════════════════════════════════════════════════
  if (applyWebgl && (adv.webglVendor || adv.webglRenderer)) {
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
      }, { vendor: adv.webglVendor, renderer: adv.webglRenderer });
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
  const webrtcMode = settings?.webrtc || 'default';
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
        const rng = mulberry32(seed + 4201);
        const level = 0.5 + rng() * 0.5;
        const fakeBattery = {
          charging: rng() > 0.3,
          chargingTime: rng() > 0.5 ? Infinity : Math.floor(rng() * 7200),
          dischargingTime: Infinity,
          level: Math.round(level * 100) / 100,
          addEventListener: function () {},
          removeEventListener: function () {},
          dispatchEvent: function () { return false; },
        };
        if (navigator.getBattery) {
          Object.defineProperty(navigator, 'getBattery', {
            value: function () { return Promise.resolve(fakeBattery); },
            configurable: true,
          });
        }
      } catch {}
    }, { seed: profileSeed });
  } catch {}

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
                      get: () => undefined,
                      configurable: true,
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
}

module.exports = { applyFingerprintInitScripts, parseResolution };
