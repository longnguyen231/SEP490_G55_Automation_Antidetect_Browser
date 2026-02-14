const net = require('net');
const http = require('http');

function isWsAlive(wsEndpoint) {
  return new Promise((resolve) => {
    try {
      const u = new URL(wsEndpoint);
      const host = u.hostname || '127.0.0.1';
      const port = Number(u.port) || 80;
      // Try a quick TCP connect first
      const socket = net.createConnection({ host, port });
      let settled = false;
      const finish = (ok) => { if (!settled) { settled = true; resolve(ok); } };
      const timer = setTimeout(() => { socket.destroy(); finish(false); }, 600);
      socket.once('connect', () => {
        clearTimeout(timer);
        socket.destroy();
        // Secondary check: DevTools /json/version
        const path = '/json/version';
        const req = http.get({ host, port, path, timeout: 500 }, (res) => {
          let data = '';
          res.on('data', d => data += d);
          res.on('end', () => {
            try {
              const j = JSON.parse(data || '{}');
              finish(!!j.webSocketDebuggerUrl);
            } catch { finish(true); }
          });
        });
        req.on('error', () => finish(true)); // If version endpoint fails but port open, still alive
        req.on('timeout', () => { try { req.destroy(); } catch {}; finish(true); });
      });
      socket.once('error', () => { clearTimeout(timer); finish(false); });
      socket.once('close', () => { /* ensure finish called elsewhere */ });
    } catch { resolve(false); }
  });
}

// Helper to actively verify and cleanup stale CDP runningProfiles entries
async function pruneDeadCdp(runningProfiles, appendLog, broadcastRunningMap) {
  if (!runningProfiles) return;
  const toRemove = [];
  for (const [id, info] of runningProfiles.entries()) {
    if (info.engine !== 'cdp') continue;
    const ws = info.wsEndpoint;
    const ok = ws ? await isWsAlive(ws) : false;
    if (!ok) toRemove.push(id);
  }
  if (toRemove.length) {
    for (const id of toRemove) {
      try {
        const info = runningProfiles.get(id);
        try { info?.heartbeat && clearInterval(info.heartbeat); } catch {}
        try { info?.forwarder && info.forwarder.stop && info.forwarder.stop(); } catch {}
        runningProfiles.delete(id);
        appendLog && appendLog(id, 'PruneDead: removed stale CDP state');
      } catch {}
    }
    try { broadcastRunningMap && broadcastRunningMap(); } catch {}
  }
}

module.exports = { isWsAlive, pruneDeadCdp };

module.exports = { isWsAlive };
