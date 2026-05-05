// ═══════════════════════════════════════════════════════════════════════════════
// taskLogs.js — Lưu trữ lịch sử thực thi của từng lần chạy script
//
// Mục đích:
//   Mỗi lần người dùng (hoặc cron scheduler) chạy một script, hệ thống tạo
//   một task log entry để ghi lại: script nào chạy, profile nào, kết quả ra sao,
//   lỗi gì xảy ra. Người dùng có thể xem lại lịch sử này trong tab "Task Logs".
//
// Các trạng thái (status) của một task log:
//   'queued'    — script đã được thêm vào hàng đợi, chờ chạy
//   'running'   — script đang thực thi
//   'completed' — script kết thúc thành công
//   'error'     — script gặp lỗi trong quá trình chạy
//   'stopped'   — người dùng dừng script thủ công trước khi hoàn thành
//
// Cấu trúc file: task-logs.json (mảng JSON, tối đa MAX_LOGS entries)
// ═══════════════════════════════════════════════════════════════════════════════

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// Lấy đường dẫn thư mục data của app (khác nhau giữa dev và production)
const { getDataRoot } = require("./paths");

// Logger dùng chung — ghi lỗi hệ thống khi đọc/ghi file thất bại
const { appendLog } = require("../logging/logger");

// ═══════════════════════════════════════════════════════════════════════════════
// Giới hạn số lượng log được lưu
//
// Tại sao giới hạn 200?
//   - Tránh file task-logs.json phình to không kiểm soát theo thời gian
//   - Mỗi entry có thể chứa nhiều dòng output → dung lượng tăng nhanh
//   - 200 entry là đủ để xem lại lịch sử gần đây mà không tốn quá nhiều disk
//   - Khi vượt quá giới hạn, entry cũ nhất bị xóa (FIFO rotation)
// ═══════════════════════════════════════════════════════════════════════════════
const MAX_LOGS = 200; // Chỉ giữ 200 task log gần nhất

// ─── Đường dẫn file lưu trữ ───────────────────────────────────────────────────
// Hàm thay vì biến constant để đảm bảo getDataRoot() được gọi sau khi app init xong
function taskLogsFilePath() {
  return path.join(getDataRoot(), "task-logs.json");
}

