'use client';

import { useEffect, useMemo, useState } from 'react';
import Card from 'react-bootstrap/Card';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import Nav from 'react-bootstrap/Nav';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import axios from 'axios';
import {
  X,
  RefreshCw,
  Monitor,
  Globe,
  Shield,
  Cpu,
  Settings2,
  ChevronRight,
  Info,
  FolderOpen,
  Tag,
} from 'lucide-react';

/* =========================
   UI CONSTANTS (FIX CỨNG)
========================= */
const TABS = [
  { id: 'general', label: 'General', icon: Settings2 },
  { id: 'proxy', label: 'Proxy', icon: Globe },
  { id: 'platform', label: 'Platform', icon: Monitor },
  { id: 'fingerprint', label: 'Fingerprint', icon: Shield },
  { id: 'advanced', label: 'Advanced', icon: Cpu },
];

const OS_OPTIONS = [
  { id: 'windows', label: 'Windows' },
  { id: 'macos', label: 'macOS' },
  { id: 'linux', label: 'Linux' },
  { id: 'android', label: 'Android' },
  { id: 'ios', label: 'iOS' },
];

const BROWSER_OPTIONS = [
  { id: 'chromium', label: 'Chromium', version: '120.0' },
  { id: 'firefox', label: 'Firefox', version: '121.0' },
];

/* =========================
   MOCK DATA (FIX CỨNG)
   - Sau này thay bằng API
========================= */
const MOCK_EDIT_PROFILE = {
  id: 'p_001',
  name: 'Profile Demo',
  browserType: 'Chromium',
  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  tags: ['demo', 'qa'],
};

const DEFAULT_FORM = {
  name: '',
  browser: 'chromium',
  os: 'windows',
  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  group: 'default',
  tags: [],
  cookie: '',
  remark: '',
};

const DEFAULT_FP = {
  webRTC: 'disabled',
  timezone: 'based-on-ip',
  location: 'based-on-ip',
  locationPermission: 'ask',
  language: 'based-on-ip',
  displayLanguage: 'based-on-language',
  resolution: 'predefined',
  resolutionValue: '1920x1080',
  fonts: 'default',
  canvas: 'noise',
  webGL: 'noise',
  audioContext: 'noise',
  hardwareConcurrency: 'real',
  deviceMemory: 'real',
};

/* =========================
   AXIOS HELPERS (để dễ thay API)
========================= */

/**
 * Bạn thay baseURL theo backend thật.
 * Ví dụ:
 * axiosClient.defaults.baseURL = 'https://api.yourdomain.com';
 */
const axiosClient = axios.create({
  baseURL: '/api', // thay sau
  timeout: 15000,
});

/**
 * MOCK: GET profile by id
 * - Hiện trả về MOCK_EDIT_PROFILE
 * - Khi có API: return axiosClient.get(`/profiles/${id}`)
 */
async function loadEditProfile(id) {
  // return axiosClient.get(`/profiles/${id}`);
  await new Promise((r) => setTimeout(r, 400));
  return { data: { ...MOCK_EDIT_PROFILE, id } };
}

/**
 * MOCK: POST create/update profile
 * - Khi có API: return axiosClient.post('/profiles', payload) hoặc put/patch...
 */
async function saveProfile(payload, isEditMode, editId) {
  // if (isEditMode) return axiosClient.put(`/profiles/${editId}`, payload);
  // return axiosClient.post('/profiles', payload);

  await new Promise((r) => setTimeout(r, 500));
  return {
    data: {
      ok: true,
      id: isEditMode ? editId : 'p_new_' + Date.now(),
      saved: payload,
    },
  };
}

