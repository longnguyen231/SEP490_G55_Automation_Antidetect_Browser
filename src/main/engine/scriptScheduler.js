/**
 * scriptScheduler.js — Quản lý cron jobs cho script automation.
 *
 * Mỗi script có field `schedule: { enabled, cron, profileId }`.
 * Module này duy trì một Map<scriptId, cronJob> và cung cấp:
 *  - scheduleScript(script)   : start/restart cron job cho 1 script
 *  - cancelScript(scriptId)   : stop và xóa cron job của 1 script
 *  - refreshAllScripts()      : đọc lại toàn bộ scripts.json và sync lại jobs
 */

function safeRequire(mod) { try { return require(mod); } catch { return null; } }

const cron = safeRequire('node-cron');
const { appendLog } = require('../logging/logger');

/** @type {Map<string, import('node-cron').ScheduledTask>} */
const scriptJobs = new Map(); // scriptId → cron job instance

/**
 * Khởi động (hoặc restart) cron job cho một script.
 * Nếu job đã tồn tại → stop cũ trước.
 * @param {{ id: string, name: string, code: string, browserMode: string, schedule: { enabled: boolean, cron: string, profileId: string } }} script
 */
function scheduleScript(script) {
  if (!script?.id) return;

  // Dừng job cũ nếu có
  cancelScript(script.id);

  const sch = script.schedule;
  if (!sch?.enabled || !sch?.cron || !sch?.profileId) return; // Không cần schedule
  if (!cron) {
    appendLog('system', `scriptScheduler: node-cron not available — cannot schedule script "${script.name}"`);
    return;
  }

  const expr = String(sch.cron).trim();
  if (!cron.validate(expr)) {
    appendLog('system', `scriptScheduler: invalid cron expression "${expr}" for script "${script.name}"`);
    return;
  }

  try {
    const job = cron.schedule(expr, async () => {
      try {
        const { executeScript } = require('./scriptRuntime');
        const { readScripts } = require('../storage/scripts');
        // Đọc lại code mới nhất từ file (tránh stale closure)
        const fresh = readScripts().find(s => s.id === script.id);
        if (!fresh?.code) {
          appendLog('system', `scriptScheduler: script "${script.id}" not found — cancelling job`);
          cancelScript(script.id);
          return;
        }
        const profileId = fresh.schedule?.profileId;
        if (!profileId) return;
        appendLog(profileId, `scriptScheduler: auto-run script "${fresh.name}" (cron: ${expr})`);
        await executeScript(profileId, fresh.code, {
          timeoutMs: 120000,
          headless: fresh.browserMode === 'headless',
        });
      } catch (e) {
        appendLog('system', `scriptScheduler: cron run error — ${e?.message || e}`);
      }
    });

    scriptJobs.set(script.id, job);
    appendLog('system', `scriptScheduler: scheduled script "${script.name}" with cron "${expr}"`);
  } catch (e) {
    appendLog('system', `scriptScheduler: failed to schedule "${script.name}" — ${e?.message || e}`);
  }
}

/**
 * Dừng và xóa cron job của một script.
 * @param {string} scriptId
 */
function cancelScript(scriptId) {
  const job = scriptJobs.get(scriptId);
  if (job) {
    try { job.stop(); } catch {}
    scriptJobs.delete(scriptId);
    appendLog('system', `scriptScheduler: cancelled cron job for script "${scriptId}"`);
  }
}

/**
 * Đọc lại toàn bộ scripts.json và đồng bộ lại tất cả cron jobs.
 * Gọi khi app khởi động hoặc sau khi có thay đổi lớn.
 */
function refreshAllScripts() {
  try {
    const { readScripts } = require('../storage/scripts');
    const scripts = readScripts();
    const activeIds = new Set(scripts.map(s => s.id));

    // Huỷ các job không còn tồn tại
    for (const [id] of [...scriptJobs.entries()]) {
      if (!activeIds.has(id)) cancelScript(id);
    }

    // Tạo/cập nhật jobs
    for (const script of scripts) {
      scheduleScript(script);
    }
  } catch (e) {
    appendLog('system', `scriptScheduler: refreshAllScripts error — ${e?.message || e}`);
  }
}

/** Số lượng active cron jobs hiện tại */
function activeJobCount() { return scriptJobs.size; }
  
module.exports = { scheduleScript, cancelScript, refreshAllScripts, activeJobCount };
