const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { profilesFilePath, storageStatePath, getDataRoot } = require('./paths');
const { appendLog } = require('../logging/logger');

// Minimal defaults to prevent wiping nested structures on partial saves
const DEFAULT_FINGERPRINT = {
  os: 'Windows',
  browser: 'Chrome',
  browserVersion: '120.0.0.0',
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  language: 'vi-VN',
  screenResolution: '1920x1080',
  timezone: 'Asia/Ho_Chi_Minh',
  webgl: true,
  canvas: true,
  audio: true,
};

const DEFAULT_SETTINGS = {
  cpuCores: 4,
  memoryGB: 8,
  proxy: { server: '', username: '', password: '' },
  language: 'vi-VN',
  timezone: 'Asia/Ho_Chi_Minh',
  webrtc: 'default',
  geolocation: { enabled: false, latitude: 0, longitude: 0, accuracy: 50 },
  mediaDevices: { audio: true, video: true },
  webgl: true,
  headless: false,
  engine: 'playwright',
  // Explicit default override toggles (default: on)
  applyOverrides: {
    hardware: true,
    navigator: true,
    userAgent: true,
    webgl: true,
    language: true,
    timezone: true,
    viewport: true,
    geolocation: true,
  },
  // CDP init script toggle (default on)
  cdpApplyInitScript: true,
  advanced: {
    platform: 'Win32',
    dnt: false,
    devicePixelRatio: 1,
    maxTouchPoints: 0,
    webglVendor: '',
    webglRenderer: '',
    plugins: 3,
    languages: '',
  },
};

// Automation defaults: simple, explicit opt-in
const DEFAULT_AUTOMATION = {
  enabled: false, // master switch for any automation
  runOnLaunch: false, // execute steps right after profile launches
  steps: [
    // Example steps (kept empty by default)
    // { action: 'navigate', url: 'https://example.com', waitUntil: 'domcontentloaded' },
    // { action: 'wait', ms: 1000 },
    // { action: 'eval', expression: 'document.title' },
    // { action: 'screenshot', fullPage: true },
  ],
  schedule: {
    enabled: false,
    cron: '', // standard cron format, e.g. "*/5 * * * *" (every 5 minutes)
  },
};

function isPlainObject(v) { return v && typeof v === 'object' && !Array.isArray(v); }
function deepMerge(target, source) {
  const out = { ...target };
  for (const k of Object.keys(source || {})) {
    const sv = source[k];
    const tv = out[k];
    if (isPlainObject(tv) && isPlainObject(sv)) out[k] = deepMerge(tv, sv);
    else out[k] = sv;
  }
  return out;
}

function validateProfileInputBasic(p) {
  const errors = [];
  if (!p || typeof p !== 'object') return ['Payload must be object'];
  const name = (p.name || '').trim();
  if (!name) errors.push('Name is required');
  if (name.length > 120) errors.push('Name too long (>120 chars)');
  if (p.startUrl) {
    const normalized = normalizeStartUrl(p.startUrl);
    if (!normalized && p.startUrl.trim()) errors.push('startUrl must be http/https URL');
  }
  const allowedBrowsers = ['Chrome', 'Edge', 'Firefox'];
  if (p.fingerprint && p.fingerprint.browser && !allowedBrowsers.includes(p.fingerprint.browser)) {
    errors.push('Unsupported browser value');
  }
  const engine = p.settings?.engine;
  if (engine && !['playwright','cdp'].includes(engine)) errors.push('settings.engine must be playwright or cdp');
  const cpu = p.settings?.cpuCores; if (cpu != null && (!Number.isInteger(cpu) || cpu < 1 || cpu > 64)) errors.push('cpuCores must be 1-64');
  const mem = p.settings?.memoryGB; if (mem != null && (!Number.isInteger(mem) || mem < 1 || mem > 256)) errors.push('memoryGB must be 1-256');
  return errors;
}

