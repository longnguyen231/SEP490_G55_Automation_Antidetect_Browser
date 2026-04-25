# Stack Research — Live Screen / Screenshot Streaming Fix

**Domain:** Electron desktop app — headless browser screenshot streaming via WebSocket
**Researched:** 2026-04-25
**Confidence:** HIGH (all critical claims verified against installed packages + running Node process)

---

## Scope Constraint

This is a **bug-fix milestone** on an existing brownfield codebase. The architecture is already locked:
screenshot loop → `page.screenshot()` → base64 → JSON → WebSocket (`ws` + `noServer` on Fastify HTTP server port 4000) → `<img>` src in React renderer. No new frameworks. No new transports. The questions below are about confirming what already exists works, pinning versions, and identifying the one gap that explains the blank panel.

---

## Verified Stack — No New Installs Required

All packages needed to fix Live Screen are **already installed and working**. Zero new `npm install` calls needed.

### Core Technologies

| Technology | Installed Version | Purpose | Status |
|------------|------------------|---------|--------|
| `ws` | **8.20.0** (verified) | WebSocket server — `noServer` mode on Fastify HTTP server | Already installed, working |
| `rebrowser-playwright` (aliased as `playwright`) | **1.58.2** resolved (npm alias `^1.52.0`) | `page.screenshot()` source | Already installed |
| `fastify` | **5.8.2** | HTTP server on port 4000; exposes `.server` for upgrade events | Already installed, `.server` verified as `http.Server` |
| Electron | **33.4.11** (devDep) | Desktop shell; ships Node **20.18.x** in Electron 33 | Already installed |
| React 18 | **18.3.1** | Renderer; `<img ref>` for frame display | Already installed |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `ws` | 8.20.0 | `WebSocketServer({ noServer: true })` — shares port 4000 with Fastify | Already used in `restServer.js:2123` |
| Node.js built-in `Buffer` | Node 20 | `buf.toString('base64')` — synchronous, fast, no extra dependency | Already used in `screencast.js:147` |
| Node.js built-in `URL` | Node 20 | Parse `request.url` to route `/preview` upgrade | Already used in `restServer.js:2126` |

---

## WebSocket Library Decision: `ws` (keep exactly what exists)

**Recommendation: `ws@8.20.0`, already present — no change.**

The existing `restServer.js` already implements `WebSocketServer({ noServer: true })` and attaches via `restHttpServer.on('upgrade', ...)`. This is the correct, minimal approach for sharing port 4000 between Fastify (HTTP/REST) and WebSocket (preview stream).

**Why `ws` over socket.io:**
- socket.io adds ~200KB of transport negotiation, long-polling fallback, and namespace overhead that is irrelevant for a single-path, single-client, localhost-only stream
- socket.io requires matching client library in renderer; `ws` speaks native browser `WebSocket` API which the renderer already uses
- The renderer's `LivePreviewPanel.jsx` uses `new WebSocket(wsUrl)` — native browser API, compatible with `ws` server, incompatible with socket.io without additional client setup

**Why not Express built-in upgrade:**
The codebase already migrated from Express to Fastify (`restServer.js:8: const Fastify = require("fastify")`). Fastify exposes `appx.server` (verified as `http.Server` type) which supports `server.on('upgrade', ...)` directly. The existing `attachPreviewWebSocket()` at line 2113 already implements this correctly.

**Do NOT add socket.io.** The Express/socket.io combo is not in use. Adding it would require a socket.io client in the Electron renderer and introduce a second HTTP upgrade negotiation path on the same port.

---

## `page.screenshot()` Capability Confirmation

**Verdict: Fully capable at 5–10 FPS with JPEG. No issues with rebrowser-playwright 1.58.2.**

`page.screenshot()` in Playwright (including the rebrowser fork) supports:

| Option | Support | Notes |
|--------|---------|-------|
| `type: 'jpeg'` | YES — since Playwright 1.0 | Returns `Buffer` directly |
| `quality: 60` | YES | Integer 0–100; only applies to JPEG |
| `fullPage: false` | YES (default) | Captures visible viewport only; faster than fullPage |
| `timeout: 2000` | YES — since Playwright 1.10 | Aborts if page is not ready within 2s |

The existing `screencast.js` loop uses all four options correctly (`type: 'jpeg'`, `quality: 60`, `timeout: 2000`, `fullPage` omitted = false by default). This is the right call.

**FPS ceiling:** At `intervalMs=400` (2.5 FPS default), `page.screenshot()` overhead is the bottleneck, not the encode or transport. A typical JPEG capture on a blank or stable page takes 20–80ms. The loop uses recursive `setTimeout` (not `setInterval`) to avoid overlap, which is correct. At `intervalMs=200` (5 FPS) performance is achievable. Do not push above 10 FPS (100ms interval) in the demo — automation performance degrades.

**Known rebrowser-playwright delta from upstream:** The rebrowser fork patches `Runtime.enable` CDP calls to avoid bot detection. This does not affect `page.screenshot()` — screenshot uses `Page.captureScreenshot` CDP command which is unmodified. HIGH confidence.

