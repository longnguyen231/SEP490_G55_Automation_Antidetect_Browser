/**
 * scriptModules.js — Quản lý các npm package mà người dùng cài thêm để dùng trong automation scripts.
 * Packages được cài vào thư mục riêng biệt: {dataRoot}/script-modules/
 * → Hoàn toàn tách biệt khỏi node_modules của app, tránh xung đột phiên bản.
 * Khi script chạy, scriptRuntime.js sẽ dùng getModulesDir() để resolve require() trong sandbox.
 */

const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process'); // Dùng spawn thay vì exec để kiểm soát tốt hơn (không qua shell buffer)
const { getDataRoot } = require('./paths');
const { appendLog } = require('../logging/logger');

// ─── Lấy đường dẫn thư mục chứa script modules, tự tạo nếu chưa có ────────
// Hàm này được gọi trước mọi thao tác để đảm bảo thư mục và package.json luôn tồn tại
function getModulesDir() {
  const dir = path.join(getDataRoot(), 'script-modules'); // Thư mục riêng, không phải node_modules của app
  fs.mkdirSync(dir, { recursive: true }); // Tạo toàn bộ cây thư mục nếu chưa có, không throw nếu đã tồn tại

  const pkgPath = path.join(dir, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    // Khởi tạo package.json tối thiểu để npm có thể chạy --save trong thư mục này
    // private: true → ngăn publish nhầm lên npm registry
    // dependencies: {} → npm sẽ ghi vào đây khi install/uninstall
    fs.writeFileSync(pkgPath, JSON.stringify({ name: 'script-modules', version: '1.0.0', private: true, dependencies: {} }, null, 2));
  }
  return dir;
}

// ─── Liệt kê tất cả package đã cài, đọc từ dependencies trong package.json ─
// Dùng package.json làm nguồn sự thật thay vì scan node_modules để đảm bảo chính xác
function listModules() {
  try {
    const dir = getModulesDir();
    const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
    const deps = pkg.dependencies || {}; // Nếu chưa có dependencies thì mặc định là object rỗng
    return Object.entries(deps).map(([name, version]) => ({
      name,
      // Loại bỏ ký tự prefix (^ hoặc ~) trong version string để trả về phiên bản thuần (VD: "^1.2.3" → "1.2.3")
      version: version.replace(/^[\^~]/, ''),
    }));
  } catch (e) {
    appendLog('system', `scriptModules listModules error: ${e.message}`);
    return []; // Trả mảng rỗng thay vì throw để UI vẫn hiển thị được
  }
}

// ─── Chạy lệnh npm với các tham số cho trước trong thư mục chỉ định ─────────
// Trả về Promise<{ ok: boolean, error?: string }> để caller xử lý kết quả
function runNpm(args, cwd) {
  return new Promise((resolve) => {
    const proc = spawn('npm', args, {
      cwd,           // Chạy npm trong thư mục script-modules để --save ghi đúng vào package.json của thư mục đó
      shell: true,   // Cần shell: true trên Windows để npm (script batch) chạy được
      timeout: 120000, // Timeout 2 phút — cài package lớn có thể mất nhiều thời gian
      env: { ...process.env, NODE_ENV: 'production' }, // Bỏ devDependencies, chỉ cài production packages
    });
    let stderr = '';
    proc.stderr.on('data', d => { stderr += d.toString(); }); // Thu thập stderr để báo lỗi chi tiết cho người dùng
    proc.on('error', (e) => resolve({ ok: false, error: e.message })); // Lỗi spawn (VD: npm không tìm thấy trong PATH)
    proc.on('close', (code) => {
      if (code === 0) resolve({ ok: true });
      else resolve({ ok: false, error: stderr.slice(0, 500) || `npm exited with code ${code}` }); // Giới hạn 500 ký tự stderr để tránh log quá dài
    });
  });
}

// ─── Cài đặt một npm package vào thư mục script-modules ───────────────────
function installModule(packageName) {
  return new Promise(async (resolve) => {
    try {
      // Validate tên package bằng regex TRƯỚC KHI truyền vào lệnh npm
      // Mục đích bảo mật: ngăn shell injection nếu tên package chứa ký tự đặc biệt như `;`, `&`, `|`, `..`
      // Regex cho phép: tên thông thường, scoped package (@scope/name), và version tag (name@version)
      if (!packageName || typeof packageName !== 'string' || !/^[@a-zA-Z0-9._\-/]+(@[\w.\-]+)?$/.test(packageName.trim())) {
        return resolve({ success: false, error: 'Invalid package name' });
      }
      const dir = getModulesDir();
      appendLog('system', `Script modules: installing "${packageName}"...`);
      // --save: tự động cập nhật dependencies trong package.json → listModules() sẽ phản ánh đúng
      const result = await runNpm(['install', '--save', packageName.trim()], dir);
      if (result.ok) {
        appendLog('system', `Script modules: "${packageName}" installed OK`);
        resolve({ success: true, modules: listModules() }); // Trả về danh sách cập nhật ngay sau khi cài xong
      } else {
        appendLog('system', `Script modules: install "${packageName}" failed — ${result.error}`);
        resolve({ success: false, error: result.error });
      }
    } catch (e) {
      resolve({ success: false, error: e.message });
    }
  });
}

// ─── Gỡ cài đặt một npm package khỏi thư mục script-modules ──────────────
function uninstallModule(packageName) {
  return new Promise(async (resolve) => {
    try {
      const dir = getModulesDir();
      appendLog('system', `Script modules: uninstalling "${packageName}"...`);
      // npm uninstall tự động xóa khỏi dependencies trong package.json (không cần --save với npm v5+)
      const result = await runNpm(['uninstall', packageName.trim()], dir);
      if (result.ok) {
        appendLog('system', `Script modules: "${packageName}" uninstalled OK`);
        resolve({ success: true, modules: listModules() }); // Trả về danh sách sau khi gỡ để UI cập nhật ngay
      } else {
        appendLog('system', `Script modules: uninstall "${packageName}" failed — ${result.error}`);
        resolve({ success: false, error: result.error });
      }
    } catch (e) {
      resolve({ success: false, error: e.message });
    }
  });
}

module.exports = {
  getModulesDir,    // Được dùng bởi scriptRuntime.js để cấu hình Module._resolveFilename() cho sandbox
  listModules,      // Được dùng bởi IPC handler để hiển thị danh sách package trong UI
  installModule,    // Được dùng bởi IPC handler khi người dùng nhấn "Install"
  uninstallModule,  // Được dùng bởi IPC handler khi người dùng nhấn "Uninstall"
};
