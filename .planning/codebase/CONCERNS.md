# Codebase Concerns

**Analysis Date:** 2026-04-13

## Security Concerns

### Hardcoded License Secret
- **Issue:** License validation uses a hardcoded secret in source code
- **Files:** `src/main/services/machineId.js:51`
- **Impact:** License key derivation is deterministic and can be reversed; not suitable for real license protection
- **Fix approach:** Use a proper licensing library or move secret to secure environment variable (e.g., electron-store with encryption)

### Plaintext Credential Storage
- **Issue:** Proxy passwords and profile credentials stored unencrypted in JSON files on disk
- **Files:** 
  - `src/main/storage/proxies.js` (proxy passwords written as plain JSON)
  - `src/main/storage/profiles.js:74, 37` (proxy credentials in default settings)
  - `src/renderer/components/ProfileForm.jsx:28` (proxy password field with no encryption hint)
- **Impact:** Local file access compromises all stored credentials (browser login cookies, proxy auth, etc.)
- **Fix approach:** Implement encryption at rest using electron-store with keytar or libsodium; encrypt sensitive fields before JSON serialization

### Unsafe `eval()` Usage in Browser Context
- **Issue:** User-supplied JavaScript expressions executed via `eval()` without sandboxing
- **Files:** 
  - `src/main/engine/actions.js:684, 702`
  - `src/main/controllers/profiles.js:643`
- **Impact:** Malicious automation scripts can access arbitrary Playwright/Puppeteer APIs and modify page content
- **Fix approach:** Use Worker threads or isolated VM context; validate/whitelist expression syntax before eval

### REST API Key Exposure
- **Issue:** API key read from environment variable without validation or rotation support
- **Files:** `src/main/api/restServer.js:6`
- **Impact:** If REST_API_KEY is exposed, attacker gains full API access to launch profiles, access cookies, run scripts
- **Fix approach:** Implement token-based auth with expiration; use bcrypt for key validation; add rate limiting

### Overly Broad CORS Configuration
- **Issue:** REST API allows `cors({ origin: true })` which accepts all origins
- **Files:** `src/main/api/restServer.js:9`
- **Impact:** Any website can make requests to localhost REST API if running
- **Fix approach:** Whitelist specific origins or use credential-based auth + SameSite cookies

## Credential & Sensitive Data Handling

### Browser Profile Storage Risks
- **Issue:** Browser profiles contain sensitive data (cookies, localStorage, authentication tokens) stored in `data/` directory with no access controls
- **Files:** `src/main/storage/paths.js`, `src/main/storage/profiles.js`
- **Impact:** Physical access or compromised process can dump all profile cookies and session data
- **Fix approach:** Implement per-profile directory encryption; use restrictive file permissions (0600); add master password encryption layer

### Missing Timeout on Proxy Rotation Requests
- **Issue:** `axios.get()` calls to proxy rotate URLs have 15s timeout but no overall operation timeout
- **Files:** `src/main/ipc/handlers.js:300, 317`
- **Impact:** Hanging proxy rotation can block the main process
- **Fix approach:** Add overall operation timeout and request cancellation

## Error Handling & Reliability

### Silent Failure Pattern (Empty catch blocks)
- **Issue:** Widespread use of `catch {}` and `catch (e) { }` blocks that silently swallow errors
- **Files:** 
  - `src/main/bootstrap.js:31, 43, 44, 58, 72, 83, 95, 100`
  - `src/main/controllers/profiles.js:149, 150, 158, 198, 411, 418` (40+ occurrences)
- **Impact:** Undetected failures during resource cleanup, orphaned browser processes, memory leaks, difficult debugging
- **Fix approach:** Log all caught errors with context; implement explicit error recovery strategy; use specific error types

### Missing Unhandled Promise Rejection Handler
- **Issue:** No process-level handler for unhandled promise rejections (e.g., `process.on('unhandledRejection')`)
- **Files:** `src/main/bootstrap.js`
- **Impact:** Async errors in background tasks can crash the application silently
- **Fix approach:** Add global unhandled rejection handler that logs and gracefully shuts down

### Inconsistent Error Response Formats
- **Issue:** IPC handlers return varied error structures: some use `{ success, error }`, others just `{ ok, error }`
- **Files:** `src/main/ipc/handlers.js` (mixed patterns throughout)
- **Impact:** Renderer must handle multiple error response formats; error handling inconsistency
- **Fix approach:** Standardize all handlers to return `{ success, error, data }` structure

## Performance & Resource Management

### Large Component Files (Code Complexity)
- **Issue:** Several UI components exceed 1000+ lines, reducing maintainability
- **Files:** 
  - `src/renderer/components/ProfileForm.jsx:1108` lines
  - `src/renderer/components/ScriptsManager.jsx:1037` lines
  - `src/renderer/components/ProxyManager.jsx:536` lines
