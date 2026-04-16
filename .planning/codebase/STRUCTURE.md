# Codebase Structure

**Analysis Date:** 2026-04-13

## Directory Layout

```
project-root/
├── src/
│   ├── main/                    # Electron main process (Node.js backend)
│   │   ├── bootstrap.js         # Entry point — initializes app
│   │   ├── api/                 # REST API server (Express/Fastify)
│   │   ├── config/              # App configuration (chrome paths, etc.)
│   │   ├── controllers/         # Business logic controllers (profiles)
│   │   ├── engine/              # Browser engines, automation, scripts
│   │   ├── ipc/                 # IPC handler registration
│   │   ├── logging/             # Logging service (pino)
│   │   ├── services/            # Reusable services (proxy checker, license)
│   │   ├── state/               # In-memory runtime state (running profiles)
│   │   ├── storage/             # Data persistence (JSON files)
│   │   └── window/              # Electron window management
│   ├── preload/                 # Electron preload script (IPC bridge)
│   │   ├── index.js             # Main preload — exposes window.electronAPI
│   │   └── preload.js           # Placeholder for future work
│   ├── renderer/                # React renderer process (frontend UI)
│   │   ├── main.jsx             # React entry point
│   │   ├── App.jsx              # Root component
│   │   ├── index.css            # Global styles
│   │   ├── components/          # React components
│   │   ├── pages/               # Page-level components
│   │   ├── hooks/               # Local hooks (empty, use src/shared/hooks)
│   │   ├── i18n/                # Internationalization
│   │   └── styles/              # Component-scoped styles
│   ├── shared/                  # Shared code (renderer + external tools)
│   │   ├── components/          # Shared UI components (Button, Card, Toast)
│   │   ├── hooks/               # Shared React hooks (useApiClient, useProfiles)
│   │   ├── services/            # API client and IPC bridge
│   │   ├── styles/              # Shared CSS
│   │   └── utils/               # Utility functions
│   └── web-admin/               # Separate admin dashboard (optional build)
│       └── src/
│           ├── pages/           # Admin pages (Auth, Dashboard, Profiles, etc.)
│           ├── components/      # Admin-specific components
│           ├── services/        # REST API integration
│           ├── store/           # State management (Zustand)
│           └── layouts/         # Layout components
├── dist/                        # Built output (generated)
│   ├── renderer/                # Renderer bundle (Vite output)
│   └── main/                    # Main process (if compiled)
├── release/                     # Electron packaged app (generated)
├── data/                        # Runtime data (generated, .gitignored)
│   ├── profiles.json            # Profile definitions
│   ├── settings.json            # App settings
│   ├── presets.json             # Preset templates
│   ├── scripts.json             # User automation scripts
│   ├── proxies.json             # Proxy configurations
│   ├── profiles/                # Per-profile storage
│   │   ├── {profileId}-storage.json  # Cookies, cache, etc.
│   │   └── {profileId}-viewport.json # Saved viewport state
│   ├── logs/                    # Profile execution logs
│   │   └── {profileId}.log      # Per-profile log file
│   ├── task-logs/               # Script task execution logs
│   │   └── {taskId}.json        # Completed task record
│   └── script-modules/          # User-installed npm packages
│       └── node_modules/        # Installed via scriptModules.js
├── vendor/                      # Vendored Chrome binaries (platform-specific)
│   ├── chrome-win/              # Windows Chrome
│   ├── chrome-linux/            # Linux Chrome AppImage
│   └── chromium-mac/            # macOS Chromium
├── build/                       # Build assets
│   └── 1.png                    # App icon (PNG)
├── public/                      # Public assets (dev)
│   └── 1.png                    # App icon
├── node_modules/                # Dependencies
├── package.json                 # Manifest with Electron config, build rules
├── vite.config.js               # Renderer build config
├── tsconfig.json                # TypeScript config (unused, codebase is JS)
└── .gitignore                   # Excludes data/, vendor/, node_modules/
```

## Directory Purposes

