# Feature Research

**Domain:** Screenshot-Streaming Live Preview — Electron + Playwright antidetect browser
**Researched:** 2026-04-25
**Confidence:** HIGH (based on direct code inspection of all five pipeline segments)

---

## Blank Panel Root Cause Map

Before listing features, this section maps each pipeline segment to the "blank panel" symptom.
Every table-stakes feature below corresponds to one broken segment.

```
User clicks "View" button
        |
        v
[S1] startPreview IPC call  ──> handlers.js:175 startScreencast(profileId)
        |
        v
[S2] screencast.js context gate  ──> runningProfiles.get(id)?.context
        |  CDP profiles store { engine, childProc, wsEndpoint } — NO context field
        |  => startScreencast() exits silently for ALL CDP engine profiles
        v
[S3] page.screenshot() loop  ──> ctx.pages()[0].screenshot({ type: 'jpeg', quality: 60 })
        |  If page is null or isClosed(), loop waits and retries
        |  If _wsBroadcast is null (not yet set), broadcastFrame() is a no-op
        v
[S4] WebSocket frame broadcast  ──> restServer.js broadcastPreviewFrame()
        |  noServer WSS attached to Fastify http.Server via 'upgrade' event
        |  upgrade handler stacks on server restart (no removeListener guard)
        v
[S5] Renderer WebSocket client  ──> LivePreviewPanel.jsx ws.onmessage → img.src assignment
        |  img has display:none until frameCount > 0 (line 189)
        |  connState transitions to LIVE on ws.onopen, NOT on first frame
        v
[S6] img element render  ──> frameCount === 0 → img stays hidden, placeholder shown
```

**Most likely single cause of blank panel:** S2 — for CDP-engine profiles `running.context` is `undefined`,
`startScreencast()` logs "[screencast] Cannot start: no running context" and returns immediately.
No loop, no frames, no broadcast. Renderer shows the spinner/placeholder forever.

**Secondary causes (would still cause blank even if S2 is fixed):**
- S3: `_wsBroadcast` is `null` if `start-preview` IPC fires before the REST server completes
  `attachPreviewWebSocket()`. Frames are produced but silently dropped in `broadcastFrame()`.
- S4: Stacked `upgrade` event listeners on server restart may cause duplicate or dropped handshakes.
- S6: `img` stays hidden until `frameCount > 0`; if a single bad frame arrives (parse error in onmessage)
  the count never increments even if the WS connection is healthy.

---

## Feature Landscape

### Table Stakes (Must Work for Demo)

