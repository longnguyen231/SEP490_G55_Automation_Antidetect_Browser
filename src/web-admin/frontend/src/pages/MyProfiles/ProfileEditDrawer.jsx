import React, { useState, useEffect } from 'react';
import {
  Drawer, Button, Switch, Select, Input, Slider, InputNumber, message as antMessage,
} from 'antd';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';

const { TextArea } = Input;
const { Option } = Select;

// ─── Default values ──────────────────────────────────────────────────────────
const defaultFingerprint = {
  os: 'Windows',
  browser: 'Chrome',
  device: 'Desktop',
  browserVersion: '146.0.7680.165',
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.7680.165 Safari/537.36',
  language: 'en-US',
  screenResolution: '1920x1080',
  timezone: 'America/New_York',
  webgl: true,
  canvas: true,
  audio: true,
  colorDepth: 32,
  pixelRatio: 1,
};

const defaultSettings = {
  cpuCores: 8,
  memoryGB: 16,
  gpuVendor: 'Google Inc. (NVIDIA)',
  gpuRenderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)',
  proxy: { type: 'none', server: '', username: '', password: '' },
  language: 'en-US',
  timezone: 'America/New_York',
  webrtc: 'default',
  geolocation: { enabled: false, mode: 'ip', latitude: 0, longitude: 0, accuracy: 50, permission: 'ask' },
  mediaDevices: { audio: true, video: true },
  headless: false,
  engine: 'playwright',
  injectFingerprint: true,
  quantity: 1,
  startupPage: 'https://www.google.com',
  windowWidth: 0,
  windowHeight: 0,
  advanced: {
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
    cpuCores: 8,
    memoryGB: 16,
    gpuVendor: 'Google Inc. (NVIDIA)',
    gpuRenderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)',
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
  cookie: '',
  description: '',
};

// ─── Generate helpers ─────────────────────────────────────────────────────────
const randomFrom = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const LOCALES = [
  { code: 'en-US', tz: 'America/New_York', langs: 'en-US,en;q=0.9', plat: 'Win32' },
  { code: 'vi-VN', tz: 'Asia/Ho_Chi_Minh', langs: 'vi-VN,vi;q=0.9,en-US;q=0.8', plat: 'Win32' },
  { code: 'en-GB', tz: 'Europe/London', langs: 'en-GB,en;q=0.9', plat: 'Win32' },
  { code: 'fr-FR', tz: 'Europe/Paris', langs: 'fr-FR,fr;q=0.9,en-US;q=0.8', plat: 'Win32' },
  { code: 'ja-JP', tz: 'Asia/Tokyo', langs: 'ja-JP,ja;q=0.9,en-US;q=0.8', plat: 'Win32' },
  { code: 'ko-KR', tz: 'Asia/Seoul', langs: 'ko-KR,ko;q=0.9,en-US;q=0.8', plat: 'Win32' },
];

const SCREENS = ['1366x768', '1600x900', '1920x1080', '2560x1440'];

const GPU_LIST = [
  { v: 'Google Inc. (Intel)', r: 'ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11 vs_5_0)' },
  { v: 'Google Inc. (NVIDIA)', r: 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1650 Direct3D11 vs_5_0)' },
  { v: 'Google Inc. (NVIDIA)', r: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0)' },
  { v: 'Google Inc. (AMD)', r: 'ANGLE (AMD, AMD Radeon RX 580 Direct3D11 vs_5_0)' },
];