**`src/main/`**
- Purpose: Electron main process backend; all non-UI logic
- Contains: IPC handlers, browser lifecycle, data persistence, automation
- Key files: `bootstrap.js` (entry), `ipc/handlers.js` (all RPC routes), `controllers/profiles.js` (profile launch/stop), `storage/*.js` (data I/O)

**`src/main/api/`**
- Purpose: Express/Fastify REST API server for external tools and fallback
- Contains: Route definitions, Express middleware, CORS configuration
- Key files: `restServer.js` (server factory and route definitions)

**`src/main/engine/`**
- Purpose: Browser engines, antidetection, automation, script execution
- Contains: CDP integration, Playwright integration, fingerprint generation, script sandbox
- Key files: `cdp.js` (Chrome DevTools Protocol), `scriptRuntime.js` (script VM execution), `automation.js` (cron scheduler), `fingerprintGenerator.js` (User-Agent/screen generation)

**`src/main/controllers/`**
- Purpose: Business logic orchestrators; bridge between IPC handlers and services
- Contains: Profile launch/stop logic, profile-specific actions
- Key files: `profiles.js` (all profile operations)

**`src/main/storage/`**
- Purpose: Data persistence layer; reads/writes to JSON files in `data/`
- Contains: CRUD operations for profiles, scripts, presets, proxies, settings
- Key files: `profiles.js` (profile CRUD), `scripts.js` (script CRUD), `paths.js` (data directory management), `settings.js` (app settings)

**`src/main/state/`**
- Purpose: In-memory runtime state; Map-based fast lookups
- Contains: Running profile instances, profile statuses, helper functions
- Key files: `runtime.js` (runningProfiles Map, profileStatuses Map, status functions)

**`src/main/logging/`**
- Purpose: Centralized logging service
- Contains: Pino logger setup, file-based log output, streaming to renderer
- Key files: `logger.js` (appendLog function, log file management)

**`src/main/services/`**
- Purpose: Reusable business services (not storage, not UI)
- Contains: Proxy checker, license validation, machine ID, browser manager
- Key files: `ProxyChecker.js` (proxy alive/latency checks), `machineId.js` (hardware ID generation)

**`src/main/config/`**
- Purpose: Configuration helpers
- Contains: Chrome executable resolution, platform-specific paths
- Key files: `app.config.js` (general config utilities)

**`src/preload/`**
- Purpose: Electron preload script; IPC bridge between main and renderer
- Contains: ContextBridge setup, IPC method definitions
- Key files: `index.js` (exposes window.electronAPI with all IPC methods)

**`src/renderer/`**
- Purpose: React UI application
- Contains: React components, page layouts, i18n, global styles
- Key files: `main.jsx` (React entry), `App.jsx` (root component), `components/` (50+ UI components)

**`src/renderer/components/`**
- Purpose: Reusable React UI components specific to main app
- Contains: ProfileList, ProfileForm, CookieManager, ScriptsManager, ProxyManager, LogViewer, modals, tabs
- Naming pattern: PascalCase component names, co-located CSS files
- Notable: ProfileCard (single profile display), DashboardSidebar (navigation), Toasts (notification system)

**`src/renderer/pages/`**
- Purpose: Page-level components (if used; currently most are in App.jsx tabs)
- Contains: Placeholder; main UI uses active tab state in App.jsx

**`src/renderer/i18n/`**
- Purpose: Internationalization and translations
- Contains: Translation files (EN, VI, etc.), i18n provider component
- Pattern: Translation keys namespaced by domain (profile, script, proxy, etc.)

**`src/shared/`**
- Purpose: Code shared between renderer and external tools (web-admin, REST clients)
- Contains: API client abstractions, IPC bridge wrapper, shared components, utilities
- Key files: `services/api/client.js` (REST client), `services/ipc/ipcBridge.js` (IPC wrapper), `hooks/useApiClient.js` (choose IPC or REST)

**`src/shared/services/api/`**
- Purpose: REST API client implementations
- Contains: Base ApiClient class, service-specific clients (ProfilesApi, AutomationApi, etc.)
- Key files: `client.js` (HTTP client), `profiles.js` (profile service), `automation.js` (automation service)

