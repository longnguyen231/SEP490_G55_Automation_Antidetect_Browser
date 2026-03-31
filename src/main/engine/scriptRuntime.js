/**
 * scriptRuntime.js — Enhanced script execution engine.
 * 
 * Exposes both `page`/`context` objects (Playwright API) and `actions` proxy
 * to user scripts. Collects structured logs.
 */

const vm = require('vm');
const { appendLog } = require('../logging/logger');
const { performAction, getActionNames } = require('./actions');
const { runningProfiles } = require('../state/runtime');

function ok(v = {}) { return { success: true, ...v }; }
function err(message, extra = {}) { return { success: false, error: String(message || 'unknown error'), ...extra }; }

/**
 * Get a Playwright page from a running profile.
 */
async function getPageForProfile(profileId) {
  const running = runningProfiles.get(profileId);
  if (!running) return null;

  if (running.engine === 'playwright') {
    const context = running.context;
    if (!context) return null;
    let page = context.pages()[0];
    if (!page) page = await context.newPage();
    return { page, context, browser: running.browser, cleanup: async () => {} };
  }

  // CDP: connect via Playwright for unified API
  try {
    const { chromium } = require('./playwrightDriver');
    const browser = await chromium.connectOverCDP(running.wsEndpoint);
    const context = browser.contexts?.()[0];
    if (!context) { try { await browser.close(); } catch {} return null; }
    let page = context.pages()[0];
    if (!page) page = await context.newPage();
    return { page, context, browser, cleanup: async () => { try { await browser.close(); } catch {} } };
  } catch {
    return null;
  }
}

async function executeScript(profileId, code, { timeoutMs = 120000 } = {}) {
  if (!profileId) return err('profileId is required');
  const src = String(code || '').trim();
  if (!src) return err('code is empty');

  // Collect logs
  const logs = [];
  const log = (...args) => {
    const msg = args.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' ');
    const entry = { time: new Date().toISOString(), message: msg };
    logs.push(entry);
    try { appendLog(profileId, '[script] ' + msg); } catch {}
  };
  const sleep = (ms) => new Promise((r) => setTimeout(r, Math.min(Math.max(0, Number(ms) || 0), 10 * 60 * 1000)));

  // Actions proxy (legacy compatibility)
  const actions = new Proxy({}, {
    get(_t, prop) {
      const name = String(prop);
      if (!getActionNames().includes(name)) {
        return async () => ({ success: false, error: `Unknown action '${name}'` });
      }
      return async (params) => {
        try { return await performAction(profileId, name, params || {}); }
        catch (e) { return { success: false, error: e?.message || String(e) }; }
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
      } catch {}
    }
  } catch {}

  // Sandbox context
  const sandbox = {
    profileId,
    log,
    sleep,
    actions,
    assert,
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
      new Promise((_, reject) => setTimeout(() => reject(new Error('Script timeout')), Math.min(timeoutMs, 300000))),
    ]);
    // Cleanup CDP connection if we created one
    if (pageHandle?.cleanup) await pageHandle.cleanup();
    return ok({ result, logs });
  } catch (e) {
    const errMsg = e?.message || String(e);
    log('ERROR: ' + errMsg);
    appendLog(profileId, `Script error: ${errMsg}`);
    if (pageHandle?.cleanup) await pageHandle.cleanup();
    return err(errMsg, { logs });
  }
}

module.exports = { executeScript };
