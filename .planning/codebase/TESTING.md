# Testing Patterns

**Analysis Date:** 2026-04-13

## Current State: No Test Infrastructure

**Status:** This Electron application currently has **no test suite** in the source code.

- No test files found in `/src` directories
- No test configuration (`jest.config.js`, `vitest.config.js`) present
- No test script in `package.json` - runs `echo "Error: no test specified" && exit 1`
- Manual testing via `test_checker.js` file (standalone proxy checker utility, not a test suite)

**Why tests are difficult here:**
- Electron app with IPC bridge between main/renderer processes
- Browser automation via Playwright and CDP (Chrome Debug Protocol)
- File I/O heavy (profile storage, logging)
- Asynchronous orchestration of browser processes
- Real external service dependencies (REST API, WebSocket endpoints)

## Recommended Test Infrastructure for This Electron App

### Test Framework

**Use Vitest + Electron Testing Library**

Why:
- Already in `package.json` as devDependency: `"vitest": "^2.1.9"`
- Fast, ESM-native, works with Vite configuration
- Better than Jest for Electron apps (native ESM support, no transform config needed)
- Can test renderer (React) and main process (Node) with shared config

**Installation already present:**
- Vitest is installed
- Need to add: `@vitest/ui`, `@testing-library/react`, `@testing-library/user-event`

### Suggested Configuration

**`vitest.config.js` (to create in root):**

```javascript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom', // For React components
    setupFiles: ['./src/__tests__/setup.js'],
    include: ['src/**/*.test.{js,jsx}', '**/__tests__/**/*.{js,jsx}'],
    exclude: ['node_modules', 'dist', 'release'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json'],
      include: ['src/**/*.{js,jsx}'],
      exclude: ['src/**/*.test.{js,jsx}', 'src/__tests__/**'],
      lines: 50,
      functions: 50,
      branches: 50,
      statements: 50
    }
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, './src/shared'),
      '@components': path.resolve(__dirname, './src/shared/components'),
      '@hooks': path.resolve(__dirname, './src/shared/hooks'),
      '@services': path.resolve(__dirname, './src/shared/services'),
      '@utils': path.resolve(__dirname, './src/shared/utils'),
      '@styles': path.resolve(__dirname, './src/shared/styles')
    }
  }
});
```

**Add to `package.json` scripts:**

```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:run": "vitest run",
    "test:coverage": "vitest run --coverage"
  }
}
```

## Test Directory Structure

**Recommended layout:**

```
src/
├── __tests__/
│   ├── setup.js                    # Global test setup (mocks, fixtures)
│   ├── mocks/
│   │   ├── electron.js             # Mock electron module
│   │   ├── ipc.js                  # Mock IPC bridge
│   │   └── playwright.js           # Mock Playwright browser
│   └── fixtures/
│       ├── profiles.js             # Sample profile data
│       └── browser-context.js      # Mock browser contexts

├── shared/
│   ├── services/
│   │   └── api/
│   │       ├── client.js
│   │       ├── client.test.js      # Co-located tests
│   │       └── profiles.js
│   └── components/
│       └── common/
│           └── Button/
│               ├── Button.jsx
│               └── Button.test.jsx

├── main/
│   ├── controllers/
│   │   ├── profiles.js
│   │   └── profiles.test.js
│   └── engine/
│       ├── actions.js
│       └── actions.test.js

└── renderer/
    ├── App.jsx
    └── App.test.jsx
```

## Test File Organization

**Location:** Co-located with source files (same directory)

**Naming:** `*.test.js` or `*.test.jsx`

**File pairs:**
- `src/shared/services/api/client.js` + `src/shared/services/api/client.test.js`
- `src/shared/components/common/Button/Button.jsx` + `src/shared/components/common/Button/Button.test.jsx`
- `src/main/controllers/profiles.js` + `src/main/controllers/profiles.test.js`

## Test Structure

### Unit Test Pattern (Services)

**Example: `src/shared/services/api/client.test.js`**

```javascript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ApiClient, ApiError } from './client.js';

describe('ApiClient', () => {
  let client;
  
  beforeEach(() => {
    client = new ApiClient('http://localhost:5478');
  });

  describe('constructor', () => {
    it('should initialize with baseURL', () => {
      expect(client.baseURL).toBe('http://localhost:5478');
    });

    it('should set default headers', () => {
      expect(client.defaultOptions.headers['Content-Type']).toBe('application/json');
    });
  });

  describe('request', () => {
    it('should throw ApiError on non-OK response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: vi.fn().mockResolvedValue({ message: 'Profile not found' }),
        headers: new Map([['content-type', 'application/json']])
      });

      await expect(client.get('/api/profiles/unknown')).rejects.toThrow(ApiError);
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:5478/api/profiles/unknown',
        expect.objectContaining({ method: 'GET' })
      );
    });

    it('should handle network errors', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network failed'));
      
      await expect(client.get('/api/profiles')).rejects.toThrow(ApiError);
    });
  });
});
```

