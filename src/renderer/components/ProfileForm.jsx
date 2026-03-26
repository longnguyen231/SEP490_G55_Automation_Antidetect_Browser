import React, { useState, useEffect, useMemo } from 'react';
import {
  Sparkles, User, Monitor, Cpu, PenTool, Globe, Volume2,
  MonitorPlay, Wifi, Battery, ArrowLeft, RefreshCw, X
} from 'lucide-react';
import { useI18n } from '../i18n/index';
import './ProfileForm.css';

/* ═══════════════ Default form data ═══════════════ */
const defaultFormData = {
  name: '',
  quantity: 1,
  engine: 'playwright',
  startupPage: '',
  windowWidth: 0,
  windowHeight: 0,
  quickGenerate: { os: 'Windows', browser: 'Chrome', device: 'Desktop' },
  identity: {
    enabled: false,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.7103.93 Safari/537.36',
    platform: 'Win32',
    locale: 'en-US',
    timezone: 'America/New_York',
    languages: 'en-US, en',
  },
  display: {
    enabled: false,
    preset: 'Custom',
    width: 1920,
    height: 1080,
    colorDepth: 24,
    pixelRatio: 1,
  },
  hardware: {
    enabled: false,
    cpuCores: 4,
    memoryGB: 8,
    gpuVendor: 'Google Inc. (Intel)',
    gpuRenderer: 'ANGLE (Intel, Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0, D3D11)',
  },
  canvas: {
    enabled: false,
    noiseSeed: 0,
    noiseIntensity: 2,
  },
  webgl: {
    enabled: false,
    noiseSeed: 0,
    maxTextureSize: 16384,
    extensions: '',
  },
  audio: {
    enabled: false,
    sampleRate: 48000,
    channels: 'stereo',
    noiseSeed: 0,
  },
  media: {
    enabled: false,
    speakers: 1,
    microphones: 1,
    webcams: 1,
  },
  network: {
    enabled: false,
    webrtcPolicy: 'default',
    doNotTrack: 'unspecified',
    maxTouchPoints: 0,
    connectionType: '4g',
    pdfViewer: 'enabled',
  },
  battery: {
    enabled: false,
    charging: 'charging',
    level: 1,
    chargingTime: 0,
    dischargingTime: '',
  },
  // Legacy fields for backward compatibility
  proxy: { type: 'none', server: '', username: '', password: '' },
  cookie: '',
  description: '',
};

/* ═══════════════ Tab definitions ═══════════════ */
const TABS = [
  { id: 'general', label: 'General', icon: Sparkles },
  { id: 'identity', label: 'Identity', icon: User },
  { id: 'display', label: 'Display', icon: Monitor },
  { id: 'hardware', label: 'Hardware', icon: Cpu },
  { id: 'canvas', label: 'Canvas', icon: PenTool },
  { id: 'webgl', label: 'WebGL', icon: Globe },
  { id: 'audio', label: 'Audio', icon: Volume2 },
  { id: 'media', label: 'Media', icon: MonitorPlay },
  { id: 'network', label: 'Network', icon: Wifi },
  { id: 'battery', label: 'Battery', icon: Battery },
];

/* ═══════════════ Toggle switch ═══════════════ */
function ToggleSwitch({ checked, onChange, label }) {
  return (
    <div className="npf-toggle-wrap">
      {label && <span className="npf-toggle-label">{label}</span>}
      <button
        type="button"
        className={`npf-toggle ${checked ? 'on' : 'off'}`}
        onClick={() => onChange(!checked)}
        role="switch"
        aria-checked={checked}
      >
        <span className="npf-toggle-knob" />
      </button>
    </div>
  );
}

/* ═══════════════ Section header ═══════════════ */
function SectionHeader({ title, subtitle, enabled, onToggle }) {
  return (
    <div className="npf-section-header">
      <div>
        <h3 className="npf-section-title">{title}</h3>
        <p className="npf-section-subtitle">{subtitle}</p>
      </div>
      {onToggle && (
        <ToggleSwitch checked={enabled} onChange={onToggle} label={enabled ? 'Enabled' : 'Disabled'} />
      )}
    </div>
  );
}

