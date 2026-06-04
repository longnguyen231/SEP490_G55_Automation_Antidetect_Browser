/**
 * UpdateService — auto-update kiểu delta + tự khởi động lại, dùng electron-updater.
 *
 * Cơ chế:
 *   - Generic provider trỏ tới web-admin backend (/api/updates), nơi phục vụ
 *     `latest.yml` + installer `.exe` + `.exe.blockmap`.
 *   - `.blockmap` cho phép electron-updater chỉ tải các block thay đổi (delta);
 *     nếu không khớp/không có sẽ tự fallback sang tải full installer.
 *   - `quitAndInstall(true, true)` tắt app → chạy installer im lặng → TỰ MỞ LẠI app.
 *
 * Giữ nguyên hợp đồng cũ với renderer:
 *   - Trả về { hasUpdate, currentVersion, release }
 *   - Phát sự kiện 'update-progress' { phase, progress }
 */
const { app, BrowserWindow } = require('electron');
const { autoUpdater } = require('electron-updater');

// Feed cập nhật: GitHub Releases (bền, không giới hạn dung lượng, hỗ trợ delta
// qua HTTP Range). Có thể override bằng UPDATE_FEED_URL để trỏ feed generic khác.
const UPDATE_FEED_URL = (process.env.UPDATE_FEED_URL || '').replace(/\/$/, '');
const GH_OWNER = process.env.UPDATE_GH_OWNER || 'XuanKien1';
const GH_REPO = process.env.UPDATE_GH_REPO || 'hlmck-releases';

// ── Cấu hình electron-updater ───────────────────────────────────────────────
autoUpdater.autoDownload = false;          // chỉ tải khi user bấm Cập nhật
autoUpdater.autoInstallOnAppQuit = false;  // tự gọi quitAndInstall thủ công
autoUpdater.allowDowngrade = false;
autoUpdater.disableDifferentialDownload = false; // bật delta (mặc định)
// Logger gọn để không spam console
autoUpdater.logger = {
  info: () => {},
  warn: () => {},
  debug: () => {},
  error: (m) => console.warn('[autoUpdater]', m?.message || m),
};
try {
  if (UPDATE_FEED_URL) {
    autoUpdater.setFeedURL({ provider: 'generic', url: UPDATE_FEED_URL });
  } else {
    autoUpdater.setFeedURL({ provider: 'github', owner: GH_OWNER, repo: GH_REPO });
  }
} catch (e) {
  console.warn('[UpdateService] setFeedURL failed:', e?.message);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseSemver(v) {
  const m = /^v?(\d+)\.(\d+)\.(\d+)/.exec(String(v || '0.0.0'));
  return m ? [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)] : [0, 0, 0];
}

function isNewer(remoteVer, localVer) {
  const [rMaj, rMin, rPat] = parseSemver(remoteVer);
  const [lMaj, lMin, lPat] = parseSemver(localVer);
  if (rMaj !== lMaj) return rMaj > lMaj;
  if (rMin !== lMin) return rMin > lMin;
  return rPat > lPat;
}

function broadcastToWindows(channel, payload) {
  try {
    for (const win of BrowserWindow.getAllWindows()) {
      try { win.webContents.send(channel, payload); } catch {}
    }
  } catch {}
}

// ── Gắn event listener một lần ──────────────────────────────────────────────
let _wired = false;
function wireEvents() {
  if (_wired) return;
  _wired = true;

  autoUpdater.on('download-progress', (p) => {
    broadcastToWindows('update-progress', {
      phase: 'downloading',
      progress: typeof p?.percent === 'number' ? p.percent / 100 : 0,
      transferred: p?.transferred,
      total: p?.total,
      bytesPerSecond: p?.bytesPerSecond,
    });
  });

  autoUpdater.on('update-downloaded', () => {
    broadcastToWindows('update-progress', { phase: 'downloaded', progress: 1 });
  });

  autoUpdater.on('error', (err) => {
    broadcastToWindows('update-progress', {
      phase: 'error',
      error: err?.message || String(err),
    });
  });
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Kiểm tra bản cập nhật mới.
 * @returns {{ hasUpdate: boolean, release?: object, currentVersion: string }}
 */
async function checkForUpdate() {
  const currentVersion = app.getVersion();
  // electron-updater chỉ chạy trong app đã đóng gói (NSIS), không chạy ở dev.
  if (!app.isPackaged) return { hasUpdate: false, currentVersion };

  wireEvents();
  try {
    const result = await autoUpdater.checkForUpdates();
    const info = result?.updateInfo;
    if (!info?.version) return { hasUpdate: false, currentVersion };
    const hasUpdate = isNewer(info.version, currentVersion);
    return {
      hasUpdate,
      currentVersion,
      release: hasUpdate
        ? {
            version: info.version,
            notes: info.releaseNotes || '',
            releaseDate: info.releaseDate || null,
          }
        : undefined,
    };
  } catch (err) {
    console.warn('[UpdateService] checkForUpdate error:', err?.message);
    return { hasUpdate: false, currentVersion };
  }
}

/**
 * Tải bản cập nhật (delta nếu có) rồi tắt app & tự mở lại sau khi cài.
 * Phát sự kiện 'update-progress' { phase, progress } trong quá trình tải.
 */
async function downloadAndInstall() {
  if (!app.isPackaged) throw new Error('Update chỉ khả dụng trong app đã đóng gói');

  wireEvents();
  broadcastToWindows('update-progress', { phase: 'downloading', progress: 0 });

  // Bảo đảm có thông tin update trong bộ nhớ trước khi tải.
  await autoUpdater.checkForUpdates();

  // Tải bản cập nhật — electron-updater tự dùng .blockmap để tải delta,
  // nếu không khớp sẽ fallback sang tải full installer.
  await autoUpdater.downloadUpdate();

  broadcastToWindows('update-progress', { phase: 'installing', progress: 1 });

  // quitAndInstall(isSilent=true, isForceRunAfter=true):
  //   → tắt app, chạy installer im lặng, rồi TỰ MỞ LẠI app khi cài xong.
  setImmediate(() => {
    try {
      autoUpdater.quitAndInstall(true, true);
    } catch (e) {
      broadcastToWindows('update-progress', { phase: 'error', error: e?.message });
    }
  });
}

module.exports = { checkForUpdate, downloadAndInstall };
