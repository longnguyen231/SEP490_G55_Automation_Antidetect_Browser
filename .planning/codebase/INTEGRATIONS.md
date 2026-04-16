# External Integrations

**Analysis Date:** 2026-04-13

## APIs & External Services

**IP Geolocation (for proxy detection):**
- `ip-api.com` - IP detection and geolocation
  - Endpoint: `http://ip-api.com/json/?fields=query,country,countryCode,city,timezone,status`
  - Usage: Proxy checker validates proxy IP and retrieves location info
  - Location: `src/main/services/ProxyChecker.js` (lines 17-26)
  - No API key required

- `ipinfo.io` - Alternative IP geolocation API
  - Endpoint: `https://ipinfo.io/json`
  - Usage: Fallback when ip-api.com fails
  - Location: `src/main/services/ProxyChecker.js` (lines 19)

- `ipwhois.app` - Third IP geolocation service
  - Endpoint: `https://ipwhois.app/json/`
  - Usage: Second fallback for proxy validation
  - Location: `src/main/services/ProxyChecker.js` (line 20)

**Proxy Validation:**
- Service: Custom HTTP/HTTPS proxy test via direct socket connection
  - Tests connectivity by sending requests through configured proxy
  - Supports basic auth (username/password encoded in Proxy-Authorization header)
  - Location: `src/main/services/ProxyChecker.js` (lines 56-107)

- Service: SOCKS proxy support via proxy-chain
  - Uses `proxy-chain` library (referenced but version not in dependencies)
  - Implements local forwarder for SOCKS5/4 protocols
  - Location: `src/main/services/ProxyChecker.js` (lines 88-107)

## Data Storage

**Databases:**
- SQLite (via `better-sqlite3 12.0.0`)
  - File-based storage, no server required
  - ORM: `drizzle-orm 0.45.0` for type-safe queries
  - Current state: Dependency present but code uses JSON file storage instead

**File Storage:**
- Local filesystem only - No cloud storage integration
- Data directory: `data/` (created at startup via `initializeDataFiles()`)
- Profile data: `profiles.json` - Contains profile configs, fingerprints, settings
- Proxies: `proxies.json` - Proxy list and validation results
- Settings: `settings.json` - Application configuration (REST API, theme, etc.)
- Scripts: `scripts.json` - User automation scripts
- Task logs: `taskLogs.json` - Execution logs for scheduled tasks
- Storage state: `storage-state/{profileId}.json` - Playwright session cookies/state
- Location: `src/main/storage/` directory

**Caching:**
- None - No external cache service (Redis, Memcached)
- In-memory: JavaScript Map for running profiles (`src/main/state/runtime.js`)

## Authentication & Identity

**Auth Provider:**
- None - Self-contained, no external auth
- Local machine identification via `machineId` service
  - Generates machine code from hardware identifiers
  - Optional license key validation
  - Location: `src/main/services/machineId.js` (IPC handlers at `src/main/ipc/handlers.js` lines 51-52)

**License System:**
- Functions: `getMachineCode()`, `validateLicenseKey(key)`
- Storage: Machine code embedded in app, license key stored locally
- Implementation: `src/main/services/machineId.js`

## Monitoring & Observability

**Error Tracking:**
- Sentry (`@sentry/electron 7.10.0`) - Dependency installed but NOT integrated in explored code
- No active error reporting to external service detected

**Logs:**
- Approach: Local file-based logging to `data/logs/{profileId}.log`
- Format: `[ISO-8601 timestamp] message`
- Framework: Custom implementation (`src/main/logging/logger.js`)
- Broadcasting: Logs also sent to renderer via IPC `app-log` channel for real-time UI display
- Levels: INF, WRN, ERR (inferred from message content)
- Location: `src/main/logging/logger.js`

**Health Checks:**
- Internal WebSocket/CDP health check via `isWsAlive()` function
- Heartbeat mechanism every 30 seconds for running profiles
- Location: `src/main/bootstrap.js` (lines 18-63)

## CI/CD & Deployment

**Hosting:**
- Electron desktop application - Packaged as native installers
- Distribution: Local filesystem (release/ directory after build)
- Build artifacts:
  - Windows: `.exe` NSIS installer (signed)
  - macOS: DMG or `.app` bundle
  - Linux: AppImage

**CI Pipeline:**
- None detected - No GitHub Actions, GitLab CI, or other CI service integration
- Manual build via `npm run build` which runs:
  1. Icon generation (`scripts/make-icons.js`)
  2. Vite build (`vite build`)
  3. Electron Builder packaging

**Code Obfuscation:**
- Production builds obfuscate code via `javascript-obfuscator` (Rollup plugin)
- Post-pack hook: `scripts/afterPack-obfuscate.js` applies additional obfuscation
- Settings: String array encoding (RC4), identifier renaming, control flow

