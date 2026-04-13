# Coding Conventions

**Analysis Date:** 2026-04-13

## Naming Patterns

**Files:**
- PascalCase for React components: `ProfileCard.jsx`, `DashboardSidebar.jsx`, `Button.jsx`
- camelCase for utility/service files: `client.js`, `proxyChecker.js`, `restServer.js`, `logger.js`
- kebab-case for config files: `app.config.js`, `.eslintrc` patterns
- Barrel files use `index.js` for module exports: `src/shared/components/common/index.js`, `src/shared/services/api/index.js`

**Functions:**
- camelCase for all function names, both sync and async: `getChromeVersion()`, `launchProfileInternal()`, `broadcastRunningMap()`, `appendLog()`
- Helper functions prefixed with underscore for caching: `_chromeVersionCache` in `src/main/controllers/profiles.js`
- Short error handler functions: `ok()` and `err()` in `src/main/engine/actions.js`
- Async functions explicitly named with intent: `withPage()`, `launchProfileInternal()`, `fetchJsonVersion()`

**Variables:**
- camelCase for local variables and constants: `runningProfiles`, `launchingProfiles`, `profileId`, `wsEndpoint`
- UPPERCASE_SNAKE_CASE for module-level constants: `HEARTBEAT_GRACE_MS = 20000` in `src/main/bootstrap.js`
- Plural names for collections: `runningProfiles` (Map), `profiles` (Array), `handlers` (Object)
- Descriptive names for state: `engineInstallState`, `profileStatuses`, `selectedIds`, `headlessPrefs`

**Types/Classes:**
- PascalCase for classes: `ApiClient` in `src/shared/services/api/client.js`, `IpcBridge`, `IpcApiClient`
- Custom error classes use suffix: `ApiError` in error handling
- React component exports both named and default: `export function Button({ ... }) { ... }; export default Button;`

## Code Style

**Formatting:**
- No linter/formatter detected in root config (no .eslintrc, .prettierrc, or biome.json)
- File formatting is manual/inconsistent - varies by developer
- Indentation: 2 spaces (observed in all `.js`, `.jsx` files)
- Line length: Generally flexible, no strict enforcement observed

**Linting:**
- Vite + React plugin configured in `vite.config.js` (no formal lint rules)
- Package includes `@biomejs/biome` as devDependency but no config file or use found
- No TypeScript compiler config (no `tsconfig.json`)

**Code blocks:**
- Single-line conditions with early returns: `if (!page && createIfMissing) page = await context.newPage();`
- Try-catch with swallowed errors for robustness (common in Electron): `try { await info?.forwarder?.stop?.(); } catch {}`
- Inline ternary for simple conditionals: `[condition && className]`
- Array.filter(Boolean) for cleaning class lists: `[...].filter(Boolean).join(' ')`

## Import Organization

**Order:**
1. Third-party/built-in imports: `const fs = require('fs');`, `import React from 'react';`
2. Internal modules from absolute paths: `const { appendLog } = require('../logging/logger');`
3. Relative path imports: `require('./window/mainWindow')`
4. Path aliases (Vite configured): `@shared`, `@components`, `@hooks`, `@services`, `@utils`, `@styles` in `vite.config.js`

**Path Aliases (Vite):**
- `@shared` → `src/shared`
- `@components` → `src/shared/components`
- `@hooks` → `src/shared/hooks`
- `@services` → `src/shared/services`
- `@utils` → `src/shared/utils`
- `@styles` → `src/shared/styles`

**Module systems:**
- Main process: CommonJS with `require()`/`module.exports`
- Renderer/Shared: ES modules with `import`/`export`
- Mix of both in same codebase depending on context

## Error Handling

**Patterns:**
- Structured result objects: `{ success: true|false, error?: string, ...data }`
- Example from `src/main/engine/actions.js`:
  ```javascript
  function ok(v = {}) { return { success: true, ...v }; }
  function err(message, extra = {}) { return { success: false, error: String(message || 'unknown error'), ...extra }; }
  ```
- Try-catch with swallowed errors for graceful degradation:
  ```javascript
  try { info?.forwarder?.stop?.(); } catch {}
  try { w.webContents.send('app-log', payload); } catch {}
  ```
- Error logging via `appendLog()` to file and broadcast to UI
- HTTP responses use status codes: 200/404/500 via `res.status().json()`

**Async error handling:**
- Explicit `try/catch` blocks around async operations
- Error messages wrapped in String() to handle non-string errors
- Optional chaining for safe property access: `info.context?.isClosed?.()`
- No global error handlers - errors handled at call site

## Logging

**Framework:** Console logs + file system + IPC broadcast

**Patterns:**
- `appendLog(profileId, message)` in `src/main/logging/logger.js` for all logging
- Logs written to `logPath(profileId)` files with ISO timestamp: `[2026-04-13T...] message`
- Automatic level detection: searches for 'error|fail|exception' for ERR, 'warn' for WRN, defaults to INF
- Broadcast to renderer via `w.webContents.send('app-log', payload)` for real-time UI display
- Silent failures in broadcast/logging: `try/catch {}` prevents logging failures from crashing

**Usage:**
- `appendLog(profileId, 'Action: mouseClick to (100, 50)')`
- `appendLog(id, 'Heartbeat: Playwright browser disconnected')`
- `appendLog('system', 'REST start error: ...')`

## Comments

**When to Comment:**
- File headers with brief purpose: `// Entry shim: all logic lives in bootstrap.js`
- Complex algorithm explanation: Multi-line comments explaining layout detection, CDP connection, engine differences
- Critical decisions with tradeoffs: `// Playwright pipe mode has no WS endpoint — use context/browser state instead`
- Warning about side effects: `// Critical: Prevent memory leak by closing the temporary WebSocket`

**JSDoc/TSDoc:**
- Minimal JSDoc use observed, but when present follows standard format:
  ```javascript
  /**
   * Retrieves the active Playwright Page object for a running profile.
   * @param {string} profileId
   * @param {Object} options
   * @returns {Promise<Object>} { success, page, cleanup, error? }
   */
  ```
- React component prop documentation via JSDoc blocks: `@param {Object} props`, `@param {React.ReactNode} props.children`

## Function Design

**Size:** Functions vary 5-100+ lines; longer functions are acceptable for complex async orchestration

**Parameters:**
- Destructured options objects: `{ index = 0, createIfMissing = true } = {}`
- Default values in destructuring: `profileId, { button = 'left', clickCount = 1, delay = 0 } = {}`
- Validation of parameters inline: `if (!Number.isFinite(x)) return err(...)`

**Return Values:**
- Consistency: All major functions return structured objects `{ success, error?, ...data }`
- Early returns for error cases: `if (!running) return err(...)`
- Chained cleanup: Action functions return via `cleanup()` after completion

## Module Design

**Exports:**
- CommonJS: `module.exports = { functionA, functionB, ... }`
- ES modules: `export function name() { ... }; export default Name;`
- Named and default exports mixed: `export default Button;` alongside named exports

**Barrel Files:**
- Pattern: `index.js` re-exports from sibling modules
- Example `src/shared/components/common/index.js`: bundles Button, Card, Toast exports
- Example `src/shared/services/api/index.js`: bundles ApiClient, profile, automation services

**Module organization:**
- Feature-based grouping: `/main/controllers`, `/main/engine`, `/main/storage`, `/main/ipc`
- Shared layer for cross-codebase reuse: `/shared/components`, `/shared/services`, `/shared/hooks`, `/shared/utils`
- Clear separation: main process, renderer, and shared code in distinct directories

---

*Convention analysis: 2026-04-13*
