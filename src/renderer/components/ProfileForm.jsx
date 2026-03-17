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
  webrtc: 'disabled',
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
      setFormData({
        ...profile,
        cookie: profile.cookie || '',
        fingerprint: { ...defaultFingerprint, ...profile.fingerprint },
        settings: { ...JSON.parse(JSON.stringify(defaultSettings)), ...(profile.settings || {}) },
      });
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
    const osList = ['Windows', 'macOS', 'Linux'];
    const pOs = formData.fingerprint.os || randomFrom(osList);
    const locales = options.locales?.length ? options.locales : fallbackLocales;
    const timezones = options.timezones?.length ? options.timezones : fallbackTimezones;
    
    const locale = randomFrom(locales);
    const timezone = randomFrom(timezones);
    const resolution = randomFrom(SCREEN_PRESETS);
    const bv = randomFrom(['145.0.0.0', '145.0.6167.85']);
    
    let ua = '';
    const plat = pOs === 'Windows' ? 'Win32' : pOs === 'macOS' ? 'MacIntel' : 'Linux x86_64';
    if (pOs === 'Windows') ua = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${bv} Safari/537.36`;
    else if (pOs === 'macOS') ua = `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${bv} Safari/537.36`;
    else ua = `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${bv} Safari/537.36`;

    const gpus = [
      { v: 'Google Inc. (Intel)', r: 'ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11 vs_5_0)' },
      { v: 'Google Inc. (NVIDIA)', r: 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1650 Direct3D11 vs_5_0)' },
      { v: 'Google Inc. (AMD)', r: 'ANGLE (AMD, AMD Radeon RX 580 Direct3D11 vs_5_0)' }
    ];
    const gpu = randomFrom(gpus);
    const extraLangs = locales.filter(l => l !== locale).slice(0, 2);

    const webglNoise = Math.floor(Math.random() * 2000000000) + 100000000;
    const maxTextureSize = randomFrom([4096, 8192, 16384]);
    const webglExtensions = randomFrom([
      'EXT_texture_compression_bptc, ANGLE_instanced_arrays, OES_texture_float',
      'ANGLE_instanced_arrays, OES_texture_float, WEBGL_depth_texture, OES_vertex_array_object',
      'EXT_texture_filter_anisotropic, WEBGL_compressed_texture_s3tc, OES_element_index_uint'
    ]);

    setFormData(prev => ({
      ...prev,
      fingerprint: {
        ...prev.fingerprint,
        os: pOs, browserVersion: bv, userAgent: ua, language: locale, timezone,
        screenResolution: resolution, colorDepth: randomFrom([24, 32]), pixelRatio: randomFrom([1, 1.25, 1.5, 2]),
        webglNoise, maxTextureSize, webglExtensions
      },
      settings: {
        ...prev.settings,
        language: locale, timezone, cpuCores: randomFrom(CPU_OPTIONS), memoryGB: randomFrom(RAM_OPTIONS),
        gpuVendor: gpu.v, gpuRenderer: gpu.r,
        advanced: { ...prev.settings.advanced, platform: plat, languages: [locale, ...extraLangs].join(', ') }
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
    const payload = {
      ...formData,
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
              <label className="np-label">Noise mode</label>
              <select className="np-input" value={formData.fingerprint.canvasMode || 'noise'} onChange={e => setFp('canvasMode', e.target.value)}>
                <option value="noise">Noise</option>
                <option value="block">Block</option>
                <option value="off">Off</option>
              </select>
            </div>
            <div className="np-field">
              <label className="np-label">Noise seed</label>
              <input type="number" className="np-input" value={formData.fingerprint.canvasNoise || 34892419} onChange={e => setFp('canvasNoise', e.target.value)} />
            </div>
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="Audio">
          <div className="np-row-2 np-mb-large">
            <div className="np-field">
              <label className="np-label">Noise mode</label>
              <select className="np-input" value={formData.fingerprint.audioMode || 'noise'} onChange={e => setFp('audioMode', e.target.value)}>
                <option value="noise">Noise</option>
                <option value="off">Off</option>
              </select>
            </div>
            <div className="np-field">
              <label className="np-label">Noise seed</label>
              <input type="number" className="np-input" value={formData.fingerprint.audioNoise || 8540321} onChange={e => setFp('audioNoise', e.target.value)} />
            </div>
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="Media Devices">
          <div className="np-row-2 np-mb-large">
            <div className="np-field">
              <label className="np-label">Audio inputs</label>
              <input type="number" className="np-input" value={formData.settings.mediaDevices?.audioCount || 1} onChange={e => setFormData(p => ({ ...p, settings: { ...p.settings, mediaDevices: { ...p.settings.mediaDevices, audioCount: Number(e.target.value) } }}))} />
            </div>
            <div className="np-field">
              <label className="np-label">Video inputs</label>
              <input type="number" className="np-input" value={formData.settings.mediaDevices?.videoCount || 1} onChange={e => setFormData(p => ({ ...p, settings: { ...p.settings, mediaDevices: { ...p.settings.mediaDevices, videoCount: Number(e.target.value) } }}))} />
            </div>
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="Navigator">
          <div className="np-row-2 np-mb-large">
            <div className="np-field">
              <label className="np-label">Hardware Concurrency</label>
              <input type="number" className="np-input" value={formData.settings.cpuCores || 4} onChange={e => setS('cpuCores', Number(e.target.value))} />
            </div>
            <div className="np-field">
              <label className="np-label">Device Memory</label>
              <input type="number" className="np-input" value={formData.settings.memoryGB || 8} onChange={e => setS('memoryGB', Number(e.target.value))} />
            </div>
          </div>
          <div className="np-mb-large">
            <label className="np-checkbox"><input type="checkbox" checked={!!formData.settings.advanced?.dnt} onChange={e => setFormData(p => ({ ...p, settings: { ...p.settings, advanced: { ...p.settings.advanced, dnt: e.target.checked } }}))} /> Do Not Track (DNT)</label>
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="Battery">
          <div className="np-mb-large">
            <label className="np-checkbox"><input type="checkbox" checked={formData.fingerprint.battery !== false} onChange={e => setFp('battery', e.target.checked)} /> Spoof Battery API</label>
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="WebRTC">
          <div className="np-field np-mb-large">
            <label className="np-label">Behavior</label>
            <select className="np-input" value={formData.settings.webrtc || 'disabled'} onChange={e => setS('webrtc', e.target.value)}>
              <option value="disabled">Disabled</option>
              <option value="altered">Altered</option>
              <option value="real">Real</option>
            </select>
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="Fonts">
          <div className="np-mb-large">
            <label className="np-checkbox"><input type="checkbox" checked={formData.fingerprint.fontMasking !== false} onChange={e => setFp('fontMasking', e.target.checked)} /> Enable Font Masking</label>
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
