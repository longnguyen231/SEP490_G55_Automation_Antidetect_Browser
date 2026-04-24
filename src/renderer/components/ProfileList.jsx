import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, X } from 'lucide-react';
import './ProfileList.css';

function ProxyPickerPopup({ profile, isRunning = false, onClose, onSaved }) {
  const [proxies, setProxies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const list = await window.electronAPI.getProxies();
        setProxies(Array.isArray(list) ? list : []);
      } catch { }
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const currentServer = profile?.settings?.proxy?.server || '';

  const handleSelect = async (proxy) => {
    setSaving(true);
    let proxyStatus = null;
    if (proxy) {
      setChecking(true);
      try {
        const result = await Promise.race([
          window.electronAPI.checkProxy({
            type: proxy.type, host: proxy.host, port: proxy.port,
            username: proxy.username || '', password: proxy.password || '',
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000)),
        ]);
        proxyStatus = { alive: !!result.alive, checkedAt: Date.now(), latency: result.latency || null };
      } catch {
        proxyStatus = { alive: false, checkedAt: Date.now(), latency: null };
      }
      setChecking(false);
      if (!proxyStatus.alive) {
        setSaving(false);
        alert(`Proxy ${proxy.host}:${proxy.port} is dead or unreachable. Cannot assign a dead proxy to a profile.`);
        return;
      }
    }
    try {
      const server = proxy ? `${proxy.host}:${proxy.port}` : '';
      const updated = {
        ...profile,
        settings: {
          ...profile.settings,
          proxy: proxy ? {
            type: proxy.type || 'http',
            server,
            username: proxy.username || '',
            password: proxy.password || '',
            _status: proxyStatus,
          } : { type: 'none', server: '', username: '', password: '' },
        },
      };
      const res = await window.electronAPI.saveProfile(updated);
      if (res?.success) { onSaved(res.profile || updated); onClose(); }
      else alert(res?.error || 'Failed to save');
    } catch (e) { alert(e.message); }
    setSaving(false);
  };

  const filtered = proxies.filter(p =>
    !search || `${p.name} ${p.host} ${p.type}`.toLowerCase().includes(search.toLowerCase())
  );

  const statusColor = (s) => s === 'alive' ? '#10b981' : s === 'dead' ? '#ef4444' : '#6b7280';

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '80px', background: 'rgba(0,0,0,0.4)' }}>
      <div ref={ref} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '10px', width: '440px', maxHeight: '480px', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
        {/* Header */}
        <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--fg)' }}>Assign Proxy</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '2px' }}>{profile?.name}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: '1.1rem', padding: '4px 8px' }}>✕</button>
        </div>
        {/* Running warning */}
        {isRunning && (
          <div style={{ padding: '8px 16px', background: 'rgba(245,158,11,0.12)', borderBottom: '1px solid rgba(245,158,11,0.3)', fontSize: '0.75rem', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>⚠</span> Profile is running — will restart automatically to apply the new proxy
          </div>
        )}
        {/* Search */}
        <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)' }}>
          <input
            autoFocus
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search proxy..."
            style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--card2)', color: 'var(--fg)', fontSize: '0.82rem', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>
        {/* List */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '6px 8px' }}>
          {loading ? (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--muted)', fontSize: '0.82rem' }}>Loading...</div>
          ) : (
            <>
              {/* None option */}
              <div
                onClick={() => !saving && handleSelect(null)}
                style={{ padding: '8px 10px', borderRadius: '6px', cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', background: !currentServer ? 'rgba(99,102,241,0.12)' : 'transparent', border: !currentServer ? '1px solid rgba(99,102,241,0.3)' : '1px solid transparent' }}
                onMouseEnter={e => { if (currentServer) e.currentTarget.style.background = 'var(--card2)'; }}
                onMouseLeave={e => { if (currentServer) e.currentTarget.style.background = 'transparent'; }}
              >
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#6b7280', flexShrink: 0 }} />
                <span style={{ fontSize: '0.82rem', color: 'var(--muted)', fontStyle: 'italic' }}>No proxy (direct)</span>
                {!currentServer && <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: '#818cf8' }}>current</span>}
              </div>
              {filtered.length === 0 && (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--muted)', fontSize: '0.82rem' }}>
                  No proxies found. Add some in the Proxy Manager.
                </div>
              )}
              {filtered.map(p => {
                const server = `${p.host}:${p.port}`;
                const isCurrent = currentServer === server;
                return (
                  <div
                    key={p.id}
                    onClick={() => !saving && handleSelect(p)}
                    style={{ padding: '8px 10px', borderRadius: '6px', cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px', background: isCurrent ? 'rgba(99,102,241,0.12)' : 'transparent', border: isCurrent ? '1px solid rgba(99,102,241,0.3)' : '1px solid transparent' }}
                    onMouseEnter={e => { if (!isCurrent) e.currentTarget.style.background = 'var(--card2)'; }}
                    onMouseLeave={e => { if (!isCurrent) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: statusColor(p.status), flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name || server}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>{p.type?.toUpperCase()} · {server}</div>
                    </div>
                    {isCurrent && <span style={{ fontSize: '0.7rem', color: '#818cf8', flexShrink: 0 }}>current</span>}
                    {p.latency && <span style={{ fontSize: '0.7rem', color: '#10b981', flexShrink: 0 }}>{p.latency}ms</span>}
                  </div>
                );
              })}
            </>
          )}
        </div>
        {(checking || saving) && (
          <div style={{ padding: '8px 16px', borderTop: '1px solid var(--border)', fontSize: '0.78rem', color: 'var(--muted)', textAlign: 'center' }}>
            {checking ? '🔍 Checking proxy...' : 'Saving...'}
          </div>
        )}
      </div>
    </div>
  );
}

