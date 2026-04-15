# Superpowers Agent Configuration

This project uses the Superpowers skill framework to ensure high-quality, systematic development of the OBT Automation Antidetect Browser.

## Skills Location

All agent skills are located in the `.skills` directory.

## Core Principles

1. **Always invoke relevant skills** - If there's even 1% chance a skill applies, USE IT
2. **Evidence before claims** - Never claim work is complete without verification
3. **Plan before execute** - Complex features require brainstorming and written plans
4. **Test-Driven Development** - Write tests before implementation for critical logic
5. **Systematic debugging** - Follow root cause analysis, never guess-and-check
6. **Maximize library usage** - Always leverage existing libraries from package.json instead of writing from scratch

## When to Use Each Skill

### Workflow & Planning Skills

- **using-superpowers**: Use at the start of EVERY conversation to establish skill usage patterns
- **brainstorming**: Use when requirements are unclear or feature is complex (>3 files or >100 LOC)
- **writing-plans**: Use after brainstorming to create detailed, reviewable implementation plans
- **executing-plans**: Use to implement a written plan with review checkpoints
- **verification-before-completion**: Use BEFORE claiming any work is complete or fixed

### Development Skills

- **test-driven-development**: Use for critical business logic, algorithms, or complex features
- **subagent-driven-development**: Use for tasks requiring research across large codebases
- **systematic-debugging**: Use when debugging production issues or complex bugs

### Git & Code Review Skills

- **using-git-worktrees**: Use for working on multiple branches/features simultaneously
- **requesting-code-review**: Use before creating PRs to self-review changes
- **receiving-code-review**: Use when addressing code review feedback
- **finishing-a-development-branch**: Use for final verification before merging

### Advanced Skills

- **dispatching-parallel-agents**: Use for independent tasks that can run simultaneously
- **writing-skills**: Use when creating new domain-specific skills

## Project Structure

This is an **Electron + React** desktop application for managing browser profiles with advanced antidetect capabilities.

### Architecture Overview

```
src/
├── main/           # Electron Main Process (Node.js backend)
│   ├── bootstrap.js         # Entry point
│   ├── engine/             # Core automation & fingerprinting engine
│   ├── services/           # Browser/Profile/Proxy management
│   ├── storage/            # JSON-based data persistence
│   ├── api/                # REST API server (Fastify)
│   ├── controllers/        # Business logic controllers
│   └── ipc/                # IPC handler registration
│
├── renderer/       # React Frontend (Vite)
│   ├── components/         # React components
│   ├── hooks/             # Custom React hooks
│   └── pages/             # Page components
│
├── preload/        # Electron Preload Scripts
│   └── preload.js         # IPC bridge
│
└── shared/         # Shared utilities
    ├── components/        # Reusable React components
    ├── hooks/            # Shared hooks
    └── utils/            # Helper functions
```

### Main Process (Backend)

**Key Directories:**
- `engine/`: Core automation engine
  - `automation.js` - Cron scheduler for auto-launching profiles
  - `fingerprintGenerator.js` - Generate realistic browser fingerprints
  - `fingerprintInit.js` - Inject fingerprint overrides into browser
  - `cdp.js` / `cdpOverrides.js` - Chrome DevTools Protocol integration
  - `actions.js` - Automation actions (click, type, navigate, screenshot, etc.)
  - `proxyForwarder.js` / `proxyChecker.js` - Proxy management

- `services/`: Business logic services
  - `browserManagerService.js` - Launch/stop browser instances
  - `ProfileService.js` - CRUD operations for profiles
  - `ProxyChecker.js` - Verify proxy connectivity

- `storage/`: JSON-based data persistence
  - `profiles.js` - Profile data management
  - `settings.js` - App settings
  - `proxies.js` - Proxy list
  - `scripts.js` - Automation scripts

- `api/restServer.js`: Fastify-based REST API (port 4000)

### Renderer Process (Frontend)

**Key Components:**
- `ProfileList.jsx` - Display all profiles
- `ProfileForm.jsx` - Create/edit profile
- `CookieManager.jsx` - Manage cookies
- `ProxyManager.jsx` - Manage proxy list
- `ScriptsManager.jsx` - Automation script editor
- `LogViewer.jsx` - View profile logs
- `LivePreviewPanel.jsx` - Live browser preview

## Development Guidelines

### General Principles

1. **Maximize Library Usage**: Always use existing dependencies from package.json instead of reinventing:
   - Use `playwright` (rebrowser-playwright) for browser automation
   - Use `fingerprint-generator`/`fingerprint-injector` for antidetect capabilities
   - Use `node-cron` for scheduling
   - Use `fastify` for REST API
   - Use `better-sqlite3` + `drizzle-orm` for database operations
   - Use `zod` for validation
   - Use `zustand` for React state management
   - Use `@monaco-editor/react` for code editing