### React Component Test Pattern

**Example: `src/shared/components/common/Button/Button.test.jsx`**

```javascript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './Button.jsx';

describe('Button Component', () => {
  it('should render with children', () => {
    render(<Button>Click Me</Button>);
    expect(screen.getByText('Click Me')).toBeInTheDocument();
  });

  it('should apply variant class', () => {
    const { container } = render(<Button variant="danger">Delete</Button>);
    expect(container.querySelector('button')).toHaveClass('danger');
  });

  it('should call onClick handler', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    
    render(<Button onClick={onClick}>Submit</Button>);
    await user.click(screen.getByText('Submit'));
    
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('should disable when loading', () => {
    render(<Button loading>Processing</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('should not call onClick when disabled', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    
    render(<Button disabled onClick={onClick}>Disabled</Button>);
    await user.click(screen.getByRole('button'));
    
    expect(onClick).not.toHaveBeenCalled();
  });
});
```

### Main Process Test Pattern (with Mocks)

**Example: `src/main/controllers/profiles.test.js`**

```javascript
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import * as fs from 'fs';
import { launchProfileInternal } from './profiles.js';

// Mock dependencies
vi.mock('fs');
vi.mock('../logging/logger');
vi.mock('../storage/paths');
vi.mock('../storage/settings');

describe('profiles controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('launchProfileInternal', () => {
    it('should return error if profile already running', async () => {
      const result = await launchProfileInternal('profile-1');
      
      expect(result.success).toBe(true); // Or false, depending on mock state
      expect(result).toHaveProperty('wsEndpoint');
    });

    it('should prevent concurrent launches of same profile', async () => {
      // Simulate concurrent launches
      const promise1 = launchProfileInternal('profile-1');
      const promise2 = launchProfileInternal('profile-1');
      
      const [result1, result2] = await Promise.all([promise1, promise2]);
      
      // Second should be rejected
      expect(result2.success).toBe(false);
      expect(result2.error).toMatch(/already starting up/i);
    });
  });
});
```

## Mocking

**Framework:** Vitest's `vi` mock function

**Patterns:**

### Mock Electron IPC

```javascript
import { vi } from 'vitest';

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
    on: vi.fn(),
    off: vi.fn()
  },
  app: {
    whenReady: vi.fn().mockResolvedValue(undefined),
    quit: vi.fn(),
    on: vi.fn()
  },
  BrowserWindow: {
    getAllWindows: vi.fn().mockReturnValue([]),
    fromWebContents: vi.fn()
  }
}));
```

### Mock Playwright Browser

```javascript
const mockPage = {
  click: vi.fn(),
  goto: vi.fn(),
  evaluate: vi.fn(),
  $eval: vi.fn(),
  waitForSelector: vi.fn()
};

const mockContext = {
  newPage: vi.fn().mockResolvedValue(mockPage),
  pages: vi.fn().mockReturnValue([mockPage]),
  isClosed: vi.fn().mockReturnValue(false)
};

const mockBrowser = {
  contexts: vi.fn().mockReturnValue([mockContext]),
  newContext: vi.fn().mockResolvedValue(mockContext),
  close: vi.fn()
};

vi.mock('playwright', () => ({
  chromium: {
    launch: vi.fn().mockResolvedValue(mockBrowser),
    connectOverCDP: vi.fn().mockResolvedValue(mockBrowser)
  }
}));
```

### Mock File System

```javascript
import { vi } from 'vitest';
import * as fs from 'fs';

vi.mock('fs', () => ({
  readFileSync: vi.fn().mockReturnValue('{}'),
  writeFileSync: vi.fn(),
  appendFileSync: vi.fn(),
  existsSync: vi.fn().mockReturnValue(true),
  mkdirSync: vi.fn()
}));
```

**What to Mock:**
- External dependencies: Electron, Playwright, file system, network
- Async operations that are slow or have side effects
- Any system-level calls (process spawning, port binding)

**What NOT to Mock:**
- Pure utility functions
- Business logic you want to test
- Data transformation functions
- Internal state management (keep real for integration tests)

## Fixtures and Factories

**Test data location:** `src/__tests__/fixtures/`

**Profile fixture example:**

