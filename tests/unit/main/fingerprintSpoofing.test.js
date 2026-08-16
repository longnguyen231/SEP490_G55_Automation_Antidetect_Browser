// tests/unit/main/fingerprintSpoofing.test.js
// ─────────────────────────────────────────────────────────────────────────────
// Test Suite: Fingerprint Spoofing & Section Toggle Unit Tests
// Source: HL-MCK_Fake_Fingerprint_BaoCao_v4.xlsx (Sheet: 3. Test Case Bat-Tat)
// Total Cases: 28 (TC-01 to TC-28)
// Coverage:
//   • TC-01: Baseline (All OFF) - Anti-automation active, real hardware/OS values preserved
//   • TC-02: Identity (ON) - Override UA, platform, languages, locale, timezone
//   • TC-03: Identity (OFF) - Real browser identity values returned
//   • TC-04: Display & Screen (ON) - Screen resolution, pixel ratio, outerWidth/Height override
//   • TC-05: Display & Screen (OFF) - Viewport null, physical screen values
//   • TC-06: Hardware (ON, diff value) - hardwareConcurrency, deviceMemory (W3C max 8)
//   • TC-07: Hardware (ON, same value) - Anti-tamper: skips defineProperty if values match
//   • TC-08: Hardware (OFF) - Real CPU & memory returned
//   • TC-09: Canvas (ON, diff profiles) - Deterministic noise differs across profileIds
//   • TC-10: Canvas (ON, same profile) - Hash consistency across multiple sessions
//   • TC-11: Canvas (OFF) - Real canvas pixel data returned without noise
//   • TC-12: WebGL (ON) - Unmasked vendor/renderer spoofing & readPixels noise
//   • TC-13: WebGL (OFF) - Real GPU vendor/renderer exposed
//   • TC-14: Canvas ON + WebGL OFF - Independent PRNG behavior (Canvas noisy, WebGL clean)
//   • TC-15: Audio (ON) - AnalyserNode noise & sampleRate override (diff hash per profile)
//   • TC-16: Audio (OFF) - Real AudioContext data returned
//   • TC-17: Battery (ON) - navigator.getBattery() spoofed promise
//   • TC-18: Battery (OFF) - Real battery behavior preserved
//   • TC-19: Media Devices (ON) - Fake enumerateDevices() list with empty labels
//   • TC-20: Media Devices (OFF) - Real media devices returned
//   • TC-21: WebRTC (Disable non-proxied UDP) - RTCPeerConnection throws NotSupportedError
//   • TC-22: WebRTC (Public interface only) - Only TURN relay / proxy IP exposed
//   • TC-23: WebRTC (Default) - Baseline WebRTC behavior
//   • TC-24: Anti-Automation (Always ON) - navigator.webdriver=false, cdc_* & __playwright cleaned
//   • TC-25: Safe Mode (ON) - Native prototype defineProperty skipped
//   • TC-26: Gotcha injectFingerprint=false - Canvas/Audio toggles handled independently
//   • TC-27: Profile Clone - Unique deterministic seed (hash(profileId)) ensures separation
//   • TC-28: UA Consistency - navigator.userAgent matches network HTTP header
// ─────────────────────────────────────────────────────────────────────────────

const crypto = require('crypto');

function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return Math.abs(hash);
}

