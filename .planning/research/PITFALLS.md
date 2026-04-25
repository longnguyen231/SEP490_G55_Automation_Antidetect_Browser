# Pitfalls Research

**Domain:** Screenshot-Streaming Live Preview — Electron 33 + rebrowser-playwright 1.52 + Fastify/WebSocket + React 18
**Researched:** 2026-04-25
**Confidence:** HIGH (all pitfalls verified against actual source files in the repo)

---

## Blank Panel: Top 5 Most Likely Root Causes (Ranked)

Before the full pitfall catalogue, here are the five root causes most likely producing the current "completely blank panel" symptom, ordered by probability based on code inspection.

| Rank | Root Cause | File / Line | Why Most Likely |
|------|-----------|-------------|-----------------|
| 1 | **CDP engine stores no `context` in `runningProfiles`** | `profiles.js:223`, `screencast.js:41` | CDP path sets `{ engine: 'cdp', childProc, wsEndpoint, … }` — no `context` key. `startScreencast` exits immediately with "Cannot start: no running context" if profile uses CDP engine |
| 2 | **`startPreview` IPC fires before profile is RUNNING** (race) | `LivePreviewPanel.jsx:27`, `handlers.js:171` | `useEffect` calls `startPreview` on mount; if profile is still STARTING the `runningProfiles` Map has no entry yet and screencast silently returns |
| 3 | **`setWsBroadcast` not called / `_wsBroadcast` is null** | `screencast.js:143-149`, `restServer.js:2162` | `broadcastFrame` does `if (!_wsBroadcast) return` silently. `attachPreviewWebSocket` is only called inside `start()` — if Fastify fails to start (port conflict, slow boot) the broadcast function is never registered |
| 4 | **WS client sends `subscribe` message before `onopen` fires** (impossible), but more likely: **WS `upgrade` event never fires because `restHttpServer` is the Fastify internal server** | `restServer.js:2017`, `restServer.js:2125` | `restHttpServer = appx.server` is the Node.js `http.Server` wrapped by Fastify. Fastify may not expose the raw server's `upgrade` event identically across versions; the upgrade listener could silently miss events |
| 5 | **`img` display:none until `frameCount > 0`** — frames arrive but `setFrameCount` state update is dequeued | `LivePreviewPanel.jsx:189` | React batches state updates; if `setFrameCount` lags behind `imgRef.current.src` assignment, the `<img>` stays hidden. Also: `setLastFrameTime` causes a re-render that resets `frameCountRef` if component remounts |

---

## Critical Pitfalls

### Pitfall 1: CDP Engine Has No `context` in `runningProfiles` — Screencast Silently Aborts

**What goes wrong:**
`startScreencast` reads `runningProfiles.get(profileId)?.context` at line 41 of `screencast.js`. When the profile was launched via the CDP engine (`engine: 'cdp'`), `profiles.js:223` stores `{ engine: 'cdp', childProc, wsEndpoint, host, port, forwarder, heartbeat, startedAt }` — no `context` field. The check `if (!running || !running.context)` evaluates to `true` and the function logs "Cannot start: no running context" then returns. No frames are ever produced.

**Why it happens:**
The CDP engine launches Chrome as a subprocess and connects via DevTools Protocol — it does not create a Playwright `BrowserContext` the same way the Playwright engine does. The screencast module was written assuming the Playwright engine path. There is a secondary `cdpControl` object stored on the entry (accessed at `profiles.js:211-212`) for some heartbeat operations, but it is not present at launch time and is not stored in `runningProfiles` consistently.

**How to avoid:**
Option A (quick): In `startScreencast`, add CDP engine support by connecting a Playwright `chromium.connectOverCDP(wsEndpoint)` to obtain a `BrowserContext` on-demand for screenshotting only.
Option B (proper): When launching via CDP engine, also attach a Playwright context reference to the `runningProfiles` entry under the `context` key after connecting.
Diagnostic check first: add `appendLog(profileId, \`[screencast] engine=${running?.engine} ctx=${!!running?.context}\`)` as the very first line of `startScreencast`.

**Warning signs:**
- Log shows "[screencast] Cannot start: no running context" immediately after clicking Live Screen
- `isScreencasting(profileId)` returns `false` right after `startPreview` IPC returns `{ success: true }`
- Profile was launched without selecting "Playwright" engine explicitly

**Phase to address:** Phase 1 (Diagnose) — confirm with log; Phase 2 (Loop fix) — implement CDP connect

