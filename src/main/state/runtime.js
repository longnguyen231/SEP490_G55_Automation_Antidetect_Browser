// Central runtime state holder

const crypto = require('crypto');

// { profileId -> { engine, wsEndpoint, server, browser, context, forwarder, headless, startedAt } }
// engine is always 'playwright' (CDP engine has been removed)
const runningProfiles = new Map();

// { profileId -> { status, instanceId, startedAt } }
// status: 'STARTING' | 'RUNNING' | 'STOPPING' | 'STOPPED' | 'ERROR'
const profileStatuses = new Map();

function generateInstanceId() {
  try { return crypto.randomBytes(8).toString('hex'); }
  catch { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
}

function setProfileStatus(profileId, status, instanceId) {
  if (status === 'STOPPED') {
    profileStatuses.delete(profileId);
  } else {
    const existing = profileStatuses.get(profileId);
    profileStatuses.set(profileId, {
      status,
      instanceId: instanceId || existing?.instanceId || generateInstanceId(),
      startedAt: existing?.startedAt || new Date().toISOString(),
    });
  }
}

function getProfileStatus(profileId) {
  return profileStatuses.get(profileId) || null;
}

function buildRunningMap() {
  const map = {};
  for (const [id, info] of runningProfiles.entries()) {
    // 'pipe' = truthy marker for Playwright pipe-mode (wsEndpoint is null)
    map[id] = info.wsEndpoint || 'pipe';
  }
  return map;
}

function buildStatusMap() {
  const map = {};
  for (const [id, data] of profileStatuses.entries()) {
    map[id] = { status: data.status, instanceId: data.instanceId };
  }
  // Also include running profiles that may not have explicit status yet
  for (const [id] of runningProfiles.entries()) {
    if (!map[id]) {
      map[id] = { status: 'RUNNING', instanceId: 'legacy' };
    }
  }
  return map;
}

module.exports = {
  runningProfiles,
  profileStatuses,
  generateInstanceId,
  setProfileStatus,
  getProfileStatus,
  buildRunningMap,
  buildStatusMap,
};
