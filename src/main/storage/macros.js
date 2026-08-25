const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { getDataRoot } = require('./paths');
const { appendLog } = require('../logging/logger');

function macrosFilePath() {
  const dir = getDataRoot();
  return path.join(dir, 'macros.json');
}

function readMacros() {                                                                                                                                                                                             
  try {
    const p = macrosFilePath();
    if (!fs.existsSync(p)) {
      try { fs.writeFileSync(p, JSON.stringify([])); } catch {}
      return [];
    }
    const raw = fs.readFileSync(p, 'utf8');
    if (!raw.trim()) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    appendLog('system', `readMacros error: ${e.message}`);
    return [];
  }
}

function writeMacros(list) {
  try {
    const p = macrosFilePath();
    const tmp = p + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(list, null, 2));
    fs.renameSync(tmp, p);
    return true;
  } catch (e) {
    appendLog('system', `writeMacros error: ${e.message}`);
    return false;
  }
}

function generateId() {
  try {
    return crypto.randomBytes(6).toString('hex');
  } catch {
    return Math.random().toString(36).slice(2, 10);
  }
}

function sanitizeStep(s = {}) {
  return {
    id: s.id || generateId(),
    type: String(s.type || 'wait'),
    params: (s.params && typeof s.params === 'object') ? s.params : {},
    label: String(s.label || '').slice(0, 128),
    delay: Math.max(0, Math.min(60000, Number(s.delay) || 0)),
  };
}

function sanitizeMacro(input = {}, existing = null) {
  const base = existing || {};
  const id = input.id || base.id || null;
  const name = String(input.name ?? base.name ?? '').trim().slice(0, 128);
  const description = String(input.description ?? base.description ?? '').slice(0, 1000);
  const steps = Array.isArray(input.steps)
    ? input.steps.map(sanitizeStep)
    : (Array.isArray(base.steps) ? base.steps : []);
  const createdAt = base.createdAt || new Date().toISOString();
  const updatedAt = new Date().toISOString();
  return { id, name, description, steps, createdAt, updatedAt };
}

async function listMacrosInternal() {
  return readMacros();
}

async function getMacroInternal(id) {
  const list = readMacros();
  const m = list.find(x => x.id === id);
  if (!m) return { success: false, error: 'Macro not found' };
  return { success: true, macro: m };
}

async function saveMacroInternal(input) {
  try {
    if (!input || typeof input !== 'object') return { success: false, error: 'Invalid payload' };
    const list = readMacros();

    if (input.id) {
      const idx = list.findIndex(x => x.id === input.id);
      if (idx === -1) {
        const prepared = sanitizeMacro(input, null);
        prepared.id = input.id;
        list.push(prepared);
      } else {
        list[idx] = sanitizeMacro(input, list[idx]);
      }
    } else {
      const prepared = sanitizeMacro(input, null);
      let id = generateId();
      const ids = new Set(list.map(x => x.id));
      while (ids.has(id)) id = generateId();
      prepared.id = id;
      list.push(prepared);
      input.id = id;
    }

    if (!writeMacros(list)) return { success: false, error: 'Persist error' };
    const m = list.find(x => x.id === input.id);
    return { success: true, macro: m };
  } catch (e) { return { success: false, error: e?.message || String(e) }; }
}

async function deleteMacroInternal(id) {
  try {
    const list = readMacros();
    const filtered = list.filter(x => x.id !== id);
    if (filtered.length === list.length) return { success: false, error: 'Macro not found' };
    if (!writeMacros(filtered)) return { success: false, error: 'Persist error' };
    return { success: true };
  } catch (e) { return { success: false, error: e?.message || String(e) }; }
}

module.exports = {
  listMacrosInternal,
  getMacroInternal,
  saveMacroInternal,
  deleteMacroInternal,
  readMacros,
  writeMacros,
};