// Common SVG Icons
const ChromiumIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="4" />
    <line x1="21.17" y1="8" x2="12" y2="8" />
    <line x1="3.95" y1="6.06" x2="8.54" y2="14" />
    <line x1="10.88" y1="21.94" x2="15.46" y2="14" />
  </svg>
);

const AppleIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none">
    <path d="M12 2.04C10.5 2.04 9 3.54 9 5c1.5 0 3-1.5 3-2.96zm1.2 19.33c-.71.55-1.55.84-3.2.84-1.65 0-2.49-.29-3.2-.84-2.1-1.65-4.8-6.15-4.8-10.35 0-3.3 2.1-5.1 4.5-5.1 1.2 0 2.4.6 3.3 1.2.9-.6 2.1-1.2 3.3-1.2 2.4 0 4.5 1.8 4.5 5.1 0 4.2-2.7 8.7-4.8 10.35z"/>
  </svg>
);

const FoxIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ea580c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 6s-2-2-5-2-4 2-4 2-2-2-4-2-5 2-5 2l1.6 4.8c0 0-1.6 3.2-1.6 6.4 0 3.2 2.4 4.8 4 4.8s4-2 6-2 4.4 2 6 2 4-1.6 4-4.8c0-3.2-1.6-6.4-1.6-6.4L22 6z"/>
  </svg>
);

const MonitorIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
    <line x1="8" y1="21" x2="16" y2="21" />
    <line x1="12" y1="17" x2="12" y2="21" />
  </svg>
);

const WindowsIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none">
    <path d="M3 5.5l7.5-1v7H3V5.5zm0 13l7.5 1v-7H3v6zm8.5 1.2L21 21V12.5h-9.5v7.2zm0-15.4v7.2H21V3l-9.5 1.3z"/>
  </svg>
);

const LinkIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
  </svg>
);

