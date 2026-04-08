import React, { useState, useEffect } from 'react';
import './ProfileList.css';

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
  errorProfiles = {},
  profileStatuses = {}
}) {
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const totalPages = Math.max(1, Math.ceil((profiles || []).length / pageSize));
  // Reset to page 1 when profiles list changes significantly
  useEffect(() => { if (currentPage > totalPages) setCurrentPage(totalPages); }, [profiles?.length, pageSize]);
  const paginatedProfiles = (profiles || []).slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const shortId = (id) => (id || '').substring(0, 6);

  const getOsInfo = (p) => {
    const os = p?.fingerprint?.os || 'Windows';
    if (os === 'Windows') return { label: 'WIN32', icon: <WindowsIcon /> };
    if (os === 'macOS') return { label: 'MACINTEL', icon: <AppleIcon /> };
    return { label: 'LINUX', icon: null };
  };

  return (
    <div className="pl-container" style={{ padding: '1rem' }}>
      {/* Header */}
      <div className="pl-header">
        <h1 className="pl-title">Profiles</h1>
        <button className="pl-new-btn" onClick={onCreateProfile} style={{ background: 'var(--success)', borderRadius: '8px' }}>
          + New Profile
        </button>
      </div>

      {/* Cards */}
      <div className="pl-cards" style={{ overflowY: 'auto', flex: 1 }}>
        {(!profiles || profiles.length === 0) ? (
          <div className="pl-empty">
            No profiles yet. Click <strong>+ New Profile</strong> to create one.
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
            const isFirefox = engine === 'playwright-firefox';
            const engineLabel = isFirefox ? 'Firefox' : 'Chromium';
            
            const hasProxy = profile?.settings?.proxy?.type && profile.settings.proxy.type !== 'none' && profile.settings.proxy.server;
            const proxyType = hasProxy ? profile.settings.proxy.type.toUpperCase() : '';
            const proxyServer = hasProxy ? profile.settings.proxy.server : '';

            const cardClass = `pl-card ${isRunning || isStarting ? 'pl-card-running' : ''} ${hasError ? 'pl-card-error' : ''}`;

            return (
              <div key={profile.id} className={cardClass}>
                {/* Dot */}
                <div className={`pl-dot ${isRunning || isStarting ? 'pl-dot-active' : ''} ${hasError ? 'pl-dot-error' : ''} ${isStarting ? 'pl-dot-starting' : ''}`} />

                {/* Info: 3 rows */}
                <div className="pl-info">
                  {/* Row 1: shortId + engine badge + name */}
                  <div className="pl-name-row">
                    <span className="pl-id">{shortId(profile.id)}</span>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: '5px',
                      padding: '2px 8px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 600,
                      background: isFirefox ? 'rgba(234,88,12,0.15)' : 'rgba(16,185,129,0.15)',
                      color: isFirefox ? '#fb923c' : '#34d399',
                      border: `1px solid ${isFirefox ? 'rgba(234,88,12,0.3)' : 'rgba(16,185,129,0.3)'}`,
                    }}>
                      <span style={{
                        width: '6px', height: '6px', borderRadius: '50%',
                        background: isFirefox ? '#fb923c' : '#10b981',
                      }} />
                      {engineLabel}
                    </span>
                    <span className="pl-name">{profile.name || 'Profile'}</span>
                  </div>

                  {/* Row 2: OS + browser + resolution tags */}
                  <div className="pl-tags" style={{ marginBottom: '4px' }}>
                    <span className="pl-tag">
                      {osInfo.icon && <span className="pl-tag-icon">{osInfo.icon}</span>}
                      {osInfo.label}
                    </span>
                    <span className="pl-tag">
                      <span className="pl-tag-icon">{isFirefox ? <FoxIcon /> : <ChromiumIcon />}</span>
                      {browser}
                    </span>
                    <span className="pl-tag">
                      <span className="pl-tag-icon"><MonitorIcon /></span>
                      {res}
                    </span>
                    {hasProxy && (
                      <span className="pl-tag" style={{ background: '#94a3b8', color: '#cbd5e1', borderColor: 'transparent', paddingLeft: '6px' }}>
                        <span className="pl-tag-icon" style={{ color: '#1e293b' }}><LinkIcon /></span>
                        <span style={{ color: '#bfdbfe', fontWeight: 'bold' }}>{proxyType}</span>
                        <span style={{ color: '#e2e8f0', marginLeft: '4px' }}>{proxyServer}</span>
                      </span>
                    )}
                  </div>

                  {/* Row 3: Fingerprint section toggle badges */}
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                    {BADGE_MAP.map(({ key, label, section, title }) => {
                      const isEnabled = !!profile?.settings?.[section]?.enabled;
                      const isWarn = key === 'DSP' && isEnabled; // Display spoofing triggers warning
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
                    <button className="pl-btn" style={{ background: '#c07e15' }} onClick={() => onStopProfile(profile.id)}>Stop</button>
                  ) : (
                    <>
                      <button className="pl-btn pl-btn-launch" onClick={() => onToggleProfile(profile.id)}>Launch</button>
                      <button className="pl-btn pl-btn-headless" onClick={() => onLaunchHeadless(profile.id)}>Headless</button>
                    </>
                  )}
                  <button className="pl-btn pl-btn-proxy" onClick={() => onEditProfile(profile)} disabled={isTransitioning}>Proxy</button>
                  <button className="pl-btn pl-btn-clone" onClick={() => onCloneProfile(profile.id)} disabled={isTransitioning}>Clone</button>
                  <button className="pl-btn pl-btn-edit" onClick={() => onEditProfile(profile)} disabled={isTransitioning}>Edit</button>
                  <button className="pl-btn pl-btn-delete" onClick={() => onDeleteProfile(profile.id)} disabled={isRunning || isTransitioning}>Delete</button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {profiles && profiles.length > pageSize && (
        <div className="pl-pagination">
          <div className="pl-pagination-info">
            Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, profiles.length)} of {profiles.length} profiles
          </div>
          <div className="pl-pagination-controls">
            <select className="pl-pagination-size" value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}>
              {[5, 10, 20, 50].map(n => <option key={n} value={n}>{n} / page</option>)}
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
    </div>
  );
}