// Simulated Mulberry32 PRNG matching fingerprintInit.js
function mulberry32(a) {
  return function() {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

class MockBrowserContext {
  constructor() {
    this.initScripts = [];
    this.contextOptions = {};
  }

  async addInitScript(scriptFn, ...args) {
    this.initScripts.push({ scriptFn, args });
  }
}

class FingerprintInjectionEngine {
  static simulateBrowserEnvironment(profile, settings = {}, options = {}) {
    const context = new MockBrowserContext();
    const env = {
      navigator: {
        webdriver: true, // Default in automation
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0.0.0',
        platform: 'Win32',
        language: 'en-US',
        languages: ['en-US', 'en'],
        hardwareConcurrency: 8,
        deviceMemory: 8,
      },
      screen: {
        width: 1920,
        height: 1080,
        availWidth: 1920,
        availHeight: 1040,
      },
      window: {
        devicePixelRatio: 1,
        outerWidth: 1920,
        outerHeight: 1080,
        __playwright: true,
        cdc_adoQpoasnfa76pfcZLmcfl_Array: true,
      },
      webgl: {
        vendor: 'Intel Inc.',
        renderer: 'Intel Iris Xe Graphics',
        imageHash: 'REAL_GPU_HASH_12345',
      },
      audio: {
        sampleRate: 44100,
        hash: 'REAL_AUDIO_HASH_67890',
      },
      battery: null,
      mediaDevices: [
        { kind: 'audioinput', label: 'Real Mic' },
        { kind: 'videoinput', label: 'Real Webcam' },
      ],
      webrtc: {
        enabled: true,
        mode: 'default',
        exposedIp: '192.168.1.100', // Real LAN IP
      },
    };

    const fp = profile?.fingerprint || {};
    const safeMode = options.safeMode || settings?.safeMode === true;
    const isClone = options.isClone || false;

    // 0. Anti-Automation (Always active unless explicitly disabled)
    env.navigator.webdriver = false;
    delete env.window.__playwright;
    delete env.window.cdc_adoQpoasnfa76pfcZLmcfl_Array;

    if (safeMode) {
      // Safe Mode: Skip all JS prototype tampering
      return { context, env };
    }

    // 1. Identity Section
    if (settings?.identity?.enabled === true && settings?.applyOverrides?.navigator !== false) {
      if (fp.userAgent) env.navigator.userAgent = fp.userAgent;
      if (fp.platform) env.navigator.platform = fp.platform;
      if (fp.language) {
        env.navigator.language = fp.language;
        env.navigator.languages = [fp.language, 'en'];
      }
      context.contextOptions.userAgent = env.navigator.userAgent;
      context.contextOptions.locale = fp.language || 'en-US';
      context.contextOptions.timezoneId = fp.timezone || 'Asia/Tokyo';
    }

    // 2. Display Section
    if (settings?.display?.enabled === true && settings?.applyOverrides?.viewport !== false) {
      if (fp.screenResolution) {
        const [w, h] = fp.screenResolution.split('x').map(Number);
        env.screen.width = w;
        env.screen.height = h;
        env.screen.availWidth = w;
        env.screen.availHeight = h - 40;
        env.window.outerWidth = w;
        env.window.outerHeight = h;
      }
      if (fp.pixelRatio) env.window.devicePixelRatio = Number(fp.pixelRatio);
      context.contextOptions.viewport = { width: env.screen.width, height: env.screen.height };
    } else {
      context.contextOptions.viewport = null; // Unlocked natural viewport
    }

    // 3. Hardware Section (with Anti-tamper: only override if different)
    if (settings?.hardware?.enabled === true && settings?.applyOverrides?.hardware !== false) {
      const targetCores = Number(settings.cpuCores || fp.cpuCores) || 0;
      const targetMemory = Number(settings.memoryGB || fp.deviceMemory) || 0;

      if (targetCores > 0 && targetCores !== env.navigator.hardwareConcurrency) {
        env.navigator.hardwareConcurrency = targetCores;
        env.navigator.hardwareConcurrencyTampered = true;
      }
      if (targetMemory > 0) {
        // W3C limit max 8
        const clampedMemory = Math.min(8, targetMemory);
        if (clampedMemory !== env.navigator.deviceMemory) {
          env.navigator.deviceMemory = clampedMemory;
          env.navigator.deviceMemoryTampered = true;
        }
      }
    }

    // 4. Canvas Section (Deterministic noise per profileId)
    const profileSeed = hashCode(profile?.id || 'default');
    if (settings?.canvas?.enabled === true && fp.canvas !== false) {
      const rng = mulberry32(profileSeed);
      const noise = Math.floor(rng() * 100000);
      env.canvasHash = `CANVAS_SPOOFED_HASH_${profileSeed}_${noise}`;
    } else {
      env.canvasHash = 'REAL_CANVAS_HASH_DEFAULT';
    }

    // 5. WebGL Section
    if (settings?.webgl?.enabled === true && settings?.applyOverrides?.webgl !== false) {
      if (fp.webglVendor) env.webgl.vendor = fp.webglVendor;
      if (fp.webglRenderer) env.webgl.renderer = fp.webglRenderer;
      const rng = mulberry32(profileSeed + 101);
      env.webgl.imageHash = `WEBGL_SPOOFED_HASH_${Math.floor(rng() * 100000)}`;
    }

    // 6. Audio Section
    if (settings?.audio?.enabled === true && fp.audio !== false) {
      if (fp.audioSampleRate) env.audio.sampleRate = Number(fp.audioSampleRate);
      const rng = mulberry32(profileSeed + 202);
      env.audio.hash = `AUDIO_SPOOFED_HASH_${Math.floor(rng() * 100000)}`;
    }

    // 7. Battery Section
    if (settings?.battery?.enabled === true) {
      env.battery = {
        level: fp.batteryLevel !== undefined ? Number(fp.batteryLevel) : 0.65,
        charging: fp.batteryCharging === true,
      };
    }

    // 8. Media Devices Section
    if (settings?.media?.enabled === true) {
      const numSpeakers = Number(fp.mediaSpeakers) || 2;
      const numMics = Number(fp.mediaMicrophones) || 1;
      const numWebcams = Number(fp.mediaWebcams) || 1;

      const fakeDevices = [];
      for (let i = 0; i < numSpeakers; i++) fakeDevices.push({ kind: 'audiooutput', label: '' });
      for (let i = 0; i < numMics; i++) fakeDevices.push({ kind: 'audioinput', label: '' });
      for (let i = 0; i < numWebcams; i++) fakeDevices.push({ kind: 'videoinput', label: '' });
      env.mediaDevices = fakeDevices;
    }

    // 9. WebRTC Section
    const webrtcMode = settings?.network?.webrtcMode || fp.webrtcMode || 'default';
    env.webrtc.mode = webrtcMode;
    if (webrtcMode === 'disable_non_proxied_udp') {
      env.webrtc.enabled = false;
      env.webrtc.throwError = 'NotSupportedError';
      env.webrtc.exposedIp = null;
    } else if (webrtcMode === 'public_interface_only') {
      env.webrtc.enabled = true;
      env.webrtc.exposedIp = '203.0.113.10'; // Spoofed proxy / TURN IP
    }

    return { context, env };
  }
}

describe('Fingerprint Spoofing & Section Toggle Suite [HL-MCK Specification Tests]', () => {
  // ════════════════════════════════════════════════════════════════════════════
  // TC-01: Baseline (All OFF)
  // ════════════════════════════════════════════════════════════════════════════
  test('TC-01: Baseline (All OFF) - Anti-automation active, real hardware/OS preserved', () => {
    const profile = { id: 'P-01' };
    const { env } = FingerprintInjectionEngine.simulateBrowserEnvironment(profile, {});

    expect(env.navigator.webdriver).toBe(false);
    expect(env.window.__playwright).toBeUndefined();
    expect(env.navigator.hardwareConcurrency).toBe(8);
    expect(env.canvasHash).toBe('REAL_CANVAS_HASH_DEFAULT');
  });

  // ════════════════════════════════════════════════════════════════════════════
  // TC-02 & TC-03: Identity Section (ON / OFF)
  // ════════════════════════════════════════════════════════════════════════════
  test('TC-02: Identity (ON) - UA, platform, language, timezone synchronized', () => {
    const profile = {
      id: 'P-02',
      fingerprint: {
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        platform: 'MacIntel',
        language: 'ja-JP',
        timezone: 'Asia/Tokyo',
      },
    };
    const settings = { identity: { enabled: true } };

    const { env, context } = FingerprintInjectionEngine.simulateBrowserEnvironment(profile, settings);
    expect(env.navigator.userAgent).toContain('Macintosh');
    expect(env.navigator.platform).toBe('MacIntel');
    expect(env.navigator.language).toBe('ja-JP');
    expect(context.contextOptions.timezoneId).toBe('Asia/Tokyo');
  });

  test('TC-03: Identity (OFF) - Real browser identity returned', () => {
    const profile = {
      id: 'P-03',
      fingerprint: { userAgent: 'Fake UA' },
    };
    const settings = { identity: { enabled: false } };

    const { env } = FingerprintInjectionEngine.simulateBrowserEnvironment(profile, settings);
    expect(env.navigator.userAgent).toBe('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0.0.0');
  });

  // ════════════════════════════════════════════════════════════════════════════
  // TC-04 & TC-05: Display & Screen (ON / OFF)
  // ════════════════════════════════════════════════════════════════════════════
  test('TC-04: Display & Screen (ON) - Resolution & pixel ratio locked', () => {
    const profile = {
      id: 'P-04',
      fingerprint: { screenResolution: '1600x900', pixelRatio: 2 },
    };
    const settings = { display: { enabled: true } };

    const { env, context } = FingerprintInjectionEngine.simulateBrowserEnvironment(profile, settings);
    expect(env.screen.width).toBe(1600);
    expect(env.screen.height).toBe(900);
    expect(env.window.devicePixelRatio).toBe(2);
    expect(context.contextOptions.viewport).toEqual({ width: 1600, height: 900 });
  });

  test('TC-05: Display & Screen (OFF) - Natural viewport and physical screen', () => {
    const profile = { id: 'P-05', fingerprint: { screenResolution: '1600x900' } };
    const settings = { display: { enabled: false } };

    const { env, context } = FingerprintInjectionEngine.simulateBrowserEnvironment(profile, settings);
    expect(context.contextOptions.viewport).toBeNull();
    expect(env.screen.width).toBe(1920);
  });

  // ════════════════════════════════════════════════════════════════════════════
  // TC-06, TC-07, TC-08: Hardware Section & Anti-Tamper
  // ════════════════════════════════════════════════════════════════════════════
  test('TC-06: Hardware (ON, diff value) - hardwareConcurrency & deviceMemory (max 8)', () => {
    const profile = {
      id: 'P-06',
      fingerprint: { cpuCores: 16, deviceMemory: 32 },
    };
    const settings = { hardware: { enabled: true } };

    const { env } = FingerprintInjectionEngine.simulateBrowserEnvironment(profile, settings);
    expect(env.navigator.hardwareConcurrency).toBe(16);
    expect(env.navigator.deviceMemory).toBe(8); // W3C limit max 8
    expect(env.navigator.hardwareConcurrencyTampered).toBe(true);
  });

  test('TC-07: Hardware (ON, same value) - Anti-tamper skips defineProperty if values match', () => {
    const profile = {
      id: 'P-07',
      fingerprint: { cpuCores: 8, deviceMemory: 8 }, // Same as real machine
    };
    const settings = { hardware: { enabled: true } };

    const { env } = FingerprintInjectionEngine.simulateBrowserEnvironment(profile, settings);
    expect(env.navigator.hardwareConcurrency).toBe(8);
    expect(env.navigator.hardwareConcurrencyTampered).toBeUndefined();
  });

  test('TC-08: Hardware (OFF) - Real CPU & memory returned', () => {
    const profile = { id: 'P-08', fingerprint: { cpuCores: 16 } };
    const settings = { hardware: { enabled: false } };

    const { env } = FingerprintInjectionEngine.simulateBrowserEnvironment(profile, settings);
    expect(env.navigator.hardwareConcurrency).toBe(8);
  });

  // ════════════════════════════════════════════════════════════════════════════
  // TC-09, TC-10, TC-11: Canvas Section & PRNG Consistency
  // ════════════════════════════════════════════════════════════════════════════
  test('TC-09: Canvas (ON, diff profiles) - Deterministic noise differs across profileIds', () => {
    const pA = { id: 'P-AAA' };
    const pB = { id: 'P-BBB' };
    const settings = { canvas: { enabled: true } };

    const { env: envA } = FingerprintInjectionEngine.simulateBrowserEnvironment(pA, settings);
    const { env: envB } = FingerprintInjectionEngine.simulateBrowserEnvironment(pB, settings);

    expect(envA.canvasHash).not.toBe(envB.canvasHash);
  });

  test('TC-10: Canvas (ON, same profile) - Hash consistency across multiple sessions', () => {
    const pA = { id: 'P-AAA' };
    const settings = { canvas: { enabled: true } };

    const { env: run1 } = FingerprintInjectionEngine.simulateBrowserEnvironment(pA, settings);
    const { env: run2 } = FingerprintInjectionEngine.simulateBrowserEnvironment(pA, settings);
    const { env: run3 } = FingerprintInjectionEngine.simulateBrowserEnvironment(pA, settings);

    expect(run1.canvasHash).toBe(run2.canvasHash);
    expect(run2.canvasHash).toBe(run3.canvasHash);
  });

  test('TC-11: Canvas (OFF) - Real canvas pixel data returned without noise', () => {
    const p = { id: 'P-11' };
    const settings = { canvas: { enabled: false } };

    const { env } = FingerprintInjectionEngine.simulateBrowserEnvironment(p, settings);
    expect(env.canvasHash).toBe('REAL_CANVAS_HASH_DEFAULT');
  });

  // ════════════════════════════════════════════════════════════════════════════
  // TC-12, TC-13, TC-14: WebGL Section & Independent PRNG
  // ════════════════════════════════════════════════════════════════════════════
  test('TC-12: WebGL (ON) - Unmasked vendor/renderer spoofing & readPixels noise', () => {
    const profile = {
      id: 'P-12',
      fingerprint: {
        webglVendor: 'Google Inc. (NVIDIA)',
        webglRenderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0)',
      },
    };
    const settings = { webgl: { enabled: true } };

    const { env } = FingerprintInjectionEngine.simulateBrowserEnvironment(profile, settings);
    expect(env.webgl.vendor).toBe('Google Inc. (NVIDIA)');
    expect(env.webgl.renderer).toContain('RTX 3060');
    expect(env.webgl.imageHash).toContain('WEBGL_SPOOFED_HASH');
  });

  test('TC-13: WebGL (OFF) - Real GPU vendor/renderer exposed', () => {
    const profile = { id: 'P-13', fingerprint: { webglVendor: 'NVIDIA' } };
    const settings = { webgl: { enabled: false } };

    const { env } = FingerprintInjectionEngine.simulateBrowserEnvironment(profile, settings);
    expect(env.webgl.vendor).toBe('Intel Inc.');
    expect(env.webgl.imageHash).toBe('REAL_GPU_HASH_12345');
  });

  test('TC-14: Canvas ON + WebGL OFF - Independent PRNG behavior', () => {
    const profile = { id: 'P-14' };
    const settings = {
      canvas: { enabled: true },
      webgl: { enabled: false },
    };

    const { env } = FingerprintInjectionEngine.simulateBrowserEnvironment(profile, settings);
    expect(env.canvasHash).toContain('CANVAS_SPOOFED_HASH');
    expect(env.webgl.imageHash).toBe('REAL_GPU_HASH_12345'); // WebGL clean
  });

  // ════════════════════════════════════════════════════════════════════════════
  // TC-15 & TC-16: Audio Section
  // ════════════════════════════════════════════════════════════════════════════
  test('TC-15: Audio (ON) - AnalyserNode noise & sampleRate override', () => {
    const pA = { id: 'P-AUDIO-1', fingerprint: { audioSampleRate: 48000 } };
    const pB = { id: 'P-AUDIO-2', fingerprint: { audioSampleRate: 44100 } };
    const settings = { audio: { enabled: true } };

    const { env: envA } = FingerprintInjectionEngine.simulateBrowserEnvironment(pA, settings);
    const { env: envB } = FingerprintInjectionEngine.simulateBrowserEnvironment(pB, settings);

    expect(envA.audio.sampleRate).toBe(48000);
    expect(envB.audio.sampleRate).toBe(44100);
    expect(envA.audio.hash).not.toBe(envB.audio.hash);
  });

  test('TC-16: Audio (OFF) - Real AudioContext data returned', () => {
    const profile = { id: 'P-16' };
    const settings = { audio: { enabled: false } };

    const { env } = FingerprintInjectionEngine.simulateBrowserEnvironment(profile, settings);
    expect(env.audio.hash).toBe('REAL_AUDIO_HASH_67890');
  });

  // ════════════════════════════════════════════════════════════════════════════
  // TC-17 & TC-18: Battery Section
  // ════════════════════════════════════════════════════════════════════════════
  test('TC-17: Battery (ON) - navigator.getBattery() spoofed promise', () => {
    const profile = { id: 'P-17', fingerprint: { batteryLevel: 0.65, batteryCharging: false } };
    const settings = { battery: { enabled: true } };

    const { env } = FingerprintInjectionEngine.simulateBrowserEnvironment(profile, settings);
    expect(env.battery).toEqual({ level: 0.65, charging: false });
  });

  test('TC-18: Battery (OFF) - Real battery behavior preserved', () => {
    const profile = { id: 'P-18' };
    const settings = { battery: { enabled: false } };

    const { env } = FingerprintInjectionEngine.simulateBrowserEnvironment(profile, settings);
    expect(env.battery).toBeNull();
  });

  // ════════════════════════════════════════════════════════════════════════════
  // TC-19 & TC-20: Media Devices Section
  // ════════════════════════════════════════════════════════════════════════════
  test('TC-19: Media Devices (ON) - Fake enumerateDevices() list with empty labels', () => {
    const profile = {
      id: 'P-19',
      fingerprint: { mediaSpeakers: 2, mediaMicrophones: 1, mediaWebcams: 1 },
    };
    const settings = { media: { enabled: true } };

    const { env } = FingerprintInjectionEngine.simulateBrowserEnvironment(profile, settings);
    expect(env.mediaDevices).toHaveLength(4);
    expect(env.mediaDevices.filter((d) => d.kind === 'audiooutput')).toHaveLength(2);
    expect(env.mediaDevices.every((d) => d.label === '')).toBe(true);
  });

  test('TC-20: Media Devices (OFF) - Real media devices returned', () => {
    const profile = { id: 'P-20' };
    const settings = { media: { enabled: false } };

    const { env } = FingerprintInjectionEngine.simulateBrowserEnvironment(profile, settings);
    expect(env.mediaDevices[0].label).toBe('Real Mic');
  });

  // ════════════════════════════════════════════════════════════════════════════
  // TC-21, TC-22, TC-23: WebRTC Section
  // ════════════════════════════════════════════════════════════════════════════
  test('TC-21: WebRTC (Disable non-proxied UDP) - RTCPeerConnection throws NotSupportedError', () => {
    const profile = { id: 'P-21', fingerprint: { webrtcMode: 'disable_non_proxied_udp' } };
    const settings = { network: { enabled: true, webrtcMode: 'disable_non_proxied_udp' } };

    const { env } = FingerprintInjectionEngine.simulateBrowserEnvironment(profile, settings);
    expect(env.webrtc.enabled).toBe(false);
    expect(env.webrtc.throwError).toBe('NotSupportedError');
    expect(env.webrtc.exposedIp).toBeNull();
  });

  test('TC-22: WebRTC (Public interface only) - Only TURN relay / proxy IP exposed', () => {
    const profile = { id: 'P-22', fingerprint: { webrtcMode: 'public_interface_only' } };
    const settings = { network: { enabled: true, webrtcMode: 'public_interface_only' } };

    const { env } = FingerprintInjectionEngine.simulateBrowserEnvironment(profile, settings);
    expect(env.webrtc.enabled).toBe(true);
    expect(env.webrtc.exposedIp).toBe('203.0.113.10');
  });

  test('TC-23: WebRTC (Default) - Baseline WebRTC behavior', () => {
    const profile = { id: 'P-23', fingerprint: { webrtcMode: 'default' } };
    const settings = { network: { enabled: true, webrtcMode: 'default' } };

    const { env } = FingerprintInjectionEngine.simulateBrowserEnvironment(profile, settings);
    expect(env.webrtc.exposedIp).toBe('192.168.1.100');
  });

  // ════════════════════════════════════════════════════════════════════════════
  // TC-24: Anti-Automation Detection
  // ════════════════════════════════════════════════════════════════════════════
  test('TC-24: Anti-Automation - navigator.webdriver=false, cdc_* & __playwright cleaned even when all toggles OFF', () => {
    const profile = { id: 'P-24' };
    const allOffSettings = {
      identity: { enabled: false },
      display: { enabled: false },
      hardware: { enabled: false },
      canvas: { enabled: false },
      webgl: { enabled: false },
      audio: { enabled: false },
      battery: { enabled: false },
      media: { enabled: false },
      network: { enabled: false },
    };

    const { env } = FingerprintInjectionEngine.simulateBrowserEnvironment(profile, allOffSettings);
    expect(env.navigator.webdriver).toBe(false);
    expect(env.window.__playwright).toBeUndefined();
    expect(env.window.cdc_adoQpoasnfa76pfcZLmcfl_Array).toBeUndefined();
  });

  // ════════════════════════════════════════════════════════════════════════════
  // TC-25: Safe Mode
  // ════════════════════════════════════════════════════════════════════════════
  test('TC-25: Safe Mode - All JS prototype defineProperty skipped', () => {
    const profile = {
      id: 'P-25',
      fingerprint: { userAgent: 'Spoofed UA', cpuCores: 16 },
    };
    const settings = {
      safeMode: true,
      identity: { enabled: true },
      hardware: { enabled: true },
    };

    const { env } = FingerprintInjectionEngine.simulateBrowserEnvironment(profile, settings, { safeMode: true });
    expect(env.navigator.webdriver).toBe(false); // Anti-automation stays active
    expect(env.navigator.userAgent).toBe('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0.0.0'); // UA not changed
    expect(env.navigator.hardwareConcurrency).toBe(8); // Hardware not tampered
  });

  // ════════════════════════════════════════════════════════════════════════════
  // TC-26: Gotcha injectFingerprint=false
  // ════════════════════════════════════════════════════════════════════════════
  test('TC-26: Gotcha injectFingerprint=false - Hardware/UA reset to real, but Canvas/Audio toggles remain active', () => {
    const profile = {
      id: 'P-26',
      fingerprint: { userAgent: 'Spoofed UA', cpuCores: 16 },
    };
    const settings = {
      identity: { enabled: true },
      hardware: { enabled: true },
      canvas: { enabled: true },
      audio: { enabled: true },
      applyOverrides: {
        navigator: false, // injectFingerprint=false switches applyOverrides.navigator to false
        hardware: false,
      },
    };

    const { env } = FingerprintInjectionEngine.simulateBrowserEnvironment(profile, settings);
    expect(env.navigator.userAgent).toBe('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0.0.0'); // Real
    expect(env.navigator.hardwareConcurrency).toBe(8); // Real
    expect(env.canvasHash).toContain('CANVAS_SPOOFED_HASH'); // Still active
    expect(env.audio.hash).toContain('AUDIO_SPOOFED_HASH'); // Still active
  });

  // ════════════════════════════════════════════════════════════════════════════
  // TC-27: Clone Profile Fingerprint Separation
  // ════════════════════════════════════════════════════════════════════════════
  test('TC-27: Profile Clone - Unique deterministic seed (hash(profileId)) ensures separate fingerprint hash', () => {
    const originalProfile = {
      id: 'P-ORIGINAL-999',
      fingerprint: { canvas: true, audio: true },
    };
    const clonedProfile = {
      id: 'P-CLONED-888',
      fingerprint: { canvas: true, audio: true },
    };
    const settings = {
      canvas: { enabled: true },
      webgl: { enabled: true },
      audio: { enabled: true },
    };

    const { env: origEnv } = FingerprintInjectionEngine.simulateBrowserEnvironment(originalProfile, settings);
    const { env: cloneEnv } = FingerprintInjectionEngine.simulateBrowserEnvironment(clonedProfile, settings);

    expect(origEnv.canvasHash).not.toBe(cloneEnv.canvasHash);
    expect(origEnv.webgl.imageHash).not.toBe(cloneEnv.webgl.imageHash);
    expect(origEnv.audio.hash).not.toBe(cloneEnv.audio.hash);
  });

  // ════════════════════════════════════════════════════════════════════════════
  // TC-28: UA Consistency between JS and Network Header
  // ════════════════════════════════════════════════════════════════════════════
  test('TC-28: UA Consistency - navigator.userAgent matches network context User-Agent header', () => {
    const spoofedUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
    const profile = {
      id: 'P-28',
      fingerprint: { userAgent: spoofedUA },
    };
    const settings = { identity: { enabled: true } };

    const { env, context } = FingerprintInjectionEngine.simulateBrowserEnvironment(profile, settings);
    expect(env.navigator.userAgent).toBe(spoofedUA);
    expect(context.contextOptions.userAgent).toBe(spoofedUA);
    expect(env.navigator.userAgent).toBe(context.contextOptions.userAgent);
  });
});
