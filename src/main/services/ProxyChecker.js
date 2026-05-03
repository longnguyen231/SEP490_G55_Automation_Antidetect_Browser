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
const { HttpProxyAgent } = require('http-proxy-agent');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { SocksProxyAgent } = require('socks-proxy-agent');

const TIMEOUT_MS = 10000;

// IP detection endpoints (free, no key needed). Mix of HTTP + HTTPS so a proxy
// that blocks one scheme still has a fallback on the other.
const IP_APIS = [
  { url: 'http://ip-api.com/json/?fields=query,country,countryCode,city,timezone,status', parse: parseIpApi },
  { url: 'https://ipinfo.io/json', parse: parseIpInfo },
  { url: 'https://ipwhois.app/json/', parse: parseIpWhois },
  { url: 'http://api.ipify.org/?format=json', parse: parseIpify },
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

function parseIpify(body) {
  const d = JSON.parse(body);
  if (!d.ip) return null;
  return { ip: d.ip, country: '', countryCode: '', city: '', timezone: '' };
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
 * Build the right proxy agent for a given (proxy, target) pair.
 * Agents handle CONNECT tunneling automatically for HTTPS targets.
 */
function buildAgent(cfg, isHttpsTarget) {
  const proxyUrl = buildProxyUrl(cfg);
  if (!proxyUrl) return null;
  const type = (cfg.type || 'http').toLowerCase();
  if (type.startsWith('socks')) return new SocksProxyAgent(proxyUrl);
  return isHttpsTarget ? new HttpsProxyAgent(proxyUrl) : new HttpProxyAgent(proxyUrl);
}

/**
 * Perform a GET request through the proxy. Works for both HTTP and HTTPS
 * targets — HTTPS goes through CONNECT tunneling via the agent.
 */
function httpGetViaProxy(targetUrl, cfg, timeoutMs) {
  return new Promise((resolve, reject) => {
    const target = new URL(targetUrl);
    const isHttps = target.protocol === 'https:';
    const agent = buildAgent(cfg, isHttps);
    if (!agent) return reject(new Error('Invalid proxy configuration'));

    const lib = isHttps ? https : http;
    const opts = {
      method: 'GET',
      agent,
      timeout: timeoutMs,
      headers: {
        'User-Agent': 'Mozilla/5.0 ProxyChecker/1.0',
        'Accept': 'application/json,text/plain,*/*',
      },
    };

    const req = lib.request(targetUrl, opts, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => resolve({ statusCode: res.statusCode, body: data }));
    });
    req.on('timeout', () => { req.destroy(new Error('Proxy connection timed out')); });
    req.on('error', reject);
    req.end();
  });
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

  const start = Date.now();
  const errors = [];
  const tryApi = async (api) => {
    let result;
    try {
      result = await httpGetViaProxy(api.url, cfg, TIMEOUT_MS);
    } catch (e) {
      errors.push(`${api.url}: ${e.code || e.message}`);
      throw e;
    }
    const latency = Date.now() - start;
    if (result.statusCode >= 200 && result.statusCode < 400) {
      let geo = null;
      try { geo = api.parse(result.body); } catch { /* malformed body */ }
      if (geo) return { success: true, alive: true, latency, ...geo };
      // 2xx but unparseable — proxy is alive, just couldn't read geo
      return { success: true, alive: true, latency, warning: `Could not parse response from ${api.url}` };
    }
    errors.push(`${api.url}: HTTP ${result.statusCode}`);
    throw new Error(`HTTP ${result.statusCode}`);
  };

  // Race all APIs — first success wins; if all fail, surface the joined errors
  const winner = await Promise.any(IP_APIS.map(api => tryApi(api))).catch(() => null);
  if (winner) return winner;

  return {
    success: true, alive: false,
    ip: null, country: null, countryCode: null, city: null, timezone: null, latency: null,
    error: errors.length ? errors.join(' | ') : 'Connection failed or timed out',
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
