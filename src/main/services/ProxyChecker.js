/**
 * ProxyChecker — tests proxy connectivity and detects IP/location.
 * 
 * Usage:
 *   const { checkProxy } = require('./ProxyChecker');
 *   const result = await checkProxy({ type: 'http', host: '1.2.3.4', port: 8080, username: '', password: '' });
 *   // => { success: true, alive: true, ip: '1.2.3.4', country: 'US', city: 'New York', timezone: 'America/New_York', latitude: 40.7128, longitude: -74.006, locale: 'en-US', latency: 150 }
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');

const TIMEOUT_MS = 8000;

// ═══════════════════════════════════════════════════════════════════════
// COUNTRY → LOCALE MAPPING
// Maps ISO 3166-1 alpha-2 country codes to BCP 47 locale strings.
// Used by Proxy-Based Fingerprint Sync to auto-set profile language.
// ═══════════════════════════════════════════════════════════════════════
const COUNTRY_LOCALE_MAP = {
  US: { locale: 'en-US', languages: 'en-US,en;q=0.9' },
  GB: { locale: 'en-GB', languages: 'en-GB,en;q=0.9,en-US;q=0.8' },
  CA: { locale: 'en-CA', languages: 'en-CA,en;q=0.9,en-US;q=0.8' },
  AU: { locale: 'en-AU', languages: 'en-AU,en;q=0.9,en-US;q=0.8' },
  IE: { locale: 'en-IE', languages: 'en-IE,en;q=0.9,en-US;q=0.8' },
  NZ: { locale: 'en-NZ', languages: 'en-NZ,en;q=0.9,en-US;q=0.8' },
  VN: { locale: 'vi-VN', languages: 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7' },
  JP: { locale: 'ja-JP', languages: 'ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7' },
  KR: { locale: 'ko-KR', languages: 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7' },
  CN: { locale: 'zh-CN', languages: 'zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7' },
  TW: { locale: 'zh-TW', languages: 'zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7' },
  HK: { locale: 'zh-HK', languages: 'zh-HK,zh;q=0.9,en-US;q=0.8,en;q=0.7' },
  DE: { locale: 'de-DE', languages: 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7' },
  AT: { locale: 'de-AT', languages: 'de-AT,de;q=0.9,en-US;q=0.8,en;q=0.7' },
  CH: { locale: 'de-CH', languages: 'de-CH,de;q=0.9,en-US;q=0.8,en;q=0.7' },
  FR: { locale: 'fr-FR', languages: 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7' },
  BE: { locale: 'fr-BE', languages: 'fr-BE,fr;q=0.9,en-US;q=0.8,en;q=0.7' },
  ES: { locale: 'es-ES', languages: 'es-ES,es;q=0.9,en-US;q=0.8,en;q=0.7' },
  MX: { locale: 'es-MX', languages: 'es-MX,es;q=0.9,en-US;q=0.8,en;q=0.7' },
  AR: { locale: 'es-AR', languages: 'es-AR,es;q=0.9,en-US;q=0.8,en;q=0.7' },
  CO: { locale: 'es-CO', languages: 'es-CO,es;q=0.9,en-US;q=0.8,en;q=0.7' },
  IT: { locale: 'it-IT', languages: 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7' },
  PT: { locale: 'pt-PT', languages: 'pt-PT,pt;q=0.9,en-US;q=0.8,en;q=0.7' },
  BR: { locale: 'pt-BR', languages: 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7' },
  RU: { locale: 'ru-RU', languages: 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7' },
  UA: { locale: 'uk-UA', languages: 'uk-UA,uk;q=0.9,en-US;q=0.8,en;q=0.7' },
  PL: { locale: 'pl-PL', languages: 'pl-PL,pl;q=0.9,en-US;q=0.8,en;q=0.7' },
  NL: { locale: 'nl-NL', languages: 'nl-NL,nl;q=0.9,en-US;q=0.8,en;q=0.7' },
  TR: { locale: 'tr-TR', languages: 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7' },
  TH: { locale: 'th-TH', languages: 'th-TH,th;q=0.9,en-US;q=0.8,en;q=0.7' },
  ID: { locale: 'id-ID', languages: 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7' },
  MY: { locale: 'ms-MY', languages: 'ms-MY,ms;q=0.9,en-US;q=0.8,en;q=0.7' },
  SG: { locale: 'en-SG', languages: 'en-SG,en;q=0.9,zh;q=0.8' },
  PH: { locale: 'en-PH', languages: 'en-PH,en;q=0.9,tl;q=0.8' },
  IN: { locale: 'hi-IN', languages: 'hi-IN,hi;q=0.9,en-US;q=0.8,en;q=0.7' },
  SA: { locale: 'ar-SA', languages: 'ar-SA,ar;q=0.9,en-US;q=0.8,en;q=0.7' },
  AE: { locale: 'ar-AE', languages: 'ar-AE,ar;q=0.9,en-US;q=0.8,en;q=0.7' },
  EG: { locale: 'ar-EG', languages: 'ar-EG,ar;q=0.9,en-US;q=0.8,en;q=0.7' },
  IL: { locale: 'he-IL', languages: 'he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7' },
  SE: { locale: 'sv-SE', languages: 'sv-SE,sv;q=0.9,en-US;q=0.8,en;q=0.7' },
  NO: { locale: 'nb-NO', languages: 'nb-NO,nb;q=0.9,en-US;q=0.8,en;q=0.7' },
  DK: { locale: 'da-DK', languages: 'da-DK,da;q=0.9,en-US;q=0.8,en;q=0.7' },
  FI: { locale: 'fi-FI', languages: 'fi-FI,fi;q=0.9,en-US;q=0.8,en;q=0.7' },
  CZ: { locale: 'cs-CZ', languages: 'cs-CZ,cs;q=0.9,en-US;q=0.8,en;q=0.7' },
  HU: { locale: 'hu-HU', languages: 'hu-HU,hu;q=0.9,en-US;q=0.8,en;q=0.7' },
  RO: { locale: 'ro-RO', languages: 'ro-RO,ro;q=0.9,en-US;q=0.8,en;q=0.7' },
  GR: { locale: 'el-GR', languages: 'el-GR,el;q=0.9,en-US;q=0.8,en;q=0.7' },
};

/**
 * Map ISO country code to BCP 47 locale and Accept-Language header.
 * Falls back to 'en-US' for unknown countries.
 */
