const fs = require('fs');
const crypto = require('crypto');
const { auditLogPath } = require('../storage/paths');

/**
 * auditLogger.js — Cơ sở ghi chú hoạt động an toàn (Ethical Audit)
 * Ghi lại các hoạt động nhạy cảm hoặc nguy cấp của hệ thống để làm bằng chứng tuân thủ.
 */

// Hàm băm dòng log để đảm bảo không bị chỉnh sửa cục bộ (Immutable log signature)
function generateLogSignature(logString) {
  const secret = 'SEP490_G55_Ethical_Audit_Key_2026';
  return crypto.createHmac('sha256', secret).update(logString).digest('hex').substring(0, 16);
}

function appendAuditLog(action, details = '', profileId = 'SYSTEM') {
  try {
    const timestamp = new Date().toISOString();
    // Khử ký tự xuống dòng để một log luon nam tren 1 line
    const cleanDetails = String(details).replace(/\r?\n|\r/g, ' -- ');
    
    const rawLog = `[${timestamp}] [PROFILE:${profileId}] [ACTION:${action}] ${cleanDetails}`;
    const signature = generateLogSignature(rawLog);
    
    // Ghi đè file với chữ ký Hex
    const finalEntry = `${rawLog} [HASH:${signature}]\n`;
    fs.appendFileSync(auditLogPath(), finalEntry, 'utf8');
  } catch (e) {
    console.error('AuditLog Failed:', e);
  }
}

/**
 * Trích xuất file Audit
 * Gọi từ IPC system-export-audit
 */
function getAuditLogContent() {
  try {
    const path = auditLogPath();
    if (!fs.existsSync(path)) {
      return '';
    }
    return fs.readFileSync(path, 'utf8');
  } catch (e) {
    return `Error reading audit log: ${e.message}`;
  }
}

module.exports = { appendAuditLog, getAuditLogContent };
