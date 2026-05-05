// ═══════════════════════════════════════════════════════════════════════════
// scripts.js — Lưu trữ và quản lý danh sách automation scripts của người dùng.
// Dữ liệu được persist vào file JSON trên disk (đường dẫn do scriptsFilePath() trả về).
// Mỗi script bao gồm: tên, mô tả, code JavaScript, chế độ browser, và lịch chạy tự động.
// ═══════════════════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');
const crypto = require('crypto'); // Dùng để tạo ID ngẫu nhiên an toàn (cryptographically secure)
const { scriptsFilePath } = require('./paths');
const { appendLog } = require('../logging/logger');

// ─── Đọc toàn bộ danh sách scripts từ file JSON ───────────────────────────
function readScripts() {
  try {
    const p = scriptsFilePath();
    if (!fs.existsSync(p)) {
      // File chưa tồn tại lần đầu → tạo file rỗng để tránh lỗi ở lần đọc sau
      try { fs.writeFileSync(p, JSON.stringify([])); } catch {}
      return [];
    }
    const raw = fs.readFileSync(p, 'utf8');
    if (!raw.trim()) return []; // File rỗng hoặc chỉ có whitespace → trả mảng rỗng
    const parsed = JSON.parse(raw);
    // Đảm bảo dữ liệu đọc về luôn là mảng, tránh crash nếu file bị corrupt
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    appendLog('system', `readScripts error: ${e.message}`);
    return []; // Trả mảng rỗng thay vì throw để app không bị crash
  }
}

// ─── Ghi danh sách scripts xuống disk theo pattern atomic write ───────────
function writeScripts(list) {
  try {
    const p = scriptsFilePath();
    const tmp = p + '.tmp'; // Ghi vào file tạm trước để tránh corrupt file gốc nếu app crash giữa chừng
    fs.writeFileSync(tmp, JSON.stringify(list, null, 2));
    fs.renameSync(tmp, p); // rename() là atomic trên hầu hết OS → file gốc chỉ bị thay thế sau khi ghi xong hoàn toàn
    return true;
  } catch (e) {
    appendLog('system', `writeScripts error: ${e.message}`);
    return false; // Caller dựa vào giá trị này để biết có lỗi persist không
  }
}

// ─── Tạo ID ngẫu nhiên dạng hex cho script mới ────────────────────────────
function generateId() {
  try {
    // Ưu tiên dùng crypto.randomBytes để đảm bảo tính ngẫu nhiên và tránh collision
    return crypto.randomBytes(6).toString('hex'); // Cho ra 12 ký tự hex (VD: "a3f9c021b8e4")
  } catch {
    // Fallback khi crypto không khả dụng (môi trường đặc biệt): dùng Math.random
    // Ít an toàn hơn nhưng vẫn đủ dùng cho mục đích tạo ID nội bộ
    return Math.random().toString(36).slice(2, 10);
  }
}

// ─── Chuẩn hóa và validate dữ liệu đầu vào của script ────────────────────
// input: dữ liệu mới gửi lên từ UI hoặc IPC
// existing: bản ghi hiện tại trong DB (null nếu tạo mới)
// → Kết hợp input + existing để tránh mất dữ liệu khi update một phần
function sanitizeScript(input = {}, existing = null) {
  const base = existing || {}; // Nếu không có bản ghi cũ, base là object rỗng

  const id = input.id || base.id || null; // ID giữ nguyên nếu đã có, null nếu tạo mới

  // Tên script: bắt buộc là string, trim whitespace, giới hạn 128 ký tự để tránh tên quá dài
  const name = String(input.name ?? base.name ?? '').trim().slice(0, 128);

  // Mô tả: không bắt buộc, giới hạn 1000 ký tự để tránh lưu trữ quá lớn
  const description = String(input.description ?? base.description ?? '').slice(0, 1000);

  // Ngôn ngữ hiện tại chỉ hỗ trợ JavaScript, hardcode để đảm bảo tính nhất quán
  const language = 'javascript';

  const code = String(input.code ?? base.code ?? ''); // Nội dung script, không giới hạn độ dài

  // Chế độ browser: 'visible' (hiển thị cửa sổ) hoặc 'headless' (chạy ngầm)
  const browserMode = input.browserMode ?? base.browserMode ?? 'visible';

  // Validate riêng phần schedule vì cấu trúc lồng nhau phức tạp hơn các field khác
  // Dùng ?? để fallback về giá trị cũ nếu input không truyền field này
  const schedule = {
    enabled: !!(input.schedule?.enabled ?? base.schedule?.enabled), // Ép kiểu boolean, tránh truthy/falsy không rõ ràng
    cron: String(input.schedule?.cron ?? base.schedule?.cron ?? ''),         // Biểu thức cron (VD: "0 9 * * 1-5")
    profileId: String(input.schedule?.profileId ?? base.schedule?.profileId ?? ''), // Profile browser sẽ chạy script này
  };

  // createdAt: chỉ set một lần khi tạo mới, không bao giờ overwrite khi update
  const createdAt = base.createdAt || new Date().toISOString();
  // updatedAt: luôn cập nhật mỗi khi save để tracking lịch sử thay đổi
  const updatedAt = new Date().toISOString();

  return { id, name, description, language, code, browserMode, schedule, createdAt, updatedAt };
}

