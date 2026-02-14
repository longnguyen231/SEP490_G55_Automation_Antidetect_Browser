const path = require('path');
const fs = require('fs');
const { app } = require('electron');

let __dataRoot = null;

function getDataRoot() {
  if (__dataRoot) return __dataRoot;
  try {
    const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
    // In dev, store runtime data under Electron userData instead of repo tree to prevent dev watchers (electronmon) from restarting on JSON writes.
    const base = isDev
      ? path.join(app.getPath('userData'), 'dev-data')
      : path.join(path.dirname(app.getPath('exe')), 'data');
    fs.mkdirSync(base, { recursive: true });
    __dataRoot = base;
    return __dataRoot;
  } catch (e) {
    try {
      const fb = path.join(app.getPath('userData'), 'data');
      fs.mkdirSync(fb, { recursive: true });
      __dataRoot = fb;
      return __dataRoot;
    } catch {}
  }
  __dataRoot = app.getPath('userData');
  return __dataRoot;
}

function ensureDir(p) {
  try { fs.mkdirSync(p, { recursive: true }); } catch {}
}

function storageStatePath(profileId) {
  const dir = path.join(getDataRoot(), 'profiles');
  ensureDir(dir);
  return path.join(dir, `${profileId}-storage.json`);
}

function logPath(profileId) {
  const dir = path.join(getDataRoot(), 'logs');
  ensureDir(dir);
  return path.join(dir, `${profileId}.log`);
}

function profilesFilePath() {
  return path.join(getDataRoot(), 'profiles.json');
}

function settingsFilePath() {
  return path.join(getDataRoot(), 'settings.json');
}

function presetsFilePath() {
  return path.join(getDataRoot(), 'presets.json');
}

function scriptsFilePath() {
  return path.join(getDataRoot(), 'scripts.json');
}

function initializeDataFiles() {
  // migrate legacy files from userData to data root (one-time)
  try {
    const legacyProfiles = path.join(app.getPath('userData'), 'profiles.json');
    const legacySettings = path.join(app.getPath('userData'), 'settings.json');
    const newProfiles = profilesFilePath();
    const newSettings = settingsFilePath();
    if (!fs.existsSync(newProfiles) && fs.existsSync(legacyProfiles)) {
      try { fs.copyFileSync(legacyProfiles, newProfiles); } catch {}
    }
    if (!fs.existsSync(newSettings) && fs.existsSync(legacySettings)) {
      try { fs.copyFileSync(legacySettings, newSettings); } catch {}
    }
    if (!fs.existsSync(newProfiles)) {
      try { fs.mkdirSync(path.dirname(newProfiles), { recursive: true }); } catch {}
      fs.writeFileSync(newProfiles, JSON.stringify([]));
    }
    return { profilesPath: newProfiles };
  } catch (e) {
    const p = profilesFilePath();
    if (!fs.existsSync(p)) {
      try { fs.mkdirSync(path.dirname(p), { recursive: true }); } catch {}
      fs.writeFileSync(p, JSON.stringify([]));
    }
    return { profilesPath: p };
  }
}

module.exports = {
  getDataRoot,
  ensureDir,
  storageStatePath,
  logPath,
  profilesFilePath,
  settingsFilePath,
  presetsFilePath,
  scriptsFilePath,
  initializeDataFiles,
};