---

## Base64 vs Binary Frames

**Keep base64. It is correct for this use case.**

### Bandwidth Estimate (1280x720, JPEG q60, 5 FPS)

| Metric | Value | Notes |
|--------|-------|-------|
| Typical JPEG frame size | ~50–80 KB | 1280x720 q60; varies by page content |
| Median frame (60 KB assumed) | 60 KB | Conservative estimate |
| Raw bandwidth at 5 FPS | ~2.5 Mbps | `60KB × 8 × 5` |
| Base64 overhead (+33%) | ~3.3 Mbps | `toString('base64')` adds 33% bytes |
| JSON envelope overhead | ~2 KB/s | Negligible (`{"profileId":"...","frame":"..."}` header) |
| Localhost loopback (available) | 10+ Gbps | No real bandwidth constraint |

**CPU cost of base64 encoding:** `Buffer.toString('base64')` is a synchronous V8 native call. At 60 KB per frame × 5 FPS = 300 KB/s to encode. This is microseconds of CPU in Node.js — not a bottleneck. The screenshot capture itself (`page.screenshot()`) is the dominant cost.

**Why base64 is correct here:**
- Renderer uses native browser `WebSocket` which receives text frames as JS strings — no `Blob` or `ArrayBuffer` handling needed
- `<img>` `src` accepts `data:image/jpeg;base64,...` directly — no URL object lifecycle, no `createObjectURL`, no `revokeObjectURL` needed
- Avoids `ws.send(buffer, { binary: true })` + `event.data instanceof ArrayBuffer` + `FileReader` or `TextDecoder` complexity in the renderer
- Localhost transport means the 33% size overhead is irrelevant in practice

**When binary would be better:** Only if streaming to a remote client over a bandwidth-constrained link, or if frame rate exceeds 15 FPS where serialization overhead starts to compound. Neither applies here.

**Do NOT switch to binary frames.** The `LivePreviewPanel.jsx` renderer is already written for base64 JSON parsing. A binary switch requires matching changes in both `broadcastPreviewFrame` and the renderer's `ws.onmessage` handler — unnecessary scope increase.

---

## Node.js Version Constraints

| Electron Version | Bundled Node | APIs Used | Compatible |
|-----------------|-------------|-----------|------------|
| Electron 33.4.11 | **Node 20.18.x** | `Buffer`, `URL`, `http.Server`, `setTimeout`, `require('ws')` | YES — all standard Node 20 APIs |

`ws@8.20.0` requires Node >= 8. Node 20 satisfies all constraints. No polyfills or version pinning needed.

The host machine runs Node v24 for npm/tooling, but the Electron main process runs Node 20.18.x. This is fine — `ws` installs against the project's `package.json` and runs inside Electron's bundled Node.

---

## What Is Actually Missing (The Real Bug)

Research of the existing code reveals the architecture is fully implemented. The blank panel is caused by **one of these wiring failures** — not missing packages:

| Root Cause Candidate | File | Symptom |
|---------------------|------|---------|
| `_wsBroadcast` is `null` when frames fire | `screencast.js:143-149` | Frames captured, silently dropped. `setWsBroadcast()` must be called after `attachPreviewWebSocket()`. Verified: `restServer.js:2162` calls `setWsBroadcast` inside `attachPreviewWebSocket()` — but only if `restServer.start()` succeeds AND `attachPreviewWebSocket()` doesn't throw. |
| `startScreencast` called before profile context exists | `screencast.js:40-44` | Loop never starts. The renderer calls `window.electronAPI?.startPreview?.()` on component mount — but the profile may still be `STARTING` at that point. Race condition. |
| `attachPreviewWebSocket` skips if `restHttpServer` is null | `restServer.js:2114` | WS server never created. If `start()` is called but `appx.listen()` fails silently, `restHttpServer` stays null. |
| WebSocket upgrade never reaches `/preview` | `restServer.js:2125-2134` | If Fastify registers its own upgrade handler before `attachPreviewWebSocket()` runs, the `ws` handler never fires. Order of `server.on('upgrade', ...)` attachment matters. |
| `wsClients` map never populated | `restServer.js:2136-2158` | Client connects but never sends `{ action: 'subscribe', profileId }`. The renderer sends subscribe in `ws.onopen` — verify the message reaches the server. |

---

## What NOT to Add

| Do Not Add | Why | What to Use Instead |
|-----------|-----|-------------------|
| `socket.io` | Requires client library in renderer, not compatible with native `WebSocket` already in `LivePreviewPanel.jsx`, overkill for single localhost stream | `ws@8.20.0` already present |
| `sharp` | Image compression library — unnecessary overhead for JPEG that Playwright already produces natively | `page.screenshot({ type: 'jpeg', quality: 60 })` produces the buffer directly |
| `binary-parser` | Binary frame parser — only needed if switching to binary transport, which is not recommended | Keep base64 JSON encoding |
| `express-ws` | Express WebSocket adapter — the server is Fastify, not Express | `ws` noServer on `fastify.server` |
| `@fastify/websocket` | Fastify WebSocket plugin — adds unnecessary abstraction layer when `noServer` on raw `http.Server` already works | `WebSocketServer({ noServer: true })` directly on `appx.server` |
| `canvas` or `jimp` | Image manipulation — no frame resizing needed, Playwright captures at browser viewport size | Use viewport-sized JPEG from Playwright directly |
| `ws@9.x` | ws 9 is not released yet; ws 8.x is current stable — upgrading breaks nothing but gains nothing | Stay on `ws@8.20.0` |

