/**
 * proxyForwarder.js — Local HTTP proxy forwarder for browser profiles.
 *
 * Purpose:
 *   Chromium's --proxy-server flag only supports simple "host:port" proxies without
 *   embedded credentials and does NOT natively support SOCKS5 authentication.
 *   This module spins up a tiny local HTTP proxy on 127.0.0.1 that the browser connects to,
 *   and this local proxy forwards traffic upstream to the real proxy including auth.
 *
 * Supported upstream proxy types:
 *   - HTTP / HTTPS proxies (with or without username/password) — via proxy-chain
 *   - SOCKS4 / SOCKS5 proxies (with or without username/password) — via socks library
 */

const net = require('net');
const http = require('http');
const { URL } = require('url');

// ========================
// HTTP/HTTPS upstream (proxy-chain)
// ========================
function buildUpstreamUrl(proxy) {
  try {
    if (!proxy || !proxy.server) return null;
    let server = String(proxy.server).trim();
    if (!/^(https?|socks\d?):/i.test(server)) {
      const type = (proxy.type || '').toLowerCase();
      let scheme = 'http';
      if (type === 'socks5' || type === 'socks4') scheme = type;
      else if (type === 'https') scheme = 'http';
      server = `${scheme}://${server}`;
    }
    const u = new URL(server);
    if (proxy.username) u.username = encodeURIComponent(proxy.username);
    if (proxy.password) u.password = encodeURIComponent(proxy.password);
    return u.toString();
  } catch { return null; }
}

async function startHttpForwarder(proxy, { appendLog, profileId } = {}) {
  const ProxyChain = require('proxy-chain');
  const upstreamProxyUrl = buildUpstreamUrl(proxy);
  if (!upstreamProxyUrl) throw new Error('Invalid upstream proxy configuration');

  const server = new ProxyChain.Server({
    verbose: false,
    prepareRequestFunction: () => ({ upstreamProxyUrl }),
  });

  await server.listen(0, '127.0.0.1');
  const address = server.server.address();
  const port = address && address.port;
  const localUrl = `http://127.0.0.1:${port}`;
  appendLog && profileId && appendLog(profileId, `HTTP forwarder started at ${localUrl} -> ${upstreamProxyUrl.replace(/:\/\/(.*?)@/, '://***:***@')}`);

  const stop = async () => {
    try { await server.close(true); } catch {}
    appendLog && profileId && appendLog(profileId, 'Stopped HTTP proxy forwarder');
  };
  return { url: localUrl, port, stop, _server: server };
}

// ========================
// SOCKS upstream (socks library)
// ========================
async function startSocksForwarder(proxy, { appendLog, profileId } = {}) {
  const { SocksClient } = require('socks');

  // Parse the SOCKS proxy details
  let server = String(proxy.server).trim();
  // Strip scheme if present
  server = server.replace(/^socks\d?:\/\//i, '');
  const parts = server.split(':');
  const socksHost = parts[0] || '127.0.0.1';
  const socksPort = parseInt(parts[1], 10) || 1080;
  const socksType = (proxy.type || '').toLowerCase() === 'socks4' ? 4 : 5;

  const socksOptions = {
    proxy: {
      host: socksHost,
      port: socksPort,
      type: socksType,
    },
    command: 'connect',
    // destination will be filled per-request
  };
  if (proxy.username) socksOptions.proxy.userId = proxy.username;
  if (proxy.password) socksOptions.proxy.password = proxy.password;

  // Create a local HTTP proxy server
  const localServer = http.createServer((req, res) => {
    // Regular HTTP requests (non-CONNECT)
    const targetUrl = new URL(req.url);
    const destHost = targetUrl.hostname;
    const destPort = parseInt(targetUrl.port, 10) || 80;

    SocksClient.createConnection({
      ...socksOptions,
      destination: { host: destHost, port: destPort },
    }).then(({ socket: socksSocket }) => {
      // Forward the original HTTP request through the SOCKS tunnel
      const proxyReq = `${req.method} ${targetUrl.pathname}${targetUrl.search || ''} HTTP/${req.httpVersion}\r\n`;
      const headers = Object.entries(req.headers)
        .filter(([k]) => k.toLowerCase() !== 'proxy-connection')
        .map(([k, v]) => `${k}: ${v}`)
        .join('\r\n');
      socksSocket.write(proxyReq + headers + '\r\n\r\n');
      req.pipe(socksSocket);
      socksSocket.pipe(res);
      socksSocket.on('error', () => { try { res.destroy(); } catch {} });
      res.on('error', () => { try { socksSocket.destroy(); } catch {} });
    }).catch(() => {
      try { res.writeHead(502); res.end('SOCKS connection failed'); } catch {}
    });
  });

  // Handle CONNECT method for HTTPS tunneling
  localServer.on('connect', (req, clientSocket, head) => {
    const [destHost, destPortStr] = req.url.split(':');
    const destPort = parseInt(destPortStr, 10) || 443;

    SocksClient.createConnection({
      ...socksOptions,
      destination: { host: destHost, port: destPort },
    }).then(({ socket: socksSocket }) => {
      clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
      if (head && head.length) socksSocket.write(head);
      socksSocket.pipe(clientSocket);
      clientSocket.pipe(socksSocket);
      socksSocket.on('error', () => { try { clientSocket.destroy(); } catch {} });
      clientSocket.on('error', () => { try { socksSocket.destroy(); } catch {} });
    }).catch(() => {
      try { clientSocket.write('HTTP/1.1 502 Bad Gateway\r\n\r\n'); clientSocket.destroy(); } catch {}
    });
  });

  // Suppress server-level errors
  localServer.on('error', () => {});

  await new Promise((resolve, reject) => {
    localServer.listen(0, '127.0.0.1', () => resolve());
    localServer.once('error', reject);
  });

  const address = localServer.address();
  const port = address && address.port;
  const localUrl = `http://127.0.0.1:${port}`;
  appendLog && profileId && appendLog(profileId, `SOCKS${socksType} forwarder started at ${localUrl} -> ${socksHost}:${socksPort}`);

  const stop = async () => {
    try { localServer.close(); } catch {}
    appendLog && profileId && appendLog(profileId, 'Stopped SOCKS proxy forwarder');
  };
  return { url: localUrl, port, stop, _server: localServer };
}

// ========================
// Main entry point
// ========================
/**
 * Starts a local proxy forwarder based on the proxy type.
 * For SOCKS4/SOCKS5 proxies, uses the socks library to create a tunnel.
 * For HTTP/HTTPS proxies, uses proxy-chain.
 */
async function startProxyForwarder(proxy, opts = {}) {
  const proxyType = (proxy?.type || '').toLowerCase();
  const serverStr = String(proxy?.server || '');
  const isSocks = proxyType.startsWith('socks') || /^socks\d?:\/\//i.test(serverStr);

  if (isSocks) {
    return await startSocksForwarder(proxy, opts);
  }
  return await startHttpForwarder(proxy, opts);
}

module.exports = { startProxyForwarder };