/* ═══════════════ Main Component ═══════════════ */
function ProfileForm({ profile, onSave, onCancel }) {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState('general');
  const [formData, setFormData] = useState(JSON.parse(JSON.stringify(defaultFormData)));

  /* ── Load profile data ── */
  useEffect(() => {
    if (profile) {
      setFormData(prev => ({
        ...prev,
        name: profile.name || '',
        description: profile.description || '',
        cookie: profile.cookie || '',
        quantity: profile.quantity || 1,
        engine: profile.settings?.engine || profile.engine || 'playwright',
        startupPage: profile.startupPage || '',
        windowWidth: profile.windowWidth || 0,
        windowHeight: profile.windowHeight || 0,
        identity: {
          ...prev.identity,
          ...(profile.identity || {}),
          userAgent: profile.identity?.userAgent || profile.fingerprint?.userAgent || prev.identity.userAgent,
          platform: profile.identity?.platform || profile.settings?.advanced?.platform || prev.identity.platform,
          locale: profile.identity?.locale || profile.fingerprint?.language || prev.identity.locale,
          timezone: profile.identity?.timezone || profile.fingerprint?.timezone || prev.identity.timezone,
          languages: profile.identity?.languages || profile.settings?.advanced?.languages || prev.identity.languages,
        },
        display: {
          ...prev.display,
          ...(profile.display || {}),
        },
        hardware: {
          ...prev.hardware,
          ...(profile.hardware || {}),
          cpuCores: profile.hardware?.cpuCores || profile.settings?.cpuCores || prev.hardware.cpuCores,
          memoryGB: profile.hardware?.memoryGB || profile.settings?.memoryGB || prev.hardware.memoryGB,
          gpuVendor: profile.hardware?.gpuVendor || profile.settings?.advanced?.webglVendor || prev.hardware.gpuVendor,
          gpuRenderer: profile.hardware?.gpuRenderer || profile.settings?.advanced?.webglRenderer || prev.hardware.gpuRenderer,
        },
        canvas: { ...prev.canvas, ...(profile.canvas || {}) },
        webgl: { ...prev.webgl, ...(profile.webgl || {}) },
        audio: { ...prev.audio, ...(profile.audio || {}) },
        media: { ...prev.media, ...(profile.media || {}) },
        network: {
          ...prev.network,
          ...(profile.network || {}),
          webrtcPolicy: profile.network?.webrtcPolicy || profile.settings?.webrtc || prev.network.webrtcPolicy,
          doNotTrack: profile.network?.doNotTrack || (profile.settings?.advanced?.dnt ? 'true' : 'unspecified'),
          maxTouchPoints: profile.network?.maxTouchPoints ?? profile.settings?.advanced?.maxTouchPoints ?? 0,
        },
        battery: { ...prev.battery, ...(profile.battery || {}) },
        proxy: profile.settings?.proxy || prev.proxy,
      }));
    }
  }, [profile]);

  /* ── Update helpers ── */
  const updateSection = (section, field, value) => {
    setFormData(prev => ({
      ...prev,
      [section]: { ...prev[section], [field]: value },
    }));
  };

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  /* ── Generate per section ── */
  const handleGenerate = async () => {
    const section = activeTab;
    try {
      if (section === 'general') {
        // Generate all sections
        const res = await window.electronAPI?.generateFingerprint?.({
          os: formData.quickGenerate.os,
        });
        if (res?.success) {
          applyFullFingerprint(res);
        }
        return;
      }

      const generatorMap = {
        identity: 'generateIdentity',
        display: 'generateDisplay',
        hardware: 'generateHardware',
        canvas: 'generateCanvas',
        webgl: 'generateWebGL',
        audio: 'generateAudio',
        media: 'generateMedia',
        network: 'generateNetwork',
        battery: 'generateBattery',
      };

      const method = generatorMap[section];
      if (method && window.electronAPI?.[method]) {
        const res = await window.electronAPI[method]({ os: formData.quickGenerate.os });
        if (res?.success && res.data) {
          setFormData(prev => ({
            ...prev,
            [section]: { ...prev[section], ...res.data },
          }));
        }
      } else {
        // Fallback: client-side generation
        generateClientSide(section);
      }
    } catch (e) {
      // Fallback to client-side generation
      generateClientSide(section);
    }
  };

  const generateClientSide = (section) => {
    const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
    const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

    switch (section) {
      case 'identity': {
        const os = formData.quickGenerate.os;
        const chromeVer = rand(['133.0.6943.127', '134.0.6998.89', '135.0.7049.85', '136.0.7103.93']);
        const ffVer = rand(['145.0', '146.0', '147.0']);
        const browser = formData.quickGenerate.browser || 'Chrome';
        let ua, platform;
        if (browser === 'Firefox') {
          if (os === 'Windows') { ua = `Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:${ffVer}) Gecko/20100101 Firefox/${ffVer}`; platform = 'Win32'; }
          else if (os === 'macOS') { ua = `Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:${ffVer}) Gecko/20100101 Firefox/${ffVer}`; platform = 'MacIntel'; }
          else { ua = `Mozilla/5.0 (X11; Linux x86_64; rv:${ffVer}) Gecko/20100101 Firefox/${ffVer}`; platform = 'Linux x86_64'; }
        } else {
          if (os === 'Windows') { ua = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVer} Safari/537.36`; platform = 'Win32'; }
          else if (os === 'macOS') { ua = `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVer} Safari/537.36`; platform = 'MacIntel'; }
          else { ua = `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVer} Safari/537.36`; platform = 'Linux x86_64'; }
        }
        const locales = ['en-US', 'en-GB', 'vi-VN', 'fr-FR', 'de-DE', 'ja-JP', 'ko-KR', 'zh-CN', 'th-TH', 'es-ES'];
        const timezones = ['America/New_York', 'America/Los_Angeles', 'Europe/London', 'Europe/Berlin', 'Asia/Tokyo', 'Asia/Ho_Chi_Minh', 'Asia/Bangkok', 'Asia/Seoul'];
        const locale = rand(locales);
        const tz = rand(timezones);
        const primaryLang = locale.split('-')[0];
        setFormData(prev => ({
          ...prev, identity: { ...prev.identity, userAgent: ua, platform, locale, timezone: tz, languages: `${locale}, ${primaryLang}` }
        }));
        break;
      }
      case 'display': {
        const resolutions = [[1920, 1080], [2560, 1440], [1366, 768], [1536, 864], [1440, 900], [1680, 1050], [3840, 2160], [1280, 720]];
        const res = rand(resolutions);
        setFormData(prev => ({
          ...prev, display: { ...prev.display, width: res[0], height: res[1], colorDepth: rand([24, 32]), pixelRatio: rand([1, 1.25, 1.5, 2]) }
        }));
        break;
      }
      case 'hardware': {
        const gpuPairs = [
          { v: 'Google Inc. (NVIDIA)', r: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)' },
          { v: 'Google Inc. (NVIDIA)', r: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4060 Direct3D11 vs_5_0 ps_5_0, D3D11)' },
          { v: 'Google Inc. (Intel)', r: 'ANGLE (Intel, Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0, D3D11)' },
          { v: 'Google Inc. (AMD)', r: 'ANGLE (AMD, AMD Radeon RX 580 Direct3D11 vs_5_0 ps_5_0, D3D11)' },
          { v: 'Google Inc. (Apple)', r: 'ANGLE (Apple, Apple M1, OpenGL 4.1)' },
        ];
        const gpu = rand(gpuPairs);
        setFormData(prev => ({
          ...prev, hardware: { ...prev.hardware, cpuCores: rand([2, 4, 6, 8, 12, 16]), memoryGB: rand([4, 8, 16, 32]), gpuVendor: gpu.v, gpuRenderer: gpu.r }
        }));
        break;
      }
      case 'canvas':
        setFormData(prev => ({
          ...prev, canvas: { ...prev.canvas, noiseSeed: randInt(0, 999999), noiseIntensity: randInt(1, 10) }
        }));
        break;
      case 'webgl':
        setFormData(prev => ({
          ...prev, webgl: { ...prev.webgl, noiseSeed: randInt(0, 999999), maxTextureSize: rand([8192, 16384, 32768]) }
        }));
        break;
      case 'audio':
        setFormData(prev => ({
          ...prev, audio: { ...prev.audio, sampleRate: rand([44100, 48000, 96000]), channels: rand(['mono', 'stereo', '5.1']), noiseSeed: randInt(0, 999999) }
        }));
        break;
      case 'media':
        setFormData(prev => ({
          ...prev, media: { ...prev.media, speakers: randInt(0, 3), microphones: randInt(0, 2), webcams: randInt(0, 2) }
        }));
        break;
      case 'network':
        setFormData(prev => ({
          ...prev, network: {
            ...prev.network,
            webrtcPolicy: rand(['default', 'disable_non_proxied_udp', 'default_public_interface_only', 'default_public_and_private_interfaces']),
            doNotTrack: rand(['unspecified', 'true', 'false']),
            maxTouchPoints: rand([0, 1, 2, 5, 10]),
            connectionType: rand(['4g', 'wifi', '3g', 'ethernet', 'bluetooth']),
          }
        }));
        break;
      case 'battery':
        setFormData(prev => ({
          ...prev, battery: {
            ...prev.battery,
            charging: rand(['charging', 'discharging']),
            level: +(Math.random()).toFixed(2),
            chargingTime: randInt(0, 7200),
            dischargingTime: randInt(0, 36000),
          }
        }));
        break;
      default:
        break;
    }
  };

  const applyFullFingerprint = (res) => {
    const fp = res.fingerprint || {};
    const s = res.settings || {};
    const adv = s.advanced || {};
    setFormData(prev => ({
      ...prev,
      identity: {
        ...prev.identity,
        userAgent: fp.userAgent || prev.identity.userAgent,
        platform: adv.platform || prev.identity.platform,
        locale: fp.language || prev.identity.locale,
        timezone: fp.timezone || prev.identity.timezone,
        languages: adv.languages || prev.identity.languages,
      },
      display: {
        ...prev.display,
        width: parseInt((fp.screenResolution || '1920x1080').split('x')[0]) || 1920,
        height: parseInt((fp.screenResolution || '1920x1080').split('x')[1]) || 1080,
        pixelRatio: adv.devicePixelRatio || 1,
      },
      hardware: {
        ...prev.hardware,
        cpuCores: s.cpuCores || prev.hardware.cpuCores,
        memoryGB: s.memoryGB || prev.hardware.memoryGB,
        gpuVendor: adv.webglVendor || prev.hardware.gpuVendor,
        gpuRenderer: adv.webglRenderer || prev.hardware.gpuRenderer,
      },
    }));
  };

  /* ── Submit handler ── */
  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = {
      ...(profile || {}),
      name: formData.name,
      description: formData.description || '',
      cookie: formData.cookie || '',
      startUrl: formData.startupPage || '',
      quantity: formData.quantity || 1,
      engine: formData.engine,
      startupPage: formData.startupPage || '',
      windowWidth: formData.windowWidth,
      windowHeight: formData.windowHeight,
      quickGenerate: formData.quickGenerate,
      // New granular sections
      identity: formData.identity,
      display: formData.display,
      hardware: formData.hardware,
      canvas: formData.canvas,
      webgl: formData.webgl,
      audio: formData.audio,
      media: formData.media,
      network: formData.network,
      battery: formData.battery,
      proxy: formData.proxy,
      // Legacy fingerprint/settings for backend compatibility
      fingerprint: {
        os: formData.quickGenerate.os,
        browser: formData.quickGenerate.browser || 'Chrome',
        browserVersion: '136.0.7103.93',
        userAgent: formData.identity.userAgent,
        language: formData.identity.locale,
        screenResolution: `${formData.display.width}x${formData.display.height}`,
        timezone: formData.identity.timezone,
        webgl: formData.webgl.enabled,
        canvas: formData.canvas.enabled,
        audio: formData.audio.enabled,
      },
      settings: {
        engine: formData.engine,
        cpuCores: formData.hardware.cpuCores,
        memoryGB: formData.hardware.memoryGB,
        language: formData.identity.locale,
        timezone: formData.identity.timezone,
        webrtc: formData.network.webrtcPolicy,
        proxy: formData.proxy,
        advanced: {
          platform: formData.identity.platform,
          dnt: formData.network.doNotTrack === 'true',
          devicePixelRatio: formData.display.pixelRatio,
          maxTouchPoints: formData.network.maxTouchPoints,
          webglVendor: formData.hardware.gpuVendor,
          webglRenderer: formData.hardware.gpuRenderer,
          plugins: 5,
          languages: formData.identity.languages,
        },
      },
    };
    onSave(payload);
  };

  /* ── Tab button label for Generate ── */
  const activeTabObj = TABS.find(t => t.id === activeTab);
  const generateLabel = activeTab === 'general'
    ? t('profileForm.randomize', '⟳ Generate')
    : `⟳ Generate ${activeTabObj?.label || ''}`;

  /* ═══════════════ RENDER ═══════════════ */
  return (
    <div className="npf-container">
      {/* ─── Header ─── */}
      <div className="npf-header">
        <div className="npf-header-left">
          <button type="button" className="npf-back-btn" onClick={onCancel}>
            <ArrowLeft size={18} />
          </button>
          <h2 className="npf-title">
            {profile ? t('profileForm.header.edit', 'Edit Profile') : t('profileForm.header.create', 'New Profile')}
          </h2>
        </div>
        <div className="npf-header-actions">
          <button type="button" className="btn npf-generate-btn" onClick={handleGenerate}>
            <RefreshCw size={14} /> {generateLabel}
          </button>
          <button type="button" className="btn" onClick={onCancel}>Cancel</button>
          <button type="button" className="btn btn-success npf-create-btn" onClick={handleSubmit}>
            {profile ? 'Save' : 'Create'}
          </button>
        </div>
      </div>

      <div className="npf-body">
        {/* ─── Left Sidebar ─── */}
        <nav className="npf-sidebar">
          {TABS.map(tab => {
            const IconComp = tab.icon;
            const isActive = activeTab === tab.id;
            const sectionEnabled = tab.id !== 'general' && formData[tab.id]?.enabled;
            return (
              <button
                key={tab.id}
                type="button"
                className={`npf-nav-item ${isActive ? 'active' : ''} ${sectionEnabled ? 'section-enabled' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <IconComp size={16} />
                <span>{tab.label}</span>
                {tab.id !== 'general' && (
                  <span className={`npf-nav-dot ${sectionEnabled ? 'dot-enabled' : 'dot-disabled'}`} />
                )}
              </button>
            );
          })}
        </nav>

        {/* ─── Content Area ─── */}
        <div className="npf-content">
          <form id="profile-edit-form" onSubmit={handleSubmit}>

            {/* ═══════ GENERAL ═══════ */}
            {activeTab === 'general' && (
              <div className="npf-section">
                <SectionHeader
                  title="Profile Settings"
                  subtitle="Configure the profile name and fingerprint generation options."
                />
                <div className="npf-divider" />

                <div className="npf-field-row">
                  <div className="npf-field" style={{ flex: 2 }}>
                    <label>Profile Name</label>
                    <input
                      type="text"
                      className="npf-input"
                      value={formData.name}
                      onChange={(e) => updateField('name', e.target.value)}
                      placeholder={`Profile ${Math.floor(Math.random() * 9000 + 1000)}`}
                    />
                  </div>
                  <div className="npf-field" style={{ flex: 1 }}>
                    <label>Quantity</label>
                    <input
                      type="number"
                      className="npf-input"
                      value={formData.quantity}
                      min={1}
                      max={100}
                      onChange={(e) => updateField('quantity', parseInt(e.target.value) || 1)}
                    />
                  </div>
                </div>

                <fieldset className="npf-fieldset">
                  <legend>Browser Engine</legend>
                  <div className="npf-field">
                    <label>Engine</label>
                    <select
                      className="npf-input"
                      value={formData.engine}
                      onChange={(e) => updateField('engine', e.target.value)}
                    >
                      <option value="playwright">Playwright Chromium</option>
                      <option value="cdp">CDP Chromium</option>
                    </select>
                  </div>
                  <p className="npf-hint-text">
                    Chromium supports full fingerprint injection. Firefox has limited CDP support.
                  </p>
                </fieldset>

                <fieldset className="npf-fieldset">
                  <legend>Startup</legend>
                  <div className="npf-field">
                    <label>Startup Page</label>
                    <input
                      type="text"
                      className="npf-input"
                      value={formData.startupPage}
                      onChange={(e) => updateField('startupPage', e.target.value)}
                      placeholder="ex: https://browser.ongbantat.store"
                    />
                  </div>
                  <div className="npf-field-row">
                    <div className="npf-field">
                      <label>Window Width (px)</label>
                      <input
                        type="number"
                        className="npf-input"
                        value={formData.windowWidth}
                        onChange={(e) => updateField('windowWidth', parseInt(e.target.value) || 0)}
                      />
                    </div>
                    <div className="npf-field">
                      <label>Window Height (px)</label>
                      <input
                        type="number"
                        className="npf-input"
                        value={formData.windowHeight}
                        onChange={(e) => updateField('windowHeight', parseInt(e.target.value) || 0)}
                      />
                    </div>
                  </div>
                  <p className="npf-hint-text">Leave width/height at 0 to use the OS default window size.</p>
                </fieldset>

                <fieldset className="npf-fieldset">
                  <legend>Quick Generate</legend>
                  <div className="npf-field-row npf-three-col">
                    <div className="npf-field">
                      <label>OS</label>
                      <select
                        className="npf-input"
                        value={formData.quickGenerate.os}
                        onChange={(e) => setFormData(prev => ({
                          ...prev, quickGenerate: { ...prev.quickGenerate, os: e.target.value }
                        }))}
                      >
                        <option value="Windows">Windows</option>
                        <option value="macOS">macOS</option>
                        <option value="Linux">Linux</option>
                      </select>
                    </div>
                    <div className="npf-field">
                      <label>Browser</label>
                      <select
                        className="npf-input"
                        value={formData.quickGenerate.browser}
                        onChange={(e) => setFormData(prev => ({
                          ...prev, quickGenerate: { ...prev.quickGenerate, browser: e.target.value }
                        }))}
                      >
                        <option value="Chrome">Chrome</option>
                        <option value="Firefox">Firefox</option>
                        <option value="Edge">Edge</option>
                      </select>
                    </div>
                    <div className="npf-field">
                      <label>Device</label>
                      <select
                        className="npf-input"
                        value={formData.quickGenerate.device}
                        onChange={(e) => setFormData(prev => ({
                          ...prev, quickGenerate: { ...prev.quickGenerate, device: e.target.value }
                        }))}
                      >
                        <option value="Desktop">Desktop</option>
                        <option value="Mobile">Mobile</option>
                        <option value="Tablet">Tablet</option>
                      </select>
                    </div>
                  </div>
                  <p className="npf-hint-text">Use "Generate" to auto-fill all sections based on these settings. You can then customize each section individually by changing these settings.</p>
                </fieldset>
              </div>
            )}

            {/* ═══════ IDENTITY ═══════ */}
            {activeTab === 'identity' && (
              <div className={`npf-section ${!formData.identity.enabled ? 'npf-section-disabled' : ''}`}>
                <SectionHeader
                  title="Browser Identity"
                  subtitle="User Agent string, platform, locale, timezone, and language preferences"
                  enabled={formData.identity.enabled}
                  onToggle={(v) => updateSection('identity', 'enabled', v)}
                />
                <div className="npf-divider" />

                <div className="npf-field">
                  <label>User-Agent</label>
                  <input
                    type="text"
                    className="npf-input"
                    value={formData.identity.userAgent}
                    onChange={(e) => updateSection('identity', 'userAgent', e.target.value)}
                  />
                </div>

                <div className="npf-field-row">
                  <div className="npf-field">
                    <label>Platform</label>
                    <input
                      type="text"
                      className="npf-input"
                      value={formData.identity.platform}
                      onChange={(e) => updateSection('identity', 'platform', e.target.value)}
                    />
                  </div>
                  <div className="npf-field">
                    <label>Locale</label>
                    <input
                      type="text"
                      className="npf-input"
                      value={formData.identity.locale}
                      onChange={(e) => updateSection('identity', 'locale', e.target.value)}
                    />
                  </div>
                </div>

                <div className="npf-field-row">
                  <div className="npf-field">
                    <label>Timezone</label>
                    <input
                      type="text"
                      className="npf-input"
                      value={formData.identity.timezone}
                      onChange={(e) => updateSection('identity', 'timezone', e.target.value)}
                    />
                  </div>
                  <div className="npf-field">
                    <label>Languages (comma-separated)</label>
                    <input
                      type="text"
                      className="npf-input"
                      value={formData.identity.languages}
                      onChange={(e) => updateSection('identity', 'languages', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ═══════ DISPLAY ═══════ */}
            {activeTab === 'display' && (
              <div className={`npf-section ${!formData.display.enabled ? 'npf-section-disabled' : ''}`}>
                <SectionHeader
                  title="Display & Screen"
                  subtitle="Screen resolution, color depth, and device pixel ratio"
                  enabled={formData.display.enabled}
                  onToggle={(v) => updateSection('display', 'enabled', v)}
                />
                <div className="npf-divider" />

                {formData.display.enabled && (
                  <div className="npf-warning-banner">
                    <span className="npf-warning-icon">⚠</span>
                    <span>Enabling Display &amp; Screen injection may trigger Cloudflare bot detection. Disable this category if you need to bypass Cloudflare challenges.</span>
                  </div>
                )}

                <div className="npf-field">
                  <label>Resolution Preset</label>
                  <select
                    className="npf-input"
                    value={formData.display.preset}
                    onChange={(e) => {
                      const val = e.target.value;
                      updateSection('display', 'preset', val);
                      if (val !== 'Custom') {
                        const [w, h] = val.split('x').map(Number);
                        setFormData(prev => ({
                          ...prev, display: { ...prev.display, preset: val, width: w, height: h }
                        }));
                      }
                    }}
                  >
                    <option value="Custom">Custom</option>
                    <option value="1920x1080">1920 × 1080 (Full HD)</option>
                    <option value="2560x1440">2560 × 1440 (2K)</option>
                    <option value="3840x2160">3840 × 2160 (4K)</option>
                    <option value="1366x768">1366 × 768</option>
                    <option value="1536x864">1536 × 864</option>
                    <option value="1440x900">1440 × 900</option>
                    <option value="1680x1050">1680 × 1050</option>
                    <option value="1280x720">1280 × 720 (HD)</option>
                  </select>
                </div>

                <div className="npf-field-row">
                  <div className="npf-field">
                    <label>Width (px)</label>
                    <input
                      type="number"
                      className="npf-input"
                      value={formData.display.width}
                      onChange={(e) => updateSection('display', 'width', parseInt(e.target.value) || 0)}
                    />
                  </div>
                  <div className="npf-field">
                    <label>Height (px)</label>
                    <input
                      type="number"
                      className="npf-input"
                      value={formData.display.height}
                      onChange={(e) => updateSection('display', 'height', parseInt(e.target.value) || 0)}
                    />
                  </div>
                </div>

                <div className="npf-field-row">
                  <div className="npf-field">
                    <label>Color Depth (bits)</label>
                    <input
                      type="number"
                      className="npf-input"
                      value={formData.display.colorDepth}
                      onChange={(e) => updateSection('display', 'colorDepth', parseInt(e.target.value) || 24)}
                    />
                  </div>
                  <div className="npf-field">
                    <label>Pixel Ratio</label>
                    <input
                      type="number"
                      className="npf-input"
                      step="0.01"
                      value={formData.display.pixelRatio}
                      onChange={(e) => updateSection('display', 'pixelRatio', parseFloat(e.target.value) || 1)}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ═══════ HARDWARE ═══════ */}
            {activeTab === 'hardware' && (
              <div className={`npf-section ${!formData.hardware.enabled ? 'npf-section-disabled' : ''}`}>
                <SectionHeader
                  title="Hardware"
                  subtitle="CPU cores, memory, and GPU configuration"
                  enabled={formData.hardware.enabled}
                  onToggle={(v) => updateSection('hardware', 'enabled', v)}
                />
                <div className="npf-divider" />

                <div className="npf-field-row">
                  <div className="npf-field">
                    <label>CPU Cores</label>
                    <select
                      className="npf-input"
                      value={formData.hardware.cpuCores}
                      onChange={(e) => updateSection('hardware', 'cpuCores', parseInt(e.target.value))}
                    >
                      {[2, 4, 6, 8, 10, 12, 16].map(c => (
                        <option key={c} value={c}>{c} cores</option>
                      ))}
                    </select>
                  </div>
                  <div className="npf-field">
                    <label>Memory (GB)</label>
                    <select
                      className="npf-input"
                      value={formData.hardware.memoryGB}
                      onChange={(e) => updateSection('hardware', 'memoryGB', parseInt(e.target.value))}
                    >
                      {[2, 4, 8, 16, 32, 64].map(m => (
                        <option key={m} value={m}>{m} GB</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="npf-field">
                  <label>GPU Vendor</label>
                  <input
                    type="text"
                    className="npf-input"
                    value={formData.hardware.gpuVendor}
                    onChange={(e) => updateSection('hardware', 'gpuVendor', e.target.value)}
                  />
                </div>
                <div className="npf-field">
                  <label>GPU Renderer</label>
                  <input
                    type="text"
                    className="npf-input"
                    value={formData.hardware.gpuRenderer}
                    onChange={(e) => updateSection('hardware', 'gpuRenderer', e.target.value)}
                  />
                </div>
              </div>
            )}

            {/* ═══════ CANVAS ═══════ */}
            {activeTab === 'canvas' && (
              <div className={`npf-section ${!formData.canvas.enabled ? 'npf-section-disabled' : ''}`}>
                <SectionHeader
                  title="Canvas Fingerprint"
                  subtitle="Pixel-level noise injection to randomize canvas fingerprint"
                  enabled={formData.canvas.enabled}
                  onToggle={(v) => updateSection('canvas', 'enabled', v)}
                />
                <div className="npf-divider" />

                <p className="npf-info-text">
                  Canvas noise adds subtle pixel-level randomization to prevent fingerprint tracking via HTML5 canvas rendering.
                </p>

                <div className="npf-field-row">
                  <div className="npf-field">
                    <label>Noise Seed</label>
                    <input
                      type="number"
                      className="npf-input"
                      value={formData.canvas.noiseSeed}
                      onChange={(e) => updateSection('canvas', 'noiseSeed', parseInt(e.target.value) || 0)}
                    />
                  </div>
                  <div className="npf-field">
                    <label>Noise Intensity (0-10)</label>
                    <input
                      type="number"
                      className="npf-input"
                      min={0}
                      max={10}
                      value={formData.canvas.noiseIntensity}
                      onChange={(e) => updateSection('canvas', 'noiseIntensity', Math.min(10, Math.max(0, parseInt(e.target.value) || 0)))}
                    />
                  </div>
                </div>

                <div className="npf-summary-box">
                  <div className="npf-summary-row">
                    <span>Current seed:</span>
                    <span>{formData.canvas.noiseSeed}</span>
                  </div>
                  <div className="npf-summary-row">
                    <span>Intensity:</span>
                    <span>{formData.canvas.noiseIntensity} / 10</span>
                  </div>
                </div>
              </div>
            )}

            {/* ═══════ WEBGL ═══════ */}
            {activeTab === 'webgl' && (
              <div className={`npf-section ${!formData.webgl.enabled ? 'npf-section-disabled' : ''}`}>
                <SectionHeader
                  title="WebGL Fingerprint"
                  subtitle="WebGL noise, texture size parameters, and supported extensions"
                  enabled={formData.webgl.enabled}
                  onToggle={(v) => updateSection('webgl', 'enabled', v)}
                />
                <div className="npf-divider" />

                <p className="npf-info-text">
                  WebGL overrides spoof GPU capabilities and inject deterministic hash noise to prevent WebGL-based fingerprinting.
                </p>

                <div className="npf-field-row">
                  <div className="npf-field">
                    <label>Noise Seed</label>
                    <input
                      type="number"
                      className="npf-input"
                      value={formData.webgl.noiseSeed}
                      onChange={(e) => updateSection('webgl', 'noiseSeed', parseInt(e.target.value) || 0)}
                    />
                  </div>
                  <div className="npf-field">
                    <label>MAX_TEXTURE_SIZE</label>
                    <input
                      type="number"
                      className="npf-input"
                      value={formData.webgl.maxTextureSize}
                      onChange={(e) => updateSection('webgl', 'maxTextureSize', parseInt(e.target.value) || 16384)}
                    />
                  </div>
                </div>

                <div className="npf-field">
                  <label>Extensions (comma-separated)</label>
                  <input
                    type="text"
                    className="npf-input"
                    value={formData.webgl.extensions}
                    onChange={(e) => updateSection('webgl', 'extensions', e.target.value)}
                    placeholder="WEBGL_debug_renderer_info, OES_texture_float..."
                  />
                </div>

                <div className="npf-summary-box">
                  <div className="npf-summary-row">
                    <span>Extensions count:</span>
                    <span>{formData.webgl.extensions ? formData.webgl.extensions.split(',').filter(x => x.trim()).length : 0}</span>
                  </div>
                  <div className="npf-summary-row">
                    <span>Noise seed:</span>
                    <span>{formData.webgl.noiseSeed}</span>
                  </div>
                </div>
              </div>
            )}

            {/* ═══════ AUDIO ═══════ */}
            {activeTab === 'audio' && (
              <div className={`npf-section ${!formData.audio.enabled ? 'npf-section-disabled' : ''}`}>
                <SectionHeader
                  title="Audio Fingerprint"
                  subtitle="AudioContext sample rate, channel count, and noise injection"
                  enabled={formData.audio.enabled}
                  onToggle={(v) => updateSection('audio', 'enabled', v)}
                />
                <div className="npf-divider" />

                <div className="npf-field-row npf-three-col">
                  <div className="npf-field">
                    <label>Sample Rate (Hz)</label>
                    <select
                      className="npf-input"
                      value={formData.audio.sampleRate}
                      onChange={(e) => updateSection('audio', 'sampleRate', parseInt(e.target.value))}
                    >
                      <option value={44100}>44,100 Hz</option>
                      <option value={48000}>48,000 Hz</option>
                      <option value={96000}>96,000 Hz</option>
                    </select>
                  </div>
                  <div className="npf-field">
                    <label>Channels</label>
                    <select
                      className="npf-input"
                      value={formData.audio.channels}
                      onChange={(e) => updateSection('audio', 'channels', e.target.value)}
                    >
                      <option value="mono">Mono (1ch)</option>
                      <option value="stereo">Stereo (2ch)</option>
                      <option value="5.1">5.1 Surround (6ch)</option>
                    </select>
                  </div>
                  <div className="npf-field">
                    <label>Noise Seed</label>
                    <input
                      type="number"
                      className="npf-input"
                      value={formData.audio.noiseSeed}
                      onChange={(e) => updateSection('audio', 'noiseSeed', parseInt(e.target.value) || 0)}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ═══════ MEDIA ═══════ */}
            {activeTab === 'media' && (
              <div className={`npf-section ${!formData.media.enabled ? 'npf-section-disabled' : ''}`}>
                <SectionHeader
                  title="Media Devices"
                  subtitle="Number of speakers, microphones, and webcams reported to the browser"
                  enabled={formData.media.enabled}
                  onToggle={(v) => updateSection('media', 'enabled', v)}
                />
                <div className="npf-divider" />

                <div className="npf-field-row npf-three-col">
                  <div className="npf-field">
                    <label>Speakers</label>
                    <input
                      type="number"
                      className="npf-input"
                      min={0}
                      value={formData.media.speakers}
                      onChange={(e) => updateSection('media', 'speakers', parseInt(e.target.value) || 0)}
                    />
                  </div>
                  <div className="npf-field">
                    <label>Microphones</label>
                    <input
                      type="number"
                      className="npf-input"
                      min={0}
                      value={formData.media.microphones}
                      onChange={(e) => updateSection('media', 'microphones', parseInt(e.target.value) || 0)}
                    />
                  </div>
                  <div className="npf-field">
                    <label>Webcams</label>
                    <input
                      type="number"
                      className="npf-input"
                      min={0}
                      value={formData.media.webcams}
                      onChange={(e) => updateSection('media', 'webcams', parseInt(e.target.value) || 0)}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ═══════ NETWORK ═══════ */}
            {activeTab === 'network' && (
              <div className={`npf-section ${!formData.network.enabled ? 'npf-section-disabled' : ''}`}>
                <SectionHeader
                  title="Network & Navigator"
                  subtitle="WebRTC IP handling policy and navigator network/privacy properties"
                  enabled={formData.network.enabled}
                  onToggle={(v) => updateSection('network', 'enabled', v)}
                />
                <div className="npf-divider" />

                <fieldset className="npf-fieldset">
                  <legend>WebRTC</legend>
                  <div className="npf-field">
                    <label>IP Handling Policy</label>
                    <select
                      className="npf-input"
                      value={formData.network.webrtcPolicy}
                      onChange={(e) => updateSection('network', 'webrtcPolicy', e.target.value)}
                    >
                      <option value="default">Default (allow all)</option>
                      <option value="disable_non_proxied_udp">Disable non-proxied UDP</option>
                      <option value="default_public_interface_only">Default public interface only</option>
                      <option value="default_public_and_private_interfaces">Default public and private interfaces</option>
                    </select>
                  </div>
                  <p className="npf-hint-text">
                    Controls which IP addresses are exposed via WebRTC. Use "Disable non-proxied UDP" to prevent IP leaks when using a proxy.
                  </p>
                </fieldset>

                <fieldset className="npf-fieldset">
                  <legend>Navigator Properties</legend>
                  <div className="npf-field-row">
                    <div className="npf-field">
                      <label>Do Not Track</label>
                      <select
                        className="npf-input"
                        value={formData.network.doNotTrack}
                        onChange={(e) => updateSection('network', 'doNotTrack', e.target.value)}
                      >
                        <option value="unspecified">Unspecified</option>
                        <option value="true">Enabled (1)</option>
                        <option value="false">Disabled (0)</option>
                      </select>
                    </div>
                    <div className="npf-field">
                      <label>Max Touch Points</label>
                      <input
                        type="number"
                        className="npf-input"
                        min={0}
                        value={formData.network.maxTouchPoints}
                        onChange={(e) => updateSection('network', 'maxTouchPoints', parseInt(e.target.value) || 0)}
                      />
                    </div>
                  </div>
                  <div className="npf-field-row">
                    <div className="npf-field">
                      <label>Connection Type</label>
                      <select
                        className="npf-input"
                        value={formData.network.connectionType}
                        onChange={(e) => updateSection('network', 'connectionType', e.target.value)}
                      >
                        <option value="4g">4G LTE</option>
                        <option value="3g">3G</option>
                        <option value="wifi">Wi-Fi</option>
                        <option value="ethernet">Ethernet</option>
                        <option value="bluetooth">Bluetooth</option>
                        <option value="cellular">Cellular</option>
                      </select>
                    </div>
                    <div className="npf-field">
                      <label>PDF Viewer</label>
                      <select
                        className="npf-input"
                        value={formData.network.pdfViewer}
                        onChange={(e) => updateSection('network', 'pdfViewer', e.target.value)}
                      >
                        <option value="enabled">Enabled</option>
                        <option value="disabled">Disabled</option>
                      </select>
                    </div>
                  </div>
                </fieldset>
              </div>
            )}

            {/* ═══════ BATTERY ═══════ */}
            {activeTab === 'battery' && (
              <div className={`npf-section ${!formData.battery.enabled ? 'npf-section-disabled' : ''}`}>
                <SectionHeader
                  title="Battery API"
                  subtitle="Spoof navigator.getBattery() to report custom charging state and level"
                  enabled={formData.battery.enabled}
                  onToggle={(v) => updateSection('battery', 'enabled', v)}
                />
                <div className="npf-divider" />

                <p className="npf-info-text">
                  Battery status can be used as a fingerprinting vector. Spoofing it prevents sites from using it to track you.
                </p>

                <div className="npf-field-row">
                  <div className="npf-field">
                    <label>Charging</label>
                    <select
                      className="npf-input"
                      value={formData.battery.charging}
                      onChange={(e) => updateSection('battery', 'charging', e.target.value)}
                    >
                      <option value="charging">Charging</option>
                      <option value="discharging">Discharging</option>
                    </select>
                  </div>
                  <div className="npf-field">
                    <label>Level (0.0 - 1.0)</label>
                    <input
                      type="number"
                      className="npf-input"
                      min={0}
                      max={1}
                      step={0.01}
                      value={formData.battery.level}
                      onChange={(e) => updateSection('battery', 'level', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                </div>

                <div className="npf-field-row">
                  <div className="npf-field">
                    <label>Charging Time (seconds)</label>
                    <input
                      type="number"
                      className="npf-input"
                      min={0}
                      value={formData.battery.chargingTime}
                      onChange={(e) => updateSection('battery', 'chargingTime', parseInt(e.target.value) || 0)}
                      disabled={formData.battery.charging !== 'charging'}
                    />
                  </div>
                  <div className="npf-field">
                    <label>Discharging Time (seconds)</label>
                    <input
                      type="number"
                      className="npf-input"
                      min={0}
                      value={formData.battery.dischargingTime || ''}
                      onChange={(e) => updateSection('battery', 'dischargingTime', parseInt(e.target.value) || 0)}
                      disabled={formData.battery.charging !== 'discharging'}
                      placeholder={formData.battery.charging === 'charging' ? '' : ''}
                    />
                  </div>
                </div>

                <div className="npf-summary-box">
                  <div className="npf-summary-row">
                    <span>Status:</span>
                    <span className={formData.battery.charging === 'charging' ? 'npf-status-charging' : 'npf-status-discharging'}>
                      {formData.battery.charging === 'charging' ? 'Charging' : 'Discharging'}
                    </span>
                  </div>
                  <div className="npf-summary-row">
                    <span>Level:</span>
                    <span>{Math.round(formData.battery.level * 100)}%</span>
                  </div>
                </div>
              </div>
            )}

          </form>
        </div>
      </div>
    </div>
  );
}

export default ProfileForm;
