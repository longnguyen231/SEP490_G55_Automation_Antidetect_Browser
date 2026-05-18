// ═══════════════════════════════════════════════════════════════════════════════
// scriptRunner.js — Điểm thực thi script tập trung, áp dụng đầy đủ kiểm tra an toàn
//
// Mục đích: Cung cấp một hàm duy nhất runScriptWithFullChecks() được gọi bởi
//   BOTH IPC handler (scripts-execute) AND cron scheduler (scriptScheduler.js)
//
// Fixes được áp dụng:
//   Bug #1 — Ethical linter được áp dụng tại TẤT CẢ entry point
//             (trước đây chỉ nằm trong IPC handler, bị bypass hoàn toàn qua REST/scheduler)
//   Bug #2 — Task Log được ghi cho mọi lần chạy kể cả scheduled run
//             (trước đây scheduler gọi executeScript trực tiếp, không ghi task log)
//   Bug #3 — Tick bị skip (khi script đang chạy) được log rõ ràng thay vì nuốt im lặng
//             (trước đây scheduler swallow return value của executeScript)
//
// QUAN TRỌNG: File này KHÔNG chứa logic launch profile.
//   Profile launch vẫn thuộc trách nhiệm của từng caller (IPC handler / scheduler).
// ═══════════════════════════════════════════════════════════════════════════════

const { appendLog }      = require('../logging/logger');
const { appendAuditLog } = require('../logging/auditLogger');
// Lazy require executeScript + isScriptRunning để tránh circular dependency khi load lần đầu
// (scriptRuntime.js import actions.js, actions.js có thể import ngược về đây)
const { addTaskLog, updateTaskLog } = require('../storage/taskLogs');

// ── Ethical Linter Patterns ──────────────────────────────────────────────────
// Tập trung pattern ở đây thay vì nhúng inline trong từng handler.
// Bất kỳ entry point nào (IPC, REST, scheduler) đều dùng chung bộ rules này.
const RESTRICTED_DOMAIN_PATTERN =
  /\.gov|\.mil|\.edu|\b(bank|paypal|vnpay|momo|zalopay|shopeepay|viettelpay|agribank|vietcombank|techcombank|mbbank|sacombank|vpbank|bidv|crypto|binance|bitcoin|usdt)\b/i;

const DDOS_PATTERN = /while\s*\(\s*true\s*\)\s*\{[^{}]*(fetch|actions\.)/i;

// ─────────────────────────────────────────────────────────────────────────────

/**
 * checkEthical(code) — Chạy ethical linter trên đoạn code script.
 *
 * Tách thành hàm riêng để có thể gọi độc lập (ví dụ: validate trước khi lưu).
 *
 * @param {string} code — source code cần kiểm tra
 * @returns {{ ok: boolean, reason?: string }}
 */
function checkEthical(code) {
  if (RESTRICTED_DOMAIN_PATTERN.test(code)) {
    return {
      ok: false,
      reason: 'Restricted domain access detected (bank/gov/mil/edu domains are prohibited by system policy)',
    };
  }
  if (DDOS_PATTERN.test(code)) {
    return {
      ok: false,
      reason: 'DDoS-like loop pattern detected (while-true combined with fetch/actions is prohibited)',
    };
  }
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * runScriptWithFullChecks(profileId, code, opts)
 *
 * Entry point duy nhất để thực thi script với đầy đủ kiểm tra an toàn.
 * Được gọi bởi cả IPC handler lẫn cron scheduler.
 
 * LƯU Ý: Hàm này KHÔNG tự launch profile. Profile phải được launch trước bởi caller.
 *
 * @param {string} profileId
 * @param {string} code          — source code của script
 * @param {object} opts
 *   @param {string} opts.scriptId    — ID để liên kết task log với script gốc (optional)
 *   @param {string} opts.scriptName  — tên hiển thị trong Task Logs UI
 *   @param {string} opts.source      — 'ipc' | 'scheduler' | 'rest' (dùng trong audit log)
 *   @param {number} opts.timeoutMs   — timeout thực thi (mặc định 120 000 ms)
 * @returns {Promise<{success:boolean, skipped?:boolean, error?:string, logs?:Array}>}
 */
async function runScriptWithFullChecks(profileId, code, opts = {}) {
  const {
    scriptId   = '',
    scriptName = '(unknown)',
    source     = 'unknown',
    timeoutMs  = 120000,
  } = opts;

  // ── 1. Ethical Linter (Bug #1 fix) ──────────────────────────────────────────
  // Trước đây linter chỉ nằm trong IPC handler → scheduler và REST API bỏ qua hoàn toàn.
  // Nay linter được gọi ở đây — mọi entry point đều phải qua hàm này.
  const lint = checkEthical(code);
  if (!lint.ok) {
    appendAuditLog(
      'VIOLATION_BLOCKED',
      `[${source}] Script rejected by ethical linter: ${lint.reason}`,
      profileId,
    );
    appendLog(profileId, `EthicalViolationError: ${lint.reason}`);
    return { success: false, error: `EthicalViolationError: ${lint.reason}` };
  }

  // ── 2. Skip Detection (Bug #3 fix) ──────────────────────────────────────────
  // Trước đây: executeScript() trả về error 'A script is already running' nhưng
  // scheduler catch block swallow nó → user không biết tick đã bị skip.
  // Nay: log rõ ràng trước khi return để dễ debug.
  // Lazy require để tránh circular dependency
  const { isScriptRunning } = require('./scriptRuntime');
  if (isScriptRunning(profileId)) {
    appendLog(
      profileId,
      `[${source}] Script tick SKIPPED — another script is already running on this profile. ` +
      `(script: "${scriptName}", cron tick dropped to prevent concurrent execution)`,
    );
    return { success: false, skipped: true, error: 'A script is already running for this profile' };
  }

  // ── 3. Tạo Task Log entry ──────────────────────────────────────
  const startedAt = new Date().toISOString();
  let taskId = null;
  try {
    const addResult = await addTaskLog({
      scriptId,
      name:       scriptName,
      scriptName, // backward compat field
      profileId,
      status:     'running',
      startedAt,
    });
    taskId = addResult?.taskLog?.id ?? null;
  } catch (e) {
    // Non-fatal: nếu ghi log thất bại thì vẫn tiếp tục thực thi script
    appendLog(profileId, `[scriptRunner] addTaskLog failed (non-fatal): ${e?.message || e}`);
  }

  // ── 4. Thực thi script ───────────────────────────────────────────────────────
  // Lazy require để tránh circular dependency khi module load
  const { executeScript } = require('./scriptRuntime');
  let result;
  try {
    result = await executeScript(profileId, code, { timeoutMs });
  } catch (e) {
    // executeScript bình thường không throw — catch này chỉ là lớp bảo vệ cuối cùng
    result = { success: false, error: e?.message || String(e), logs: [] };
  }

  // ── 5. Cập nhật Task Log với kết quả (Bug #2 fix) ───────────────────────────
  if (taskId) {
    try {
      const isStopped = result.error && String(result.error).includes('stopped by user');
      await updateTaskLog(taskId, {
        status:      result.success ? 'completed' : (isStopped ? 'stopped' : 'error'),
        completedAt: new Date().toISOString(),
        error:       result.error || null,
        logs:        result.logs  || [],
      });
    } catch (e) {
      appendLog(profileId, `[scriptRunner] updateTaskLog failed (non-fatal): ${e?.message || e}`);
    }
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
module.exports = { checkEthical, runScriptWithFullChecks };