| Feature | Why Expected | Complexity | Existing Code? | Observable Outcome |
|---------|--------------|------------|---------------|-------------------|
| **S2: Context availability gate with page fallback** | `startScreencast` silently exits when `running.context` is undefined; CDP profiles never store `context`; Playwright profiles store it at line 605 of `profiles.js` | S | Partial — Playwright only; CDP path missing | User sees frames appear within 2 s of clicking "View" on a headless profile launched with Playwright engine |
| **S3a: Screenshot loop starts on RUNNING state** | Loop must begin after profile is confirmed RUNNING, not before page is ready | S | Exists in `screencast.js`; page-null retry is present but `_wsBroadcast` may be null at call time | Loop logs "[screencast] Started" in profile log within 1 s of profile reaching RUNNING |
| **S3b: `_wsBroadcast` available before first frame** | `setWsBroadcast()` called in `attachPreviewWebSocket()` which runs after `appx.listen()`. If `startPreview` IPC fires in the window between profile RUNNING and server ready, frames drop silently | S | `_wsBroadcast` guard exists in `broadcastFrame()` but drops frames without retry | First frame is not silently discarded — either loop waits for WS to be ready, or WS is always ready before profile launch is possible |
| **S4: Stable WebSocket handshake on `/preview`** | Browser opens `ws://127.0.0.1:4000/preview`; Fastify wraps Node `http.Server`; `upgrade` event must be forwarded to `WebSocketServer` | S | `attachPreviewWebSocket()` in `restServer.js` lines 2113–2171 — functional but no guard against listener stacking on restart | Renderer `connState` transitions from CONNECTING to LIVE within 1 s |
| **S5: Frame delivery and `img.src` binding** | `onmessage` parses JSON, checks `data.frame`, assigns `imgRef.current.src` | S | `LivePreviewPanel.jsx` lines 58–67 — fully implemented; only blocked by upstream absence of frames | User sees browser viewport image replace the spinner; image updates continuously |
| **S6: `img` element visibility gating** | `img` has `display: none` until `frameCount > 0` (line 189 of `LivePreviewPanel.jsx`). Correct, but if first frame parse fails (bad base64, JSON missing `profileId` check) count never increments | S | Implemented; `data.profileId` not verified in `onmessage` — any profile's frame will be displayed regardless of subscription | Frame counter increments; image is visible after first successful frame |
| **Stream stops cleanly on profile STOPPED/ERROR** | `stopScreencast(profileId)` must be called when profile lifecycle transitions to STOPPED or ERROR — currently only called via explicit `stop-preview` IPC or when loop detects fatal error | M | Loop self-terminates on fatal playwright errors (line 84–87 `screencast.js`); no automatic hook from `setProfileStatus('STOPPED')` to `stopScreencast()` | Profile log shows "[screencast] Stopped" when profile is stopped; WS clients receive `onclose` |
| **Reconnect if WS drops** | Demo reliability: if REST server restarts mid-demo the panel should recover | S | `LivePreviewPanel.jsx` lines 70–79 — 2 s reconnect timer already implemented | Spinner appears briefly then frames resume without user action |

### Differentiators (Nice-to-Have for Capstone Polish)

| Feature | Value Proposition | Complexity | Existing Code? | Observable Outcome |
|---------|-------------------|------------|---------------|-------------------|
| **FPS / frame counter in UI footer** | Lets demo audience see stream is alive even during navigation (frames slow down) | S | Frame counter (`frameCount` state) exists in footer; FPS calculation not computed | Footer shows "Frames: 47 (2.5 fps)" updating live |
| **Stream status badge transitions** | Shows CONNECTING → LIVE → STOPPED lifecycle clearly to demo audience | S | `connState` badge fully implemented (lines 117–134 `LivePreviewPanel.jsx`) — just needs upstream frames to reach LIVE | Badge turns green "LIVE" with pulsing dot within 2 s |
| **"Last update: N.Ns ago" staleness indicator** | Shows if stream has stalled without requiring user to compare frames | S | `lastFrameTime` state and `timeSinceFrame` display exist (lines 138–140, 198–199) — complete | Footer shows time since last frame, helping diagnose stalls |
| **Diagnostic log entry for every stream event** | `appendLog` calls already exist for start/stop/error; adding "frame N" every 50 frames helps post-demo debugging | S | Partial — start/stop/error logged; no periodic frame count log | Profile log readable in LogViewer shows stream health without opening DevTools |
| **Auto-start screencast when profile reaches RUNNING** | User could open LivePreviewPanel before or after launch; screencast should start automatically when the profile becomes RUNNING regardless of panel state | M | `useEffect` in `LivePreviewPanel` calls `startPreview` on mount but only if `profileId` is set — if panel is open before profile is RUNNING, the `startPreview` call may fire too early and get "no running context" | Frames appear without user needing to close and reopen the panel |