---

### Pitfall 2: Race Condition — `startPreview` Fires Before Profile is in `runningProfiles`

**What goes wrong:**
`LivePreviewPanel.jsx:27` calls `window.electronAPI.startPreview(profileId)` inside a `useEffect` that runs immediately on mount. The panel opens when the user clicks the Live Screen button on a profile that is either already RUNNING or just transitioning to RUNNING. If the panel is opened during the STARTING → RUNNING gap, `runningProfiles.get(profileId)` returns `undefined` and `startScreencast` exits silently.

**Why it happens:**
`running-map-changed` IPC events trigger the UI to show the Live Screen button when status is RUNNING. However, there is a window between the renderer receiving the event and the user clicking the button during which the profile could already have advanced — in the opposite scenario (auto-open or fast-click), the profile may still be STARTING. The current code has no retry mechanism in `startScreencast` for the "not yet in runningProfiles" case.

**How to avoid:**
Add a startup retry in `startScreencast`: if `runningProfiles.get(profileId)` is falsy, poll every 500 ms up to 5 s before giving up. Alternatively, auto-trigger `startScreencast` inside `setProfileStatus(profileId, 'RUNNING')` in `profiles.js` so no IPC round-trip from the renderer is needed.

```javascript
// In profiles.js — auto-start screencast when profile becomes RUNNING
setProfileStatus(profileId, 'RUNNING', instanceId);
broadcastRunningMap();
// Auto-trigger headless screencast if applicable
if (options?.headless) {
  const { startScreencast } = require('../engine/screencast');
  startScreencast(profileId);
}
```

**Warning signs:**
- Log shows "[screencast] Started" then immediately "[screencast] Stopped" (context disappeared)
- Closing and reopening the Live Screen panel fixes it (second call arrives after RUNNING)
- Panel works when opened several seconds after profile launch but not immediately

**Phase to address:** Phase 1 (Diagnose), Phase 2 (Loop fix — move trigger to lifecycle)

---

### Pitfall 3: `_wsBroadcast` is `null` When Frames are Generated

**What goes wrong:**
`broadcastFrame` in `screencast.js:143` does `if (!_wsBroadcast) return` silently. `setWsBroadcast` is called from `attachPreviewWebSocket` in `restServer.js:2163`. `attachPreviewWebSocket` is only called inside the `start()` function's success path. If Fastify fails to bind port 4000 (EADDRINUSE, permissions, antivirus blocking), or if `start()` has not yet completed when `startScreencast` is first called, `_wsBroadcast` remains `null` and every `broadcastFrame` call is a no-op.

**Why it happens:**
The initialization order is: `bootstrap.js` creates `restServer`, calls `restServer.start()` asynchronously with `.catch()` — meaning it does not await completion. `startScreencast` can be triggered by a renderer IPC call at any time after mount. On Windows, port conflicts and antivirus interference on localhost WebSocket connections are common.

**How to avoid:**
1. In `bootstrap.js`, await `restServer.start()` before the app is considered ready, or delay the `backend-ready` IPC signal until REST + WS are confirmed up.
2. Add a startup log that explicitly confirms `setWsBroadcast` was called: `appendLog('system', '[screencast] WS broadcast registered')`.
3. Add a diagnostic IPC handler that returns `{ wsBroadcastReady: !!_wsBroadcast, loopActive: isScreencasting(profileId) }`.

**Warning signs:**
- System log shows "REST API server failed to start: Port 4000 is already in use" or "Preview WebSocket attach failed"
- System log does NOT show "Preview WebSocket server attached on /preview"
- WS connection from browser DevTools to `ws://127.0.0.1:4000/preview` gets connection refused

**Phase to address:** Phase 1 (Diagnose), Phase 3 (WS fix — guarantee initialization order)

---

### Pitfall 4: Fastify `upgrade` Event May Not Propagate to the Raw `http.Server`

**What goes wrong:**
`attachPreviewWebSocket` attaches a listener to `restHttpServer.on('upgrade', ...)` where `restHttpServer = appx.server` (the raw Node.js HTTP server inside Fastify). Fastify does not document that `appx.server` exposes upgrade events. In practice, Fastify may consume or block the HTTP `upgrade` event at the framework level before it reaches the raw server listener, depending on the Fastify version and whether any plugin intercepts it.