2. **Code Quality**:
   - Always run tests before claiming completion
   - Follow TDD for business-critical features
   - Document complex logic and architectural decisions
   - Use descriptive variable names
   - Keep functions focused and single-purpose

3. **Error Handling**:
   - Always use try-catch blocks for async operations
   - Log errors with `appendLog()` (main process) or console (renderer)
   - Provide user-friendly error messages in UI

### Main Process (Electron Backend)

**Technology Stack:**
- Node.js (CommonJS imports: `require()`)
- Electron main process APIs
- Fastify (REST API)
- Playwright (browser automation)
- better-sqlite3 + drizzle-orm (database)

**Guidelines:**
- Use `appendLog(profileId, message)` for logging
- All async operations must have error handling
- Use IPC for communication with renderer
- Store data in `data/` directory (git-ignored)
- Use `fingerprint-generator` for generating fingerprints
- Use `fingerprint-injector` for applying fingerprints via CDP/Playwright

**Browser Engine Support:**
- **Playwright** (default): Use `rebrowser-playwright` package
- **CDP**: Launch real Chrome/Edge with DevTools Protocol
- **Camoufox**: Privacy-focused Firefox fork
- **Playwright-Firefox**: Firefox automation via BiDi protocol

**Fingerprinting:**
- Always use `fingerprintGenerator.js` - never hardcode fingerprints
- Apply fingerprints via `fingerprintInit.js` (Playwright) or `cdpOverrides.js` (CDP)
- Support OS spoofing: Windows, macOS, Linux
- Support browser spoofing: Chrome, Firefox, Edge
- WebGL/Canvas/AudioContext noise injection

**Proxy Management:**
- Support HTTP, HTTPS, SOCKS4, SOCKS5
- Always check proxy health before launch
- Use cached status (10min TTL) to avoid repeated checks
- Auto-forward authenticated proxies via local SOCKS5

### Renderer Process (React Frontend)

**Technology Stack:**
- React 18 (functional components + hooks)
- Vite (build tool)
- React Bootstrap (UI components)
- Lucide React (icons)
- Zustand (state management)
- Monaco Editor (code editor)

**Guidelines:**
- Use functional components with hooks
- Use `useState`, `useEffect`, `useMemo`, `useCallback` appropriately
- Leverage custom hooks in `src/shared/hooks/`:
  - `useProfiles()` - Profile CRUD
  - `useSettings()` - Settings management
  - `useAutomation()` - Automation actions
  - `useToast()` - Toast notifications

- **IPC Communication**:
  ```javascript
  // Renderer → Main (invoke)
  const result = await window.electronAPI.launchProfile(profileId);
  
  // Main → Renderer (listen)
  window.electronAPI.onRunningMapChanged((data) => { ... });
  ```

- **State Management**:
  - Use React state for local component state
  - Use Zustand for global state when needed
  - Use context sparingly

- **Styling**:
  - Use CSS modules or inline styles
  - Bootstrap classes for layout/typography
  - Custom CSS for specific components

- **Icons**: Use `lucide-react` icons consistently

### REST API (Optional Remote Control)

- Built with Fastify + Swagger UI
- Runs on port 4000 (configurable)
- Endpoints mirror IPC handlers
- Use for web-based remote control or external automation

### Data Persistence

**Location**: `data/` directory (git-ignored)

**Files**:
- `profiles.json` - Profile definitions
- `settings.json` - App configuration
- `proxies.json` - Proxy list
- `scripts.json` - Automation scripts
- `logs/` - Per-profile log files
- `profiles/` - Storage state JSONs (cookies, localStorage)
- `cdp-user-data/` - CDP engine user data directories

**Guidelines**:
- Always validate input before writing JSON
- Use atomic writes (write to temp file → rename)
- Backup data before destructive operations
- Clean up orphaned data on profile deletion

### Testing

- Use vitest for unit tests
- Test critical logic: fingerprint generation, proxy handling, automation steps
- Mock Electron APIs in tests
- Test both main and renderer processes

### Security

- Never log sensitive data (passwords, auth tokens)
- Sanitize user input before executing automation scripts
- Use obfuscation for production builds (`scripts/afterPack-obfuscate.js`)
- Validate all IPC messages

### Performance

- Lazy load components where possible
- Debounce frequent operations (search, filter)
- Use React.memo for expensive renders
- Clean up event listeners in useEffect cleanup
- Close browser contexts when not in use

### Debugging

**Main Process**:
- Use `appendLog()` for debugging
- Check logs in `data/logs/<profileId>.log`
- Use Chrome DevTools for main process debugging

**Renderer Process**:
- Open DevTools in Electron window (Ctrl+Shift+I)
- Use React DevTools extension
- Console.log debugging

**Common Issues**:
- Profile won't launch → Check Chrome path in settings
- Fingerprint not applied → Verify `applyOverrides` settings
- Proxy connection failed → Check proxy health (TCP test)
- IPC not working → Ensure preload script is loaded