## Environment Configuration

**Required env vars:**
- `NODE_ENV` - development/production (influences build output)
- `CHROME_PATH` - Optional override for Chrome executable location
- `EDGE_PATH` - Optional override for Edge browser executable
- `REST_API_KEY` - Optional API key for REST endpoint authentication

**Secrets location:**
- `.env` file present (not read for security) - Contains environment secrets
- Settings file: `data/settings.json` - Stores REST API configuration and user preferences
- No .env.example or public secrets configuration found

**Lockfile Management:**
- Root: `package-lock.json` (npm dependencies)
- Web Admin: `src/web-admin/package-lock.json` (separate web dashboard)

## Webhooks & Callbacks

**Incoming:**
- None detected - No webhook endpoints for external services

**Outgoing:**
- None detected - No outbound webhook calls to external services

**IPC (Electron Inter-Process Communication):**
- Main↔Renderer channels (not external):
  - `running-map-changed` - Profile status updates
  - `api-server-status` - REST API server state
  - `app-log` - Real-time log messages
  - `backend-ready` - Backend initialization complete
  - `profiles-updated` - Profile list changed

## REST API Server

**Configuration:**
- Default host: `127.0.0.1` (localhost only)
- Default port: `4000`
- CORS: Enabled (configurable, defaults to true)
- API Key: Optional header `X-API-Key` (checked if configured)
- Swagger UI: Available at `/docs`
- OpenAPI spec: `src/main/api/openapi.json`

**Key Endpoints:**
- Profile CRUD: `/api/profiles`, `/api/profiles/:id`
- Launch/Stop: `/api/profiles/:id/launch`, `/api/profiles/:id/stop`
- Browser Control: `/api/profiles/:id/navigate`, `/api/profiles/:id/actions/*`
- Cookies: `/api/profiles/:id/cookies`
- Scripts: `/api/scripts`, `/api/profiles/:id/scripts/:sid/execute`
- Proxy Check: `/api/proxy/check`
- Fingerprint: `/api/fingerprint/generate`, `/api/fingerprint/generate-batch`
- Behavior: `/api/profiles/:id/behavior/simulate`
- Detection: `/api/profiles/:id/blocked` (blocked page detection)

**Framework:**
- Express 5.2.1
- Server startup: `src/main/api/restServer.js` (lines 650-712)
- Routes: `src/main/api/restServer.js` (lines 30-629)

## Third-Party Browser Integration

**Browser Engines:**
- Playwright (rebrowser fork) - Primary automation engine
  - CDP protocol support for Chrome/Chromium
  - Pipe mode for isolated browser contexts
  - Stealth mode via `playwright-extra` and `puppeteer-extra-plugin-stealth`

**Fingerprint Libraries:**
- `fingerprint-generator 2.1.55` - Generates realistic browser fingerprints
  - Creates user agents, WebGL data, canvas fingerprints
  - Location: `src/main/engine/fingerprintGenerator.js`
  - Includes fallback hardcoded values if generator fails

- `fingerprint-injector 2.1.55` - Injects fingerprints into browser contexts
  - Overrides navigator properties, WebGL APIs, canvas behavior
  - Location: `src/main/engine/fingerprintInit.js`

**Antidetection Features:**
- Browser fingerprinting override system
- WebRTC leak prevention (IP masking)
- Canvas and WebGL randomization
- User agent synchronization with actual Chrome binary version
- Headless mode hiding
- Hardware spec spoofing (CPU cores, memory)
- Geolocation spoofing
- Media device enumeration control

## Data Import/Export

**Import:**
- Proxy lists: `/api/profiles/:id/cookies` POST (import cookies)
- Excel support: `xlsx 0.18.5` (for profile/proxy import)
- Location: IPC handlers in `src/main/ipc/handlers.js`

**Export:**
- Cookies: Export via storage state snapshot
- Proxy lists: Export functionality in handlers
- Locations: `src/main/storage/proxies.js` and `src/main/controllers/profiles.js`

## Browser Fingerprint Data

**Generated Fingerprints Include:**
- User Agent string (synced to actual Chrome version)
- Operating System (Windows/macOS/Linux)
- Screen resolution
- Language/Timezone
- WebGL vendor/renderer
- Canvas data hash
- Audio context fingerprint
- Hardware specs (CPU cores, RAM)
- Geolocation coordinates
- Media device list (audio/video input/output)

**Realistic Data Sources:**
- Real-world Chrome version distribution (v136-v146)
- WebGL vendor data from actual GPU models (NVIDIA, AMD)
- Timezone database integration
- Operating system version data

---

*Integration audit: 2026-04-13*