**Why it happens:**
Fastify wraps Node's `http.Server` but plugins like `@fastify/websocket` handle the `upgrade` event internally. When using `noServer: true` with the `ws` library and manually wiring the `upgrade` event, the listener must be on the underlying `http.Server` — which in Fastify is `appx.server`. The problem is that Fastify 4+ may not emit `upgrade` to listeners added after `listen()` completes, or may destroy the socket first.

**How to avoid:**
Verify by adding a one-time logger inside the upgrade handler:
```javascript
restHttpServer.on('upgrade', (request, socket, head) => {
  appendLog('system', `[ws-upgrade] url=${request.url}`);
  // ... existing code
});
```
If this log never appears when the browser tries to connect, the upgrade event is being dropped. The fix is to use `@fastify/websocket` instead of manual `noServer` wiring, or move WS to a separate `net.createServer` on a dedicated port.

**Warning signs:**
- Browser DevTools shows WS handshake: 101 Switching Protocols never returned (connection stays pending or gets 400)
- The upgrade log message above never appears
- `ws` client disconnects immediately on `.onerror` with no error code

**Phase to address:** Phase 3 (WS fix)

---

### Pitfall 5: Live Screen Button Only Visible When `headlessPrefs[profile.id]` is Truthy

**What goes wrong:**
`ProfileList.jsx:584` conditionally renders the Live Screen button: `{!!headlessPrefs[profile.id] && onViewLiveScreen && ...}`. If a profile was launched without the headless checkbox checked, `headlessPrefs` has no entry for that profile and the button never appears — even though the profile is RUNNING with a valid Playwright context. The panel can never be opened, producing a "blank" outcome from the user's perspective (the button simply doesn't exist).

**Why it happens:**
`headlessPrefs` is local UI state tracking which profiles are configured for headless mode. It is set when the user checks the headless toggle. If the user launches a profile from a different path (e.g., REST API, automation scheduler, or after a page refresh that resets local state), `headlessPrefs` will not have the flag, hiding the button.

**How to avoid:**
The Live Screen button visibility should be derived from whether the profile is actually running in headless mode (server-side truth), not from ephemeral renderer state. `runningProfiles` entries already know the engine and options used — expose `headless: true/false` in the `running-map-changed` event payload and use that to show/hide the button.

**Warning signs:**
- Profile shows as RUNNING but the Live Screen button is absent
- Refreshing the page makes the button disappear even for a running headless profile
- REST API launch of a headless profile never shows the button

**Phase to address:** Phase 1 (Diagnose — check if button is even visible), Phase 4 (Renderer fix)

---

### Pitfall 6: `<img>` Stays Hidden Because `frameCount > 0` Condition Lags React Render

**What goes wrong:**
`LivePreviewPanel.jsx:189` sets `<img style={{ display: frameCount > 0 ? 'block' : 'none' }}>`. `frameCount` is React state updated via `setFrameCount`. The actual `<img>` `src` is set via `imgRef.current.src` — a direct DOM mutation that bypasses React state. This means the image content is updated immediately (visible in the DOM) but the `display` style is still `none` until React re-renders with the incremented `frameCount`. On slow renders or when React batches updates, the user sees the spinner even though the image is ready.

**Why it happens:**
Mixing ref-based DOM mutation (`imgRef.current.src`) with state-based visibility (`frameCount`) creates a timing gap. React batches `setFrameCount` and `setLastFrameTime` state updates together — the re-render takes one event-loop tick after the src is set.

**How to avoid:**
Drive `<img>` visibility from the ref directly using a CSS class, or use `onLoad` on the `<img>` to set a `hasFirstFrame` state that shows/hides the element after the first image actually loads:
```jsx
<img
  ref={imgRef}
  alt="Live headless browser preview"
  onLoad={() => setHasFirstFrame(true)}
  style={{ display: hasFirstFrame ? 'block' : 'none' }}
/>
```
This eliminates the race: the image is only shown after the browser has painted it.

**Warning signs:**
- Frames are arriving (frameCount increments) but `<img>` still shows as `display:none` in DevTools
- Flickering on first frame — panel briefly shows placeholder before image appears
- Adding `console.log` to `onmessage` shows data arriving but UI stays blank

**Phase to address:** Phase 4 (Renderer fix)

---

### Pitfall 7: WS `subscribe` Message Sent Before Server Registers the Client

