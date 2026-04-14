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

- [ ] Lifecycle state synchronization — backend as single source of truth, UI reflects real state reliably
- [ ] Race condition prevention — disable launch/stop buttons during transitions, prevent double-click issues
- [ ] CRUD UX cleanup — sync form defaults with backend, validation feedback, clear error messages
- [ ] Immediate state refresh — UI updates instantly after create/update/delete/launch/stop operations
- [ ] Profile list UI improvements — search/filter/sort toolbar, profile count, status labels, empty states
- [ ] Live Screen integration — headless preview panel connected to profile lifecycle

### Out of Scope

- Auto-restart on crash — not needed for demo
- Advanced lifecycle features (warmup sequences, session persistence across app restarts) — beyond demo scope
- Complex automation workflows — existing automation is sufficient
- High-scale performance optimization — demo operates with dozens of profiles, not thousands
- Advanced proxy rotation — existing per-profile proxy assignment is sufficient
- Bulk operations UI — optional, not critical for demo
- Cloud deployment / remote access — desktop-only Electron app

## Current Milestone: v1.0 Profile Management

**Goal:** Build a stable, demo-ready profile management system with reliable lifecycle sync, clean CRUD UX, and UI improvements for the FPT capstone panel.

**Target features:**
- Lifecycle state synchronization (backend as single source of truth, reliable UI updates)
- CRUD UX cleanup (form defaults, validation, error handling, immediate state refresh)
- Profile list UI improvements (search/filter/sort, status labels, empty states)
- Live Screen integration (headless preview connected to profile lifecycle)

**Priority order:**
1. Lifecycle sync (CRITICAL)
2. CRUD UX cleanup
3. UI improvements
4. Live Screen integration

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
*Last updated: 2026-04-15 after milestone v1.0 Profile Management started*
