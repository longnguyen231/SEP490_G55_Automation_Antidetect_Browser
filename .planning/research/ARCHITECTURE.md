# Architecture Research

**Domain:** Live Screen / Screenshot Streaming — Electron + Playwright + WebSocket
**Researched:** 2026-04-25
**Confidence:** HIGH (all findings based on direct codebase inspection)

---

## Current State: What Already Exists

The full pipeline is **already scaffolded**. The blank-screen bug is a wiring/sequencing problem, not a missing component. Every layer exists:

| Layer | File | Status |
|-------|------|--------|
| Screenshot loop | `src/main/engine/screencast.js` | EXISTS — recursive `setTimeout`, JPEG q60 |
| WebSocket server | `src/main/api/restServer.js` (lines 2113-2172) | EXISTS — `ws` noServer on `/preview` |
| WS broadcast bridge | `screencast.js` `setWsBroadcast()` ← called by `restServer.js` `attachPreviewWebSocket()` | EXISTS |
| IPC start/stop | `src/main/ipc/handlers.js` `start-preview` / `stop-preview` handlers | EXISTS |
| Preload exposure | `src/preload/index.js` `startPreview` / `stopPreview` | EXISTS |
| Renderer component | `src/renderer/components/LivePreviewPanel.jsx` | EXISTS |
| App integration | `src/renderer/App.jsx` — `previewProfile` state → `<LivePreviewPanel>` | EXISTS |

---

## Full Data Flow (Happy Path)

### 1. Screenshot Loop Location

**File:** `src/main/engine/screencast.js`
**Responsibility:** Owns loop lifecycle (`screencastLoops` Map), gets `page` ref from `runningProfiles`, calls `page.screenshot()`, converts buffer to base64, calls `_wsBroadcast(profileId, base64)`.

Page reference acquisition path:
```
runningProfiles.get(profileId)?.context  →  ctx.pages()[0]
```

This works for both Playwright pipe-mode (where `context` is stored directly) and CDP (where `context` is on `cdpControl`). **Critical gap for CDP engine:** the CDP entry in `runningProfiles` stores `{ engine: 'cdp', childProc, wsEndpoint, ... }` — it has no `context` field unless CDP overrides attach one. The `running.context` check in `startScreencast()` will silently return `'Cannot start: no running context'` for CDP profiles. Fix: either populate `context` in the CDP branch of `launchProfileInternal`, or skip CDP for screencasting (Playwright only for now).

**What happens when `pages()` returns empty:**
`screencast.js` lines 64-70 already handle this: if `pages` is empty or `page.isClosed()`, it waits `intervalMs` and retries in the loop. This is correct. No fix needed here.

**What happens when active tab changes:**
The loop always re-fetches `ctx.pages()[0]` on every iteration. It will follow tab 0 across navigations but will not follow the user to a new tab they create. This is acceptable for the demo scope (view-only, single stream).

---

### 2. WebSocket Server Attachment

**File:** `src/main/api/restServer.js`
**Function:** `attachPreviewWebSocket()` (line 2113)
**Called at:** `start()` line 2022 — immediately after `appx.listen()` succeeds, `restHttpServer = appx.server`

The WS server uses `noServer: true` and hooks the `http.Server` `upgrade` event to intercept requests to `/preview`. Only that path is accepted; all other upgrade requests are destroyed.

**Protocol:** Client sends `{ action: 'subscribe', profileId }` after `ws.onopen`. Server maps `ws → profileId` in `wsClients`. Frames are broadcast as `JSON.stringify({ profileId, frame: base64 })`.

**Critical ordering dependency:** `attachPreviewWebSocket()` sets `_wsBroadcast` inside `screencast.js` via `setWsBroadcast(broadcastPreviewFrame)`. If `attachPreviewWebSocket()` is never called (e.g. REST server disabled in settings, or start() fails silently), `_wsBroadcast` remains `null` and `broadcastFrame()` is a no-op. Every JPEG produced by the loop is thrown away silently. This is **the most likely root cause of the blank panel**.

---

### 3. Lifecycle Wiring

**Current wiring:** `startScreencast()` is triggered **only** by the user opening `LivePreviewPanel` — the component calls `window.electronAPI.startPreview(profileId)` on mount. There is no automatic start on `RUNNING` transition.

**Where to add automatic lifecycle hook:**

