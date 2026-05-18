// ═══════════════════════════════════════════════════════════════════════════════
// scriptScheduler.js — Quản lý lịch chạy tự động (cron jobs) cho các script
//
// Lý do dùng cron scheduling:
//   Script có thể được cấu hình để chạy định kỳ (ví dụ: mỗi giờ, mỗi ngày)
//   mà không cần người dùng nhấn nút thủ công. node-cron sẽ theo dõi đồng hồ
//   hệ thống và kích hoạt script đúng thời điểm đã cài đặt.
//
// Mỗi script có field `schedule: { enabled, cron, profileId }`.
// Module này duy trì một Map<scriptId, cronJob> và cung cấp:
//  - scheduleScript(script)   : khởi động / khởi động lại cron job cho 1 script
//  - cancelScript(scriptId)   : dừng và xóa cron job của 1 script
//  - refreshAllScripts()      : đọc lại toàn bộ scripts.json và đồng bộ lại tất cả jobs
//  - activeJobCount()         : trả số lượng job đang chạy (dùng cho UI hiển thị)
// ═══════════════════════════════════════════════════════════════════════════════

// Hàm require an toàn — nếu module không tồn tại thì trả null thay vì crash
// (node-cron là optional: app vẫn hoạt động nếu không có module này)
function safeRequire(mod) { try { return require(mod); } catch { return null; } }

// Tải node-cron để tạo và quản lý cron expressions (ví dụ: "0 * * * *" = mỗi giờ)
const cron = safeRequire('node-cron');

// Logger dùng chung — ghi log vào file để debug khi cron chạy ngầm (không có UI)
const { appendLog }            = require('../logging/logger');
// scriptRunner: helper tập trung áp dụng ethical linter + task log + skip detection (Bug #1/#2/#3)
const { runScriptWithFullChecks } = require('./scriptRunner');

// ═══════════════════════════════════════════════════════════════════════════════
// Map nội bộ: scriptId → instance cron job đang chạy
//
// Dùng Map thay vì object thông thường vì:
//   - Dễ kiểm tra tồn tại (.has), thêm (.set), xóa (.delete)
//   - Key là string (scriptId), value là ScheduledTask từ node-cron
//   - Cho phép tra cứu O(1) khi cần dừng một job cụ thể
// ═══════════════════════════════════════════════════════════════════════════════
/** @type {Map<string, import('node-cron').ScheduledTask>} */
const scriptJobs = new Map(); // scriptId → cron job instance

// ═══════════════════════════════════════════════════════════════════════════════
// scheduleScript(script)
//
// Mục đích: Khởi động (hoặc khởi động lại) cron job cho một script cụ thể.
// Nếu script đã có job đang chạy → dừng job cũ trước, rồi tạo job mới.
//
// Quy trình:
//   1. Kiểm tra script có id hợp lệ không
//   2. Hủy job cũ nếu đã tồn tại (tránh chạy song song cùng 1 script)
//   3. Kiểm tra các điều kiện cần thiết: enabled, cron expression, profileId
//   4. Validate cron expression bằng node-cron
//   5. Tạo job mới — mỗi lần tick sẽ đọc code mới nhất rồi thực thi
// ═══════════════════════════════════════════════════════════════════════════════
/**
 * Khởi động (hoặc restart) cron job cho một script.
 * Nếu job đã tồn tại → stop cũ trước.
 * @param {{ id: string, name: string, code: string, browserMode: string, schedule: { enabled: boolean, cron: string, profileId: string } }} script
 */