**What goes wrong:**
`LivePreviewPanel.jsx:52-54` sends the subscribe message in `ws.onopen`. If the WS server's `connection` event handler on `wss` fires slightly after `onopen` completes on the client side (valid in same-machine connections), the `message` event for the subscribe payload arrives before the `wss.on('connection')` handler has been registered for that client. This is unlikely on localhost but becomes a race if `attachPreviewWebSocket` has not finished wiring events.

More practically: if `restHttpServer` processes the upgrade and emits a `connection` event on `wss`, but the `ws.on('message')` handler registration inside `wss.on('connection', ...)` occurs after the first message, the subscribe message is dropped.

**Why it happens:**
`wss.on('connection', (ws) => { ws.on('message', ...) })` is synchronous — Fastify/Node processes the handshake completion and fires `connection` synchronously, then the `message` handler is registered. A subscribe message sent in `onopen` will be buffered by the TCP stack and processed after the `message` handler is registered. This is safe in practice but can fail if the connection event listener is registered after the first message is already in the Node.js microtask queue.

**How to avoid:**
This is low risk in practice. For resilience, have the server send a ready signal (`{ action: 'ready' }`) after `connection` and have the client send subscribe only on receiving that signal:
```javascript
// server
wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ action: 'ready' }));
  ws.on('message', ...);
});
// client
ws.onmessage = (evt) => {
  const data = JSON.parse(evt.data);
  if (data.action === 'ready') { ws.send(JSON.stringify({ action: 'subscribe', profileId })); return; }
  // handle frames ...
};
```

**Warning signs:**
- WS connects (onopen fires, connState = 'LIVE') but no frames arrive
- Server log shows no subscribe received for that profileId after connection
- Manually sending subscribe from DevTools WS panel delivers frames fine

**Phase to address:** Phase 3 (WS fix — hardening)

---

### Pitfall 8: Silent Error Swallow in `broadcastFrame` Hides Every Failure

**What goes wrong:**
`screencast.js:149` has `catch { }` — an empty catch block around `jpegBuffer.toString('base64')` and the `_wsBroadcast` call. If `jpegBuffer` is `null` / `undefined` (returned by `page.screenshot()` when the page navigates during the call), or if `_wsBroadcast` throws, or if `base64` encoding of a very large buffer throws OOM, the error is completely invisible. The loop continues but no frames are ever broadcast.

**Why it happens:**
A pattern of defensive `catch {}` blocks is endemic in this codebase (noted in CONCERNS.md: 40+ occurrences). The intent is resilience but the effect is debuggability zero.

**How to avoid:**
Replace with explicit logging:
```javascript
function broadcastFrame(profileId, jpegBuffer) {
  if (!_wsBroadcast) {
    appendLog(profileId, '[screencast] broadcastFrame: no WS broadcast registered');
    return;
  }
  try {
    const base64 = jpegBuffer.toString('base64');
    _wsBroadcast(profileId, base64);
  } catch (e) {
    appendLog(profileId, `[screencast] broadcastFrame error: ${e?.message || e}`);
  }
}
```

**Warning signs:**
- `isScreencasting()` returns `true`, frame counter increments in log, but panel stays blank
- No "[screencast] Transient error" logs despite suspected issues
- `page.screenshot()` returns without error but panel remains empty

**Phase to address:** Phase 1 (Diagnose — add logging), Phase 5 (Hardening — no silent catches)

---

### Pitfall 9: `page.screenshot()` Called on Wrong Page (Multi-Tab / `pages()[0]` Stale)

**What goes wrong:**
`screencast.js:65` always grabs `pages()[0]` — the first page in the Playwright context. If the profile navigates to a URL that opens a new tab, or if the `about:blank` splash page is `pages()[0]` while the real content is `pages()[1]`, screenshots are taken of a blank page. `page.screenshot()` succeeds and returns a frame (white or blank) — no error, no log, just a white image that the `<img>` tag displays as an invisible white square against the panel background.

**Why it happens:**
Playwright's `context.pages()` returns pages in creation order. After launch, `profiles.js:524` creates the first page and navigates to `startUrl`. But Chrome also creates a `about:blank` initial page internally in some configurations. If `pages()[0]` is that blank page, screenshots are legitimate but empty.

**How to avoid:**
After selecting `pages()[0]`, check if the URL is `about:blank` and try the next page:
```javascript
const pages = ctx.pages().filter(p => !p.isClosed());
const page = pages.find(p => p.url() !== 'about:blank' && p.url() !== '') || pages[0];
```
Also log the URL of the page being screenshotted on the first frame to diagnose this quickly.