**`src/shared/services/ipc/`**
- Purpose: IPC bridge for safe Electron communication
- Contains: IPC client wrapper, channel definitions
- Key files: `ipcBridge.js` (wrapper around window.electronAPI), `index.js` (exports)

**`src/shared/hooks/`**
- Purpose: React hooks for data fetching and state management
- Contains: useApiClient (choose IPC or REST), useProfiles, useSettings, useAutomation, useToast
- Pattern: Each hook combines API client with local state management

**`src/shared/components/common/`**
- Purpose: Generic reusable components (Button, Card, Toast)
- Contains: Base UI primitives, style-agnostic
- Pattern: Minimal styling; rely on Bootstrap for layout

**`src/web-admin/`**
- Purpose: Separate admin dashboard (built independently)
- Contains: Auth pages, admin-only features, API integration
- Build: Separate Vite config (not included in main app build)

## Key File Locations

**Entry Points:**

- `src/main/bootstrap.js` - Main process startup; initializes app, IPC, REST API, automation
- `src/renderer/main.jsx` - Renderer process startup; mounts React app to DOM
- `src/preload/index.js` - Preload script entry; exposes IPC API to renderer
- `src/main/window/mainWindow.js` - Creates BrowserWindow, loads preload, routes URLs

**Configuration:**

- `package.json` - Electron config, build rules, dependencies
- `vite.config.js` - Renderer build config, path aliases
- `src/main/storage/paths.js` - Data directory management, file path functions
- `src/main/storage/settings.js` - App settings CRUD, Chrome path resolution

**Core Logic:**

- `src/main/controllers/profiles.js` - Profile launch/stop orchestration
- `src/main/ipc/handlers.js` - All IPC RPC method handlers (300+ lines)
- `src/main/engine/automation.js` - Cron job scheduler for profile auto-launch
- `src/main/engine/scriptRuntime.js` - Script execution VM sandbox
- `src/main/engine/cdp.js` - Chrome DevTools Protocol integration

**State & Storage:**

- `src/main/state/runtime.js` - In-memory running profile instances Map
- `src/main/storage/profiles.js` - Profile CRUD, fingerprint generation defaults
- `src/main/storage/scripts.js` - Script CRUD
- `src/main/storage/proxies.js` - Proxy CRUD with import/export
- `data/profiles.json` - All profile definitions (runtime file)
- `data/settings.json` - Global app settings (runtime file)

**UI Components (Renderer):**

- `src/renderer/App.jsx` - Root component; manages tabs, modals, state
- `src/renderer/components/ProfileList.jsx` - List of profiles with live status
- `src/renderer/components/ProfileForm.jsx` - Create/edit profile modal
- `src/renderer/components/ScriptsManager.jsx` - Script CRUD and execution UI
- `src/renderer/components/ProxyManager.jsx` - Proxy management UI
- `src/renderer/components/LogViewer.jsx` - Real-time log display
- `src/renderer/components/DashboardSidebar.jsx` - Navigation sidebar

**API & Communication:**

- `src/main/api/restServer.js` - Express server, route definitions
- `src/preload/index.js` - IPC method definitions
- `src/shared/services/api/client.js` - REST HTTP client
- `src/shared/hooks/useApiClient.js` - React hook to get API client (IPC or REST)

**Testing & Quality:**

- `.eslintrc` (if present) - Linting rules
- `vitest.config.js` (if configured) - Currently no test config (test script returns error)

## Naming Conventions

**Files:**

- `.js` - Main process, preload, config files
- `.jsx` - React components (renderer)
- `.css` - Component-scoped or shared styles
- `.json` - Data files (profiles, scripts, settings, proxies)
- Camel case: `fingerprintGenerator.js`, `ProxyChecker.js`, `ProfileCard.jsx`
- Kebab case: Never used in this codebase; use camelCase

**Directories:**

- Lowercase: `main/`, `preload/`, `renderer/`, `shared/`, `engine/`, `storage/`
- PascalCase: Never; keep all directories lowercase
- Pattern: Functional grouping (by layer: main, renderer) or feature (api, engine, storage)

