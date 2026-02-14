import React from 'react';
import './ProfileList.css';

function ProfileList({ profiles, onCreateProfile, onEditProfile, onDeleteProfile, onToggleProfile, onManageCookies, runningWs = {}, onCopyWs, onStopProfile, onViewLogs, selectedIds = {}, onToggleSelect, onSelectAll, onClearSelection, onStartSelected, onStopSelected, onCloneProfile, headlessPrefs = {}, onSetHeadless, enginePrefs = {}, onSetEngine, onDeleteSelected }) {
  const hasRunning = Object.values(runningWs || {}).some(Boolean);
  const selectedCount = Object.values(selectedIds || {}).filter(Boolean).length;
  return (
    <div className="profile-list-container">
      <div className="profile-scroll">
        {profiles.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🌐</div>
            <h3>No profiles yet</h3>
            <p>Create your first browser profile to get started</p>
            <button className="btn btn-primary" onClick={onCreateProfile}>
              Create Profile
            </button>
          </div>
        ) : (
          <div className="profile-grid">
            {profiles.map((profile) => (
            <div
              key={profile.id}
              className={`profile-card ${selectedIds[profile.id] ? 'selected' : ''}`}
              onClick={() => onToggleSelect(profile.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onToggleSelect(profile.id); }}
            >
              <div className="profile-card-header">
                <div className="profile-title">
                  <h3>{profile.name}</h3>
                  <div className="profile-id">ID: {profile.id}</div>
                </div>
                <div className="profile-statuses">
                  <span className="profile-status" title={runningWs[profile.id] || ''}>
                    {runningWs[profile.id] ? '🟢 Running' : '⛔ Stopped'}
                  </span>
                </div>
              </div>

              <div className="profile-card-body">
                {profile.description && (
                  <p className="profile-description">{profile.description}</p>
                )}

                {/* Antidetect flags quick-view */}
                {(() => {
                  const apply = (profile.settings && profile.settings.applyOverrides) || {};
                  const isOn = (k) => apply[k] !== false;
                  const geo = (profile.settings && profile.settings.geolocation) || {};
                  const wantGeo = Number.isFinite(Number(geo.latitude)) && Number.isFinite(Number(geo.longitude));
                  const items = [
                    { key: 'userAgent', label: 'UA', title: 'User Agent override' },
                    { key: 'language', label: 'Lang', title: 'Language/Accept-Language override' },
                    { key: 'timezone', label: 'TZ', title: 'Timezone override' },
                    { key: 'viewport', label: 'VP', title: 'Viewport & DPR override' },
                    { key: 'navigator', label: 'Nav', title: 'Navigator props override' },
                    { key: 'hardware', label: 'HW', title: 'HardwareConcurrency & DeviceMemory override' },
                    { key: 'webgl', label: 'WGL', title: 'WebGL vendor/renderer override' },
                    { key: 'geolocation', label: 'Geo', title: 'Geolocation override' },
                  ];
                  return (
                    <div className="antidetect-icons" onClick={(e)=>e.stopPropagation()}>
                      {items.map(({ key, label, title }) => {
                        let on = isOn(key);
                        if (key === 'geolocation') on = on && wantGeo; // only on if coords exist
                        const cls = `ad-icon ${on ? 'on' : 'off'}`;
                        const tooltip = `${title}: ${on ? 'Enabled' : 'Disabled'}`;
                        return (
                          <span key={key} className={cls} title={tooltip}>{label}</span>
                        );
                      })}
                    </div>
                  );
                })()}

                <div className="profile-info">
                  <div className="profile-info-item">
                    <span className="label">OS:</span>
                    <span className="value">{profile.fingerprint?.os || 'Not set'}</span>
                  </div>
                  <div className="profile-info-item">
                    <span className="label">Browser:</span>
                    <span className="value">{profile.fingerprint?.browser || 'Not set'}</span>
                  </div>
                  <div className="profile-info-item">
                    <span className="label">Resolution:</span>
                    <span className="value">
                      {profile.fingerprint?.screenResolution || 'Not set'}
                    </span>
                  </div>
                  <div className="profile-info-item">
                    <span className="label">Language:</span>
                    <span className="value">{profile.settings?.language || profile.fingerprint?.language || 'Not set'}</span>
                  </div>
                  <div className="profile-info-item">
                    <span className="label">Timezone:</span>
                    <span className="value">{profile.settings?.timezone || profile.fingerprint?.timezone || 'Not set'}</span>
                  </div>
                  <div className="profile-info-item">
                    <span className="label">Proxy:</span>
                    <span className="value">{profile.settings?.proxy?.server ? 'ON' : 'OFF'}</span>
                  </div>
                </div>

                {/* Headless switch row under Proxy, label left-aligned like others, switch on the right */}
                { (enginePrefs[profile.id] === 'playwright' || (!enginePrefs[profile.id] && (profile.settings?.engine !== 'cdp'))) && (
                  <div className="profile-info-item" onClick={(e)=>e.stopPropagation()}>
                    <span className="label" title="Chạy không UI (chỉ Playwright); Chrome CDP luôn hiển thị UI">Headless:</span>
                    <span className="value">
                      <label className={`switch ${runningWs[profile.id] ? 'disabled' : ''}`} title="Chạy không UI (Playwright). Chrome CDP hiện tại không hỗ trợ headless ở đây.">
                        <input
                          type="checkbox"
                          checked={!!headlessPrefs[profile.id]}
                          onChange={(e)=>{ onSetHeadless && onSetHeadless(profile.id, e.target.checked); }}
                          disabled={!!runningWs[profile.id]}
                        />
                        <span className="slider" />
                      </label>
                    </span>
                  </div>
                ) }

                {/* Engine select row */}
                <div className="profile-info-item" onClick={(e)=>e.stopPropagation()}>
                  <span className="label" title="Chọn engine khi launch: Playwright server hoặc Chrome thật (CDP)">Engine:</span>
                  <span className="value">
                    <select
                      value={enginePrefs[profile.id] || 'playwright'}
                      onChange={(e)=> onSetEngine && onSetEngine(profile.id, e.target.value)}
                      disabled={!!runningWs[profile.id]}
                    >
                      <option value="playwright">Playwright</option>
                      <option value="cdp">Real Chrome (CDP)</option>
                    </select>
                  </span>
                </div>

                {profile.createdAt && (
                  <p className="profile-date">
                    Created: {new Date(profile.createdAt).toLocaleDateString()}
                  </p>
                )}
              </div>

              <div className="profile-card-footer">
                <button
                  className={runningWs[profile.id] ? 'btn btn-danger' : 'btn btn-success'}
                  onClick={(e) => { e.stopPropagation(); onToggleProfile(profile.id); }}
                >
                  {runningWs[profile.id] ? '⛔ Stop' : '🚀 Launch'}
                </button>
                <button
                  className="btn"
                  onClick={(e) => { e.stopPropagation(); onCopyWs && onCopyWs(profile.id); }}
                  disabled={!runningWs[profile.id]}
                  title={runningWs[profile.id] || 'Not running'}
                >
                  🔗 Copy WS
                </button>
                <button
                  className="btn"
                  onClick={(e) => { e.stopPropagation(); onManageCookies(profile); }}
                >
                  🍪 Cookies
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={(e) => { e.stopPropagation(); onViewLogs && onViewLogs(profile); }}
                >
                  📜 Logs
                </button>
                <button
                  className="btn"
                  onClick={(e) => { e.stopPropagation(); onCloneProfile && onCloneProfile(profile.id); }}
                >
                  🧬 Clone
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={(e) => { e.stopPropagation(); onEditProfile(profile); }}
                >
                  ✏️ Edit
                </button>
                <button
                  className="btn btn-danger"
                  onClick={(e) => { e.stopPropagation(); onDeleteProfile(profile.id); }}
                >
                  🗑️ Delete
                </button>
              </div>
            </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default ProfileList;
