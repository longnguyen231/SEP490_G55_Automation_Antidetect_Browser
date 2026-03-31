
const crypto = require('crypto');

// ═══════════════════════════════════════════════════════════════════════
// PRNG (Mulberry32)
// ═══════════════════════════════════════════════════════════════════════
function createRng(seed) {
  let state = seed | 0;
  return function () {
    state = state + 0x6D2B79F5 | 0;
    let t = Math.imul(state ^ state >>> 15, 1 | state);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

function pickWeighted(rng, items) {
  const total = items.reduce((s, i) => s + (i.weight || 1), 0);
  let r = rng() * total;
  for (const item of items) {
    r -= (item.weight || 1);
    if (r <= 0) return item;
  }
  return items[items.length - 1];
}

// ═══════════════════════════════════════════════════════════════════════
// DATA POOLS — Realistic values observed from real browsers
// ═══════════════════════════════════════════════════════════════════════

const CHROME_VERSIONS = [
  // Recent stable Chrome versions (high weight = more common)
  { major: 136, full: '136.0.7103.93', weight: 10 },
  { major: 135, full: '135.0.6998.117', weight: 8 },
  { major: 134, full: '134.0.6998.62', weight: 5 },
  { major: 133, full: '133.0.6943.98', weight: 3 },
  { major: 132, full: '132.0.6834.110', weight: 2 },
  { major: 131, full: '131.0.6778.86', weight: 1 },
];

const OS_CONFIGS = {
  Windows: {
    platforms: ['Win32'],
    ntVersions: ['10.0'],
    weight: 65,
    webglVendors: [
      { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 3 },
      { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4060 Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 3 },
      { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1660 SUPER Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 2 },
      { vendor: 'Google Inc. (AMD)', renderer: 'ANGLE (AMD, AMD Radeon RX 580 Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 2 },
      { vendor: 'Google Inc. (AMD)', renderer: 'ANGLE (AMD, AMD Radeon RX 6600 XT Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 2 },
      { vendor: 'Google Inc. (Intel)', renderer: 'ANGLE (Intel, Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 3 },
      { vendor: 'Google Inc. (Intel)', renderer: 'ANGLE (Intel, Intel(R) Iris(R) Xe Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 2 },
    ],
  },
  macOS: {
    platforms: ['MacIntel'],
    macVersions: ['10_15_7', '13_0', '14_0', '14_5', '15_0'],
    weight: 25,
    webglVendors: [
      { vendor: 'Google Inc. (Apple)', renderer: 'ANGLE (Apple, Apple M1, OpenGL 4.1)', weight: 4 },
      { vendor: 'Google Inc. (Apple)', renderer: 'ANGLE (Apple, Apple M2, OpenGL 4.1)', weight: 3 },
      { vendor: 'Google Inc. (Apple)', renderer: 'ANGLE (Apple, Apple M3, OpenGL 4.1)', weight: 2 },
      { vendor: 'Google Inc. (Apple)', renderer: 'ANGLE (Apple, Apple M1 Pro, OpenGL 4.1)', weight: 2 },
      { vendor: 'Google Inc. (Intel)', renderer: 'ANGLE (Intel Inc., Intel(R) UHD Graphics 630, OpenGL 4.1)', weight: 1 },
    ],
  },
  Linux: {
    platforms: ['Linux x86_64'],
    weight: 10,
    webglVendors: [
      { vendor: 'Google Inc. (Mesa)', renderer: 'ANGLE (Mesa, llvmpipe (LLVM 15.0.7, 256 bits), OpenGL 4.5)', weight: 2 },
      { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3070/PCIe/SSE2, OpenGL 4.6)', weight: 2 },
      { vendor: 'Google Inc. (AMD)', renderer: 'ANGLE (AMD, AMD Radeon RX 580 (POLARIS10, DRM 3.49.0), OpenGL 4.6)', weight: 1 },
      { vendor: 'Google Inc. (Intel)', renderer: 'ANGLE (Intel, Mesa Intel(R) UHD Graphics 630 (CFL GT2), OpenGL 4.6)', weight: 1 },
    ],
  },
};

const SCREEN_RESOLUTIONS = [
  { res: '1920x1080', weight: 40 },
  { res: '2560x1440', weight: 15 },
  { res: '1366x768', weight: 12 },
  { res: '1536x864', weight: 8 },
  { res: '1440x900', weight: 6 },
  { res: '1680x1050', weight: 4 },
  { res: '2560x1600', weight: 3 },
  { res: '3840x2160', weight: 3 },
  { res: '1280x720', weight: 3 },
  { res: '1600x900', weight: 3 },
  { res: '3440x1440', weight: 2 },
  { res: '1280x1024', weight: 1 },
];

const LOCALE_TIMEZONE_PAIRS = [
  { language: 'en-US', timezone: 'America/New_York', weight: 15 },
  { language: 'en-US', timezone: 'America/Chicago', weight: 10 },
  { language: 'en-US', timezone: 'America/Denver', weight: 5 },
  { language: 'en-US', timezone: 'America/Los_Angeles', weight: 12 },
  { language: 'en-GB', timezone: 'Europe/London', weight: 8 },
  { language: 'de-DE', timezone: 'Europe/Berlin', weight: 6 },
  { language: 'fr-FR', timezone: 'Europe/Paris', weight: 5 },
  { language: 'es-ES', timezone: 'Europe/Madrid', weight: 4 },
  { language: 'it-IT', timezone: 'Europe/Rome', weight: 3 },
  { language: 'pt-BR', timezone: 'America/Sao_Paulo', weight: 4 },
  { language: 'ja-JP', timezone: 'Asia/Tokyo', weight: 5 },
  { language: 'ko-KR', timezone: 'Asia/Seoul', weight: 3 },
  { language: 'zh-CN', timezone: 'Asia/Shanghai', weight: 5 },
  { language: 'vi-VN', timezone: 'Asia/Ho_Chi_Minh', weight: 3 },
  { language: 'th-TH', timezone: 'Asia/Bangkok', weight: 2 },
  { language: 'ru-RU', timezone: 'Europe/Moscow', weight: 3 },
  { language: 'nl-NL', timezone: 'Europe/Amsterdam', weight: 2 },
  { language: 'pl-PL', timezone: 'Europe/Warsaw', weight: 2 },
  { language: 'tr-TR', timezone: 'Europe/Istanbul', weight: 2 },
  { language: 'id-ID', timezone: 'Asia/Jakarta', weight: 2 },
];

const CPU_CORES_OPTIONS = [
  { cores: 2, weight: 5 },
  { cores: 4, weight: 25 },
  { cores: 6, weight: 20 },
  { cores: 8, weight: 30 },
  { cores: 10, weight: 8 },
  { cores: 12, weight: 8 },
  { cores: 16, weight: 4 },
];

const MEMORY_OPTIONS = [
  { gb: 4, weight: 10 },
  { gb: 8, weight: 35 },
  { gb: 16, weight: 35 },
  { gb: 32, weight: 15 },
  { gb: 64, weight: 5 },
];

const DEVICE_PIXEL_RATIOS = [
  { dpr: 1, weight: 50 },
  { dpr: 1.25, weight: 10 },
  { dpr: 1.5, weight: 15 },
  { dpr: 2, weight: 20 },
  { dpr: 3, weight: 5 },
];

// Common font sets by OS (used for font spoofing)
const FONTS_BY_OS = {
  Windows: [
    'Arial', 'Arial Black', 'Calibri', 'Cambria', 'Cambria Math',
    'Comic Sans MS', 'Consolas', 'Constantia', 'Corbel', 'Courier New',
    'Georgia', 'Impact', 'Lucida Console', 'Microsoft Sans Serif',
    'Palatino Linotype', 'Segoe UI', 'Segoe UI Symbol', 'Tahoma',
    'Times New Roman', 'Trebuchet MS', 'Verdana', 'Webdings', 'Wingdings',
  ],
  macOS: [
    'Arial', 'Arial Black', 'Comic Sans MS', 'Courier New', 'Georgia',
    'Helvetica', 'Helvetica Neue', 'Impact', 'Lucida Grande', 'Menlo',
    'Monaco', 'Palatino', 'SF Pro Text', 'SF Pro Display', 'Symbol',
    'Times New Roman', 'Trebuchet MS', 'Verdana',
  ],
  Linux: [
    'Arial', 'Courier New', 'DejaVu Sans', 'DejaVu Sans Mono',
    'DejaVu Serif', 'Droid Sans', 'FreeMono', 'FreeSans', 'FreeSerif',
    'Liberation Mono', 'Liberation Sans', 'Liberation Serif', 'Noto Sans',
    'Noto Serif', 'Ubuntu', 'Ubuntu Mono',
  ],
};

// ═══════════════════════════════════════════════════════════════════════
// USER-AGENT BUILDER
// ═══════════════════════════════════════════════════════════════════════

function buildUserAgent(os, chromeVersion, rng) {
  const { major, full } = chromeVersion;
  // Real Chrome UA uses the FULL version (e.g., 136.0.7103.93), not abbreviated.
  // Anti-bot systems cross-check UA version with sec-ch-ua-full-version-list.
  switch (os) {
    case 'Windows': {
      return `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${full} Safari/537.36`;
    }
    case 'macOS': {
      const macVer = pick(rng, OS_CONFIGS.macOS.macVersions);
      return `Mozilla/5.0 (Macintosh; Intel Mac OS X ${macVer}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${full} Safari/537.36`;
    }
    case 'Linux': {
      return `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${full} Safari/537.36`;
    }
    default:
      return `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${full} Safari/537.36`;
  }
}

// Build sec-ch-ua brands for a specific Chrome major version
function buildSecChUaBrands(major) {
  const m = Number(major);
  let notABrand;
  if (m >= 135) notABrand = { brand: 'Not?A_Brand', version: '99' };
  else if (m >= 131) notABrand = { brand: 'Not)A;Brand', version: '99' };
  else if (m >= 125) notABrand = { brand: 'Not/A)Brand', version: '8' };
  else notABrand = { brand: 'Not_A Brand', version: '24' };
  return [notABrand, { brand: 'Chromium', version: String(m) }, { brand: 'Google Chrome', version: String(m) }];
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN GENERATOR
// ═══════════════════════════════════════════════════════════════════════

/**
 * Generate a complete, internally-consistent random fingerprint.
 *
 * @param {Object} [opts] - Optional constraints
 * @param {string} [opts.os] - Force a specific OS ('Windows', 'macOS', 'Linux')
 * @param {string} [opts.language] - Force a specific language (e.g., 'en-US')
 * @param {string} [opts.timezone] - Force a specific timezone
 * @param {number} [opts.seed] - Seed for deterministic generation
 * @returns {Object} Complete fingerprint + settings objects ready for profile creation
 */
function generateFingerprint(opts = {}) {
  // Create RNG from seed (or random seed)
  const seed = opts.seed || (crypto.randomBytes(4).readUInt32BE(0));
  const rng = createRng(seed);

  // 1. Choose OS
  const osItems = Object.entries(OS_CONFIGS).map(([name, cfg]) => ({ name, ...cfg }));
  const osChoice = opts.os
    ? osItems.find(o => o.name === opts.os) || osItems[0]
    : pickWeighted(rng, osItems);
  const os = osChoice.name;

  // 2. Choose Chrome version
  const chromeVersion = pickWeighted(rng, CHROME_VERSIONS);

  // 3. Build User-Agent
  const userAgent = buildUserAgent(os, chromeVersion, rng);

  // 4. Platform
  const platform = pick(rng, osChoice.platforms);

  // 5. Screen resolution
  const screenRes = pickWeighted(rng, SCREEN_RESOLUTIONS).res;

  // 6. Language + Timezone (geographically paired)
  let language, timezone;
  if (opts.language && opts.timezone) {
    language = opts.language;
    timezone = opts.timezone;
  } else if (opts.language) {
    language = opts.language;
    const matching = LOCALE_TIMEZONE_PAIRS.filter(p => p.language === language);
    timezone = matching.length ? pick(rng, matching).timezone : 'UTC';
  } else if (opts.timezone) {
    timezone = opts.timezone;
    const matching = LOCALE_TIMEZONE_PAIRS.filter(p => p.timezone === timezone);
    language = matching.length ? pick(rng, matching).language : 'en-US';
  } else {
    const pair = pickWeighted(rng, LOCALE_TIMEZONE_PAIRS);
    language = pair.language;
    timezone = pair.timezone;
  }

  // 7. Hardware
  const cpuCores = pickWeighted(rng, CPU_CORES_OPTIONS).cores;
  const memoryGB = pickWeighted(rng, MEMORY_OPTIONS).gb;
  const dpr = pickWeighted(rng, DEVICE_PIXEL_RATIOS).dpr;

  // 8. WebGL
  const webglConfig = pickWeighted(rng, osChoice.webglVendors);

  // 9. Plugins count (Chrome always has 5 PDF-related plugins)
  const plugins = 5;

  // 10. Build secondary language (e.g., 'en-US' → 'en-US,en')
  const primaryLang = language.split('-')[0];
  const languages = language === primaryLang ? language : `${language},${primaryLang}`;

  // 11. Fonts for this OS
  const fonts = FONTS_BY_OS[os] || FONTS_BY_OS.Windows;

  // Assemble fingerprint object (matches profile.fingerprint schema)
  const fingerprint = {
    os,
    browser: 'Chrome',
    browserVersion: chromeVersion.full,
    userAgent,
    language,
    screenResolution: screenRes,
    timezone,
    webgl: true,
    canvas: true,
    audio: true,
  };

  // Assemble settings overrides (matches profile.settings schema)
  const settings = {
    cpuCores,
    memoryGB,
    language,
    timezone,
    advanced: {
      platform,
      dnt: rng() < 0.1, // ~10% of users enable Do Not Track
      devicePixelRatio: dpr,
      maxTouchPoints: 0,
      webglVendor: webglConfig.vendor,
      webglRenderer: webglConfig.renderer,
      plugins,
      languages,
    },
  };

  return {
    fingerprint,
    settings,
    _meta: {
      seed,
      fonts,
      chromeVersion: chromeVersion.full,
      chromeMajor: chromeVersion.major,
    },
  };
}

/**
 * Generate multiple unique fingerprints at once.
 *
 * @param {number} count - Number of fingerprints to generate
 * @param {Object} [opts] - Base options to apply to all
 * @returns {Array} Array of generated fingerprint objects
 */
function generateBatch(count, opts = {}) {
  const results = [];
  for (let i = 0; i < count; i++) {
    // Each gets a unique seed derived from crypto.randomBytes
    const seed = crypto.randomBytes(4).readUInt32BE(0);
    results.push(generateFingerprint({ ...opts, seed }));
  }
  return results;
}

/**
 * Get a random User-Agent string only (lightweight utility).
 */
function randomUserAgent(opts = {}) {
  const fp = generateFingerprint(opts);
  return fp.fingerprint.userAgent;
}

// ═══════════════════════════════════════════════════════════════════════
// SECTION-SPECIFIC GENERATORS
// ═══════════════════════════════════════════════════════════════════════

/**
 * Generate identity section: user-agent, platform, locale, timezone, languages
 */
function generateIdentity(opts = {}) {
  const seed = opts.seed || (crypto.randomBytes(4).readUInt32BE(0));
  const rng = createRng(seed);

  const osItems = Object.entries(OS_CONFIGS).map(([name, cfg]) => ({ name, ...cfg }));
  const osChoice = opts.os
    ? osItems.find(o => o.name === opts.os) || osItems[0]
    : pickWeighted(rng, osItems);
  const os = osChoice.name;
  const chromeVersion = pickWeighted(rng, CHROME_VERSIONS);
  const userAgent = buildUserAgent(os, chromeVersion, rng);
  const platform = pick(rng, osChoice.platforms);

  let language, timezone;
  if (opts.language && opts.timezone) {
    language = opts.language;
    timezone = opts.timezone;
  } else {
    const pair = pickWeighted(rng, LOCALE_TIMEZONE_PAIRS);
    language = opts.language || pair.language;
    timezone = opts.timezone || pair.timezone;
  }

  const primaryLang = language.split('-')[0];
  const languages = language === primaryLang ? language : `${language}, ${primaryLang}`;

  return {
    data: { userAgent, platform, locale: language, timezone, languages },
  };
}

/**
 * Generate display section: resolution, color depth, pixel ratio
 */
function generateDisplay(opts = {}) {
  const seed = opts.seed || (crypto.randomBytes(4).readUInt32BE(0));
  const rng = createRng(seed);

  const screenRes = pickWeighted(rng, SCREEN_RESOLUTIONS).res;
  const [width, height] = screenRes.split('x').map(Number);
  const pixelRatio = pickWeighted(rng, DEVICE_PIXEL_RATIOS).dpr;
  const colorDepth = pick(rng, [24, 32]);

  return {
    data: { preset: 'Custom', width, height, colorDepth, pixelRatio },
  };
}

/**
 * Generate hardware section: CPU, memory, GPU
 */
function generateHardware(opts = {}) {
  const seed = opts.seed || (crypto.randomBytes(4).readUInt32BE(0));
  const rng = createRng(seed);

  const osItems = Object.entries(OS_CONFIGS).map(([name, cfg]) => ({ name, ...cfg }));
  const osChoice = opts.os
    ? osItems.find(o => o.name === opts.os) || osItems[0]
    : pickWeighted(rng, osItems);

  const cpuCores = pickWeighted(rng, CPU_CORES_OPTIONS).cores;
  const memoryGB = pickWeighted(rng, MEMORY_OPTIONS).gb;
  const webglConfig = pickWeighted(rng, osChoice.webglVendors);

  return {
    data: {
      cpuCores,
      memoryGB,
      gpuVendor: webglConfig.vendor,
      gpuRenderer: webglConfig.renderer,
    },
  };
}

/**
 * Generate canvas section: noise seed, intensity
 */
function generateCanvas(opts = {}) {
  const seed = opts.seed || (crypto.randomBytes(4).readUInt32BE(0));
  const rng = createRng(seed);

  return {
    data: {
      noiseSeed: Math.floor(rng() * 1000000),
      noiseIntensity: Math.floor(rng() * 10) + 1,
    },
  };
}

/**
 * Generate WebGL section: noise seed, max texture size, extensions
 */
function generateWebGL(opts = {}) {
  const seed = opts.seed || (crypto.randomBytes(4).readUInt32BE(0));
  const rng = createRng(seed);

  const maxTextureSizes = [4096, 8192, 16384, 32768];
  const extensionSets = [
    'WEBGL_debug_renderer_info, OES_texture_float, OES_texture_half_float, WEBGL_lose_context',
    'WEBGL_debug_renderer_info, OES_texture_float, OES_texture_half_float, OES_element_index_uint, WEBGL_lose_context, EXT_texture_filter_anisotropic',
    'WEBGL_debug_renderer_info, OES_texture_float, WEBGL_lose_context',
    '',
  ];

  return {
    data: {
      noiseSeed: Math.floor(rng() * 1000000),
      maxTextureSize: pick(rng, maxTextureSizes),
      extensions: pick(rng, extensionSets),
    },
  };
}

/**
 * Generate audio section: sample rate, channels, noise seed
 */
function generateAudio(opts = {}) {
  const seed = opts.seed || (crypto.randomBytes(4).readUInt32BE(0));
  const rng = createRng(seed);

  const sampleRates = [44100, 48000, 96000];
  const channelOptions = ['mono', 'stereo', '5.1'];

  return {
    data: {
      sampleRate: pick(rng, sampleRates),
      channels: pick(rng, channelOptions),
      noiseSeed: Math.floor(rng() * 1000000),
    },
  };
}

/**
 * Generate media section: device counts
 */
function generateMedia(opts = {}) {
  const seed = opts.seed || (crypto.randomBytes(4).readUInt32BE(0));
  const rng = createRng(seed);

  return {
    data: {
      speakers: Math.floor(rng() * 3) + 1,
      microphones: Math.floor(rng() * 2) + 1,
      webcams: Math.floor(rng() * 2) + 1,
    },
  };
}

/**
 * Generate network section: webrtc, navigator properties
 */
function generateNetwork(opts = {}) {
  const seed = opts.seed || (crypto.randomBytes(4).readUInt32BE(0));
  const rng = createRng(seed);

  const policies = ['default', 'disable_non_proxied_udp', 'default_public_interface_only'];
  const dntOptions = ['unspecified', 'true', 'false'];
  const connectionTypes = ['4g', 'wifi', '3g', 'ethernet'];

  return {
    data: {
      webrtcPolicy: pick(rng, policies),
      doNotTrack: pick(rng, dntOptions),
      maxTouchPoints: Math.floor(rng() * 5),
      connectionType: pick(rng, connectionTypes),
      pdfViewer: 'enabled',
    },
  };
}

/**
 * Generate battery section
 */
function generateBattery(opts = {}) {
  const seed = opts.seed || (crypto.randomBytes(4).readUInt32BE(0));
  const rng = createRng(seed);

  const isCharging = rng() > 0.3;
  const level = +(rng()).toFixed(2);

  return {
    data: {
      charging: isCharging ? 'charging' : 'discharging',
      level,
      chargingTime: isCharging ? Math.floor(rng() * 7200) : 0,
      dischargingTime: isCharging ? 0 : Math.floor(rng() * 36000),
    },
  };
}

module.exports = {
  generateFingerprint,
  generateBatch,
  randomUserAgent,
  // Section-specific generators
  generateIdentity,
  generateDisplay,
  generateHardware,
  generateCanvas,
  generateWebGL,
  generateAudio,
  generateMedia,
  generateNetwork,
  generateBattery,
  // Expose data pools for UI dropdowns
  CHROME_VERSIONS,
  OS_CONFIGS,
  SCREEN_RESOLUTIONS,
  LOCALE_TIMEZONE_PAIRS,
  CPU_CORES_OPTIONS,
  MEMORY_OPTIONS,
  FONTS_BY_OS,
};

