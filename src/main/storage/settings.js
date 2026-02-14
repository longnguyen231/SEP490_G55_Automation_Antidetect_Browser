const fs = require('fs');
const path = require('path');
const { settingsFilePath } = require('./paths');

function loadSettings() {
  try {
    if (fs.existsSync(settingsFilePath())) {
      return JSON.parse(fs.readFileSync(settingsFilePath(), 'utf8')) || {};
    }
  } catch {}
  return {};
}

function saveSettings(newSettings) {
  try {
    const p = settingsFilePath();
    try { fs.mkdirSync(path.dirname(p), { recursive: true }); } catch {}
    let current = {};
    if (fs.existsSync(p)) {
      try { current = JSON.parse(fs.readFileSync(p, 'utf8')) || {}; } catch {}
    }
    const merged = { ...current, ...newSettings };
    fs.writeFileSync(p, JSON.stringify(merged, null, 2));
    return true;
  } catch (e) { return false; }
}

// Prioritize vendor portable Chrome before explicit overrides, then system installs.
function resolveChromeExecutable() {
  const envChrome = process.env.CHROME_PATH;
  const envEdge = process.env.EDGE_PATH;
  const settings = loadSettings();
  const cand = [];

  // 1) Packaged portable (extraResources)
  try {
    const resRoot = process.resourcesPath || '';
    if (process.platform === 'win32') {
      // electron-builder extraResources puts entire vendor/chrome-win under resources/chrome
      cand.push(path.join(resRoot, 'chrome', 'App', 'Chrome-bin', 'chrome.exe')); // packaged layout
      cand.push(path.join(resRoot, 'chrome', 'Chrome-bin', 'chrome.exe')); // direct layout fallback
    } else if (process.platform === 'darwin') {
      // On mac, extraResources maps Chromium.app directly under resourcesRoot (see electron-builder config)
      cand.push(path.join(resRoot, 'Chromium.app', 'Contents', 'MacOS', 'Chromium'));
    } else {
      cand.push(path.join(resRoot, 'chrome', 'chrome'));
    }
  } catch {}

  // 2) Development vendor folder (unpackaged)
  try {
    // __dirname is src/main/storage; go up 3 levels to project root then vendor/
    const vendorRoot = path.join(__dirname, '../../../vendor');
    if (process.platform === 'win32') {
      // Common portable structures
      cand.push(path.join(vendorRoot, 'chrome-win', 'App', 'Chrome-bin', 'chrome.exe')); // packaged layout variant
      cand.push(path.join(vendorRoot, 'chrome-win', 'Chrome-bin', 'chrome.exe')); // direct portable
      cand.push(path.join(vendorRoot, 'chrome-win', 'chrome.exe')); // legacy fallback
    } else if (process.platform === 'darwin') {
      cand.push(path.join(vendorRoot, 'chromium-mac', 'Chromium.app', 'Contents', 'MacOS', 'Chromium'));
    } else {
      cand.push(path.join(vendorRoot, 'chrome-linux', 'chrome'));
    }
  } catch {}

  // 3) Explicit overrides (env & settings)
  if (envChrome) cand.push(envChrome);
  if (settings.chromePath) cand.push(settings.chromePath);
  if (envEdge) cand.push(envEdge);
  if (settings.edgePath) cand.push(settings.edgePath);

  // 4) System installed browsers
  if (process.platform === 'win32') {
    const programFiles = process.env['ProgramFiles'] || 'C:/Program Files';
    const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:/Program Files (x86)';
    const localAppData = process.env['LOCALAPPDATA'] || path.join(process.env['USERPROFILE'] || 'C:/Users/Default', 'AppData', 'Local');
    cand.push(
      path.join(programFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(programFilesX86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(localAppData, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(programFiles, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      path.join(programFilesX86, 'Microsoft', 'Edge', 'Application', 'msedge.exe')
    );
  } else if (process.platform === 'darwin') {
    // Common macOS installs
    const appPaths = [
      ['/Applications', 'Google Chrome.app', 'Contents', 'MacOS', 'Google Chrome'],
      ['/Applications', 'Chromium.app', 'Contents', 'MacOS', 'Chromium'],
      ['/Applications', 'Microsoft Edge.app', 'Contents', 'MacOS', 'Microsoft Edge'],
      ['/Applications', 'Google Chrome Canary.app', 'Contents', 'MacOS', 'Google Chrome Canary'],
      [path.join(process.env.HOME || '', 'Applications'), 'Google Chrome.app', 'Contents', 'MacOS', 'Google Chrome'],
      [path.join(process.env.HOME || '', 'Applications'), 'Chromium.app', 'Contents', 'MacOS', 'Chromium'],
      [path.join(process.env.HOME || '', 'Applications'), 'Microsoft Edge.app', 'Contents', 'MacOS', 'Microsoft Edge'],
    ];
    for (const parts of appPaths) {
      try { cand.push(path.join(...parts)); } catch {}
    }
  }

  for (const p of cand) {
    try { if (p && fs.existsSync(p)) return p; } catch {}
  }
  return null;
}

module.exports = { loadSettings, saveSettings, resolveChromeExecutable };
