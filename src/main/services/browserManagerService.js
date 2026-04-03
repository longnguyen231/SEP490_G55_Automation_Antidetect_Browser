const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

let mainWindowRef = null;

function setMainWindowRef(win) {
    mainWindowRef = win;
}

function getBrowsersPath() {
    // Must use rebrowser-playwright (aliased as 'playwright') — NOT standard playwright-core.
    // rebrowser-playwright installs chromium revision 1169 (Chrome 136), while
    // standard playwright-core@1.58.2 targets revision 1194 (Chrome 141) — different paths.
    try {
        const { chromium } = require('playwright');
        const exePath = chromium.executablePath();
        return path.dirname(path.dirname(path.dirname(exePath)));
    } catch {
        const localAppData = process.env.LOCALAPPDATA || path.join(require('os').homedir(), 'AppData', 'Local');
        return path.join(localAppData, 'ms-playwright');
    }
}

function getExecutableConfig() {
    return {
        chromium: process.platform === 'win32' ? 'chrome.exe' : (process.platform === 'darwin' ? 'Chromium.app/Contents/MacOS/Chromium' : 'chrome'),
        firefox: process.platform === 'win32' ? 'firefox.exe' : (process.platform === 'darwin' ? 'Firefox.app/Contents/MacOS/firefox' : 'firefox')
    };
}

/**
 * Returns: { status: 'installed' | 'missing' | 'broken', path: string | null, version: string | null, size: string | null }
 */
function checkBrowserStatus(browserName) {
    try {
        // Use rebrowser-playwright (aliased as 'playwright') — must match the engine used for launching.
        const pw = require('playwright');
        const engine = browserName === 'firefox' ? pw.firefox : pw.chromium;
        const exePath = engine.executablePath();
        const exists = fs.existsSync(exePath);

        // Extract version from folder name (e.g. chromium-1194 or firefox-1495)
        const parts = exePath.split(path.sep);
        const folderPart = parts.find(p => p.startsWith(browserName + '-'));
        const versionMatch = folderPart ? (folderPart.split('-')[1] || 'unknown') : 'unknown';

        let sizeStr = '0 MB';
        if (exists) {
            try {
                // Go up 2 levels from exe to get browser folder (e.g. firefox-1495)
                const browserDir = path.dirname(path.dirname(exePath));
                const sizeBytes = getFolderSize(browserDir);
                sizeStr = (sizeBytes / (1024 * 1024)).toFixed(2) + ' MB';
            } catch {}
        }

        return {
            status: exists ? 'installed' : 'missing',
            path: exists ? exePath : null,
            version: exists ? versionMatch : null,
            size: exists ? sizeStr : '0 MB',
            isInstalling: activeInstalls.has(browserName),
            lastLog: lastLogs[browserName] || ''
        };

    } catch (error) {
        console.error('Error checking browser status:', error);
        return { status: 'broken', path: null, version: null, size: null, isInstalling: activeInstalls.has(browserName) };
    }
}

function getFolderSize(dirPath) {
    let totalSize = 0;
    const files = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const file of files) {
        const fullPath = path.join(dirPath, file.name);
        if (file.isDirectory()) {
            totalSize += getFolderSize(fullPath);
        } else {
            totalSize += fs.statSync(fullPath).size;
        }
    }
    return totalSize;
}

// Global active installs to avoid overlaps
const activeInstalls = new Set();
const lastLogs = { chromium: '', firefox: '' };