// ═══════════════════════════════════════════════════════════════════════════════
// readTaskLogs() — Đọc toàn bộ danh sách task logs từ file
//
// Xử lý an toàn các trường hợp đặc biệt:
//   - File chưa tồn tại (lần đầu chạy app) → trả mảng rỗng
//   - File rỗng hoặc bị lỗi JSON → trả mảng rỗng thay vì crash
// ═══════════════════════════════════════════════════════════════════════════════
function readTaskLogs() {
  try {
    const p = taskLogsFilePath();

    // File chưa tồn tại là bình thường (app mới cài, chưa có lịch sử)
    if (!fs.existsSync(p)) return [];

    const raw = fs.readFileSync(p, "utf8");

    // File rỗng hoặc chỉ có whitespace → trả mảng rỗng
    if (!raw.trim()) return [];

    const parsed = JSON.parse(raw);

    // Đảm bảo dữ liệu parse ra là mảng — tránh lỗi nếu file bị corrupt thành object
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    appendLog("system", `readTaskLogs error: ${e.message}`);
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// writeTaskLogs(list) — Ghi danh sách task logs ra file (atomic write)
//
// Pattern atomic write: ghi vào file tạm (.tmp) trước, sau đó rename thành file thật.
// Lý do dùng atomic write:
//   - Nếu app crash giữa chừng khi đang ghi, file .tmp bị hỏng thì file gốc vẫn còn nguyên
//   - rename() trên cùng ổ đĩa là atomic — không bao giờ có trạng thái "ghi dở"
//   - Tránh tình huống file bị truncate (rỗng) khi app đột ngột tắt giữa chừng
//
// FIFO rotation:
//   - slice(-MAX_LOGS) giữ lại MAX_LOGS entry cuối (mới nhất)
//   - Các entry cũ nhất (đầu mảng) bị loại bỏ tự động khi vượt giới hạn
// ═══════════════════════════════════════════════════════════════════════════════
function writeTaskLogs(list) {
  try {
    const p = taskLogsFilePath();

    // File tạm dùng để ghi — nếu ghi thành công mới rename thành file thật
    const tmp = p + ".tmp";

    // Cắt bớt: chỉ giữ MAX_LOGS entry cuối cùng (entry cũ nhất bị drop)
    const trimmed = list.slice(-MAX_LOGS);

    // Ghi JSON với indent 2 để dễ đọc khi debug thủ công
    fs.writeFileSync(tmp, JSON.stringify(trimmed, null, 2));

    // Atomic rename: thay thế file cũ bằng file tạm vừa ghi xong
    fs.renameSync(tmp, p);
    return true;
  } catch (e) {
    appendLog("system", `writeTaskLogs error: ${e.message}`);
    return false;
  }
}

// ─── Sinh ID duy nhất cho mỗi task log entry ──────────────────────────────────
// Ưu tiên randomUUID() (Node 14.17+), fallback về randomBytes nếu không có
function generateId() {
  try {
    return crypto.randomUUID();
  } catch {
    return crypto.randomBytes(16).toString("hex");
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// addTaskLog(entry) — Tạo mới một task log entry
//
// Được gọi ngay khi một script bắt đầu được xếp hàng chạy (status = 'queued').
// Các field quan trọng:
//   id          — UUID duy nhất để tra cứu và cập nhật về sau
//   profileId   — profile browser nào sẽ chạy script này
//   scriptId    — script nào (dùng để liên kết với script gốc)
//   status      — trạng thái ban đầu thường là 'queued'
//   startedAt   — thời điểm bắt đầu thực thi thực sự (null khi còn queued)
//   completedAt — thời điểm kết thúc (null khi chưa xong)
//   logs        — mảng các dòng output từ script (được bổ sung qua updateTaskLog)
// ═══════════════════════════════════════════════════════════════════════════════
/**
 * Add a new task log entry.
 * @param {Object} entry - task fields
 * @returns {{ success: boolean, taskLog: Object }}
 */
async function addTaskLog(entry) {
  try {
    // Đọc danh sách hiện tại trước khi thêm (read-modify-write)
    const list = readTaskLogs();
    const now = new Date().toISOString();

    // Tạo entry chuẩn hóa — map các field từ entry đầu vào, có giá trị mặc định an toàn
    const taskLog = {
      id: entry.id || generateId(),                                          // ID duy nhất
      profileId: entry.profileId || "",                                      // Profile browser được chỉ định
      name: entry.name || entry.scriptName || "(unknown)",                   // Tên script hiển thị
      scriptType: entry.scriptType || entry._scriptType || "inline",         // Loại script (inline / file)
      scriptContent: entry.scriptContent || entry._scriptContent || "",      // Nội dung code (snapshot tại thời điểm chạy)
      headless: entry.headless !== undefined ? entry.headless : false,       // Có chạy ẩn không
      status: entry.status || "queued",                                      // Trạng thái ban đầu
      output: entry.output || null,                                          // Output tổng hợp (nếu có)
      error: entry.error || null,                                            // Thông báo lỗi (nếu có)
      createdAt: entry.createdAt || now,                                     // Thời điểm tạo entry này
      startedAt: entry.startedAt || null,                                    // Thời điểm thực sự bắt đầu chạy
      completedAt: entry.completedAt || entry.finishedAt || null,            // Thời điểm kết thúc
      // Field nội bộ — dùng để liên kết với script gốc khi cần lookup
      scriptId: entry.scriptId || "",
      logs: entry.logs || [],                                                // Mảng các dòng log từ script
    };

    // Thêm entry mới vào cuối mảng (FIFO: entry mới nhất ở cuối)
    list.push(taskLog);

    // Ghi xuống file — writeTaskLogs tự xử lý rotation và atomic write
    if (!writeTaskLogs(list)) return { success: false, error: "Persist error" };
    return { success: true, taskLog };
  } catch (e) {
    return { success: false, error: e?.message || String(e) };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// getTaskLogs() — Lấy danh sách task logs (dạng tóm tắt, không có full logs[])
//
// Trả về danh sách đảo ngược (mới nhất lên đầu) để UI hiển thị history đúng thứ tự.
//
// Tại sao không trả full logs[] trong danh sách?
//   - Mỗi script có thể sinh ra hàng trăm dòng log → tốn băng thông IPC
//   - UI chỉ cần hiển thị tóm tắt trong bảng danh sách (status, tên, thời gian)
//   - Khi người dùng click vào 1 entry cụ thể mới cần full logs → dùng getTaskLogById
//
// Thay vì logs[], trả về:
//   logCount — tổng số dòng log (để UI hiển thị badge số)
//   lastLog  — dòng log cuối cùng (để preview nhanh kết quả)
// ═══════════════════════════════════════════════════════════════════════════════
/**
 * Get all task logs (summary only — logs trimmed to last message).
 */
async function getTaskLogs() {
  return readTaskLogs()
    .reverse() // Đảo ngược: entry mới nhất lên đầu để UI hiển thị theo thứ tự giảm dần thời gian
    .map((t) => ({
      ...t,
      // Thay thế mảng logs[] đầy đủ bằng 2 field tóm tắt để giảm kích thước response
      logCount: (t.logs || []).length,            // Số dòng log (hiển thị badge)
      lastLog: (t.logs || []).slice(-1)[0]?.message || "", // Dòng log cuối cùng (preview)
    }));
}

// ═══════════════════════════════════════════════════════════════════════════════
// getTaskLogById(id) — Lấy chi tiết đầy đủ của một task log
//
// Khác với getTaskLogs(), hàm này trả về toàn bộ mảng logs[] không bị cắt.
// Được gọi khi người dùng mở dialog xem chi tiết output của một lần chạy.
// ═══════════════════════════════════════════════════════════════════════════════
/**
 * Get a single task log with full logs.
 */
async function getTaskLogById(id) {
  const list = readTaskLogs();
  const found = list.find((t) => t.id === id);
  if (!found) return { success: false, error: "Task log not found" };
  return { success: true, taskLog: found };
}

// ═══════════════════════════════════════════════════════════════════════════════
// deleteTaskLog(id) — Xóa một task log cụ thể theo id
//
// Dùng khi người dùng muốn xóa thủ công một entry khỏi lịch sử.
// ═══════════════════════════════════════════════════════════════════════════════
/**
 * Delete a single task log by id.
 */
async function deleteTaskLog(id) {
  try {
    const list = readTaskLogs();

    // Lọc ra tất cả entry trừ entry cần xóa
    const filtered = list.filter((t) => t.id !== id);

    // Nếu độ dài không thay đổi → không tìm thấy entry với id đó
    if (filtered.length === list.length)
      return { success: false, error: "Task log not found" };

    if (!writeTaskLogs(filtered))
      return { success: false, error: "Persist error" };
    return { success: true };
  } catch (e) {
    return { success: false, error: e?.message || String(e) };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// updateTaskLog(id, updates) — Cập nhật một task log entry theo id
//
// Được gọi nhiều lần trong vòng đời của một lần chạy script:
//   1. Khi script bắt đầu thực sự: cập nhật status = 'running', startedAt = now
//   2. Khi script sinh output: append thêm dòng vào logs[]
//   3. Khi script kết thúc thành công: status = 'completed', completedAt = now
//   4. Khi script gặp lỗi: status = 'error', error = message
//   5. Khi người dùng dừng: status = 'stopped'
//
// Pattern: read-modify-write toàn bộ file mỗi lần update
// (chấp nhận được vì MAX_LOGS = 200, file nhỏ, không phải hot path)
// ═══════════════════════════════════════════════════════════════════════════════
/**
 * Update an existing task log entry by id.
 * @param {string} id
 * @param {Object} updates - partial fields to merge
 * @returns {{ success: boolean, taskLog?: Object }}
 */
async function updateTaskLog(id, updates) {
  try {
    const list = readTaskLogs();

    // Tìm vị trí entry cần cập nhật trong mảng
    const idx = list.findIndex((t) => t.id === id);
    if (idx === -1) return { success: false, error: "Task not found" };

    // Merge: giữ nguyên các field cũ, ghi đè bằng các field trong updates
    list[idx] = { ...list[idx], ...updates };

    // Ghi toàn bộ danh sách trở lại file (atomic write)
    if (!writeTaskLogs(list)) return { success: false, error: "Persist error" };
    return { success: true, taskLog: list[idx] };
  } catch (e) {
    return { success: false, error: e?.message || String(e) };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// clearTaskLogs() — Xóa toàn bộ lịch sử task logs
//
// Người dùng dùng khi muốn "dọn sạch" lịch sử.
// Ghi mảng rỗng xuống file (vẫn dùng atomic write qua writeTaskLogs).
// ═══════════════════════════════════════════════════════════════════════════════
/**
 * Clear all task logs.
 */
async function clearTaskLogs() {
  if (!writeTaskLogs([])) return { success: false, error: "Persist error" };
  return { success: true };
}

// ─── Export các hàm public ────────────────────────────────────────────────────
module.exports = {
  addTaskLog,      // Tạo log mới khi script bắt đầu chạy
  updateTaskLog,   // Cập nhật trạng thái trong quá trình chạy
  getTaskLogs,     // Lấy danh sách tóm tắt (UI hiển thị bảng lịch sử)
  getTaskLogById,  // Lấy chi tiết đầy đủ (UI hiển thị dialog output)
  deleteTaskLog,   // Xóa một entry cụ thể
  clearTaskLogs,   // Xóa toàn bộ lịch sử
};
