# Project Research Summary

**Project:** SEP490 G55 - Automation Antidetect Browser
**Milestone:** v1.0 Screenshot / Live Screen Stabilization
**Domain:** Electron desktop app - headless browser screenshot streaming via WebSocket
**Researched:** 2026-04-25
**Confidence:** HIGH

---

## Executive Summary

This is a bug-fix milestone on a brownfield Electron 33 + React 18 + rebrowser-playwright codebase. The full screenshot-streaming pipeline is already scaffolded: `screencast.js` produces JPEG frames, `restServer.js` hosts a ws-over-Fastify WebSocket server on port 4000, and `LivePreviewPanel.jsx` receives frames and binds them to an `<img>` ref. The panel is blank not because anything is missing, but because multiple silent wiring failures block frames from ever reaching the renderer. Zero new packages are required.

Four root causes collectively explain the blank panel with HIGH confidence. The primary cause is that CDP-engine profiles store no `context` field in `runningProfiles`, so `startScreencast()` silently exits at its first guard (`screencast.js:41`). Secondary causes are: `_wsBroadcast` remaining null when the REST server is disabled or slow to start; the renderer calling `startPreview` IPC before the WS subscribe message arrives (race); and no automatic lifecycle hook to start or stop the screencast when a profile transitions to RUNNING or STOPPED. A fifth, lower-risk cause is a React `display:none` gate on the `<img>` element that may lag behind the first frame if `setFrameCount` state update is batched.

The recommended fix sequence is strictly ordered by dependency: (1) add diagnostic logging to identify exactly which link in the chain is broken; (2) fix the screenshot loop and lifecycle wiring in `screencast.js` and `controllers/profiles.js`; (3) stabilize the WebSocket transport in `restServer.js`; (4) verify the renderer `LivePreviewPanel.jsx` display gate; (5) harden error handling and clean up silent catch blocks. No architectural changes are needed - only targeted fixes in four existing files.

---

## Key Findings

### Recommended Stack

No new packages required. All dependencies are already installed and verified: `ws@8.20.0` (WebSocket server, noServer mode on Fastify), `rebrowser-playwright@1.58.2` (aliased as `playwright`, provides `page.screenshot()`), `fastify@5.8.2` (HTTP server on port 4000, exposes `.server` as `http.Server`), Electron 33.4.11 (ships Node 20.18.x), and React 18.3.1. The base64-over-JSON-over-WebSocket transport is correct and must not be changed.

**Core technologies - all existing, no changes needed:**

- `ws@8.20.0`: WebSocket server in noServer mode sharing port 4000 with Fastify - already wired in `restServer.js:2113`
- `rebrowser-playwright@1.58.2`: `page.screenshot({ type: 'jpeg', quality: 60, timeout: 2000 })` produces JPEG Buffer directly - already used in `screencast.js`
- `fastify@5.8.2`: Exposes `appx.server` (verified as `http.Server`) which emits `upgrade` events - already used
- Node 20 built-ins (`Buffer`, `URL`, `http.Server`): base64 encoding, URL routing for `/preview` - no extra deps
- React 18 `imgRef`: Direct DOM mutation for frame assignment bypasses React re-render overhead - already implemented correctly

**What NOT to add:** `socket.io`, `sharp`, `@fastify/websocket`, `express-ws`, `canvas`, `binary-parser`. Each would require breaking changes to the renderer or introduce unnecessary scope.

### Expected Features

The five pipeline segments each map to a table-stakes fix. The renderer differentiator features (FPS counter, status badge, staleness indicator) are already coded in `LivePreviewPanel.jsx` and will activate automatically once upstream frames arrive.

**Must have - table stakes (demo blockers):**

- **S2: Context availability for Playwright profiles** - `runningProfiles.get(id).context` must be non-null; CDP profiles have no `context` field (`profiles.js:223`); Playwright profiles do (`profiles.js:605`). Fix: add `browser.contexts()[0]` fallback or restrict live preview to Playwright engine.
- **S3a: Screenshot loop starts reliably** - move `startScreencast` call into `launchProfileInternal()` after RUNNING status is set, eliminating IPC race.
- **S3b: `_wsBroadcast` set before first frame** - `setWsBroadcast()` is called inside `attachPreviewWebSocket()` which runs only after REST server starts; race window exists if renderer calls `startPreview` before server is ready.
- **S4: Stable WS handshake** - `restHttpServer.on('upgrade', ...)` must fire for `/preview` path; add diagnostic log inside upgrade handler to confirm it is reached.
- **S5/S6: Frame delivery and `<img>` visibility** - `LivePreviewPanel.jsx` is correctly implemented; `img` is `display:none` until `frameCount > 0`; will work once upstream frames arrive.
- **Stream stops on STOPPED** - `stopScreencast(profileId)` must be called from `stopProfileInternal()` in `controllers/profiles.js`; currently missing.