function countryToLocale(countryCode) {
  if (!countryCode) return { locale: 'en-US', languages: 'en-US,en;q=0.9' };
  const code = String(countryCode).toUpperCase().trim();
  return COUNTRY_LOCALE_MAP[code] || { locale: 'en-US', languages: 'en-US,en;q=0.9' };
}

// IP detection endpoints (free, no key needed)
// Extended to request latitude/longitude fields for Proxy-Based Fingerprint Sync
const IP_APIS = [
  { url: 'http://ip-api.com/json/?fields=query,country,countryCode,city,timezone,lat,lon,status', parse: parseIpApi },
  { url: 'https://ipinfo.io/json', parse: parseIpInfo },
  { url: 'https://ipwhois.app/json/', parse: parseIpWhois },
];

function parseIpApi(body) {
  const d = JSON.parse(body);
  if (d.status === 'fail') return null;
  const localeInfo = countryToLocale(d.countryCode);
  return {
    ip: d.query, country: d.country, countryCode: d.countryCode,
    city: d.city, timezone: d.timezone,
    latitude: d.lat ?? null, longitude: d.lon ?? null,
    locale: localeInfo.locale, languages: localeInfo.languages,
  };
}

function parseIpInfo(body) {
  const d = JSON.parse(body);
  // ipinfo.io returns location as "lat,lng" string in d.loc
  let latitude = null, longitude = null;
  if (d.loc) {
    const parts = d.loc.split(',');
    if (parts.length === 2) {
      latitude = parseFloat(parts[0]) || null;
      longitude = parseFloat(parts[1]) || null;
    }
  }
  const localeInfo = countryToLocale(d.country);
  return {
    ip: d.ip, country: d.country, countryCode: d.country,
    city: d.city, timezone: d.timezone,
    latitude, longitude,
    locale: localeInfo.locale, languages: localeInfo.languages,
  };
}

function parseIpWhois(body) {
  const d = JSON.parse(body);
  if (!d.success) return null;
  const localeInfo = countryToLocale(d.country_code);
  return {
    ip: d.ip, country: d.country, countryCode: d.country_code,
    city: d.city, timezone: d.timezone,
    latitude: d.latitude ?? null, longitude: d.longitude ?? null,
    locale: localeInfo.locale, languages: localeInfo.languages,
  };
}

/**
 * Build a proxy URL string from config.
 */
function buildProxyUrl(cfg) {
  if (!cfg || !cfg.host) return null;
  const type = (cfg.type || 'http').toLowerCase();
  const scheme = type.startsWith('socks') ? type : 'http';
  const auth = (cfg.username && cfg.password)
    ? `${encodeURIComponent(cfg.username)}:${encodeURIComponent(cfg.password)}@`
    : cfg.username ? `${encodeURIComponent(cfg.username)}@` : '';
  return `${scheme}://${auth}${cfg.host}:${cfg.port || 80}`;
}