```javascript
// src/__tests__/fixtures/profiles.js
export const mockProfile = {
  id: 'profile-test-1',
  name: 'Test Profile',
  settings: {
    chromePath: '/usr/bin/chromium',
    userDataDir: '/tmp/test-profile'
  },
  startUrl: 'https://google.com',
  fingerprint: null,
  createdAt: '2026-04-13T00:00:00Z'
};

export const createMockProfile = (overrides = {}) => ({
  ...mockProfile,
  id: `profile-${Math.random()}`,
  ...overrides
});
```

**Browser context factory:**

```javascript
// src/__tests__/fixtures/browser-context.js
export const createMockBrowser = () => ({
  isConnected: () => true,
  contexts: () => [createMockContext()],
  close: vi.fn(),
  disconnect: vi.fn()
});

export const createMockContext = () => ({
  pages: () => [createMockPage()],
  newPage: vi.fn().mockResolvedValue(createMockPage()),
  isClosed: () => false,
  close: vi.fn()
});

export const createMockPage = () => ({
  goto: vi.fn().mockResolvedValue(null),
  click: vi.fn().mockResolvedValue(null),
  evaluate: vi.fn().mockResolvedValue(null),
  close: vi.fn(),
  isClosed: () => false
});
```

## Coverage

**Target:** No formal requirement currently, but recommend 50-60% minimum for critical paths

**View Coverage:**

```bash
npm run test:coverage
```

**Coverage report output:**
- Text summary in console
- HTML report in `coverage/index.html`
- JSON for CI integration in `coverage/coverage-final.json`

## Test Types

### Unit Tests

**Scope:** Individual functions, class methods, pure logic

**Approach:**
- Test one function in isolation
- Use mocks for all dependencies
- Fast (under 100ms per test)
- Example: `ApiClient.get()`, `Button` component rendering, `ok()` error helper

**Files:**
- `src/shared/services/api/client.test.js`
- `src/shared/components/common/Button/Button.test.jsx`
- Utilities and helpers under `src/shared/utils/**/*.test.js`

### Integration Tests

**Scope:** Multiple units working together; Electron IPC flow, Profile launch sequence

**Approach:**
- Use real (non-mocked) business logic where safe
- Mock external services (Playwright, file system, network)
- Can be slower (up to 1 second per test)
- Example: Full profile save → load → validate flow

**Example:**

```javascript
describe('Profile lifecycle', () => {
  it('should save and load profile settings', async () => {
    const profile = createMockProfile({ name: 'Integration Test' });
    
    // Real: saveProfileInternal
    const saveResult = await saveProfileInternal(profile);
    expect(saveResult.success).toBe(true);
    
    // Real: readProfiles -> should find saved profile
    const profiles = readProfiles();
    const found = profiles.find(p => p.id === profile.id);
    
    expect(found).toBeDefined();
    expect(found.name).toBe('Integration Test');
  });
});
```

### E2E Tests

**Status:** Not currently implemented

**Recommendation:** Use Playwright Test (already installed: `playwright@npm:rebrowser-playwright`)

**Why:**
- App already uses Playwright for automation
- Can test actual Electron app window
- Can verify IPC communication end-to-end
- Can test renderer UI with real browser engine

**Setup (future):**

```bash
# Create playwright.config.js
# Tests in src/e2e/**/*.spec.js
npm run test:e2e
```

## Common Patterns

### Async Testing

**Pattern: Testing async functions**

```javascript
it('should fetch profiles', async () => {
  const result = await getProfilesInternal();
  expect(result).toEqual(expect.arrayContaining([
    expect.objectContaining({ id: expect.any(String) })
  ]));
});

// With error handling
it('should handle fetch error', async () => {
  global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
  
  await expect(fetchProfiles()).rejects.toThrow('Network error');
});
```

### Error Testing

**Pattern: Testing error handling**

```javascript
it('should return error object on failure', async () => {
  const result = await launchProfileInternal('non-existent');
  
  expect(result.success).toBe(false);
  expect(result.error).toBeDefined();
  expect(result.error).toMatch(/not found|not running/i);
});

// Structured error response testing
it('should follow error format: { success, error, ...data }', async () => {
  const result = await mouseClick('unknown-profile', { x: 0, y: 0 });
  
  expect(result).toMatchObject({
    success: false,
    error: expect.any(String)
  });
});
```

### State Management Testing (Zustand)

**Pattern: Testing Zustand stores**

```javascript
import { renderHook, act } from '@testing-library/react';
import { useProfileStore } from '@shared/stores/profiles';

it('should update profile in store', () => {
  const { result } = renderHook(() => useProfileStore());
  
  act(() => {
    result.current.setSelectedProfile({ id: 'p1', name: 'Test' });
  });
  
  expect(result.current.selectedProfile.id).toBe('p1');
});
```

---

*Testing analysis: 2026-04-13*