**Should have - capstone polish (already coded, zero extra effort):**

- FPS counter in footer (`frameCount` state exists; FPS computation not yet added)
- Stream status badge: CONNECTING to LIVE to STOPPED (`connState` badge fully implemented)
- Last-update staleness indicator (`lastFrameTime` state already present)
- WS reconnect on drop (2s reconnect timer already implemented in renderer)

**Defer to v2+:**

- Click-through interaction (mouse/keyboard forwarding via CDP Input events)
- Multi-profile mosaic / grid view (requires concurrent WS subscriptions per profile)
- Recording / playback (requires disk writes of JPEG sequence or ffmpeg encoding)
- Audio streaming (requires separate audio track, encoding, synchronized playback)

### Architecture Approach

The architecture is a three-layer pipeline inside one Electron process: `screencast.js` owns the recursive-setTimeout JPEG loop and calls a broadcast function injected by `restServer.js`; `restServer.js` attaches a `ws` WebSocket server in noServer mode to the Fastify HTTP server, manages client subscriptions, and broadcasts frames; `LivePreviewPanel.jsx` connects as a WS client, binds frames to an `<img>` via ref, and manages reconnect. The lifecycle hook from `controllers/profiles.js` to `screencast.js` is currently the only missing wire.

**Major components:**

1. **Screenshot loop** (`src/main/engine/screencast.js`) - owns loop lifecycle, gets page from `runningProfiles`, encodes JPEG, calls `_wsBroadcast`
2. **WebSocket server** (`src/main/api/restServer.js:2113-2172`) - `attachPreviewWebSocket()` creates noServer WSS, routes `/preview` upgrade, sets `_wsBroadcast` via `setWsBroadcast()`
3. **Lifecycle hooks** (`src/main/controllers/profiles.js`) - `launchProfileInternal()` and `stopProfileInternal()` must call `startScreencast` / `stopScreencast`; 3-line addition needed in each
4. **IPC bridge** (`src/main/ipc/handlers.js`, `src/preload/index.js`) - `start-preview` / `stop-preview` handlers; no changes needed
5. **Renderer panel** (`src/renderer/components/LivePreviewPanel.jsx`) - WS client, `imgRef.current.src` binding, `frameCount` state, reconnect timer; correctly implemented, no structural changes needed

### Critical Pitfalls

Top five pitfalls ranked by likelihood of causing the current blank-panel symptom:

1. **CDP engine stores no `context` in `runningProfiles`** (`profiles.js:223`, `screencast.js:41`) - `startScreencast` exits silently for every CDP-engine profile; confirm with log `engine=cdp ctx=false`; fix by adding `context` to CDP entry or restricting live preview to Playwright engine. Phase 1 diagnose, Phase 2 fix.

2. **`startPreview` IPC fires before profile enters `runningProfiles`** (`LivePreviewPanel.jsx:27`, `handlers.js:171`) - race when panel opens during STARTING to RUNNING gap; fix by moving `startScreencast` call into `launchProfileInternal()` directly after RUNNING state is set. Phase 2 fix.

3. **`_wsBroadcast` is null** (`screencast.js:143-149`, `restServer.js:2162`) - every `broadcastFrame()` call is a no-op; symptom: system log missing "Preview WebSocket server attached on /preview"; verify `data/settings.json` has `restApi.enabled: true` and port 4000 is free. Phase 1 diagnose, Phase 3 fix.

4. **Fastify `upgrade` event not propagating to `restHttpServer`** (`restServer.js:2017`, `restServer.js:2125`) - WS handshake silently fails; add `appendLog` inside upgrade handler; if that log never appears, investigate Fastify 5.x upgrade event behavior. Phase 3 fix.

5. **`<img>` stays `display:none` because `setFrameCount` state update lags frame arrival** (`LivePreviewPanel.jsx:189`) - frames arrive but image hidden; fix by driving visibility from `<img onLoad={() => setHasFirstFrame(true)}>` instead of `frameCount` state. Phase 4 fix.

Additional pitfalls for hardening: silent `catch {}` blocks in `broadcastFrame` (`screencast.js:149`); `pages()[0]` pointing to `about:blank`; screenshot timeout of 2000ms too short during navigation (increase to 5000ms); zombie loop after profile stops (add `stopScreencast` call in `stopProfileInternal`); server restart orphaning the upgrade event handler; `bufferedAmount` undefined on server-side `ws` sockets (use `_socket.writableLength` instead).

---

## Implications for Roadmap