// ─── API nội bộ: lấy toàn bộ danh sách scripts ────────────────────────────
async function listScriptsInternal() { return readScripts(); }

// ─── API nội bộ: lấy một script theo ID ────────────────────────────────────
async function getScriptInternal(id) {
  const list = readScripts();
  const s = list.find(x => x.id === id);
  if (!s) return { success: false, error: 'Script not found' };
  return { success: true, script: s };
}

// ─── API nội bộ: tạo mới hoặc cập nhật script ─────────────────────────────
async function saveScriptInternal(input) {
  try {
    if (!input || typeof input !== 'object') return { success: false, error: 'Invalid payload' };
    const list = readScripts();

    if (input.id) {
      // Có ID → tìm bản ghi hiện tại để update
      const idx = list.findIndex(x => x.id === input.id);
      if (idx === -1) {
        // ID được truyền nhưng không tồn tại trong DB → tạo mới với ID đó (upsert behavior)
        const prepared = sanitizeScript(input, null);
        prepared.id = input.id; // Giữ nguyên ID được chỉ định từ bên ngoài
        list.push(prepared);
      } else {
        // Merge input vào bản ghi cũ: sanitizeScript đảm bảo không mất dữ liệu field nào
        list[idx] = sanitizeScript(input, list[idx]);
      }
    } else {
      // Không có ID → tạo script mới với ID tự sinh
      const prepared = sanitizeScript(input, null);
      let id = generateId();
      const ids = new Set(list.map(x => x.id)); // Tập hợp tất cả ID hiện có để kiểm tra trùng
      // Vòng lặp đề phòng collision (xác suất rất thấp nhưng cần xử lý đúng)
      while (ids.has(id)) id = generateId();
      prepared.id = id;
      list.push(prepared);
      input.id = id; // Gán lại vào input để dùng ở dưới khi tìm lại bản ghi vừa lưu
    }

    if (!writeScripts(list)) return { success: false, error: 'Persist error' };

    // Trả về bản ghi sau khi đã lưu để UI có thể cập nhật state
    const s = list.find(x => x.id === input.id);
    return { success: true, script: s };
  } catch (e) { return { success: false, error: e?.message || String(e) }; }
}

// ─── API nội bộ: xóa script theo ID ───────────────────────────────────────
async function deleteScriptInternal(id) {
  try {
    const list = readScripts();
    const filtered = list.filter(x => x.id !== id); // Loại bỏ script có ID khớp
    if (filtered.length === list.length) return { success: false, error: 'Script not found' }; // Không tìm thấy gì để xóa
    if (!writeScripts(filtered)) return { success: false, error: 'Persist error' };
    return { success: true };
  } catch (e) { return { success: false, error: e?.message || String(e) }; }
}

module.exports = {
  listScriptsInternal,
  getScriptInternal,
  saveScriptInternal,
  deleteScriptInternal,
  // Export readScripts/writeScripts để các module khác (VD: migration, backup) có thể dùng trực tiếp
  readScripts,
  writeScripts,
};
