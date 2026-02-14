const { spawn, execFile } = require('child_process');
const http = require('http');
const net = require('net');
const path = require('path');
const fs = require('fs');
const { getDataRoot } = require('../storage/paths');

function ensureDir(p) { try { fs.mkdirSync(p, { recursive: true }); } catch {} }

function userDataDirFor(profileId) {
  const dir = path.join(getDataRoot(), 'cdp-user-data', String(profileId));
  ensureDir(dir);
  return dir;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function findFreePort(start = 9222, host = '127.0.0.1', maxTries = 50) {
  let port = start;
  for (let i = 0; i < maxTries; i++) {
    const ok = await new Promise((resolve) => {
      const server = net.createServer();
      server.once('error', () => resolve(false));
      server.once('listening', () => { server.close(() => resolve(true)); });
      try { server.listen(port, host); } catch { resolve(false); }
    });
    if (ok) return port; port++;
  }
  throw new Error('No free port found for remote debugging');
}

async function fetchJsonVersion(host, port, timeoutMs = 20000) {
  const hostCandidates = Array.from(new Set([host, '127.0.0.1', 'localhost'].filter(Boolean)));
  const start = Date.now();
  let lastErr;
  // Grace period for Chrome to bind the port
  await sleep(300);
  while (Date.now() - start < timeoutMs) {
    for (const h of hostCandidates) {
      try {
        const base = `http://${h}:${port}/json/version`;
        const json = await new Promise((resolve, reject) => {
          const req = http.get(base, (res) => {
            let data = '';
            res.setEncoding('utf8');
            res.on('data', chunk => data += chunk);
            res.on('end', () => { try { resolve(JSON.parse(data)); } catch (e) { reject(e); } });
          });
          req.on('error', reject);
          req.setTimeout(1500, () => { try { req.destroy(new Error('timeout')); } catch {} });
        });
        if (json && json.webSocketDebuggerUrl) return json;
      } catch (e) { lastErr = e; }
    }
    await sleep(250);
  }
  const msg = lastErr?.message || 'DevTools version endpoint not available';
  throw new Error(`Failed to fetch DevTools URL: ${msg}`);
}

function killProcessTreeWin(pid) {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') {
      try { process.kill(pid, 'SIGKILL'); resolve(true); } catch { resolve(false); }
      return;
    }
    execFile('taskkill', ['/PID', String(pid), '/T', '/F'], () => {
      try { process.kill(pid, 'SIGKILL'); } catch {}
      resolve(true);
    });
  });
}

async function launchChromeCdp({ profileId, chromePath, host, port, userDataDir, startUrl, proxy, appendLog, extraArgs = [] }) {
  const chromeArgs = [
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    `--remote-debugging-port=${port}`,
    `--remote-allow-origins=*`,
  ];
  // On macOS, omitting remote-debugging-address improves reliability; let Chrome choose the bind address (localhost)
  if (host && process.platform !== 'darwin') chromeArgs.push(`--remote-debugging-address=${host}`);
  if (proxy?.server) {
    let proxyServer = proxy.server;
    // Add default scheme if missing
    if (!/^https?:\/\//i.test(proxyServer) && !/^socks\d?:\/\//i.test(proxyServer)) {
      proxyServer = `http://${proxyServer}`;
    }
    // Inject credentials when provided
    try {
      const u = new URL(proxyServer);
      if (proxy.username) u.username = encodeURIComponent(proxy.username);
      if (proxy.password) u.password = encodeURIComponent(proxy.password);
      proxyServer = u.toString();
    } catch {
      // leave as-is on parse failure
    }
    chromeArgs.push(`--proxy-server=${proxyServer}`);
    if (proxy?.bypass) chromeArgs.push(`--proxy-bypass-list=${proxy.bypass}`);
  }
  if (Array.isArray(extraArgs) && extraArgs.length) {
    chromeArgs.push(...extraArgs.filter(Boolean));
  }
  if (startUrl) chromeArgs.push(startUrl);
  // Redact credentials in logs
  let logArgs = chromeArgs.slice();
  try {
    logArgs = logArgs.map(a => {
      if (a.startsWith('--proxy-server=')) {
        const value = a.split('=')[1] || '';
        try {
          const u = new URL(value);
          if (u.username || u.password) {
            u.username = '***';
            u.password = '***';
            return `--proxy-server=${u.toString()}`;
          }
        } catch {}
      }
      return a;
    });
  } catch {}
  // Verify executable exists before spawn
  try {
    if (!chromePath || !fs.existsSync(chromePath)) {
      const msg = `Chrome executable not found at: ${chromePath}`;
      appendLog && appendLog(profileId, msg);
      throw new Error(msg);
    }
  } catch (e) {
    throw e;
  }
  appendLog && appendLog(profileId, `Spawning Chrome for CDP: ${chromePath} ${logArgs.join(' ')}`);
  const child = spawn(chromePath, chromeArgs, { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true });
  // Promise that resolves when Chrome logs the DevTools WS endpoint
  let resolveWs;
  let rejectWs;
  const wsPromise = new Promise((resolve, reject) => { resolveWs = resolve; rejectWs = reject; });
  const wsRegex = /DevTools listening on (ws:\/\/[^\s]+)/i;
  try {
    child.stderr && child.stderr.on('data', (buf) => {
      const line = String(buf || '').trim();
      if (!line) return;
      appendLog && appendLog(profileId, `Chrome STDERR: ${line}`);
      try {
        const m = line.match(wsRegex);
        if (m && m[1]) resolveWs && resolveWs(m[1]);
      } catch {}
    });
  } catch {}
  // If process exits early, reject the promise so callers can handle it
  try { child.once('exit', (code, signal) => { rejectWs && rejectWs(new Error(`Chrome exited early (${code || ''} ${signal || ''})`)); }); } catch {}
  return { child, wsPromise };
}

module.exports = {
  userDataDirFor,
  findFreePort,
  fetchJsonVersion,
  killProcessTreeWin,
  launchChromeCdp,
};