// Mapping badge label -> path in profile.settings (sub-object with .enabled)
const BADGE_MAP = [
  { key: 'ID',  label: 'ID',  section: 'identity', title: 'Identity (UA/platform/locale)' },
  { key: 'DSP', label: 'DSP', section: 'display',  title: 'Display & Screen' },
  { key: 'HW',  label: 'HW',  section: 'hardware', title: 'Hardware (CPU/RAM/GPU)' },
  { key: 'CVS', label: 'CVS', section: 'canvas',   title: 'Canvas Fingerprint' },
  { key: 'GL',  label: 'GL',  section: 'webgl',    title: 'WebGL Fingerprint' },
  { key: 'AUD', label: 'AUD', section: 'audio',    title: 'Audio Fingerprint' },
  { key: 'MED', label: 'MED', section: 'media',    title: 'Media Devices' },
  { key: 'NET', label: 'NET', section: 'network',  title: 'Network & WebRTC' },
  { key: 'BAT', label: 'BAT', section: 'battery',  title: 'Battery API' },
];

export default function ProfileList({
  profiles, onCreateProfile, onEditProfile, onDeleteProfile, onToggleProfile,
  onLaunchHeadless, onManageCookies, runningWs = {}, onCopyWs, onStopProfile, onViewLogs,
  selectedIds = {}, onToggleSelect, onSelectAll, onClearSelection,
  onStartSelected, onStopSelected, onCloneProfile,
  headlessPrefs = {}, onSetHeadless, enginePrefs = {}, onSetEngine, onDeleteSelected,
  onCloneSelected,
  onCreateBulk,
  errorProfiles = {},
  profileStatuses = {},
  onToggleFp,
  onReloadProfiles,
  onViewLiveScreen,
}) {
  // Search, filter, sort
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [engineFilter, setEngineFilter] = useState('all');
  const [sortBy, setSortBy] = useState('created-desc');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Reset page on filter/sort change
  useEffect(() => { setCurrentPage(1); }, [searchQuery, statusFilter, engineFilter, sortBy]);

  // Filtered + sorted profiles
  const filteredProfiles = useMemo(() => {
    let list = profiles || [];

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(p =>
        (p.name || '').toLowerCase().includes(q) ||
        (p.id || '').toLowerCase().includes(q) ||
        (p.settings?.proxy?.server || '').toLowerCase().includes(q)
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      list = list.filter(p => {
        const st = profileStatuses[p.id]?.status;
        const isRunning = st === 'RUNNING' || (!st && !!runningWs[p.id]);
        const isError = st === 'ERROR' || (!!errorProfiles[p.id] && !isRunning);
        if (statusFilter === 'running') return isRunning || st === 'STARTING';
        if (statusFilter === 'stopped') return !isRunning && !isError && st !== 'STARTING' && st !== 'STOPPING';
        if (statusFilter === 'error') return isError;
        return true;
      });
    }

    // Engine filter
    if (engineFilter !== 'all') {
      list = list.filter(p => {
        const eng = (p.settings?.engine || 'playwright').toLowerCase();
        if (engineFilter === 'chromium') return eng === 'playwright' || eng === 'cdp';
        if (engineFilter === 'firefox') return eng === 'playwright-firefox' || eng === 'firefox';
        if (engineFilter === 'camoufox') return eng === 'camoufox';
        return true;
      });
    }

    // Sort
    list = [...list].sort((a, b) => {
      switch (sortBy) {
        case 'name-asc': return (a.name || '').localeCompare(b.name || '');
        case 'name-desc': return (b.name || '').localeCompare(a.name || '');
        case 'created-asc': return (a.createdAt || '').localeCompare(b.createdAt || '');
        case 'created-desc': return (b.createdAt || '').localeCompare(a.createdAt || '');
        case 'status': {
          const rank = (p) => {
            const st = profileStatuses[p.id]?.status;
            if (st === 'RUNNING' || st === 'STARTING' || runningWs[p.id]) return 0;
            if (st === 'ERROR' || errorProfiles[p.id]) return 2;
            return 1;
          };
          return rank(a) - rank(b);
        }
        default: return 0;
      }
    });

    return list;
  }, [profiles, searchQuery, statusFilter, engineFilter, sortBy, profileStatuses, runningWs, errorProfiles]);

  const totalPages = Math.max(1, Math.ceil(filteredProfiles.length / pageSize));
  useEffect(() => { if (currentPage > totalPages) setCurrentPage(totalPages); }, [filteredProfiles.length, pageSize]);
  const paginatedProfiles = filteredProfiles.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const isFiltered = searchQuery || statusFilter !== 'all' || engineFilter !== 'all';
  const clearFilters = () => { setSearchQuery(''); setStatusFilter('all'); setEngineFilter('all'); };

  // Bulk selection
  const selectedCount = Object.keys(selectedIds).filter(id => selectedIds[id]).length;

  // Proxy picker popup
  const [proxyPickerProfile, setProxyPickerProfile] = useState(null);

  // Bulk create modal
  const [showBulkCreate, setShowBulkCreate] = useState(false);
  const [bulkCount, setBulkCount] = useState(5);
  const [bulkPrefix, setBulkPrefix] = useState('Profile');
  const [bulkEngine, setBulkEngine] = useState('playwright');
  const [bulkCreating, setBulkCreating] = useState(false);

  const shortId = (id) => (id || '').substring(0, 6);

  const getOsInfo = (p) => {
    const os = p?.fingerprint?.os || 'Windows';
    if (os === 'Windows') return { label: 'Win', icon: <WindowsIcon /> };
    if (os === 'macOS') return { label: 'macOS', icon: <AppleIcon /> };
    return { label: 'Linux', icon: null };
  };

  return (
    <div className="pl-container" style={{ padding: '1rem' }}>
      {/* Header */}
      <div className="pl-header">
        <h1 className="pl-title">Profiles {profiles && profiles.length > 0 && <span className="pl-count">({profiles.length})</span>}</h1>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {onCreateBulk && (
            <button className="pl-new-btn" onClick={() => setShowBulkCreate(true)} style={{ background: '#6366f1', borderRadius: '8px' }}>
              + Create Multiple
            </button>
          )}
          <button className="pl-new-btn" onClick={onCreateProfile} style={{ background: 'var(--success)', borderRadius: '8px' }}>
            + New Profile
          </button>
        </div>
      </div>

      {/* Search / Filter / Sort Toolbar */}
      {profiles && profiles.length > 0 && (
        <div className="pl-toolbar">
          <label className="pl-select-all">
            <input
              type="checkbox"
              checked={selectedCount > 0 && selectedCount === (profiles || []).length}
              onChange={selectedCount > 0 ? onClearSelection : onSelectAll}
            />
            <span>{selectedCount > 0 ? `${selectedCount}` : 'All'}</span>
          </label>
          <div className="pl-search">
            <Search size={14} className="pl-search-icon" />
            <input
              placeholder="Search by name, ID, proxy..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button className="pl-search-clear" onClick={() => setSearchQuery('')}>
                <X size={14} />
              </button>
            )}
          </div>
          <select className="pl-filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="all">All Status</option>
            <option value="running">Running</option>
            <option value="stopped">Stopped</option>
            <option value="error">Error</option>
          </select>
          <select className="pl-filter-select" value={engineFilter} onChange={e => setEngineFilter(e.target.value)}>
            <option value="all">All Engines</option>
            <option value="chromium">Chromium</option>
            <option value="firefox">Firefox</option>
            <option value="camoufox">Camoufox</option>
          </select>
          <select className="pl-filter-select" value={sortBy} onChange={e => setSortBy(e.target.value)}>
            <option value="created-desc">Newest first</option>
            <option value="created-asc">Oldest first</option>
            <option value="name-asc">Name A–Z</option>
            <option value="name-desc">Name Z–A</option>
            <option value="status">Status</option>
          </select>
          {isFiltered && (
            <span className="pl-result-count">
              {filteredProfiles.length} of {profiles.length}
              {' '}<button className="pl-clear-filters" onClick={clearFilters}>Clear</button>
            </span>
          )}
        </div>
      )}

      {/* Cards */}
      <div className="pl-cards">
        {(!profiles || profiles.length === 0) ? (
          <div className="pl-empty-state">
            <div className="pl-empty-icon">
              <Search size={32} strokeWidth={1.5} style={{ color: 'var(--muted)' }} />
            </div>
            <h3>No profiles yet</h3>
            <p>Create your first browser profile to get started with antidetect browsing.</p>
            <button className="pl-new-btn" onClick={onCreateProfile} style={{ background: 'var(--success)', borderRadius: '8px' }}>
              + New Profile
            </button>
          </div>
        ) : filteredProfiles.length === 0 ? (
          <div className="pl-empty">
            No profiles match your filters. <button className="pl-clear-filters" onClick={clearFilters}>Clear filters</button>
          </div>
        ) : (
          paginatedProfiles.map(profile => {
            const pStatus = profileStatuses[profile.id]?.status;
            const isStarting = pStatus === 'STARTING';
            const isStopping = pStatus === 'STOPPING';
            const isRunning = pStatus === 'RUNNING' || (!isStarting && !isStopping && !!runningWs[profile.id]);
            const isTransitioning = isStarting || isStopping;
            const hasError = (pStatus === 'ERROR' || !!errorProfiles[profile.id]) && !isRunning && !isStarting;
            const osInfo = getOsInfo(profile);
            const browser = profile?.fingerprint?.browser || 'Chrome';
            const res = profile?.fingerprint?.screenResolution || '1920x1080';
            const engine = profile?.settings?.engine || 'playwright';
            const isFirefox = engine === 'playwright-firefox' || engine === 'firefox';
            const isCamoufox = engine === 'camoufox';
            const engineLabel = isCamoufox ? 'Camoufox' : isFirefox ? 'Firefox' : 'Chromium';
            
            const hasProxy = profile?.settings?.proxy?.type && profile.settings.proxy.type !== 'none' && profile.settings.proxy.server;
            const proxyType = hasProxy ? profile.settings.proxy.type.toUpperCase() : '';
            const proxyServer = hasProxy ? profile.settings.proxy.server : '';

            const cardClass = `pl-card ${isRunning || isStarting ? 'pl-card-running' : ''} ${hasError ? 'pl-card-error' : ''}`;

            return (
              <div key={profile.id} className={cardClass}>
                {/* Selection checkbox */}
                <input
                  type="checkbox"
                  className="pl-checkbox"
                  checked={!!selectedIds[profile.id]}
                  onChange={() => onToggleSelect(profile.id)}
                  onClick={(e) => e.stopPropagation()}
                />
                {/* Status dot */}
                <div className={`pl-dot ${isRunning || isStarting ? 'pl-dot-active' : ''} ${hasError ? 'pl-dot-error' : ''} ${isStarting ? 'pl-dot-starting' : ''}`} />

                {/* "P" Avatar */}
                <div style={{
                  width: '36px', height: '36px', borderRadius: '8px', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: isCamoufox ? 'rgba(168,85,247,0.85)' : isFirefox ? 'rgba(234,88,12,0.85)' : 'rgba(37,99,235,0.85)',
                  color: '#fff', fontWeight: 700, fontSize: '0.95rem', letterSpacing: '-0.5px',
                  boxShadow: `0 2px 8px ${isCamoufox ? 'rgba(168,85,247,0.3)' : isFirefox ? 'rgba(234,88,12,0.3)' : 'rgba(37,99,235,0.3)'}`,
                }}>
                  P
                </div>

                {/* Info */}
                <div className="pl-info">
                  {/* Row 1: name + short ID (copy) + engine badge (CR/FF) */}
                  <div className="pl-name-row">
                    <span className="pl-name">{profile.name || 'Profile'}</span>

                    {/* Short ID — click to copy */}
                    <span
                      title="Click to copy profile ID"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigator.clipboard.writeText(profile.id || '').then(() => {
                          const el = e.currentTarget;
                          const prev = el.textContent;
                          el.textContent = 'Copied!';
                          setTimeout(() => { el.textContent = prev; }, 1200);
                        }).catch(() => {});
                      }}
                      style={{
                        fontSize: '0.7rem', color: 'var(--muted)', fontFamily: 'monospace',
                        background: 'var(--glass)', border: '1px solid var(--border2)',
                        borderRadius: '4px', padding: '2px 6px', cursor: 'pointer',
                        userSelect: 'none', letterSpacing: '0.03em', flexShrink: 0,
                        transition: 'color 0.15s, background 0.15s',
                        display: 'flex', alignItems: 'center', gap: '4px'
                      }}
                      onMouseEnter={e => { e.currentTarget.style.color = 'var(--fg)'; e.currentTarget.style.background = 'var(--card2)'; }}
                      onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.background = 'var(--glass)'; }}
                    >
                      <span>{shortId(profile.id)}</span>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                    </span>

                    {/* Engine badge: CR / FF */}
                    <span style={{
                      display: 'inline-flex', alignItems: 'center',
                      padding: '1px 7px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700,
                      background: isCamoufox ? 'rgba(168,85,247,0.15)' : isFirefox ? 'rgba(234,88,12,0.15)' : 'rgba(37,99,235,0.15)',
                      color: isCamoufox ? '#c084fc' : isFirefox ? '#fb923c' : '#60a5fa',
                      border: `1px solid ${isCamoufox ? 'rgba(168,85,247,0.35)' : isFirefox ? 'rgba(234,88,12,0.35)' : 'rgba(37,99,235,0.35)'}`,
                      letterSpacing: '0.04em',
                    }}>
                      {isCamoufox ? 'CF' : isFirefox ? 'FF' : 'CR'}
                    </span>

                    {isRunning && <span className="pl-status-label pl-status-running">Running</span>}
                    {isStarting && <span className="pl-status-label pl-status-starting">Starting...</span>}
                    {isStopping && <span className="pl-status-label pl-status-starting">Stopping...</span>}
                    {hasError && <span className="pl-status-label pl-status-error">Error</span>}
                  </div>

                  {/* Row 2: OS + browser + resolution tags */}
                  <div className="pl-tags" style={{ marginBottom: '4px' }}>
                    <span className="pl-tag">
                      {osInfo.icon && <span className="pl-tag-icon">{osInfo.icon}</span>}
                      {osInfo.label}
                    </span>
                    <span className="pl-tag">
                      <span className="pl-tag-icon">{(isFirefox || isCamoufox) ? <FoxIcon /> : <ChromiumIcon />}</span>
                      {browser}
                    </span>
                    <span className="pl-tag">
                      <span className="pl-tag-icon"><MonitorIcon /></span>
                      {res}
                    </span>
                  </div>

                  {/* Row 2b: Proxy (only if set) */}
                  {hasProxy && (
                    <div style={{ marginBottom: '4px' }}>
                      <span className="pl-tag" style={{ background: 'rgba(99,102,241,0.12)', color: 'var(--fg)', border: '1px solid rgba(99,102,241,0.25)', maxWidth: '100%' }}>
                        <span className="pl-tag-icon"><LinkIcon /></span>
                        <span style={{ color: '#818cf8', fontWeight: 700, flexShrink: 0 }}>{proxyType}</span>
                        <span style={{ color: 'var(--muted)', marginLeft: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '260px' }}>{proxyServer}</span>
                      </span>
                    </div>
                  )}

                  {/* Row 3: Fingerprint section badges */}
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                    {BADGE_MAP.map(({ key, label, section, title }) => {
                      const isEnabled = !!profile?.settings?.[section]?.enabled;
                      const isWarn = key === 'DSP' && isEnabled;
                      return (
                        <button
                          key={key}
                          title={`${title} — click to ${isEnabled ? 'disable' : 'enable'}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleFp && onToggleFp(profile, section, !isEnabled);
                          }}
                          className={`pl-fp-badge ${isWarn ? 'pl-fp-badge-warn' : isEnabled ? 'pl-fp-badge-on' : 'pl-fp-badge-off'}`}
                        >
                          {label}{isWarn && '!'}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Actions */}
                <div className="pl-actions">
                  {isStarting ? (
                    <button className="pl-btn" style={{ background: '#6366f1', opacity: 0.8, cursor: 'wait' }} disabled>Starting...</button>
                  ) : isStopping ? (
                    <button className="pl-btn" style={{ background: '#f59e0b', opacity: 0.8, cursor: 'wait' }} disabled>Stopping...</button>
                  ) : isRunning ? (
                    <>
                      <button className="pl-btn" style={{ background: '#c07e15' }} onClick={() => onStopProfile(profile.id)}>Stop</button>
                      {!!headlessPrefs[profile.id] && onViewLiveScreen && (
                        <button
                          className="pl-btn"
                          style={{ background: 'rgba(139, 92, 246, 0.2)', color: '#a78bfa', border: '1px solid rgba(139, 92, 246, 0.4)' }}
                          onClick={() => onViewLiveScreen(profile)}
                          title="View live headless screen"
                        >
                          👁 View
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      <button className="pl-btn pl-btn-launch" onClick={() => onToggleProfile(profile.id)}>Launch</button>
                      <button className="pl-btn pl-btn-headless" onClick={() => onLaunchHeadless(profile.id)}>Headless</button>
                    </>
                  )}
                  <button className="pl-btn pl-btn-proxy" onClick={() => setProxyPickerProfile({ profile, isRunning })} disabled={isTransitioning}>Proxy</button>
                  <button className="pl-btn pl-btn-clone" onClick={() => onCloneProfile(profile.id)} disabled={isTransitioning}>Clone</button>
                  <button className="pl-btn pl-btn-edit" onClick={() => onEditProfile(profile)} disabled={isTransitioning}>Edit</button>
                  <button className="pl-btn pl-btn-delete" onClick={() => onDeleteProfile(profile.id)} disabled={isRunning || isTransitioning}>Delete</button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Floating Bulk Action Bar */}
      {selectedCount > 0 && (
        <div className="pl-bulk-bar">
          <span className="pl-bulk-count">{selectedCount} selected</span>
          <button className="pl-btn pl-btn-launch" onClick={onStartSelected}>Launch ({selectedCount})</button>
          <button className="pl-btn" style={{ background: '#c07e15' }} onClick={onStopSelected}>Stop ({selectedCount})</button>
          {onCloneSelected && <button className="pl-btn pl-btn-clone" onClick={onCloneSelected}>Clone ({selectedCount})</button>}
          <button className="pl-btn pl-btn-delete" onClick={onDeleteSelected}>Delete ({selectedCount})</button>
          <button className="pl-btn pl-btn-edit" onClick={onClearSelection}>Clear</button>
        </div>
      )}

      {/* Pagination — always show when there are profiles */}
      {profiles && profiles.length > 0 && (
        <div className="pl-pagination">
          <div className="pl-pagination-info">
            {filteredProfiles.length > 0
              ? <>Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filteredProfiles.length)} of {filteredProfiles.length} profiles
                  {isFiltered && ` (filtered from ${profiles.length})`}
                </>
              : <>0 profiles{isFiltered && ` (filtered from ${profiles.length})`}</>}
          </div>
          <div className="pl-pagination-controls">
            <select className="pl-pagination-size" value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}>
              {[5, 10, 20, 50, 100].map(n => <option key={n} value={n}>{n} / page</option>)}
            </select>
            <button className="pl-pagination-btn" disabled={currentPage <= 1} onClick={() => setCurrentPage(1)} title="First">«</button>
            <button className="pl-pagination-btn" disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)} title="Previous">‹</button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2)
              .reduce((acc, p, i, arr) => {
                if (i > 0 && p - arr[i - 1] > 1) acc.push('...');
                acc.push(p);
                return acc;
              }, [])
              .map((p, i) =>
                p === '...'
                  ? <span key={'dot' + i} className="pl-pagination-dots">…</span>
                  : <button key={p} className={`pl-pagination-btn ${p === currentPage ? 'pl-pagination-active' : ''}`} onClick={() => setCurrentPage(p)}>{p}</button>
              )}
            <button className="pl-pagination-btn" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)} title="Next">›</button>
            <button className="pl-pagination-btn" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(totalPages)} title="Last">»</button>
          </div>
        </div>
      )}

      {/* Proxy Picker Popup */}
      {proxyPickerProfile && (
        <ProxyPickerPopup
          profile={proxyPickerProfile.profile}
          isRunning={proxyPickerProfile.isRunning}
          onClose={() => setProxyPickerProfile(null)}
          onSaved={async (updatedProfile) => {
            setProxyPickerProfile(null);
            onReloadProfiles?.();
            if (proxyPickerProfile.isRunning) {
              // Restart to apply new proxy
              await window.electronAPI.stopProfile(updatedProfile.id);
              await new Promise(r => setTimeout(r, 800));
              await window.electronAPI.launchProfile(updatedProfile.id, {});
            }
          }}
        />
      )}

      {/* Bulk Create Modal */}
      {showBulkCreate && (
        <div className="pl-modal-backdrop">
          <div className="pl-modal-card">
            <div className="pl-modal-header">
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--fg)' }}>Create Multiple Profiles</h3>
              <button className="pl-modal-close" onClick={() => setShowBulkCreate(false)}>✕</button>
            </div>
            <div className="pl-modal-body">
              <div className="pl-modal-field">
                <label>Name Prefix</label>
                <input
                  type="text"
                  value={bulkPrefix}
                  onChange={e => setBulkPrefix(e.target.value)}
                  placeholder="Profile"
                  maxLength={60}
                />
              </div>
              <div className="pl-modal-field">
                <label>Browser Engine</label>
                <select style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', background: 'var(--glass)', border: '1px solid var(--border)', color: 'var(--fg)', fontSize: '0.85rem' }} value={bulkEngine} onChange={e => setBulkEngine(e.target.value)}>
                  <option value="playwright">Chromium (Playwright)</option>
                  <option value="playwright-firefox">Firefox (Playwright)</option>
                  <option value="camoufox">Camoufox (Anti-detect)</option>
                </select>
              </div>
              <div className="pl-modal-field">
                <label>Number of Profiles</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <input
                    type="range"
                    min={1}
                    max={100}
                    value={bulkCount}
                    onChange={e => setBulkCount(Number(e.target.value))}
                    style={{ flex: 1 }}
                  />
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={bulkCount}
                    onChange={e => { const v = Math.max(1, Math.min(100, Number(e.target.value) || 1)); setBulkCount(v); }}
                    style={{ width: '60px', textAlign: 'center' }}
                  />
                </div>
              </div>
              <div className="pl-modal-preview">
                Preview: <strong>{bulkPrefix || 'Profile'} 1</strong> ... <strong>{bulkPrefix || 'Profile'} {bulkCount}</strong>
              </div>
            </div>
            <div className="pl-modal-footer">
              <button className="pl-btn pl-btn-edit" onClick={() => setShowBulkCreate(false)} disabled={bulkCreating}>Cancel</button>
              <button
                className="pl-btn pl-btn-launch"
                disabled={bulkCreating || !bulkPrefix.trim() || bulkCount < 1}
                onClick={async () => {
                  setBulkCreating(true);
                  try {
                    await onCreateBulk(bulkCount, bulkPrefix.trim() || 'Profile', bulkEngine);
                    setShowBulkCreate(false);
                    setBulkCount(5);
                    setBulkPrefix('Profile');
                    setBulkEngine('playwright');
                  } catch { }
                  setBulkCreating(false);
                }}
              >
                {bulkCreating ? 'Creating...' : `Create ${bulkCount} Profiles`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
