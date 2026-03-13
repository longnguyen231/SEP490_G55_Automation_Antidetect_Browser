const vm = require('vm');
const { appendLog } = require('../logging/logger');
const { performAction, getActionNames } = require('./actions');

function ok(v = {}) { return { success: true, ...v }; }
function err(message, extra = {}) { return { success: false, error: String(message || 'unknown error'), ...extra }; }

async function executeScript(profileId, code, { timeoutMs = 120000 } = {}) {
  if (!profileId) return err('profileId is required');
  const src = String(code || '').trim();
  if (!src) return err('code is empty');

  // Helper APIs exposed to script
  const log = (...args) => { try { appendLog(profileId, '[script] ' + args.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' ')); } catch {} };
  const sleep = (ms) => new Promise((r) => setTimeout(r, Math.min(Math.max(0, Number(ms) || 0), 10 * 60 * 1000)));
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

  // Sandbox context
  const sandbox = {
    profileId,
    log,
    sleep,
    actions,
    assert,
    console: { log, warn: log, error: log },
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
  };
  const context = vm.createContext(sandbox, { name: 'scriptSandbox' });
  const wrapped = `(async () => {\n${src}\n})()`;
  try {
    const script = new vm.Script(wrapped, { filename: 'automation-script.js', displayErrors: true, timeout: Math.min(timeoutMs, 300000) });
    const result = await Promise.race([
      script.runInContext(context, { displayErrors: true, timeout: Math.min(timeoutMs, 300000) }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Script timeout')), Math.min(timeoutMs, 300000))),
    ]);
    return ok({ result });
  } catch (e) {
    appendLog(profileId, `Script error: ${e?.message || e}`);
    return err(e?.message || e);
  }
}

module.exports = { executeScript };
