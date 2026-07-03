// Clean modular Electron main process entrypoint (bootstrap)
const { app } = require('electron');
const { createWindow } = require('./window/mainWindow');
const { initializeDataFiles } = require('./storage/paths');
const { loadSettings, saveSettings } = require('./storage/settings');
const { registerIpcHandlers } = require('./ipc/handlers');
const { createRestServer } = require('./api/restServer');
const { runningProfiles } = require('./state/runtime');
const { appendLog } = require('./logging/logger');
const { startAutomationScheduler } = require('./engine/automation');
const { setMainWindowRef } = require('./services/browserManagerService');
const { setMainWindowRef: setCamoufoxWindowRef } = require('./services/camoufoxManager');

// ── Deep Link: hlmck://launch/{profileId} ────────────────────────────────────
// Register as default handler for the hlmck:// protocol.
// macOS/Linux use the open-url event; Windows uses second-instance argv.
const PROTOCOL = 'hlmck';
const path = require('path'); // Ensure path is available if not required above

if (app.isPackaged) {
  if (!app.isDefaultProtocolClient(PROTOCOL)) {
    app.setAsDefaultProtocolClient(PROTOCOL);
  }
} else {
  // In development mode, force point electron to the right script to overwrite bad registry cache
  // We use app.getAppPath() because electronmon injects --require into argv[1]
  app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [app.getAppPath()]);
}

function handleDeepLink(url) {
  try {
    if (!url) return;
    appendLog('system', `[deeplink] received: ${url}`);
    const u = new URL(url);
    // hlmck://launch/{profileId}
    if (u.hostname === 'launch') {
      const profileId = u.pathname.replace(/^\//, '');
      if (!profileId) return;
      appendLog('system', `[deeplink] launching profile: ${profileId}`);
      const { BrowserWindow } = require('electron');
      const wins = BrowserWindow.getAllWindows();
      if (wins.length > 0) {
        const win = wins[0];
        if (win.isMinimized()) win.restore();
        win.focus();
        // Tell renderer to launch the profile
        win.webContents.send('deeplink-launch-profile', profileId);
      }
    }
  } catch (e) {
    appendLog('system', `[deeplink] parse error: ${e?.message || e}`);
  }
}

// Windows / Linux: app already running → second-instance event
app.on('second-instance', (_event, argv) => {
  const url = argv.find(a => a.startsWith(`${PROTOCOL}://`));
  if (url) handleDeepLink(url);
});

// macOS: open-url event (both cold-start and when app is already open)
app.on('open-url', (event, url) => {
  event.preventDefault();
  handleDeepLink(url);
});

// Single-instance lock so deep links always go to the existing window
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) { app.quit(); }

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

        // Playwright pipe mode has no WS endpoint — use context/browser state
        const dead = info.context?.isClosed?.() || info.browser?.isConnected?.() === false;
        if (dead) {
          try { info?.forwarder?.stop?.(); } catch {}
          runningProfiles.delete(id);
          appendLog(id, 'Heartbeat: Playwright browser disconnected, removing');
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
  restServer.start(handlers).then(r => {
    if (r?.ok) {
      console.log('[bootstrap] REST API server started OK');
    } else {
      console.error('[bootstrap] REST API server start returned:', r);
    }
  }).catch(e => {
    console.error('[bootstrap] REST API server start error:', e);
    appendLog('system', `REST start error: ${e?.message || e}`);
  });

  // 6. Background tasks
  startBackgroundHeartbeat();
  try { startAutomationScheduler(); } catch (e) { appendLog('system', `Automation scheduler failed to start: ${e?.message || e}`); }

  // 6b. Restore all saved cron jobs from scripts.json
  // Khi app khởi động lại, các script đã đặt schedule trước đó cần được tái kích hoạt cron job
  // Nếu không gọi refreshAllScripts() ở đây thì user phải edit lại từng script để job chạy lại
  try {
    const { refreshAllScripts } = require('./engine/scriptScheduler');
    refreshAllScripts();
    appendLog('system', 'Script scheduler: restored cron jobs from scripts.json');
  } catch (e) {
    appendLog('system', `Script scheduler restore failed: ${e?.message || e}`);
  }

  // Sync license revocation/expiry with web server (non-blocking, graceful if offline)
  const { syncLicenseStatus } = require('./services/machineId');
  syncLicenseStatus().catch(() => {});

  // 7. Signal renderer that backend is fully ready
  mainWindow.webContents.on('did-finish-load', () => {
    try { mainWindow.webContents.send('backend-ready', true); } catch {}
  });

  // 8. Check for updates in background (non-blocking, 10s delay để không làm chậm startup)
  setTimeout(async () => {
    try {
      const { checkForUpdate } = require('./services/UpdateService');
      const result = await checkForUpdate();
      if (result?.hasUpdate && result?.release) {
        appendLog('system', `[Update] New version available: v${result.release.version}`);
        try { mainWindow.webContents.send('update-available', result.release); } catch {}
      }
    } catch (e) {
      appendLog('system', `[Update] Check failed: ${e?.message || e}`);
    }
  }, 10000);
});

// Graceful shutdown (dev convenience)
process.on('SIGTERM', () => { try { app.quit(); } catch {} });
