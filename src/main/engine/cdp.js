/**
 * cdp.js — Core Chromium / Chrome Launcher for the CDP Engine.
 * 
 * This file is responsible for spawning the raw Chrome/Edge browser process
 * and managing its lifecycle (finding free ports, connecting to the debugger,
 * and force-killing lingering processes). It operates entirely independently
 * from Playwright's built-in browser launcher.
 */

const { spawn, execFile } = require('child_process');
const http = require('http');
const net = require('net');
const path = require('path');
const fs = require('fs');
const { getDataRoot } = require('../storage/paths');

function ensureDir(p) { try { fs.mkdirSync(p, { recursive: true }); } catch {} }

/**
 * Returns the isolated User Data Directory path for a specific profile.
 * This guarantees that cookies, cache, and history are kept strictly separate.
 */
function userDataDirFor(profileId) {
  const dir = path.join(getDataRoot(), 'cdp-user-data', String(profileId));
  ensureDir(dir);
  return dir;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

/**
 * Finds an available TCP port on the host machine to use for the Chrome Debugger.
 * It attempts up to `maxTries` times starting from `start` port.
 */
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

/**
 * Queries the `/json/version` HTTP endpoint of the running Chrome Debugger
 * to securely obtain the actual WebSocket Debugger URL (webSocketDebuggerUrl).
 * This is more reliable than parsing the stdout/stderr stream.
 */
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

/**
 * Forcefully kills a process and all its children.
 * Crucial for Windows where Chrome often leaves orphaned background processes
 * (like crashpad handlers or GPU processes) running even after the main window is closed.
 */
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

/**
 * Main function to launch a raw Chrome/Edge process for the CDP Engine.
 * 
 * Flow:
 * 1. Assembles CLI arguments (userDataDir, debug port, proxies, anti-detect flags).
 * 2. Spawns the `chrome.exe` child process in totally detached/background mode.
 * 3. Monitors the STDERR output until it sees the "DevTools listening on ws://..."
 *    message, indicating the browser is ready to receive CDP commands.
 * 
 * @returns {Promise<{ child: ChildProcess, wsPromise: Promise<string> }>}
 */
async function launchChromeCdp({ profileId, chromePath, host, port, userDataDir, startUrl, proxy, appendLog, extraArgs = [] }) {
  const chromeArgs = [
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    `--remote-debugging-port=${port}`,
    `--remote-allow-origins=*`,
    // ── Prevent opening extra Chrome windows / reusing existing Chrome process ──
    '--disable-session-crashed-bubble',
    '--disable-infobars',
    '--hide-crash-restore-bubble',
    // ── Stealth / anti-detection flags ──
    '--disable-blink-features=AutomationControlled',
    '--disable-features=AutomationControlled,TranslateUI',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    '--disable-ipc-flooding-protection',
    '--disable-hang-monitor',
    '--disable-prompt-on-repost',
    '--disable-domain-reliability',
    '--disable-component-update',
    '--metrics-recording-only',
    '--no-service-autorun',
    '--password-store=basic',
    '--use-mock-keychain',
    '--export-tagged-pdf',
    '--lang=en-US,en',
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
  const child = spawn(chromePath, chromeArgs, {
    stdio: ['ignore', 'ignore', 'pipe'],
    windowsHide: false, // windowsHide hides console window but Chrome's GUI window must be shown
    detached: false,    // keep Chrome as child so it's killed when Electron exits
  });
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
