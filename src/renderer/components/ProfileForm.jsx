import React, { useState, useEffect } from 'react';
import './ProfileForm.css';

/* ═══════════════ Default data ═══════════════ */
const defaultFingerprint = {
  os: 'Windows',
  browser: 'Chrome',
  device: 'Desktop',
  browserVersion: '145.0.0.0',
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
  language: 'vi-VN',
  screenResolution: '1920x1080',
  timezone: 'Asia/Ho_Chi_Minh',
  webgl: true,
  canvas: true,
  audio: true,
  colorDepth: 32,
  pixelRatio: 1,
};

const defaultSettings = {
  cpuCores: 4,
  memoryGB: 8,
  gpuVendor: 'Google Inc. (Microsoft)',
  gpuRenderer: 'ANGLE (Microsoft, Microsoft Basic Render Driver (0x0000008C) Direct3D11 vs_5_0 ps_5_0)',
  proxy: { type: 'none', server: '', username: '', password: '' },
  language: 'vi-VN',
  timezone: 'Asia/Ho_Chi_Minh',
  webrtc: 'Public + private',
  geolocation: { mode: 'ip', latitude: 21.0278, longitude: 105.8342, accuracy: 100, permission: 'ask' },
  mediaDevices: { audio: true, video: true },
  webgl: true,
  headless: false,
  engine: 'auto',
  injectFingerprint: true,
  quantity: 1,
  advanced: {
    platform: 'Win32',
    dnt: false,
    devicePixelRatio: 1,
    maxTouchPoints: 0,
    webglVendor: '',
    webglRenderer: '',
    plugins: 3,
    languages: '',
  },
};