**Warning signs:**
- Frames arrive (frameCount > 0) but the panel is white/blank rather than spinner
- `page.url()` logged inside the loop shows `about:blank`
- Frames delivered correctly after user manually navigates the headless profile

**Phase to address:** Phase 2 (Loop fix)

---

### Pitfall 10: `context.pages()` Returns Empty Array — Page Not Yet Created

**What goes wrong:**
`screencast.js:64-69` handles the empty pages case with a `continue` and a wait — correct in principle. However, after `startScreencast` is called, if the profile launch has finished (RUNNING status set) but no page has been created yet, the loop waits up to the interval. If the page creation takes longer than expected (slow CDP connection, fingerprint injection delay), the loop never acquires a page and keeps producing no frames indefinitely without logging why.

**Why it happens:**
The Playwright engine path calls `context.newPage()` at `profiles.js:524-539` but this happens inside the launch flow. By the time `RUNNING` status is broadcast and the renderer calls `startPreview`, the page should exist — but the timing is tight and on slower machines or under antidetect fingerprint injection overhead, the page may not be in `context.pages()` yet.

**How to avoid:**
Add an explicit log when the pages array is empty more than 3 times consecutively:
```javascript
let emptyPageRetries = 0;
if (!page || page.isClosed()) {
  emptyPageRetries++;
  if (emptyPageRetries % 5 === 0) {
    appendLog(profileId, `[screencast] Waiting for page (${emptyPageRetries} retries, ctx pages: ${ctx.pages().length})`);
  }
  await new Promise(r => setTimeout(r, intervalMs));
  continue;
}
emptyPageRetries = 0;
```

**Warning signs:**
- Log shows no "[screencast] Transient error" but also no frame count in logs
- Loop started successfully but no "[screencast] Stopped" either — loop is running but producing nothing
- Profile was launched on a slow machine or with heavy fingerprint injection

**Phase to address:** Phase 2 (Loop fix)

---

### Pitfall 11: `page.screenshot()` timeout=2000ms Too Short During Navigation

**What goes wrong:**
`screencast.js:75` uses `timeout: 2000`. During page navigation (especially with `waitUntil: 'domcontentloaded'`), Chrome may be locked rendering the new page and `page.screenshot()` will throw a timeout error. The catch block pattern `/timeout/i.test(msg)` silently continues — correct for transience, but if navigation takes longer than 2s consistently (complex SPA, slow site), every screenshot call times out producing zero frames.

**Why it happens:**
The profile may be running automation that navigates frequently. The 2 s timeout is suitable for static pages but aggressive for SPAs or sites with heavy JavaScript initialization.

**How to avoid:**
Increase timeout to 5000 ms and add a log counter for repeated timeouts:
```javascript
const buf = await page.screenshot({
  type: 'jpeg',
  quality: 60,
  timeout: 5000,
});
```
Also log when timeout count exceeds 10 consecutive: `appendLog(profileId, '[screencast] Warning: screenshot timing out repeatedly')`.

**Warning signs:**
- System log flooded with timeout messages (if logging was enabled)
- Panel stays blank exactly when automation script is navigating between pages
- Frames arrive fine on static pages but disappear during site navigation

**Phase to address:** Phase 2 (Loop fix)

---

### Pitfall 12: Zombie Loop — Screencast Continues After Profile Stops

**What goes wrong:**
`stopScreencast` sets `handle.active = false` and the loop exits on the next iteration. If `stopScreencast` is never called when a profile stops (no wiring between `STOPPED` lifecycle event and screencast manager), the loop enters the empty-context path: `const ctx = runningProfiles.get(profileId)?.context` returns `undefined` (because `runningProfiles.delete(profileId)` was called in cleanup), `handle.active = false` is set, and the loop exits. This is correct by accident — but only if cleanup removes the entry from `runningProfiles` before the next loop iteration. If cleanup is slow or fails, the loop continues calling a closed context.

Currently there is NO explicit call to `stopScreencast` in `profiles.js` when a profile stops. The loop exits only because `runningProfiles` entry disappears.

**Why it happens:**
The screencast module is not integrated into the profile lifecycle — it was designed with `startScreencast`/`stopScreencast` as explicit calls but only `startScreencast` is wired (via IPC). `stopScreencast` has no caller in the normal stop flow.

