const { chromium } = require('playwright');
const { buildUserAgentMetadata } = require('./client-hints-utils');

function buildSecChUaBrands(major) {
  const m = Number(major);
  let notABrand;
  if (m >= 135) notABrand = { brand: 'Not?A_Brand', version: '99' };
  else if (m >= 131) notABrand = { brand: 'Not)A;Brand', version: '99' };
  else if (m >= 125) notABrand = { brand: 'Not/A)Brand', version: '8' };
  else notABrand = { brand: 'Not_A Brand', version: '24' };
  return [notABrand, { brand: 'Chromium', version: String(m) }, { brand: 'Google Chrome', version: String(m) }];
}

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

async function applyCdpOverrides(profileId, wsEndpoint, profile, settings, startUrl, { appendLog, runningProfiles, broadcastRunningMap, savedTabs } = {}) {
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

  // Chạy các script tiền khởi tạo cho persistent context (tuỳ chọn qua cài đặt cdpApplyInitScript; mặc định bật)
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
      const safeMode = settings?.safeMode !== false; // default ON
      await applyFingerprintInitScripts(context, profile, settings, { overrideUserAgent: userAgent, safeMode });
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
        // Khởi tạo User-Agent Client Hints (Sec-CH-UA) — Bypass kiểm tra của hệ thống Cloudflare
        try {
          const versionMatch = userAgent.match(/Chrome\/(\d+)\.(\d+)\.(\d+)\.(\d+)/);
          if (versionMatch) {
            const full = `${versionMatch[1]}.${versionMatch[2]}.${versionMatch[3]}.${versionMatch[4]}`;
            params.userAgentMetadata = buildUserAgentMetadata(full, adv.platform || '');
          }
        } catch {}
        try { await session.send('Emulation.setUserAgentOverride', params); } catch {}
      }
      if (applyViewport && viewport) {
        try {
          // Vô hiệu hóa tính năng setDeviceMetricsOverride mặc định của CDP để trình duyệt không bị khóa/zoom tỷ lệ.
          // File js khởi tạo (fingerprintInit.js) đã giả mạo biến window.screen.* hoàn hảo ở cấp độ JS rồi.
          // Ta không muốn CDP khóa cứng viewport ở 3840x2160 nếu màn hình thật của người dùng nhỏ hơn.
          /*
          await session.send('Emulation.setDeviceMetricsOverride', {
            width: viewport.width,
            height: viewport.height,
            deviceScaleFactor: deviceScaleFactor > 0 ? deviceScaleFactor : 1,
            mobile: false,
            screenWidth: viewport.width,
            screenHeight: viewport.height,
          });
          */
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

  // Áp dụng CDP Overrides vào các trang (tabs) đang mở sẵn
  try {
    const isHttpUrl = (u) => { try { const url = new URL(u); return url.protocol === 'http:' || url.protocol === 'https:'; } catch { return false; } };
    const pages = context.pages?.() || [];
    for (const p of pages) {
      // eslint-disable-next-line no-await-in-loop
      await applyToPage(p);
    }
    // Khôi phục các tab từ lần chạy trước hoặc chuyển hướng đến StartUrl mặc định
    const restoredTabs = Array.isArray(savedTabs) ? savedTabs : [];

    if (restoredTabs.length > 0) {
      appendLog && appendLog(profileId, `CDP: Restoring ${savedTabs.length} saved tabs...`);
      let first = true;
      for (const url of restoredTabs) {
        if (!isHttpUrl(url)) continue;
        try {
          const target = first ? (pages[0] || await context.newPage()) : await context.newPage();
          first = false;
          if (target !== pages[0]) await applyToPage(target);
          await target.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        } catch (e) {
          appendLog && appendLog(profileId, `CDP: Failed to restore tab ${url}: ${e?.message || e}`);
        }
      }
    } else {
      const normalizedStart = (typeof startUrl === 'string' && startUrl.trim()) ? startUrl.trim() : '';
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
    }
  } catch {}

  // Tự động Áp dụng CDP vào các trang (tabs) sẽ được mở trong tương lai
  try { context.on?.('page', (p) => { applyToPage(p).catch(()=>{}); }); } catch {}

  // Giữ lại kết nối Điều khiển để bộ lắng nghe (listener) của trang không bị tắt
  try {
    if (runningProfiles) {
      const info = runningProfiles.get(profileId) || {};
      info.cdpControl = { browser, context };
      runningProfiles.set(profileId, info);
    }
    // Lắng nghe sự cố mất kết nối đột ngột để cập nhật trạng thái "Running" lập tức trên UI
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