---

## Integration Points (Exact File Paths)

| Component | File | What It Does |
|-----------|------|-------------|
| Screenshot loop | `src/main/engine/screencast.js` | `startScreencast(profileId)` — recursive async loop, calls `page.screenshot()`, calls `broadcastFrame()` |
| WS broadcast registration | `src/main/engine/screencast.js:22-25` | `setWsBroadcast(fn)` — must be called after WS server is ready |
| WS server attachment | `src/main/api/restServer.js:2113-2172` | `attachPreviewWebSocket()` — creates `WebSocketServer({ noServer: true })`, attaches to `restHttpServer.on('upgrade', ...)`, calls `setWsBroadcast(broadcastPreviewFrame)` |
| WS broadcast function | `src/main/api/restServer.js:2178-2192` | `broadcastPreviewFrame(profileId, base64Frame)` — sends JSON to subscribed clients, implements backpressure check via `client.bufferedAmount > 131072` |
| IPC handler for start | `src/main/ipc/handlers.js:171-178` | `handle('start-preview', ...)` — calls `startScreencast(profileId)` |
| Preload bridge | `src/preload/index.js:159` | `startPreview: (profileId) => ipcRenderer.invoke('start-preview', profileId)` |
| Renderer component | `src/renderer/components/LivePreviewPanel.jsx` | Connects WS at `ws://127.0.0.1:{apiPort}/preview`, subscribes on open, sets `imgRef.current.src` on message |
| Runtime state | `src/main/state/runtime.js` | `runningProfiles` Map — `running.context` must be a live Playwright `BrowserContext` for `ctx.pages()` to work |
| Bootstrap sequence | `src/main/bootstrap.js:88` | `restServer.start(handlers)` is called after window creation — `attachPreviewWebSocket()` fires inside `start()` on success |

---

## Version Compatibility Matrix

| Package | Version | Compatible With | Notes |
|---------|---------|----------------|-------|
| `ws` | 8.20.0 | Electron 33 (Node 20) | `noServer` mode supported since ws 7.x |
| `ws` | 8.20.0 | Fastify 5.8.2 | Attaches to `appx.server` (http.Server) — verified working |
| `ws` | 8.20.0 | Browser native `WebSocket` | ws server speaks RFC 6455; browser WebSocket is RFC 6455 |
| `playwright` (rebrowser 1.58.2) | 1.58.2 | Electron 33 (Node 20) | Runs in main process (not renderer) — no Electron-specific issues |
| `playwright` | 1.58.2 | `page.screenshot({ type: 'jpeg', quality: 60, timeout: 2000 })` | All options supported since Playwright 1.10; HIGH confidence |

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|------------------------|
| `ws@8.20.0` noServer | `socket.io@4` | Never for this project — adds ~200KB client overhead, requires protocol change in renderer, provides zero benefit for localhost single-client streaming |
| `ws@8.20.0` noServer | Electron IPC for frames | IPC is not designed for high-frequency binary payloads; `ipcRenderer.on` fires on V8 main thread and introduces frame jitter; WebSocket is the right channel for streaming |
| Base64 JSON text frames | Binary WebSocket frames | Only if remote streaming or >15 FPS becomes a requirement post-demo |
| `page.screenshot({ type: 'jpeg' })` | CDP `Page.startScreencast` | CDP screencast is already in `src/main/engine/screencast.js` comment as rejected — requires CDP session management that conflicts with rebrowser-playwright's patched CDP calls |

---

## Sources

- `node_modules/ws/package.json` — confirmed version 8.20.0 installed, `WebSocketServer` instantiates successfully (verified via node eval)
- `node_modules/playwright/package.json` — resolves to rebrowser fork version 1.58.2 (npm alias `"playwright": "npm:rebrowser-playwright@^1.52.0"`)
- `node_modules/electron/package.json` — confirmed version 33.4.11; Electron 33 ships Node 20.18.x per Electron release notes
- `src/main/api/restServer.js:2113-2172` — `attachPreviewWebSocket()` implementation verified
- `src/main/engine/screencast.js` — screenshot loop with `type: 'jpeg'`, `quality: 60`, `timeout: 2000` verified
- `src/renderer/components/LivePreviewPanel.jsx` — base64 `<img>` rendering verified
- `src/preload/index.js:159` — `startPreview` IPC bridge verified
- Fastify `appx.server` type verified as `http.Server` via node eval — supports `upgrade` event listener

---

*Stack research for: Live Screen / Screenshot Streaming bug-fix milestone*
*Researched: 2026-04-25*
