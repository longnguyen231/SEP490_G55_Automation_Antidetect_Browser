// Simple automation scheduler using cron expressions to auto-launch profiles
// and optionally run defined steps. Uses node-cron; falls back gracefully if invalid.
const fs = require('fs');
const path = require('path');
const cron = safeRequire('node-cron');
const { appendLog } = require('../logging/logger');
const { profilesFilePath } = require('../storage/paths');
const { runningProfiles } = require('../state/runtime');
const { readProfiles } = require('../storage/profiles');
const { launchProfileInternal } = require('../controllers/profiles');

function safeRequire(mod) { try { return require(mod); } catch { return null; } }

const scheduledJobs = new Map(); // profileId -> cron job
let watchInited = false;

function refreshSchedules() {
  const profiles = readProfiles();
  // Cancel removed or updated jobs
  for (const [pid, job] of [...scheduledJobs.entries()]) {
    const p = profiles.find(x => x.id === pid);
    const auto = p?.automation;
    if (!p || !auto || !auto.schedule || !auto.schedule.enabled || !auto.schedule.cron) {
      try { job.stop(); } catch {}
      scheduledJobs.delete(pid);
      appendLog(pid, 'Automation: schedule removed');
    }
  }
  // Add/update jobs
  for (const p of profiles) {
    const auto = p.automation;
    if (!auto || !auto.schedule || !auto.schedule.enabled || !auto.schedule.cron) continue;
    const expr = String(auto.schedule.cron).trim();
    if (!cron || !cron.validate(expr)) {
      appendLog(p.id, `Automation: invalid cron '${expr}'`);
      continue;
    }
    if (scheduledJobs.has(p.id)) continue; // already scheduled; simple strategy (restart app to apply changes)
    try {
      const job = cron.schedule(expr, async () => {
        try {
          if (runningProfiles.has(p.id)) {
            appendLog(p.id, 'Automation: profile already running, skip launch');
            return;
          }
          appendLog(p.id, `Automation: launching (cron ${expr})`);
          const res = await launchProfileInternal(p.id, { engine: p.settings?.engine, headless: p.settings?.headless });
          if (!res.success) appendLog(p.id, `Automation launch failed: ${res.error}`);
        } catch (e) { appendLog(p.id, `Automation launch error: ${e?.message || e}`); }
      }, { timezone: p.settings?.timezone || 'UTC' });
      scheduledJobs.set(p.id, job);
      appendLog(p.id, `Automation: scheduled with cron '${expr}'`);
    } catch (e) {
      appendLog(p.id, `Automation: schedule failed (${e?.message || e})`);
    }
  }
}

function startAutomationScheduler() {
  refreshSchedules();
  if (!watchInited) {
    watchInited = true;
    // Watch profiles file for changes and refresh; debounce to avoid rapid triggers
    const p = profilesFilePath();
    let timer = null;
    try {
      fs.watch(p, { persistent: false }, () => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => { refreshSchedules(); }, 500);
      });
    } catch {}
  }
}

module.exports = { startAutomationScheduler, refreshSchedules };