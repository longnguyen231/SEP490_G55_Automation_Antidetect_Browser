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

async function applyFingerprintInitScripts(context, profile, settings, { overrideUserAgent } = {}) {
  const fp = (profile && profile.fingerprint) || {};
  const adv = (settings && settings.advanced) || {};
  const locale = fp.language || settings?.language || 'en-US';
  const userAgent = overrideUserAgent || fp.userAgent || undefined;
  const cpuCores = Number(settings?.cpuCores || 4);
  const deviceMemory = Number(settings?.memoryGB || 8);
  const apply = (settings && settings.applyOverrides) || {};
  const applyHardware = apply.hardware !== false; // default true
  const applyNavigator = apply.navigator !== false; // default true
  const applyUA = apply.userAgent !== false; // default true
  const applyWebgl = apply.webgl !== false; // default true
  const applyLang = apply.language !== false; // for navigator.languages
  const applyViewport = apply.viewport !== false; // for devicePixelRatio

  // Hardware init script
  if (applyHardware) {
    try {
      await context.addInitScript(({ cores, mem }) => {
        try { Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => cores }); } catch {}
        try { Object.defineProperty(navigator, 'deviceMemory', { get: () => mem }); } catch {}
      }, { cores: cpuCores, mem: deviceMemory });
    } catch {}
  }

  // Navigator / WebGL / UA init script
  if (applyNavigator || applyWebgl || applyUA || applyLang || applyViewport) {
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
                const finalLangs = langs.length ? langs : (primaryLang ? [primaryLang] : navigator.languages);
                if (finalLangs && finalLangs.length) { Object.defineProperty(navigator, 'languages', { get: () => finalLangs }); }
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
          if (flags.applyViewport && adv && typeof adv.devicePixelRatio === 'number' && adv.devicePixelRatio > 0) {
            try { Object.defineProperty(window, 'devicePixelRatio', { get: () => adv.devicePixelRatio }); } catch {}
          }
          if (flags.applyWebgl && adv && (adv.webglVendor || adv.webglRenderer)) {
            try {
              const patch = (proto) => {
                if (!proto || !proto.getParameter) return;
                const OG = proto.getParameter;
                Object.defineProperty(proto, 'getParameter', {
                  value: function(param) {
                    if (param === 0x9245 && adv.webglVendor) return adv.webglVendor;
                    if (param === 0x9246 && adv.webglRenderer) return adv.webglRenderer;
                    return OG.apply(this, arguments);
                  }
                });
              };
              if (window.WebGLRenderingContext) patch(WebGLRenderingContext.prototype);
              if (window.WebGL2RenderingContext) patch(WebGL2RenderingContext.prototype);
            } catch {}
          }
          if (flags.applyUA && ua) { try { Object.defineProperty(navigator, 'userAgent', { get: () => ua }); } catch {} }
      } catch {}
      }, { adv, primaryLang: locale, ua: userAgent || '', flags: { applyNavigator: !!applyNavigator, applyWebgl: !!applyWebgl, applyUA: !!applyUA, applyLang: !!applyLang, applyViewport: !!applyViewport } });
    } catch {}
  }
}

module.exports = { applyFingerprintInitScripts, parseResolution };