function normalizeProfileInput(input = {}, existing = null) {
  const base = existing || {};
  const name = (input.name != null ? String(input.name) : String(base.name || ''))?.trim();
  const description = input.description != null ? String(input.description) : (base.description || '');
  const startUrl = normalizeStartUrl(input.startUrl || base.startUrl || 'https://www.google.com');
  const fingerprint = deepMerge(DEFAULT_FINGERPRINT, deepMerge(base.fingerprint || {}, input.fingerprint || {}));
  const settings = deepMerge(DEFAULT_SETTINGS, deepMerge(base.settings || {}, input.settings || {}));
  const automation = deepMerge(DEFAULT_AUTOMATION, deepMerge(base.automation || {}, input.automation || {}));
  const active = (input.active != null) ? !!input.active : (base.active != null ? !!base.active : true);
  const id = input.id || base.id; // do not generate here
  return { id, name, description, startUrl, active, fingerprint, settings, automation };
}

function normalizeStartUrl(u) {
  try {
    if (!u || typeof u !== 'string') return '';
    const s = u.trim();
    if (!s) return '';
    const url = new URL(s);
    const ok = url.protocol === 'http:' || url.protocol === 'https:';
    return ok ? url.toString() : '';
  } catch { return ''; }
}

function makeUniqueName(desired, profiles, excludeId) {
  const existing = new Set((profiles || []).filter(p => p.id !== excludeId).map(p => (p.name || '').trim().toLowerCase()));
  let base = (desired || '').trim();
  if (!base) base = 'Profile';
  if (!existing.has(base.toLowerCase())) return base;
  for (let i = 2; i < 10000; i++) {
    const candidate = `${base} (${i})`;
    if (!existing.has(candidate.toLowerCase())) return candidate;
  }
  return base + ' (copy)';
}

function readProfiles() {
  try {
    const raw = fs.readFileSync(profilesFilePath(), 'utf8');
    if (!raw.trim()) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    appendLog('system', `readProfiles fallback (corrupt?): ${e.message}`);
    return [];
  }
}

function writeProfiles(list) {
  try {
    const p = profilesFilePath();
    const lockPath = p + '.lock';
    // Acquire simple lock (best-effort). Remove stale (>20s) lock.
    try {
      if (fs.existsSync(lockPath)) {
        const stat = fs.statSync(lockPath);
        const age = Date.now() - stat.mtimeMs;
        if (age > 20000) { try { fs.unlinkSync(lockPath); } catch {} }
      }
      fs.writeFileSync(lockPath, String(process.pid), { flag: 'wx' });
    } catch (e) {
      // If cannot acquire lock quickly, abort to avoid corruption
      return false;
    }
    try {
      const tmp = p + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(list, null, 2));
      fs.renameSync(tmp, p);
    } finally {
      try { fs.unlinkSync(lockPath); } catch {}
    }
    return true;
  } catch (e) {
    appendLog('system', `writeProfiles error: ${e.message}`);
    return false;
  }
}

async function getProfilesInternal() { return readProfiles(); }

async function saveProfileInternal(profile) {
  try {
    if (!profile || typeof profile !== 'object') {
      return { success: false, error: 'Invalid profile payload' };
    }
    if (!profile.name || !String(profile.name).trim()) {
      return { success: false, error: 'Profile name is required' };
    }
    const profiles = readProfiles();
    // Basic validation first
    const tmpInput = profile.id ? normalizeProfileInput(profile, profiles.find(p=>p.id===profile.id) || null) : normalizeProfileInput(profile, null);
    const validationErrors = validateProfileInputBasic(tmpInput);
    if (validationErrors.length) return { success: false, error: validationErrors[0] };
    const nowIso = new Date().toISOString();
    if (profile.id) {
      const idx = profiles.findIndex(p => p.id === profile.id);
      if (idx !== -1) {
        const merged = normalizeProfileInput(profile, profiles[idx]);
        // Ensure unique name if changed
        if (merged.name && merged.name.trim().toLowerCase() !== (profiles[idx].name||'').trim().toLowerCase()) {
          merged.name = makeUniqueName(merged.name, profiles, profile.id);
        }
        profiles[idx] = { ...profiles[idx], ...merged, updatedAt: nowIso };
      } else {
        const prepared = normalizeProfileInput(profile, null);
        prepared.name = makeUniqueName(prepared.name, profiles, prepared.id);
        profiles.push({ ...prepared, createdAt: nowIso });
      }
    } else {
      let newId = generateShortId();
      // Ensure uniqueness just in case
      const existingIds = new Set((profiles || []).map(p => p.id));
      while (existingIds.has(newId)) newId = generateShortId();
      const prepared = normalizeProfileInput({ ...profile, id: newId }, null);
      prepared.name = makeUniqueName(prepared.name, profiles, prepared.id);
      profiles.push({ ...prepared, createdAt: nowIso });
      profile.id = newId;
    }
    const ok = writeProfiles(profiles);
    if (!ok) return { success: false, error: 'Failed to persist profiles file' };
    appendLog('system', `Saved profile ${profile.id} (${profile.name})`);
    return { success: true, profile: profiles.find(p => p.id === profile.id) };
  } catch (e) {
    appendLog('system', `saveProfileInternal error: ${e.message}`);
    return { success: false, error: e.message };
  }
}

