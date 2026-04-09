/**
 * scriptRuntime.js — Enhanced script execution engine.
 * 
 * Exposes both `page`/`context` objects (Playwright API) and `actions` proxy
 * to user scripts. Collects structured logs.
 */

const vm = require('vm');
const path = require('path');
const { appendLog } = require('../logging/logger');
const { performAction, getActionNames } = require('./actions');
const { runningProfiles } = require('../state/runtime');
const { getModulesDir } = require('../storage/scriptModules');

// Safe require for user-installed script modules
function makeScriptRequire(profileId) {
  const modulesDir = (() => { try { return getModulesDir(); } catch { return null; } })();
  const ALLOWED_BUILTINS = new Set(['path', 'url', 'querystring', 'crypto', 'buffer', 'stream', 'events', 'util', 'os', 'zlib']);
  return function scriptRequire(name) {
    if (ALLOWED_BUILTINS.has(name)) return require(name);
    if (!modulesDir) throw new Error(`Script modules directory not available`);
    try {
      const modPath = path.join(modulesDir, 'node_modules', name);
      return require(modPath);
    } catch (e) {
      appendLog(profileId, `Script: require('${name}') failed — ${e.message}. Install it via Script Modules tab.`);
      throw new Error(`Module '${name}' not found. Install it via Script Modules tab first.`);
    }
  };
}

function ok(v = {}) { return { success: true, ...v }; }
function err(message, extra = {}) { return { success: false, error: String(message || 'unknown error'), ...extra }; }

// Per-profile execution control
const _runningScripts = new Map(); // profileId -> { aborted, paused }

function stopScript(profileId) {
  const ctrl = _runningScripts.get(profileId);
  if (ctrl) { ctrl.aborted = true; ctrl.paused = false; }
}

function pauseScript(profileId) {
  const ctrl = _runningScripts.get(profileId);
  if (ctrl) ctrl.paused = true;
}

function resumeScript(profileId) {
  const ctrl = _runningScripts.get(profileId);
  if (ctrl) ctrl.paused = false;
}

function isScriptRunning(profileId) {
  return _runningScripts.has(profileId);
}

/**
 * Get a Playwright page from a running profile.
 */
async function getPageForProfile(profileId) {
  const running = runningProfiles.get(profileId);
  if (!running) {
    appendLog(profileId, 'Script: profile is not running');
    return null;
  }

  // All Playwright-based engines (chromium, firefox, camoufox) store context directly
  const isPlaywrightEngine = running.engine !== 'cdp' && running.context;
  if (isPlaywrightEngine) {
    const context = running.context;
    if (!context) {
      appendLog(profileId, 'Script: Playwright context not available');
      return null;
    }
    if (context.isClosed?.()) {
      appendLog(profileId, 'Script: Playwright context is closed');
      return null;
    }
    let page = context.pages()[0];
    if (!page) {
      appendLog(profileId, 'Script: no open page found — creating new page');
      page = await context.newPage();
    }
    return { page, context, browser: running.browser, cleanup: async () => {} };
  }

  // CDP: connect via Playwright for unified API
  if (!running.wsEndpoint) {
    appendLog(profileId, 'Script: CDP wsEndpoint not available');
    return null;
  }
  try {
    const { chromium } = require('playwright');
    const browser = await chromium.connectOverCDP(running.wsEndpoint);
    const context = browser.contexts?.()[0];
    if (!context) {
      appendLog(profileId, 'Script: CDP connected but no browser context found');
      try { await browser.close(); } catch {}
      return null;
    }
    let page = context.pages()[0];
    if (!page) {
      appendLog(profileId, 'Script: no open page found (CDP) — creating new page');
      page = await context.newPage();
    }
    return { page, context, browser, cleanup: async () => { try { await browser.close(); } catch {} } };
  } catch (e) {
    appendLog(profileId, `Script: CDP connect failed — ${e?.message || e}`);
    return null;
  }
}

