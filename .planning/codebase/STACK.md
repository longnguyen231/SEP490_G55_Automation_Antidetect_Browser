# Technology Stack

**Analysis Date:** 2026-04-13

## Languages

**Primary:**
- JavaScript (Node.js) - Main process, backend services, automation engine
- TypeScript - Configuration files, some type hints (dev dependency)
- JSX/React - Frontend UI components and renderer process

**Secondary:**
- CSS/SCSS - Styling with Tailwind CSS and Bootstrap
- HTML - DOM structure

## Runtime

**Environment:**
- Node.js (v20+) - Required by Electron and npm packages
- Electron 33.0.0 - Desktop application framework
- Chromium/Chrome (bundled) - Embedded browser engine via vendor/ directory

**Package Manager:**
- npm - Lockfile: `package-lock.json` present in root and `src/web-admin/`
- Version lock via `package-lock.json`

## Frameworks

**Core:**
- Electron 33.0.0 - Desktop app shell with IPC communication
- React 18.3.1 - Renderer UI components
- Vite 5.4.0 - Build tool and dev server
- Express 5.2.1 - REST API server

**Build/Dev:**
- Electron Builder 26.0.0 - Packaging and code signing
- Electronmon 2.0.4 - Hot-reload for development
- Vite 5.4.0 - SPA bundler and dev server
- TypeScript 5.6.0 - Type checking (dev only)
- PostCSS 8.4.49 - CSS processing
- Tailwind CSS 3.4.0 - Utility-first CSS framework

**Testing:**
- Vitest 2.1.9 - Unit test runner (configured but no tests written)

**Styling:**
- Bootstrap 5.3.8 - Component library
- React Bootstrap 2.10.10 - React wrapper for Bootstrap
- Lucide React 1.6.0 - Icon library
- Tailwind CSS 3.4.0 - Utility CSS

## Key Dependencies

**Critical:**
- `rebrowser-playwright 1.52.0` (aliased as `playwright`) - Browser automation with stealth plugin, rebrowser fork supports fingerprint injection and antidetect
- `playwright-extra 4.3.6` - Stealth plugin wrapper
- `puppeteer-extra-plugin-stealth 2.11.2` - Stealth headless detection bypass
- `fingerprint-generator 2.1.55` - Browser fingerprint generation
- `fingerprint-injector 2.1.55` - Injects fingerprints into Playwright contexts
- `better-sqlite3 12.0.0` - Embedded SQLite database for profile/settings storage

**Infrastructure:**
- `@fastify/cors 11.2.0` - CORS support for APIs
- `@fastify/swagger 9.7.0` - OpenAPI/Swagger documentation
- `@fastify/swagger-ui 5.2.5` - Swagger UI frontend
- `swagger-ui-express 5.0.1` - REST API documentation UI
- `cors 2.8.6` - CORS middleware for Express
- `fastify 5.8.2` - High-performance web framework (alternative to Express)
- `commander 12.1.0` - CLI argument parsing
- `node-cron 4.2.1` - Scheduled task execution (automation scheduling)
- `electron-store 8.2.0` - Persistent application settings storage
- `pino 10.0.0` - Structured logging
- `pino-pretty 13.1.3` - Pretty printer for Pino logs

**State & Data:**
- `zustand 5.0.0` - Lightweight state management (frontend)
- `zod 3.24.0` - Schema validation
- `drizzle-orm 0.45.0` - Lightweight ORM (dev dependency: drizzle-kit)

**Security & Identity:**
- `tweetnacl 1.0.3` - Elliptic curve cryptography (NaCl bindings)
- `tweetnacl-util 0.15.1` - Utility functions for TweetNaCl

**Utilities:**
- `@monaco-editor/react 4.7.0` - Code editor component for script editing
- `monaco-editor 0.55.1` - Code editor library
- `xlsx 0.18.5` - Excel file reading/writing for profile import/export
- `@electron-toolkit/preload 3.0.1` - Safe IPC bridge utilities
- `@electron-toolkit/utils 3.0.0` - Electron development utilities
- `@electron-toolkit/tsconfig 2.0.0` - TypeScript config for Electron

**Error Tracking & Monitoring:**
- `@sentry/electron 7.10.0` - Error tracking (dependency present but usage not detected in explored code)

**Web Admin Dashboard (src/web-admin/):**
- React 19.2.0 - UI framework
- Ant Design 6.3.2 - Enterprise UI components
- React Query (@tanstack/react-query 5.90.21) - Server state management
- React Table (@tanstack/react-table 8.21.3) - Headless table component
- Axios 1.13.5 - HTTP client
- Firebase 12.11.0 - Backend services (auth, database)
- React Router DOM 7.13.1 - Client-side routing
- React Hook Form 7.71.2 - Form state management
- Hot Toast 2.6.0 - Toast notifications
- React Country Flag 3.1.0 - Country flag components
- Zustand 5.0.11 - State management
- Yup 1.7.1 - Form validation

## Configuration

**Environment:**
- Node environment: `NODE_ENV` - controls dev vs production builds
- REST API: Configured via `settings.json` (enabled/disabled, host, port, API key)
- Chrome binary path: `CHROME_PATH` environment variable or auto-detection from vendor/
- Database path: `data/` directory (profiles.json, proxies.json, settings.json)

**Build:**
- `vite.config.js` - Vite configuration with React plugin, path aliases (@shared, @components, @hooks, @services, @utils, @styles)
- `electron-builder` configuration in `package.json` - Builds for Windows (NSIS), macOS, Linux (AppImage)
- `tailwind.config.js` - Tailwind CSS customization
- `postcss.config.js` - PostCSS plugins

**Code Quality:**
- `@biomejs/biome 1.9.0` - Fast linter/formatter
- Code obfuscation: `javascript-obfuscator 5.3.0` via rollup-plugin in production builds
- Icon generation: `png-to-ico 2.1.8` for Windows icon creation

## Platform Requirements

**Development:**
- Node.js 20+
- npm 8+
- Windows/macOS/Linux (Electron supports all three)
- Git for version control
- Optional: Visual Studio Build Tools (for native module compilation on Windows)

**Production:**
- Windows 10+ (native NSIS installer)
- macOS 10.13+ (native DMG or Homebrew)
- Linux (AppImage)
- Bundled Chromium (no external browser installation required)

---

*Stack analysis: 2026-04-13*