Based on combined research, the phase structure is dictated by dependency order: you cannot fix transport before you confirm the loop is producing frames, and you cannot verify the renderer before frames actually reach it. The five phases align exactly with the priority order in `PROJECT.md`.

### Phase 1: Diagnose

**Rationale:** Every subsequent fix is speculative without knowing which link in the chain is broken. Diagnostic phase costs less than 30 minutes and eliminates all ambiguity.

**Delivers:** Confirmed identification of which root cause(s) apply to this environment. Whether the upgrade handler fires, whether `_wsBroadcast` is registered, whether frames are produced, whether frames reach the renderer.

**Addresses:** All five pipeline segments (S1-S6) in diagnosis mode.

**Key actions:**
- Add `appendLog` inside `restServer.js` upgrade handler to confirm it fires
- Add engine/context diagnostic as first line of `startScreencast`
- Add frame-sent log after `broadcastFrame` call in `screencast.js`
- Add `console.log` in `LivePreviewPanel.jsx` `onmessage`
- Verify system log shows REST server started and Preview WebSocket server attached

**Avoids:** Wasted effort fixing the wrong layer first.

### Phase 2: Loop and Lifecycle

**Rationale:** The screenshot loop is the source of all frames. Without frames, nothing downstream can work. Lifecycle wiring ensures the loop starts automatically and stops cleanly.

**Delivers:** Reliable frame production for Playwright-engine profiles; automatic start on RUNNING, stop on STOPPED; no zombie loops; correct page selection.

**Addresses:** S2 (context availability), S3a (loop starts on RUNNING), stream stops on STOPPED.

**Key changes in `src/main/controllers/profiles.js` and `src/main/engine/screencast.js`:**
- Add `context` to CDP engine `runningProfiles` entry, or add engine guard returning clear error for CDP
- Call `startScreencast(profileId)` in `launchProfileInternal()` immediately after `setProfileStatus(profileId, 'RUNNING')` for headless profiles
- Call `stopScreencast(profileId)` in `stopProfileInternal()` before `runningProfiles.delete(profileId)`
- Filter `context.pages()` to exclude `about:blank` pages
- Increase screenshot timeout from 2000ms to 5000ms

**Avoids:** Pitfall 1 (no context), Pitfall 2 (startPreview race), Pitfall 9 (wrong page), Pitfall 11 (timeout), Pitfall 12 (zombie loop).

### Phase 3: WebSocket Transport

**Rationale:** Once frames are confirmed to be produced (Phase 2), the transport must reliably deliver them.

**Delivers:** Stable WebSocket handshake on `/preview`; correct backpressure; no stacked upgrade listeners on server restart; WS broadcast function always registered before profiles can launch.

**Addresses:** S4 (stable WS handshake), S3b (`_wsBroadcast` race).

**Key changes in `src/main/api/restServer.js`:**
- Add `restHttpServer.removeAllListeners('upgrade')` before attaching new upgrade listener to prevent stacking on restart
- Fix backpressure: replace `client.bufferedAmount` check with `client._socket?.writableLength` check
- Reset `_wsBroadcast` to null in `restServer.stop()`
- Move `startPreview` IPC call into `ws.onopen` in `LivePreviewPanel.jsx`

**Avoids:** Pitfall 3 (_wsBroadcast null), Pitfall 4 (upgrade event), Pitfall 7 (subscribe race), Pitfall 13 (server restart orphan), Pitfall 14 (bufferedAmount undefined).

### Phase 4: Renderer

**Rationale:** `LivePreviewPanel.jsx` is already correctly implemented structurally, but two display-logic issues must be verified once upstream frames are flowing.

**Delivers:** `<img>` element reliably visible on first frame; `connState` badge transitions correctly; headless button visibility derived from server-side truth.

**Addresses:** S5 (frame delivery), S6 (img visibility).

**Key changes in `src/renderer/components/LivePreviewPanel.jsx`:**
- Replace `frameCount > 0` display gate with `<img onLoad={() => setHasFirstFrame(true)}>` pattern
- Derive Live Screen button visibility from server-side `runningProfiles` headless flag instead of ephemeral `headlessPrefs` renderer state
- Verify `imgRef.current` is not null when `onmessage` fires

**Avoids:** Pitfall 5 (button hidden), Pitfall 6 (img display:none lag).

### Phase 5: Hardening

**Rationale:** The codebase has 40+ silent `catch {}` blocks. For a demo where the audience watches the live preview, any silent failure produces an unexplained blank screen. Hardening makes failures observable.

**Delivers:** No silent frame drops; clean shutdown; no memory leak from unbounded WS send queue; all stream events logged.