/**
 * Perform HTTP GET through an HTTP/HTTPS proxy.
 */
function httpGetViaProxy(targetUrl, proxyHost, proxyPort, proxyAuth, timeoutMs) {
  return new Promise((resolve, reject) => {
    const target = new URL(targetUrl);
    const opts = {
      hostname: proxyHost,
      port: proxyPort,
      path: targetUrl,
      method: 'GET',
      headers: {
        'Host': target.host,
        'User-Agent': 'ProxyChecker/1.0',
      },
      timeout: timeoutMs,
    };
    if (proxyAuth) {
      opts.headers['Proxy-Authorization'] = 'Basic ' + Buffer.from(proxyAuth).toString('base64');
    }

    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => resolve({ statusCode: res.statusCode, body: data }));
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('Proxy connection timed out')); });
    req.on('error', reject);
    req.end();
  });
}

/**
 * Perform HTTP GET through a SOCKS proxy using proxy-chain as a local forwarder.
 */
async function httpGetViaSocks(targetUrl, cfg, timeoutMs) {
  const ProxyChain = require('proxy-chain');
  const proxyUrl = buildProxyUrl(cfg);

  // Start local forwarder to handle SOCKS
  const server = new ProxyChain.Server({
    verbose: false,
    prepareRequestFunction: () => ({ upstreamProxyUrl: proxyUrl }),
  });
  await server.listen(0, '127.0.0.1');
  const address = server.server.address();
  const localPort = address.port;

  try {
    const result = await httpGetViaProxy(targetUrl, '127.0.0.1', localPort, null, timeoutMs);
    return result;
  } finally {
    try { await server.close(true); } catch { }
  }
}

/**
 * Check a proxy by sending a request to an IP detection API through it.
 * 
 * @param {Object} cfg - { type, host, port, username, password }
 * @returns {Object} - { success, alive, ip, country, countryCode, city, timezone, latitude, longitude, locale, languages, latency, error }
 */
async function checkProxy(cfg) {
  if (!cfg || !cfg.host || !cfg.port) {
    return { success: false, alive: false, error: 'Host and port are required' };
  }

  const type = (cfg.type || 'http').toLowerCase();
  const isSocks = type.startsWith('socks');
  const proxyAuth = (cfg.username && cfg.password) ? `${cfg.username}:${cfg.password}` : null;

  // Try all IP APIs in parallel — use the first successful result
  const start = Date.now();
  const tryApi = async (api) => {
    let result;
    if (isSocks) {
      result = await httpGetViaSocks(api.url, cfg, TIMEOUT_MS);
    } else {
      result = await httpGetViaProxy(api.url, cfg.host, Number(cfg.port), proxyAuth, TIMEOUT_MS);
    }
    const latency = Date.now() - start;
    if (result.statusCode >= 200 && result.statusCode < 400) {
      const geo = api.parse(result.body);
      if (geo) return { success: true, alive: true, latency, ...geo };
    }
    return { success: true, alive: true, latency, warning: `API returned status ${result.statusCode}` };
  };

  // Race all APIs — first to resolve wins, errors are ignored
  const winner = await Promise.any(IP_APIS.map(api => tryApi(api))).catch(() => null);
  if (winner) return winner;

  return {
    success: true, alive: false,
    ip: null, country: null, countryCode: null, city: null, timezone: null,
    latitude: null, longitude: null, locale: null, languages: null, latency: null,
    error: 'Connection failed or timed out',
  };
}

/**
 * Check multiple proxies concurrently (max 5 at a time).
 */
async function checkProxiesBatch(proxies, onResult) {
  const concurrency = 5;
  const queue = [...proxies];
  const running = [];

  const runNext = async () => {
    if (!queue.length) return;
    const proxy = queue.shift();
    try {
      const result = await checkProxy(proxy);
      if (onResult) onResult(proxy.id, result);
    } catch (e) {
      if (onResult) onResult(proxy.id, { success: false, alive: false, error: e.message });
    }
    await runNext();
  };

  for (let i = 0; i < Math.min(concurrency, queue.length); i++) {
    running.push(runNext());
  }
  await Promise.all(running);
}

module.exports = { checkProxy, checkProxiesBatch, buildProxyUrl, countryToLocale, COUNTRY_LOCALE_MAP };
