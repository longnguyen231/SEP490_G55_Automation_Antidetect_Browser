// Clean modular Electron main process entrypoint (bootstrap)
const { app } = require('electron');
const { createWindow } = require('./window/mainWindow');
const { initializeDataFiles } = require('./storage/paths');
const { loadSettings, saveSettings } = require('./storage/settings');
const { registerIpcHandlers } = require('./ipc/handlers');
const { createRestServer } = require('./api/restServer');
const { runningProfiles } = require('./state/runtime');
const { isWsAlive } = require('./engine/health');
const { appendLog } = require('./logging/logger');
const { startAutomationScheduler } = require('./engine/automation');
const { setMainWindowRef } = require('./services/browserManagerService');
const { setMainWindowRef: setCamoufoxWindowRef } = require('./services/camoufoxManager');

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

const HEARTBEAT_GRACE_MS = 20000; // don't check profiles started less than 20s ago

function startBackgroundHeartbeat(intervalMs = 30000) {
  setInterval(async () => {
    let changed = false;
    for (const [id, info] of [...runningProfiles.entries()]) {
      try {
        // Skip recently-started profiles — process may still be initializing
        const age = info.startedAt ? (Date.now() - info.startedAt) : Infinity;
        if (age < HEARTBEAT_GRACE_MS) continue;

        // Playwright pipe mode has no WS endpoint — use context/browser state instead
        if (info.engine === 'playwright') {
          const dead = info.context?.isClosed?.() || info.browser?.isConnected?.() === false;
          if (dead) {
            try { info?.forwarder?.stop?.(); } catch {}
            runningProfiles.delete(id);
            appendLog(id, 'Heartbeat: Playwright browser disconnected, removing');
            changed = true;
          }
          continue;
        }

        // CDP engine — check WS endpoint
        const ws = info.wsEndpoint;
        const alive = ws ? await isWsAlive(ws) : false;
        if (!alive) {
          try { info?.heartbeat && clearInterval(info.heartbeat); } catch {}
          try { await info?.forwarder?.stop?.(); } catch {}
          runningProfiles.delete(id);
          appendLog(id, 'Heartbeat: stale CDP profile removed');
          changed = true;
        }
      } catch (e) {
        appendLog(id, `Heartbeat check error: ${e?.message || e}`);
      }
    }
    if (changed) {
      try {
        const { BrowserWindow } = require('electron');
        const payload = { map: Object.fromEntries([...runningProfiles.entries()].map(([id, info]) => [id, info.wsEndpoint || null])) };
        for (const w of BrowserWindow.getAllWindows()) {
          try { w.webContents.send('running-map-changed', payload); } catch {}
        }
      } catch {}
    }
  }, intervalMs).unref();
}

app.whenReady().then(async () => {
  // 1. Prepare data directories FIRST (sync, fast)
  initializeDataFiles();

  // 2. Register IPC handlers BEFORE creating window
  //    This ensures all handlers are ready before renderer can call them.
  const settingsProvider = () => loadSettings();
  settingsProvider.set = (st) => { try { saveSettings(st); } catch {} };
  const restServer = createRestServer({ settingsProvider, broadcaster: () => {} });
  const handlers = { ...require('./controllers/profiles'), ...require('./storage/profiles') };
  registerIpcHandlers({ restServer, handlers });

  // 3. NOW create window — IPC is guaranteed ready
  const mainWindow = createWindow();
  setMainWindowRef(mainWindow);
  setCamoufoxWindowRef(mainWindow);

  // 4. Update broadcaster to use actual window (non-blocking)
  const broadcaster = (state) => { try { mainWindow.webContents.send('api-server-status', state); } catch {} };
  restServer.setBroadcaster?.(broadcaster);

  // 5. Start REST API server in background (don't block window)
  restServer.start(handlers).catch(e => appendLog('system', `REST start error: ${e?.message || e}`));

  // 6. Background tasks
  startBackgroundHeartbeat();
  try { startAutomationScheduler(); } catch (e) { appendLog('system', `Automation scheduler failed to start: ${e?.message || e}`); }

  // 7. Signal renderer that backend is fully ready
  mainWindow.webContents.on('did-finish-load', () => {
    try { mainWindow.webContents.send('backend-ready', true); } catch {}
  });
});

// Graceful shutdown (dev convenience)
process.on('SIGTERM', () => { try { app.quit(); } catch {} });
