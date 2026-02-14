const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { scriptsFilePath } = require('./paths');
const { appendLog } = require('../logging/logger');

function readScripts() {
  try {
    const p = scriptsFilePath();
    if (!fs.existsSync(p)) {
      try { fs.writeFileSync(p, JSON.stringify([])); } catch {}
      return [];
    }
    const raw = fs.readFileSync(p, 'utf8');
    if (!raw.trim()) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    appendLog('system', `readScripts error: ${e.message}`);
    return [];
  }
}

function writeScripts(list) {
  try {
    const p = scriptsFilePath();
    const tmp = p + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(list, null, 2));
    fs.renameSync(tmp, p);
    return true;
  } catch (e) {
    appendLog('system', `writeScripts error: ${e.message}`);
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

function sanitizeScript(input = {}, existing = null) {
  const base = existing || {};
  const id = input.id || base.id || null;
  const name = String(input.name ?? base.name ?? '').trim().slice(0, 128);
  const description = String(input.description ?? base.description ?? '').slice(0, 1000);
  const language = 'javascript';
  const code = String(input.code ?? base.code ?? '');
  const createdAt = base.createdAt || new Date().toISOString();
  const updatedAt = new Date().toISOString();
  return { id, name, description, language, code, createdAt, updatedAt };
}

async function listScriptsInternal() { return readScripts(); }

async function getScriptInternal(id) {
  const list = readScripts();
  const s = list.find(x => x.id === id);
  if (!s) return { success: false, error: 'Script not found' };
  return { success: true, script: s };
}

async function saveScriptInternal(input) {
  try {
    if (!input || typeof input !== 'object') return { success: false, error: 'Invalid payload' };
    const list = readScripts();
    if (input.id) {
      const idx = list.findIndex(x => x.id === input.id);
      if (idx === -1) {
        const prepared = sanitizeScript(input, null);
        prepared.id = input.id;
        list.push(prepared);
      } else {
        list[idx] = sanitizeScript(input, list[idx]);
      }
    } else {
      const prepared = sanitizeScript(input, null);
      let id = generateId();
      const ids = new Set(list.map(x => x.id));
      while (ids.has(id)) id = generateId();
      prepared.id = id;
      list.push(prepared);
      input.id = id;
    }
    if (!writeScripts(list)) return { success: false, error: 'Persist error' };
    const s = list.find(x => x.id === input.id);
    return { success: true, script: s };
  } catch (e) { return { success: false, error: e?.message || String(e) }; }
}

async function deleteScriptInternal(id) {
  try {
    const list = readScripts();
    const filtered = list.filter(x => x.id !== id);
    if (filtered.length === list.length) return { success: false, error: 'Script not found' };
    if (!writeScripts(filtered)) return { success: false, error: 'Persist error' };
    return { success: true };
  } catch (e) { return { success: false, error: e?.message || String(e) }; }
}

module.exports = {
  listScriptsInternal,
  getScriptInternal,
  saveScriptInternal,
  deleteScriptInternal,
  readScripts,
  writeScripts,
};