/* =========================
   SMALL UI PARTS (giữ nguyên)
========================= */
function FpPill({ label, active, onClick }) {
  return (
    <button
      type="button"
      className={`fp-option ${active ? 'selected' : ''}`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function FingerprintRow({ label, value, truncate }) {
  return (
    <div className="overview-row">
      <span className="text-body-secondary">{label}</span>
      <span
        className={`fw-medium text-end ${truncate ? 'text-truncate' : ''}`}
        style={truncate ? { maxWidth: 180 } : undefined}
        title={truncate ? value : undefined}
      >
        {value}
      </span>
    </div>
  );
}

/* =========================
   MAIN COMPONENT (JS)
========================= */
export default function CreateProfileForm({
  onClose,
  onSave,
  editProfile, // optional: object hoặc null
  editProfileId, // optional: nếu bạn muốn truyền id để tự load
}) {
  const isEditMode = !!editProfile || !!editProfileId;
  const [activeTab, setActiveTab] = useState('general');

  const [loadingEdit, setLoadingEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [formData, setFormData] = useState(() => {
    const src = editProfile || null;
    return {
      ...DEFAULT_FORM,
      name: src?.name || DEFAULT_FORM.name,
      browser: (src?.browserType || DEFAULT_FORM.browser).toLowerCase(),
      userAgent: src?.userAgent || DEFAULT_FORM.userAgent,
      tags: src?.tags || DEFAULT_FORM.tags,
    };
  });

  const [fp, setFp] = useState(DEFAULT_FP);

  // Nếu editProfileId được truyền vào, auto load (mock)
  useEffect(() => {
    let mounted = true;
    async function run() {
      if (!editProfileId) return;
      setLoadingEdit(true);
      setErrorMsg('');
      try {
        const res = await loadEditProfile(editProfileId);
        if (!mounted) return;

        const src = res?.data;
        setFormData((p) => ({
          ...p,
          name: src?.name || '',
          browser: (src?.browserType || 'chromium').toLowerCase(),
          userAgent: src?.userAgent || DEFAULT_FORM.userAgent,
          tags: Array.isArray(src?.tags) ? src.tags : [],
        }));
      } catch (e) {
        if (!mounted) return;
        setErrorMsg('Không tải được dữ liệu profile (mock). Hãy thay API thật.');
      } finally {
        if (mounted) setLoadingEdit(false);
      }
    }
    run();
    return () => {
      mounted = false;
    };
  }, [editProfileId]);

  const fpChange = (field, value) => setFp((p) => ({ ...p, [field]: value }));
  const inputChange = (field, value) => setFormData((p) => ({ ...p, [field]: value }));

  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, ' ');

  const browserLabel = useMemo(() => {
    const found = BROWSER_OPTIONS.find((b) => b.id === formData.browser);
    return found?.label || 'Chromium';
  }, [formData.browser]);

  const regenerateUA = () => {
    const agents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    ];
    inputChange('userAgent', agents[Math.floor(Math.random() * agents.length)]);
  };

  const regenerateFp = () => {
    setFp({
      webRTC: ['disabled', 'replace', 'disable-udp'][Math.floor(Math.random() * 3)],
      timezone: 'based-on-ip',
      location: 'based-on-ip',
      locationPermission: Math.random() > 0.5 ? 'ask' : 'allow',
      language: 'based-on-ip',
      displayLanguage: 'based-on-language',
      resolution: 'predefined',
      resolutionValue: ['1920x1080', '2560x1440', '1366x768', 'based-on-ua'][Math.floor(Math.random() * 4)],
      fonts: 'default',
      canvas: ['noise', 'real'][Math.floor(Math.random() * 2)],
      webGL: ['noise', 'real'][Math.floor(Math.random() * 2)],
      audioContext: ['noise', 'real'][Math.floor(Math.random() * 2)],
      hardwareConcurrency: 'real',
      deviceMemory: 'real',
    });
  };

  // Submit: gọi axios mock + callback onSave (nếu bạn muốn)
  const handleSubmit = async () => {
    setSaving(true);
    setErrorMsg('');

    // payload bạn gửi lên API (fix cứng format, dễ thay)
    const payload = {
      name: formData.name,
      browser: formData.browser,
      os: formData.os,
      userAgent: formData.userAgent,
      group: formData.group,
      tags: formData.tags,
      cookie: formData.cookie,
      remark: formData.remark,
      fingerprint: fp,
    };

    try {
      const res = await saveProfile(payload, isEditMode, editProfile?.id || editProfileId);
      // bạn có thể bỏ dòng dưới nếu muốn component tự handle hết
      onSave?.(payload);

      // demo: log result để bạn nhìn payload & response
      // eslint-disable-next-line no-console
      console.log('Saved response:', res?.data);

      onClose?.();
    } catch (e) {
      setErrorMsg('Lưu thất bại (mock). Hãy thay API thật trong saveProfile().');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="d-flex flex-column h-100 fade-in cp-screen">
      {/* Header */}
      <div className="d-flex align-items-center justify-content-between p-4 border-bottom">
        <div>
          <h1 className="h4 fw-bold mb-0">{isEditMode ? 'Edit Profile' : 'Create New Profile'}</h1>
          <small className="text-body-secondary">
            {isEditMode ? 'Update browser profile settings and fingerprint' : 'Configure browser profile settings and fingerprint'}
          </small>
        </div>
        <Button variant="link" className="text-body-secondary p-0" onClick={onClose}>
          <X size={20} />
        </Button>
      </div>

      {/* Tabs */}
      <Nav variant="tabs" className="px-4 pt-1">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <Nav.Item key={tab.id}>
              <Nav.Link
                active={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="d-flex align-items-center gap-2"
                style={activeTab === tab.id ? { color: 'var(--bs-accent)', borderColor: 'var(--bs-accent)' } : {}}
              >
                <Icon size={16} /> {tab.label}
              </Nav.Link>
            </Nav.Item>
          );
        })}
      </Nav>

      {/* Content */}
      <div className="flex-grow-1 overflow-auto p-4">
        {loadingEdit && (
          <div className="mb-3 text-body-secondary small">Loading profile data...</div>
        )}
        {errorMsg && (
          <div className="mb-3 small text-danger">{errorMsg}</div>
        )}

        <Row>
          {/* Left: form */}
          <Col lg={7}>
            {activeTab === 'general' && (
              <div className="d-flex flex-column gap-4">
                {/* Profile Name */}
                <Form.Group>
                  <Form.Label>Profile Name</Form.Label>
                  <Form.Control
                    value={formData.name}
                    onChange={(e) => inputChange('name', e.target.value)}
                    placeholder="Enter profile name"
                  />
                  <Form.Text className="text-body-secondary">{formData.name.length}/100 characters</Form.Text>
                </Form.Group>

                {/* Browser */}
                <Form.Group>
                  <Form.Label>Browser Engine</Form.Label>
                  <div className="d-flex gap-3">
                    {BROWSER_OPTIONS.map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        className={`flex-fill p-3 rounded-3 border-2 text-start ${
                          formData.browser === b.id ? 'border-accent' : 'border-secondary'
                        }`}
                        style={
                          formData.browser === b.id
                            ? { borderColor: 'var(--bs-accent)', background: 'rgba(var(--bs-accent-rgb), 0.1)' }
                            : { background: 'transparent' }
                        }
                        onClick={() => inputChange('browser', b.id)}
                      >
                        <div className="fw-semibold">{b.label}</div>
                        <small className="text-body-secondary">v{b.version}</small>
                      </button>
                    ))}
                  </div>
                </Form.Group>

                {/* OS */}
                <Form.Group>
                  <Form.Label>Operating System</Form.Label>
                  <div className="d-flex flex-wrap gap-2">
                    {OS_OPTIONS.map((os) => (
                      <FpPill
                        key={os.id}
                        label={os.label}
                        active={formData.os === os.id}
                        onClick={() => inputChange('os', os.id)}
                      />
                    ))}
                  </div>
                </Form.Group>

                {/* User Agent */}
                <Form.Group>
                  <Form.Label>User Agent</Form.Label>
                  <div className="d-flex gap-2">
                    <Form.Control
                      className="font-mono"
                      value={formData.userAgent}
                      onChange={(e) => inputChange('userAgent', e.target.value)}
                      style={{ fontSize: '0.8125rem' }}
                    />
                    <Button variant="outline-secondary" onClick={regenerateUA}>
                      <RefreshCw size={16} />
                    </Button>
                  </div>
                </Form.Group>

                {/* Group & Tags */}
                <Row>
                  <Col>
                    <Form.Group>
                      <Form.Label className="d-flex align-items-center gap-1">
                        <FolderOpen size={14} /> Group
                      </Form.Label>
                      <Form.Select value={formData.group} onChange={(e) => inputChange('group', e.target.value)}>
                        <option value="default">Default</option>
                        <option value="work">Work</option>
                        <option value="personal">Personal</option>
                        <option value="testing">Testing</option>
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  <Col>
                    <Form.Group>
                      <Form.Label className="d-flex align-items-center gap-1">
                        <Tag size={14} /> Tags
                      </Form.Label>
                      {/* UI giữ nguyên: button Add tags... */}
                      <Button variant="outline-secondary" className="w-100 text-start text-body-secondary">
                        Add tags...
                      </Button>
                    </Form.Group>
                  </Col>
                </Row>

                {/* Cookie */}
                <Form.Group>
                  <Form.Label>Cookie Data</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={3}
                    value={formData.cookie}
                    onChange={(e) => inputChange('cookie', e.target.value)}
                    placeholder="Paste cookie data (JSON, Netscape, or Name=Value format)"
                    className="font-mono"
                  />
                </Form.Group>

                {/* Notes */}
                <Form.Group>
                  <Form.Label>Notes</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={2}
                    value={formData.remark}
                    onChange={(e) => inputChange('remark', e.target.value)}
                    placeholder="Add notes about this profile..."
                  />
                </Form.Group>
              </div>
            )}

            {activeTab === 'proxy' && (
              <Card body>
                <div className="d-flex align-items-center gap-2 mb-3">
                  <Globe size={18} style={{ color: 'var(--bs-accent)' }} />
                  <h5 className="fw-semibold mb-0">Proxy Settings</h5>
                </div>
                <p className="text-body-secondary small mb-3">Configure proxy for this browser profile</p>
                <Form.Select defaultValue="none">
                  <option value="none">No Proxy</option>
                  <option value="http">HTTP</option>
                  <option value="https">HTTPS</option>
                  <option value="socks5">SOCKS5</option>
                </Form.Select>
              </Card>
            )}

            {activeTab === 'platform' && (
              <Card body>
                <div className="d-flex align-items-center gap-2 mb-3">
                  <Monitor size={18} style={{ color: 'var(--bs-accent)' }} />
                  <h5 className="fw-semibold mb-0">Platform Settings</h5>
                </div>
                <p className="text-body-secondary small">Platform-specific configurations will appear here</p>
              </Card>
            )}

            {activeTab === 'fingerprint' && (
              <div className="d-flex flex-column gap-4">
                {/* WebRTC */}
                <div>
                  <div className="d-flex justify-content-between mb-2">
                    <Form.Label className="fw-medium mb-0">WebRTC</Form.Label>
                    <small className="text-body-secondary">Controls WebRTC IP leak protection</small>
                  </div>
                  <div className="d-flex flex-wrap gap-2">
                    {['forward', 'replace', 'real', 'disabled', 'disable-udp'].map((o) => (
                      <FpPill key={o} label={cap(o)} active={fp.webRTC === o} onClick={() => fpChange('webRTC', o)} />
                    ))}
                  </div>
                </div>

                {/* Timezone */}
                <div>
                  <Form.Label className="fw-medium">Timezone</Form.Label>
                  <div className="d-flex flex-wrap gap-2">
                    {[
                      { id: 'based-on-ip', label: 'Based on IP' },
                      { id: 'real', label: 'Real' },
                      { id: 'custom', label: 'Custom' },
                    ].map((o) => (
                      <FpPill key={o.id} label={o.label} active={fp.timezone === o.id} onClick={() => fpChange('timezone', o.id)} />
                    ))}
                  </div>
                  {fp.timezone === 'custom' && (
                    <Form.Select className="mt-2" defaultValue="UTC">
                      <option value="UTC">UTC</option>
                      <option value="America/New_York">America/New York (EST)</option>
                      <option value="America/Los_Angeles">America/Los Angeles (PST)</option>
                      <option value="Europe/London">Europe/London (GMT)</option>
                      <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
                      <option value="Asia/Ho_Chi_Minh">Asia/Ho Chi Minh (ICT)</option>
                    </Form.Select>
                  )}
                </div>

                {/* Location */}
                <div>
                  <Form.Label className="fw-medium">Geolocation</Form.Label>
                  <div className="d-flex flex-wrap gap-2">
                    {[
                      { id: 'based-on-ip', label: 'Based on IP' },
                      { id: 'custom', label: 'Custom' },
                      { id: 'block', label: 'Block' },
                    ].map((o) => (
                      <FpPill key={o.id} label={o.label} active={fp.location === o.id} onClick={() => fpChange('location', o.id)} />
                    ))}
                  </div>
                  {fp.location !== 'block' && (
                    <div className="d-flex gap-3 mt-2">
                      <Form.Check
                        type="radio"
                        name="locPerm"
                        label="Ask each time"
                        checked={fp.locationPermission === 'ask'}
                        onChange={() => fpChange('locationPermission', 'ask')}
                      />
                      <Form.Check
                        type="radio"
                        name="locPerm"
                        label="Always allow"
                        checked={fp.locationPermission === 'allow'}
                        onChange={() => fpChange('locationPermission', 'allow')}
                      />
                    </div>
                  )}
                </div>

                {/* Language */}
                <div>
                  <Form.Label className="fw-medium">Language</Form.Label>
                  <div className="d-flex flex-wrap gap-2">
                    {[
                      { id: 'based-on-ip', label: 'Based on IP' },
                      { id: 'custom', label: 'Custom' },
                    ].map((o) => (
                      <FpPill key={o.id} label={o.label} active={fp.language === o.id} onClick={() => fpChange('language', o.id)} />
                    ))}
                  </div>
                  {fp.language === 'custom' && (
                    <Form.Select className="mt-2" defaultValue="en-US">
                      <option value="en-US">English (US)</option>
                      <option value="en-GB">English (UK)</option>
                      <option value="vi-VN">Vietnamese</option>
                      <option value="ja-JP">Japanese</option>
                      <option value="ko-KR">Korean</option>
                      <option value="zh-CN">Chinese (Simplified)</option>
                    </Form.Select>
                  )}
                </div>

                {/* Display Language */}
                <div>
                  <Form.Label className="fw-medium">Display Language</Form.Label>
                  <div className="d-flex flex-wrap gap-2">
                    {[
                      { id: 'based-on-language', label: 'Based on Language' },
                      { id: 'real', label: 'Real' },
                      { id: 'custom', label: 'Custom' },
                    ].map((o) => (
                      <FpPill
                        key={o.id}
                        label={o.label}
                        active={fp.displayLanguage === o.id}
                        onClick={() => fpChange('displayLanguage', o.id)}
                      />
                    ))}
                  </div>
                </div>

                {/* Screen Resolution */}
                <div>
                  <Form.Label className="fw-medium">Screen Resolution</Form.Label>
                  <div className="d-flex flex-wrap gap-2">
                    {[
                      { id: 'predefined', label: 'Predefined' },
                      { id: 'custom', label: 'Custom' },
                    ].map((o) => (
                      <FpPill key={o.id} label={o.label} active={fp.resolution === o.id} onClick={() => fpChange('resolution', o.id)} />
                    ))}
                  </div>

                  {fp.resolution === 'predefined' && (
                    <Form.Select
                      className="mt-2"
                      value={fp.resolutionValue}
                      onChange={(e) => fpChange('resolutionValue', e.target.value)}
                    >
                      <option value="based-on-ua">Based on User-Agent</option>
                      <option value="1920x1080">1920x1080 (Full HD)</option>
                      <option value="2560x1440">2560x1440 (2K QHD)</option>
                      <option value="3840x2160">3840x2160 (4K UHD)</option>
                      <option value="1366x768">1366x768 (HD)</option>
                      <option value="1536x864">1536x864</option>
                    </Form.Select>
                  )}

                  {fp.resolution === 'custom' && (
                    <div className="d-flex align-items-center gap-2 mt-2">
                      <Form.Control type="number" placeholder="Width" defaultValue={1920} style={{ maxWidth: 120 }} />
                      <span className="text-body-secondary">x</span>
                      <Form.Control type="number" placeholder="Height" defaultValue={1080} style={{ maxWidth: 120 }} />
                    </div>
                  )}
                </div>

                {/* Canvas, WebGL, Audio */}
                {['canvas', 'webGL', 'audioContext'].map((field) => (
                  <div key={field}>
                    <Form.Label className="fw-medium">
                      {field === 'audioContext' ? 'Audio Context' : field === 'webGL' ? 'WebGL' : 'Canvas'}
                    </Form.Label>
                    <div className="d-flex flex-wrap gap-2">
                      {['noise', 'real', 'block'].map((o) => (
                        <FpPill key={o} label={cap(o)} active={fp[field] === o} onClick={() => fpChange(field, o)} />
                      ))}
                    </div>
                  </div>
                ))}

                {/* Hardware Concurrency */}
                <div>
                  <Form.Label className="fw-medium">Hardware Concurrency (CPU Cores)</Form.Label>
                  <div className="d-flex flex-wrap gap-2">
                    {[
                      { id: 'real', label: 'Real' },
                      { id: 'custom', label: 'Custom' },
                    ].map((o) => (
                      <FpPill
                        key={o.id}
                        label={o.label}
                        active={fp.hardwareConcurrency === o.id}
                        onClick={() => fpChange('hardwareConcurrency', o.id)}
                      />
                    ))}
                  </div>
                  {fp.hardwareConcurrency === 'custom' && (
                    <Form.Select className="mt-2" defaultValue="8">
                      {[2, 4, 6, 8, 12, 16].map((n) => (
                        <option key={n} value={String(n)}>
                          {n} cores
                        </option>
                      ))}
                    </Form.Select>
                  )}
                </div>

                {/* Device Memory */}
                <div>
                  <Form.Label className="fw-medium">Device Memory (RAM)</Form.Label>
                  <div className="d-flex flex-wrap gap-2">
                    {[
                      { id: 'real', label: 'Real' },
                      { id: 'custom', label: 'Custom' },
                    ].map((o) => (
                      <FpPill key={o.id} label={o.label} active={fp.deviceMemory === o.id} onClick={() => fpChange('deviceMemory', o.id)} />
                    ))}
                  </div>
                  {fp.deviceMemory === 'custom' && (
                    <Form.Select className="mt-2" defaultValue="8">
                      {[2, 4, 8, 16, 32].map((n) => (
                        <option key={n} value={String(n)}>
                          {n} GB
                        </option>
                      ))}
                    </Form.Select>
                  )}
                </div>

                {/* Fonts */}
                <div>
                  <Form.Label className="fw-medium">Fonts</Form.Label>
                  <div className="d-flex flex-wrap gap-2">
                    {[
                      { id: 'default', label: 'Default' },
                      { id: 'custom', label: 'Custom' },
                    ].map((o) => (
                      <FpPill key={o.id} label={o.label} active={fp.fonts === o.id} onClick={() => fpChange('fonts', o.id)} />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'advanced' && (
              <Card body>
                <div className="d-flex align-items-center gap-2 mb-3">
                  <Cpu size={18} style={{ color: 'var(--bs-accent)' }} />
                  <h5 className="fw-semibold mb-0">Advanced Settings</h5>
                </div>
                <p className="text-body-secondary small">Advanced browser configurations will appear here</p>
              </Card>
            )}
          </Col>

          {/* Right: Fingerprint Overview */}
          <Col lg={5}>
            <Card className="position-sticky" style={{ top: 0 }}>
              <Card.Header className="d-flex align-items-center justify-content-between">
                <span className="fw-semibold">Fingerprint Overview</span>
                <Button
                  variant="link"
                  size="sm"
                  className="p-0 d-flex align-items-center gap-1"
                  style={{ color: 'var(--bs-accent)' }}
                  onClick={regenerateFp}
                >
                  <RefreshCw size={14} /> Regenerate
                </Button>
              </Card.Header>

              <Card.Body className="small">
                <FingerprintRow label="Browser" value={`${browserLabel} (Auto)`} />
                <FingerprintRow label="User-Agent" value={formData.userAgent.slice(0, 40) + '...'} truncate />
                <FingerprintRow label="WebRTC" value={cap(fp.webRTC)} />
                <FingerprintRow label="Timezone" value={fp.timezone === 'based-on-ip' ? 'Based on IP' : cap(fp.timezone)} />
                <FingerprintRow
                  label="Location"
                  value={`[${fp.locationPermission === 'ask' ? 'Ask' : 'Allow'}] ${
                    fp.location === 'based-on-ip' ? 'Based on IP' : cap(fp.location)
                  }`}
                />
                <FingerprintRow label="Language" value={fp.language === 'based-on-ip' ? 'Based on IP' : fp.language} />
                <FingerprintRow
                  label="Display Lang"
                  value={fp.displayLanguage === 'based-on-language' ? 'Based on Language' : cap(fp.displayLanguage)}
                />
                <FingerprintRow
                  label="Resolution"
                  value={
                    fp.resolution === 'predefined'
                      ? fp.resolutionValue === 'based-on-ua'
                        ? 'Based on UA'
                        : fp.resolutionValue
                      : 'Custom'
                  }
                />
                <FingerprintRow label="Canvas" value={cap(fp.canvas)} />
                <FingerprintRow label="WebGL" value={cap(fp.webGL)} />
                <FingerprintRow label="Audio" value={cap(fp.audioContext)} />
                <FingerprintRow label="Fonts" value={cap(fp.fonts)} />
              </Card.Body>

              <Card.Footer>
                <button
                  type="button"
                  className="btn btn-link btn-sm p-0 d-flex align-items-center gap-1"
                  style={{ color: 'var(--bs-accent)' }}
                >
                  <Info size={14} /> View all fingerprint details <ChevronRight size={14} />
                </button>
              </Card.Footer>
            </Card>
          </Col>
        </Row>
      </div>

      {/* Footer */}
      <div className="d-flex justify-content-end gap-2 p-3 border-top">
        <Button variant="outline-secondary" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button className="btn-accent" onClick={handleSubmit} disabled={saving}>
          {saving ? 'Saving...' : isEditMode ? 'Save Changes' : 'Create Profile'}
        </Button>
      </div>
    </div>
  );
}