The correct hook point is in `src/main/controllers/profiles.js`, in `launchProfileInternal()`, immediately after:

```js
runningProfiles.set(profileId, { engine: 'playwright', ... });
setProfileStatus(profileId, 'RUNNING', instanceId);
broadcastRunningMap();
// NEW: auto-start screencast if profile is headless
try {
  const { startScreencast } = require('../engine/screencast');
  if (headless) startScreencast(profileId);
} catch {}
```

And in `stopProfileInternal()`, before `runningProfiles.delete(profileId)`:

```js
try {
  const { stopScreencast } = require('../engine/screencast');
  stopScreencast(profileId);
} catch {}
```

This avoids subscribing to `running-map-changed` (which would require the main process to listen to its own IPC events, an anti-pattern). Direct controller call is simpler and more reliable.

---

### 4. Message Protocol

**Current protocol:** JSON envelope `{ profileId: string, frame: string (base64 JPEG) }`.

**Recommendation: keep this protocol.** Rationale:
- The renderer already parses it correctly (`data.frame` → `imgRef.current.src`)
- JSON is debuggable (browser DevTools WS inspector shows readable messages)
- Base64 JPEG adds ~33% overhead but at q60 and 400ms interval, a 1280x800 frame is ~15-20KB encoded → ~20-27KB base64 → well within a single WS frame, no fragmentation
- Binary framing would reduce overhead but requires a custom length-prefix protocol and ArrayBuffer handling in the renderer — not worth the complexity for a demo

Envelope fields are sufficient. No `ts` field is needed since the renderer only cares about rendering the latest frame, not calculating latency.

---

### 5. Renderer Subscription

**Component:** `src/renderer/components/LivePreviewPanel.jsx`
**Mount behavior:**
1. `useEffect([profileId])` calls `window.electronAPI.startPreview(profileId)` — tells backend to start the loop
2. `useEffect([profileId, apiPort])` opens `ws://127.0.0.1:${apiPort}/preview`, sends `{ action: 'subscribe', profileId }` on open
3. `ws.onmessage` sets `imgRef.current.src = 'data:image/jpeg;base64,...'` — direct DOM mutation, no React re-render overhead

**Critical renderer bug to investigate:** `apiPort` comes from `apiStatus.port || 4000` in `App.jsx`. The `apiStatus` state is initialized to `{ port: 4000 }` and only updated when `api-server-status` IPC events fire. If the REST server starts before the renderer subscribes to those events (race on app load), `apiPort` could be stale or wrong. Since `apiStatus` defaults to 4000 and the server also defaults to 4000, this is unlikely to be the bug — but worth verifying with a log.

**Image visibility bug:** The `<img>` tag is hidden via `display: frameCount > 0 ? 'block' : 'none'`. If frames are arriving but `setFrameCount` is not firing, the image remains `display:none`. Verify `frameCountRef.current += 1; setFrameCount(frameCountRef.current)` is actually executing — if `data.frame` is undefined (e.g. the JSON message uses a different key), this block is skipped silently.

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Electron Main Process (Node.js)                  │
│                                                                       │
│  ┌──────────────────────┐      ┌──────────────────────────────────┐  │
│  │  ProfileController   │      │         screencast.js            │  │
│  │  (profiles.js)       │─────▶│  screencastLoops Map             │  │
│  │  launchProfile()     │ NEW  │  startScreencast(profileId)      │  │
│  │  stopProfile()       │──────│  stopScreencast(profileId)       │  │
│  └──────────────────────┘      │  loop: context.pages()[0]        │  │
│                                │         .screenshot({jpeg,q60})  │  │
│  ┌──────────────────────┐      │  broadcastFrame() → _wsBroadcast │  │
│  │    runtime.js        │◀─────│                                  │  │
│  │  runningProfiles Map │      └──────────────────────────────────┘  │
│  │  { context, engine } │                      │ setWsBroadcast()    │
│  └──────────────────────┘                      ▼                     │
│                                ┌──────────────────────────────────┐  │
│  ┌──────────────────────┐      │        restServer.js             │  │
│  │    ipc/handlers.js   │      │  attachPreviewWebSocket()        │  │
│  │  start-preview IPC   │─────▶│  wss (noServer, /preview)        │  │
│  │  stop-preview IPC    │      │  wsClients Map<ws → profileId>   │  │
│  └──────────────────────┘      │  broadcastPreviewFrame()         │  │
│                                │  http.Server upgrade → /preview  │  │
└────────────────────────────────┴──────────┬─────────────────────────┘
                                            │ WebSocket ws://127.0.0.1:4000/preview
                                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     Renderer Process (React)                         │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                    LivePreviewPanel.jsx                       │    │
