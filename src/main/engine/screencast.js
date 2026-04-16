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
  if (!running || !running.context) {
    appendLog(profileId, '[screencast] Cannot start: no running context');
    return;
  }

  const handle = { active: true };

  handle.stop = () => {
    handle.active = false;
  };

  screencastLoops.set(profileId, handle);
  appendLog(profileId, `[screencast] Started (interval=${intervalMs}ms, JPEG q60)`);

  // Recursive loop — guarantees no overlap
  (async function loop() {
    while (handle.active) {
      const t0 = Date.now();
      try {
        // Get the current page — always re-fetch in case tabs changed
        const ctx = runningProfiles.get(profileId)?.context;
        if (!ctx) { handle.active = false; break; }

        const pages = ctx.pages();
        const page = pages && pages.length > 0 ? pages[0] : null;
        if (!page || page.isClosed()) {
          // No page available yet or page closed — wait and retry
          if (handle.active) await new Promise(r => setTimeout(r, intervalMs));
          continue;
        }

        const buf = await page.screenshot({
          type: 'jpeg',
          quality: 60,
          timeout: 2000,
        });

        if (handle.active && buf) {
          broadcastFrame(profileId, buf);
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

/**
 * Broadcast a JPEG frame to all WebSocket clients subscribed to this profile.
 */
function broadcastFrame(profileId, jpegBuffer) {
  if (!_wsBroadcast) return;
  try {
    // Convert to base64 for JSON transport
    const base64 = jpegBuffer.toString('base64');
    _wsBroadcast(profileId, base64);
  } catch { }
}

module.exports = {
  startScreencast,
  stopScreencast,
  stopAllScreencasts,
  isScreencasting,
  setWsBroadcast,
};
