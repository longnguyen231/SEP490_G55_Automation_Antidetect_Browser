import React, { useState, useEffect } from 'react';
import { Sun, User, Monitor, Cpu, PenLine, Layers, Volume2, Video, Globe, Battery, RefreshCcw, ShieldCheck } from 'lucide-react';
import EngineInstallModal from './EngineInstallModal';
import './ProfileForm.css';

/* ═══════════════ Default data ═══════════════ */
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
  startupPage: '',
  windowWidth: 1440,
  windowHeight: 900,
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

const generateConsistentFingerprint = () => {
  const LOCALES = [
    { code: 'en-US', timezone: 'America/New_York', languages: 'en-US,en;q=0.9' },
    { code: 'vi-VN', timezone: 'Asia/Ho_Chi_Minh', languages: 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7' },
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
  const browserType = randomFrom(['Chrome', 'Firefox', 'Edge']);
  const deviceType = randomFrom(['Desktop', 'Mobile']);
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
      os, browser: browserType, device: deviceType, browserVersion: bv, userAgent: ua,
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
      windowWidth: screen.w, windowHeight: screen.h,
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
  { id: 'general',  label: 'General',  icon: <Sun size={18} /> },
  { id: 'identity', label: 'Identity', icon: <User size={18} />, toggleable: true },
  { id: 'display',  label: 'Display',  icon: <Monitor size={18} />, toggleable: true },
  { id: 'hardware', label: 'Hardware', icon: <Cpu size={18} />, toggleable: true },
  { id: 'canvas',   label: 'Canvas',   icon: <PenLine size={18} />, toggleable: true },
  { id: 'webgl',    label: 'WebGL',    icon: <Layers size={18} />, toggleable: true },
  { id: 'audio',    label: 'Audio',    icon: <Volume2 size={18} />, toggleable: true },
  { id: 'media',    label: 'Media',    icon: <Video size={18} />, toggleable: true },
  { id: 'network',  label: 'Network',  icon: <Globe size={18} />, toggleable: true },
  { id: 'battery',  label: 'Battery',  icon: <Battery size={18} />, toggleable: true },
];

/* ═══════════════ Main Component ═══════════════ */
function ProfileForm({ profile, onSave, onCancel, initialTab = 'general' }) {
  const isEdit = !!profile?.id;
  const [activeTab, setActiveTab] = useState(initialTab);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    startUrl: 'https://www.google.com/?hl=en',
    active: true,
    cookie: '',
    fingerprint: { ...defaultFingerprint },
    settings: JSON.parse(JSON.stringify(defaultSettings)),
  });

  /* Section toggles — each toggleable tab can be enabled/disabled */
  const [sectionToggles, setSectionToggles] = useState({
    identity: false,
    display: false,
    hardware: false,
    canvas: false,
    webgl: false,
    audio: false,
    media: false,
    network: false,
    battery: false,
  });

  const toggleSection = (id) => setSectionToggles(prev => ({ ...prev, [id]: !prev[id] }));

  const [options, setOptions] = useState({ locales: [], timezones: [] });
  const fallbackLocales = ['vi-VN', 'en-US', 'en-GB', 'fr-FR', 'de-DE', 'es-ES', 'ja-JP', 'ko-KR', 'zh-CN'];
  const fallbackTimezones = ['Asia/Ho_Chi_Minh', 'UTC', 'Asia/Tokyo', 'Asia/Seoul', 'Asia/Singapore', 'Europe/Paris', 'America/New_York'];

  const [proxyChecking, setProxyChecking] = useState(false);
  const [proxyRotating, setProxyRotating] = useState(false);
  const [proxyCheckResult, setProxyCheckResult] = useState(null);
  const [proxyRotateResult, setProxyRotateResult] = useState(null);

  const [engineStatus, setEngineStatus] = useState({
      chromium: { status: 'loading' },
      firefox: { status: 'loading' },
      camoufox: { status: 'loading' }
  });
  // 'chromium' | 'firefox' | 'camoufox' | null
  const [engineInstallTarget, setEngineInstallTarget] = useState(null);

  useEffect(() => {
    const checkEngines = async () => {
      if (!window.electronAPI?.checkBrowserStatus) return;
      try {
        const chromiumData = await window.electronAPI.checkBrowserStatus('chromium');
        const firefoxData = await window.electronAPI.checkBrowserStatus('firefox');
        const camoufoxData = await window.electronAPI.checkBrowserStatus('camoufox');
        setEngineStatus({
            chromium: chromiumData,
            firefox: firefoxData,
            camoufox: camoufoxData
        });
      } catch (e) {
          console.error(e);
      }
    };
    checkEngines();
  }, []);

  useEffect(() => {
    if (profile) {
      if (!profile.id) {
        const randomConfig = generateConsistentFingerprint();
        setFormData({
          ...profile, 
          name: 'Profile ' + Math.floor(1000 + Math.random() * 9000).toString(),
          cookie: '',
          fingerprint: randomConfig.fingerprint,
          settings: { ...randomConfig.settings, quantity: 1, injectFingerprint: true },
        });
      } else {
        const s = { ...JSON.parse(JSON.stringify(defaultSettings)), ...(profile.settings || {}) };
        setFormData({
          ...profile, cookie: profile.cookie || '',
          fingerprint: { ...defaultFingerprint, ...profile.fingerprint },
          settings: s,
        });
        // Restore section toggles from settings.[section].enabled
        setSectionToggles({
          identity: !!s.identity?.enabled,
          display:  !!s.display?.enabled,
          hardware: !!s.hardware?.enabled,
          canvas:   !!s.canvas?.enabled,
          webgl:    !!s.webgl?.enabled,
          audio:    !!s.audio?.enabled,
          media:    !!s.media?.enabled,
          network:  !!s.network?.enabled,
          battery:  !!s.battery?.enabled,
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

  const handleCheckProxy = async () => {
    const proxy = formData.settings.proxy;
    if (!proxy || proxy.type === 'none' || !proxy.server) {
      setProxyCheckResult({ alive: false, error: 'Enter proxy details first' });
      return;
    }
    setProxyChecking(true);
    setProxyCheckResult(null);
    try {
      let host = proxy.server;
      let port = 80;
      const serverStr = String(proxy.server).replace(/^https?:\/\//, '').replace(/^socks\d?:\/\//, '');
      if (serverStr.includes(':')) {
        const parts = serverStr.split(':');
        host = parts[0];
        port = parseInt(parts[1], 10) || 80;
      }
      const res = await window.electronAPI.checkProxy({
        type: proxy.type,
        host,
        port,
        username: proxy.username || '',
        password: proxy.password || '',
      });
      if (res) {
        setProxyCheckResult({ alive: res.alive, latency: res.latency, ip: res.ip, city: res.city, countryCode: res.countryCode, timezone: res.timezone });
      } else {
        setProxyCheckResult({ alive: false, error: 'Check failed' });
      }
    } catch (e) {
      setProxyCheckResult({ alive: false, error: e?.message || String(e) });
    } finally {
      setProxyChecking(false);
    }
  };

  const handleRotateProxy = async () => {
    const proxy = formData.settings.proxy;
    if (!proxy || proxy.type === 'none' || !proxy.rotateUrl) {
      setProxyRotateResult({ success: false, error: 'Enter rotate URL first' });
      return;
    }
    setProxyRotating(true);
    setProxyRotateResult(null);
    try {
      const startTime = Date.now();
      const res = await window.electronAPI.rotateProxyByUrl(proxy.rotateUrl);
      const latency = Date.now() - startTime;
      
      setProxyRotateResult({ success: res.success, latency, error: res.error });
      if (res.success) setProxyCheckResult(null); 
    } catch (e) {
      setProxyRotateResult({ success: false, error: e?.message || String(e) });
    } finally {
      setProxyRotating(false);
    }
  };

  /* ── Per-section random generators ── */
  const randomFrom = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

  const generateForActiveTab = () => {
    const full = generateConsistentFingerprint();

    switch (activeTab) {
      case 'general': {
        // General: regenerate everything (like before)
        setFormData(prev => ({
          ...prev,
          name: 'Profile ' + Math.floor(1000 + Math.random() * 9000).toString(),
          fingerprint: { ...prev.fingerprint, ...full.fingerprint },
          settings: {
            ...prev.settings, ...full.settings,
            injectFingerprint: prev.settings.injectFingerprint,
            quantity: prev.settings.quantity,
            engine: prev.settings.engine,
          }
        }));
        break;
      }
      case 'identity': {
        const LOCALES = [
          { code: 'vi-VN', tz: 'Asia/Ho_Chi_Minh', langs: 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7' },
          { code: 'en-US', tz: 'America/New_York', langs: 'en-US,en;q=0.9' },
          { code: 'en-GB', tz: 'Europe/London', langs: 'en-GB,en;q=0.9,en-US;q=0.8' },
          { code: 'fr-FR', tz: 'Europe/Paris', langs: 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7' },
          { code: 'de-DE', tz: 'Europe/Berlin', langs: 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7' },
          { code: 'ja-JP', tz: 'Asia/Tokyo', langs: 'ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7' },
          { code: 'ko-KR', tz: 'Asia/Seoul', langs: 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7' },
          { code: 'zh-CN', tz: 'Asia/Shanghai', langs: 'zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7' },
        ];
        const loc = randomFrom(LOCALES);
        const os = formData.fingerprint.os || 'Windows';
        const bv = randomFrom(['145.0.0.0','144.0.0.0','143.0.0.0','142.0.0.0','141.0.0.0']);
        const plat = os === 'Windows' ? 'Win32' : os === 'macOS' ? 'MacIntel' : 'Linux x86_64';
        let ua;
        if (os === 'Windows') ua = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${bv} Safari/537.36`;
        else if (os === 'macOS') ua = `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${bv} Safari/537.36`;
        else ua = `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${bv} Safari/537.36`;
        setFormData(prev => ({
          ...prev,
          fingerprint: { ...prev.fingerprint, userAgent: ua, browserVersion: bv, language: loc.code, timezone: loc.tz, maxTouchPoints: randomFrom([0, 5, 10]), fonts: full.fingerprint.fonts },
          settings: { ...prev.settings, language: loc.code, timezone: loc.tz, advanced: { ...prev.settings.advanced, platform: plat, dnt: randomFrom([true, false]), languages: loc.langs } }
        }));
        break;
      }
      case 'display': {
        const SCREENS = [{ res: '1366x768', ratios: [1] }, { res: '1600x900', ratios: [1] }, { res: '1920x1080', ratios: [1, 1.25, 1.5] }, { res: '2560x1440', ratios: [1, 1.25, 1.5, 2] }, { res: '3840x2160', ratios: [1.5, 2] }];
        const s = randomFrom(SCREENS);
        const pr = randomFrom(s.ratios);
        setFormData(prev => ({
          ...prev,
          fingerprint: { ...prev.fingerprint, screenResolution: s.res, colorDepth: randomFrom([24, 32]), pixelRatio: pr }
        }));
        break;
      }
      case 'hardware': {
        const gpu = randomFrom([
          { v: 'Google Inc. (Intel)', r: 'ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11 vs_5_0)' },
          { v: 'Google Inc. (NVIDIA)', r: 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1650 Direct3D11 vs_5_0)' },
          { v: 'Google Inc. (NVIDIA)', r: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0)' },
          { v: 'Google Inc. (AMD)', r: 'ANGLE (AMD, AMD Radeon RX 580 Direct3D11 vs_5_0)' },
        ]);
        setFormData(prev => ({
          ...prev,
          settings: { ...prev.settings, cpuCores: randomFrom([2, 4, 6, 8, 12, 16, 24, 32]), memoryGB: randomFrom([2, 4, 8, 12, 16, 24, 32, 64]), gpuVendor: gpu.v, gpuRenderer: gpu.r }
        }));
        break;
      }
      case 'canvas': {
        setFormData(prev => ({
          ...prev,
          fingerprint: { ...prev.fingerprint, canvasNoise: randomInt(100000000, 2100000000), canvasNoiseIntensity: randomFrom([1, 2, 3, 4, 5]) }
        }));
        break;
      }
      case 'webgl': {
        setFormData(prev => ({
          ...prev,
          fingerprint: { ...prev.fingerprint, webglNoise: randomInt(100000000, 2100000000), maxTextureSize: randomFrom([4096, 8192, 16384]), webglExtensions: randomFrom(['EXT_texture_compression_bptc, ANGLE_instanced_arrays, OES_texture_float', 'ANGLE_instanced_arrays, OES_texture_float, WEBGL_depth_texture, OES_vertex_array_object', 'EXT_texture_filter_anisotropic, WEBGL_compressed_texture_s3tc, OES_element_index_uint']) }
        }));
        break;
      }
      case 'audio': {
        setFormData(prev => ({
          ...prev,
          fingerprint: { ...prev.fingerprint, audioNoise: randomInt(100000000, 2100000000), audioSampleRate: randomFrom([44100, 48000, 96000]), audioChannels: randomFrom(['Mono', 'Stereo', 'Surround']) }
        }));
        break;
      }
      case 'media': {
        setFormData(prev => ({
          ...prev,
          settings: { ...prev.settings, mediaDevices: { ...prev.settings.mediaDevices, speakers: randomInt(1, 3), microphones: randomInt(0, 2), webcams: randomInt(0, 1) } }
        }));
        break;
      }
      case 'network': {
        setFormData(prev => ({
          ...prev,
          fingerprint: { ...prev.fingerprint, connectionType: randomFrom(['Ethernet', 'Wi-Fi', 'Cellular']), pdfViewer: randomFrom(['Enabled', 'Disabled']) },
          settings: { ...prev.settings, webrtc: randomFrom(['Public + private', 'Default', 'Disable non-proxied UDP', 'Public interface only']) }
        }));
        break;
      }
      case 'battery': {
        setFormData(prev => ({
          ...prev,
          fingerprint: { ...prev.fingerprint, batteryCharging: randomFrom(['Yes', 'No']), batteryLevel: Number((Math.random() * 0.9 + 0.1).toFixed(2)), batteryChargingTime: randomFrom([0, 3600, 7200]), batteryDischargingTime: randomInt(5000, 20000) }
        }));
        break;
      }
      default: break;
    }
  };

  const generateBtnLabel = activeTab === 'general' ? 'Generate' : `Generate ${TABS.find(t => t.id === activeTab)?.label || ''}`;
  const generateBtnTooltip = activeTab === 'general' ? 'Regenerate fingerprint based on general settings' : `Regenerate ${(TABS.find(t => t.id === activeTab)?.label || '').toLowerCase()} fields only`;

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
    if (!finalSettings.engine) finalSettings.engine = 'playwright';

    const payload = {
      ...formData,
      settings: finalSettings,
      sectionToggles,
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
      <fieldset className="pf-fieldset">
        <legend className="pf-legend">Browser Engine</legend>
        <div className="pf-field">
          <label className="pf-label">Engine</label>
          <select className="pf-select" value={formData.settings.engine || 'playwright'} onChange={e => {
            const val = e.target.value;
            setS('engine', val);
            if (val === 'playwright-firefox') {
              setFp('browser', 'Firefox');
              setFp('userAgent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0');
            } else if (val === 'camoufox') {
              setFp('browser', 'Firefox');
              setFp('userAgent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0');
            } else if (val === 'playwright') {
              setFp('browser', 'Chrome');
              setFp('userAgent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
            }
          }}>
            <option value="playwright">
              Playwright Chromium {engineStatus.chromium.status !== 'installed' && engineStatus.chromium.status !== 'loading' ? '(Not Installed)' : ''}
            </option>
            <option value="playwright-firefox">
              Playwright Firefox {engineStatus.firefox.status !== 'installed' && engineStatus.firefox.status !== 'loading' ? '(Not Installed)' : ''}
            </option>
            <option value="camoufox">
              Camoufox Firefox {engineStatus.camoufox.status !== 'installed' && engineStatus.camoufox.status !== 'loading' ? '(Not Installed)' : ''}
            </option>
          </select>

          {/* Inline warning + Install button when selected engine is not installed */}
          {(formData.settings.engine === 'playwright' && engineStatus.chromium.status !== 'installed' && engineStatus.chromium.status !== 'loading') && (
            <div className="pf-engine-warn">
              <span>⚠️ Playwright Chromium is not installed.</span>
              <button type="button" className="pf-engine-install-btn" onClick={() => setEngineInstallTarget('chromium')}>
                Install Now
              </button>
            </div>
          )}
          {((formData.settings.engine === 'playwright-firefox' || formData.settings.engine === 'firefox') && engineStatus.firefox.status !== 'installed' && engineStatus.firefox.status !== 'loading') && (
            <div className="pf-engine-warn">
              <span>⚠️ Playwright Firefox is not installed.</span>
              <button type="button" className="pf-engine-install-btn" onClick={() => setEngineInstallTarget('firefox')}>
                Install Now
              </button>
            </div>
          )}
          {(formData.settings.engine === 'camoufox' && engineStatus.camoufox.status !== 'installed' && engineStatus.camoufox.status !== 'loading') && (
            <div className="pf-engine-warn">
              <span>⚠️ Camoufox Firefox is not installed.</span>
              <button type="button" className="pf-engine-install-btn" onClick={() => setEngineInstallTarget('camoufox')}>
                Install Now
              </button>
            </div>
          )}
        </div>
        <div className="pf-field pf-mt" style={{ marginTop: '16px' }}>
          <label className="pf-checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input type="checkbox" className="pf-checkbox" checked={!!formData.settings.safeMode} onChange={e => setS('safeMode', e.target.checked)} />
            <span style={{ fontWeight: 600, color: '#f59e0b' }}>🛡️ Enable Cloudflare Bypass (Safe Mode)</span>
          </label>
          <p className="pf-hint" style={{ marginTop: '6px', lineHeight: '1.4' }}>
            <strong>Antidetect Paradox:</strong> When enabled, disables Javascript-level fingerprint tampering to trick Cloudflare's WAF. However, this stops Canvas/WebGL spoofing, so multiple profiles will have the identical base hardware fingerprint. Toggle this ON only for sites that block you.
          </p>
        </div>
      </fieldset>

      {/* Startup */}
      <fieldset className="pf-fieldset">
        <legend className="pf-legend">Startup</legend>
        <div className="pf-field pf-mb">
          <label className="pf-label">Startup Page</label>
          <input type="text" className="pf-input" value={formData.settings.startupPage || formData.startUrl || ''} onChange={e => { setS('startupPage', e.target.value); setFormData(p => ({ ...p, startUrl: e.target.value })); }} placeholder="ex: https://www.google.com/?hl=en" />
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
      </fieldset>

      {/* Quick Generate */}
      <fieldset className="pf-fieldset">
        <legend className="pf-legend">Quick Generate</legend>
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
      </fieldset>
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

  const renderHardware = () => {
    const fontCount = (formData.fingerprint.fonts || '').split(',').filter(f => f.trim()).length;
    return (
    <>
      <ToggleHeader id="hardware" label="Hardware" desc="CPU cores, RAM, GPU vendor and renderer string, installed fonts" enabled={sectionToggles.hardware} onToggle={() => toggleSection('hardware')} />
      <div className={sectionToggles.hardware ? '' : 'pf-section-disabled'}>
        <div className="pf-row">
          <div className="pf-field">
            <label className="pf-label">CPU Cores</label>
            <select className="pf-select" value={formData.settings.cpuCores || 4} onChange={e => setS('cpuCores', Number(e.target.value))}>
              {CPU_OPTIONS.map(n => <option key={n} value={n}>{n} cores</option>)}
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
        <div className="pf-field pf-mb">
          <label className="pf-label">GPU Renderer</label>
          <input type="text" className="pf-input" value={formData.settings.gpuRenderer || ''} onChange={e => setS('gpuRenderer', e.target.value)} />
        </div>
        <div className="pf-field pf-mb">
          <label className="pf-label">Installed Fonts ({fontCount})</label>
          <input type="text" className="pf-input" value={formData.fingerprint.fonts || ''} onChange={e => setFp('fonts', e.target.value)} />
          <p className="pf-hint">Comma-separated list of font family names</p>
        </div>
        <div className="pf-field">
          <label className="pf-label">Font Count (read-only)</label>
          <input type="number" className="pf-input" value={fontCount} readOnly />
        </div>
      </div>
    </>
    );
  };

  const renderCanvas = () => (
    <>
      <ToggleHeader id="canvas" label="Canvas Fingerprint" desc="Pixel-level noise injection to randomize canvas fingerprint" enabled={sectionToggles.canvas} onToggle={() => toggleSection('canvas')} />
      <div className={sectionToggles.canvas ? '' : 'pf-section-disabled'}>
        <p className="pf-hint" style={{ marginBottom: '1rem', opacity: 0.85 }}>Canvas noise adds subtle pixel-level randomization to prevent fingerprint tracking via HTML5 canvas rendering.</p>
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
        <div className="pf-info-box">
          <div className="pf-info-row"><span>Current seed:</span><span>{formData.fingerprint.canvasNoise || 577315052}</span></div>
          <div className="pf-info-row"><span>Intensity:</span><span>{formData.fingerprint.canvasNoiseIntensity || 1} / 10</span></div>
        </div>
      </div>
    </>
  );

  const renderWebGL = () => {
    const extCount = (formData.fingerprint.webglExtensions || '').split(',').filter(e => e.trim()).length;
    return (
    <>
      <ToggleHeader id="webgl" label="WebGL Fingerprint" desc="WebGL noise, texture size parameters, and supported extensions" enabled={sectionToggles.webgl} onToggle={() => toggleSection('webgl')} />
      <div className={sectionToggles.webgl ? '' : 'pf-section-disabled'}>
        <p className="pf-hint" style={{ marginBottom: '1rem', opacity: 0.85 }}>WebGL overrides spoof GPU capabilities and inject deterministic hash noise to prevent WebGL-based fingerprinting.</p>
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
        <div className="pf-field pf-mb">
          <label className="pf-label">Extensions (comma separated)</label>
          <input type="text" className="pf-input" value={formData.fingerprint.webglExtensions || ''} onChange={e => setFp('webglExtensions', e.target.value)} />
        </div>
        <div className="pf-info-box">
          <div className="pf-info-row"><span>Extensions count:</span><span>{extCount}</span></div>
          <div className="pf-info-row"><span>Noise seed:</span><span>{formData.fingerprint.webglNoise || 709233842}</span></div>
        </div>
      </div>
    </>
    );
  };

  const renderAudio = () => (
    <>
      <ToggleHeader id="audio" label="Audio Fingerprint" desc="AudioContext sample rate, channel count, and noise injection" enabled={sectionToggles.audio} onToggle={() => toggleSection('audio')} />
      <div className={sectionToggles.audio ? '' : 'pf-section-disabled'}>
        <div className="pf-row-3">
          <div className="pf-field">
            <label className="pf-label">Sample Rate (Hz)</label>
            <select className="pf-select" value={formData.fingerprint.audioSampleRate || 48000} onChange={e => setFp('audioSampleRate', Number(e.target.value))}>
              <option value={44100}>44,100 Hz</option>
              <option value={48000}>48,000 Hz</option>
              <option value={96000}>96,000 Hz</option>
            </select>
          </div>
          <div className="pf-field">
            <label className="pf-label">Channels</label>
            <select className="pf-select" value={formData.fingerprint.audioChannels || 'Stereo'} onChange={e => setFp('audioChannels', e.target.value)}>
              <option value="Mono">Mono (1ch)</option>
              <option value="Stereo">Stereo (2ch)</option>
              <option value="Surround">5.1 (6ch)</option>
            </select>
          </div>
          <div className="pf-field">
            <label className="pf-label">Noise Seed</label>
            <input type="number" className="pf-input" value={formData.fingerprint.audioNoise || 0} onChange={e => setFp('audioNoise', e.target.value)} />
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
      <ToggleHeader id="network" label="Network & Navigator" desc="WebRTC IP handling policy and navigator network/privacy properties" enabled={sectionToggles.network} onToggle={() => toggleSection('network')} />
      <div className={sectionToggles.network ? '' : 'pf-section-disabled'}>
        <fieldset className="pf-fieldset">
          <legend className="pf-legend">WebRTC</legend>
          <div className="pf-field">
            <label className="pf-label">IP Handling Policy</label>
            <select className="pf-select" value={formData.settings.webrtc || 'Default'} onChange={e => setS('webrtc', e.target.value)}>
              <option value="Public + private">Public + private</option>
              <option value="Default">Default (allow all)</option>
              <option value="Disable non-proxied UDP">Disable non-proxied UDP</option>
              <option value="Public interface only">Public interface only</option>
            </select>
            <p className="pf-hint">Controls which IP addresses are exposed via WebRTC. Use "Disable non-proxied UDP" to prevent IP leaks when using a proxy.</p>
          </div>
        </fieldset>

        <fieldset className="pf-fieldset">
          <legend className="pf-legend">Navigator Properties</legend>
          <div className="pf-row">
            <div className="pf-field">
              <label className="pf-label">Do Not Track</label>
              <select className="pf-select" value={String(formData.settings.advanced?.dnt !== undefined ? formData.settings.advanced.dnt : 'null')} onChange={e => setAdv('dnt', e.target.value === 'null' ? null : (e.target.value === '1' ? 1 : 0))}>
                <option value="null">Not set (null)</option>
                <option value="1">Enabled (1)</option>
                <option value="0">Unspecified</option>
              </select>
            </div>
            <div className="pf-field">
              <label className="pf-label">Max Touch Points</label>
              <input type="number" className="pf-input" value={formData.fingerprint.maxTouchPoints || 0} onChange={e => setFp('maxTouchPoints', Number(e.target.value))} />
            </div>
          </div>
          <div className="pf-row">
            <div className="pf-field">
              <label className="pf-label">Connection Type</label>
              <select className="pf-select" value={formData.fingerprint.connectionType || 'Ethernet'} onChange={e => setFp('connectionType', e.target.value)}>
                <option value="Ethernet">Ethernet</option>
                <option value="Wi-Fi">Wi-Fi</option>
                <option value="Cellular">Cellular</option>
                <option value="None">None</option>
              </select>
            </div>
            <div className="pf-field">
              <label className="pf-label">PDF Viewer</label>
              <select className="pf-select" value={formData.fingerprint.pdfViewer || 'Enabled'} onChange={e => setFp('pdfViewer', e.target.value)}>
                <option value="Enabled">Enabled</option>
                <option value="Disabled">Disabled</option>
              </select>
            </div>
          </div>
        </fieldset>

      </div>
    </>
  );



  const renderBattery = () => {
    const isCharging = formData.fingerprint.batteryCharging === 'Yes';
    const statusText = isCharging ? 'Charging' : 'Discharging';
    const statusColor = isCharging ? '#10b981' : 'var(--fg)';
    const levelPercent = Math.round((formData.fingerprint.batteryLevel || 0) * 100) + '%';

    return (
      <>
        <ToggleHeader id="battery" label="Battery API" desc="Spoof navigator.getBattery() to report custom charging state and level" enabled={sectionToggles.battery} onToggle={() => toggleSection('battery')} />
        <div className={sectionToggles.battery ? '' : 'pf-section-disabled'}>
          <p className="pf-hint" style={{ marginBottom: '1rem', opacity: 0.85 }}>Battery status can be used as a fingerprinting vector. Spoofing it prevents sites from using it to track you.</p>
          <div className="pf-row">
            <div className="pf-field">
              <label className="pf-label">Charging</label>
              <select className="pf-select" value={formData.fingerprint.batteryCharging || 'No'} onChange={e => setFp('batteryCharging', e.target.value)}>
                <option value="Yes">Charging</option>
                <option value="No">Discharging</option>
              </select>
            </div>
            <div className="pf-field">
              <label className="pf-label">Level (0.0 - 1.0)</label>
              <input type="number" step="0.01" className="pf-input" value={formData.fingerprint.batteryLevel !== undefined ? formData.fingerprint.batteryLevel : 0.27} onChange={e => setFp('batteryLevel', Number(e.target.value))} />
            </div>
          </div>
          <div className="pf-row">
            <div className="pf-field">
              <label className="pf-label">Charging Time (seconds)</label>
              <input type="number" className="pf-input" value={formData.fingerprint.batteryChargingTime || 0} onChange={e => setFp('batteryChargingTime', Number(e.target.value))} />
            </div>
            <div className="pf-field">
              <label className="pf-label">Discharging Time (seconds)</label>
              <input type="number" className="pf-input" value={formData.fingerprint.batteryDischargingTime !== undefined ? formData.fingerprint.batteryDischargingTime : 15789} onChange={e => setFp('batteryDischargingTime', Number(e.target.value))} />
            </div>
          </div>
          <div className="pf-info-box">
            <div className="pf-info-row"><span>Status:</span><span style={{ color: statusColor }}>{statusText}</span></div>
            <div className="pf-info-row"><span>Level:</span><span>{levelPercent}</span></div>
          </div>
        </div>
      </>
    );
  };

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



  return (
    <div className="pf-root">
      {/* ── Header ── */}
      <div className="pf-header">
        <div className="pf-header-left">
          <button type="button" className="pf-back-btn" onClick={onCancel} title="Back">←</button>
          <h2 className="pf-header-title">{isEdit ? 'Edit Profile' : 'New Profile'}</h2>
        </div>
        <div className="pf-header-actions">
          <button type="button" className="pf-btn pf-btn-generate" onClick={generateForActiveTab} title={generateBtnTooltip}>
            <RefreshCcw size={16} /> {generateBtnLabel}
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
              <span className="pf-sidebar-icon">{tab.icon}</span>
              <span className="pf-sidebar-label">{tab.label}</span>
              {tab.toggleable && (
                <span className={`pf-sidebar-status ${sectionToggles[tab.id] ? 'on' : ''}`}>ⓘ</span>
              )}
            </button>
          ))}
        </nav>

        {/* Content */}
        <div className="pf-content">
          {renderTabContent()}
        </div>
      </div>
      {/* Engine Install Modal triggered from within the form */}
      {engineInstallTarget && (
        <EngineInstallModal
          engine={engineInstallTarget}
          onSkip={() => setEngineInstallTarget(null)}
          onInstall={() => {
            // Refresh engine status after install
            setEngineInstallTarget(null);
            (async () => {
              try {
                const chromiumData = await window.electronAPI.checkBrowserStatus('chromium');
                const firefoxData = await window.electronAPI.checkBrowserStatus('firefox');
                const camoufoxData = await window.electronAPI.checkBrowserStatus('camoufox');
                setEngineStatus({ chromium: chromiumData, firefox: firefoxData, camoufox: camoufoxData });
              } catch { }
            })();
          }}
        />
      )}
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
      <div className="pf-toggle-wrapper">
        <span className="pf-toggle-label">{enabled ? 'Enabled' : 'Disabled'}</span>
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
    </div>
  );
}

export default ProfileForm;
