# Architecture

**Analysis Date:** 2026-04-13

## Pattern Overview

**Overall:** Electron IPC-based monolithic application with three distinct layers:
1. **Main Process** - Node.js backend managing browser instances, automation, and data
2. **Renderer Process** - React 18 UI communicating with main via IPC and fallback REST API
3. **Preload Bridge** - ContextBridge exposing secure IPC channels to renderer

**Key Characteristics:**
- Hybrid IPC + REST API design (prefers IPC, falls back to REST)
- Event-driven profile lifecycle management with in-memory state tracking
- Multi-engine browser support (Playwright and Chrome DevTools Protocol/CDP)
- Plugin-friendly script execution with npm module support
- Structured logging across all layers with profile-scoped log streams

## Layers

**Main Process (Backend):**
- Purpose: Core application logic, browser lifecycle management, automation scheduler, data persistence
- Location: `src/main/`
- Contains: IPC handlers, controllers, services, storage, logging, browser engines
- Depends on: Electron, Playwright, Chrome, better-sqlite3, Fastify (REST API), node-cron
- Used by: Renderer via IPC; external tools via REST API

**Renderer Process (Frontend):**
- Purpose: User interface for profile management, automation, monitoring, and settings
- Location: `src/renderer/`
- Contains: React components, styles, hooks, i18n translations
- Depends on: React 18, React-Bootstrap, Vite (build), shared services from `src/shared/`
- Used by: End users; communicates with main process via preload bridge

**Shared Layer:**
- Purpose: Reusable abstractions, API clients, IPC bridge, common components
- Location: `src/shared/`
- Contains: API client, IPC bridge, hooks (`useApiClient`, `useProfiles`), common UI components, utilities
- Depends on: Nothing (no dependencies to main or renderer)
- Used by: Both renderer and web-admin; future module installations

**Web Admin (Subsidiary UI):**
- Purpose: Separate React admin dashboard (separate build, currently under `src/web-admin/`)
- Location: `src/web-admin/src/`
- Contains: Admin pages, auth, API integration
- Depends on: Same REST API as renderer

## Data Flow

**Profile Launch Flow:**

1. Renderer calls `window.electronAPI.launchProfile(profileId, options)` (IPC preload method)
2. IPC handler in `src/main/ipc/handlers.js` invokes `launchProfileInternal()`
3. `src/main/controllers/profiles.js` orchestrates:
   - Loads profile from `src/main/storage/profiles.js` (reads `data/profiles.json`)
   - Resolves fingerprint and settings from profile record
   - Launches browser via `src/main/engine/cdp.js` (CDP) or Playwright engine
   - Stores running instance in `src/main/state/runtime.js` (in-memory Map)
   - Applies antidetection overrides via `src/main/engine/cdpOverrides.js`
4. Main process sends `running-map-changed` IPC event to renderer with running profiles map
5. Renderer updates UI state showing running profiles and WebSocket endpoints

**Script Execution Flow:**

1. Renderer calls `window.electronAPI.executeScript(profileId, scriptId, opts)`
2. IPC handler retrieves script from `src/main/storage/scripts.js`
3. Launches profile if not running (headless mode available)
4. `src/main/engine/scriptRuntime.js` executes in VM sandbox:
   - Injects Playwright page/context objects (unified API for both CDP and Playwright)
   - Exposes `actions` proxy to script for antidetect actions
   - Captures console logs into structured task log
5. Task execution logged to `src/main/storage/taskLogs.js` (JSON storage)
6. Results streamed back to renderer via IPC response

**Automation Scheduler Flow:**

1. On startup, `src/main/engine/automation.js` reads profiles from storage
2. For each profile with enabled cron schedule, creates node-cron job
3. At scheduled time, automatically launches profile via `launchProfileInternal()`
4. Optional automation.steps executed after launch
5. Profile lifecycle events logged to profile-specific logs

**State Broadcast:**

1. Main process maintains two Maps: `runningProfiles` and `profileStatuses` in `src/main/state/runtime.js`
2. Background heartbeat timer (30s interval) checks profile health:
   - Playwright: checks `context.isClosed()` and `browser.isConnected()`
   - CDP: pings WebSocket endpoint
3. On state change, broadcasts `running-map-changed` event to all renderer windows
4. Renderer subscribes via `window.electronAPI.onRunningMapChanged(callback)`

**REST API Fallback:**

1. Main process starts Express server on port 4000 (configurable) via `src/main/api/restServer.js`
2. All IPC handlers mirror REST endpoints (`/api/profiles`, `/api/profiles/:id/launch`, etc.)
3. If preload bridge unavailable (web-admin, external tools), REST API used as fallback
4. API key authentication optional, configured via `settings.json` or env var

## Key Abstractions

**Profile:**
- Purpose: Encapsulates browser fingerprint, settings, automation rules, cookies, and metadata
- Examples: `src/main/storage/profiles.js` (storage), `src/main/controllers/profiles.js` (lifecycle)
- Pattern: JSON serialization with nested objects (fingerprint, settings, automation)
- Unique ID: UUID generated on creation, persisted in `data/profiles.json`