│  │  useEffect → electronAPI.startPreview(profileId)            │    │
│  │  useEffect → new WebSocket(ws://127.0.0.1:4000/preview)     │    │
│  │           → ws.send({action:'subscribe', profileId})        │    │
│  │  ws.onmessage → imgRef.current.src = 'data:image/jpeg;...' │    │
│  │  <img ref={imgRef} style={{display: frameCount>0?...}} />  │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Component Boundaries

| Component | File (existing) | Tag | Responsibility |
|-----------|-----------------|-----|---------------|
| Screenshot loop | `src/main/engine/screencast.js` | EXISTING — fix needed | Owns loop state, gets `page`, encodes JPEG, calls broadcast fn |
| WS server | `src/main/api/restServer.js` `attachPreviewWebSocket()` | EXISTING — verify called | Attaches `ws` in noServer mode, routes `/preview`, delivers frames |
| Lifecycle hook | `src/main/controllers/profiles.js` `launchProfileInternal()` / `stopProfileInternal()` | MODIFY — add 3 lines | Calls `startScreencast` on RUNNING, `stopScreencast` on STOPPED |
| IPC handlers | `src/main/ipc/handlers.js` `start-preview` / `stop-preview` | EXISTING — no change | Manual trigger via renderer |
| Preload bridge | `src/preload/index.js` | EXISTING — no change | `startPreview` / `stopPreview` / `getScreencastStatus` exposed |
| Renderer panel | `src/renderer/components/LivePreviewPanel.jsx` | EXISTING — verify message format | WS client, img src binding, connection state |
| App wiring | `src/renderer/App.jsx` | EXISTING — no change | Renders `<LivePreviewPanel>` when `previewProfile` != null |

---

## Architectural Patterns in Use

### Pattern 1: Broadcast Injection via setWsBroadcast()

**What:** `screencast.js` holds a `_wsBroadcast` function reference that starts as `null` and is populated by the WS server after initialization via `setWsBroadcast(fn)`.

**When to use:** When two modules have a circular dependency risk (screencast needs to broadcast, broadcaster is created in restServer which would need to import screencast). Breaks the cycle via late-binding.

**Trade-offs:** Frames are silently dropped if `_wsBroadcast` is null. All broadcast calls must guard `if (!_wsBroadcast) return`. The existing code does this correctly. The risk is that if `attachPreviewWebSocket()` never runs, there is no log warning that `_wsBroadcast` is still null.

**Fix:** Add a startup check in `bootstrap.js` or `screencast.js` to log a warning if `_wsBroadcast` is still null 5 seconds after launch.

### Pattern 2: noServer WebSocket Sharing Port 4000

**What:** The `ws` library's `noServer: true` mode lets the WS server share the same TCP port as Fastify by listening on the `http.Server` `upgrade` event manually. Only requests to `/preview` are accepted.

**When to use:** When you cannot open a second port (Electron sandbox, firewall rules, or simplicity).

**Trade-offs:** The WS server is coupled to the lifecycle of the HTTP server. If `restServer.stop()` is called (user disables REST API in settings), `restHttpServer` is set to null and the WS upgrade handler is removed. Frames stop. The renderer WS client will get a close event and retry — but retries will fail if the server is disabled. This is a known, acceptable limitation for demo scope.

### Pattern 3: Recursive setTimeout Loop (not setInterval)

**What:** The screenshot loop uses `while (handle.active)` with `await new Promise(r => setTimeout(r, wait))` rather than `setInterval`.

**When to use:** When the async task (page.screenshot) can exceed the interval duration. `setInterval` would stack calls. The recursive pattern serializes them.

**Trade-offs:** More verbose. Harder to cancel (must set `handle.active = false` and wait for current iteration). The existing implementation handles this correctly.

---

## Data Flow

### Happy Path: Frame Delivery

```
User opens LivePreviewPanel (profile.id = X)
    │
    ├─ electronAPI.startPreview(X)
    │       │
    │       └─ IPC 'start-preview' → handlers.js
    │               │
    │               └─ screencast.startScreencast(X)
    │                       │
    │                       └─ runningProfiles.get(X).context.pages()[0]
    │                               │
    │                               └─ page.screenshot({type:'jpeg',quality:60})
    │                                       │
    │                                       └─ broadcastFrame(X, buf)
    │                                               │
    │                                               └─ _wsBroadcast(X, base64)
    │                                                       │
    │                                                       └─ broadcastPreviewFrame()
    │                                                               │
    │                                                               └─ ws.send({profileId:X, frame:base64})
    │
    └─ new WebSocket('ws://127.0.0.1:4000/preview')
            │
            ws.onopen → ws.send({action:'subscribe', profileId:X})
            │           (restServer registers wsClients[ws] = X)
            │
            ws.onmessage(data)
                │
                └─ imgRef.current.src = 'data:image/jpeg;base64,...'
                        │
                        └─ <img> re-renders → frame visible
```

### Failure Mode: _wsBroadcast is null

```
page.screenshot() → broadcastFrame(X, buf)
    │
    └─ if (!_wsBroadcast) return   ← SILENT DROP
                                      All frames lost
                                      Panel stays blank
```

Root cause: `attachPreviewWebSocket()` was not called, or the REST server failed to start.

---

## Integration Points

### Critical Internal Boundaries

| Boundary | Communication | Known Risk |
|----------|---------------|------------|
| `screencast.js` ↔ `restServer.js` | `setWsBroadcast(fn)` called once on server start | If server never starts or is restarted without re-calling `attachPreviewWebSocket`, `_wsBroadcast` becomes stale or null |
| `profiles.js` → `screencast.js` | Direct `require()` + `startScreencast(id)` call | Must be added (currently missing for auto-start on RUNNING) |
| `LivePreviewPanel` → WS | `ws://127.0.0.1:${apiPort}/preview` | `apiPort` from `apiStatus.port` — verify it matches actual server port |
| `LivePreviewPanel` → IPC | `electronAPI.startPreview(id)` | Called with `.catch(() => {})` — errors silently swallowed; add logging |
| `screencast.js` → `runtime.js` | `runningProfiles.get(id)?.context` | CDP profiles have no `context` field — loop exits silently on CDP engine |

---

## Known Broken Links (Root Cause Analysis)

Based on codebase inspection, the blank panel is caused by one or more of these, in likelihood order:

**1. REST server disabled or failing to start (HIGH likelihood)**
- If `settings.restApi.enabled === false` in `data/settings.json`, `start()` returns early without calling `attachPreviewWebSocket()`
- `_wsBroadcast` stays `null` → all frames silently dropped
- Renderer WS connection refuses → `connState = 'ERROR'` or `'STOPPED'`
- **Verification:** Check `data/settings.json` for `restApi.enabled`. Check app logs for `REST API server started on 127.0.0.1:4000`.

**2. `attachPreviewWebSocket()` not called after server restart (MEDIUM likelihood)**
- If user toggles REST API off/on in Settings, `setEnabled()` calls `start()` again but `attachPreviewWebSocket()` runs again — this is handled correctly in the current code
- However, if `restHttpServer` is set to `null` during `stop()` and `attachPreviewWebSocket()` guards on `if (!restHttpServer) return`, the WS server won't attach

**3. Renderer `startPreview` IPC call races WS `subscribe` message (MEDIUM likelihood)**
- `startPreview` is called in one `useEffect`, WS connect+subscribe is in another `useEffect`
- If `startPreview` IPC resolves and the loop starts producing frames before the `subscribe` message arrives at the server, those early frames go to no subscribers
- The loop produces frames at 400ms; typical WS handshake is <50ms, so first frame is usually after first subscribe. Race window is small but real.
- **Fix:** Server should auto-start screencast on `subscribe` if profile is RUNNING and not already casting, rather than relying on the IPC call.

**4. CDP engine profiles have no `context` (HIGH likelihood for CDP users)**
- `runningProfiles.get(id)` for CDP engine: `{ engine: 'cdp', childProc, wsEndpoint, host, port, ... }` — no `context` field
- `screencast.js` line 41: `if (!running || !running.context)` → logs `'Cannot start: no running context'` and returns
- **Fix for now:** Guard in `startScreencast` or `handlers.js` to return a clear error if engine is CDP.

---

## Thinnest Vertical Slice

To validate the entire chain produces one frame on screen:

**Files involved (no new files needed):**

1. `src/main/api/restServer.js` — add a `console.log('[WS]', '_wsBroadcast registered')` inside `attachPreviewWebSocket()` after `setWsBroadcast(broadcastPreviewFrame)`. Confirms wiring.

2. `src/main/engine/screencast.js` — add `appendLog(profileId, '[screencast] frame sent, size=' + buf.length)` after `broadcastFrame(profileId, buf)`. Confirms frames are being produced.

3. `src/renderer/components/LivePreviewPanel.jsx` — add `console.log('[LivePreview] ws message received', data)` in `ws.onmessage`. Confirms frame delivery to renderer.

**Build order to validate the chain:**

```
Step 1: Verify REST server starts
    → Check app logs for "REST API server started on 127.0.0.1:4000"
    → Check logs for "Preview WebSocket server attached on /preview"

Step 2: Verify screenshot loop produces frames
    → Open panel, check profile logs for "[screencast] Started"
    → Check profile logs for "[screencast] frame sent, size=..."
    → If not firing: check runningProfiles has .context (Playwright only)

Step 3: Verify WS frame reaches renderer
    → Add console.log in ws.onmessage
    → Open browser DevTools in renderer (Ctrl+Shift+I)
    → Check if messages appear in console

Step 4: Verify img src updates
    → Inspect <img> element in DevTools
    → Confirm src attribute changes to data:image/jpeg;base64,...
    → Confirm display !== 'none' (frameCount > 0)
```

**The minimal fix that produces one frame:**

If REST server is running and `_wsBroadcast` is registered, the only remaining bug is likely in Step 2 (no context for CDP) or Step 3 (subscribe race or wrong profileId). The fix is one of:

- For Playwright profiles: ensure `startPreview` IPC is called AFTER the WS `subscribe` message is sent (reorder `useEffect` calls, or move `startPreview` into `ws.onopen`)
- For CDP profiles: add `context` to the `runningProfiles` entry for CDP engine in `profiles.js`

---

## Build Order for Milestone Phases

| Phase | What to Build/Fix | Files to Modify | Validates |
|-------|------------------|-----------------|-----------|
| Phase 1: Diagnose | Add diagnostic logs | `screencast.js`, `restServer.js`, `LivePreviewPanel.jsx` | Identifies exact broken link |
| Phase 2: Loop + Lifecycle | Fix `startScreencast` for CDP engine; add auto-start hook in `profiles.js` | `profiles.js`, `screencast.js` | Frames flow for Playwright + CDP |
| Phase 3: WS Transport | Fix `subscribe` race (move `startPreview` into `ws.onopen`); verify `attachPreviewWebSocket` always called | `restServer.js`, `LivePreviewPanel.jsx` | Frames reliably delivered |
| Phase 4: Renderer | Fix `img` visibility logic; add `startPreview` retry on WS reconnect | `LivePreviewPanel.jsx` | Panel renders frames |
| Phase 5: Hardening | Defensive error handling, `_wsBroadcast` null guard logging, clean shutdown | `screencast.js`, `bootstrap.js` | No leaks, clean logs |

---

## Mermaid Sequence Diagram: Happy Path

```mermaid
sequenceDiagram
    participant U as User
    participant PC as ProfileController<br/>(profiles.js)
    participant SC as ScreencastManager<br/>(screencast.js)
    participant RS as RestServer<br/>(restServer.js)
    participant WS as WebSocket<br/>ws://127.0.0.1:4000/preview
    participant LP as LivePreviewPanel<br/>(React renderer)

    Note over U,LP: Profile already RUNNING (Playwright engine)

    U->>LP: Click "View Live Screen" button
    LP->>PC: electronAPI.startPreview(profileId) [IPC]
    PC->>SC: startScreencast(profileId)
    SC->>SC: runningProfiles.get(id).context.pages()[0]
    SC->>SC: page.screenshot({jpeg,quality:60})
    SC->>RS: broadcastFrame(profileId, buf)<br/>→ _wsBroadcast(profileId, base64)

    LP->>WS: new WebSocket('ws://127.0.0.1:4000/preview')
    WS-->>LP: ws.onopen fired
    LP->>WS: ws.send({action:'subscribe', profileId})
    WS->>RS: wsClients.set(ws, profileId)

    loop every 400ms
        SC->>SC: page.screenshot({jpeg,quality:60})
        SC->>RS: broadcastPreviewFrame(profileId, base64)
        RS->>WS: ws.send(JSON.stringify({profileId, frame:base64}))
        WS-->>LP: ws.onmessage(event)
        LP->>LP: imgRef.current.src = 'data:image/jpeg;base64,...'
        LP->>LP: setFrameCount(frameCount + 1)
        Note over LP: <img> becomes visible (display:block)
    end

    U->>LP: Click X / ESC to close
    LP->>LP: cleanup: ws.close(), closed=true
    LP->>PC: (implicit) stopPreview not called — loop continues until profile stops
    Note over SC: Loop stops when profile STOPPED<br/>or stopScreencast(profileId) called
```

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Listening to `running-map-changed` in main process

**What people do:** Subscribe to `running-map-changed` IPC in the main process to trigger `startScreencast()` on state changes.

**Why it is wrong:** `running-map-changed` is a renderer-targeted event sent via `webContents.send()`. The main process cannot receive it via `ipcMain.on()`. This would require a separate in-process event system. It also creates circular dependencies (runtime.js → screencast.js → runtime.js).

**Do this instead:** Call `startScreencast(profileId)` directly from `launchProfileInternal()` right after `setProfileStatus(profileId, 'RUNNING')`. Direct call, no events.

### Anti-Pattern 2: Generating PNG screenshots

**What people do:** Use `page.screenshot({ type: 'png' })` for the live preview loop.

**Why it is wrong:** PNG is lossless and 3-5x larger than JPEG at equivalent visual quality. At 400ms intervals, a 1280x800 PNG is ~200-400KB. At q60 JPEG, it is 15-25KB. PNG bloats WS send buffers and triggers the `bufferedAmount > 131072` backpressure guard, causing frame drops.

**Do this instead:** Use `type: 'jpeg', quality: 60`. Already implemented correctly in `screencast.js`.

### Anti-Pattern 3: Setting `img.src` via React state

**What people do:** `setFrameSrc('data:image/jpeg;base64,...')` → `<img src={frameSrc} />` inside the component.

**Why it is wrong:** Every frame triggers a React re-render of the component subtree. At 2.5fps (400ms interval) this is manageable, but any state co-located with the image (e.g. frameCount) forces re-renders of the whole panel on every frame.

**Do this instead:** Use `imgRef.current.src = '...'` for the frame data (direct DOM mutation — already implemented correctly). Only call `setFrameCount` (React state) for the counter display. This is what `LivePreviewPanel.jsx` already does correctly.

### Anti-Pattern 4: Opening a second port for WebSocket

**What people do:** Start `new WebSocketServer({ port: 4001 })` separately for the preview stream.

**Why it is wrong:** Requires opening a second port, firewall rule, and separate lifecycle management. If the app is packaged and port 4001 is blocked, the feature fails silently.

**Do this instead:** Reuse port 4000 via `noServer: true` and the `http.Server` `upgrade` event. Already implemented correctly.

---

## Sources

All findings are from direct codebase inspection (HIGH confidence):

- `src/main/engine/screencast.js` — screenshot loop implementation
- `src/main/api/restServer.js` lines 1959-2205 — WS server, `attachPreviewWebSocket`, `broadcastPreviewFrame`
- `src/main/controllers/profiles.js` lines 60-619 — `launchProfileInternal`, `runningProfiles.set` structure
- `src/main/state/runtime.js` — `runningProfiles` Map shape
- `src/main/ipc/handlers.js` lines 171-191 — `start-preview` / `stop-preview` / `screencast-status` IPC handlers
- `src/preload/index.js` lines 158-161 — preload bridge exposure
- `src/renderer/components/LivePreviewPanel.jsx` — full component implementation
- `src/renderer/App.jsx` lines 39, 46, 550, 632-637 — `previewProfile` state, `apiStatus`, mount point
- `src/main/bootstrap.js` lines 66-98 — startup sequence, when `restServer.start()` is called

---

*Architecture research for: Live Screen / Screenshot Streaming bug-fix*
*Researched: 2026-04-25*