function generateShortId() {
  try {
    // Prefer crypto random for entropy
    const bytes = crypto.randomBytes(6).toString('hex'); // 12 hex chars
    const t = Date.now().toString(36); // timestamp base36
    return (t + bytes.slice(0, 6)).toLowerCase(); // ~ 6+6 = 12 chars
  } catch {
    const t = Date.now().toString(36);
    const r = Math.random().toString(36).slice(2, 8);
    return (t + r).toLowerCase();
  }
}

async function deleteProfileInternal(profileId) {
  try {
    const profiles = readProfiles();
    const filtered = profiles.filter(p => p.id !== profileId);
    const ok = writeProfiles(filtered);
    try {
      const statePath = storageStatePath(profileId);
      if (fs.existsSync(statePath)) fs.unlinkSync(statePath);
    } catch (e) { appendLog(profileId, `Delete cleanup (storageState) failed: ${e.message}`); }
    // Remove CDP user-data directory for this profile
    try {
      const cdpDir = path.join(getDataRoot(), 'cdp-user-data', String(profileId));
      if (fs.existsSync(cdpDir)) {
        fs.rmSync(cdpDir, { recursive: true, force: true });
      }
    } catch (e) { appendLog(profileId, `Delete cleanup (cdp-user-data) failed: ${e.message}`); }
    if (!ok) return { success: false, error: 'Failed to persist profiles file' };
    appendLog('system', `Deleted profile ${profileId}`);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

async function cloneProfileInternal(sourceProfileId, overrides = {}) {
  try {
    const profiles = readProfiles();
    const src = profiles.find(p => p.id === sourceProfileId);
    if (!src) return { success: false, error: 'Source profile not found' };
    let newId = generateShortId();
    const existingIds = new Set((profiles || []).map(p => p.id));
    while (existingIds.has(newId)) newId = generateShortId();
    const cloned = safeDeepClone(src);
    // Reset identifiers and timestamps
    cloned.id = newId;
    cloned.name = overrides.name || `${src.name} (copy)`;
    const nowIso = new Date().toISOString();
    cloned.createdAt = nowIso;
    delete cloned.updatedAt;
    profiles.push(cloned);
    writeProfiles(profiles);
    const srcState = storageStatePath(sourceProfileId);
    const dstState = storageStatePath(newId);
    try { if (fs.existsSync(srcState)) fs.copyFileSync(srcState, dstState); } catch (e) { appendLog(newId, `Failed copy storage state: ${e.message}`); }
    appendLog(newId, `Cloned from ${sourceProfileId}`);
    return { success: true, profile: cloned };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function safeDeepClone(obj) {
  try { return JSON.parse(JSON.stringify(obj)); } catch { return { ...obj }; }
}

module.exports = {
  getProfilesInternal,
  saveProfileInternal,
  deleteProfileInternal,
  cloneProfileInternal,
  readProfiles,
  writeProfiles,
};
