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


  // Hardware and Navigator Init Scripts have been completely removed.
  // JS Monkey-patching of navigator properties (e.g. navigator.hardwareConcurrency, navigator.platform) 
  // causes 100% detection rate by Cloudflare Turnstile's Object.getOwnPropertyDescriptor checks.
  // Instead, CDP Native Emulation (in cdpOverrides.js) handles UserAgent, Platform, Language, and Viewport safely at the C++ level.
}

module.exports = { applyFingerprintInitScripts, parseResolution };