- **Impact:** Difficult to understand, test, and maintain; higher bug risk
- **Fix approach:** Break into smaller focused components; extract form logic to custom hooks

### Large Backend Controller File
- **Issue:** `src/main/controllers/profiles.js` at 1039 lines handles all profile operations (launch, stop, navigate, click, eval, etc.)
- **Impact:** Mixed concerns; difficult to test individual operations; hard to add new features
- **Fix approach:** Split into separate controller modules: launchController, navigationController, automationController, etc.

### Memory Leak Risk in Fingerprint Generation
- **Issue:** `fingerprintInit.js:929` lines generates fingerprints with potential for uncleaned resources
- **Files:** `src/main/engine/fingerprintInit.js`
- **Impact:** Multiple profile launches may not clean up fingerprint generators
- **Fix approach:** Add explicit cleanup/reset method; use weak references for cached data

### Browser Process Cleanup Not Guaranteed
- **Issue:** Multiple cleanup paths (line 565, 569, 570, 728, 729, 730) with some wrapped in `try {}` that silently fail
- **Files:** `src/main/controllers/profiles.js:565-574, 728-730, 752-764`
- **Impact:** Orphaned browser processes consuming memory/ports after profile stop
- **Fix approach:** Implement mandatory cleanup with timeout forcing kill; track all spawned processes centrally

### Inefficient Profile Lookup Pattern
- **Issue:** `profiles.find()` called repeatedly instead of Map-based lookup
- **Files:** `src/main/controllers/profiles.js:73`, `src/main/api/restServer.js:44-45`
- **Impact:** O(n) lookups for every operation; degrades with many profiles
- **Fix approach:** Maintain profile Map in memory; update on save/delete operations

## Concurrency & Race Conditions

### Multiple Concurrent Profile Launches
- **Issue:** Launching same profile twice can cause race condition despite `launchingProfiles` Set check
- **Files:** `src/main/controllers/profiles.js:60-78` (gap between check at line 61 and Set add at line 67)
- **Impact:** Two launch attempts could both proceed, creating duplicate browser instances
- **Fix approach:** Use atomic check-and-set operation; move `launchingProfiles.add()` before any async operations

### Profile State Synchronization Issues
- **Issue:** Multiple code paths update `runningProfiles` Map and `profiles.json` file without transaction guarantees
- **Files:** `src/main/controllers/profiles.js`, `src/main/state/runtime.js`
- **Impact:** State divergence between in-memory map and persisted file; renderer displays stale data
- **Fix approach:** Implement event-sourcing pattern or use database transactions for profile state updates

### No Lock on Profile File Writes
- **Issue:** `writeProfiles()` uses simple file rename but lacks proper file locking under concurrent access
- **Files:** `src/main/storage/profiles.js:211` (lock exists but commented "best-effort")
- **Impact:** Concurrent saves can corrupt profiles.json or lose updates
- **Fix approach:** Use exclusive file lock library (proper cross-platform locking)

## Architectural Issues

