/**
 * taskLogs.js — Storage for script execution task logs.
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { getDataRoot } = require("./paths");
const { appendLog } = require("../logging/logger");

const MAX_LOGS = 200; // Keep last 200 task logs

function taskLogsFilePath() {
  return path.join(getDataRoot(), "task-logs.json");
}

function readTaskLogs() {
  try {
    const p = taskLogsFilePath();
    if (!fs.existsSync(p)) return [];
    const raw = fs.readFileSync(p, "utf8");
    if (!raw.trim()) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    appendLog("system", `readTaskLogs error: ${e.message}`);
    return [];
  }
}

function writeTaskLogs(list) {
  try {
    const p = taskLogsFilePath();
    const tmp = p + ".tmp";
    // Keep only last MAX_LOGS entries
    const trimmed = list.slice(-MAX_LOGS);
    fs.writeFileSync(tmp, JSON.stringify(trimmed, null, 2));
    fs.renameSync(tmp, p);
    return true;
  } catch (e) {
    appendLog("system", `writeTaskLogs error: ${e.message}`);
    return false;
  }
}

function generateId() {
  try {
    return crypto.randomUUID();
  } catch {
    return crypto.randomBytes(16).toString("hex");
  }
}

/**
 * Add a new task log entry.
 * @param {Object} entry - task fields
 * @returns {{ success: boolean, taskLog: Object }}
 */
async function addTaskLog(entry) {
  try {
    const list = readTaskLogs();
    const now = new Date().toISOString();
    const taskLog = {
      id: entry.id || generateId(),
      profileId: entry.profileId || "",
      name: entry.name || entry.scriptName || "(unknown)",
      scriptType: entry.scriptType || entry._scriptType || "inline",
      scriptContent: entry.scriptContent || entry._scriptContent || "",
      headless: entry.headless !== undefined ? entry.headless : false,
      status: entry.status || "queued",
      output: entry.output || null,
      error: entry.error || null,
      createdAt: entry.createdAt || now,
      startedAt: entry.startedAt || null,
      completedAt: entry.completedAt || entry.finishedAt || null,
      // internal fields kept for script execution
      scriptId: entry.scriptId || "",
      logs: entry.logs || [],
    };
    list.push(taskLog);
    if (!writeTaskLogs(list)) return { success: false, error: "Persist error" };
    return { success: true, taskLog };
  } catch (e) {
    return { success: false, error: e?.message || String(e) };
  }
}

/**
 * Get all task logs (summary only — logs trimmed to last message).
 */
async function getTaskLogs() {
  return readTaskLogs()
    .reverse()
    .map((t) => ({
      ...t,
      logCount: (t.logs || []).length,
      lastLog: (t.logs || []).slice(-1)[0]?.message || "",
    }));
}

/**
 * Get a single task log with full logs.
 */
async function getTaskLogById(id) {
  const list = readTaskLogs();
  const found = list.find((t) => t.id === id);
  if (!found) return { success: false, error: "Task log not found" };
  return { success: true, taskLog: found };
}

/**
 * Delete a single task log by id.
 */
async function deleteTaskLog(id) {
  try {
    const list = readTaskLogs();
    const filtered = list.filter((t) => t.id !== id);
    if (filtered.length === list.length)
      return { success: false, error: "Task log not found" };
    if (!writeTaskLogs(filtered))
      return { success: false, error: "Persist error" };
    return { success: true };
  } catch (e) {
    return { success: false, error: e?.message || String(e) };
  }
}

/**
 * Update an existing task log entry by id.
 * @param {string} id
 * @param {Object} updates - partial fields to merge
 * @returns {{ success: boolean, taskLog?: Object }}
 */
async function updateTaskLog(id, updates) {
  try {
    const list = readTaskLogs();
    const idx = list.findIndex((t) => t.id === id);
    if (idx === -1) return { success: false, error: "Task not found" };
    list[idx] = { ...list[idx], ...updates };
    if (!writeTaskLogs(list)) return { success: false, error: "Persist error" };
    return { success: true, taskLog: list[idx] };
  } catch (e) {
    return { success: false, error: e?.message || String(e) };
  }
}

/**
 * Clear all task logs.
 */
async function clearTaskLogs() {
  if (!writeTaskLogs([])) return { success: false, error: "Persist error" };
  return { success: true };
}

module.exports = {
  addTaskLog,
  updateTaskLog,
  getTaskLogs,
  getTaskLogById,
  deleteTaskLog,
  clearTaskLogs,
};
