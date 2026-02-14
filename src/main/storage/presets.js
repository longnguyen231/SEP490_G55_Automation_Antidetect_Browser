const fs = require('fs');
const path = require('path');
const { presetsFilePath, ensureDir } = require('./paths');

function loadPresets() {
  try {
    const p = presetsFilePath();
    if (!fs.existsSync(p)) {
      try { ensureDir(path.dirname(p)); fs.writeFileSync(p, JSON.stringify([])); } catch {}
      return [];
    }
    const raw = fs.readFileSync(p, 'utf8');
    const arr = JSON.parse(raw || '[]');
    if (Array.isArray(arr)) return arr;
    return [];
  } catch {
    return [];
  }
}

function savePresets(list) {
  try {
    const p = presetsFilePath();
    ensureDir(path.dirname(p));
    fs.writeFileSync(p, JSON.stringify(list || [], null, 2));
    return true;
  } catch {
    return false;
  }
}

function genId() {
  try { return (Date.now().toString(36) + Math.random().toString(36).slice(2,8)).toLowerCase(); }
  catch { return String(Date.now()); }
}

async function addPresetInternal(preset) {
  const list = loadPresets();
  const id = preset.id || genId();
  const item = {
    id,
    name: preset.name || `Preset ${new Date().toISOString()}`,
    label: preset.label || preset.name || 'Custom preset',
    fingerprint: preset.fingerprint || {},
    settingsPatch: preset.settingsPatch || {},
    createdAt: Date.now(),
  };
  list.push(item);
  savePresets(list);
  return { success: true, preset: item };
}

async function listPresetsInternal() {
  const list = loadPresets();
  return { success: true, presets: list };
}

async function deletePresetInternal(id) {
  const list = loadPresets();
  const next = list.filter(p => p.id !== id);
  const ok = savePresets(next);
  return { success: ok };
}

module.exports = {
  loadPresets,
  savePresets,
  addPresetInternal,
  listPresetsInternal,
  deletePresetInternal,
};
