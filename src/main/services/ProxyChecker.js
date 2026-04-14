/**
 * ProxyChecker — tests proxy connectivity and detects IP/location.
 * 
 * Usage:
 *   const { checkProxy } = require('./ProxyChecker');
 *   const result = await checkProxy({ type: 'http', host: '1.2.3.4', port: 8080, username: '', password: '' });
 *   // => { success: true, alive: true, ip: '1.2.3.4', country: 'US', city: 'New York', timezone: 'America/New_York', latency: 150 }
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');

const TIMEOUT_MS = 8000;

// IP detection endpoints (free, no key needed)
const IP_APIS = [
  { url: 'http://ip-api.com/json/?fields=query,country,countryCode,city,timezone,status', parse: parseIpApi },
  { url: 'https://ipinfo.io/json', parse: parseIpInfo },
  { url: 'https://ipwhois.app/json/', parse: parseIpWhois },
];

function parseIpApi(body) {
  const d = JSON.parse(body);
  if (d.status === 'fail') return null;
  return { ip: d.query, country: d.country, countryCode: d.countryCode, city: d.city, timezone: d.timezone };
}

function parseIpInfo(body) {
  const d = JSON.parse(body);
  return { ip: d.ip, country: d.country, countryCode: d.country, city: d.city, timezone: d.timezone };
}

function parseIpWhois(body) {
  const d = JSON.parse(body);
  if (!d.success) return null;
  return { ip: d.ip, country: d.country, countryCode: d.country_code, city: d.city, timezone: d.timezone };
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
 * @returns {Object} - { success, alive, ip, country, countryCode, city, timezone, latency, error }
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
    ip: null, country: null, countryCode: null, city: null, timezone: null, latency: null,
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

module.exports = { checkProxy, checkProxiesBatch, buildProxyUrl };