**Fingerprint:**
- Purpose: Antidetection identity including User-Agent, screen resolution, language, timezone
- Examples: Generated via `src/main/engine/fingerprintGenerator.js` (rebrowser-playwright FP generator)
- Pattern: Immutable at profile creation, can be manually edited via UI
- Applied via: `src/main/engine/cdpOverrides.js` (Chrome DevTools Protocol injection)

**Running Instance:**
- Purpose: In-memory reference to active browser process, context, and communication endpoints
- Examples: Stored in `runningProfiles` Map in `src/main/state/runtime.js`
- Pattern: Key = profileId, Value = { engine, wsEndpoint, browser, context, childProc, heartbeat }
- Lifecycle: Created on profile launch, deleted on profile stop or crash detection

**Script Module:**
- Purpose: NPM package installed and registered for use in user automation scripts
- Examples: `src/main/storage/scriptModules.js` (manages installation/uninstallation)
- Pattern: Installed to `data/script-modules/node_modules/`, validated at runtime
- Execution: Safely required in VM sandbox via `src/main/engine/scriptRuntime.js`

**Preset:**
- Purpose: Reusable profile template with partial settings
- Examples: `src/main/storage/presets.js` (CRUD operations)
- Pattern: Stored in `data/presets.json`, can be applied to create new profiles
- Use case: Rapid profile cloning with preset fingerprints/settings

## Entry Points

**Main Process Entry:**
- Location: `src/main/bootstrap.js`
- Triggers: `npm start` or electron auto-launch via package.json main field
- Responsibilities:
  1. Initialize data directories and files via `src/main/storage/paths.js`
  2. Register IPC handlers via `src/main/ipc/handlers.js`
  3. Create main window via `src/main/window/mainWindow.js`
  4. Start REST API server in background
  5. Start automation scheduler via `src/main/engine/automation.js`
  6. Start background heartbeat for profile health checks
  7. Signal renderer when backend is fully ready via `backend-ready` IPC event

**Renderer Entry:**
- Location: `src/renderer/main.jsx`
- Triggers: Vite dev server (port 5173) or bundled `dist/renderer/index.html`
- Responsibilities:
  1. Mount React app via `ReactDOM.createRoot()` to `#root` div
  2. Wrap App with i18n provider for translations
  3. Load Bootstrap CSS for base styling

**Preload Entry:**
- Location: `src/preload/index.js`
- Triggers: Before BrowserWindow content loads
- Responsibilities:
  1. Expose `window.electronAPI` object via contextBridge
  2. Define all IPC invoke methods (profiles, scripts, proxies, settings, etc.)
  3. Define all IPC on/once listeners for main-to-renderer events
  4. Enable secure renderer-to-main communication without full Node.js access

## Error Handling

**Strategy:** Layered error reporting with logging at each boundary

**Patterns:**

1. **Main Process Errors:**
   - Logged via `appendLog(profileId, message)` in `src/main/logging/logger.js`
   - Stored in `data/logs/{profileId}.log` files
   - Returned to renderer as `{ success: false, error: "..." }` responses

2. **IPC Handler Errors:**
   - Try-catch in handler; error logged; error string returned in response object
   - Renderer receives consistent response format: `{ success, result or error, ... }`

3. **Profile Launch Failures:**
   - Engine resolution failure caught; logged with fallback options
   - Profile marked as ERROR status via `setProfileStatus(profileId, 'ERROR')`
   - User notified via toast messages in renderer
   - Profile heartbeat skips failed profiles gracefully

4. **Script Execution Errors:**
   - VM sandbox catches syntax/runtime errors
   - Task logged with error message to `data/task-logs/`
   - Error streamed to renderer and displayed in task log UI

5. **REST API Errors:**
   - Express middleware catches unhandled errors
   - Returned as HTTP error responses with JSON bodies
   - Renderer falls back to IPC if REST unavailable

## Cross-Cutting Concerns

**Logging:** 
- Implemented via `src/main/logging/logger.js` (pino-based)
- Scoped by profileId; system logs use profileId = 'system'
- All logs streamed to renderer via `app-log` IPC event
- Persisted to file-based logs in `data/logs/`
- UI streams logs in real-time in App Logs tab and Profile Logs modal

**Validation:**
- Profile data validated on save via JSON schema (Zod in some endpoints)
- Fingerprint settings validated against known platform/browser combinations
- Proxy configuration validated before use (port ranges, URL format)
- Script module dependencies validated at install time

**Authentication:**
- Machine licensing via `src/main/services/machineId.js` (hardware-based machine code)
- Optional API key for REST endpoints (configured via settings)
- No user login system in main app; optional via web-admin

**State Persistence:**
- Profile CRUD → `data/profiles.json`
- Settings → `data/settings.json`
- Presets → `data/presets.json`
- Scripts → `data/scripts.json`
- Proxies → `data/proxies.json`
- Task logs → `data/task-logs/{taskId}.json`
- Per-profile cookies/storage → `data/profiles/{profileId}-storage.json`
- All files use atomic write via fs operations; no SQL database

**Performance Optimization:**
- Browser instances cached in `runningProfiles` Map to avoid redundant launches
- Fingerprint generation cached per Chrome version
- Profiles list loaded once on app start; re-read on file changes
- REST API responses paginated for large datasets (proxies, task logs)
- Renderer uses React.useMemo for API client initialization
- Lazy loading of profile details in list view

---

*Architecture analysis: 2026-04-13*