**Components:**

- PascalCase for all React component files: `ProfileList.jsx`, `DashboardSidebar.jsx`
- Co-located CSS: `ProfileList.jsx` + `ProfileList.css` in same directory
- Import alias: `import Button from '@components/common/Button'`

**Functions:**

- camelCase for all functions: `launchProfileInternal()`, `buildRunningMap()`
- Suffix `Internal` for main process functions not exposed via IPC (convention only)
- Suffix `Async` rarely used; async nature inferred from return type

**Constants:**

- UPPER_SNAKE_CASE for module-level constants: `HEARTBEAT_GRACE_MS`, `DEFAULT_SETTINGS`
- Magic strings avoided; constants defined at top of files

## Where to Add New Code

**New Feature (full flow):**

1. Add IPC handler in `src/main/ipc/handlers.js` - register with `handle()` helper
2. Implement handler logic in `src/main/controllers/` or `src/main/services/`
3. Expose IPC method in `src/preload/index.js` under `window.electronAPI`
4. Create React component in `src/renderer/components/` for UI
5. Call `window.electronAPI.yourNewMethod()` from component via hook in `src/shared/hooks/`
6. Add tests (currently no test infrastructure; see TESTING.md)

**New React Component:**

- Location: `src/renderer/components/YourComponent.jsx` (or `src/shared/components/` if reusable)
- Co-locate CSS: `YourComponent.css`
- Import shared utilities from `@hooks`, `@services`, `@utils`, `@components`
- Example pattern: See `src/renderer/components/ProfileCard.jsx` (simple) or `src/renderer/components/ProfileForm.jsx` (complex with state)

**New Main Process Service:**

- Location: `src/main/services/YourService.js`
- Export functions as module; no classes required
- Import dependencies from `src/main/logging/`, `src/main/storage/`, etc.
- Use `appendLog(logId, message)` for logging
- Example: See `src/main/services/ProxyChecker.js` (HTTP-based service)

**New Data Type (Profile-like):**

- Storage: Add CRUD file in `src/main/storage/{type}.js`
- Follow pattern: `read{Type}()`, `write{Type}()`, CRUD functions
- Example: See `src/main/storage/scripts.js` (minimal storage CRUD)
- Data persists to: `data/{type}.json`

**New Automation/Engine Feature:**

- Location: `src/main/engine/{feature}.js`
- Integrate with profile lifecycle: hook into `launchProfileInternal()` flow if needed
- Example: `src/main/engine/behaviorSimulator.js` (can be called during profile launch)

**Utilities:**

- Shared across UI: `src/shared/utils/{utility}.js`
- Main process only: `src/main/{layer}/util.js` or inline in module
- Example: `src/shared/utils/` (currently empty; add helpers here)

## Special Directories

**`data/` (Runtime Data):**
- Purpose: Stores user data, profiles, scripts, logs, settings
- Generated: Yes; created on first app startup
- Committed: No; .gitignored
- Contents: JSON files for profiles, settings, scripts, proxies; per-profile subdirs for storage
- Lifecycle: Persists across app restarts; user can export/backup

**`vendor/` (Vendored Browsers):**
- Purpose: Platform-specific Chrome/Chromium binaries for CDP engine
- Generated: No; must be manually populated for each platform
- Committed: No; excluded from build (optional; only needed for CDP)
- Contents: `chrome-win/`, `chrome-linux/`, `chromium-mac/` with binary executables
- Platform detection: Handled by `src/main/storage/settings.js` (CHROME_PATH or vendor path)

**`dist/` (Build Output):**
- Purpose: Built artifacts after `npm run build`
- Generated: Yes; created by Vite (renderer) and electron-builder (app)
- Committed: No; .gitignored
- Contents: `renderer/` (Vite output), bundled HTML/JS/CSS

**`release/` (Packaged App):**
- Purpose: Final packaged Electron app (.exe, .dmg, .AppImage)
- Generated: Yes; created by electron-builder
- Committed: No; .gitignored
- Contents: Platform-specific installers and portable binaries

---

*Structure analysis: 2026-04-13*
