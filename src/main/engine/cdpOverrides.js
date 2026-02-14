const { chromium } = require('playwright');

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

async function applyCdpOverrides(profileId, wsEndpoint, profile, settings, startUrl, { appendLog, runningProfiles, broadcastRunningMap } = {}) {
  const fp = profile?.fingerprint || {};
  const adv = (settings && settings.advanced) || {};
  const locale = fp.language || settings?.language || 'en-US';
  const timezoneId = fp.timezone || settings?.timezone || 'UTC';
  const userAgent = fp.userAgent || undefined;
  const cpuCores = Number(settings?.cpuCores || 4);
  const deviceMemory = Number(settings?.memoryGB || 8);
  const viewport = parseResolution(fp.screenResolution || '1920x1080');
  const deviceScaleFactor = Number(adv.devicePixelRatio || 1);
  const geo = settings?.geolocation || {};
  const wantGeo = Number.isFinite(Number(geo.latitude)) && Number.isFinite(Number(geo.longitude));
  const reloadAfter = !!(adv && adv.reloadAfterOverrides);
  const apply = (settings && settings.applyOverrides) || {};
  const applyUA = apply.userAgent !== false;
  const applyLang = apply.language !== false;
  const applyTz = apply.timezone !== false;
  const applyViewport = apply.viewport !== false;
  const applyGeo = apply.geolocation !== false;

  let browser = null;
  try {
    browser = await chromium.connectOverCDP(wsEndpoint);
  } catch (e) {
    appendLog && appendLog(profileId, `CDP connect failed (skipping overrides): ${e?.message || e}`);
    return;
  }

  const context = browser.contexts?.()[0];
  if (!context) {
    try { await browser.close(); } catch {}
    appendLog && appendLog(profileId, 'CDP: no context found to apply overrides');
    return;
  }

  // Init scripts for persistent context (optional via settings.cdpApplyInitScript; default enabled)
  const shouldApplyInitScript = (() => {
    try {
      if (Object.prototype.hasOwnProperty.call(settings || {}, 'cdpApplyInitScript')) return !!settings.cdpApplyInitScript;
      if (settings?.advanced && Object.prototype.hasOwnProperty.call(settings.advanced, 'applyInitScript')) return !!settings.advanced.applyInitScript;
    } catch {}
    return true;
  })();
  if (shouldApplyInitScript) {
    try {
      const { applyFingerprintInitScripts } = require('./fingerprintInit');
      await applyFingerprintInitScripts(context, profile, settings, { overrideUserAgent: userAgent });
    } catch (e) {
      appendLog && appendLog(profileId, `CDP: addInitScript failed: ${e?.message || e}`);
    }
  } else {
    appendLog && appendLog(profileId, 'CDP: InitScript disabled by settings (cdpApplyInitScript=false)');
  }

  const applyToPage = async (page) => {
    try {
      const session = await context.newCDPSession(page);
      if (applyTz && timezoneId) { try { await session.send('Emulation.setTimezoneOverride', { timezoneId }); } catch {} }
      if (applyLang && locale) { try { await session.send('Emulation.setLocaleOverride', { locale }); } catch {} }
      if (applyUA && userAgent) {
        let params = { userAgent, platform: adv.platform || undefined };
        if (applyLang) {
          const langs = (typeof adv.languages === 'string' && adv.languages.trim()) ? adv.languages : locale;
          params.acceptLanguage = String(langs || locale);
        }
        try { await session.send('Emulation.setUserAgentOverride', params); } catch {}
      }
      if (applyViewport && viewport) {
        try {
          await session.send('Emulation.setDeviceMetricsOverride', {
            width: viewport.width,
            height: viewport.height,
            deviceScaleFactor: deviceScaleFactor > 0 ? deviceScaleFactor : 1,
            mobile: false,
            screenWidth: viewport.width,
            screenHeight: viewport.height,
          });
        } catch {}
      }
      if (applyGeo && wantGeo) {
        try {
          await session.send('Emulation.setGeolocationOverride', {
            latitude: Number(geo.latitude),
            longitude: Number(geo.longitude),
            accuracy: Number(geo.accuracy || 100),
          });
        } catch {}
      }
    } catch {}
  };

  // Apply to existing pages
  try {
    const pages = context.pages?.() || [];
    for (const p of pages) {
      // eslint-disable-next-line no-await-in-loop
      await applyToPage(p);
    }
    // Navigate to startUrl if provided; otherwise optionally reload the first page
    const normalizedStart = (typeof startUrl === 'string' && startUrl.trim()) ? startUrl.trim() : '';
    const isHttpUrl = (u) => {
      try { const url = new URL(u); return url.protocol === 'http:' || url.protocol === 'https:'; } catch { return false; }
    };
    if (normalizedStart && isHttpUrl(normalizedStart)) {
      const target = pages[0];
      if (target) {
        try {
          const cur = target.url?.() || '';
          const looksBlank = !cur || cur === 'about:blank' || cur.startsWith('chrome://') || cur.startsWith('edge://') || cur.startsWith('chrome-error://');
          if (looksBlank || cur !== normalizedStart) {
            await target.goto(normalizedStart, { waitUntil: 'domcontentloaded' });
          }
        } catch (e) {
          appendLog && appendLog(profileId, `CDP: navigate startUrl failed: ${e?.message || e}`);
        }
      } else {
        try {
          const newPage = await context.newPage();
          await applyToPage(newPage);
          await newPage.goto(normalizedStart, { waitUntil: 'domcontentloaded' });
        } catch (e) {
          appendLog && appendLog(profileId, `CDP: open startUrl failed: ${e?.message || e}`);
        }
      }
    } else if (reloadAfter && pages[0]) {
      try { await pages[0].reload({ waitUntil: 'domcontentloaded' }); } catch {}
    }
  } catch {}

  // Apply to future pages
  try { context.on?.('page', (p) => { applyToPage(p).catch(()=>{}); }); } catch {}

  // Retain a controller connection so the page listener stays alive
  try {
    if (runningProfiles) {
      const info = runningProfiles.get(profileId) || {};
      info.cdpControl = { browser, context };
      runningProfiles.set(profileId, info);
    }
    // React to unexpected disconnects to update running state immediately
    try {
      browser.on?.('disconnected', () => {
        try {
          if (runningProfiles && runningProfiles.has(profileId)) {
            const info = runningProfiles.get(profileId);
            try { info?.heartbeat && clearInterval(info.heartbeat); } catch {}
            try { info?.forwarder && info.forwarder.stop && info.forwarder.stop(); } catch {}
            runningProfiles.delete(profileId);
          }
        } catch {}
        appendLog && appendLog(profileId, 'CDP: control connection disconnected; clearing running state');
        try { broadcastRunningMap && broadcastRunningMap(); } catch {}
      });
    } catch {}
  } catch {
    try { await browser.close(); } catch {}
  }
}

module.exports = { applyCdpOverrides };