**Key changes across `screencast.js`, `restServer.js`, `bootstrap.js`:**
- Replace `catch {}` in `broadcastFrame` with `catch(e)` that appends to profile log
- Add startup assertion: if `_wsBroadcast` is still null 5 seconds after app launch, log warning
- Add periodic frame count log every 50 frames
- Document CSP requirement: `connect-src ws://127.0.0.1:4000` if headers are added in future

**Avoids:** Pitfall 8 (silent catch), Pitfall 15 (CSP).

### Phase Ordering Rationale

- Phase 1 must precede all others - fixes applied without diagnosis address the wrong root cause
- Phase 2 precedes Phase 3 - a broken loop produces no frames; fixing transport first is unverifiable
- Phase 3 precedes Phase 4 - the renderer cannot be validated until frames actually arrive over WS
- Phase 5 is last - hardening is meaningless until the happy path works end-to-end
- This order matches `PROJECT.md` priority list exactly

### Research Flags

Phases with well-documented patterns (no additional research needed):

- **Phase 1 (Diagnose):** Pure log addition; no API research needed
- **Phase 2 (Loop + Lifecycle):** Direct `require()` + function call in `profiles.js`; standard Node pattern
- **Phase 4 (Renderer):** Standard React `onLoad` / ref pattern; well documented
- **Phase 5 (Hardening):** Mechanical replacement of empty catch blocks

Phases that may need targeted investigation:

- **Phase 3 (WebSocket Transport):** If Phase 1 diagnostic log shows the Fastify `upgrade` event never fires, deeper investigation of Fastify 5.x upgrade event propagation is needed before the fix can be confirmed. Fallback: use `@fastify/websocket` plugin or move WS to a dedicated port.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All versions verified against installed node_modules; ws@8.20.0 and playwright@1.58.2 confirmed; no new installs required |
| Features | HIGH | Root causes identified by direct code inspection of all pipeline files; pipeline segment dependency chain fully traced |
| Architecture | HIGH | All component boundaries, data flow, and integration points verified from actual source files; no speculation |
| Pitfalls | HIGH | All 15 pitfalls mapped to specific file paths and line numbers; CONCERNS.md confirms systemic silent-catch pattern |

**Overall confidence:** HIGH

### Gaps to Address

- **CDP engine live preview:** Whether to fix CDP profiles via `chromium.connectOverCDP` or restrict to Playwright-only is a product decision. Recommended: restrict to Playwright engine for demo milestone; add clear error message for CDP profiles. Revisit for v2.
- **Fastify 5 upgrade event behavior:** Propagation from Fastify 5.x internal `http.Server` to manually attached listeners is not formally documented. Phase 1 diagnostic logging will confirm or refute this. If the upgrade event does not fire, Phase 3 must substitute `@fastify/websocket` or a dedicated TCP port.
- **headlessPrefs renderer state vs server-side truth:** Fixing Live Screen button visibility in Phase 4 requires passing headless flag through `running-map-changed` IPC event payload. Low risk - one-line addition in `runtime.js`.

---

## Sources

### Primary (HIGH confidence - direct codebase inspection)

- `src/main/engine/screencast.js` - screenshot loop, startScreencast, stopScreencast, _wsBroadcast registration
- `src/main/api/restServer.js:2113-2192` - attachPreviewWebSocket, broadcastPreviewFrame, wsClients Map
- `src/main/controllers/profiles.js:60-619` - launchProfileInternal, stopProfileInternal, runningProfiles.set structure for CDP vs Playwright engine
- `src/main/state/runtime.js` - runningProfiles Map shape
- `src/main/ipc/handlers.js:171-191` - start-preview, stop-preview, screencast-status handlers
- `src/preload/index.js:158-161` - startPreview, stopPreview, getScreencastStatus preload bridge
- `src/renderer/components/LivePreviewPanel.jsx` - full component: WS client, imgRef, frameCount, connState, reconnect
- `src/renderer/App.jsx:39,46,550,632-637` - previewProfile state, apiStatus, LivePreviewPanel mount
- `src/main/bootstrap.js:66-98` - startup sequence, when restServer.start() is called
- `node_modules/ws/package.json` - confirmed version 8.20.0
- `node_modules/playwright/package.json` - resolves to rebrowser fork 1.58.2
- `node_modules/electron/package.json` - confirmed version 33.4.11
- `.planning/codebase/CONCERNS.md` - systemic silent-catch pattern (40+ occurrences) confirmed

### Secondary (MEDIUM confidence)

- Fastify documentation: noServer WebSocket wiring requires raw http.Server upgrade event; Fastify does not intercept upgrade by default but plugins may
- ws npm library documentation: bufferedAmount available in ws >= 8.x but is internal write buffer, not browser API
- Electron 33 release notes: ships Node 20.18.x, confirmed compatible with all APIs in use

---

*Research completed: 2026-04-25*
*Ready for roadmap: yes*
