// Application Constants

// Browser Types
export const BROWSER_TYPES = {
  CHROME: 'chrome',
  FIREFOX: 'firefox',
  SAFARI: 'safari',
  EDGE: 'edge'
};

// Operating Systems
export const OS_TYPES = {
  WINDOWS: 'windows',
  MACOS: 'macos',
  LINUX: 'linux'
};

// Profile Status
export const PROFILE_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  RUNNING: 'running',
  ERROR: 'error'
};

// Automation Engines
export const AUTOMATION_ENGINES = {
  PLAYWRIGHT: 'playwright',
  CDP: 'cdp'
};

// Screen Resolutions
export const SCREEN_RESOLUTIONS = [
  { label: '1920x1080', value: '1920x1080', width: 1920, height: 1080 },
  { label: '1366x768', value: '1366x768', width: 1366, height: 768 },
  { label: '1440x900', value: '1440x900', width: 1440, height: 900 },
  { label: '1536x864', value: '1536x864', width: 1536, height: 864 },
  { label: '2560x1440', value: '2560x1440', width: 2560, height: 1440 }
];

// Languages
export const LANGUAGES = [
  { label: 'English (US)', value: 'en-US' },
  { label: 'English (GB)', value: 'en-GB' },
  { label: 'Vietnamese', value: 'vi-VN' },
  { label: 'Spanish', value: 'es-ES' },
  { label: 'French', value: 'fr-FR' },
  { label: 'German', value: 'de-DE' },
  { label: 'Japanese', value: 'ja-JP' },
  { label: 'Chinese', value: 'zh-CN' }
];

// Timezones
export const TIMEZONES = [
  { label: 'EST (UTC-5)', value: 'America/New_York' },
  { label: 'CST (UTC-6)', value: 'America/Chicago' },
  { label: 'MST (UTC-7)', value: 'America/Denver' },
  { label: 'PST (UTC-8)', value: 'America/Los_Angeles' },
  { label: 'GMT (UTC+0)', value: 'Europe/London' },
  { label: 'CET (UTC+1)', value: 'Europe/Paris' },
  { label: 'JST (UTC+9)', value: 'Asia/Tokyo' },
  { label: 'CST (UTC+8)', value: 'Asia/Shanghai' }
];

// API Endpoints
export const API_ENDPOINTS = {
  PROFILES: '/api/profiles',
  AUTOMATION: '/api/automation',
  PROXIES: '/api/proxies',
  COOKIES: '/api/cookies',
  SCRIPTS: '/api/scripts'
};

// Toast Types
export const TOAST_TYPES = {
  SUCCESS: 'success',
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info'
};

// Default Profile Settings
export const DEFAULT_PROFILE = {
  name: '',
  description: '',
  startUrl: 'https://www.google.com',
  active: true,
  fingerprint: {
    os: OS_TYPES.WINDOWS,
    browser: BROWSER_TYPES.CHROME,
    browserVersion: '120.0.0.0',
    userAgent: '',
    language: 'en-US',
    timezone: 'America/New_York',
    screenResolution: '1920x1080',
    webglEnabled: true,
    canvasEnabled: true,
    audioContextEnabled: true
  },
  settings: {
    engine: AUTOMATION_ENGINES.PLAYWRIGHT,
    headless: false,
    proxy: null,
    webrtcPolicy: 'default'
  }
};
