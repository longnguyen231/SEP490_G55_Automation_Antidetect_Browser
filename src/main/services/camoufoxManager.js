/**
 * camoufoxManager.js
 * Handles download, install, uninstall and executable resolution for Camoufox.
 * Camoufox is a patched Firefox fork with built-in fingerprint spoofing.
 * Releases: https://github.com/daijro/camoufox/releases
 */

const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const { spawn } = require('child_process');

let mainWindowRef = null;
function setMainWindowRef(win) { mainWindowRef = win; }

function getCamoufoxDir() {
    const { getDataRoot } = require('../storage/paths');
    return path.join(getDataRoot(), 'camoufox');
}

function findCamoufoxExecutable(dir) {
    const candidates = process.platform === 'win32'
        ? ['camoufox.exe', 'firefox.exe']
        : process.platform === 'darwin'
        ? ['Camoufox.app/Contents/MacOS/camoufox', 'Firefox.app/Contents/MacOS/firefox', 'camoufox', 'firefox']
        : ['camoufox', 'firefox'];

    function searchDir(searchPath, depth) {
        if (depth > 4) return null;
        try {
            const entries = fs.readdirSync(searchPath, { withFileTypes: true });
            for (const candidate of candidates) {
                const full = path.join(searchPath, candidate);
                if (fs.existsSync(full)) return full;
            }
            for (const entry of entries) {
                if (entry.isDirectory()) {
                    const found = searchDir(path.join(searchPath, entry.name), depth + 1);
                    if (found) return found;
                }
            }
        } catch {}
        return null;
    }
    return searchDir(dir, 0);
}

function getCamoufoxExecutable() {
    return findCamoufoxExecutable(getCamoufoxDir());
}

function sendLog(log, percent = null) {
    if (mainWindowRef && !mainWindowRef.isDestroyed()) {
        mainWindowRef.webContents.send('browser-runtime-progress', {
            browserName: 'camoufox', log, percent
        });
    }
}

function httpsGet(url) {
    return new Promise((resolve, reject) => {
        const follow = (redirectUrl) => {
            const mod = redirectUrl.startsWith('https') ? https : http;
            mod.get(redirectUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
                if ([301, 302, 307].includes(res.statusCode)) return follow(res.headers.location);
                if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
                let data = '';
                res.on('data', c => { data += c; });
                res.on('end', () => resolve(data));
                res.on('error', reject);
            }).on('error', reject);
        };
        follow(url);
    });
}

function downloadFile(url, destPath, onProgress) {
    return new Promise((resolve, reject) => {
        const follow = (redirectUrl) => {
            const mod = redirectUrl.startsWith('https') ? https : http;
            mod.get(redirectUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
                if ([301, 302, 307].includes(res.statusCode)) return follow(res.headers.location);
                if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
                const total = parseInt(res.headers['content-length'] || '0', 10);
                let done = 0;
                let startTime = Date.now();
                let lastReport = 0;
                const file = fs.createWriteStream(destPath);
                res.on('data', chunk => {
                    done += chunk.length;
                    const now = Date.now();
                    if (total > 0 && onProgress && (now - lastReport > 300)) {
                        lastReport = now;
                        const pct = Math.round((done / total) * 100);
                        const elapsed = (now - startTime) / 1000;
                        const speedMBps = elapsed > 0 ? (done / elapsed / (1024 * 1024)) : 0;
                        const remaining = speedMBps > 0 ? ((total - done) / (1024 * 1024)) / speedMBps : 0;
                        const doneMB = (done / (1024 * 1024)).toFixed(1);
                        const totalMB = (total / (1024 * 1024)).toFixed(1);
                        const etaStr = remaining > 0 ? ` — ETA ${Math.ceil(remaining)}s` : '';
                        onProgress(pct, `Downloading... ${doneMB}/${totalMB} MB  ${speedMBps.toFixed(1)} MB/s${etaStr}`);
                    }
                });
                res.pipe(file);
                file.once('finish', () => { file.close(); resolve(); });
                file.once('error', reject);
                res.once('error', reject);
            }).on('error', reject);
        };
        follow(url);
    });
}

function extractZip(zipPath, destDir) {
    return new Promise((resolve, reject) => {
        if (process.platform === 'win32') {
            const ps = spawn('powershell.exe', [
                '-NoProfile', '-NonInteractive', '-Command',
                `Expand-Archive -LiteralPath '${zipPath.replace(/'/g, "''")}' -DestinationPath '${destDir.replace(/'/g, "''")}' -Force`
            ], { stdio: 'pipe' });
            let stderr = '';
            ps.stderr.on('data', d => { stderr += d.toString(); });
            ps.once('close', code => code === 0 ? resolve() : reject(new Error(`Extract failed (code ${code}): ${stderr.slice(0, 200)}`)));
            ps.once('error', reject);
        } else {
            const proc = spawn('unzip', ['-o', zipPath, '-d', destDir], { stdio: 'pipe' });
            proc.once('close', code => code === 0 ? resolve() : reject(new Error(`unzip failed code ${code}`)));
            proc.once('error', reject);
        }
    });
}