### Anti-Features (Explicitly Out of Scope)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Click-through interaction (mouse/keyboard forwarding)** | Natural extension of live view — "remote desktop" feel | Requires CDP `Input.dispatchMouseEvent` and `Input.dispatchKeyEvent` per frame, coordinate mapping from panel pixels to browser viewport pixels, and security review of input channel; doubles the milestone scope | View-only is correct for demo; defer to v2 |
| **Multi-profile mosaic / grid view** | Power user feature; shows multiple headless browsers simultaneously | Each profile needs its own WS subscription and image element; current single-profile stream architecture does not support concurrent streams; frame rate per profile would drop significantly | Single-profile stream is sufficient for demo and capstone defense |
| **Recording / playback** | Useful for QA; record a session, replay it | Requires disk writes of JPEG sequence or video encoding (ffmpeg); out of scope for Electron desktop capstone | Profile logs already capture navigation events; that is sufficient for audit |
| **Audio streaming** | Headless Chrome can capture audio via CDP | Requires separate audio track, encoding (Opus/PCM), and synchronized playback with video frames; complexity is at least 3x the visual-only stream | Not meaningful for antidetect browser demo; out of scope |
| **High-resolution stream (>720p)** | Looks better on demo projector | JPEG at 60 quality for full 1920x1080 frame = ~80–150 KB/frame; at 2.5 fps that is ~300 KB/s over localhost — fine for demo, but higher resolution inflates frame size, increases screenshot latency, and degrades automation performance | Current 60-quality JPEG at profile viewport resolution is the right default |
| **Server-side frame buffer / catch-up** | Panel opened after stream started would show missed frames | Requires ring buffer in `broadcastPreviewFrame`; adds memory pressure | WS client subscribes and immediately gets next live frame — acceptable for demo |

---

## Feature Dependencies

```
[S2: context availability]
    └──required by──> [S3a: screenshot loop starts]
                          └──required by──> [S3b: _wsBroadcast set before first frame]
                                                └──required by──> [S4: WS handshake]
                                                                      └──required by──> [S5: frame delivery]
                                                                                            └──required by──> [S6: img visibility]

[Profile lifecycle hook] ──required by──> [stream stops on STOPPED]
    (currently missing: no call from setProfileStatus → stopScreencast)

[S4: stable WS handshake] ──enables──> [reconnect if WS drops]
    (reconnect already implemented in LivePreviewPanel; only blocked by server-side handshake reliability)

[frame counter] ──enhances──> [FPS indicator]
[frame counter] ──enhances──> [staleness indicator]
```

### Dependency Notes

- **S2 requires `context` in `runningProfiles` entry:** Playwright profiles store `context` at line 605 of `controllers/profiles.js`. CDP profiles do not (line 223). The fix is either: (a) make screencast use `browser.contexts()[0]` as fallback, or (b) require headless profiles to always use Playwright engine for the live preview use case.
- **S3b requires `_wsBroadcast` to be non-null before loop fires:** The REST server and the `start-preview` IPC call are on independent timelines. The safest fix is to make `broadcastFrame` queue the frame if `_wsBroadcast` is null, or to ensure WS server is always attached before any profile can reach RUNNING state.
- **Stream-stops-on-STOPPED requires a lifecycle hook:** `setProfileStatus(profileId, 'STOPPED')` in `runtime.js` or `stopProfileInternal()` in `controllers/profiles.js` needs to call `stopScreencast(profileId)`. Currently there is no such call anywhere in the main process lifecycle.
- **img visibility requires at least one valid frame:** `display: none` gate in `LivePreviewPanel.jsx` line 189 is correct behavior; the dependency is that the entire upstream chain must produce at least one frame without error.

---

## MVP Definition

### Launch With (v1 — Demo Blocker fixes)

These are the minimum changes to make the panel show frames:

- [ ] **Fix S2: Ensure `context` is accessible for Playwright profiles** — verify `runningProfiles.get(id).context` is non-null after RUNNING state is set; add `browser.contexts()[0]` fallback
- [ ] **Fix S3b: Guard `_wsBroadcast` race** — either guarantee `attachPreviewWebSocket()` completes before any profile can launch, or retry `startScreencast` after a short delay if `_wsBroadcast` is null
- [ ] **Fix S4: Prevent stacked upgrade listeners** — add `restHttpServer.removeAllListeners('upgrade')` before `restHttpServer.on('upgrade', ...)` in `attachPreviewWebSocket()`
- [ ] **Fix stream-stops-on-STOPPED** — call `stopScreencast(profileId)` from `stopProfileInternal()` in `controllers/profiles.js` (before `runningProfiles.delete`)
- [ ] **Verify `img` display gate** — confirm `frameCount` increments on first frame (the `data.profileId` check is absent in `onmessage`; any incoming frame updates the image regardless of profile, which is acceptable for single-profile stream)

