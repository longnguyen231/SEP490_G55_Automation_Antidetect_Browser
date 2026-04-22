const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { app } = require('electron');
const { profilesFilePath, storageStatePath, getDataRoot } = require('./paths');
const { appendLog } = require('../logging/logger');

// Generate a fresh random fingerprint for each new profile
function generateDefaultFingerprint() {
  try {
    const { generateFingerprint } = require('../engine/fingerprintGenerator');
    const result = generateFingerprint();
    return { fingerprint: result.fingerprint, settings: result.settings };
  } catch (e) {
    appendLog('system', `Fingerprint generator fallback: ${e.message}`);
    // Fallback if generator fails
    return { fingerprint: FALLBACK_FINGERPRINT, settings: FALLBACK_SETTINGS };
  }
}

// Static fallback only used if fingerprintGenerator.js fails to load
const FALLBACK_FINGERPRINT = {
  os: 'Windows',
  browser: 'Chrome',
  browserVersion: '136.0.7103.93',
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.7103.93 Safari/537.36',
  language: 'en-US',
  screenResolution: '1920x1080',
  timezone: 'America/New_York',
  webgl: true,
  canvas: true,
  audio: true,
};

const FALLBACK_SETTINGS = {
  cpuCores: 8,
  memoryGB: 16,
  proxy: { server: '', username: '', password: '' },
  language: 'en-US',
  timezone: 'America/New_York',
  webrtc: 'default',
  geolocation: { enabled: false, latitude: 0, longitude: 0, accuracy: 50 },
  mediaDevices: { audio: true, video: true },
  webgl: true,
  headless: false,
  engine: 'playwright',
  network: {
    antiDetection: false,
  },
  applyOverrides: {
    hardware: true,
    navigator: true,
    userAgent: true,
    webgl: true,
    language: true,
    timezone: true,
    viewport: true,
    geolocation: true,
    antiDetection: false,
  },
  cdpApplyInitScript: true,
  advanced: {
    platform: 'Win32',
    dnt: false,
    devicePixelRatio: 1,
    maxTouchPoints: 0,
    webglVendor: 'Google Inc. (NVIDIA)',
    webglRenderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)',
    plugins: 5,
    languages: 'en-US,en',
  },
};

const DEFAULT_SETTINGS = {
  proxy: { server: '', username: '', password: '' },
  webrtc: 'default',
  geolocation: { enabled: false, latitude: 0, longitude: 0, accuracy: 50 },
  mediaDevices: { audio: true, video: true },
  webgl: true,
  headless: false,
  engine: 'playwright',
  network: {
    antiDetection: false,
  },
  applyOverrides: {
    hardware: true,
    navigator: true,
    userAgent: true,
    webgl: true,
    language: true,
    timezone: true,
    viewport: true,
    geolocation: true,
    antiDetection: false,
  },
  cdpApplyInitScript: true,
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
  if (engine && !['playwright','playwright-firefox','cdp','auto'].includes(engine)) errors.push('settings.engine must be playwright, playwright-firefox, cdp, or auto');
  const cpu = p.settings?.cpuCores; if (cpu != null && (!Number.isInteger(cpu) || cpu < 1 || cpu > 64)) errors.push('cpuCores must be 1-64');
  const mem = p.settings?.memoryGB; if (mem != null && (!Number.isInteger(mem) || mem < 1 || mem > 256)) errors.push('memoryGB must be 1-256');
  return errors;
}

