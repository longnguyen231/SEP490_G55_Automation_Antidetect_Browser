# Project State

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-04-25 — Milestone v1.0 Screenshot / Live Screen Stabilization started

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-25)

**Core value:** Users can launch headless browser profiles with unique fingerprints and see what those browsers are doing in real-time — making headless automation observable, debuggable, and demo-ready.
**Current focus:** v1.0 Screenshot / Live Screen Stabilization — fix the blank Live Screen panel by debugging screenshot loop, WebSocket transport, renderer binding, and lifecycle wiring.

## Accumulated Context

- Codebase is brownfield Electron + React + Playwright with JSON file storage
- Backend profile CRUD and lifecycle management (STARTING/RUNNING/STOPPING/STOPPED/ERROR) already functional
- Live Screen feature already partially implemented (screenshot loop, WebSocket on Express port 4000, Base64 frames, view-only) but currently renders nothing in the UI
- Demo audience is FPT University capstone panel — must "just work" end-to-end
- Architecture decisions locked: page.screenshot loop, WebSocket transport, Base64 encoding, view-only, single-profile stream
- Tap point: `runningProfiles` Map in `src/main/state/runtime.js` holds Playwright contexts
- Other v1.0 Active items (lifecycle sync, CRUD UX cleanup, UI improvements) remain in PROJECT.md Active and will be addressed in later milestones
