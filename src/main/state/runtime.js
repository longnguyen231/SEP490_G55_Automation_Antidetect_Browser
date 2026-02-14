// Central runtime state holder

const runningProfiles = new Map(); // { profileId -> { engine, wsEndpoint, childProc, server, browser, context, cdpControl? } }

function buildRunningMap() {
  const map = {};
  for (const [id, info] of runningProfiles.entries()) {
    map[id] = info.wsEndpoint || null;
  }
  return map;
}

module.exports = { runningProfiles, buildRunningMap };