function normalizeProfileInput(input = {}, existing = null) {
  const base = existing || {};
  const isNewProfile = !existing || !existing.id;
  
  let fallbackFp = FALLBACK_FINGERPRINT;
  let fallbackSettings = DEFAULT_SETTINGS;

  // Generate a random fingerprint for completely new profiles if not explicitly provided
  if (isNewProfile && (!input.fingerprint || Object.keys(input.fingerprint).length === 0)) {
    const generated = generateDefaultFingerprint();
    fallbackFp = generated.fingerprint || FALLBACK_FINGERPRINT;
    fallbackSettings = generated.settings || FALLBACK_SETTINGS;
  }

  const name = (input.name != null ? String(input.name) : String(base.name || ''))?.trim();
  const description = input.description != null ? String(input.description) : (base.description || '');
  const startUrl = normalizeStartUrl(input.startUrl || base.startUrl || 'https://www.google.com');
  const fingerprint = deepMerge(fallbackFp, deepMerge(base.fingerprint || {}, input.fingerprint || {}));
  const settings = deepMerge(fallbackSettings, deepMerge(base.settings || {}, input.settings || {}));
  if (!settings.engine || settings.engine === 'auto') {
    const { resolveChromeExecutable } = require('./settings');
    if (resolveChromeExecutable && resolveChromeExecutable()) {
      settings.engine = 'cdp';
    } else {
      settings.engine = 'playwright';
    }
  }
  const automation = deepMerge(DEFAULT_AUTOMATION, deepMerge(base.automation || {}, input.automation || {}));
  const active = (input.active != null) ? !!input.active : (base.active != null ? !!base.active : true);
  const id = input.id || base.id;
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

// In-process mutex — serializes all profile writes without blocking the event loop.
// Much faster than file locking: no disk I/O for the lock itself.
let _writeLockPromise = Promise.resolve();

function withWriteLock(fn) {
  // Chain onto the existing lock promise so writes queue up without spinning
  _writeLockPromise = _writeLockPromise.then(() => fn()).catch(() => {});
  return _writeLockPromise;
}

function writeProfiles(list) {
  // Fire-and-forget async write; returns immediately so callers don't block
  withWriteLock(async () => {
    try {
      const p = profilesFilePath();
      const tmp = p + '.tmp';
      await fs.promises.writeFile(tmp, JSON.stringify(list, null, 2));
      await fs.promises.rename(tmp, p);
    } catch (e) {
      appendLog('system', `writeProfiles error: ${e.message}`);
    }
  });
  return true;
}

/**
 * Atomically update settings fields of a single profile.
 * Queued behind in-process mutex — no blocking, no busy-wait.
 */
async function updateProfileSettings(profileId, settingsPatch) {
  return withWriteLock(async () => {
    try {
      const p = profilesFilePath();
      const raw = await fs.promises.readFile(p, 'utf8').catch(() => '[]');
      let list; try { list = JSON.parse(raw); } catch { list = []; }
      if (!Array.isArray(list)) list = [];
      const idx = list.findIndex(pr => pr.id === profileId);
      if (idx === -1) return false;
      list[idx] = { ...list[idx], settings: { ...(list[idx].settings || {}), ...settingsPatch } };
      const tmp = p + '.tmp';
      await fs.promises.writeFile(tmp, JSON.stringify(list, null, 2));
      await fs.promises.rename(tmp, p);
      return true;
    } catch (e) {
      appendLog('system', `updateProfileSettings error: ${e.message}`);
      return false;
    }
  });
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

// Helper: Check if license is activated
function isLicenseActivated() {
  try {
    const licensePath = path.join(app.getPath('userData'), 'license.json');
    if (!fs.existsSync(licensePath)) return false;
    const licenseData = JSON.parse(fs.readFileSync(licensePath, 'utf8'));
    return licenseData && licenseData.activated === true;
  } catch {
    return false;
  }
}

/**
 * Bulk create/update multiple profiles in a single file write.
 */
async function saveProfilesBulkInternal(inputProfiles) {
  try {
    if (!Array.isArray(inputProfiles) || inputProfiles.length === 0) {
      return { success: false, error: 'Payload must be a non-empty array of profiles' };
    }
    const maxBatch = 100;
    if (inputProfiles.length > maxBatch) {
      return { success: false, error: `Maximum ${maxBatch} profiles per batch` };
    }

    const profiles = readProfiles();
    const nowIso = new Date().toISOString();
    const created = [];
    const errors = [];
    const licensed = isLicenseActivated();

    for (let i = 0; i < inputProfiles.length; i++) {
      const input = inputProfiles[i];
      if (!input || typeof input !== 'object') {
        errors.push({ index: i, error: 'Invalid profile payload' });
        continue;
      }
      if (!input.name || !String(input.name).trim()) {
        errors.push({ index: i, error: 'Profile name is required' });
        continue;
      }
      const isUpdate = !!input.id && profiles.some(p => p.id === input.id);
      if (!isUpdate && !licensed && profiles.length >= 5) {
        errors.push({ index: i, error: 'Free plan giới hạn tối đa 5 profiles. Vui lòng kích hoạt license.' });
        continue;
      }
      const validationErrors = validateProfileInputBasic(
        isUpdate ? normalizeProfileInput(input, profiles.find(p => p.id === input.id)) : normalizeProfileInput(input, null)
      );
      if (validationErrors.length) {
        errors.push({ index: i, error: validationErrors[0] });
        continue;
      }

      if (isUpdate) {
        const idx = profiles.findIndex(p => p.id === input.id);
        const merged = normalizeProfileInput(input, profiles[idx]);
        if (merged.name && merged.name.trim().toLowerCase() !== (profiles[idx].name || '').trim().toLowerCase()) {
          merged.name = makeUniqueName(merged.name, profiles, input.id);
        }
        profiles[idx] = { ...profiles[idx], ...merged, updatedAt: nowIso };
        created.push(profiles[idx]);
      } else {
        let newId = generateShortId();
        const existingIds = new Set(profiles.map(p => p.id));
        while (existingIds.has(newId)) newId = generateShortId();
        const prepared = normalizeProfileInput({ ...input, id: newId }, null);
        prepared.name = makeUniqueName(prepared.name, profiles, prepared.id);
        profiles.push({ ...prepared, createdAt: nowIso });
        created.push(profiles[profiles.length - 1]);
      }
    }

    if (created.length > 0) {
      const ok = writeProfiles(profiles);
      if (!ok) return { success: false, error: 'Failed to persist profiles file' };
      appendLog('system', `Bulk saved ${created.length} profile(s)`);
    }

    return { success: true, profiles: created, errors: errors.length ? errors : undefined };
  } catch (e) {
    appendLog('system', `saveProfilesBulkInternal error: ${e.message}`);
    return { success: false, error: e.message };
  }
}

/**
 * Bulk delete multiple profiles by IDs in a single file write.
 */
async function deleteProfilesBulkInternal(ids) {
  try {
    if (!Array.isArray(ids) || ids.length === 0) {
      return { success: false, error: 'Payload must be a non-empty array of IDs' };
    }
    const profiles = readProfiles();
    const toDelete = new Set(ids);
    const existing = new Set(profiles.map(p => p.id));
    const errors = [];
    const deleted = [];

    for (const id of ids) {
      if (!existing.has(id)) {
        errors.push({ id, error: 'Profile not found' });
      } else {
        deleted.push(id);
      }
    }

    if (deleted.length > 0) {
      const deleteSet = new Set(deleted);
      const filtered = profiles.filter(p => !deleteSet.has(p.id));
      const ok = writeProfiles(filtered);
      if (!ok) return { success: false, error: 'Failed to persist profiles file' };

      // Cleanup storage state and CDP user data (non-blocking)
      for (const id of deleted) {
        try {
          const statePath = storageStatePath(id);
          if (fs.existsSync(statePath)) fs.unlinkSync(statePath);
        } catch { }
        try {
          const cdpDir = path.join(getDataRoot(), 'cdp-user-data', String(id));
          if (fs.existsSync(cdpDir)) fs.rmSync(cdpDir, { recursive: true, force: true });
        } catch { }
      }

      appendLog('system', `Bulk deleted ${deleted.length} profile(s)`);
    }

    return { success: true, deleted: deleted.length, errors: errors.length ? errors : undefined };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * Bulk clone multiple profiles by source IDs.
 */
async function cloneProfilesBulkInternal(sourceIds, overrides = {}) {
  try {
    if (!Array.isArray(sourceIds) || sourceIds.length === 0) {
      return { success: false, error: 'Payload must be a non-empty array of source IDs' };
    }
    const maxBatch = 50;
    if (sourceIds.length > maxBatch) {
      return { success: false, error: `Maximum ${maxBatch} clones per batch` };
    }

    const profiles = readProfiles();
    const nowIso = new Date().toISOString();
    const created = [];
    const errors = [];

    for (const srcId of sourceIds) {
      const src = profiles.find(p => p.id === srcId);
      if (!src) {
        errors.push({ id: srcId, error: 'Source profile not found' });
        continue;
      }
      let newId = generateShortId();
      const existingIds = new Set(profiles.map(p => p.id));
      while (existingIds.has(newId)) newId = generateShortId();
      const cloned = safeDeepClone(src);
      cloned.id = newId;
      cloned.name = makeUniqueName(overrides.namePrefix ? `${overrides.namePrefix} ${src.name}` : `${src.name} (copy)`, profiles, newId);
      cloned.createdAt = nowIso;
      delete cloned.updatedAt;
      profiles.push(cloned);
      created.push(cloned);

      // Copy storage state
      try {
        const srcState = storageStatePath(srcId);
        const dstState = storageStatePath(newId);
        if (fs.existsSync(srcState)) fs.copyFileSync(srcState, dstState);
      } catch { }
    }

    if (created.length > 0) {
      writeProfiles(profiles);
      appendLog('system', `Bulk cloned ${created.length} profile(s)`);
    }

    return { success: true, profiles: created, errors: errors.length ? errors : undefined };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

module.exports = {
  getProfilesInternal,
  saveProfileInternal,
  deleteProfileInternal,
  cloneProfileInternal,
  saveProfilesBulkInternal,
  deleteProfilesBulkInternal,
  cloneProfilesBulkInternal,
  readProfiles,
  writeProfiles,
  updateProfileSettings,
};