const BROWSER_VERSIONS = ['145.0.0.0', '144.0.0.0', '143.0.0.0', '142.0.0.0'];

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = {
  drawer: { background: '#0d0f11' },
  body: { background: '#0d0f11', padding: '0', color: '#e2e8f0' },
  tabBar: {
    display: 'flex', gap: '4px', padding: '12px 20px 0',
    borderBottom: '1px solid rgba(255,255,255,0.07)',
    background: '#0d0f11', flexWrap: 'wrap',
  },
  tabBtn: (active) => ({
    padding: '6px 14px', borderRadius: '8px 8px 0 0', border: 'none',
    cursor: 'pointer', fontSize: '12px', fontWeight: 600, transition: 'all 0.2s',
    background: active
      ? 'linear-gradient(135deg, #06b6d4, #3b82f6)'
      : 'rgba(255,255,255,0.05)',
    color: active ? '#fff' : 'rgba(255,255,255,0.55)',
  }),
  tabContent: {
    padding: '20px', overflowY: 'auto',
    height: 'calc(100vh - 170px)', background: '#0d0f11',
  },
  section: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '12px', padding: '16px', marginBottom: '16px',
  },
  sectionHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: '14px',
  },
  sectionTitle: { color: '#94a3b8', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' },
  label: { display: 'block', color: 'rgba(255,255,255,0.6)', fontSize: '12px', marginBottom: '6px', fontWeight: 500 },
  input: {
    background: '#1a1d23', border: '1px solid rgba(255,255,255,0.1)',
    color: 'white', borderRadius: '8px', padding: '8px 12px',
    width: '100%', fontSize: '13px', outline: 'none', boxSizing: 'border-box',
  },
  select: {
    background: '#1a1d23', border: '1px solid rgba(255,255,255,0.1)',
    color: 'white', borderRadius: '8px', padding: '8px 10px',
    width: '100%', fontSize: '13px', outline: 'none', cursor: 'pointer',
  },
  generateBtn: {
    background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
    color: 'white', border: 'none', borderRadius: '8px',
    padding: '6px 14px', cursor: 'pointer', fontSize: '12px', fontWeight: 600,
  },
  row: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' },
  formGroup: { marginBottom: '12px' },
  footer: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '14px 20px', borderTop: '1px solid rgba(255,255,255,0.07)',
    background: '#0d0f11',
  },
  cancelBtn: {
    background: 'transparent', border: '1px solid rgba(255,255,255,0.15)',
    color: 'rgba(255,255,255,0.7)', borderRadius: '8px',
    padding: '8px 22px', cursor: 'pointer', fontSize: '13px', fontWeight: 600,
  },
  saveBtn: {
    background: 'linear-gradient(135deg, #06b6d4, #3b82f6)',
    color: 'white', border: 'none', borderRadius: '8px',
    padding: '8px 28px', cursor: 'pointer', fontSize: '13px', fontWeight: 700,
    boxShadow: '0 4px 15px rgba(6,182,212,0.3)',
  },
};

const TABS = [
  'General', 'Identity', 'Display', 'Hardware',
  'Canvas', 'WebGL', 'Audio', 'Media', 'Network', 'Battery',
];

// ─── Sub-components ───────────────────────────────────────────────────────────
const FormRow = ({ children }) => <div style={S.row}>{children}</div>;
const FG = ({ label, children, style }) => (
  <div style={{ ...S.formGroup, ...style }}>
    <label style={S.label}>{label}</label>
    {children}
  </div>
);

const NativeSelect = ({ value, onChange, options }) => (
  <select style={S.select} value={value} onChange={e => onChange(e.target.value)}>
    {options.map(o => (
      <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>
    ))}
  </select>
);

const NativeInput = ({ value, onChange, placeholder, type = 'text' }) => (
  <input
    type={type}
    style={S.input}
    value={value ?? ''}
    onChange={e => onChange(type === 'number' ? Number(e.target.value) : e.target.value)}
    placeholder={placeholder}
  />
);

const NativeTextArea = ({ value, onChange, placeholder, rows = 3 }) => (
  <textarea
    style={{ ...S.input, resize: 'vertical', minHeight: `${rows * 28}px` }}
    value={value ?? ''}
    onChange={e => onChange(e.target.value)}
    placeholder={placeholder}
  />
);