async function installBrowser(browserName) {
    if (activeInstalls.has(browserName)) {
        return { success: false, error: `${browserName} is already installing.` };
    }
    
    activeInstalls.add(browserName);

    return new Promise((resolve) => {
        try {
            // Do NOT set PLAYWRIGHT_BROWSERS_PATH — let Playwright install to its default location
            // (C:\Users\...\AppData\Local\ms-playwright) which is the same place it looks when launching.
            // Do NOT set PLAYWRIGHT_DOWNLOAD_HOST — Playwright v1.58+ uses cdn.playwright.dev with
            // a new URL format (cft/ builds) that third-party mirrors don't support.
            const env = Object.assign({}, process.env, {
                ELECTRON_RUN_AS_NODE: '1',
            });

            // Resolve playwright CLI
            const pwCorePath = require.resolve('playwright-core');
            const playwrightCliPath = path.join(path.dirname(pwCorePath), 'cli.js');

            const child = spawn(process.execPath, [playwrightCliPath, 'install', browserName], {
                env,
                stdio: ['ignore', 'pipe', 'pipe']
            });

            let combinedOutput = '';

            const parseProgress = (data) => {
                const text = data.toString();
                combinedOutput += text;
                const lastLine = text.trim().split('\n').pop() || '';
                lastLogs[browserName] = lastLine;

                // Parse percent from Playwright CLI output formats:
                // "136.8 Mb [====================] 100% 0.0s"
                // "XX.X Mb / YYY.Y Mb" → calculate percent from sizes
                let percent = null;
                const pctMatch = lastLine.match(/(\d+)%/);
                if (pctMatch) {
                    percent = Math.min(100, Math.max(0, parseInt(pctMatch[1], 10)));
                } else {
                    const mbMatch = lastLine.match(/([\d.]+)\s*Mb\s*\/\s*([\d.]+)\s*Mb/i);
                    if (mbMatch) {
                        const done = parseFloat(mbMatch[1]);
                        const total = parseFloat(mbMatch[2]);
                        if (total > 0) percent = Math.min(100, Math.round((done / total) * 100));
                    }
                }

                if (mainWindowRef && !mainWindowRef.isDestroyed()) {
                    mainWindowRef.webContents.send('browser-runtime-progress', {
                        browserName,
                        log: lastLine,
                        percent,
                    });
                }
            };

            child.stdout.on('data', parseProgress);
            child.stderr.on('data', parseProgress);

            child.on('close', (code) => {
                activeInstalls.delete(browserName);
                if (code === 0) {
                    resolve({ success: true });
                } else {
                    resolve({ success: false, error: `Process exited with code ${code}. Log: ${combinedOutput.substring(0, 500)}` });
                }
            });

            child.on('error', (err) => {
                activeInstalls.delete(browserName);
                resolve({ success: false, error: err.message });
            });

        } catch (error) {
            activeInstalls.delete(browserName);
            resolve({ success: false, error: error.message });
        }
    });
}

async function uninstallBrowser(browserName) {
    try {
        const browsersPath = getBrowsersPath();
        if (!fs.existsSync(browsersPath)) return { success: true };

        const folders = fs.readdirSync(browsersPath, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory() && dirent.name.startsWith(browserName + '-'));

        if (folders.length === 0) return { success: true };

        const errors = [];
        for (const f of folders) {
            const targetPath = path.join(browsersPath, f.name);
            let deleted = false;

            // On Windows: try PowerShell which spawns a separate process (bypasses EBUSY from Electron)
            if (process.platform === 'win32') {
                try {
                    await new Promise((res, rej) => {
                        const ps = spawn('powershell.exe', [
                            '-NoProfile', '-NonInteractive', '-Command',
                            `Remove-Item -LiteralPath '${targetPath.replace(/'/g, "''")}' -Recurse -Force -ErrorAction Stop`
                        ], { stdio: 'pipe' });
                        ps.once('close', code => code === 0 ? res() : rej(new Error(`PS exit ${code}`)));
                        ps.once('error', rej);
                    });
                    deleted = true;
                } catch (psErr) {
                    // Fallback to fs.rmSync with retry
                }
            }

            if (!deleted) {
                // Retry up to 5x with 1s delay
                for (let attempt = 1; attempt <= 5; attempt++) {
                    try {
                        fs.rmSync(targetPath, { recursive: true, force: true });
                        deleted = true;
                        break;
                    } catch (err) {
                        const isLocked = err.code === 'EBUSY' || err.code === 'EPERM' || err.code === 'EACCES';
                        if (isLocked && attempt < 5) {
                            await new Promise(r => setTimeout(r, 1000));
                        } else {
                            errors.push(err.message);
                            break;
                        }
                    }
                }
            }
        }

        if (errors.length > 0) {
            return {
                success: false,
                error: `Could not delete (file locked by system).\nTip: Stop all running profiles, then retry.\nDetails: ${errors[0]}`
            };
        }
        return { success: true };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

async function reinstallBrowser(browserName) {
    const un = await uninstallBrowser(browserName);
    if (!un.success) return un;
    return await installBrowser(browserName);
}

module.exports = {
    setMainWindowRef,
    checkBrowserStatus,
    installBrowser,
    uninstallBrowser,
    reinstallBrowser,
    getBrowsersPath
};
