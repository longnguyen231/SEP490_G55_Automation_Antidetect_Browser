import React from 'react';
import './ProfileList.css';

function ProfileList({
  profiles, onCreateProfile, onEditProfile, onDeleteProfile, onToggleProfile,
  onLaunchHeadless, onManageCookies, runningWs = {}, onCopyWs, onStopProfile, onViewLogs,
  selectedIds = {}, onToggleSelect, onSelectAll, onClearSelection,
  onStartSelected, onStopSelected, onCloneProfile,
  headlessPrefs = {}, onSetHeadless, enginePrefs = {}, onSetEngine, onDeleteSelected,
  errorProfiles = {}
}) {
  const shortId = (id) => (id || '').substring(0, 5);

  const getOsLabel = (p) => {
    const os = p?.fingerprint?.os || 'Windows';
    if (os === 'Windows') return 'WIN32';
    if (os === 'macOS') return 'MacIntel';
    return 'Linux';
  };

  return (
    <div className="pl-container">
      {/* Header */}
      <div className="pl-header">
        <h1 className="pl-title">Profiles</h1>
        <button className="pl-new-btn" onClick={onCreateProfile}>+ New Profile</button>
      </div>

      {/* Profile cards */}
      <div className="pl-cards">
        {(!profiles || profiles.length === 0) ? (
          <div className="pl-empty">
            <p>No profiles yet. Click <strong>+ New Profile</strong> to create one.</p>
          </div>
        ) : (
          profiles.map(profile => {
            const isRunning = !!runningWs[profile.id];
            const osLabel = getOsLabel(profile);
            const browser = profile?.fingerprint?.browser || 'Chrome';
            const res = profile?.fingerprint?.screenResolution || '1920x1080';

            const hasError = !!errorProfiles[profile.id] && !isRunning;
            return (
              <div key={profile.id} className={`pl-card${isRunning ? ' pl-card-running' : ''}${hasError ? ' pl-card-error' : ''}`}>
                {/* Status dot */}
                <div className={`pl-dot${isRunning ? ' pl-dot-active' : ''}${hasError ? ' pl-dot-error' : ''}`} />

                {/* Info */}
                <div className="pl-info">
                  <div className="pl-name-row">
                    <span className="pl-id">{shortId(profile.id)}</span>
                    <span className="pl-name">{profile.name || 'Profile'}</span>
                  </div>
                  <div className="pl-tags">
                    <span className="pl-tag"><span className="pl-tag-icon">🖥️</span>{osLabel}</span>
                    <span className="pl-tag"><span className="pl-tag-icon">🌐</span>{browser}</span>
                    <span className="pl-tag"><span className="pl-tag-icon">💻</span>{res}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="pl-actions">
                  {isRunning ? (
                    <button className="pl-btn pl-btn-stop" onClick={() => onStopProfile(profile.id)}>Stop</button>
                  ) : (
                    <>
                      <button className="pl-btn pl-btn-launch" onClick={() => onToggleProfile(profile.id)}>Launch</button>
                      <button className="pl-btn pl-btn-headless" onClick={() => onLaunchHeadless(profile.id)}>Headless</button>
                    </>
                  )}
                  <button className="pl-btn pl-btn-proxy" onClick={() => onEditProfile(profile)}>Proxy</button>
                  <button className="pl-btn pl-btn-clone" onClick={() => onCloneProfile(profile.id)}>Clone</button>
                  <button className="pl-btn pl-btn-edit" onClick={() => onEditProfile(profile)}>Edit</button>
                  <button className="pl-btn pl-btn-delete" onClick={() => onDeleteProfile(profile.id)}>Delete</button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default ProfileList;
