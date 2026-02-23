import React, { useState, useEffect } from 'react';
import { Shuffle, Save, X, RefreshCw, Lock, Unlock, Copy, ChevronDown } from 'lucide-react';
import { useI18n } from '../i18n/index';
import './ProfileForm.css';

const defaultFingerprint = {
  os: 'Windows',
  browser: 'Chrome',
  browserVersion: '120.0.0.0',
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  language: 'vi-VN',
  screenResolution: '1920x1080',
  timezone: 'Asia/Ho_Chi_Minh',
  webgl: true,
  canvas: true,
  audio: true,
};

const defaultSettings = {
  cpuCores: 4,
  memoryGB: 8,
  proxy: { server: '', username: '', password: '' },
  language: 'vi-VN',
  timezone: 'Asia/Ho_Chi_Minh',
  webrtc: 'default', // default | proxy_only
  geolocation: { latitude: 21.0278, longitude: 105.8342, accuracy: 100 }, // default Hanoi
  mediaDevices: { audio: true, video: true },
  webgl: true,
  headless: false,
  engine: 'playwright',
  cdpApplyInitScript: true,
  applyOverrides: {
    hardware: true,
    navigator: true,
    userAgent: true,
    webgl: true,
    language: true,
    timezone: true,
    viewport: true,
    geolocation: true,
  },
  advanced: {
    platform: 'Win32',
    dnt: false,
    devicePixelRatio: 1,
    maxTouchPoints: 0,
    webglVendor: '',
    webglRenderer: '',
    plugins: 3,
    languages: '', // comma separated, will fallback to primary language if empty
  },
};

