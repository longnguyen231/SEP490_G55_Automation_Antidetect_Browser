const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

let mainWindowRef = null;

function setMainWindowRef(win) {
    mainWindowRef = win;
}

function getBrowsersPath() {
    // userData usually is C:\Users\xxx\AppData\Roaming\YourAppName
    const userData = app.getPath('userData');
    return path.join(userData, 'data', '.playwright', 'browsers');
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
        const browsersPath = getBrowsersPath();
        if (!fs.existsSync(browsersPath)) {
            return { status: 'missing', path: null, version: null, size: null, isInstalling: activeInstalls.has(browserName) };
        }

        // Playwright creates folders like "chromium-1092" or "firefox-1438"
        const folders = fs.readdirSync(browsersPath, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory() && dirent.name.startsWith(browserName + '-'));

        if (folders.length === 0) {
            return { status: 'missing', path: null, version: null, size: null, isInstalling: activeInstalls.has(browserName) };
        }

        // Sort by version (latest ID first)
        folders.sort((a, b) => {
            const vA = parseInt(a.name.split('-')[1]) || 0;
            const vB = parseInt(b.name.split('-')[1]) || 0;
            return vB - vA;
        });
        const latestFolder = folders[0].name; // e.g. "chromium-1092"
        const versionMatch = latestFolder.split('-')[1] || 'unknown';

        const browserDir = path.join(browsersPath, latestFolder);
        
        let subFolderName = '';
        if (browserName === 'chromium') {
            subFolderName = 'chrome-win';
            if (process.platform === 'darwin') subFolderName = 'chrome-mac';
            if (process.platform === 'linux') subFolderName = 'chrome-linux';
        } else if (browserName === 'firefox') {
            subFolderName = 'firefox';
        }

        const exactDir = path.join(browserDir, subFolderName);
        const exeConfig = getExecutableConfig()[browserName];
        if (!exeConfig) return { status: 'missing', path: null, version: null, size: null, isInstalling: activeInstalls.has(browserName) };

        const exePath = path.join(exactDir, exeConfig);

        let status = 'broken';
        let sizeStr = '0 MB';

        if (fs.existsSync(exePath)) {
            status = 'installed';
            try {
                // Calculate size of the whole browserDir
                const sizeBytes = getFolderSize(browserDir);
                sizeStr = (sizeBytes / (1024 * 1024)).toFixed(2) + ' MB';
            } catch (e) {
                // Ignore size error
            }
        }

        return {
            status,
            path: exePath,
            version: versionMatch,
            size: sizeStr,
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
            const browsersPath = getBrowsersPath();
            
            // To ensure playwright installs at browsersPath, we set PLAYWRIGHT_BROWSERS_PATH
            const env = Object.assign({}, process.env, {
                PLAYWRIGHT_BROWSERS_PATH: browsersPath,
                ELECTRON_RUN_AS_NODE: '1',
                // Boot tốc độ tải bằng CDN Mirror dành cho Châu Á (tránh nghẽn Azure của nhánh gốc)
                PLAYWRIGHT_DOWNLOAD_HOST: 'https://npmmirror.com/mirrors/playwright/'
            });

            // Resolve playwright CLI (bypass Package exports restriction)
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
                lastLogs[browserName] = text.trim().split('\n').pop(); // Store only the last line
                
                // Playwright CLI outputs bytes like "15.0 Mb / 120.5 Mb" or percentages
                // Or simply emits downloading chunks.
                if (mainWindowRef && !mainWindowRef.isDestroyed()) {
                    mainWindowRef.webContents.send('browser-runtime-progress', {
                        browserName,
                        log: text
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

        for (const f of folders) {
            const targetPath = path.join(browsersPath, f.name);
            fs.rmSync(targetPath, { recursive: true, force: true });
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
