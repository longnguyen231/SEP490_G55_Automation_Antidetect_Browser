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
  startupPage: '',
  windowWidth: 1440,
  windowHeight: 900,
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
      os, browserVersion: bv, userAgent: ua,
      language: loc.code, timezone: loc.timezone,
      screenResolution: screen.res,
      colorDepth: randomFrom([24, 32]),
      pixelRatio,
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
      language: loc.code, timezone: loc.timezone,
      cpuCores, memoryGB: ramGB,
      gpuVendor: gpu.v, gpuRenderer: gpu.r,
      webrtc: randomFrom(['Public + private', 'Default', 'Disable non-proxied UDP', 'Public interface only']),
      mediaDevices: { speakers: randomInt(1, 3), microphones: randomInt(0, 2), webcams: randomInt(0, 1), audio: true, video: true },
      advanced: {
        platform: plat, dnt: false, devicePixelRatio: pixelRatio,
        maxTouchPoints: 0, webglVendor: gpu.v, webglRenderer: gpu.r,
        plugins: randomInt(2, 5), languages: loc.languages
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

/* ═══════════════ Sidebar Tab Definitions ═══════════════ */
const TABS = [
  { id: 'general',  label: 'General',  icon: '⚙' },
  { id: 'identity', label: 'Identity', icon: '👤', toggleable: true },
  { id: 'display',  label: 'Display',  icon: '🖥', toggleable: true },
  { id: 'hardware', label: 'Hardware', icon: '🔧', toggleable: true },
  { id: 'canvas',   label: 'Canvas',   icon: '🎨', toggleable: true },
  { id: 'webgl',    label: 'WebGL',    icon: '🔷', toggleable: true },
  { id: 'audio',    label: 'Audio',    icon: '🔊', toggleable: true },
  { id: 'media',    label: 'Media',    icon: '📷', toggleable: true },
  { id: 'network',  label: 'Network',  icon: '🌐', toggleable: true },
  { id: 'battery',  label: 'Battery',  icon: '🔋', toggleable: true },
];

/* ═══════════════ Main Component ═══════════════ */
function ProfileForm({ profile, onSave, onCancel }) {
  const isEdit = !!profile?.id;
  const [activeTab, setActiveTab] = useState('general');

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    startUrl: 'https://www.google.com',
    active: true,
    cookie: '',
    fingerprint: { ...defaultFingerprint },
    settings: JSON.parse(JSON.stringify(defaultSettings)),
  });

  /* Section toggles — each toggleable tab can be enabled/disabled */
  const [sectionToggles, setSectionToggles] = useState({
    identity: true,
    display: true,
    hardware: true,
    canvas: true,
    webgl: true,
    audio: true,
    media: true,
    network: true,
    battery: true,
  });

  const toggleSection = (id) => setSectionToggles(prev => ({ ...prev, [id]: !prev[id] }));

  const [options, setOptions] = useState({ locales: [], timezones: [] });
  const fallbackLocales = ['vi-VN', 'en-US', 'en-GB', 'fr-FR', 'de-DE', 'es-ES', 'ja-JP', 'ko-KR', 'zh-CN'];
  const fallbackTimezones = ['Asia/Ho_Chi_Minh', 'UTC', 'Asia/Tokyo', 'Asia/Seoul', 'Asia/Singapore', 'Europe/Paris', 'America/New_York'];

  useEffect(() => {
    if (profile) {
      if (!profile.id) {
        const randomConfig = generateConsistentFingerprint();
        setFormData({
          ...profile, cookie: '',
          fingerprint: randomConfig.fingerprint,
          settings: { ...randomConfig.settings, quantity: 1, injectFingerprint: true },
        });
      } else {
        setFormData({
          ...profile, cookie: profile.cookie || '',
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
          if (res.success) setOptions({ locales: (res.locales || []).sort(), timezones: res.timezones || [] });
        }
      } catch { }
    };
    loadOptions();
  }, []);

  /* Helpers */
  const setFp = (field, val) => setFormData(prev => ({ ...prev, fingerprint: { ...prev.fingerprint, [field]: val } }));
  const setS = (field, val) => setFormData(prev => ({ ...prev, settings: { ...prev.settings, [field]: val } }));
  const setAdv = (field, val) => setFormData(prev => ({
    ...prev, settings: { ...prev.settings, advanced: { ...prev.settings.advanced, [field]: val } }
  }));

  const generateFingerprint = () => {
    const randomConfig = generateConsistentFingerprint();
    setFormData(prev => ({
      ...prev,
      fingerprint: { ...prev.fingerprint, ...randomConfig.fingerprint },
      settings: {
        ...prev.settings, ...randomConfig.settings,
        injectFingerprint: prev.settings.injectFingerprint,
        quantity: prev.settings.quantity,
        engine: prev.settings.engine,
      }
    }));
  };

  const handleOsChange = (os) => {
    const bv = formData.fingerprint.browserVersion || '145.0.0.0';
    const plat = os === 'Windows' ? 'Win32' : os === 'macOS' ? 'MacIntel' : 'Linux x86_64';
    let ua;
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
    e?.preventDefault?.();
    const finalSettings = { ...formData.settings };
    if (finalSettings.injectFingerprint === false) {
      finalSettings.applyOverrides = { hardware: false, navigator: false, userAgent: false, webgl: false, language: false, viewport: false, geolocation: false };
    } else {
      delete finalSettings.applyOverrides;
    }
    if (!finalSettings.engine) finalSettings.engine = 'auto';

    const payload = {
      ...formData,
      settings: finalSettings,
      sectionToggles,
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

  /* ═══════════════ Tab Content Renderers ═══════════════ */

  const renderGeneral = () => (
    <>
      <h3 className="pf-section-title">Profile Settings</h3>
      <p className="pf-section-desc">Configure the profile name and fingerprint generation options.</p>

      {/* Profile Name + Quantity */}
      <div className="pf-row pf-row-narrow">
        <div className="pf-field">
          <label className="pf-label">Profile Name</label>
          <input type="text" className="pf-input" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Profile name" />
        </div>
        <div className="pf-field">
          <label className="pf-label">Quantity</label>
          <input type="number" className="pf-input" min={1} value={formData.settings.quantity || 1} onChange={e => setS('quantity', Number(e.target.value))} />
        </div>
      </div>

      {/* Browser Engine */}
      <div className="pf-group">
        <div className="pf-group-title">Browser Engine</div>
        <div className="pf-field">
          <label className="pf-label">Engine</label>
          <select className="pf-select" value={formData.settings.engine || 'auto'} onChange={e => setS('engine', e.target.value)}>
            <option value="playwright">Playwright Chromium</option>
            <option value="playwright-firefox">Playwright Firefox</option>
            <option value="cdp">CDP (system Chrome only)</option>
            <option value="auto">Auto (prefer CDP, fallback Playwright)</option>
          </select>
          <p className="pf-hint">Chromium supports full fingerprint injection. Firefox has limited CDP support.</p>
        </div>
      </div>

      {/* Startup */}
      <div className="pf-group">
        <div className="pf-group-title">Startup</div>
        <div className="pf-field pf-mb">
          <label className="pf-label">Startup Page</label>
          <input type="text" className="pf-input" value={formData.settings.startupPage || formData.startUrl || ''} onChange={e => { setS('startupPage', e.target.value); setFormData(p => ({ ...p, startUrl: e.target.value })); }} placeholder="ex: https://browser.ongloentat.store" />
        </div>
        <div className="pf-row">
          <div className="pf-field">
            <label className="pf-label">Window Width (px)</label>
            <input type="number" className="pf-input" value={formData.settings.windowWidth || 1440} onChange={e => setS('windowWidth', Number(e.target.value))} />
          </div>
          <div className="pf-field">
            <label className="pf-label">Window Height (px)</label>
            <input type="number" className="pf-input" value={formData.settings.windowHeight || 900} onChange={e => setS('windowHeight', Number(e.target.value))} />
          </div>
        </div>
        <p className="pf-hint">Leave width/height at 0 to use the OS default window size.</p>
      </div>

      {/* Quick Generate */}
      <div className="pf-group">
        <div className="pf-group-title">Quick Generate</div>
        <div className="pf-row-3">
          <div className="pf-field">
            <label className="pf-label">OS</label>
            <select className="pf-select" value={formData.fingerprint.os} onChange={e => handleOsChange(e.target.value)}>
              <option value="Windows">Windows</option>
              <option value="macOS">macOS</option>
              <option value="Linux">Linux</option>
            </select>
          </div>
          <div className="pf-field">
            <label className="pf-label">Browser</label>
            <select className="pf-select" value={formData.fingerprint.browser} onChange={e => setFp('browser', e.target.value)}>
              <option value="Chrome">Chrome</option>
              <option value="Firefox">Firefox</option>
              <option value="Edge">Edge</option>
            </select>
          </div>
          <div className="pf-field">
            <label className="pf-label">Device</label>
            <select className="pf-select" value={formData.fingerprint.device || 'Desktop'} onChange={e => setFp('device', e.target.value)}>
              <option value="Desktop">Desktop</option>
              <option value="Mobile">Mobile</option>
            </select>
          </div>
        </div>
        <p className="pf-hint">Fingerprint auto generates when you change these settings.</p>
      </div>
    </>
  );

  const renderIdentity = () => (
    <>
      <ToggleHeader id="identity" label="Identity" desc="User-Agent, platform and locale settings." enabled={sectionToggles.identity} onToggle={() => toggleSection('identity')} />
      <div className={sectionToggles.identity ? '' : 'pf-section-disabled'}>
        <div className="pf-field pf-mb">
          <label className="pf-label">User-Agent</label>
          <textarea className="pf-input" rows={2} value={formData.fingerprint.userAgent} onChange={e => setFp('userAgent', e.target.value)} />
        </div>
        <div className="pf-row">
          <div className="pf-field">
            <label className="pf-label">Platform</label>
            <input type="text" className="pf-input" value={formData.settings.advanced?.platform || 'Win32'} onChange={e => setAdv('platform', e.target.value)} />
          </div>
          <div className="pf-field">
            <label className="pf-label">Locale</label>
            <select className="pf-select" value={formData.settings.language || formData.fingerprint.language} onChange={e => { setS('language', e.target.value); setFp('language', e.target.value); }}>
              {locales.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
        </div>
        <div className="pf-row">
          <div className="pf-field">
            <label className="pf-label">Timezone</label>
            <select className="pf-select" value={formData.settings.timezone || formData.fingerprint.timezone} onChange={e => { setS('timezone', e.target.value); setFp('timezone', e.target.value); }}>
              {timezones.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="pf-field">
            <label className="pf-label">Languages (comma-separated)</label>
            <input type="text" className="pf-input" value={formData.settings.advanced?.languages || formData.fingerprint.language} onChange={e => setAdv('languages', e.target.value)} />
          </div>
        </div>
        <div className="pf-row">
          <div className="pf-field">
            <label className="pf-label">Do Not Track</label>
            <select className="pf-select" value={formData.settings.advanced?.dnt ? '1' : '0'} onChange={e => setAdv('dnt', e.target.value === '1')}>
              <option value="1">Enabled (1)</option>
              <option value="0">Disabled (0)</option>
            </select>
          </div>
          <div className="pf-field">
            <label className="pf-label">Max Touch Points</label>
            <input type="number" className="pf-input" value={formData.fingerprint.maxTouchPoints || 0} onChange={e => setFp('maxTouchPoints', Number(e.target.value))} />
          </div>
        </div>
        <div className="pf-field pf-mb">
          <label className="pf-label">
            Installed Fonts ({(formData.fingerprint.fonts || '').split(',').filter(f => f.trim()).length})
          </label>
          <input type="text" className="pf-input" value={formData.fingerprint.fonts || ''} onChange={e => setFp('fonts', e.target.value)} />
        </div>
      </div>
    </>
  );

  const renderDisplay = () => (
    <>
      <ToggleHeader id="display" label="Display & Screen" desc="Screen resolution, color depth, and device pixel ratio." enabled={sectionToggles.display} onToggle={() => toggleSection('display')} />
      <div className={sectionToggles.display ? '' : 'pf-section-disabled'}>
        {/* Warning banner when enabled */}
        {sectionToggles.display && (
          <div className="pf-warning-banner">
            <span className="pf-warning-icon">⚠</span>
            <span>Enabling Display & Screen injection may trigger Cloudflare bot detection. Disable this category if you need to bypass Cloudflare challenges.</span>
          </div>
        )}
        <div className="pf-field pf-mb">
          <label className="pf-label">Resolution Preset</label>
          <select className="pf-select" value={screenRes} onChange={e => setFp('screenResolution', e.target.value)}>
            <option value="Custom">Custom</option>
            {SCREEN_PRESETS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div className="pf-row">
          <div className="pf-field">
            <label className="pf-label">Width (px)</label>
            <input type="number" className="pf-input" value={screenW} onChange={e => setFp('screenResolution', `${e.target.value}x${screenH}`)} />
          </div>
          <div className="pf-field">
            <label className="pf-label">Height (px)</label>
            <input type="number" className="pf-input" value={screenH} onChange={e => setFp('screenResolution', `${screenW}x${e.target.value}`)} />
          </div>
        </div>
        <div className="pf-row">
          <div className="pf-field">
            <label className="pf-label">Color Depth (bits)</label>
            <input type="number" className="pf-input" value={formData.fingerprint.colorDepth || 32} onChange={e => setFp('colorDepth', Number(e.target.value))} />
          </div>
          <div className="pf-field">
            <label className="pf-label">Pixel Ratio</label>
            <input type="number" step="0.25" className="pf-input" value={formData.fingerprint.pixelRatio || 1} onChange={e => setFp('pixelRatio', Number(e.target.value))} />
          </div>
        </div>
      </div>
    </>
  );

  const renderHardware = () => (
    <>
      <ToggleHeader id="hardware" label="Hardware" desc="CPU, RAM and GPU configuration." enabled={sectionToggles.hardware} onToggle={() => toggleSection('hardware')} />
      <div className={sectionToggles.hardware ? '' : 'pf-section-disabled'}>
        <div className="pf-row">
          <div className="pf-field">
            <label className="pf-label">CPU Cores</label>
            <select className="pf-select" value={formData.settings.cpuCores || 4} onChange={e => setS('cpuCores', Number(e.target.value))}>
              {CPU_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div className="pf-field">
            <label className="pf-label">RAM (GB)</label>
            <select className="pf-select" value={formData.settings.memoryGB || 8} onChange={e => setS('memoryGB', Number(e.target.value))}>
              {RAM_OPTIONS.map(n => <option key={n} value={n}>{n} GB</option>)}
            </select>
          </div>
        </div>
        <div className="pf-field pf-mb">
          <label className="pf-label">GPU Vendor</label>
          <input type="text" className="pf-input" value={formData.settings.gpuVendor || ''} onChange={e => setS('gpuVendor', e.target.value)} />
        </div>
        <div className="pf-field">
          <label className="pf-label">GPU Renderer</label>
          <input type="text" className="pf-input" value={formData.settings.gpuRenderer || ''} onChange={e => setS('gpuRenderer', e.target.value)} />
        </div>
      </div>
    </>
  );

  const renderCanvas = () => (
    <>
      <ToggleHeader id="canvas" label="Canvas" desc="Canvas fingerprint noise settings." enabled={sectionToggles.canvas} onToggle={() => toggleSection('canvas')} />
      <div className={sectionToggles.canvas ? '' : 'pf-section-disabled'}>
        <div className="pf-row">
          <div className="pf-field">
            <label className="pf-label">Noise Seed</label>
            <input type="number" className="pf-input" value={formData.fingerprint.canvasNoise || 577315052} onChange={e => setFp('canvasNoise', e.target.value)} />
          </div>
          <div className="pf-field">
            <label className="pf-label">Noise Intensity (0-10)</label>
            <input type="number" min="0" max="10" className="pf-input" value={formData.fingerprint.canvasNoiseIntensity || 1} onChange={e => setFp('canvasNoiseIntensity', e.target.value)} />
          </div>
        </div>
      </div>
    </>
  );

  const renderWebGL = () => (
    <>
      <ToggleHeader id="webgl" label="WebGL" desc="WebGL fingerprint noise, texture and extensions." enabled={sectionToggles.webgl} onToggle={() => toggleSection('webgl')} />
      <div className={sectionToggles.webgl ? '' : 'pf-section-disabled'}>
        <div className="pf-row">
          <div className="pf-field">
            <label className="pf-label">Noise Seed</label>
            <input type="number" className="pf-input" value={formData.fingerprint.webglNoise || 709233842} onChange={e => setFp('webglNoise', e.target.value)} />
          </div>
          <div className="pf-field">
            <label className="pf-label">MAX_TEXTURE_SIZE</label>
            <input type="number" className="pf-input" value={formData.fingerprint.maxTextureSize || 8192} onChange={e => setFp('maxTextureSize', e.target.value)} />
          </div>
        </div>
        <div className="pf-field">
          <label className="pf-label">Extensions (comma-separated)</label>
          <input type="text" className="pf-input" value={formData.fingerprint.webglExtensions || ''} onChange={e => setFp('webglExtensions', e.target.value)} />
        </div>
      </div>
    </>
  );

  const renderAudio = () => (
    <>
      <ToggleHeader id="audio" label="Audio" desc="AudioContext fingerprint settings." enabled={sectionToggles.audio} onToggle={() => toggleSection('audio')} />
      <div className={sectionToggles.audio ? '' : 'pf-section-disabled'}>
        <div className="pf-row-3">
          <div className="pf-field">
            <label className="pf-label">Sample Rate</label>
            <select className="pf-select" value={formData.fingerprint.audioSampleRate || 96000} onChange={e => setFp('audioSampleRate', Number(e.target.value))}>
              <option value={44100}>44100</option>
              <option value={48000}>48000</option>
              <option value={96000}>96000</option>
            </select>
          </div>
          <div className="pf-field">
            <label className="pf-label">Channels</label>
            <select className="pf-select" value={formData.fingerprint.audioChannels || 'Mono'} onChange={e => setFp('audioChannels', e.target.value)}>
              <option value="Mono">Mono</option>
              <option value="Stereo">Stereo</option>
              <option value="Surround">Surround</option>
            </select>
          </div>
          <div className="pf-field">
            <label className="pf-label">Noise Seed</label>
            <input type="number" className="pf-input" value={formData.fingerprint.audioNoise || 699605402} onChange={e => setFp('audioNoise', e.target.value)} />
          </div>
        </div>
      </div>
    </>
  );

  const renderMedia = () => (
    <>
      <ToggleHeader id="media" label="Media Devices" desc="Speakers, microphones and webcam count." enabled={sectionToggles.media} onToggle={() => toggleSection('media')} />
      <div className={sectionToggles.media ? '' : 'pf-section-disabled'}>
        <div className="pf-row-3">
          <div className="pf-field">
            <label className="pf-label">Speakers</label>
            <input type="number" className="pf-input" value={formData.settings.mediaDevices?.speakers ?? 3} onChange={e => setFormData(p => ({ ...p, settings: { ...p.settings, mediaDevices: { ...p.settings.mediaDevices, speakers: Number(e.target.value) } } }))} />
          </div>
          <div className="pf-field">
            <label className="pf-label">Microphones</label>
            <input type="number" className="pf-input" value={formData.settings.mediaDevices?.microphones ?? 0} onChange={e => setFormData(p => ({ ...p, settings: { ...p.settings, mediaDevices: { ...p.settings.mediaDevices, microphones: Number(e.target.value) } } }))} />
          </div>
          <div className="pf-field">
            <label className="pf-label">Webcams</label>
            <input type="number" className="pf-input" value={formData.settings.mediaDevices?.webcams ?? 0} onChange={e => setFormData(p => ({ ...p, settings: { ...p.settings, mediaDevices: { ...p.settings.mediaDevices, webcams: Number(e.target.value) } } }))} />
          </div>
        </div>
      </div>
    </>
  );

  const renderNetwork = () => (
    <>
      <ToggleHeader id="network" label="Network" desc="WebRTC, connection type, proxy and PDF viewer." enabled={sectionToggles.network} onToggle={() => toggleSection('network')} />
      <div className={sectionToggles.network ? '' : 'pf-section-disabled'}>
        <div className="pf-row">
          <div className="pf-field">
            <label className="pf-label">WebRTC IP Handling</label>
            <select className="pf-select" value={formData.settings.webrtc || 'Public + private'} onChange={e => setS('webrtc', e.target.value)}>
              <option value="Public + private">Public + private</option>
              <option value="Default">Default</option>
              <option value="Disable non-proxied UDP">Disable non-proxied UDP</option>
              <option value="Public interface only">Public interface only</option>
            </select>
          </div>
          <div className="pf-field">
            <label className="pf-label">Connection Type</label>
            <select className="pf-select" value={formData.fingerprint.connectionType || 'Ethernet'} onChange={e => setFp('connectionType', e.target.value)}>
              <option value="Ethernet">Ethernet</option>
              <option value="Wi-Fi">Wi-Fi</option>
              <option value="Cellular">Cellular</option>
              <option value="None">None</option>
            </select>
          </div>
        </div>
        <div className="pf-field pf-mb">
          <label className="pf-label">PDF Viewer</label>
          <select className="pf-select" value={formData.fingerprint.pdfViewer || 'Enabled'} onChange={e => setFp('pdfViewer', e.target.value)}>
            <option value="Enabled">Enabled</option>
            <option value="Disabled">Disabled</option>
          </select>
        </div>

        <div className="pf-divider" />

        <div className="pf-group-title">Proxy</div>
        <label className="pf-checkbox pf-mb">
          <input type="checkbox" checked={formData.settings.proxy?.type !== 'none' && formData.settings.proxy?.type !== undefined} onChange={e => setFormData(p => ({ ...p, settings: { ...p.settings, proxy: { ...p.settings.proxy, type: e.target.checked ? 'http' : 'none' } } }))} />
          <span>Enable proxy for this profile</span>
        </label>
        {formData.settings.proxy?.type && formData.settings.proxy.type !== 'none' && (
          <>
            <div className="pf-row pf-mb">
              <div className="pf-field">
                <label className="pf-label">Type</label>
                <select className="pf-select" value={formData.settings.proxy?.type || 'http'} onChange={e => setFormData(p => ({ ...p, settings: { ...p.settings, proxy: { ...p.settings.proxy, type: e.target.value } } }))}>
                  <option value="http">HTTP</option>
                  <option value="https">HTTPS</option>
                  <option value="socks5">SOCKS5</option>
                </select>
              </div>
              <div className="pf-field">
                <label className="pf-label">Server (host:port)</label>
                <input type="text" className="pf-input" placeholder="192.168.1.1:8080" value={formData.settings.proxy?.server || ''} onChange={e => setFormData(p => ({ ...p, settings: { ...p.settings, proxy: { ...p.settings.proxy, server: e.target.value } } }))} />
              </div>
            </div>
            <div className="pf-row">
              <div className="pf-field">
                <label className="pf-label">Username</label>
                <input type="text" className="pf-input" placeholder="(optional)" value={formData.settings.proxy?.username || ''} onChange={e => setFormData(p => ({ ...p, settings: { ...p.settings, proxy: { ...p.settings.proxy, username: e.target.value } } }))} />
              </div>
              <div className="pf-field">
                <label className="pf-label">Password</label>
                <input type="password" className="pf-input" placeholder="(optional)" value={formData.settings.proxy?.password || ''} onChange={e => setFormData(p => ({ ...p, settings: { ...p.settings, proxy: { ...p.settings.proxy, password: e.target.value } } }))} />
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );

  const renderBattery = () => (
    <>
      <ToggleHeader id="battery" label="Battery" desc="Battery API spoofing settings." enabled={sectionToggles.battery} onToggle={() => toggleSection('battery')} />
      <div className={sectionToggles.battery ? '' : 'pf-section-disabled'}>
        <div className="pf-row">
          <div className="pf-field">
            <label className="pf-label">Charging</label>
            <select className="pf-select" value={formData.fingerprint.batteryCharging || 'No'} onChange={e => setFp('batteryCharging', e.target.value)}>
              <option value="Yes">Yes</option>
              <option value="No">No</option>
            </select>
          </div>
          <div className="pf-field">
            <label className="pf-label">Level (0-1)</label>
            <input type="number" step="0.01" className="pf-input" value={formData.fingerprint.batteryLevel || 0.27} onChange={e => setFp('batteryLevel', Number(e.target.value))} />
          </div>
        </div>
        <div className="pf-row">
          <div className="pf-field">
            <label className="pf-label">Charging Time (s)</label>
            <input type="number" className="pf-input" value={formData.fingerprint.batteryChargingTime || 0} onChange={e => setFp('batteryChargingTime', Number(e.target.value))} />
          </div>
          <div className="pf-field">
            <label className="pf-label">Discharging Time (s)</label>
            <input type="number" className="pf-input" value={formData.fingerprint.batteryDischargingTime || 15789} onChange={e => setFp('batteryDischargingTime', Number(e.target.value))} />
          </div>
        </div>
      </div>
    </>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'general': return renderGeneral();
      case 'identity': return renderIdentity();
      case 'display': return renderDisplay();
      case 'hardware': return renderHardware();
      case 'canvas': return renderCanvas();
      case 'webgl': return renderWebGL();
      case 'audio': return renderAudio();
      case 'media': return renderMedia();
      case 'network': return renderNetwork();
      case 'battery': return renderBattery();
      default: return null;
    }
  };

  /* Determine sidebar dot color for each tab */
  const getDotClass = (tab) => {
    if (tab.id === 'general') return 'neutral';
    return sectionToggles[tab.id] ? 'enabled' : 'disabled';
  };

  return (
    <div className="pf-root">
      {/* ── Header ── */}
      <div className="pf-header">
        <div className="pf-header-left">
          <button type="button" className="pf-back-btn" onClick={onCancel} title="Back">←</button>
          <h2 className="pf-header-title">{isEdit ? 'Edit Profile' : 'New Profile'}</h2>
        </div>
        <div className="pf-header-actions">
          <button type="button" className="pf-btn pf-btn-generate" onClick={generateFingerprint}>
            🔄 Generate
          </button>
          <button type="button" className="pf-btn pf-btn-cancel" onClick={onCancel}>Cancel</button>
          <button type="button" className="pf-btn pf-btn-create" onClick={handleSubmit}>
            {isEdit ? 'Save' : 'Create'}
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="pf-body">
        {/* Sidebar */}
        <nav className="pf-sidebar">
          {TABS.map(tab => (
            <button
              key={tab.id}
              type="button"
              className={`pf-sidebar-item ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className={`pf-sidebar-dot ${getDotClass(tab)}`} />
              <span className="pf-sidebar-icon">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Content */}
        <div className="pf-content">
          {renderTabContent()}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════ Toggle Section Header ═══════════════ */
function ToggleHeader({ id, label, desc, enabled, onToggle }) {
  return (
    <div className="pf-toggle-header">
      <div className="pf-toggle-header-left">
        <h3 className="pf-section-title">{label}</h3>
        <p className="pf-section-desc" style={{ marginBottom: 0 }}>{desc}</p>
      </div>
      <div
        className={`pf-toggle ${enabled ? 'on' : ''}`}
        onClick={onToggle}
        role="switch"
        aria-checked={enabled}
        title={enabled ? 'Click to disable' : 'Click to enable'}
      >
        <div className="pf-toggle-knob" />
      </div>
    </div>
  );
}

export default ProfileForm;