const generateConsistentFingerprint = () => {
  const LOCALES = [
    { code: 'vi-VN', timezone: 'Asia/Ho_Chi_Minh', languages: 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7' },
    { code: 'en-US', timezone: 'America/New_York', languages: 'en-US,en;q=0.9' },
    { code: 'en-GB', timezone: 'Europe/London', languages: 'en-GB,en;q=0.9,en-US;q=0.8' },
    { code: 'fr-FR', timezone: 'Europe/Paris', languages: 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7' },
    { code: 'de-DE', timezone: 'Europe/Berlin', languages: 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7' },
    { code: 'es-ES', timezone: 'Europe/Madrid', languages: 'es-ES,es;q=0.9,en-US;q=0.8,en;q=0.7' },
    { code: 'ja-JP', timezone: 'Asia/Tokyo', languages: 'ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7' },
    { code: 'ko-KR', timezone: 'Asia/Seoul', languages: 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7' },
    { code: 'zh-CN', timezone: 'Asia/Shanghai', languages: 'zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7' },
  ];
  const BROWSERS = ['145.0.0.0', '144.0.0.0', '143.0.0.0', '142.0.0.0', '141.0.0.0', '140.0.0.0', '131.0.6778.205'];
  const OS_LIST = ['Windows', 'macOS', 'Linux'];
  const SCREENS = [
    { res: '1366x768', w: 1366, h: 768, ratios: [1] },
    { res: '1600x900', w: 1600, h: 900, ratios: [1] },
    { res: '1920x1080', w: 1920, h: 1080, ratios: [1, 1.25, 1.5] },
    { res: '2560x1440', w: 2560, h: 1440, ratios: [1, 1.25, 1.5, 2] },
    { res: '3840x2160', w: 3840, h: 2160, ratios: [1.5, 2] },
  ];
  const GPUS = [
    { v: 'Google Inc. (Intel)', r: 'ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11 vs_5_0)' },
    { v: 'Google Inc. (Intel)', r: 'ANGLE (Intel, Intel(R) Iris(R) Xe Graphics Direct3D11 vs_5_0)' },
    { v: 'Google Inc. (NVIDIA)', r: 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1650 Direct3D11 vs_5_0)' },
    { v: 'Google Inc. (NVIDIA)', r: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0)' },
    { v: 'Google Inc. (NVIDIA)', r: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Direct3D11 vs_5_0)' },
    { v: 'Google Inc. (AMD)', r: 'ANGLE (AMD, AMD Radeon RX 580 Direct3D11 vs_5_0)' },
    { v: 'Google Inc. (AMD)', r: 'ANGLE (AMD, AMD Radeon(TM) Graphics Direct3D11 vs_5_0)' }
  ];

  const randomFrom = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

  const loc = randomFrom(LOCALES);
  const bv = randomFrom(BROWSERS);
  const os = randomFrom(OS_LIST);
  const screen = randomFrom(SCREENS);
  const pixelRatio = randomFrom(screen.ratios);
  const gpu = randomFrom(GPUS);
  const cpuCores = randomFrom([2, 4, 6, 8, 12, 16, 24, 32]);
  const ramGB = randomFrom([2, 4, 8, 12, 16, 24, 32, 64]);

  let ua = '';
  const plat = os === 'Windows' ? 'Win32' : os === 'macOS' ? 'MacIntel' : 'Linux x86_64';
  if (os === 'Windows') ua = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${bv} Safari/537.36`;
  else if (os === 'macOS') ua = `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${bv} Safari/537.36`;
  else ua = `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${bv} Safari/537.36`;

  return {
    fingerprint: {
      ...defaultFingerprint,
      os: os,
      browserVersion: bv,
      userAgent: ua,
      language: loc.code,
      timezone: loc.timezone,
      screenResolution: screen.res,
      colorDepth: randomFrom([24, 32]),
      pixelRatio: pixelRatio,
      webglNoise: randomInt(100000000, 2100000000),
      maxTextureSize: randomFrom([4096, 8192, 16384]),
      webglExtensions: randomFrom([
        'EXT_texture_compression_bptc, ANGLE_instanced_arrays, OES_texture_float',
        'ANGLE_instanced_arrays, OES_texture_float, WEBGL_depth_texture, OES_vertex_array_object',
        'EXT_texture_filter_anisotropic, WEBGL_compressed_texture_s3tc, OES_element_index_uint'
      ]),
      canvasNoise: randomInt(100000000, 2100000000),
      canvasNoiseIntensity: randomFrom([1, 2, 3, 4, 5]),
      audioNoise: randomInt(100000000, 2100000000),
      audioSampleRate: randomFrom([44100, 48000, 96000]),
      audioChannels: randomFrom(['Mono', 'Stereo', 'Surround']),
      maxTouchPoints: randomFrom([0, 5, 10]),
      connectionType: randomFrom(['Ethernet', 'Wi-Fi']),
      pdfViewer: 'Enabled',
      batteryCharging: 'No',
      batteryLevel: Number((Math.random() * (1 - 0.1) + 0.1).toFixed(2)),
      batteryChargingTime: 0,
      batteryDischargingTime: randomInt(5000, 20000),
      fonts: 'Cambria, Microsoft New Tai Lue, Constantia, Palatino Linotype, Corbel, SimSu, Arial, Arial Black, Comic Sans MS, Courier New, Georgia, Impact, Lucida Console, Lucida Sans Unicode, Tahoma, Times New Roman, Trebuchet MS, Verdana, Consolas, Segoe UI, Calibri, Candara, Franklin Gothic Medium, Garamond, MS Sans Serif, MS Serif, Symbol, Webdings, Wingdings, MS Gothic, MS Mincho, PMingLiU, MingLiU, SimSun, NSimSun'
    },
    settings: {
      ...JSON.parse(JSON.stringify(defaultSettings)),
      language: loc.code,
      timezone: loc.timezone,
      cpuCores: cpuCores,
      memoryGB: ramGB,
      gpuVendor: gpu.v,
      gpuRenderer: gpu.r,
      webrtc: randomFrom(['Public + private', 'Default', 'Disable non-proxied UDP', 'Public interface only']),
      mediaDevices: { speakers: randomInt(1,3), microphones: randomInt(0,2), webcams: randomInt(0,1), audio: true, video: true },
      advanced: {
        platform: plat,
        dnt: false,
        devicePixelRatio: pixelRatio,
        maxTouchPoints: 0,
        webglVendor: gpu.v,
        webglRenderer: gpu.r,
        plugins: randomInt(2, 5),
        languages: loc.languages
      }
    }
  };
};

const SCREEN_PRESETS = [
  '1024x768', '1280x720', '1280x800', '1366x768', '1440x900',
  '1536x864', '1600x900', '1680x1050', '1920x1080', '1920x1200',
  '2560x1440', '2560x1600', '3840x2160',
];

const CPU_OPTIONS = [2, 4, 6, 8, 12, 16, 24, 32];
const RAM_OPTIONS = [2, 4, 8, 12, 16, 24, 32, 64];

/* ═══════════════ Main Component ═══════════════ */
function ProfileForm({ profile, onSave, onCancel }) {
  const isEdit = !!profile?.id;
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    startUrl: 'https://www.google.com',
    active: true,
    cookie: '',
    fingerprint: { ...defaultFingerprint },
    settings: JSON.parse(JSON.stringify(defaultSettings)),
  });

  const [options, setOptions] = useState({ locales: [], timezones: [] });
  const fallbackLocales = ['vi-VN', 'en-US', 'en-GB', 'fr-FR', 'de-DE', 'es-ES', 'ja-JP', 'ko-KR', 'zh-CN'];
  const fallbackTimezones = ['Asia/Ho_Chi_Minh', 'UTC', 'Asia/Tokyo', 'Asia/Seoul', 'Asia/Singapore', 'Europe/Paris', 'America/New_York'];

  useEffect(() => {
    if (profile) {
      if (!profile.id) {
        // New Profile: Pre-fill random consistent fingerprint
        const randomConfig = generateConsistentFingerprint();
        setFormData({
          ...profile,
          cookie: '',
          fingerprint: randomConfig.fingerprint,
          settings: { ...randomConfig.settings, quantity: 1, injectFingerprint: true },
        });
      } else {
        // Edit Profile
        setFormData({
          ...profile,
          cookie: profile.cookie || '',
          fingerprint: { ...defaultFingerprint, ...profile.fingerprint },
          settings: { ...JSON.parse(JSON.stringify(defaultSettings)), ...(profile.settings || {}) },
        });
      }
    }
  }, [profile]);

  useEffect(() => {
    const loadOptions = async () => {
      try {
        if (window.electronAPI?.getLocalesTimezones) {
          const res = await window.electronAPI.getLocalesTimezones();
          if (res.success) {
            setOptions({ locales: (res.locales || []).sort(), timezones: res.timezones || [] });
          }
        }
      } catch { }
    };
    loadOptions();
  }, []);

  const randomFrom = (arr) => arr[Math.floor(Math.random() * arr.length)];

  const setFp = (field, val) => setFormData(prev => ({ ...prev, fingerprint: { ...prev.fingerprint, [field]: val } }));
  const setS = (field, val) => setFormData(prev => ({ ...prev, settings: { ...prev.settings, [field]: val } }));

  const generateFingerprint = () => {
    const randomConfig = generateConsistentFingerprint();
    setFormData(prev => ({
      ...prev,
      fingerprint: {
        ...prev.fingerprint,
        ...randomConfig.fingerprint
      },
      settings: {
        ...prev.settings,
        ...randomConfig.settings,
        injectFingerprint: prev.settings.injectFingerprint,
        quantity: prev.settings.quantity,
        engine: prev.settings.engine
      }
    }));
  };

  const handleOsChange = (os) => {
    const bv = formData.fingerprint.browserVersion || '145.0.0.0';
    let ua = formData.fingerprint.userAgent;
    const plat = os === 'Windows' ? 'Win32' : os === 'macOS' ? 'MacIntel' : 'Linux x86_64';
    if (os === 'Windows') ua = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${bv} Safari/537.36`;
    else if (os === 'macOS') ua = `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${bv} Safari/537.36`;
    else ua = `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${bv} Safari/537.36`;
    
    setFormData(prev => ({
      ...prev,
      fingerprint: { ...prev.fingerprint, os, userAgent: ua },
      settings: { ...prev.settings, advanced: { ...prev.settings.advanced, platform: plat } }
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Unchecking "Inject fingerprint" disables the backend applyOverrides:
    const finalSettings = { ...formData.settings };
    if (finalSettings.injectFingerprint === false) {
      finalSettings.applyOverrides = { hardware: false, navigator: false, userAgent: false, webgl: false, language: false, viewport: false, geolocation: false };
    } else {
      delete finalSettings.applyOverrides; // Use default backend behavior (all true)
    }

    if (!finalSettings.engine) {
      finalSettings.engine = 'auto'; // Resolve to auto and let backend handle it
    }

    const payload = {
      ...formData,
      settings: finalSettings,
      fingerprint: {
        ...formData.fingerprint,
        language: formData.settings.language || formData.fingerprint.language,
        timezone: formData.settings.timezone || formData.fingerprint.timezone,
      },
    };
    onSave(payload);
  };

  const locales = options.locales?.length ? options.locales : fallbackLocales;
  const timezones = options.timezones?.length ? options.timezones : fallbackTimezones;
  const screenRes = formData.fingerprint.screenResolution || '1920x1080';
  const [screenW, screenH] = screenRes.split('x');

  return (
    <div className="np-container">
      <h2 className="np-title">{isEdit ? 'Edit Profile' : 'New Profile'}</h2>

      <form onSubmit={handleSubmit} className="np-form">
        
        <div className="np-top-fixed">
          {/* Profile & Quick Generate - Fieldset with border */}
          <fieldset className="np-fieldset">
          <legend className="np-legend">Profile & Quick Generate</legend>
          
          <div className="np-row-2 np-mb">
            <div className="np-field np-flex-1">
              <label className="np-label">Name</label>
              <input type="text" className="np-input" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Profile name" />
            </div>
            <div className="np-field np-w-small">
              <label className="np-label">Quantity</label>
              <input type="number" className="np-input" min={1} value={formData.settings.quantity || 1} onChange={e => setS('quantity', Number(e.target.value))} />
            </div>
          </div>

          <label className="np-checkbox np-mb">
            <input type="checkbox" checked={formData.settings.injectFingerprint !== false} onChange={e => setS('injectFingerprint', e.target.checked)} />
            <span style={{ color: 'var(--fg)' }}>
              Inject fingerprint on launch
              {formData.settings.injectFingerprint === false && (
                <span style={{ color: 'var(--warning, #ff9f43)', marginLeft: '0.4rem', fontSize: '0.85rem' }}>
                  (browser runs with default fingerprint)
                </span>
              )}
            </span>
          </label>

          <div className="np-field np-mb">
            <label className="np-label">Visible Engine</label>
            <select className="np-input" value={formData.settings.engine || 'auto'} onChange={e => setS('engine', e.target.value)}>
              <option value="auto">Auto (prefer CDP, fallback to Playwright)</option>
              <option value="cdp">CDP (system Chrome only)</option>
              <option value="playwright">Playwright Chromium</option>
            </select>
          </div>

          <div className="np-row-3 np-mb">
            <div className="np-field">
              <label className="np-label">OS</label>
              <select className="np-input" value={formData.fingerprint.os} onChange={e => handleOsChange(e.target.value)}>
                <option value="Windows">Windows</option>
                <option value="macOS">macOS</option>
                <option value="Linux">Linux</option>
              </select>
            </div>
            <div className="np-field">
              <label className="np-label">Browser</label>
              <select className="np-input" value={formData.fingerprint.browser} onChange={e => setFp('browser', e.target.value)}>
                <option value="Chrome">Chrome</option>
                <option value="Firefox">Firefox</option>
                <option value="Edge">Edge</option>
              </select>
            </div>
            <div className="np-field">
              <label className="np-label">Device</label>
              <select className="np-input" value={formData.fingerprint.device || 'Desktop'} onChange={e => setFp('device', e.target.value)}>
                <option value="Desktop">Desktop</option>
                <option value="Mobile">Mobile</option>
              </select>
            </div>
          </div>

          <button type="button" className="np-btn-blue" onClick={generateFingerprint}>
            Generate Fingerprint
          </button>
          </fieldset>
        </div>

        {/* Scrollable area */}
        <div className="np-scrollable-content">

        {/* Flat fields */}
        <div className="np-field np-mb">
          <label className="np-label">User-Agent</label>
          <textarea className="np-input" rows={2} value={formData.fingerprint.userAgent} onChange={e => setFp('userAgent', e.target.value)} />
        </div>

        <div className="np-row-2 np-mb">
          <div className="np-field">
            <label className="np-label">Platform</label>
            <input type="text" className="np-input" value={formData.settings.advanced?.platform || 'Win32'} onChange={e => setFormData(p => ({ ...p, settings: { ...p.settings, advanced: { ...p.settings.advanced, platform: e.target.value } }}))} />
          </div>
          <div className="np-field">
            <label className="np-label">Locale</label>
            <select className="np-input" value={formData.settings.language || formData.fingerprint.language} onChange={e => { setS('language', e.target.value); setFp('language', e.target.value); }}>
              {locales.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
        </div>

        <div className="np-row-2 np-mb-large">
          <div className="np-field">
            <label className="np-label">Timezone</label>
            <select className="np-input" value={formData.settings.timezone || formData.fingerprint.timezone} onChange={e => { setS('timezone', e.target.value); setFp('timezone', e.target.value); }}>
              {timezones.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="np-field">
            <label className="np-label">Languages (comma-separated)</label>
            <input type="text" className="np-input" value={formData.settings.advanced?.languages || formData.fingerprint.language} onChange={e => setFormData(p => ({ ...p, settings: { ...p.settings, advanced: { ...p.settings.advanced, languages: e.target.value } }}))} />
          </div>
        </div>

        {/* Screen - Fieldset with border */}
        <fieldset className="np-fieldset">
          <legend className="np-legend">Screen</legend>
          
          <div className="np-field np-mb">
            <label className="np-label">Preset</label>
            <select className="np-input" value={screenRes} onChange={e => setFp('screenResolution', e.target.value)}>
              <option value="Custom">Custom</option>
              {SCREEN_PRESETS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          <div className="np-row-2 np-mb">
            <div className="np-field">
              <label className="np-label">Width (px)</label>
              <input type="number" className="np-input" value={screenW} onChange={e => setFp('screenResolution', `${e.target.value}x${screenH}`)} />
            </div>
            <div className="np-field">
              <label className="np-label">Height (px)</label>
              <input type="number" className="np-input" value={screenH} onChange={e => setFp('screenResolution', `${screenW}x${e.target.value}`)} />
            </div>
          </div>

          <div className="np-row-2">
            <div className="np-field">
              <label className="np-label">Color depth</label>
              <input type="number" className="np-input" value={formData.fingerprint.colorDepth || 32} onChange={e => setFp('colorDepth', Number(e.target.value))} />
            </div>
            <div className="np-field">
              <label className="np-label">Pixel ratio</label>
              <input type="number" className="np-input" step="0.25" value={formData.fingerprint.pixelRatio || 1} onChange={e => setFp('pixelRatio', Number(e.target.value))} />
            </div>
          </div>
        </fieldset>

        {/* Hardware Dropdowns */}
        <div className="np-row-2 np-mb np-mt-large">
          <div className="np-field">
            <label className="np-label">CPU cores</label>
            <select className="np-input" value={formData.settings.cpuCores || 4} onChange={e => setS('cpuCores', Number(e.target.value))}>
              {CPU_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div className="np-field">
            <label className="np-label">RAM (GB)</label>
            <select className="np-input" value={formData.settings.memoryGB || 8} onChange={e => setS('memoryGB', Number(e.target.value))}>
              {RAM_OPTIONS.map(n => <option key={n} value={n}>{n} GB</option>)}
            </select>
          </div>
        </div>

        <div className="np-field np-mb">
          <label className="np-label">GPU Vendor</label>
          <input type="text" className="np-input" value={formData.settings.gpuVendor || ''} onChange={e => setS('gpuVendor', e.target.value)} />
        </div>

        <div className="np-field np-mb-large">
          <label className="np-label">GPU Renderer</label>
          <input type="text" className="np-input" value={formData.settings.gpuRenderer || ''} onChange={e => setS('gpuRenderer', e.target.value)} />
        </div>

        {/* Deep fingerprint section */}
        <div className="np-divider">
          <span>deep fingerprint</span>
        </div>

        <CollapsibleSection title="WebGL">
          <div className="np-row-2 np-mb">
            <div className="np-field">
              <label className="np-label">Noise seed</label>
              <input type="number" className="np-input" value={formData.fingerprint.webglNoise || 709233842} onChange={e => setFp('webglNoise', e.target.value)} />
            </div>
            <div className="np-field">
              <label className="np-label">MAX_TEXTURE_SIZE</label>
              <input type="number" className="np-input" value={formData.fingerprint.maxTextureSize || 8192} onChange={e => setFp('maxTextureSize', e.target.value)} />
            </div>
          </div>
          <div className="np-field np-mb-large">
            <label className="np-label">Extensions (comma-separated)</label>
            <input type="text" className="np-input" value={formData.fingerprint.webglExtensions || 'EXT_texture_compression_bptc, ANGLE_instanced_arrays, OES_texture_float'} onChange={e => setFp('webglExtensions', e.target.value)} />
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="Canvas">
          <div className="np-row-2 np-mb-large">
            <div className="np-field">
              <label className="np-label">Noise seed</label>
              <input type="number" className="np-input" value={formData.fingerprint.canvasNoise || 577315052} onChange={e => setFp('canvasNoise', e.target.value)} />
            </div>
            <div className="np-field">
              <label className="np-label">Noise intensity (0-10)</label>
              <input type="number" min="0" max="10" className="np-input" value={formData.fingerprint.canvasNoiseIntensity || 1} onChange={e => setFp('canvasNoiseIntensity', e.target.value)} />
            </div>
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="Audio">
          <div className="np-row-3 np-mb-large">
            <div className="np-field">
              <label className="np-label">Sample rate</label>
              <select className="np-input" value={formData.fingerprint.audioSampleRate || 96000} onChange={e => setFp('audioSampleRate', Number(e.target.value))}>
                <option value={44100}>44100</option>
                <option value={48000}>48000</option>
                <option value={96000}>96000</option>
              </select>
            </div>
            <div className="np-field">
              <label className="np-label">Channels</label>
              <select className="np-input" value={formData.fingerprint.audioChannels || 'Mono'} onChange={e => setFp('audioChannels', e.target.value)}>
                <option value="Mono">Mono</option>
                <option value="Stereo">Stereo</option>
                <option value="Surround">Surround</option>
              </select>
            </div>
            <div className="np-field">
              <label className="np-label">Noise seed</label>
              <input type="number" className="np-input" value={formData.fingerprint.audioNoise || 699605402} onChange={e => setFp('audioNoise', e.target.value)} />
            </div>
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="Media Devices">
          <div className="np-row-3 np-mb-large">
            <div className="np-field">
              <label className="np-label">Speakers</label>
              <input type="number" className="np-input" value={formData.settings.mediaDevices?.speakers ?? 3} onChange={e => setFormData(p => ({ ...p, settings: { ...p.settings, mediaDevices: { ...p.settings.mediaDevices, speakers: Number(e.target.value) } }}))} />
            </div>
            <div className="np-field">
              <label className="np-label">Microphones</label>
              <input type="number" className="np-input" value={formData.settings.mediaDevices?.microphones ?? 0} onChange={e => setFormData(p => ({ ...p, settings: { ...p.settings, mediaDevices: { ...p.settings.mediaDevices, microphones: Number(e.target.value) } }}))} />
            </div>
            <div className="np-field">
              <label className="np-label">Webcams</label>
              <input type="number" className="np-input" value={formData.settings.mediaDevices?.webcams ?? 0} onChange={e => setFormData(p => ({ ...p, settings: { ...p.settings, mediaDevices: { ...p.settings.mediaDevices, webcams: Number(e.target.value) } }}))} />
            </div>
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="Navigator">
          <div className="np-row-2 np-mb">
            <div className="np-field">
              <label className="np-label">Do Not Track</label>
              <select className="np-input" value={formData.settings.advanced?.dnt ? '1' : '0'} onChange={e => setFormData(p => ({ ...p, settings: { ...p.settings, advanced: { ...p.settings.advanced, dnt: e.target.value === '1' } }}))}>
                <option value="1">Enabled (1)</option>
                <option value="0">Disabled (0)</option>
              </select>
            </div>
            <div className="np-field">
              <label className="np-label">Max touch points</label>
              <input type="number" className="np-input" value={formData.fingerprint.maxTouchPoints || 10} onChange={e => setFp('maxTouchPoints', Number(e.target.value))} />
            </div>
          </div>
          <div className="np-row-2 np-mb-large">
            <div className="np-field">
              <label className="np-label">Connection type</label>
              <select className="np-input" value={formData.fingerprint.connectionType || 'Ethernet'} onChange={e => setFp('connectionType', e.target.value)}>
                <option value="Ethernet">Ethernet</option>
                <option value="Wi-Fi">Wi-Fi</option>
                <option value="Cellular">Cellular</option>
                <option value="None">None</option>
              </select>
            </div>
            <div className="np-field">
              <label className="np-label">PDF viewer</label>
              <select className="np-input" value={formData.fingerprint.pdfViewer || 'Enabled'} onChange={e => setFp('pdfViewer', e.target.value)}>
                <option value="Enabled">Enabled</option>
                <option value="Disabled">Disabled</option>
              </select>
            </div>
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="Battery">
          <div className="np-row-2 np-mb">
            <div className="np-field">
              <label className="np-label">Charging</label>
              <select className="np-input" value={formData.fingerprint.batteryCharging || 'No'} onChange={e => setFp('batteryCharging', e.target.value)}>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
            </div>
            <div className="np-field">
              <label className="np-label">Level (0-1)</label>
              <input type="number" step="0.01" className="np-input" value={formData.fingerprint.batteryLevel || 0.27} onChange={e => setFp('batteryLevel', Number(e.target.value))} />
            </div>
          </div>
          <div className="np-row-2 np-mb-large">
            <div className="np-field">
              <label className="np-label">Charging time (s)</label>
              <input type="number" className="np-input" value={formData.fingerprint.batteryChargingTime || 0} onChange={e => setFp('batteryChargingTime', Number(e.target.value))} />
            </div>
            <div className="np-field">
              <label className="np-label">Discharging time (s)</label>
              <input type="number" className="np-input" value={formData.fingerprint.batteryDischargingTime || 15789} onChange={e => setFp('batteryDischargingTime', Number(e.target.value))} />
            </div>
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="WebRTC">
          <div className="np-field np-mb-large">
            <label className="np-label">IP handling policy</label>
            <select className="np-input" value={formData.settings.webrtc || 'Public + private'} onChange={e => setS('webrtc', e.target.value)}>
              <option value="Public + private">Public + private</option>
              <option value="Default">Default</option>
              <option value="Disable non-proxied UDP">Disable non-proxied UDP</option>
              <option value="Public interface only">Public interface only</option>
            </select>
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="Fonts">
          <div className="np-field np-mb-large">
            <label className="np-label">
              Installed fonts ({(formData.fingerprint.fonts || 'Cambria, Microsoft New Tai Lue, Constantia, Palatino Linotype, Corbel, SimSu, Arial, Arial Black, Comic Sans MS, Courier New, Georgia, Impact, Lucida Console, Lucida Sans Unicode, Tahoma, Times New Roman, Trebuchet MS, Verdana, Consolas, Segoe UI, Calibri, Candara, Franklin Gothic Medium, Garamond, MS Sans Serif, MS Serif, Symbol, Webdings, Wingdings, MS Gothic, MS Mincho, PMingLiU, MingLiU, SimSun, NSimSun').split(',').filter(f => f.trim()).length})
            </label>
            <input 
              type="text"
              className="np-input" 
              value={formData.fingerprint.fonts || 'Cambria, Microsoft New Tai Lue, Constantia, Palatino Linotype, Corbel, SimSu, Arial, Arial Black, Comic Sans MS, Courier New, Georgia, Impact, Lucida Console, Lucida Sans Unicode, Tahoma, Times New Roman, Trebuchet MS, Verdana, Consolas, Segoe UI, Calibri, Candara, Franklin Gothic Medium, Garamond, MS Sans Serif, MS Serif, Symbol, Webdings, Wingdings, MS Gothic, MS Mincho, PMingLiU, MingLiU, SimSun, NSimSun'} 
              onChange={e => setFp('fonts', e.target.value)} 
            />
          </div>
        </CollapsibleSection>

        {/* Proxy Section */}
        <div className="np-proxy-container">
          <fieldset className="np-fieldset" style={{ marginTop: '1.5rem', marginBottom: '1.5rem' }}>
            <legend className="np-legend">Proxy</legend>
            <label className="np-checkbox">
              <input type="checkbox" checked={formData.settings.proxy?.type !== 'none' && formData.settings.proxy?.type !== undefined} onChange={e => setFormData(p => ({ ...p, settings: { ...p.settings, proxy: { ...p.settings.proxy, type: e.target.checked ? 'http' : 'none' } }}))} />
              <span style={{ fontSize: '1rem', marginLeft: '0.2rem', color: 'var(--fg)' }}>Enable proxy for this profile</span>
            </label>
          </fieldset>
        </div>

        </div> {/* End scrollable content */}

        {/* Actions footer */}
        <div className="np-actions">
          <button type="button" className="np-btn-cancel" onClick={onCancel}>Cancel</button>
          <button type="submit" className="np-btn-create">{isEdit ? 'Save' : 'Create'}</button>
        </div>
      </form>
    </div>
  );
}

function CollapsibleSection({ title, children }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="np-collapse">
      <button type="button" className="np-collapse-header" onClick={() => setOpen(!open)}>
        <span className="np-collapse-icon">{open ? '▼' : '▶'}</span>
        {title}
      </button>
      {open && <div className="np-collapse-body">{children}</div>}
    </div>
  );
}

export default ProfileForm;
