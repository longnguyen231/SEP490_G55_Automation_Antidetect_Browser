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

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

function startBackgroundHeartbeat(intervalMs = 30000) {
  setInterval(async () => {
    let changed = false;
    for (const [id, info] of [...runningProfiles.entries()]) {
      try {
        const ws = info.wsEndpoint;
        const alive = ws ? await isWsAlive(ws) : false;
        if (!alive) {
          try { info?.heartbeat && clearInterval(info.heartbeat); } catch {}
          try { await info?.forwarder?.stop?.(); } catch {}
          runningProfiles.delete(id);
          appendLog(id, 'Heartbeat: stale profile removed');
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
  // Prepare data directories and migrate legacy files
  initializeDataFiles();

  // Create main window
  const mainWindow = createWindow();
  setMainWindowRef(mainWindow);

  // Start REST API server
  const settingsProvider = () => loadSettings();
  settingsProvider.set = (st) => { try { saveSettings(st); } catch {} };
  const broadcaster = (state) => { try { mainWindow.webContents.send('api-server-status', state); } catch {} };
  let swaggerUi = null; try { swaggerUi = require('swagger-ui-express'); } catch {}
  const restServer = createRestServer({ settingsProvider, broadcaster, swaggerUi });
  const handlers = { ...require('./controllers/profiles'), ...require('./storage/profiles') };
  try { await restServer.start(handlers); } catch (e) { appendLog('system', `REST start error: ${e?.message || e}`); }

  // Register IPC handlers (include restServer and handlers for API control)
  registerIpcHandlers({ restServer, handlers });

  // Background pruning of stale running profiles
  startBackgroundHeartbeat();

  // Start automation scheduler (cron-based auto launches)
  try { startAutomationScheduler(); } catch (e) { appendLog('system', `Automation scheduler failed to start: ${e?.message || e}`); }
});

// Graceful shutdown (dev convenience)
process.on('SIGTERM', () => { try { app.quit(); } catch {} });
