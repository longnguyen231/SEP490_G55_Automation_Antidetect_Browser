// Central runtime state holder

const runningProfiles = new Map(); // { profileId -> { engine, wsEndpoint, childProc, server, browser, context, cdpControl? } }
const launchingProfiles = new Set(); // profileIds currently starting up (not yet in runningProfiles)

function buildRunningMap() {
  const map = {};
  for (const [id, info] of runningProfiles.entries()) {
    map[id] = info.wsEndpoint || null;
  }
  return map;
}

module.exports = { runningProfiles, launchingProfiles, buildRunningMap };