function ProfileForm({ profile, onSave, onCancel }) {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState('basic');
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    startUrl: 'https://www.google.com',
    active: true,
    fingerprint: { ...defaultFingerprint },
    settings: { ...defaultSettings },
  });
  const [options, setOptions] = useState({ locales: [], timezones: [] });
  const [presets, setPresets] = useState([]); // generated fingerprint presets
  const [customPresets, setCustomPresets] = useState([]); // user-saved presets
  const [selectedPreset, setSelectedPreset] = useState('');
  const [lockedPreset, setLockedPreset] = useState(false);
  const [presetCount, setPresetCount] = useState(6);
  const isOn = (key) => (formData.settings.applyOverrides?.[key]) !== false;
  // New granular override toggles
  const overrideDefaults = {
    hardware: true,
    navigator: true,
    userAgent: true,
    webgl: true,
    language: true,
    timezone: true,
    viewport: true,
    geolocation: true,
  };

  const fallbackLocales = ['vi-VN', 'en-US', 'en-GB', 'fr-FR', 'de-DE', 'es-ES', 'it-IT', 'ja-JP', 'ko-KR', 'zh-CN'];
  const fallbackTimezones = ['Asia/Ho_Chi_Minh', 'UTC', 'Asia/Tokyo', 'Asia/Seoul', 'Asia/Singapore', 'Europe/Paris', 'Europe/Berlin', 'Europe/London', 'America/New_York'];

  useEffect(() => {
    if (profile) {
      setFormData({
        ...profile,
        fingerprint: { ...defaultFingerprint, ...profile.fingerprint },
        settings: { ...defaultSettings, ...(profile.settings || {}) },
      });
    }
  }, [profile]);

  useEffect(() => {
    const loadOptions = async () => {
      try {
        if (window.electronAPI?.getLocalesTimezones) {
          const res = await window.electronAPI.getLocalesTimezones();
          if (res.success) {
            const locales = (res.locales || []).slice().sort((a, b) => a.localeCompare(b));
            setOptions({ locales, timezones: res.timezones || [] });
          }
        }
        if (window.electronAPI?.listPresets) {
          const list = await window.electronAPI.listPresets();
          if (list?.success && Array.isArray(list.presets)) setCustomPresets(list.presets);
        }
      } catch (e) { /* ignore */ }
    };
    loadOptions();
  }, []);

  // Helper to build one fingerprint preset (does not mutate state)
  const buildFingerprintPreset = () => {
    const osList = ['Windows', 'macOS', 'Linux'];
    const browserList = ['Chrome', 'Edge', 'Firefox'];
    const resolutions = [
      '1024x768', '1280x720', '1280x800', '1360x768', '1366x768', '1440x900', '1536x864',
      '1600x900', '1680x1050', '1920x1080', '1920x1200', '2560x1440', '2560x1600',
      '2880x1800', '3000x2000', '3200x1800', '3440x1440', '3840x2160'
    ];
    const locales = (options.locales?.length ? options.locales : fallbackLocales);
    const timezones = (options.timezones?.length ? options.timezones : fallbackTimezones);
    const os = randomFrom(osList);
    const browser = randomFrom(browserList);
    const language = randomFrom(locales);
    const timezone = randomFrom(timezones);
    const screenResolution = randomFrom(resolutions);
    const chromeVers = ['119.0.6045.200', '120.0.0.0', '121.0.6167.85', '122.0.6261.70'];
    const firefoxVers = ['118.0', '119.0', '120.0', '121.0'];
    const edgeVers = ['119.0.2151.44', '120.0.2210.61', '121.0.2277.98'];
    let browserVersion = '120.0.0.0';
    let ua = '';
    const macTokens = ['10_15_7', '11_6', '12_7_1', '13_6_1'];
    if (browser === 'Chrome') {
      browserVersion = randomFrom(chromeVers);
      if (os === 'Windows') ua = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${browserVersion} Safari/537.36`;
      else if (os === 'macOS') ua = `Mozilla/5.0 (Macintosh; Intel Mac OS X ${randomFrom(macTokens)}) AppleWebKit/605.1.15 (KHTML, like Gecko) Chrome/${browserVersion} Safari/537.36`;
      else ua = `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${browserVersion} Safari/537.36`;
    } else if (browser === 'Edge') {
      browserVersion = randomFrom(edgeVers);
      if (os === 'Windows') ua = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${browserVersion} Safari/537.36 Edg/${browserVersion}`;
      else if (os === 'macOS') ua = `Mozilla/5.0 (Macintosh; Intel Mac OS X ${randomFrom(macTokens)}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${browserVersion} Safari/537.36 Edg/${browserVersion}`;
      else ua = `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${browserVersion} Safari/537.36 Edg/${browserVersion}`;
    } else {
      const ver = randomFrom(firefoxVers);
      browserVersion = ver;
      if (os === 'Windows') ua = `Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:${ver}) Gecko/20100101 Firefox/${ver}`;
      else if (os === 'macOS') ua = `Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:${ver}) Gecko/20100101 Firefox/${ver}`;
      else ua = `Mozilla/5.0 (X11; Linux x86_64; rv:${ver}) Gecko/20100101 Firefox/${ver}`;
    }
    const platform = os === 'Windows' ? 'Win32' : (os === 'macOS' ? 'MacIntel' : 'Linux x86_64');
    const devicePixelRatio = randomFrom([0.75, 1, 1.25, 1.5, 2, 2.5, 3]);
    const maxTouchPoints = randomFrom([0, 1, 2, 3]);
    const dnt = randomBool(0.2);
    const webglPairs = [
      { vendor: 'Intel Inc.', renderer: 'Intel(R) UHD Graphics 620' },
      { vendor: 'Intel Inc.', renderer: 'Intel(R) Iris(R) Xe Graphics' },
      { vendor: 'NVIDIA Corporation', renderer: 'NVIDIA GeForce GTX 1650' },
      { vendor: 'NVIDIA Corporation', renderer: 'NVIDIA GeForce RTX 3060' },
      { vendor: 'AMD', renderer: 'Radeon RX 580' },
      { vendor: 'AMD', renderer: 'Radeon RX 6600' },
      { vendor: 'Apple', renderer: 'Apple M1' },
      { vendor: '', renderer: '' },
    ];
    const wgl = randomFrom(webglPairs);
    const plugins = randomFrom([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    // Accept-Language style list: primary plus 1-2 extras
    const extraLangsPool = locales.filter(l => l !== language);
    const extras = [randomFrom(extraLangsPool), randomBool(0.5) ? randomFrom(extraLangsPool) : null]
      .filter(Boolean)
      .slice(0, randomFrom([0, 1, 2]));
    const languages = [language, ...extras].join(',');
    // Geo baseline
    const geoCities = [
      { name: 'Hanoi', lat: 21.0278, lon: 105.8342 },
      { name: 'Ho_Chi_Minh', lat: 10.8231, lon: 106.6297 },
      { name: 'Bangkok', lat: 13.7563, lon: 100.5018 },
      { name: 'Singapore', lat: 1.3521, lon: 103.8198 },
      { name: 'Tokyo', lat: 35.6762, lon: 139.6503 }
    ];
    const city = randomFrom(geoCities);
    const latitude = city.lat, longitude = city.lon, accuracy = randomFrom([30, 50, 75, 100]);
    return {
      label: `${os} · ${browser} ${browserVersion} · ${language} · ${screenResolution}`,
      fingerprint: {
        os,
        browser,
        browserVersion,
        userAgent: ua,
        language,
        screenResolution,
        timezone,
        webgl: true,
        canvas: randomBool(0.9),
        audio: randomBool(0.9),
      },
      settingsPatch: {
        language,
        timezone,
        geolocation: { latitude, longitude, accuracy },
        advanced: {
          platform,
          dnt,
          devicePixelRatio,
          maxTouchPoints,
          webglVendor: wgl.vendor,
          webglRenderer: wgl.renderer,
          plugins,
          languages,
        },
      },
    };
  };

  const regeneratePresets = (count = presetCount) => {
    const list = Array.from({ length: count }, () => buildFingerprintPreset());
    setPresets(list);
    setSelectedPreset('');
  };

  useEffect(() => {
    regeneratePresets(presetCount);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.locales.length, options.timezones.length, presetCount]);

  // Enforce browser list based on engine selection
  useEffect(() => {
    const engine = formData.settings.engine;
    const allowed = engine === 'playwright' ? ['Chrome', 'Firefox'] : ['Chrome', 'Edge'];
    if (!allowed.includes(formData.fingerprint.browser)) {
      setFormData(prev => ({ ...prev, fingerprint: { ...prev.fingerprint, browser: allowed[0] } }));
    }
  }, [formData.settings.engine]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleFingerprintChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      fingerprint: {
        ...prev.fingerprint,
        [name]: type === 'checkbox' ? checked : value,
      },
    }));
  };

  const handleSettingsChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        [name]: type === 'checkbox' ? checked : value,
      },
    }));
  };

  // Automation UI removed per request; related handlers deleted

  const handleNestedSettingsChange = (section, field, parser = (v) => v) => (e) => {
    const { value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        [section]: {
          ...prev.settings[section],
          [field]: type === 'checkbox' ? checked : parser(value),
        },
      },
    }));
  };

  const handleOsChange = (e) => {
    const os = e.target.value;
    let userAgent = formData.fingerprint.userAgent;

    // Update user agent based on OS
    if (os === 'Windows') {
      userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    } else if (os === 'macOS') {
      userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    } else if (os === 'Linux') {
      userAgent = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    }

    setFormData((prev) => ({
      ...prev,
      fingerprint: {
        ...prev.fingerprint,
        os,
        userAgent,
      },
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('Please enter a profile name');
      return;
    }
    // Sync language/timezone to both fingerprint and settings for backward compatibility
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

  const randomFrom = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const randomBool = (p = 0.5) => Math.random() < p;
  const randomize = () => {
    const osList = ['Windows', 'macOS', 'Linux'];
    const browserList = ['Chrome', 'Edge', 'Firefox'];
    const resolutions = [
      '1024x768', '1280x720', '1280x800', '1360x768', '1366x768', '1440x900', '1536x864',
      '1600x900', '1680x1050', '1920x1080', '1920x1200', '2560x1440', '2560x1600',
      '2880x1800', '3000x2000', '3200x1800', '3440x1440', '3840x2160'
    ];
    const locales = (options.locales?.length ? options.locales : fallbackLocales);
    const timezones = (options.timezones?.length ? options.timezones : fallbackTimezones);

    const os = randomFrom(osList);
    const browser = randomFrom(browserList);
    const language = randomFrom(locales);
    const timezone = randomFrom(timezones);
    const screenResolution = randomFrom(resolutions);

    // Basic UA generator (more variety)
    const chromeVers = ['119.0.6045.200', '120.0.0.0', '121.0.6167.85', '122.0.6261.70'];
    const firefoxVers = ['118.0', '119.0', '120.0', '121.0'];
    const edgeVers = ['119.0.2151.44', '120.0.2210.61', '121.0.2277.98'];
    let browserVersion = '120.0.0.0';
    let ua = '';
    const macTokens = ['10_15_7', '11_6', '12_7_1', '13_6_1'];
    if (browser === 'Chrome') {
      browserVersion = randomFrom(chromeVers);
      if (os === 'Windows') ua = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${browserVersion} Safari/537.36`;
      else if (os === 'macOS') ua = `Mozilla/5.0 (Macintosh; Intel Mac OS X ${randomFrom(macTokens)}) AppleWebKit/605.1.15 (KHTML, like Gecko) Chrome/${browserVersion} Safari/537.36`;
      else ua = `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${browserVersion} Safari/537.36`;
    } else if (browser === 'Edge') {
      browserVersion = randomFrom(edgeVers);
      if (os === 'Windows') ua = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${browserVersion} Safari/537.36 Edg/${browserVersion}`;
      else if (os === 'macOS') ua = `Mozilla/5.0 (Macintosh; Intel Mac OS X ${randomFrom(macTokens)}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${browserVersion} Safari/537.36 Edg/${browserVersion}`;
      else ua = `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${browserVersion} Safari/537.36 Edg/${browserVersion}`;
    } else {
      // Firefox UA
      browserVersion = randomFrom(firefoxVers);
      if (os === 'Windows') ua = `Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:${browserVersion}) Gecko/20100101 Firefox/${browserVersion}`;
      else if (os === 'macOS') ua = `Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:${browserVersion}) Gecko/20100101 Firefox/${browserVersion}`;
      else ua = `Mozilla/5.0 (X11; Linux x86_64; rv:${browserVersion}) Gecko/20100101 Firefox/${browserVersion}`;
    }

    // Advanced defaults by OS
    const platform = os === 'Windows' ? 'Win32' : (os === 'macOS' ? 'MacIntel' : 'Linux x86_64');
    const devicePixelRatio = randomFrom([0.75, 1, 1.25, 1.5, 2, 2.5, 3]);
    const maxTouchPoints = randomFrom([0, 1, 2, 3]);
    const dnt = randomBool(0.2);
    const webglPairs = [
      { vendor: 'Intel Inc.', renderer: 'Intel(R) UHD Graphics 620' },
      { vendor: 'Intel Inc.', renderer: 'Intel(R) Iris(R) Xe Graphics' },
      { vendor: 'NVIDIA Corporation', renderer: 'NVIDIA GeForce GTX 1650' },
      { vendor: 'NVIDIA Corporation', renderer: 'NVIDIA GeForce RTX 3060' },
      { vendor: 'AMD', renderer: 'Radeon RX 580' },
      { vendor: 'AMD', renderer: 'Radeon RX 6600' },
      { vendor: 'Apple', renderer: 'Apple M1' },
      { vendor: '', renderer: '' },
    ];
    const wgl = randomFrom(webglPairs);
    const plugins = randomFrom([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    const extraLangsPool = (options.locales?.length ? options.locales : fallbackLocales).filter(l => l !== language);
    const extras = [randomFrom(extraLangsPool), randomBool(0.5) ? randomFrom(extraLangsPool) : null]
      .filter(Boolean)
      .slice(0, randomFrom([0, 1, 2]));
    const languages = [language, ...extras].join(',');

    // Geo: enable ~30% hoặc nếu timezone là Asia/Ho_Chi_Minh thì enable với toạ độ Hà Nội
    let geoEnabled = randomBool(0.3) || timezone === 'Asia/Ho_Chi_Minh';
    const geoCities = [
      { name: 'Hanoi', lat: 21.0278, lon: 105.8342 },
      { name: 'Ho_Chi_Minh', lat: 10.8231, lon: 106.6297 },
      { name: 'Bangkok', lat: 13.7563, lon: 100.5018 },
      { name: 'Singapore', lat: 1.3521, lon: 103.8198 },
      { name: 'Tokyo', lat: 35.6762, lon: 139.6503 }
    ];
    let latitude = 21.0278, longitude = 105.8342, accuracy = 100;
    if (!geoEnabled && randomBool(0.2)) geoEnabled = true; // thêm chút xác suất
    if (geoEnabled) {
      const c = randomFrom(geoCities);
      latitude = c.lat; longitude = c.lon; accuracy = randomFrom([30, 50, 75, 100]);
    }

    setFormData(prev => ({
      ...prev,
      fingerprint: {
        ...prev.fingerprint,
        os,
        browser,
        browserVersion,
        userAgent: ua,
        language,
        screenResolution,
        timezone,
        webgl: randomBool(0.95),
        canvas: randomBool(0.9),
        audio: randomBool(0.9),
      },
      settings: {
        ...prev.settings,
        language,
        timezone,
        cpuCores: randomFrom([4, 6, 8]),
        memoryGB: randomFrom([8, 12, 16, 24, 32]),
        webrtc: randomBool(0.3) ? 'proxy_only' : 'default',
        mediaDevices: { audio: randomBool(0.8), video: randomBool(0.6) },
        geolocation: { enabled: geoEnabled, latitude, longitude, accuracy },
        webgl: randomBool(0.95),
        advanced: {
          ...(prev.settings.advanced || {}),
          platform,
          dnt,
          devicePixelRatio,
          maxTouchPoints,
          webglVendor: wgl.vendor,
          webglRenderer: wgl.renderer,
          plugins,
          languages,
        },
      },
    }));
  };

  // Reusable region wrapper: checkbox + collapsible content
  const RegionBlock = ({ flag, label, hint, children }) => {
    const enabled = (formData.settings.applyOverrides?.[flag]) !== false;
    return (
      <div className="region-block" data-flag={flag}>
        <div className="region-block-header">
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                settings: {
                  ...prev.settings,
                  applyOverrides: { ...(prev.settings.applyOverrides || {}), [flag]: e.target.checked }
                }
              }))}
            />
            <span>{label}</span>
          </label>
          {hint && <div className="form-hint" style={{ marginTop: '0.25rem' }}>{hint}</div>}
        </div>
        {enabled && (
          <div className="region-block-body">
            {children}
          </div>
        )}
      </div>
    );
  };

  const TABS = [
    { id: 'basic', labelKey: 'pf.tab.basic' },
    { id: 'fingerprint', labelKey: 'pf.tab.fingerprint' },
    { id: 'environment', labelKey: 'pf.tab.environment' },
    { id: 'advanced', labelKey: 'pf.tab.advanced' },
  ];

  return (
    <div className="profile-form-container">
      <div className="profile-form-header">
        <h2>{profile ? t('profileForm.header.edit') : t('profileForm.header.create')}</h2>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button type="button" className="btn" onClick={randomize} disabled={lockedPreset}>
            <Shuffle size={14} /> {t('profileForm.randomize')}
          </button>
          <button
            type="submit"
            form="profile-edit-form"
            className="btn btn-primary"
          >
            <Save size={14} /> {profile ? t('profileForm.save') : t('profileForm.create')}
          </button>
          <button className="btn btn-icon" onClick={onCancel}>
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="pf-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`pf-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {t(tab.labelKey)}
          </button>
        ))}
      </div>

      <form id="profile-edit-form" onSubmit={handleSubmit} className="profile-form">

        {/* ===== TAB: BASIC ===== */}
        {activeTab === 'basic' && (
          <section className="form-section">
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="name">{t('pf.name')}</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder={t('pf.name.ph')}
                  required
                />
                <div className="form-hint">{t('pf.name.hint')}</div>
              </div>

              <div className="form-group">
                <label htmlFor="startUrl">{t('pf.startUrl')}</label>
                <input
                  type="url"
                  id="startUrl"
                  name="startUrl"
                  value={formData.startUrl}
                  onChange={handleChange}
                  placeholder="https://www.google.com"
                />
                <div className="form-hint">{t('pf.startUrl.hint')}</div>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="description">{t('pf.description')}</label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder={t('pf.description.ph')}
                rows="3"
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="engine">{t('pf.engine')}</label>
                <select id="engine" name="engine" value={formData.settings.engine} onChange={handleSettingsChange}>
                  <option value="playwright">Playwright</option>
                  <option value="cdp">Chrome (CDP)</option>
                </select>
                <div className="form-hint">{t('pf.engine.hint')}</div>
              </div>
              {formData.settings.engine === 'cdp' && (
                <div className="form-group">
                  <label>{t('pf.cdpInit')}</label>
                  <div className="checkbox-group">
                    <label>
                      <input
                        type="checkbox"
                        name="cdpApplyInitScript"
                        checked={formData.settings.cdpApplyInitScript !== false}
                        onChange={(e) => handleSettingsChange({ target: { name: 'cdpApplyInitScript', type: 'checkbox', checked: e.target.checked } })}
                      />
                      <span>{t('pf.cdpInit.enable')}</span>
                    </label>
                  </div>
                  <div className="form-hint">{t('pf.cdpInit.hint')}</div>
                </div>
              )}
              {formData.settings.engine === 'playwright' && (
                <div className="form-group">
                  <label htmlFor="headless">{t('pf.headless')}</label>
                  <select
                    id="headless"
                    name="headless"
                    value={String(!!formData.settings.headless)}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      settings: { ...prev.settings, headless: e.target.value === 'true' }
                    }))}
                  >
                    <option value="false">{t('pf.headless.show')}</option>
                    <option value="true">{t('pf.headless.hide')}</option>
                  </select>
                  <div className="form-hint">{t('pf.headless.hint')}</div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ===== TAB: FINGERPRINT ===== */}
        {activeTab === 'fingerprint' && (
          <section className="form-section">
            {/* Preset toolbar */}
            <div className="preset-bar">
              <div className="preset-select">
                <label htmlFor="fp_preset">{t('pf.fp.preset')}</label>
                <select
                  id="fp_preset"
                  value={selectedPreset}
                  disabled={lockedPreset}
                  onChange={(e) => {
                    const raw = e.target.value;
                    setSelectedPreset(raw);
                    let p = null;
                    if (raw && raw.startsWith('c:')) {
                      const id = raw.slice(2);
                      p = customPresets.find(x => x.id === id);
                    } else {
                      const idx = Number(raw);
                      if (!Number.isNaN(idx) && presets[idx]) p = presets[idx];
                    }
                    if (p) {
                      setFormData(prev => ({
                        ...prev,
                        fingerprint: { ...prev.fingerprint, ...p.fingerprint },
                        settings: {
                          ...prev.settings,
                          language: p.settingsPatch.language,
                          timezone: p.settingsPatch.timezone,
                          geolocation: { ...(prev.settings.geolocation || {}), ...(p.settingsPatch.geolocation || {}) },
                          advanced: { ...(prev.settings.advanced || {}), ...(p.settingsPatch.advanced || {}) },
                        }
                      }));
                    }
                  }}
                >
                  <option value="">{t('pf.fp.suggestions')}</option>
                  {presets.map((p, i) => (
                    <option key={i} value={i}>{p.label}</option>
                  ))}
                  {customPresets.length > 0 && (
                    <optgroup label={t('pf.fp.customPresets')}>
                      {customPresets.map(p => {
                        const fp = p.fingerprint || {};
                        const sum = [fp.browser && (fp.browser + (fp.browserVersion ? ` ${fp.browserVersion}` : '')),
                        fp.language,
                        fp.screenResolution].filter(Boolean).join(' · ');
                        const text = [p.name || p.label || 'Custom', sum ? `(${sum})` : ''].filter(Boolean).join(' ');
                        return (
                          <option key={p.id} value={`c:${p.id}`}>{text}</option>
                        );
                      })}
                    </optgroup>
                  )}
                </select>
              </div>

              <div className="preset-actions" aria-label="Preset actions">
                <label className="preset-count" title="Count">
                  <span>×</span>
                  <select value={presetCount} onChange={(e) => setPresetCount(Number(e.target.value))}>
                    <option value={3}>3</option>
                    <option value={6}>6</option>
                    <option value={9}>9</option>
                  </select>
                </label>
                <button
                  type="button"
                  className={`btn btn-icon ${lockedPreset ? 'disabled' : ''}`}
                  onClick={() => !lockedPreset && regeneratePresets(presetCount)}
                  title={t('pf.fp.regenerate')}
                  disabled={lockedPreset}
                >
                  <RefreshCw size={14} />
                </button>
                <button
                  type="button"
                  className="btn btn-icon"
                  title={t('pf.fp.savePreset')}
                  onClick={async () => {
                    const name = prompt('Preset name:');
                    if (!name) return;
                    const preset = {
                      name,
                      label: name,
                      fingerprint: { ...formData.fingerprint },
                      settingsPatch: {
                        language: formData.settings.language,
                        timezone: formData.settings.timezone,
                        geolocation: { ...(formData.settings.geolocation || {}) },
                        advanced: { ...(formData.settings.advanced || {}) },
                      },
                    };
                    try {
                      const res = await window.electronAPI?.addPreset?.(preset);
                      if (res?.success && res.preset) {
                        setCustomPresets(prev => [...prev, res.preset]);
                      }
                    } catch { }
                  }}
                >
                  <Save size={14} />
                </button>
                <button
                  type="button"
                  className={`btn btn-icon ${lockedPreset ? 'active' : ''}`}
                  onClick={() => setLockedPreset(v => !v)}
                  title={lockedPreset ? 'Unlock presets' : 'Lock presets'}
                >
                  {lockedPreset ? <Lock size={14} /> : <Unlock size={14} />}
                </button>
              </div>

              {selectedPreset !== '' && (
                <div className="preset-note" title="Current preset label">
                  {(() => {
                    let label = '';
                    const raw = selectedPreset;
                    if (raw && String(raw).startsWith('c:')) {
                      const id = String(raw).slice(2);
                      const p = customPresets.find(x => x.id === id);
                      label = p ? (p.name || p.label || '') : '';
                    } else {
                      const idx = Number(raw);
                      const p = (!Number.isNaN(idx) && presets[idx]) ? presets[idx] : null;
                      label = p ? p.label : '';
                    }
                    return label ? (<span className="badge">{label}</span>) : null;
                  })()}
                </div>
              )}
            </div>
            <div className="form-hint" style={{ marginTop: '-0.25rem' }}>{t('pf.fp.presetHint')}</div>

            <div className="form-row-3">
              <div className="form-group">
                <label htmlFor="os">{t('pf.fp.os')}</label>
                <select id="os" name="os" value={formData.fingerprint.os} onChange={handleOsChange}>
                  <option value="Windows">Windows</option>
                  <option value="macOS">macOS</option>
                  <option value="Linux">Linux</option>
                </select>
                <div className="form-hint">{t('pf.fp.os.hint')}</div>
              </div>

              <div className="form-group">
                <label htmlFor="browser">{t('pf.fp.browser')}</label>
                <select
                  id="browser"
                  name="browser"
                  value={formData.fingerprint.browser}
                  onChange={handleFingerprintChange}
                >
                  {(formData.settings.engine === 'playwright' ? ['Chrome', 'Firefox'] : ['Chrome', 'Edge']).map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
                <div className="form-hint">{t('pf.fp.browser.hint')}</div>
              </div>

              <div className="form-group">
                <label htmlFor="browserVersion">{t('pf.fp.browserVer')}</label>
                <input
                  type="text"
                  id="browserVersion"
                  name="browserVersion"
                  value={formData.fingerprint.browserVersion}
                  onChange={handleFingerprintChange}
                  placeholder="120.0.0.0"
                />
                <div className="form-hint">{t('pf.fp.browserVer.hint')}</div>
              </div>
            </div>

            <RegionBlock flag="userAgent" label={t('pf.fp.ua')} hint={t('pf.fp.ua.hint')}>
              <div className="form-group" style={{ marginTop: '0.5rem' }}>
                <label htmlFor="userAgent" style={{ fontWeight: 500 }}>{t('pf.fp.ua.str')}</label>
                <textarea
                  id="userAgent"
                  name="userAgent"
                  value={formData.fingerprint.userAgent}
                  onChange={handleFingerprintChange}
                  placeholder="Enter custom user agent"
                  rows="2"
                  disabled={(formData.settings.applyOverrides?.userAgent) === false}
                />
                <div style={{ marginTop: '0.25rem' }}>
                  <button
                    type="button"
                    className="btn"
                    onClick={async () => {
                      try { await navigator.clipboard.writeText(formData.fingerprint.userAgent || ''); }
                      catch { }
                    }}
                  >
                    <Copy size={13} /> {t('pf.fp.ua.copy')}
                  </button>
                </div>
              </div>
            </RegionBlock>

            <RegionBlock flag="language" label={t('pf.fp.lang')} hint={t('pf.fp.lang.hint')}>
              <div className="form-group">
                <label htmlFor="language">{t('pf.fp.lang.primary')}</label>
                <select
                  id="language"
                  name="language"
                  value={formData.settings.language}
                  onChange={(e) => { handleSettingsChange(e); setFormData(prev => ({ ...prev, fingerprint: { ...prev.fingerprint, language: e.target.value } })); }}
                  disabled={(formData.settings.applyOverrides?.language) === false}
                >
                  {options.locales && options.locales.length > 0 ? (
                    options.locales.map(loc => (
                      <option key={loc} value={loc}>{loc}</option>
                    ))
                  ) : (
                    <>
                      <option value="en-US">English (US)</option>
                      <option value="en-GB">English (UK)</option>
                      <option value="vi-VN">Tiếng Việt</option>
                      <option value="fr-FR">Français</option>
                      <option value="de-DE">Deutsch</option>
                      <option value="es-ES">Español</option>
                      <option value="it-IT">Italiano</option>
                      <option value="pt-BR">Português (BR)</option>
                      <option value="ru-RU">Русский</option>
                      <option value="ja-JP">日本語</option>
                      <option value="ko-KR">한국어</option>
                      <option value="zh-CN">中文(简体)</option>
                    </>
                  )}
                </select>
              </div>
            </RegionBlock>

            <RegionBlock flag="timezone" label={t('pf.fp.tz')} hint={t('pf.fp.tz.hint')}>
              <div className="form-group">
                <label htmlFor="timezone">{t('pf.fp.tz.label')}</label>
                <select
                  id="timezone"
                  name="timezone"
                  value={formData.settings.timezone}
                  onChange={(e) => { handleSettingsChange(e); setFormData(prev => ({ ...prev, fingerprint: { ...prev.fingerprint, timezone: e.target.value } })); }}
                  disabled={(formData.settings.applyOverrides?.timezone) === false}
                >
                  {options.timezones && options.timezones.length > 0 ? (
                    options.timezones.map(tz => (
                      <option key={tz} value={tz}>{tz}</option>
                    ))
                  ) : (
                    <>
                      <option value="UTC">UTC</option>
                      <option value="America/New_York">America/New_York (EST)</option>
                      <option value="America/Chicago">America/Chicago (CST)</option>
                      <option value="America/Denver">America/Denver (MST)</option>
                      <option value="America/Los_Angeles">America/Los_Angeles (PST)</option>
                      <option value="Europe/London">Europe/London (GMT)</option>
                      <option value="Europe/Paris">Europe/Paris (CET)</option>
                      <option value="Europe/Berlin">Europe/Berlin (CET)</option>
                      <option value="Asia/Ho_Chi_Minh">Asia/Ho_Chi_Minh (ICT)</option>
                      <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
                      <option value="Asia/Seoul">Asia/Seoul (KST)</option>
                      <option value="Asia/Shanghai">Asia/Shanghai (CST)</option>
                      <option value="Asia/Singapore">Asia/Singapore (SGT)</option>
                    </>
                  )}
                </select>
                <div className="form-hint">{t('pf.fp.tz.matchHint')}</div>
              </div>
            </RegionBlock>

            <RegionBlock flag="viewport" label={t('pf.fp.vp')} hint={t('pf.fp.vp.hint')}>
              <div className="form-group">
                <label htmlFor="screenResolution">{t('pf.fp.vp.res')}</label>
                <select
                  id="screenResolution"
                  name="screenResolution"
                  value={formData.fingerprint.screenResolution}
                  onChange={handleFingerprintChange}
                  disabled={(formData.settings.applyOverrides?.viewport) === false}
                >
                  <option value="1024x768">1024x768</option>
                  <option value="1280x720">1280x720</option>
                  <option value="1280x800">1280x800</option>
                  <option value="1360x768">1360x768</option>
                  <option value="1366x768">1366x768</option>
                  <option value="1440x900">1440x900</option>
                  <option value="1536x864">1536x864</option>
                  <option value="1600x900">1600x900</option>
                  <option value="1680x1050">1680x1050</option>
                  <option value="1920x1080">1920x1080</option>
                  <option value="1920x1200">1920x1200</option>
                  <option value="2560x1440">2560x1440</option>
                  <option value="2560x1600">2560x1600</option>
                  <option value="2880x1800">2880x1800</option>
                  <option value="3000x2000">3000x2000</option>
                  <option value="3200x1800">3200x1800</option>
                  <option value="3440x1440">3440x1440 (Ultrawide)</option>
                  <option value="3840x2160">3840x2160 (4K)</option>
                </select>
              </div>
            </RegionBlock>

            <div className="form-group">
              <label>{t('pf.fp.features')}</label>
              <div className="checkbox-group">
                <label>
                  <input
                    type="checkbox"
                    name="webgl"
                    checked={formData.settings.webgl}
                    onChange={(e) => {
                      handleSettingsChange(e);
                      setFormData(prev => ({ ...prev, fingerprint: { ...prev.fingerprint, webgl: e.target.checked } }));
                    }}
                  />
                  <span>Enable WebGL</span>
                </label>
                <label>
                  <input
                    type="checkbox"
                    name="canvas"
                    checked={formData.fingerprint.canvas}
                    onChange={handleFingerprintChange}
                  />
                  <span>Enable Canvas</span>
                </label>
                <label>
                  <input
                    type="checkbox"
                    name="audio"
                    checked={formData.fingerprint.audio}
                    onChange={handleFingerprintChange}
                  />
                  <span>Enable Audio Context</span>
                </label>
              </div>
              <div className="form-hint">{t('pf.fp.features.hint')}</div>
            </div>
          </section>
        )}

        {/* ===== TAB: ENVIRONMENT ===== */}
        {activeTab === 'environment' && (
          <section className="form-section">
            <RegionBlock flag="hardware" label={t('pf.env.hw')} hint={t('pf.env.hw.hint')}>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="cpuCores">{t('pf.env.cpu')}</label>
                  <input
                    type="number"
                    id="cpuCores"
                    name="cpuCores"
                    min="1"
                    max="32"
                    value={formData.settings.cpuCores}
                    onChange={(e) => handleSettingsChange({ target: { ...e.target, value: Number(e.target.value) } })}
                    disabled={(formData.settings.applyOverrides?.hardware) === false}
                  />
                  <div className="form-hint">navigator.hardwareConcurrency</div>
                </div>
                <div className="form-group">
                  <label htmlFor="memoryGB">{t('pf.env.mem')}</label>
                  <input
                    type="number"
                    id="memoryGB"
                    name="memoryGB"
                    min="1"
                    max="64"
                    value={formData.settings.memoryGB}
                    onChange={(e) => handleSettingsChange({ target: { ...e.target, value: Number(e.target.value) } })}
                    disabled={(formData.settings.applyOverrides?.hardware) === false}
                  />
                  <div className="form-hint">navigator.deviceMemory</div>
                </div>
              </div>
            </RegionBlock>

            <div className="form-group">
              <label>{t('pf.env.proxy')}</label>
              <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                <input
                  type="text"
                  placeholder="host:port or http://host:port"
                  value={formData.settings.proxy.server}
                  onChange={handleNestedSettingsChange('proxy', 'server')}
                />
                <div className="form-hint">{t('pf.env.proxy.hint')}</div>
              </div>
              <div className="form-row">
                <input
                  type="text"
                  placeholder="username"
                  value={formData.settings.proxy.username}
                  onChange={handleNestedSettingsChange('proxy', 'username')}
                />
                <input
                  type="text"
                  placeholder="password"
                  value={formData.settings.proxy.password}
                  onChange={handleNestedSettingsChange('proxy', 'password')}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="webrtc">{t('pf.env.webrtc')}</label>
                <select id="webrtc" name="webrtc" value={formData.settings.webrtc} onChange={handleSettingsChange}>
                  <option value="default">Default</option>
                  <option value="proxy_only">Proxy only (disable UDP)</option>
                </select>
                <div className="form-hint">{t('pf.env.webrtc.hint')}</div>
              </div>
              <div className="form-group">
                <label>{t('pf.env.media')}</label>
                <div className="checkbox-group">
                  <label>
                    <input type="checkbox" checked={formData.settings.mediaDevices.audio} onChange={handleNestedSettingsChange('mediaDevices', 'audio', Boolean)} />
                    <span>Microphone</span>
                  </label>
                  <label>
                    <input type="checkbox" checked={formData.settings.mediaDevices.video} onChange={handleNestedSettingsChange('mediaDevices', 'video', Boolean)} />
                    <span>Camera</span>
                  </label>
                </div>
                <div className="form-hint">{t('pf.env.media.hint')}</div>
              </div>
            </div>

            <RegionBlock flag="geolocation" label={t('pf.env.geo')} hint={t('pf.env.geo.hint')}>
              <div className="form-group" style={{ marginTop: '0.5rem' }}>
                <div className="form-row">
                  <input type="number" step="0.0001" placeholder="Latitude" value={formData.settings.geolocation.latitude} onChange={handleNestedSettingsChange('geolocation', 'latitude', Number)} />
                  <input type="number" step="0.0001" placeholder="Longitude" value={formData.settings.geolocation.longitude} onChange={handleNestedSettingsChange('geolocation', 'longitude', Number)} />
                  <input type="number" step="1" placeholder="Accuracy (m)" value={formData.settings.geolocation.accuracy} onChange={handleNestedSettingsChange('geolocation', 'accuracy', Number)} />
                </div>
                <div className="form-hint">{t('pf.env.geo.coordHint')}</div>
              </div>
            </RegionBlock>
          </section>
        )}

        {/* ===== TAB: ADVANCED ===== */}
        {activeTab === 'advanced' && (
          <section className="form-section">
            <RegionBlock flag="navigator" label={t('pf.adv.nav')} hint={t('pf.adv.nav.hint')}>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="adv_platform">Platform (navigator.platform)</label>
                  <input
                    id="adv_platform"
                    type="text"
                    value={formData.settings.advanced.platform}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      settings: { ...prev.settings, advanced: { ...prev.settings.advanced, platform: e.target.value } },
                    }))}
                    disabled={(formData.settings.applyOverrides?.navigator) === false}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="adv_mtp">Max Touch Points</label>
                  <input
                    id="adv_mtp"
                    type="number"
                    min="0"
                    max="10"
                    value={formData.settings.advanced.maxTouchPoints}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      settings: { ...prev.settings, advanced: { ...prev.settings.advanced, maxTouchPoints: Number(e.target.value) } },
                    }))}
                    disabled={(formData.settings.applyOverrides?.navigator) === false}
                  />
                </div>
                <div className="form-group">
                  <label>Do Not Track</label>
                  <div className="checkbox-group">
                    <label>
                      <input
                        type="checkbox"
                        checked={formData.settings.advanced.dnt}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          settings: { ...prev.settings, advanced: { ...prev.settings.advanced, dnt: e.target.checked } },
                        }))}
                        disabled={(formData.settings.applyOverrides?.navigator) === false}
                      />
                      <span>Enable DNT</span>
                    </label>
                  </div>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="adv_plugins">Plugins Count</label>
                  <input
                    id="adv_plugins"
                    type="number"
                    min="0"
                    max="10"
                    value={formData.settings.advanced.plugins}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      settings: { ...prev.settings, advanced: { ...prev.settings.advanced, plugins: Number(e.target.value) } },
                    }))}
                    disabled={(formData.settings.applyOverrides?.navigator) === false}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="adv_langs">Navigator Languages</label>
                  <input
                    id="adv_langs"
                    type="text"
                    placeholder="e.g. vi-VN,en-US"
                    value={formData.settings.advanced.languages}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      settings: { ...prev.settings, advanced: { ...prev.settings.advanced, languages: e.target.value } },
                    }))}
                    disabled={(formData.settings.applyOverrides?.language) === false && (formData.settings.applyOverrides?.navigator) === false}
                  />
                  <div className="form-hint">navigator.languages list</div>
                </div>
              </div>
            </RegionBlock>

            <RegionBlock flag="viewport" label={t('pf.adv.dpr')} hint={t('pf.adv.dpr.hint')}>
              <div className="form-group">
                <label htmlFor="adv_dpr">Device Pixel Ratio</label>
                <input
                  id="adv_dpr"
                  type="number"
                  step="0.1"
                  min="0.5"
                  max="4"
                  value={formData.settings.advanced.devicePixelRatio}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    settings: { ...prev.settings, advanced: { ...prev.settings.advanced, devicePixelRatio: Number(e.target.value) } },
                  }))}
                  disabled={(formData.settings.applyOverrides?.viewport) === false}
                />
                <div className="form-hint">window.devicePixelRatio</div>
              </div>
            </RegionBlock>

            <RegionBlock flag="webgl" label={t('pf.adv.webgl')} hint={t('pf.adv.webgl.hint')}>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="adv_wgl_vendor">WebGL Vendor</label>
                  <input
                    id="adv_wgl_vendor"
                    type="text"
                    value={formData.settings.advanced.webglVendor}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      settings: { ...prev.settings, advanced: { ...prev.settings.advanced, webglVendor: e.target.value } },
                    }))}
                    disabled={(formData.settings.applyOverrides?.webgl) === false}
                  />
                  <div className="form-hint">UNMASKED_VENDOR_WEBGL</div>
                </div>
                <div className="form-group">
                  <label htmlFor="adv_wgl_renderer">WebGL Renderer</label>
                  <input
                    id="adv_wgl_renderer"
                    type="text"
                    value={formData.settings.advanced.webglRenderer}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      settings: { ...prev.settings, advanced: { ...prev.settings.advanced, webglRenderer: e.target.value } },
                    }))}
                    disabled={(formData.settings.applyOverrides?.webgl) === false}
                  />
                  <div className="form-hint">UNMASKED_RENDERER_WEBGL</div>
                </div>
              </div>
            </RegionBlock>
          </section>
        )}

      </form>
    </div>
  );
}

export default ProfileForm;