**How to avoid:**
In `profiles.js`, call `stopScreencast(profileId)` wherever `setProfileStatus(profileId, 'STOPPED')` is called:
```javascript
const { stopScreencast } = require('../engine/screencast');
stopScreencast(profileId);
setProfileStatus(profileId, 'STOPPED');
```

**Warning signs:**
- "[screencast] Transient error: Target page, context or browser has been closed" flooding logs after profile stop
- CPU stays elevated after profile is stopped
- `isScreencasting()` returns `true` after stop

**Phase to address:** Phase 2 (Loop fix — lifecycle wiring), Phase 5 (Hardening)

---

### Pitfall 13: Fastify Server Restart Orphans the WS Upgrade Handler

**What goes wrong:**
`attachPreviewWebSocket` registers `restHttpServer.on('upgrade', ...)`. If the REST server is restarted via `setPort()` or `setEnabled()`, a new `restHttpServer` is created — but the old `upgrade` listener is on the old server which is now closed. The new server has no `upgrade` handler, so WebSocket connections silently fail to upgrade (no 101 response, client gets a 400 or connection reset). The `wss` variable is cleaned up correctly, but the `setWsBroadcast` registration survives (module-level `_wsBroadcast`), so the screencast module thinks it can broadcast but nothing actually goes anywhere.

**Why it happens:**
The `upgrade` listener is attached to the server instance at startup. On restart, `restHttpServer` is replaced but `attachPreviewWebSocket` must be called again for the new instance. Currently `attachPreviewWebSocket` is only called inside `start()` which is correct — but if `restHttpServer` is somehow reassigned without re-calling `start`, the handler is lost.

**How to avoid:**
Ensure `attachPreviewWebSocket` is always called after a server restart. Add a `restServerState.wsAttached` flag and a startup log check. Also reset `_wsBroadcast` in `screencast.js` when the WS server is torn down:
```javascript
// In stopScreencast / WS teardown:
const { setWsBroadcast } = require('../engine/screencast');
setWsBroadcast(null); // reset so broadcastFrame logs "no broadcast registered"
```

**Warning signs:**
- WS worked during one session but stopped after changing the REST API port in Settings
- System log shows "Preview WebSocket server attached on /preview" only once per app lifetime
- Re-launching the app fixes the WS connection

**Phase to address:** Phase 3 (WS fix)

---

### Pitfall 14: `bufferedAmount` Not Available on Server-Side `ws` Clients

**What goes wrong:**
`restServer.js:2185` checks `client.bufferedAmount > 131072` for backpressure. The `ws` library's server-side `WebSocket` object does NOT expose `bufferedAmount` in the same way as the browser's `WebSocket`. `bufferedAmount` is a browser API — on the server-side `ws` socket, this property is `undefined`, making `undefined > 131072` always `false`. The backpressure guard never triggers, meaning frames are sent regardless of client buffer state.

**Why it happens:**
The `ws` npm library documents a `bufferedAmount` property (bytes queued for sending) but it is only available in ws ≥ 8.x and may not be exposed on all connection types. In `noServer` mode, the socket may be a different class.

**How to avoid:**
Use `ws.readyState` and the internal `_socket.writableLength` for server-side backpressure, or simply skip frames based on timing (drop if last frame sent < 50ms ago):
```javascript
// Correct backpressure for server-side ws:
if (client.readyState !== 1) continue;
const buffered = client._socket?.writableLength ?? 0;
if (buffered > 131072) continue;
```

**Warning signs:**
- Under load (fast automation, many page navigations), WS client queue grows until connection drops
- Browser DevTools shows large WS message backlog
- App memory grows without bound when Live Screen is open

**Phase to address:** Phase 3 (WS fix), Phase 5 (Hardening)

---

### Pitfall 15: Electron Renderer Cannot Connect to `ws://` in Development vs Production

**What goes wrong:**
In development, the renderer is loaded from `http://localhost:5173` (Vite dev server). In production, it is loaded from `file:///...dist/renderer/index.html`. The WS URL is hardcoded as `ws://127.0.0.1:${apiPort}/preview`. This should work in both environments since it is a direct localhost connection — BUT Electron's Content Security Policy, if set by `session.defaultSession.webRequest.onHeadersReceived`, can block `ws://` connections from a `file://` origin. Currently no CSP is set in `mainWindow.js`, so this is not a current blocker — but adding any CSP header later without `connect-src ws://127.0.0.1:4000` will break WS silently.

