import React, { useState, useEffect, useMemo } from 'react';
import { Shuffle, Save, X, RefreshCw, Lock, Unlock, Copy, Plus } from 'lucide-react';
import { useI18n } from '../i18n/index';
import './ProfileForm.css';

/* ═══════════════ Default data ═══════════════ */
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
  proxy: { type: 'none', server: '', username: '', password: '' },
  ipChecker: 'ip2location',
  language: 'vi-VN',
  timezone: 'Asia/Ho_Chi_Minh',
  webrtc: 'disabled',
  geolocation: { mode: 'ip', latitude: 21.0278, longitude: 105.8342, accuracy: 100, permission: 'ask' },
  mediaDevices: { audio: true, video: true },
  webgl: true,
  headless: false,
  engine: 'playwright',
  cdpApplyInitScript: true,
  // Fingerprint controls
  timezoneMode: 'ip', // ip | real | custom
  languageMode: 'ip', // ip | custom
  displayLangMode: 'language', // language | real | custom
  screenResMode: 'predefined', // random | predefined | custom
  fontsMode: 'default', // default | custom
  canvasMode: 'real', // real (static in AdsPower)
  // Platform
  platform: 'none',
  tabs: '',
  // Advanced
  extensionMode: 'team',
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
    languages: '',
  },
};

/* ═══════════════ Sub-components ═══════════════ */