async function fetchLatestRelease() {
    const raw = await httpsGet('https://api.github.com/repos/daijro/camoufox/releases/latest');
    const release = JSON.parse(raw);

    const platform = process.platform === 'win32' ? 'win'
        : process.platform === 'darwin' ? 'mac' : 'lin';
    const arch = process.arch === 'arm64' ? 'arm64'
        : process.arch === 'ia32' ? 'i686' : 'x86_64';

    // Try exact platform+arch match first, then fallback to just platform
    const zipAssets = release.assets.filter(a => a.name.toLowerCase().includes(platform) && a.name.endsWith('.zip'));
    const asset = zipAssets.find(a => a.name.toLowerCase().includes(arch)) || zipAssets[0];

    if (!asset) {
        throw new Error(`No Camoufox asset for ${process.platform}/${process.arch}. Available: ${release.assets.map(a => a.name).join(', ')}`);
    }
    return { version: release.tag_name, downloadUrl: asset.browser_download_url, assetName: asset.name };
}

const activeInstall = { running: false };

async function checkStatus() {
    const dir = getCamoufoxDir();
    const exe = findCamoufoxExecutable(dir);
    let sizeStr = '0 MB';
    let version = null;
    if (exe) {
        try {
            const getFolderSize = require('./browserManagerService').getFolderSize ||
                async function(d) {
                    let total = 0;
                    const entries = await fs.promises.readdir(d, { withFileTypes: true });
                    await Promise.all(entries.map(async e => {
                        try {
                            const fp = path.join(d, e.name);
                            if (e.isDirectory()) total += await getFolderSize(fp);
                            else total += (await fs.promises.stat(fp)).size;
                        } catch {}
                    }));
                    return total;
                };
            // simple size check
            const sizeBytes = await dirSize(dir);
            sizeStr = (sizeBytes / (1024 * 1024)).toFixed(2) + ' MB';
        } catch {}
        try {
            const vf = path.join(dir, 'VERSION');
            if (fs.existsSync(vf)) version = fs.readFileSync(vf, 'utf8').trim();
        } catch {}
    }
    return {
        status: exe ? 'installed' : 'missing',
        path: exe || null,
        version: version || null,
        size: exe ? sizeStr : '0 MB',
        isInstalling: activeInstall.running,
        lastLog: ''
    };
}

async function dirSize(dirPath) {
    let total = 0;
    try {
        const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
        await Promise.all(entries.map(async e => {
            try {
                const fp = path.join(dirPath, e.name);
                if (e.isDirectory()) total += await dirSize(fp);
                else total += (await fs.promises.stat(fp)).size;
            } catch {}
        }));
    } catch {}
    return total;
}

async function install() {
    if (activeInstall.running) return { success: false, error: 'Camoufox is already installing.' };
    activeInstall.running = true;

    const dir = getCamoufoxDir();
    const tmpZip = path.join(dir, '_camoufox_dl.zip');

    try {
        fs.mkdirSync(dir, { recursive: true });
        // Remove leftover temp zip from any previous failed attempt
        try { fs.unlinkSync(tmpZip); } catch {}
        sendLog('Fetching latest Camoufox release...', null);

        const { version, downloadUrl, assetName } = await fetchLatestRelease();
        sendLog(`Downloading ${assetName} (${version})...`, 0);

        await downloadFile(downloadUrl, tmpZip, (pct, logMsg) => {
            sendLog(logMsg || `Downloading ${assetName}... ${pct}%`, pct);
        });

        sendLog('Extracting...', null);
        await extractZip(tmpZip, dir);

        try { fs.unlinkSync(tmpZip); } catch {}
        fs.writeFileSync(path.join(dir, 'VERSION'), version, 'utf8');

        sendLog('Camoufox installed!', 100);
        activeInstall.running = false;
        return { success: true };
    } catch (e) {
        activeInstall.running = false;
        try { fs.unlinkSync(tmpZip); } catch {}
        sendLog(`Install failed: ${e.message}`, null);
        return { success: false, error: e.message };
    }
}

async function uninstall() {
    const dir = getCamoufoxDir();
    if (!fs.existsSync(dir)) return { success: true };
    try {
        if (process.platform === 'win32') {
            await new Promise((res, rej) => {
                const ps = spawn('powershell.exe', [
                    '-NoProfile', '-NonInteractive', '-Command',
                    `Remove-Item -LiteralPath '${dir.replace(/'/g, "''")}' -Recurse -Force -ErrorAction Stop`
                ], { stdio: 'pipe' });
                ps.once('close', code => code === 0 ? res() : rej(new Error(`PS exit ${code}`)));
                ps.once('error', rej);
            });
        } else {
            fs.rmSync(dir, { recursive: true, force: true });
        }
        return { success: true };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

module.exports = {
    setMainWindowRef,
    getCamoufoxDir,
    getCamoufoxExecutable,
    checkStatus,
    install,
    uninstall,
};