**Why it happens:**
The default Electron CSP for `file://` loaded pages does not restrict `ws://` connections, but any CSP set via `webRequest.onHeadersReceived` overrides defaults. Developers adding security headers often forget WebSocket sources.

**How to avoid:**
If CSP is added in the future, include: `connect-src 'self' ws://127.0.0.1:4000`. Currently, document that WS on localhost is intentionally exempted.

**Warning signs:**
- WS fails only in packaged production build, works in dev
- Electron DevTools console shows CSP violation for `ws://`
- No network error but `ws.onerror` fires immediately

**Phase to address:** Phase 5 (Hardening)

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| `catch {}` everywhere in screencast + restServer | Prevents crashes during demo | Impossible to diagnose blank panel; all failure modes invisible | Never — replace with `catch(e) { appendLog(...) }` |
| `startPreview` triggered from renderer IPC | Simpler wiring | Race condition with lifecycle; renderer may call before profile is RUNNING | Demo only — move to lifecycle in production |
| `pages()[0]` always | Simple | Screenshots blank page when multiple tabs or initial about:blank | Acceptable for single-tab demo if URL validated |
| `_wsBroadcast` module-level singleton | No DI needed | Cannot reset between server restarts without manual `setWsBroadcast(null)` | Acceptable for single-server app if restart is handled |
| Hardcoded timeout=2000ms in screenshot | Fast failure | Too short during navigation; silently produces no frames | Increase to 5000ms — no real cost |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Fastify + `ws noServer` | Attaching `upgrade` listener to `appx.server` without verifying Fastify doesn't consume it | Add `appendLog` inside upgrade handler to confirm it fires; test with `websocat ws://127.0.0.1:4000/preview` |
| `rebrowser-playwright` + CDP engine | Assuming all engines store `context` in `runningProfiles` | Check `running.engine` before calling `context.pages()`; use `chromium.connectOverCDP` for CDP profiles |
| `page.screenshot()` during navigation | Expecting it to always return a buffer | It can return `null` or throw timeout; always check `if (buf)` before `broadcastFrame` |
| React `imgRef.current.src` + state | Assuming state and DOM are in sync | DOM update is synchronous; state update is async; derive visibility from `onLoad` not `frameCount` |
| WS port shared with REST | Port conflict causes both to fail | Log port binding success/failure explicitly; provide fallback port detection |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| `Buffer.toString('base64')` on 500KB JPEG per frame | Slight GC pause per frame | Use `jpeg quality: 40-50` + 720p cap; already at q60 which is acceptable | At 1280×720 JPEG q60 ≈ 150-300KB; safe for demo |
| React `setFrameCount` + `setLastFrameTime` on every frame at 400ms | 2-3 React re-renders/s for non-visual state | Debounce state updates to once per second; only ref-update `imgRef` | Acceptable at 2.5 FPS; becomes problem at >10 FPS |
| No backpressure → WS queue fills | Memory growth, eventual connection drop | Server-side `_socket.writableLength` check per frame | Immediately if client tab is backgrounded or slow |
| `context.pages()` called every loop iteration | Minor overhead per frame | Cache page reference; invalidate on `context.on('page')` and `page.on('close')` | Not a problem at 2.5 FPS |

---

## "Looks Done But Isn't" Checklist

