/**
 * ScreencastManager — Per-profile screenshot streaming for headless live preview.
 *
 * Uses recursive setTimeout (NOT setInterval) to avoid overlap when
 * page.screenshot() takes longer than the interval.
 *
 * Architecture:
 *   startScreencast(profileId)  → begins loop, stores handle
 *   stopScreencast(profileId)   → sets active=false, loop exits
 *   broadcastFrame(profileId, buf) → sends JPEG buffer to subscribed WS clients
 */

const { runningProfiles } = require('../state/runtime');
const { appendLog } = require('../logging/logger');

// Active screenshot loops: profileId → { active: boolean, stop: () => void }
const screencastLoops = new Map();

// Per-profile frame counters for periodic logging
const _frameCounters = new Map();

// Reference to the WebSocket broadcast function (set by restServer after init)
let _wsBroadcast = null;

/**
 * Register the WebSocket broadcast function.
 * Called once during bootstrap after the WS server is attached.
 */
function setWsBroadcast(fn) {
  _wsBroadcast = fn;
}

/**
 * Start a screenshot streaming loop for a headless profile.
 * No-op if already streaming for this profileId.
 */
function startScreencast(profileId, intervalMs = 400) {
  if (screencastLoops.has(profileId)) {
    const existing = screencastLoops.get(profileId);
    if (existing.active) return; // already streaming
  }

  const running = runningProfiles.get(profileId);
  appendLog(profileId, `[screencast] startScreencast called: engine=${running?.engine || 'N/A'} ctx=${!!running?.context} wsBroadcast=${!!_wsBroadcast}`);
  if (!running || !running.context) {
    appendLog(profileId, '[screencast] Cannot start: no running context');
    return;
  }

  const handle = { active: true };

  handle.stop = () => {
    handle.active = false;
  };

  screencastLoops.set(profileId, handle);
  _frameCounters.set(profileId, 0);
  appendLog(profileId, `[screencast] Started (interval=${intervalMs}ms, JPEG q60)`);

  // Recursive loop — guarantees no overlap
  (async function loop() {
    while (handle.active) {
      const t0 = Date.now();
      try {
        // Get the current page — always re-fetch in case tabs changed
        const ctx = runningProfiles.get(profileId)?.context;
        if (!ctx) { handle.active = false; break; }

        const allPages = ctx.pages().filter(p => !p.isClosed());
        // Prefer a page with a real URL over about:blank
        const page = allPages.find(p => p.url() !== 'about:blank' && p.url() !== '') || allPages[0] || null;
        if (!page || page.isClosed()) {
          // No page available yet or page closed — wait and retry
          if (handle.active) await new Promise(r => setTimeout(r, intervalMs));
          continue;
        }

        const buf = await page.screenshot({
          type: 'jpeg',
          quality: 60,
          timeout: 5000,
        });

        if (handle.active && buf) {
          broadcastFrame(profileId, buf);
          // Periodic frame counter log
          const cnt = (_frameCounters.get(profileId) || 0) + 1;
          _frameCounters.set(profileId, cnt);
          if (cnt === 1) {
            appendLog(profileId, `[screencast] First frame captured (page: ${page.url().substring(0, 80)})`);
          } else if (cnt % 50 === 0) {
            appendLog(profileId, `[screencast] ${cnt} frames captured`);
          }
        }
      } catch (e) {
        const msg = e?.message || String(e);
        // Fatal errors — stop the loop
        if (/closed|crashed|detached|Target/i.test(msg)) {
          appendLog(profileId, `[screencast] Fatal error, stopping: ${msg}`);
          handle.active = false;
          break;
        }
        // Transient errors (timeout, navigation) — log once and continue
        // Don't spam logs — only log timeouts occasionally
        if (/timeout/i.test(msg)) {
          // silently continue
        } else {
          appendLog(profileId, `[screencast] Transient error: ${msg}`);
        }
      }

      // Wait before next capture — subtract elapsed time to maintain target FPS
      const elapsed = Date.now() - t0;
      const wait = Math.max(50, intervalMs - elapsed);
      if (handle.active) {
        await new Promise(r => setTimeout(r, wait));
      }
    }

    // Loop exited — cleanup
    screencastLoops.delete(profileId);
    _frameCounters.delete(profileId);
    appendLog(profileId, '[screencast] Stopped');
  })();
}

/**
 * Stop the screenshot loop for a profile.
 */
function stopScreencast(profileId) {
  const handle = screencastLoops.get(profileId);
  if (handle) {
    handle.active = false;
    // Loop will exit on next iteration and delete itself from the map
  }
}

/**
 * Stop all active screenshot loops (for shutdown).
 */
function stopAllScreencasts() {
  for (const [id, handle] of screencastLoops.entries()) {
    handle.active = false;
  }
}

/**
 * Check if a profile is currently streaming.
 */
function isScreencasting(profileId) {
  const handle = screencastLoops.get(profileId);
  return !!(handle && handle.active);
}

let _wsBroadcastWarnedNull = false;

function broadcastFrame(profileId, jpegBuffer) {
  if (!_wsBroadcast) {
    if (!_wsBroadcastWarnedNull) {
      appendLog(profileId, '[screencast] broadcastFrame: _wsBroadcast not registered — frames will be dropped until WS server starts');
      _wsBroadcastWarnedNull = true;
    }
    return;
  }
  _wsBroadcastWarnedNull = false; // reset once broadcast is available
  try {
    // Convert to base64 for JSON transport
    const base64 = jpegBuffer.toString('base64');
    _wsBroadcast(profileId, base64);
  } catch (e) {
    appendLog(profileId, `[screencast] broadcastFrame error: ${e?.message || e}`);
  }
}

module.exports = {
  startScreencast,
  stopScreencast,
  stopAllScreencasts,
  isScreencasting,
  setWsBroadcast,
};