### Missing Input Validation on IPC Handlers
- **Issue:** Many IPC handlers accept user input with minimal validation
- **Files:** `src/main/ipc/handlers.js` (most handlers don't validate params)
- **Example:** `handle('profile-action', async (_e, profileId, actionName, params = {})` - no validation of actionName or params
- **Impact:** Invalid data can crash handlers or cause unexpected behavior
- **Fix approach:** Add zod/joi schemas to validate all IPC input parameters

### Circular Dependencies Risk
- **Issue:** Multiple require() chains that could create circular dependencies
- **Files:** 
  - `src/main/controllers/profiles.js` requires storage, then handlers requires controllers
  - `src/main/bootstrap.js` requires multiple modules in specific order
- **Impact:** Module loading failures or undefined exports in edge cases
- **Fix approach:** Create explicit dependency injection container; audit circular requires

### No Clear Separation of Concerns
- **Issue:** IPC handlers mix business logic, validation, and logging without clear structure
- **Files:** `src/main/ipc/handlers.js:77-366`
- **Impact:** Hard to test; business logic tightly coupled to IPC protocol
- **Fix approach:** Create service layer with pure functions; use dependency injection for handlers

## Frontend/UX Issues

### Missing Form Validation
- **Issue:** ProfileForm component doesn't validate required fields before IPC call
- **Files:** `src/renderer/components/ProfileForm.jsx` (no validation logic shown)
- **Impact:** Invalid profiles saved to disk; IPC handlers fail
- **Fix approach:** Implement client-side form validation; use react-hook-form + zod

### No Loading State Management for Long Operations
- **Issue:** Profile launch can take 10-30 seconds with no user feedback about progress
- **Files:** `src/renderer/components/ProfileList.jsx:253`
- **Impact:** User may click multiple times or close app thinking it's hung
- **Fix approach:** Add loading spinner; show estimated time remaining; allow cancellation

## Test Coverage Gaps

### No Automated Tests
- **Issue:** No test files found; `test` script in package.json returns error
- **Files:** `package.json:15` ("test": "echo \"Error: no test specified\" && exit 1")
- **Impact:** No safety net for refactoring; regressions undetected until production
- **Fix approach:** Implement vitest setup with test for: IPC handlers, profile operations, storage layer, API endpoints

### No Integration Tests
- **Issue:** No tests for end-to-end flows (launch profile → navigate → get screenshot → cleanup)
- **Impact:** Integration issues (e.g., cleanup not called) only found during manual testing
- **Fix approach:** Add integration test suite using vitest + electron-context-bridge mocks

## Database/Storage Concerns

### No Schema Versioning
- **Issue:** `profiles.json`, `proxies.json`, `scripts.json` have no version field
- **Files:** `src/main/storage/profiles.js`, `src/main/storage/proxies.js`
- **Impact:** Cannot migrate data structure on app updates
- **Fix approach:** Add `_version: 1` field to each JSON file; implement migration functions

### No Backup on Write Failure
- **Issue:** If `.tmp` file write succeeds but `.rename()` fails, `.tmp` is orphaned
- **Files:** `src/main/storage/profiles.js:64-66`
- **Impact:** Partial data loss if disk fills during save
- **Fix approach:** Implement write-ahead logging; keep previous backup on successful write

## Electron-Specific Security

### contextIsolation Properly Enabled
- **Status:** ✓ Good - `contextIsolation: true` in `src/main/window/mainWindow.js:17`
- **Note:** Preload bridge is correctly implemented via contextBridge

### nodeIntegration Properly Disabled
- **Status:** ✓ Good - `nodeIntegration: false` in `src/main/window/mainWindow.js:16`

### Preload Script Safely Exposes IPC
- **Status:** ✓ Good - Preload at `src/preload/index.js` wraps ipcRenderer correctly
- **Note:** All IPC channels explicitly listed; no blanket ipcRenderer exposure

### DevTools in Production
- **Issue:** DevTools line is commented but could be enabled in future builds
- **Files:** `src/main/window/mainWindow.js:27` (// mainWindow.webContents.openDevTools())
- **Impact:** If uncommented, exposes app internals in production
- **Fix approach:** Use environment check: `if (!app.isPackaged) mainWindow.webContents.openDevTools()`

## Incomplete Features

### Missing ProfileService & BrowserService Implementations
- **Issue:** TODO comments indicate stub files exist
- **Files:** 
  - `src/preload/preload.js:2` - "TODO: Implement IPC bridge"
  - `src/main/services/BrowserService.js:2` - "TODO: Launch/stop browser instances"
  - `src/main/services/ProfileService.js:2` - "TODO: CRUD operations"
  - `src/main/services/AutomationService.js:2` - "TODO: Execute automation steps"
- **Impact:** Functionality may be incomplete or duplicated across controllers
- **Fix approach:** Complete service implementations or remove stubs

## Dependency Concerns

### Playwright Fork (rebrowser-playwright)
- **Issue:** Using `npm:rebrowser-playwright@^1.52.0` instead of official Playwright
- **Files:** `package.json:161`
- **Impact:** Security updates may lag behind official version; compatibility issues with plugins
- **Fix approach:** Verify rebrowser fork is actively maintained; pin to specific version; monitor for security updates

### Missing Dependency Validation
- **Issue:** No dependabot or automated vulnerability scanning configured
- **Files:** No `.github/dependabot.yml` or similar
- **Impact:** Vulnerable dependencies not detected until manual audit
- **Fix approach:** Add GitHub Dependabot or npm audit CI checks

## Scalability Concerns

### In-Memory Profile State Not Persisted Across Crashes
- **Issue:** `runningProfiles` Map is only in-memory; app crash loses running profile references
- **Files:** `src/main/state/runtime.js`
- **Impact:** Orphaned browser processes if app crashes; user can't recover running profiles
- **Fix approach:** Persist running profiles state to disk; restore on startup

### Single-Process Architecture Bottleneck
- **Issue:** All browser profile management on single main process; no worker pool
- **Files:** `src/main/bootstrap.js`, `src/main/controllers/profiles.js`
- **Impact:** Heavy operations (fingerprint generation, proxy checks) block other profiles
- **Fix approach:** Use Electron's spawn capability to distribute profile launches across processes

---

*Concerns audit: 2026-04-13*
