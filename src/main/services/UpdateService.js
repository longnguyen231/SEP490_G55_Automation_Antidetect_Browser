/**
 * UpdateService — kiểm tra và tải bản cập nhật từ web-admin backend.
 *
 * Flow:
 *   1. checkForUpdate()       → hỏi /api/releases/latest, so sánh semver
 *   2. downloadAndInstall()   → tải file .exe về temp, chạy installer, quit app
 */
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// URL của web-admin backend — override qua env var khi deploy production
const UPDATE_SERVER_URL = (process.env.UPDATE_SERVER_URL || 'http://localhost:3001').replace(/\/$/, '');

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

function httpGet(url, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? require('https') : require('http');
    const req = client.get(url, { timeout: timeoutMs }, (res) => {
      // Follow redirects
      if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307) {
        const location = res.headers.location;
        if (!location) return reject(new Error('Redirect with no location'));
        res.resume();
        return httpGet(location, timeoutMs).then(resolve).catch(reject);
      }
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { data += c; });
      res.on('end', () => resolve({ statusCode: res.statusCode, body: data }));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')); });
  });
}

function broadcastToWindows(channel, payload) {
  try {
    for (const win of BrowserWindow.getAllWindows()) {
      try { win.webContents.send(channel, payload); } catch {}
    }
  } catch {}
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Kiểm tra bản cập nhật mới.
 * @returns {{ hasUpdate: boolean, release?: object, currentVersion: string }}
 */
async function checkForUpdate() {
  const currentVersion = app.getVersion();
  try {
    const { statusCode, body } = await httpGet(
      `${UPDATE_SERVER_URL}/api/releases/latest?platform=windows`,
      10000,
    );
    if (statusCode !== 200) return { hasUpdate: false, currentVersion };
    const release = JSON.parse(body);
    if (!release?.version) return { hasUpdate: false, currentVersion };
    const hasUpdate = isNewer(release.version, currentVersion);
    return { hasUpdate, currentVersion, release: hasUpdate ? release : undefined };
  } catch (err) {
    console.warn('[UpdateService] checkForUpdate error:', err?.message);
    return { hasUpdate: false, currentVersion };
  }
}

/**
 * Tải installer về thư mục temp, chạy và quit app.
 * Gửi sự kiện 'update-progress' (0–1) về renderer trong quá trình tải.
 * @param {object} release — release metadata từ /api/releases/latest
 */
async function downloadAndInstall(release) {
  const rawUrl = release.downloadUrl.startsWith('http')
    ? release.downloadUrl
    : `${UPDATE_SERVER_URL}${release.downloadUrl}`;

  const fileName = release.fileName || `HL-MCK-Update-${release.version}.exe`;
  const destPath = path.join(app.getPath('temp'), fileName);

  broadcastToWindows('update-progress', { phase: 'downloading', progress: 0 });

  // ── Download ──────────────────────────────────────────────────────────────
  await new Promise((resolve, reject) => {
    function doDownload(url, redirectCount = 0) {
      if (redirectCount > 5) return reject(new Error('Too many redirects'));
      const client = url.startsWith('https') ? require('https') : require('http');
      client.get(url, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307) {
          res.resume();
          return doDownload(res.headers.location || url, redirectCount + 1);
        }
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));

        const total = parseInt(res.headers['content-length'] || '0', 10);
        let received = 0;
        const file = fs.createWriteStream(destPath);

        res.on('data', (chunk) => {
          received += chunk.length;
          if (total > 0) {
            broadcastToWindows('update-progress', {
              phase: 'downloading',
              progress: received / total,
            });
          }
        });
        res.pipe(file);
        file.on('finish', () => {
          file.close();
          broadcastToWindows('update-progress', { phase: 'downloaded', progress: 1 });
          resolve();
        });
        file.on('error', (e) => { fs.unlink(destPath, () => {}); reject(e); });
        res.on('error', reject);
      }).on('error', reject);
    }
    doDownload(rawUrl);
  });

  // ── Chạy installer rồi quit ───────────────────────────────────────────────
  broadcastToWindows('update-progress', { phase: 'installing', progress: 1 });
  spawn(destPath, ['/S'], { detached: true, stdio: 'ignore' }).unref();
  setTimeout(() => app.quit(), 500);
}

module.exports = { checkForUpdate, downloadAndInstall };