const SectionToggle = ({ enabled, onChange, title }) => (
  <div style={S.sectionHeader}>
    <span style={S.sectionTitle}>{title}</span>
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <span style={{ color: enabled ? '#22d3ee' : 'rgba(255,255,255,0.3)', fontSize: '11px' }}>
        {enabled ? 'ENABLED' : 'DISABLED'}
      </span>
      <Switch
        size="small"
        checked={enabled}
        onChange={onChange}
        style={{ background: enabled ? '#06b6d4' : undefined }}
      />
    </div>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ProfileEditDrawer({ visible, profile, onClose, userId, onSaved }) {
  const [activeTab, setActiveTab] = useState('General');
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState(null);
  const [sectionToggles, setSectionToggles] = useState({
    identity: false, display: false, hardware: false, canvas: false,
    webgl: false, audio: false, media: false, network: false, battery: false,
  });

  // Initialize form data from profile
  useEffect(() => {
    if (!profile || !visible) return;
    const fp = { ...defaultFingerprint, ...(profile.fingerprint || {}) };
    const st = { ...defaultSettings, ...(profile.settings || {}) };
    // Merge nested objects
    ['proxy', 'advanced', 'display', 'hardware', 'canvas', 'webgl', 'audio', 'media', 'network', 'battery', 'identity'].forEach(key => {
      st[key] = { ...(defaultSettings[key] || {}), ...(st[key] || {}) };
    });
    setFormData({ ...profile, fingerprint: fp, settings: st });

    const sections = ['identity', 'display', 'hardware', 'canvas', 'webgl', 'audio', 'media', 'network', 'battery'];
    const toggles = {};
    sections.forEach(s => { toggles[s] = !!(st[s]?.enabled); });
    setSectionToggles(toggles);
    setActiveTab('General');
  }, [profile, visible]);

  if (!formData) return null;

  // ─── Setters ────────────────────────────────────────────────────────────────
  const setFP = (key, val) => setFormData(p => ({ ...p, fingerprint: { ...p.fingerprint, [key]: val } }));
  const setST = (key, val) => setFormData(p => ({ ...p, settings: { ...p.settings, [key]: val } }));
  const setNestedST = (section, key, val) => setFormData(p => ({
    ...p,
    settings: { ...p.settings, [section]: { ...(p.settings[section] || {}), [key]: val } },
  }));
  const setToggle = (section, val) => setSectionToggles(prev => ({ ...prev, [section]: val }));

  // ─── Generate All ────────────────────────────────────────────────────────────
  const generateAll = () => {
    const loc = randomFrom(LOCALES);
    const bv = randomFrom(BROWSER_VERSIONS);
    const os = randomFrom(['Windows', 'macOS', 'Linux']);
    const plat = os === 'Windows' ? 'Win32' : os === 'macOS' ? 'MacIntel' : 'Linux x86_64';
    let ua;
    if (os === 'Windows') ua = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${bv} Safari/537.36`;
    else if (os === 'macOS') ua = `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${bv} Safari/537.36`;
    else ua = `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${bv} Safari/537.36`;

    const gpu = randomFrom(GPU_LIST);
    const screen = randomFrom(SCREENS);

    setFormData(prev => ({
      ...prev,
      fingerprint: {
        ...prev.fingerprint,
        os, browser: 'Chrome', browserVersion: bv, userAgent: ua,
        language: loc.code, timezone: loc.tz,
        screenResolution: screen,
        colorDepth: randomFrom([24, 32]),
        pixelRatio: randomFrom([1, 1, 1, 1.25, 1.5, 2]),
        canvasNoise: randomInt(100000000, 2100000000),
        canvasNoiseIntensity: randomFrom([1, 2, 3, 4, 5]),
        webglNoise: randomInt(100000000, 2100000000),
        maxTextureSize: randomFrom([4096, 8192, 16384]),
        audioNoise: randomInt(100000000, 2100000000),
        audioSampleRate: randomFrom([44100, 48000, 96000]),
        audioChannels: randomFrom(['Mono', 'Stereo', 'Surround']),
        batteryCharging: randomFrom(['Yes', 'No']),
        batteryLevel: Number((Math.random() * 0.9 + 0.1).toFixed(2)),
        batteryDischargingTime: randomInt(5000, 20000),
        connectionType: randomFrom(['Ethernet', 'Wi-Fi']),
        pdfViewer: randomFrom(['Enabled', 'Disabled']),
        maxTouchPoints: 0,
        platform: plat,
        languages: loc.langs,
      },
      settings: {
        ...prev.settings,
        language: loc.code, timezone: loc.tz,
        cpuCores: randomFrom([2, 4, 6, 8, 12, 16]),
        memoryGB: randomFrom([4, 8, 16, 32]),
        gpuVendor: gpu.v, gpuRenderer: gpu.r,
        advanced: { ...prev.settings.advanced, platform: plat, languages: loc.langs },
      },
    }));
    antMessage.success('Generated all fingerprint values!');
  };

  // ─── Per-section generates ────────────────────────────────────────────────────
  const generateIdentity = () => {
    const loc = randomFrom(LOCALES);
    const bv = randomFrom(BROWSER_VERSIONS);
    const os = randomFrom(['Windows', 'macOS', 'Linux']);
    const plat = os === 'Windows' ? 'Win32' : os === 'macOS' ? 'MacIntel' : 'Linux x86_64';
    let ua;
    if (os === 'Windows') ua = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${bv} Safari/537.36`;
    else if (os === 'macOS') ua = `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${bv} Safari/537.36`;
    else ua = `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${bv} Safari/537.36`;
    setFormData(p => ({
      ...p,
      fingerprint: { ...p.fingerprint, userAgent: ua, language: loc.code, timezone: loc.tz, platform: plat, languages: loc.langs, maxTouchPoints: 0 },
      settings: { ...p.settings, language: loc.code, timezone: loc.tz, advanced: { ...p.settings.advanced, platform: plat, languages: loc.langs } },
    }));
    antMessage.success('Identity generated!');
  };

  const generateDisplay = () => {
    setFP('screenResolution', randomFrom(SCREENS));
    setFP('colorDepth', randomFrom([24, 32]));
    setFP('pixelRatio', randomFrom([1, 1.25, 1.5, 2]));
    antMessage.success('Display generated!');
  };

  const generateHardware = () => {
    const gpu = randomFrom(GPU_LIST);
    setST('cpuCores', randomFrom([2, 4, 6, 8, 12, 16]));
    setST('memoryGB', randomFrom([4, 8, 16, 32]));
    setST('gpuVendor', gpu.v);
    setST('gpuRenderer', gpu.r);
    antMessage.success('Hardware generated!');
  };

  const generateCanvas = () => {
    setNestedST('canvas', 'noiseSeed', randomInt(100000000, 2100000000));
    setNestedST('canvas', 'noiseIntensity', randomFrom([1, 2, 3, 4, 5]));
    antMessage.success('Canvas generated!');
  };

  const generateWebGL = () => {
    setNestedST('webgl', 'noiseSeed', randomInt(100000000, 2100000000));
    setNestedST('webgl', 'maxTextureSize', randomFrom([4096, 8192, 16384]));
    antMessage.success('WebGL generated!');
  };

  const generateAudio = () => {
    setNestedST('audio', 'noiseSeed', randomInt(100000000, 2100000000));
    setNestedST('audio', 'sampleRate', randomFrom([44100, 48000, 96000]));
    setNestedST('audio', 'channels', randomFrom(['Mono', 'Stereo', 'Surround']));
    antMessage.success('Audio generated!');
  };

  const generateMedia = () => {
    setNestedST('media', 'speakers', randomInt(1, 3));
    setNestedST('media', 'microphones', randomInt(1, 2));
    setNestedST('media', 'webcams', randomInt(0, 1));
    antMessage.success('Media generated!');
  };

  const generateNetwork = () => {
    setNestedST('network', 'connectionType', randomFrom(['Ethernet', 'Wi-Fi', 'Cellular']));
    setNestedST('network', 'pdfViewer', randomFrom(['Enabled', 'Disabled']));
    antMessage.success('Network generated!');
  };

  const generateBattery = () => {
    setNestedST('battery', 'charging', randomFrom(['Yes', 'No']));
    setNestedST('battery', 'level', Number((Math.random() * 0.9 + 0.1).toFixed(2)));
    setNestedST('battery', 'dischargingTime', randomInt(5000, 20000));
    antMessage.success('Battery generated!');
  };

  // ─── Save ────────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!userId || !profile?.id) {
      antMessage.error('Missing user or profile ID');
      return;
    }
    setSaving(true);
    try {
      const finalSettings = { ...formData.settings };
      ['identity', 'display', 'hardware', 'canvas', 'webgl', 'audio', 'media', 'network', 'battery'].forEach(section => {
        finalSettings[section] = { ...(finalSettings[section] || {}), enabled: !!sectionToggles[section] };
      });
      const payload = { ...formData, settings: finalSettings, updatedAt: Date.now() };
      await setDoc(doc(db, `users/${userId}/profiles`, profile.id), payload);
      antMessage.success('Profile saved!');
      if (onSaved) onSaved();
      onClose();
    } catch (err) {
      console.error(err);
      antMessage.error('Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  // ─── Shorthand ───────────────────────────────────────────────────────────────
  const fp = formData.fingerprint;
  const st = formData.settings;

  // ─── Tab content renderers ───────────────────────────────────────────────────

  const renderGeneral = () => (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
        <button style={S.generateBtn} onClick={generateAll}>⚡ Generate All</button>
      </div>

      <div style={S.section}>
        <div style={{ ...S.sectionHeader, marginBottom: '14px' }}>
          <span style={S.sectionTitle}>Profile Info</span>
        </div>
        <FormRow>
          <FG label="Profile Name">
            <NativeInput value={formData.name} onChange={v => setFormData(p => ({ ...p, name: v }))} placeholder="e.g. Amazon US Account" />
          </FG>
          <FG label="Startup Page">
            <NativeInput value={st.startupPage} onChange={v => setST('startupPage', v)} placeholder="https://www.google.com" />
          </FG>
        </FormRow>
        <FG label="Internal Note">
          <NativeTextArea value={formData.note} onChange={v => setFormData(p => ({ ...p, note: v }))} placeholder="Add some notes..." rows={2} />
        </FG>
      </div>

      <div style={S.section}>
        <div style={{ ...S.sectionHeader, marginBottom: '14px' }}>
          <span style={S.sectionTitle}>Browser Settings</span>
        </div>
        <FormRow>
          <FG label="Browser Engine">
            <NativeSelect
              value={st.engine}
              onChange={v => setST('engine', v)}
              options={[
                { value: 'playwright', label: 'Chromium (Playwright)' },
                { value: 'playwright-firefox', label: 'Firefox (Playwright)' },
                { value: 'camoufox', label: 'Camoufox' },
                { value: 'cloakbrowser', label: 'CloakBrowser' },
              ]}
            />
          </FG>
          <FG label="OS">
            <NativeSelect
              value={fp.os}
              onChange={v => setFP('os', v)}
              options={['Windows', 'macOS', 'Linux']}
            />
          </FG>
        </FormRow>
        <FormRow>
          <FG label="Browser Version">
            <NativeInput value={fp.browserVersion} onChange={v => setFP('browserVersion', v)} placeholder="146.0.7680.165" />
          </FG>
          <FG label="Inject Fingerprint">
            <div style={{ paddingTop: '6px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Switch
                checked={!!st.injectFingerprint}
                onChange={v => setST('injectFingerprint', v)}
                style={{ background: st.injectFingerprint ? '#06b6d4' : undefined }}
              />
              <span style={{ color: st.injectFingerprint ? '#22d3ee' : 'rgba(255,255,255,0.4)', fontSize: '12px' }}>
                {st.injectFingerprint ? 'Enabled' : 'Disabled'}
              </span>
            </div>
          </FG>
        </FormRow>
      </div>

      <div style={S.section}>
        <div style={{ ...S.sectionHeader, marginBottom: '14px' }}>
          <span style={S.sectionTitle}>Proxy Settings</span>
        </div>
        <FG label="Proxy Type">
          <NativeSelect
            value={st.proxy?.type || 'none'}
            onChange={v => setNestedST('proxy', 'type', v)}
            options={[
              { value: 'none', label: 'Direct (No Proxy)' },
              { value: 'http', label: 'HTTP / HTTPS' },
              { value: 'socks5', label: 'SOCKS5' },
            ]}
          />
        </FG>
        {st.proxy?.type && st.proxy.type !== 'none' && (
          <>
            <FG label="Server (IP:Port)">
              <NativeInput value={st.proxy?.server} onChange={v => setNestedST('proxy', 'server', v)} placeholder="192.168.1.1:8080" />
            </FG>
            <FormRow>
              <FG label="Username">
                <NativeInput value={st.proxy?.username} onChange={v => setNestedST('proxy', 'username', v)} placeholder="Optional" />
              </FG>
              <FG label="Password">
                <NativeInput value={st.proxy?.password} onChange={v => setNestedST('proxy', 'password', v)} placeholder="Optional" type="password" />
              </FG>
            </FormRow>
          </>
        )}
      </div>
    </div>
  );

  const renderIdentity = () => (
    <div>
      <div style={S.section}>
        <SectionToggle enabled={sectionToggles.identity} onChange={v => setToggle('identity', v)} title="Identity Spoofing" />
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
          <button style={S.generateBtn} onClick={generateIdentity}>⚡ Generate</button>
        </div>
        <FG label="User Agent">
          <NativeTextArea value={fp.userAgent} onChange={v => setFP('userAgent', v)} placeholder="Mozilla/5.0..." rows={3} />
        </FG>
        <FormRow>
          <FG label="Language / Locale">
            <NativeSelect
              value={fp.language}
              onChange={v => setFP('language', v)}
              options={[
                { value: 'en-US', label: 'en-US (English, US)' },
                { value: 'vi-VN', label: 'vi-VN (Vietnamese)' },
                { value: 'en-GB', label: 'en-GB (English, UK)' },
                { value: 'fr-FR', label: 'fr-FR (French)' },
                { value: 'ja-JP', label: 'ja-JP (Japanese)' },
                { value: 'ko-KR', label: 'ko-KR (Korean)' },
                { value: 'de-DE', label: 'de-DE (German)' },
                { value: 'zh-CN', label: 'zh-CN (Chinese, Simplified)' },
              ]}
            />
          </FG>
          <FG label="Timezone">
            <NativeSelect
              value={fp.timezone}
              onChange={v => setFP('timezone', v)}
              options={[
                { value: 'America/New_York', label: 'America/New_York' },
                { value: 'Asia/Ho_Chi_Minh', label: 'Asia/Ho_Chi_Minh' },
                { value: 'Europe/London', label: 'Europe/London' },
                { value: 'Europe/Paris', label: 'Europe/Paris' },
                { value: 'Asia/Tokyo', label: 'Asia/Tokyo' },
                { value: 'Asia/Seoul', label: 'Asia/Seoul' },
                { value: 'America/Los_Angeles', label: 'America/Los_Angeles' },
                { value: 'America/Chicago', label: 'America/Chicago' },
                { value: 'Europe/Berlin', label: 'Europe/Berlin' },
                { value: 'Asia/Shanghai', label: 'Asia/Shanghai' },
                { value: 'UTC', label: 'UTC' },
              ]}
            />
          </FG>
        </FormRow>
        <FormRow>
          <FG label="Platform">
            <NativeInput value={fp.platform} onChange={v => setFP('platform', v)} placeholder="Win32" />
          </FG>
          <FG label="Max Touch Points">
            <NativeInput type="number" value={fp.maxTouchPoints} onChange={v => setFP('maxTouchPoints', v)} placeholder="0" />
          </FG>
        </FormRow>
        <FG label="Languages Header">
          <NativeInput value={fp.languages} onChange={v => setFP('languages', v)} placeholder="en-US,en;q=0.9" />
        </FG>
        <FG label="Do Not Track">
          <NativeSelect
            value={fp.doNotTrack || 'unspecified'}
            onChange={v => setFP('doNotTrack', v)}
            options={[
              { value: 'unspecified', label: 'Unspecified (null)' },
              { value: '1', label: 'Enable (1)' },
              { value: '0', label: 'Disable (0)' },
            ]}
          />
        </FG>
        <FG label="Fonts">
          <NativeTextArea value={fp.fonts} onChange={v => setFP('fonts', v)} placeholder="Arial, Verdana, Times New Roman..." rows={3} />
        </FG>
      </div>
    </div>
  );

  const renderDisplay = () => (
    <div>
      <div style={S.section}>
        <SectionToggle enabled={sectionToggles.display} onChange={v => setToggle('display', v)} title="Display Spoofing" />
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
          <button style={S.generateBtn} onClick={generateDisplay}>⚡ Generate</button>
        </div>
        <FG label="Screen Resolution">
          <NativeSelect
            value={fp.screenResolution}
            onChange={v => setFP('screenResolution', v)}
            options={['1280x720', '1366x768', '1440x900', '1600x900', '1920x1080', '2560x1440', '3840x2160']}
          />
        </FG>
        <FormRow>
          <FG label="Color Depth">
            <NativeSelect
              value={fp.colorDepth}
              onChange={v => setFP('colorDepth', Number(v))}
              options={[
                { value: 24, label: '24-bit' },
                { value: 32, label: '32-bit' },
              ]}
            />
          </FG>
          <FG label="Pixel Ratio">
            <NativeSelect
              value={fp.pixelRatio}
              onChange={v => setFP('pixelRatio', Number(v))}
              options={[
                { value: 1, label: '1x' },
                { value: 1.25, label: '1.25x' },
                { value: 1.5, label: '1.5x' },
                { value: 2, label: '2x' },
              ]}
            />
          </FG>
        </FormRow>
      </div>
    </div>
  );

  const renderHardware = () => (
    <div>
      <div style={S.section}>
        <SectionToggle enabled={sectionToggles.hardware} onChange={v => setToggle('hardware', v)} title="Hardware Spoofing" />
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
          <button style={S.generateBtn} onClick={generateHardware}>⚡ Generate</button>
        </div>
        <FormRow>
          <FG label="CPU Cores">
            <NativeSelect
              value={st.cpuCores}
              onChange={v => setST('cpuCores', Number(v))}
              options={[2, 4, 6, 8, 12, 16, 24, 32].map(n => ({ value: n, label: `${n} cores` }))}
            />
          </FG>
          <FG label="Memory (RAM)">
            <NativeSelect
              value={st.memoryGB}
              onChange={v => setST('memoryGB', Number(v))}
              options={[2, 4, 8, 12, 16, 24, 32, 64].map(n => ({ value: n, label: `${n} GB` }))}
            />
          </FG>
        </FormRow>
        <FG label="GPU Vendor">
          <NativeInput value={st.gpuVendor} onChange={v => setST('gpuVendor', v)} placeholder="Google Inc. (NVIDIA)" />
        </FG>
        <FG label="GPU Renderer">
          <NativeInput value={st.gpuRenderer} onChange={v => setST('gpuRenderer', v)} placeholder="ANGLE (NVIDIA, ...)" />
        </FG>
      </div>
    </div>
  );

  const renderCanvas = () => (
    <div>
      <div style={S.section}>
        <SectionToggle enabled={sectionToggles.canvas} onChange={v => setToggle('canvas', v)} title="Canvas Fingerprint Spoofing" />
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
          <button style={S.generateBtn} onClick={generateCanvas}>⚡ Generate</button>
        </div>
        <FG label="Canvas Noise Seed">
          <NativeInput type="number" value={st.canvas?.noiseSeed} onChange={v => setNestedST('canvas', 'noiseSeed', v)} placeholder="Random seed" />
        </FG>
        <FG label="Noise Intensity">
          <NativeSelect
            value={st.canvas?.noiseIntensity}
            onChange={v => setNestedST('canvas', 'noiseIntensity', Number(v))}
            options={[1, 2, 3, 4, 5].map(n => ({ value: n, label: `Level ${n}` }))}
          />
        </FG>
      </div>
    </div>
  );

  const renderWebGL = () => (
    <div>
      <div style={S.section}>
        <SectionToggle enabled={sectionToggles.webgl} onChange={v => setToggle('webgl', v)} title="WebGL Fingerprint Spoofing" />
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
          <button style={S.generateBtn} onClick={generateWebGL}>⚡ Generate</button>
        </div>
        <FG label="WebGL Noise Seed">
          <NativeInput type="number" value={st.webgl?.noiseSeed} onChange={v => setNestedST('webgl', 'noiseSeed', v)} placeholder="Random seed" />
        </FG>
        <FG label="Max Texture Size">
          <NativeSelect
            value={st.webgl?.maxTextureSize}
            onChange={v => setNestedST('webgl', 'maxTextureSize', Number(v))}
            options={[
              { value: 4096, label: '4096' },
              { value: 8192, label: '8192' },
              { value: 16384, label: '16384' },
            ]}
          />
        </FG>
        <FG label="Extensions (comma-separated)">
          <NativeTextArea value={st.webgl?.extensions} onChange={v => setNestedST('webgl', 'extensions', v)} placeholder="EXT_texture_filter_anisotropic, ..." rows={3} />
        </FG>
      </div>
    </div>
  );

  const renderAudio = () => (
    <div>
      <div style={S.section}>
        <SectionToggle enabled={sectionToggles.audio} onChange={v => setToggle('audio', v)} title="Audio Context Spoofing" />
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
          <button style={S.generateBtn} onClick={generateAudio}>⚡ Generate</button>
        </div>
        <FG label="Audio Noise Seed">
          <NativeInput type="number" value={st.audio?.noiseSeed} onChange={v => setNestedST('audio', 'noiseSeed', v)} placeholder="Random seed" />
        </FG>
        <FormRow>
          <FG label="Sample Rate">
            <NativeSelect
              value={st.audio?.sampleRate}
              onChange={v => setNestedST('audio', 'sampleRate', Number(v))}
              options={[
                { value: 44100, label: '44100 Hz' },
                { value: 48000, label: '48000 Hz' },
                { value: 96000, label: '96000 Hz' },
              ]}
            />
          </FG>
          <FG label="Channels">
            <NativeSelect
              value={st.audio?.channels}
              onChange={v => setNestedST('audio', 'channels', v)}
              options={['Mono', 'Stereo', 'Surround']}
            />
          </FG>
        </FormRow>
      </div>
    </div>
  );

  const renderMedia = () => (
    <div>
      <div style={S.section}>
        <SectionToggle enabled={sectionToggles.media} onChange={v => setToggle('media', v)} title="Media Devices Spoofing" />
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
          <button style={S.generateBtn} onClick={generateMedia}>⚡ Generate</button>
        </div>
        <FormRow>
          <FG label="Speakers">
            <NativeInput type="number" value={st.media?.speakers} onChange={v => setNestedST('media', 'speakers', Math.min(5, Math.max(0, v)))} placeholder="2" />
          </FG>
          <FG label="Microphones">
            <NativeInput type="number" value={st.media?.microphones} onChange={v => setNestedST('media', 'microphones', Math.min(5, Math.max(0, v)))} placeholder="1" />
          </FG>
        </FormRow>
        <FG label="Webcams">
          <NativeInput type="number" value={st.media?.webcams} onChange={v => setNestedST('media', 'webcams', Math.min(3, Math.max(0, v)))} placeholder="0" />
        </FG>
      </div>
    </div>
  );

  const renderNetwork = () => (
    <div>
      <div style={S.section}>
        <SectionToggle enabled={sectionToggles.network} onChange={v => setToggle('network', v)} title="Network & WebRTC Spoofing" />
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
          <button style={S.generateBtn} onClick={generateNetwork}>⚡ Generate</button>
        </div>
        <FG label="WebRTC Policy">
          <NativeSelect
            value={st.network?.webrtcPolicy || 'default'}
            onChange={v => setNestedST('network', 'webrtcPolicy', v)}
            options={[
              { value: 'default', label: 'Default' },
              { value: 'public_and_private', label: 'Public + Private' },
              { value: 'disable_non_proxied_udp', label: 'Disable non-proxied UDP' },
              { value: 'public_interface_only', label: 'Public interface only' },
            ]}
          />
        </FG>
        <FG label="Do Not Track">
          <NativeSelect
            value={st.network?.doNotTrack || 'unspecified'}
            onChange={v => setNestedST('network', 'doNotTrack', v)}
            options={[
              { value: 'unspecified', label: 'Unspecified' },
              { value: '1', label: 'Enable (1)' },
              { value: '0', label: 'Disable (0)' },
            ]}
          />
        </FG>
        <FormRow>
          <FG label="Connection Type">
            <NativeSelect
              value={st.network?.connectionType || 'Ethernet'}
              onChange={v => setNestedST('network', 'connectionType', v)}
              options={['Ethernet', 'Wi-Fi', 'Cellular', '4g', 'none']}
            />
          </FG>
          <FG label="PDF Viewer">
            <NativeSelect
              value={st.network?.pdfViewer || 'Enabled'}
              onChange={v => setNestedST('network', 'pdfViewer', v)}
              options={['Enabled', 'Disabled']}
            />
          </FG>
        </FormRow>
      </div>
    </div>
  );

  const renderBattery = () => {
    const battLevel = st.battery?.level ?? 0.8;
    return (
      <div>
        <div style={S.section}>
          <SectionToggle enabled={sectionToggles.battery} onChange={v => setToggle('battery', v)} title="Battery API Spoofing" />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
            <button style={S.generateBtn} onClick={generateBattery}>⚡ Generate</button>
          </div>
          <FG label="Charging">
            <NativeSelect
              value={st.battery?.charging || 'No'}
              onChange={v => setNestedST('battery', 'charging', v)}
              options={['Yes', 'No']}
            />
          </FG>
          <FG label={`Battery Level: ${Math.round(battLevel * 100)}%`}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <input
                type="range" min={0} max={100} step={1}
                value={Math.round(battLevel * 100)}
                onChange={e => setNestedST('battery', 'level', Number(e.target.value) / 100)}
                style={{ flex: 1, accentColor: '#06b6d4' }}
              />
              <span style={{ color: '#22d3ee', minWidth: '40px', textAlign: 'right', fontWeight: 700 }}>
                {Math.round(battLevel * 100)}%
              </span>
            </div>
          </FG>
          <FormRow>
            <FG label="Charging Time (seconds)">
              <NativeInput type="number" value={st.battery?.chargingTime} onChange={v => setNestedST('battery', 'chargingTime', v)} placeholder="0" />
            </FG>
            <FG label="Discharging Time (seconds)">
              <NativeInput type="number" value={st.battery?.dischargingTime} onChange={v => setNestedST('battery', 'dischargingTime', v)} placeholder="10000" />
            </FG>
          </FormRow>
        </div>
      </div>
    );
  };

  const TAB_RENDERERS = {
    General: renderGeneral,
    Identity: renderIdentity,
    Display: renderDisplay,
    Hardware: renderHardware,
    Canvas: renderCanvas,
    WebGL: renderWebGL,
    Audio: renderAudio,
    Media: renderMedia,
    Network: renderNetwork,
    Battery: renderBattery,
  };

  return (
    <>
      <style>{`
        .ped-drawer .ant-drawer-content { background: #0d0f11 !important; }
        .ped-drawer .ant-drawer-header { background: #111417 !important; border-bottom: 1px solid rgba(255,255,255,0.07) !important; padding: 14px 20px; }
        .ped-drawer .ant-drawer-title { color: #e2e8f0 !important; font-size: 15px; font-weight: 700; }
        .ped-drawer .ant-drawer-close { color: rgba(255,255,255,0.5) !important; }
        .ped-drawer .ant-drawer-close:hover { color: white !important; }
        .ped-drawer .ant-drawer-body { padding: 0 !important; background: #0d0f11 !important; }
        .ped-drawer .ant-switch-handle::before { background: white !important; }
        input[type=range]::-webkit-slider-thumb { cursor: pointer; }
      `}</style>
      <Drawer
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '18px' }}>✏️</span>
            <span>Edit Profile — <span style={{ color: '#06b6d4' }}>{formData.name || 'Untitled'}</span></span>
          </div>
        }
        placement="right"
        width={900}
        open={visible}
        onClose={onClose}
        className="ped-drawer"
        footer={null}
        destroyOnClose
      >
        {/* Tab Bar */}
        <div style={S.tabBar}>
          {TABS.map(tab => (
            <button
              key={tab}
              style={S.tabBtn(activeTab === tab)}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div style={S.tabContent}>
          {TAB_RENDERERS[activeTab]?.()}
        </div>

        {/* Footer */}
        <div style={S.footer}>
          <button style={S.cancelBtn} onClick={onClose}>Cancel</button>
          <button
            style={{ ...S.saveBtn, opacity: saving ? 0.7 : 1, cursor: saving ? 'not-allowed' : 'pointer' }}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? '💾 Saving...' : '💾 Save Changes'}
          </button>
        </div>
      </Drawer>
    </>
  );
}