/** Segmented control – pill-button group */
function SegmentedControl({ options, value, onChange, disabled }) {
  return (
    <div className="seg-ctrl">
      {options.map(opt => (
        <button
          key={opt.value}
          type="button"
          className={`seg-btn${value === opt.value ? ' active' : ''}`}
          onClick={() => !disabled && onChange(opt.value)}
          disabled={disabled}
          title={opt.title || opt.label}
        >
          {opt.icon && <span className="seg-icon">{opt.icon}</span>}
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/** Horizontal form row */
function FormRow({ label, required, children, hint }) {
  return (
    <div className="pf-row">
      <label>
        {required && <span className="required">*</span>}
        {label}
      </label>
      <div className="pf-control">
        {children}
        {hint && <div className="pf-hint">{hint}</div>}
      </div>
    </div>
  );
}

/* ═══════════════ Main Component ═══════════════ */
function ProfileForm({ profile, onSave, onCancel }) {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState('general');
  const [proxySubTab, setProxySubTab] = useState('custom');
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
  const [presets, setPresets] = useState([]);
  const [customPresets, setCustomPresets] = useState([]);
  const [selectedPreset, setSelectedPreset] = useState('');
  const [lockedPreset, setLockedPreset] = useState(false);
  const [presetCount, setPresetCount] = useState(6);

  const fallbackLocales = ['vi-VN', 'en-US', 'en-GB', 'fr-FR', 'de-DE', 'es-ES', 'it-IT', 'ja-JP', 'ko-KR', 'zh-CN'];
  const fallbackTimezones = ['Asia/Ho_Chi_Minh', 'UTC', 'Asia/Tokyo', 'Asia/Seoul', 'Asia/Singapore', 'Europe/Paris', 'Europe/Berlin', 'Europe/London', 'America/New_York'];

  /* ── Load profile data ── */
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

  /* ── Load locale/timezone & custom presets ── */
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

  /* ── Preset generation helpers ── */
  const randomFrom = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const randomBool = (p = 0.5) => Math.random() < p;

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
    const plat = os === 'Windows' ? 'Win32' : (os === 'macOS' ? 'MacIntel' : 'Linux x86_64');
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
    const extraLangsPool = locales.filter(l => l !== language);
    const extras = [randomFrom(extraLangsPool), randomBool(0.5) ? randomFrom(extraLangsPool) : null]
      .filter(Boolean).slice(0, randomFrom([0, 1, 2]));
    const languages = [language, ...extras].join(',');
    const geoCities = [
      { name: 'Hanoi', lat: 21.0278, lon: 105.8342 },
      { name: 'Ho_Chi_Minh', lat: 10.8231, lon: 106.6297 },
      { name: 'Bangkok', lat: 13.7563, lon: 100.5018 },
      { name: 'Singapore', lat: 1.3521, lon: 103.8198 },
      { name: 'Tokyo', lat: 35.6762, lon: 139.6503 },
    ];
    const city = randomFrom(geoCities);
    return {
      label: `${os} · ${browser} ${browserVersion} · ${language} · ${screenResolution}`,
      fingerprint: { os, browser, browserVersion, userAgent: ua, language, screenResolution, timezone, webgl: true, canvas: randomBool(0.9), audio: randomBool(0.9) },
      settingsPatch: {
        language, timezone,
        geolocation: { latitude: city.lat, longitude: city.lon, accuracy: randomFrom([30, 50, 75, 100]) },
        advanced: { platform: plat, dnt, devicePixelRatio, maxTouchPoints, webglVendor: wgl.vendor, webglRenderer: wgl.renderer, plugins, languages },
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

  useEffect(() => {
    const engine = formData.settings.engine;
    const allowed = engine === 'playwright' ? ['Chrome', 'Firefox'] : ['Chrome', 'Edge'];
    if (!allowed.includes(formData.fingerprint.browser)) {
      setFormData(prev => ({ ...prev, fingerprint: { ...prev.fingerprint, browser: allowed[0] } }));
    }
  }, [formData.settings.engine]);

  /* ── Change handlers ── */
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleFingerprintChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, fingerprint: { ...prev.fingerprint, [name]: type === 'checkbox' ? checked : value } }));
  };

  const handleSettingsChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, settings: { ...prev.settings, [name]: type === 'checkbox' ? checked : value } }));
  };

  const handleNestedSettingsChange = (section, field, parser = (v) => v) => (e) => {
    const { value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      settings: { ...prev.settings, [section]: { ...prev.settings[section], [field]: type === 'checkbox' ? checked : parser(value) } }
    }));
  };

  const setSettingsField = (field, val) => {
    setFormData(prev => ({ ...prev, settings: { ...prev.settings, [field]: val } }));
  };

  const handleOsChange = (os) => {
    let userAgent = formData.fingerprint.userAgent;
    const bv = formData.fingerprint.browserVersion || '120.0.0.0';
    if (os === 'Windows') userAgent = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${bv} Safari/537.36`;
    else if (os === 'macOS') userAgent = `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${bv} Safari/537.36`;
    else if (os === 'Linux') userAgent = `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${bv} Safari/537.36`;
    setFormData(prev => ({ ...prev, fingerprint: { ...prev.fingerprint, os, userAgent } }));
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

  const randomize = () => {
    const p = buildFingerprintPreset();
    setFormData(prev => ({
      ...prev,
      fingerprint: { ...prev.fingerprint, ...p.fingerprint },
      settings: {
        ...prev.settings,
        ...p.settingsPatch,
        cpuCores: randomFrom([4, 6, 8]),
        memoryGB: randomFrom([8, 12, 16, 24, 32]),
        webrtc: randomFrom(['disabled', 'real', 'forward', 'replace', 'disable_udp']),
        advanced: { ...(prev.settings.advanced || {}), ...p.settingsPatch.advanced },
      },
    }));
  };

  /* ── Apply preset ── */
  const applyPreset = (raw) => {
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
  };

  /* ── Overview data ── */
  const overviewData = useMemo(() => {
    const fp = formData.fingerprint;
    const s = formData.settings;
    const webrtcLabels = { disabled: 'Disabled', forward: 'Forward', replace: 'Replace', real: 'Real', disable_udp: 'Disable UDP', default: 'Disabled', proxy_only: 'Disable UDP' };
    const tzModeLabels = { ip: 'Based on IP', real: 'Real', custom: s.timezone };
    const locModeLabels = { ip: '[Ask] Based on IP', custom: 'Custom', block: 'Block' };
    const langModeLabels = { ip: 'Based on IP', custom: s.language };
    const dlLabels = { language: 'Based on Language', real: 'Real', custom: 'Custom' };
    const srLabels = { random: 'Random', predefined: 'Based on User-Agent', custom: 'Custom' };
    return [
      ['Browser', `${fp.browser} [Auto]`],
      ['User-Agent', fp.userAgent],
      ['WebRTC', webrtcLabels[s.webrtc] || 'Disabled'],
      ['Timezone', tzModeLabels[s.timezoneMode] || 'Based on IP'],
      ['Location', locModeLabels[s.geolocation?.mode] || '[Ask] Based on IP'],
      ['Language', langModeLabels[s.languageMode] || 'Based on IP'],
      ['Display language', dlLabels[s.displayLangMode] || 'Based on Language'],
      ['Screen Resolution', srLabels[s.screenResMode] || 'Based on User-Agent'],
      ['Fonts', s.fontsMode === 'custom' ? 'Custom' : 'Default'],
      ['Canvas', 'Real'],
    ];
  }, [formData]);

  /* ── Tab definitions ── */
  const TABS = [
    { id: 'general', label: t('pf.tab.general', 'General') },
    { id: 'proxy', label: t('pf.tab.proxy', 'Proxy') },
    { id: 'platform', label: t('pf.tab.platform', 'Platform') },
    { id: 'fingerprint', label: t('pf.tab.fingerprint', 'Fingerprint') },
    { id: 'advanced', label: t('pf.tab.advanced', 'Advanced') },
  ];

  /* ═══════════════ RENDER ═══════════════ */
  return (
    <div className="profile-form-container">
      {/* Header */}
      <div className="profile-form-header">
        <h2>{profile ? t('profileForm.header.edit') : t('profileForm.header.create')}</h2>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button type="button" className="btn" onClick={randomize} disabled={lockedPreset}>
            <Shuffle size={14} /> {t('profileForm.randomize')}
          </button>
          <button type="submit" form="profile-edit-form" className="btn btn-primary">
            <Save size={14} /> {profile ? t('profileForm.save') : t('profileForm.create')}
          </button>
          <button className="btn-close" onClick={onCancel}><X size={16} /></button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="pf-tabs">
        {TABS.map(tab => (
          <button
            key={tab.id}
            type="button"
            className={`pf-tab${activeTab === tab.id ? ' active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Body: form + overview sidebar */}
      <div className="pf-body">
        <form id="profile-edit-form" onSubmit={handleSubmit} className="profile-form">

          {/* ═══════ TAB: GENERAL ═══════ */}
          {activeTab === 'general' && (
            <>
              <FormRow label={t('pf.name', 'Name')}>
                <div className="pf-input-wrap">
                  <input
                    className="pf-input"
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder={t('pf.name.ph', 'Optional: profile name')}
                    maxLength={100}
                  />
                  <span className="pf-char-count">{formData.name.length} / 100</span>
                </div>
              </FormRow>

              <FormRow label={t('pf.browser', 'Browser')}>
                <SegmentedControl
                  value={formData.settings.engine}
                  onChange={(v) => setSettingsField('engine', v)}
                  options={[
                    { value: 'playwright', label: 'SunBrowser', icon: '☀️' },
                    { value: 'cdp', label: 'FlowerBrowser', icon: '🌸' },
                  ]}
                />
              </FormRow>

              <FormRow label={t('pf.fp.os', 'OS')}>
                <SegmentedControl
                  value={formData.fingerprint.os}
                  onChange={handleOsChange}
                  options={[
                    { value: 'Windows', label: 'Windows', icon: '🪟' },
                    { value: 'macOS', label: 'macOS', icon: '🍎' },
                    { value: 'Linux', label: 'Linux', icon: '🐧' },
                  ]}
                />
              </FormRow>

              <FormRow label={t('pf.ua', 'User-Agent')}>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <select
                    className="pf-select"
                    style={{ width: '80px', flex: '0 0 auto' }}
                    value="all"
                    onChange={() => { }}
                  >
                    <option value="all">All</option>
                  </select>
                  <div className="pf-input-wrap" style={{ flex: 1 }}>
                    <input
                      className="pf-input"
                      type="text"
                      name="userAgent"
                      value={formData.fingerprint.userAgent}
                      onChange={handleFingerprintChange}
                      title={formData.fingerprint.userAgent}
                    />
                  </div>
                  <button
                    type="button"
                    className="icon-btn"
                    title="Copy UA"
                    onClick={async () => { try { await navigator.clipboard.writeText(formData.fingerprint.userAgent || ''); } catch { } }}
                  >
                    <Copy size={14} />
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    title={t('profileForm.randomize')}
                    onClick={() => {
                      const p = buildFingerprintPreset();
                      setFormData(prev => ({
                        ...prev,
                        fingerprint: { ...prev.fingerprint, userAgent: p.fingerprint.userAgent }
                      }));
                    }}
                  >
                    <Shuffle size={14} />
                  </button>
                </div>
              </FormRow>

              <FormRow label={t('pf.group', 'Group')} required>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <select className="pf-select" style={{ flex: 1 }} value="ungrouped" onChange={() => { }}>
                    <option value="ungrouped">Ungrouped</option>
                  </select>
                  <button type="button" className="pf-check-btn" style={{ gap: '0.25rem' }}>
                    🏷️ Tags
                  </button>
                </div>
              </FormRow>

              <FormRow label={t('pf.cookie', 'Cookie')}>
                <input
                  className="pf-input"
                  type="text"
                  name="cookie"
                  value={formData.cookie || ''}
                  onChange={handleChange}
                  placeholder="Formats: JSON, Netscape, Name=Value"
                />
                <button type="button" className="pf-merge-btn">
                  <Plus size={13} /> Merge cookie
                </button>
              </FormRow>

              <FormRow label={t('pf.remark', 'Remark')}>
                <div className="pf-textarea-wrap">
                  <input
                    className="pf-input"
                    type="text"
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    placeholder={t('pf.remark.ph', 'Enter remark')}
                    maxLength={1500}
                  />
                  <span className="pf-char-count">{(formData.description || '').length} / 1500</span>
                </div>
              </FormRow>
            </>
          )}

          {/* ═══════ TAB: PROXY ═══════ */}
          {activeTab === 'proxy' && (
            <>
              <div className="pf-fieldset">
                <div className="pf-fieldset-legend">Proxy</div>

                {/* Sub-tabs */}
                <div className="pf-subtabs">
                  {['custom', 'saved', 'provider'].map(st => (
                    <button
                      key={st}
                      type="button"
                      className={`pf-subtab${proxySubTab === st ? ' active' : ''}`}
                      onClick={() => setProxySubTab(st)}
                    >
                      {st === 'custom' ? 'Custom' : st === 'saved' ? 'Saved Proxies' : 'Proxy Provider'}
                    </button>
                  ))}
                </div>

                {proxySubTab === 'custom' && (
                  <>
                    <FormRow label={t('pf.proxy.type', 'Proxy type')}>
                      <div className="pf-inline-row">
                        <select
                          className="pf-select"
                          value={formData.settings.proxy?.type || 'none'}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            settings: { ...prev.settings, proxy: { ...prev.settings.proxy, type: e.target.value } }
                          }))}
                        >
                          <option value="none">No Proxy (Local network)</option>
                          <option value="http">HTTP Proxy</option>
                          <option value="https">HTTPS Proxy</option>
                          <option value="socks5">SOCKS5 Proxy</option>
                        </select>
                        <button type="button" className="pf-check-btn">Check the network</button>
                      </div>
                    </FormRow>

                    {formData.settings.proxy?.type !== 'none' && (
                      <>
                        <FormRow label="Host:Port">
                          <input
                            className="pf-input"
                            type="text"
                            placeholder="host:port or http://host:port"
                            value={formData.settings.proxy?.server || ''}
                            onChange={handleNestedSettingsChange('proxy', 'server')}
                          />
                        </FormRow>
                        <FormRow label="Auth">
                          <div className="pf-two-col">
                            <input
                              className="pf-input"
                              type="text"
                              placeholder="username"
                              value={formData.settings.proxy?.username || ''}
                              onChange={handleNestedSettingsChange('proxy', 'username')}
                            />
                            <input
                              className="pf-input"
                              type="text"
                              placeholder="password"
                              value={formData.settings.proxy?.password || ''}
                              onChange={handleNestedSettingsChange('proxy', 'password')}
                            />
                          </div>
                        </FormRow>
                      </>
                    )}

                    <FormRow label={t('pf.proxy.ipChecker', 'IP checker')}>
                      <select
                        className="pf-select"
                        value={formData.settings.ipChecker || 'ip2location'}
                        onChange={(e) => setSettingsField('ipChecker', e.target.value)}
                      >
                        <option value="ip2location">IP2Location</option>
                        <option value="ipinfo">ipinfo.io</option>
                        <option value="ipapi">ip-api.com</option>
                      </select>
                    </FormRow>
                  </>
                )}

                {proxySubTab === 'saved' && (
                  <div style={{ padding: '1rem 0', color: 'var(--muted)', fontSize: '0.82rem' }}>
                    No saved proxies yet. Configure a proxy in Custom tab first.
                  </div>
                )}

                {proxySubTab === 'provider' && (
                  <div style={{ padding: '1rem 0', color: 'var(--muted)', fontSize: '0.82rem' }}>
                    Proxy provider integration coming soon.
                  </div>
                )}
              </div>
            </>
          )}

          {/* ═══════ TAB: PLATFORM ═══════ */}
          {activeTab === 'platform' && (
            <>
              <div className="pf-fieldset">
                <div className="pf-fieldset-legend">Platform</div>

                <FormRow label={t('pf.platform', 'Platform')}>
                  <select
                    className="pf-select"
                    value={formData.settings.platform || 'none'}
                    onChange={(e) => setSettingsField('platform', e.target.value)}
                  >
                    <option value="none">● None</option>
                    <option value="facebook">Facebook</option>
                    <option value="google">Google</option>
                    <option value="tiktok">TikTok</option>
                    <option value="amazon">Amazon</option>
                    <option value="ebay">eBay</option>
                    <option value="shopee">Shopee</option>
                  </select>
                </FormRow>

                <FormRow label={t('pf.tabs', 'Tabs')}>
                  <textarea
                    className="pf-textarea"
                    name="tabs"
                    value={formData.settings.tabs || ''}
                    onChange={(e) => setSettingsField('tabs', e.target.value)}
                    placeholder={'Enter URLs (one URL per line)\nwww.google.com\nwww.facebook.com'}
                    rows={5}
                  />
                </FormRow>
              </div>
            </>
          )}

          {/* ═══════ TAB: FINGERPRINT ═══════ */}
          {activeTab === 'fingerprint' && (
            <>
              {/* Preset bar */}
              <div className="preset-bar">
                <div className="preset-select">
                  <label htmlFor="fp_preset">{t('pf.fp.preset', 'Fingerprint Preset')}</label>
                  <select id="fp_preset" className="pf-select" value={selectedPreset} disabled={lockedPreset} onChange={(e) => applyPreset(e.target.value)}>
                    <option value="">{t('pf.fp.suggestions', 'Generated suggestions…')}</option>
                    {presets.map((p, i) => <option key={i} value={i}>{p.label}</option>)}
                    {customPresets.length > 0 && (
                      <optgroup label={t('pf.fp.customPresets', 'Custom presets')}>
                        {customPresets.map(p => {
                          const fp = p.fingerprint || {};
                          const sum = [fp.browser && (fp.browser + (fp.browserVersion ? ` ${fp.browserVersion}` : '')), fp.language, fp.screenResolution].filter(Boolean).join(' · ');
                          return <option key={p.id} value={`c:${p.id}`}>{p.name || p.label || 'Custom'} {sum ? `(${sum})` : ''}</option>;
                        })}
                      </optgroup>
                    )}
                  </select>
                </div>
                <div className="preset-actions">
                  <label className="preset-count" title="Count">
                    <span>×</span>
                    <select value={presetCount} onChange={(e) => setPresetCount(Number(e.target.value))}>
                      <option value={3}>3</option><option value={6}>6</option><option value={9}>9</option>
                    </select>
                  </label>
                  <button type="button" className="icon-btn" onClick={() => !lockedPreset && regeneratePresets(presetCount)} disabled={lockedPreset} title={t('pf.fp.regenerate')}>
                    <RefreshCw size={14} />
                  </button>
                  <button type="button" className="icon-btn" title={t('pf.fp.savePreset')} onClick={async () => {
                    const name = prompt('Preset name:');
                    if (!name) return;
                    const preset = { name, label: name, fingerprint: { ...formData.fingerprint }, settingsPatch: { language: formData.settings.language, timezone: formData.settings.timezone, geolocation: { ...(formData.settings.geolocation || {}) }, advanced: { ...(formData.settings.advanced || {}) } } };
                    try { const res = await window.electronAPI?.addPreset?.(preset); if (res?.success && res.preset) setCustomPresets(prev => [...prev, res.preset]); } catch { }
                  }}>
                    <Save size={14} />
                  </button>
                  <button type="button" className={`icon-btn${lockedPreset ? ' active' : ''}`} onClick={() => setLockedPreset(v => !v)} title={lockedPreset ? 'Unlock' : 'Lock'}>
                    {lockedPreset ? <Lock size={14} /> : <Unlock size={14} />}
                  </button>
                </div>
              </div>

              <div className="pf-fieldset">
                <div className="pf-fieldset-legend">Fingerprint</div>

                {/* WebRTC */}
                <FormRow label="WebRTC">
                  <SegmentedControl
                    value={formData.settings.webrtc}
                    onChange={(v) => setSettingsField('webrtc', v)}
                    options={[
                      { value: 'forward', label: 'Forward' },
                      { value: 'replace', label: 'Replace' },
                      { value: 'real', label: 'Real' },
                      { value: 'disabled', label: 'Disabled' },
                      { value: 'disable_udp', label: 'Disable UDP' },
                    ]}
                  />
                </FormRow>

                {/* Timezone */}
                <FormRow label="Timezone">
                  <SegmentedControl
                    value={formData.settings.timezoneMode || 'ip'}
                    onChange={(v) => setSettingsField('timezoneMode', v)}
                    options={[
                      { value: 'ip', label: 'Based on IP' },
                      { value: 'real', label: 'Real' },
                      { value: 'custom', label: 'Custom' },
                    ]}
                  />
                  {formData.settings.timezoneMode === 'custom' && (
                    <select
                      className="pf-select"
                      style={{ marginTop: '0.4rem' }}
                      value={formData.settings.timezone}
                      onChange={(e) => {
                        setSettingsField('timezone', e.target.value);
                        setFormData(prev => ({ ...prev, fingerprint: { ...prev.fingerprint, timezone: e.target.value } }));
                      }}
                    >
                      {(options.timezones?.length ? options.timezones : fallbackTimezones).map(tz => (
                        <option key={tz} value={tz}>{tz}</option>
                      ))}
                    </select>
                  )}
                </FormRow>

                {/* Location */}
                <FormRow label="Location">
                  <SegmentedControl
                    value={formData.settings.geolocation?.mode || 'ip'}
                    onChange={(v) => setFormData(prev => ({
                      ...prev,
                      settings: { ...prev.settings, geolocation: { ...prev.settings.geolocation, mode: v } }
                    }))}
                    options={[
                      { value: 'ip', label: 'Based on IP' },
                      { value: 'custom', label: 'Custom' },
                      { value: 'block', label: 'Block' },
                    ]}
                  />
                  {formData.settings.geolocation?.mode === 'ip' && (
                    <div className="pf-radio-group">
                      <label>
                        <input type="radio" name="geoPermission" value="ask" checked={(formData.settings.geolocation?.permission || 'ask') === 'ask'} onChange={() => setFormData(prev => ({ ...prev, settings: { ...prev.settings, geolocation: { ...prev.settings.geolocation, permission: 'ask' } } }))} />
                        Ask each time
                      </label>
                      <label>
                        <input type="radio" name="geoPermission" value="allow" checked={formData.settings.geolocation?.permission === 'allow'} onChange={() => setFormData(prev => ({ ...prev, settings: { ...prev.settings, geolocation: { ...prev.settings.geolocation, permission: 'allow' } } }))} />
                        Always allow
                      </label>
                    </div>
                  )}
                  {formData.settings.geolocation?.mode === 'custom' && (
                    <div className="pf-two-col" style={{ marginTop: '0.4rem' }}>
                      <input className="pf-input" type="number" step="0.0001" placeholder="Latitude" value={formData.settings.geolocation?.latitude || ''} onChange={handleNestedSettingsChange('geolocation', 'latitude', Number)} />
                      <input className="pf-input" type="number" step="0.0001" placeholder="Longitude" value={formData.settings.geolocation?.longitude || ''} onChange={handleNestedSettingsChange('geolocation', 'longitude', Number)} />
                    </div>
                  )}
                </FormRow>

                {/* Language */}
                <FormRow label="Language">
                  <SegmentedControl
                    value={formData.settings.languageMode || 'ip'}
                    onChange={(v) => setSettingsField('languageMode', v)}
                    options={[
                      { value: 'ip', label: 'Based on IP' },
                      { value: 'custom', label: 'Custom' },
                    ]}
                  />
                  {formData.settings.languageMode === 'custom' && (
                    <select
                      className="pf-select"
                      style={{ marginTop: '0.4rem' }}
                      value={formData.settings.language}
                      onChange={(e) => {
                        setSettingsField('language', e.target.value);
                        setFormData(prev => ({ ...prev, fingerprint: { ...prev.fingerprint, language: e.target.value } }));
                      }}
                    >
                      {(options.locales?.length ? options.locales : fallbackLocales).map(loc => (
                        <option key={loc} value={loc}>{loc}</option>
                      ))}
                    </select>
                  )}
                </FormRow>

                {/* Display language */}
                <FormRow label="Display language">
                  <SegmentedControl
                    value={formData.settings.displayLangMode || 'language'}
                    onChange={(v) => setSettingsField('displayLangMode', v)}
                    options={[
                      { value: 'language', label: 'Based on Language' },
                      { value: 'real', label: 'Real' },
                      { value: 'custom', label: 'Custom' },
                    ]}
                  />
                </FormRow>

                {/* Screen Resolution */}
                <FormRow label="Screen Resolution">
                  <SegmentedControl
                    value={formData.settings.screenResMode || 'predefined'}
                    onChange={(v) => setSettingsField('screenResMode', v)}
                    options={[
                      { value: 'random', label: 'Random' },
                      { value: 'predefined', label: 'Predefined' },
                      { value: 'custom', label: 'Custom' },
                    ]}
                  />
                  {formData.settings.screenResMode === 'predefined' && (
                    <select
                      className="pf-select"
                      style={{ marginTop: '0.4rem' }}
                      value={formData.fingerprint.screenResolution}
                      onChange={handleFingerprintChange}
                      name="screenResolution"
                    >
                      <option value="">Based on User-Agent</option>
                      {['1024x768', '1280x720', '1280x800', '1366x768', '1440x900', '1536x864', '1600x900', '1680x1050', '1920x1080', '1920x1200', '2560x1440', '3840x2160'].map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  )}
                  {formData.settings.screenResMode === 'custom' && (
                    <div className="pf-two-col" style={{ marginTop: '0.4rem' }}>
                      <input className="pf-input" type="number" placeholder="Width" value={formData.fingerprint.screenResolution?.split('x')?.[0] || ''} onChange={(e) => {
                        const h = formData.fingerprint.screenResolution?.split('x')?.[1] || '1080';
                        setFormData(prev => ({ ...prev, fingerprint: { ...prev.fingerprint, screenResolution: `${e.target.value}x${h}` } }));
                      }} />
                      <input className="pf-input" type="number" placeholder="Height" value={formData.fingerprint.screenResolution?.split('x')?.[1] || ''} onChange={(e) => {
                        const w = formData.fingerprint.screenResolution?.split('x')?.[0] || '1920';
                        setFormData(prev => ({ ...prev, fingerprint: { ...prev.fingerprint, screenResolution: `${w}x${e.target.value}` } }));
                      }} />
                    </div>
                  )}
                </FormRow>

                {/* Fonts */}
                <FormRow label="Fonts">
                  <SegmentedControl
                    value={formData.settings.fontsMode || 'default'}
                    onChange={(v) => setSettingsField('fontsMode', v)}
                    options={[
                      { value: 'default', label: 'Default' },
                      { value: 'custom', label: 'Custom' },
                    ]}
                  />
                </FormRow>

                {/* Canvas */}
                <FormRow label="Canvas">
                  <span style={{ fontSize: '0.84rem', color: 'var(--fg)', paddingTop: '0.4rem' }}>Real</span>
                </FormRow>
              </div>
            </>
          )}

          {/* ═══════ TAB: ADVANCED ═══════ */}
          {activeTab === 'advanced' && (
            <>
              <div className="pf-fieldset">
                <div className="pf-fieldset-legend">Advanced</div>

                <FormRow label={t('pf.adv.extension', 'Extension')}>
                  <select
                    className="pf-select"
                    value={formData.settings.extensionMode || 'team'}
                    onChange={(e) => setSettingsField('extensionMode', e.target.value)}
                  >
                    <option value="team">Use team's extensions</option>
                    <option value="none">No extensions</option>
                    <option value="custom">Custom extensions</option>
                  </select>
                  <div className="pf-hint">
                    The enabled extensions from [Extensions - Team's Extensions] will be installed in the profile.
                  </div>
                </FormRow>
              </div>
            </>
          )}

        </form>

        {/* ═══════ OVERVIEW SIDEBAR ═══════ */}
        <aside className="pf-overview">
          <div className="pf-overview-header">
            <h3>Overview</h3>
            <button type="button" className="btn-new-fp" onClick={randomize}>
              <RefreshCw size={13} /> New fingerprint
            </button>
          </div>

          <table>
            <tbody>
              {overviewData.map(([key, val]) => (
                <tr key={key}>
                  <td>{key}</td>
                  <td>{val}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="pf-overview-footer">
            Set default values in <a>Preferences</a>.
          </div>
        </aside>
      </div>
    </div>
  );
}

export default ProfileForm;