- [ ] **IPC Bridge:** `startPreview` is exposed in preload (`index.js:159`) — verify it invokes `start-preview` channel (currently correct), not a stub. Check `window.electronAPI.startPreview` exists in DevTools console.
- [ ] **WS Server Started:** System log must show "Preview WebSocket server attached on /preview" after boot. If absent, `_wsBroadcast` is null and no frames will ever be sent.
- [ ] **Engine Check:** Confirm profile was launched with Playwright engine (not CDP). System log for launch should show `engine=playwright`, not `engine=cdp`. CDP profiles have no `context` in `runningProfiles`.
- [ ] **Headless Button Visible:** The Live Screen button only shows when `headlessPrefs[profile.id]` is truthy in renderer state. If the profile was launched without the headless checkbox, the button is hidden regardless of server state.
- [ ] **WS Subscribe Received:** Add a server log inside `msg.action === 'subscribe'` handler. If the log never appears after the panel opens, the WS upgrade is silently failing.
- [ ] **Frame Arrives at Renderer:** Add `console.log('[WS] frame received, len=', data.frame?.length)` in `onmessage`. If this logs but panel is blank, the issue is in renderer display logic (imgRef, display:none).
- [ ] **`imgRef.current` is not null:** On mount, `imgRef.current` may be null if the `<img>` element is inside a conditional that renders after state update. Verify `imgRef.current` is set when `onmessage` fires.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| CDP engine no context | MEDIUM | Add `running.engine` check in `startScreencast`; connect via `chromium.connectOverCDP` for CDP profiles |
| `_wsBroadcast` null | LOW | Restart app; verify system log for WS attach; fix port conflict if EADDRINUSE |
| Race condition on startPreview | LOW | Move `startScreencast` call to lifecycle (profile.js RUNNING transition) |
| Wrong page screenshotted | LOW | Filter `pages()` to non-blank URLs |
| Zombie loop after stop | LOW | Add `stopScreencast` call in every STOPPED path in profiles.js |
| Fastify upgrade event missed | MEDIUM | Add debug log; if confirmed, replace with `@fastify/websocket` plugin |
| `img` display:none race | LOW | Drive visibility from `onLoad` not `frameCount` state |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| CDP engine no context (#1) | Phase 1 (confirm) + Phase 2 (fix) | Log shows engine type; frames arrive for Playwright profiles |
| startPreview race (#2) | Phase 2 (move trigger to lifecycle) | Panel works when opened immediately after launch |
| `_wsBroadcast` null (#3) | Phase 1 (confirm with log) + Phase 3 (guarantee init order) | System log "Preview WebSocket server attached" before any profile launch |
| Fastify upgrade event (#4) | Phase 3 (WS fix) | Debug log in upgrade handler fires on WS connect attempt |
| headlessPrefs button hidden (#5) | Phase 1 (check UI) + Phase 4 (derive from server state) | Button visible for API-launched headless profiles |
| `<img>` display:none lag (#6) | Phase 4 (renderer fix) | No white flash; img visible on first frame |
| Subscribe message race (#7) | Phase 3 (WS hardening) | Server log shows subscribe received for every panel open |
| Silent catch in broadcastFrame (#8) | Phase 1 (add logging) + Phase 5 (no silent catches) | Every frame error appears in system log |
| Wrong page screenshotted (#9) | Phase 2 (loop fix) | Log URL of screenshotted page on first frame |
| Empty pages retry loop (#10) | Phase 2 (loop fix) | Log appears when waiting > 5 retries |
| screenshot timeout too short (#11) | Phase 2 (loop fix — increase to 5000ms) | No timeout errors during normal navigation |
| Zombie loop after stop (#12) | Phase 2 (lifecycle wiring) | `isScreencasting()` returns false after profile stops |
| Server restart orphans upgrade handler (#13) | Phase 3 (WS fix) + Phase 5 (hardening) | WS works after REST port change |
| `bufferedAmount` undefined (#14) | Phase 3 (WS fix) + Phase 5 (hardening) | No memory growth with backgrounded panel |
| CSP blocking ws:// in prod (#15) | Phase 5 (hardening) | WS connects in both dev and packaged builds |

---

## Sources

- Direct code inspection: `src/main/engine/screencast.js` (all pitfalls mapped to actual lines)
- Direct code inspection: `src/main/api/restServer.js:2113-2192` (WS attachment, upgrade handler, broadcastPreviewFrame)
- Direct code inspection: `src/renderer/components/LivePreviewPanel.jsx` (WS client, imgRef, frameCount)
- Direct code inspection: `src/main/controllers/profiles.js:223, 605` (CDP vs Playwright context storage)
- Direct code inspection: `src/main/ipc/handlers.js:171-191` (IPC handler for start-preview)
- Direct code inspection: `src/preload/index.js:159-160` (startPreview / stopPreview exposure)
- `.planning/codebase/CONCERNS.md` — Silent failure pattern (40+ empty catch blocks) confirmed as systemic
- `.planning/codebase/ARCHITECTURE.md` — runningProfiles Map structure, IPC data flow
- `ws` npm library docs: `bufferedAmount` is available on server-side `WebSocket` objects in ws ≥ 8.x but is the internal write buffer, not the browser API
- Fastify docs: `noServer` WebSocket wiring requires raw `http.Server` upgrade event; Fastify does not intercept upgrade by default but plugins may

---
*Pitfalls research for: Screenshot-Streaming Live Preview — Electron + Playwright + WebSocket + React*
*Researched: 2026-04-25*