### Add After Validation (v1.x — Polish for Demo)

- [ ] **FPS counter** — compute fps from `frameCountRef` over a 2 s rolling window and display in footer
- [ ] **Auto-start on RUNNING** — subscribe to `running-map-changed` in `LivePreviewPanel`; call `startPreview` when profile transitions to RUNNING while panel is open

### Future Consideration (v2+)

- [ ] **Click-through interaction** — CDP input event forwarding, coordinate mapping
- [ ] **Multi-profile mosaic** — concurrent WS subscriptions, grid layout
- [ ] **Recording** — JPEG sequence writer, optional ffmpeg pipe for MP4 export

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| S2 context availability fix | HIGH | LOW (2-line fallback) | P1 |
| S3b _wsBroadcast race fix | HIGH | LOW (timing guard) | P1 |
| S4 no stacked upgrade listeners | HIGH | LOW (removeAllListeners) | P1 |
| S5/S6 img display (already works if frames arrive) | HIGH | NONE (already coded) | P1 |
| Stream stops on STOPPED | HIGH | LOW (one call in stopProfileInternal) | P1 |
| WS reconnect on drop | MEDIUM | NONE (already coded in renderer) | P2 |
| FPS counter in footer | MEDIUM | LOW | P2 |
| Staleness indicator | MEDIUM | NONE (already coded) | P2 |
| Auto-start on RUNNING lifecycle | MEDIUM | MEDIUM (IPC event listener in component) | P2 |
| Click-through interaction | LOW | HIGH | P3 |
| Multi-profile mosaic | LOW | HIGH | P3 |
| Recording / playback | LOW | HIGH | P3 |

---

## Competitor Feature Analysis

| Feature | Multilogin / AdsPower pattern | Playwright Trace Viewer pattern | This App's Approach |
|---------|------------------------------|---------------------------------|---------------------|
| Live preview transport | WebRTC or WS with binary frames | Static screenshots on disk (not live) | WS with base64 JSON — correct for demo scope; binary frames would reduce payload 33% but add complexity |
| Frame encoding | VP8/H.264 video (WebRTC) or PNG/JPEG raw | PNG | JPEG q60 — good tradeoff; ~30–80 KB/frame at 1280x720 |
| Stream initiation | Automatic on headless launch | Manual "open trace" | Manual click "View" — correct; auto-start is nice-to-have |
| Reconnect behavior | Transparent (WebRTC ICE restart) | N/A | 2 s reconnect timer — adequate for demo |
| Interaction | Full click + keyboard | None | View-only — correct for scope |
| Frame rate | 5–15 fps | N/A | ~2.5 fps at 400 ms interval — visible motion, acceptable for automation monitoring |

---

## Sources

- Direct code inspection: `src/main/engine/screencast.js` (all 159 lines)
- Direct code inspection: `src/renderer/components/LivePreviewPanel.jsx` (all 207 lines)
- Direct code inspection: `src/main/api/restServer.js` lines 1959–2195 (WebSocket server)
- Direct code inspection: `src/main/controllers/profiles.js` lines 223, 501–605 (runningProfiles.set calls)
- Direct code inspection: `src/main/state/runtime.js` (runningProfiles Map structure)
- Direct code inspection: `src/main/ipc/handlers.js` lines 170–191 (start-preview, stop-preview, screencast-status)
- Direct code inspection: `src/preload/index.js` lines 158–161 (startPreview, stopPreview, getScreencastStatus)
- Direct code inspection: `src/renderer/App.jsx` lines 45–46, 632–638 (previewProfile state, LivePreviewPanel mount)

---
*Feature research for: Live Screen / Screenshot Streaming — Electron + Playwright antidetect browser*
*Researched: 2026-04-25*