async function executeScript(profileId, code, { timeoutMs = 120000 } = {}) {
  if (!profileId) return err('profileId is required');
  const src = String(code || '').trim();
  if (!src) return err('code is empty');
  if (_runningScripts.has(profileId)) return err('A script is already running for this profile');

  const ctrl = { aborted: false, paused: false };
  _runningScripts.set(profileId, ctrl);

  appendLog(profileId, `Script: starting execution (timeout=${timeoutMs}ms)`);

  // Collect logs
  const logs = [];
  const log = (...args) => {
    const msg = args.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' ');
    const entry = { time: new Date().toISOString(), message: msg };
    logs.push(entry);
    try { appendLog(profileId, '[script] ' + msg); } catch {}
  };

  // Abort/pause-aware sleep — checks flags every 100ms
  const sleep = (ms) => new Promise((resolve, reject) => {
    const total = Math.min(Math.max(0, Number(ms) || 0), 10 * 60 * 1000);
    let elapsed = 0;
    const tick = () => {
      if (ctrl.aborted) return reject(new Error('Script stopped by user'));
      if (ctrl.paused) { setTimeout(tick, 100); return; }
      if (elapsed >= total) return resolve();
      const step = Math.min(100, total - elapsed);
      elapsed += step;
      setTimeout(tick, step);
    };
    tick();
  });

  // Actions proxy (legacy compatibility)
  const actions = new Proxy({}, {
    get(_t, prop) {
      const name = String(prop);
      if (!getActionNames().includes(name)) {
        appendLog(profileId, `Script: unknown action requested — '${name}'`);
        return async () => ({ success: false, error: `Unknown action '${name}'` });
      }
      return async (params) => {
        try { return await performAction(profileId, name, params || {}); }
        catch (e) {
          appendLog(profileId, `Script: action '${name}' threw — ${e?.message || e}`);
          return { success: false, error: e?.message || String(e) };
        }
      };
    },
  });
  const assert = (cond, msg = 'Assertion failed') => { if (!cond) throw new Error(String(msg)); };

  // Get page object for direct Playwright API access
  let pageHandle = null;
  let page = null;
  let context = null;
  let cdpSession = null;
  try {
    pageHandle = await getPageForProfile(profileId);
    if (pageHandle) {
      page = pageHandle.page;
      context = pageHandle.context;
      // Provide CDP session access if available
      try {
        cdpSession = await context.newCDPSession(page);
      } catch (e) {
        appendLog(profileId, `Script: CDP session unavailable — ${e?.message || e}. cdp will be null.`);
      }
    } else {
      appendLog(profileId, 'Script: page not available — page/context will be null in script');
    }
  } catch (e) {
    appendLog(profileId, `Script: failed to get page — ${e?.message || e}`);
  }

  // Sandbox context
  const sandbox = {
    profileId,
    log,
    sleep,
    actions,
    assert,
    require: makeScriptRequire(profileId),
    page,
    context,
    cdp: cdpSession,
    console: { log, warn: log, error: log, info: log },
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    JSON,
    Date,
    Math,
    Array,
    Object,
    String,
    Number,
    Boolean,
    RegExp,
    Error,
    Promise,
    Map,
    Set,
    Buffer,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    encodeURIComponent,
    decodeURIComponent,
    encodeURI,
    decodeURI,
  };
  const vmContext = vm.createContext(sandbox, { name: 'scriptSandbox' });
  const wrapped = `(async () => {\n${src}\n})()`;
  try {
    const script = new vm.Script(wrapped, { filename: 'automation-script.js', displayErrors: true });
    const result = await Promise.race([
      script.runInContext(vmContext, { displayErrors: true }),
      new Promise((_, reject) => setTimeout(() => reject(new Error(`Script timeout after ${timeoutMs}ms`)), Math.min(timeoutMs, 300000))),
    ]);
    _runningScripts.delete(profileId);
    if (pageHandle?.cleanup) await pageHandle.cleanup();
    appendLog(profileId, `Script: completed successfully (${logs.length} log entries)`);
    return ok({ result, logs });
  } catch (e) {
    _runningScripts.delete(profileId);
    const errMsg = e?.message || String(e);
    if (errMsg.includes('stopped by user')) {
      appendLog(profileId, `Script: STOPPED by user`);
    } else if (errMsg.includes('timeout')) {
      appendLog(profileId, `Script: TIMEOUT — ${errMsg}`);
    } else if (errMsg.includes('is not defined')) {
      appendLog(profileId, `Script: REFERENCE ERROR — ${errMsg}`);
    } else if (errMsg.includes('Cannot read')) {
      appendLog(profileId, `Script: NULL/UNDEFINED ERROR — ${errMsg}`);
    } else if (errMsg.includes('Assertion failed') || errMsg.startsWith('assert')) {
      appendLog(profileId, `Script: ASSERTION FAILED — ${errMsg}`);
    } else {
      appendLog(profileId, `Script: ERROR — ${errMsg}`);
    }
    log('ERROR: ' + errMsg);
    if (pageHandle?.cleanup) await pageHandle.cleanup();
    return err(errMsg, { logs });
  }
}

module.exports = { executeScript, stopScript, pauseScript, resumeScript, isScriptRunning };