function scheduleScript(script) {
  // Bảo vệ: script phải có id mới xử lý được
  if (!script?.id) return;

  // Dừng job cũ nếu có — đảm bảo không có 2 job chạy đồng thời cho cùng 1 scriptId
  cancelScript(script.id);

  const sch = script.schedule;

  // Chỉ tạo job khi schedule được bật, có cron expression và có profileId để chạy vào
  // Nếu thiếu bất kỳ điều kiện nào → bỏ qua, không báo lỗi (là hành vi bình thường)
  if (!sch?.enabled || !sch?.cron || !sch?.profileId) return; // Không cần schedule

  // Kiểm tra node-cron có sẵn không (có thể bị thiếu trong môi trường sandbox)
  if (!cron) {
    appendLog('system', `scriptScheduler: node-cron not available — cannot schedule script "${script.name}"`);
    return;
  }

  // Làm sạch cron expression: xóa khoảng trắng thừa ở đầu/cuối
  const expr = String(sch.cron).trim();

  // Validate cron expression trước khi đăng ký — tránh lỗi silent khi expression sai cú pháp
  if (!cron.validate(expr)) {
    appendLog('system', `scriptScheduler: invalid cron expression "${expr}" for script "${script.name}"`);
    return;
  }

  try {
    // Tạo cron job — callback async được gọi mỗi lần cron expression khớp với giờ hệ thống
    const job = cron.schedule(expr, async () => {
      try {
        // Lazy require để tránh circular dependency khi module load lần đầu
        const { readScripts }    = require('../storage/scripts');
        const { runningProfiles } = require('../state/runtime');

        // ── Quan trọng: Đọc lại code mới nhất từ file thay vì dùng biến `script` trong closure ──
        // Lý do: Nếu người dùng chỉnh sửa script sau khi job được tạo, closure sẽ giữ code cũ.
        // Bằng cách đọc lại từ disk mỗi lần tick, job luôn chạy phiên bản code mới nhất.
        const fresh = readScripts().find(s => s.id === script.id);

        // Nếu script bị xóa khỏi danh sách → tự hủy job này để giải phóng tài nguyên
        if (!fresh?.code) {
          appendLog('system', `scriptScheduler: script "${script.id}" not found — cancelling job`);
          cancelScript(script.id);
          return;
        }

        // Lấy profileId từ dữ liệu mới nhất (có thể đã được đổi sau khi job tạo)
        const profileId = fresh.schedule?.profileId;
        if (!profileId) return;

        // ── Auto-launch profile nếu chưa chạy ─────────────────────────────────
        // runScriptWithFullChecks() yêu cầu profile đã launch sẵn.
        // Vì cron tick xảy ra ngầm khi user chưa mở profile, ta tự launch trước.
        if (!runningProfiles.has(profileId)) {
          appendLog(profileId, `scriptScheduler: profile not running — auto-launching for scheduled script "${fresh.name}"`);
          try {
            const { launchProfileInternal } = require('../controllers/profiles');
            const { readProfiles }          = require('../storage/profiles');
            const profileForEngine = readProfiles().find(p => p.id === profileId);

            // ── Bug #4 fix: profile đã bị xóa → auto-disable schedule ─────────
            // Nếu profile không tồn tại trong danh sách, cron job này sẽ fail mãi mãi.
            // Giải pháp: tắt schedule.enabled trong scripts.json và hủy job.
            if (!profileForEngine) {
              appendLog('system', `scriptScheduler: [BUG#4] Profile "${profileId}" not found — auto-disabling schedule for script "${fresh.name}". Please reassign the schedule to an existing profile.`);
              try {
                const { saveScriptInternal } = require('../storage/scripts');
                await saveScriptInternal({
                  ...fresh,
                  schedule: { ...fresh.schedule, enabled: false },
                });
              } catch (saveErr) {
                appendLog('system', `scriptScheduler: failed to auto-disable schedule: ${saveErr?.message || saveErr}`);
              }
              cancelScript(fresh.id);
              return;
            }

            const profileEngine    = profileForEngine?.settings?.engine || 'playwright';
            const headless         = fresh.browserMode === 'headless';
            const launchResult     = await launchProfileInternal(profileId, { headless, engine: profileEngine });
            if (!launchResult?.success) {
              appendLog(profileId, `scriptScheduler: failed to launch profile — ${launchResult?.error || 'unknown'}`);
              return;
            }
            // Đợi 1.5 giây cho browser khởi động xong (giống logic trong IPC handler scripts-execute)
            await new Promise(r => setTimeout(r, 1500));
          } catch (e) {
            appendLog(profileId, `scriptScheduler: launch profile exception — ${e?.message || e}`);
            return;
          }
        }

        // ── runScriptWithFullChecks thay thế executeScript trực tiếp ──────────
        // Bug #1: ethical linter được áp dụng (trước đây scheduler bỏ qua hoàn toàn)
        // Bug #2: task log được ghi → scheduled runs hiển thị trong Task Logs UI
        // Bug #3: nếu script đang chạy → log rõ tick bị skip thay vì nuốt im lặng
        const result = await runScriptWithFullChecks(profileId, fresh.code, {
          scriptId:   fresh.id,
          scriptName: fresh.name,
          source:     'scheduler',
          timeoutMs:  120000,
        });

        if (result.skipped) {
          // Đã được log bên trong runScriptWithFullChecks, không cần log thêm
        } else if (!result.success) {
          appendLog(profileId, `scriptScheduler: script "${fresh.name}" ended with error: ${result.error}`);
        } else {
          appendLog(profileId, `scriptScheduler: script "${fresh.name}" completed OK`);
        }
      } catch (e) {
        // Bắt lỗi riêng bên trong callback để tránh crash toàn bộ cron system
        appendLog('system', `scriptScheduler: cron run error — ${e?.message || e}`);
      }
    });

    // Lưu job vào Map để có thể hủy về sau (khi script bị xóa hoặc tắt schedule)
    scriptJobs.set(script.id, job);
    appendLog('system', `scriptScheduler: scheduled script "${script.name}" with cron "${expr}"`);
  } catch (e) {
    // Lỗi khi tạo job (ví dụ: node-cron throw exception không mong đợi)
    appendLog('system', `scriptScheduler: failed to schedule "${script.name}" — ${e?.message || e}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// cancelScript(scriptId)
//
// Mục đích: Dừng cron job của một script và xóa nó khỏi Map.
// Được gọi khi:
//   - Script bị xóa khỏi danh sách
//   - Script tắt tính năng schedule (enabled = false)
//   - scheduleScript() cần reset lại job cũ trước khi tạo job mới
// ═══════════════════════════════════════════════════════════════════════════════
/**
 * Dừng và xóa cron job của một script.
 * @param {string} scriptId
 */
function cancelScript(scriptId) {
  const job = scriptJobs.get(scriptId);
  if (job) {
    // Dừng job — node-cron sẽ không gọi callback nữa sau khi stop()
    try { job.stop(); } catch {}

    // Xóa khỏi Map để giải phóng bộ nhớ và tránh tham chiếu đến job đã dừng
    scriptJobs.delete(scriptId);
    appendLog('system', `scriptScheduler: cancelled cron job for script "${scriptId}"`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// refreshAllScripts()
//
// Mục đích: Đọc lại toàn bộ scripts.json và đồng bộ lại tất cả cron jobs.
//
// Khi nào được gọi:
//   - Lúc app khởi động (Electron ready) — khôi phục tất cả lịch đã cài từ trước
//   - Sau khi người dùng thay đổi cấu hình schedule của nhiều script cùng lúc
//
// Quy trình:
//   1. Đọc toàn bộ scripts từ file
//   2. Hủy các job của script không còn tồn tại trong file (đã bị xóa)
//   3. Tạo/cập nhật job cho tất cả script còn lại
// ═══════════════════════════════════════════════════════════════════════════════
/**
 * Đọc lại toàn bộ scripts.json và đồng bộ lại tất cả cron jobs.
 * Gọi khi app khởi động hoặc sau khi có thay đổi lớn.
 */
function refreshAllScripts() {
  try {
    const { readScripts } = require('../storage/scripts');
    const scripts = readScripts();

    // Tập hợp các scriptId còn tồn tại trong file — dùng để phát hiện script đã bị xóa
    const activeIds = new Set(scripts.map(s => s.id));

    // Huỷ các job của script không còn tồn tại trong file
    // (ví dụ: script đã bị người dùng xóa trong khi app đang chạy)
    for (const [id] of [...scriptJobs.entries()]) {
      if (!activeIds.has(id)) cancelScript(id);
    }

    // Tạo mới hoặc cập nhật job cho mỗi script
    // scheduleScript() tự xử lý việc bỏ qua nếu script không cần schedule
    for (const script of scripts) {
      scheduleScript(script);
    }
  } catch (e) {
    appendLog('system', `scriptScheduler: refreshAllScripts error — ${e?.message || e}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// activeJobCount()
//
// Trả về số lượng cron job đang hoạt động hiện tại.
// UI dùng con số này để hiển thị badge "X schedules running" cho người dùng biết
// có bao nhiêu script đang được lên lịch chạy tự động.
// ═══════════════════════════════════════════════════════════════════════════════
/** Số lượng active cron jobs hiện tại */
function activeJobCount() { return scriptJobs.size; }

module.exports = { scheduleScript, cancelScript, refreshAllScripts, activeJobCount };
