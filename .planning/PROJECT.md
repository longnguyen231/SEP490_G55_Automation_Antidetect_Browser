# SEP490 G55 — Automation Antidetect Browser

## What This Is

A desktop application (Electron 33 + React 18) that manages multiple browser profiles with unique fingerprints, proxy configurations, and automation capabilities. Built for users who need to operate multiple isolated browser identities — affiliate marketers, multi-account managers, and QA testers. This is an FPT University capstone project (SEP490, Group 55).

## Core Value

Users can launch headless browser profiles with unique fingerprints and **see what those browsers are doing in real-time** — making headless automation observable, debuggable, and demo-ready.

## Requirements

### Validated

- ✓ Create, edit, delete browser profiles with unique fingerprints — existing
- ✓ Launch profiles with antidetection (fingerprint injection via CDP overrides) — existing
- ✓ Configure proxy per profile (HTTP/HTTPS/SOCKS) with validation — existing
- ✓ Run profiles in headless mode via Playwright — existing
- ✓ Execute automation scripts per profile (VM sandbox with Playwright API) — existing
- ✓ Schedule automation via cron (node-cron) — existing
- ✓ Persist profiles, proxies, scripts, settings to local JSON/SQLite storage — existing
- ✓ IPC + REST API dual communication layer (preload bridge + Express fallback) — existing
- ✓ Real-time profile state broadcast (running-map-changed events) — existing
- ✓ Structured logging with profile-scoped log streams — existing

### Active

- [ ] Headless Live Preview — stream real-time browser screen to UI per profile
- [ ] Live Screen panel — dedicated UI showing profile ID, status, headless indicator
- [ ] Screenshot-based streaming — Playwright page.screenshot() loop (300-500ms) via WebSocket
- [ ] Per-profile stream lifecycle — start on headless launch, stop on profile stop
- [ ] Lightweight demo-grade performance — optimized for observation, not production streaming

### Out of Scope

- Production-grade video streaming (WebRTC, RTMP) — demo-grade screenshot streaming is sufficient for capstone
- Interactive remote control through live preview (click/type forwarding) — view-only for this milestone
- Multi-profile simultaneous streaming dashboard — single profile stream at a time is sufficient
- Cloud deployment / remote access — desktop-only Electron app

## Context

- **Codebase state:** Brownfield — functional antidetect browser with profile management, automation, and dual IPC/REST architecture already in place
- **Architecture:** Electron main process (Node.js) ↔ preload bridge ↔ React 18 renderer. State broadcast via `running-map-changed` IPC events from `src/main/state/runtime.js`
- **Browser engines:** rebrowser-playwright 1.52 (primary) + Chrome DevTools Protocol (secondary). Headless launching already works via Playwright
- **Storage:** JSON files in `data/` directory (profiles.json, settings.json, etc.) with better-sqlite3/drizzle-orm available but underused
- **Frontend:** React 18 + Bootstrap 5 + Tailwind CSS + Zustand state management
- **Build:** Vite 5 + electron-builder 26
- **Testing:** Vitest configured but no tests written
- **Key integration point:** `src/main/state/runtime.js` maintains `runningProfiles` Map with browser/context refs — the live preview will tap into these Playwright contexts for screenshots

## Constraints

- **Tech stack**: Must extend existing Electron + React + Playwright stack — no framework changes
- **Performance**: Screenshot streaming must not degrade browser automation performance (separate async loop)
- **Electron security**: Must maintain contextIsolation and preload bridge pattern — no nodeIntegration in renderer
- **Scope**: SEP490 capstone — feature-complete for demo, not production-hardened

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Screenshot loop (page.screenshot) over CDP screencast | Simpler implementation, works with rebrowser-playwright, sufficient FPS for demo | — Pending |
| WebSocket for image transport | Lower latency than IPC for binary data, Express server already running on port 4000 | — Pending |
| Base64 encoding for screenshots | Direct embedding in `<img>` src, avoids binary blob handling in renderer | — Pending |
| View-only (no interaction) | Drastically reduces scope — input forwarding is a separate feature | — Pending |
| Single-profile stream at a time | Simplifies resource management, sufficient for demo | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-14 after initialization*
