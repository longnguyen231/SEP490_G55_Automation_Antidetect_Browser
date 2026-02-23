import React from 'react';
import { Dropdown } from 'react-bootstrap';
import {
  Play, Square, Edit2, Copy, Trash2, MoreVertical,
  Cookie, FileText, Plus, CheckSquare, XSquare
} from 'lucide-react';
import { useI18n } from '../i18n/index';
import './ProfileList.css';

function ProfileList({ profiles, onCreateProfile, onEditProfile, onDeleteProfile, onToggleProfile, onManageCookies, runningWs = {}, onCopyWs, onStopProfile, onViewLogs, selectedIds = {}, onToggleSelect, onSelectAll, onClearSelection, onStartSelected, onStopSelected, onCloneProfile, headlessPrefs = {}, onSetHeadless, enginePrefs = {}, onSetEngine, onDeleteSelected }) {
  const { t } = useI18n();
  const selectedCount = Object.values(selectedIds || {}).filter(Boolean).length;

  return (
    <div className="profile-list-container">
      {/* Page Header + Toolbar */}
      <div className="page-header">
        <div>
          <h1>{t('profiles.title')}</h1>
          <span className="profile-count">{profiles.length} {t('profiles.count')}</span>
        </div>
        <div className="page-header-actions">
          {selectedCount > 0 && (
            <span className="selection-badge">{selectedCount} {t('actions.selected')}</span>
          )}
          <button className="btn" onClick={onSelectAll} title={t('actions.selectAll')}>
            <CheckSquare size={15} /> {t('actions.selectAll')}
          </button>
          <button className="btn" onClick={onClearSelection} title={t('actions.clear')}>
            <XSquare size={15} /> {t('actions.clear')}
          </button>
          {selectedCount > 0 && (
            <>
              <button className="btn btn-success" onClick={onStartSelected}>
                <Play size={14} /> {t('actions.startSelected')}
              </button>
              <button className="btn btn-danger" onClick={onStopSelected}>
                <Square size={14} /> {t('actions.stopSelected')}
              </button>
              <button className="btn btn-danger" onClick={onDeleteSelected}>
                <Trash2 size={14} /> {t('actions.deleteSelected')}
              </button>
            </>
          )}
          <button className="btn btn-primary" onClick={onCreateProfile}>
            <Plus size={15} /> {t('actions.newProfile')}
          </button>
        </div>
      </div>

      {/* Profile Grid */}
      <div className="profile-scroll">
        {profiles.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🌐</div>
            <h3>{t('profiles.empty.title')}</h3>
            <p>{t('profiles.empty.desc')}</p>
            <button className="btn btn-accent" onClick={onCreateProfile}>
              <Plus size={16} /> {t('profiles.empty.btn')}
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
                {/* Card Header */}
                <div className="profile-card-header">
                  <div className="profile-title">
                    <h3>{profile.name}</h3>
                    <span className={`status-pill ${runningWs[profile.id] ? 'status-running' : 'status-stopped'}`}>
                      {runningWs[profile.id] ? t('profile.status.running') : t('profile.status.stopped')}
                    </span>
                  </div>
                  {/* Dropdown menu */}
                  <Dropdown onClick={(e) => e.stopPropagation()}>
                    <Dropdown.Toggle as="button" className="btn btn-icon card-menu-btn" bsPrefix="custom">
                      <MoreVertical size={16} />
                    </Dropdown.Toggle>
                    <Dropdown.Menu align="end">
                      <Dropdown.Item onClick={() => onEditProfile(profile)}>
                        <Edit2 size={14} /> {t('profile.edit')}
                      </Dropdown.Item>
                      <Dropdown.Item onClick={() => onCloneProfile && onCloneProfile(profile.id)}>
                        <Copy size={14} /> {t('profile.clone')}
                      </Dropdown.Item>
                      <Dropdown.Item onClick={() => onManageCookies(profile)}>
                        <Cookie size={14} /> {t('profile.cookies')}
                      </Dropdown.Item>
                      <Dropdown.Item onClick={() => onViewLogs && onViewLogs(profile)}>
                        <FileText size={14} /> {t('profile.logs')}
                      </Dropdown.Item>
                      <Dropdown.Item onClick={() => onCopyWs && onCopyWs(profile.id)} disabled={!runningWs[profile.id]}>
                        <Copy size={14} /> {t('profile.copyWs')}
                      </Dropdown.Item>
                      <Dropdown.Divider />
                      <Dropdown.Item className="text-danger" onClick={() => onDeleteProfile(profile.id)}>
                        <Trash2 size={14} /> {t('profile.delete')}
                      </Dropdown.Item>
                    </Dropdown.Menu>
                  </Dropdown>
                </div>

                {/* Card Body */}
                <div className="profile-card-body">
                  {/* Antidetect flags */}
                  {(() => {
                    const apply = (profile.settings && profile.settings.applyOverrides) || {};
                    const isOn = (k) => apply[k] !== false;
                    const geo = (profile.settings && profile.settings.geolocation) || {};
                    const wantGeo = Number.isFinite(Number(geo.latitude)) && Number.isFinite(Number(geo.longitude));
                    const items = [
                      { key: 'userAgent', label: 'UA', title: 'User Agent' },
                      { key: 'language', label: 'Lang', title: 'Language' },
                      { key: 'timezone', label: 'TZ', title: 'Timezone' },
                      { key: 'viewport', label: 'VP', title: 'Viewport' },
                      { key: 'navigator', label: 'Nav', title: 'Navigator' },
                      { key: 'hardware', label: 'HW', title: 'Hardware' },
                      { key: 'webgl', label: 'WGL', title: 'WebGL' },
                      { key: 'geolocation', label: 'Geo', title: 'Geolocation' },
                    ];
                    return (
                      <div className="antidetect-icons" onClick={(e) => e.stopPropagation()}>
                        {items.map(({ key, label, title }) => {
                          let on = isOn(key);
                          if (key === 'geolocation') on = on && wantGeo;
                          return (
                            <span key={key} className={`ad-icon ${on ? 'on' : 'off'}`} title={title}>{label}</span>
                          );
                        })}
                      </div>
                    );
                  })()}

                  {/* Info rows */}
                  <div className="profile-info">
                    <div className="profile-info-item">
                      <span className="label">{t('profile.os')}</span>
                      <span className="value">{profile.fingerprint?.os || t('profile.notSet')}</span>
                    </div>
                    <div className="profile-info-item">
                      <span className="label">{t('profile.browser')}</span>
                      <span className="value">{profile.fingerprint?.browser || t('profile.notSet')}</span>
                    </div>
                    <div className="profile-info-item">
                      <span className="label">{t('profile.resolution')}</span>
                      <span className="value">{profile.fingerprint?.screenResolution || t('profile.notSet')}</span>
                    </div>
                    <div className="profile-info-item">
                      <span className="label">{t('profile.language')}</span>
                      <span className="value">{profile.settings?.language || profile.fingerprint?.language || t('profile.notSet')}</span>
                    </div>
                    <div className="profile-info-item">
                      <span className="label">{t('profile.proxy')}</span>
                      <span className="value">{profile.settings?.proxy?.server ? 'ON' : 'OFF'}</span>
                    </div>
                  </div>

                  {/* Headless switch */}
                  {(enginePrefs[profile.id] === 'playwright' || (!enginePrefs[profile.id] && (profile.settings?.engine !== 'cdp'))) && (
                    <div className="profile-info-item" onClick={(e) => e.stopPropagation()}>
                      <span className="label">{t('profile.headless')}</span>
                      <span className="value">
                        <label className={`switch ${runningWs[profile.id] ? 'disabled' : ''}`}>
                          <input
                            type="checkbox"
                            checked={!!headlessPrefs[profile.id]}
                            onChange={(e) => { onSetHeadless && onSetHeadless(profile.id, e.target.checked); }}
                            disabled={!!runningWs[profile.id]}
                          />
                          <span className="slider" />
                        </label>
                      </span>
                    </div>
                  )}

                  {/* Engine select */}
                  <div className="profile-info-item" onClick={(e) => e.stopPropagation()}>
                    <span className="label">{t('profile.engine')}</span>
                    <span className="value">
                      <select
                        value={enginePrefs[profile.id] || 'playwright'}
                        onChange={(e) => onSetEngine && onSetEngine(profile.id, e.target.value)}
                        disabled={!!runningWs[profile.id]}
                      >
                        <option value="playwright">Playwright</option>
                        <option value="cdp">Real Chrome (CDP)</option>
                      </select>
                    </span>
                  </div>

                  {profile.createdAt && (
                    <p className="profile-date">
                      {t('profile.created')} {new Date(profile.createdAt).toLocaleDateString()}
                    </p>
                  )}
                </div>

                {/* Card Footer */}
                <div className="profile-card-footer">
                  <button
                    className={`btn ${runningWs[profile.id] ? 'btn-danger' : 'btn-success'}`}
                    onClick={(e) => { e.stopPropagation(); onToggleProfile(profile.id); }}
                  >
                    {runningWs[profile.id] ? <><Square size={14} /> {t('profile.stop')}</> : <><Play size={14} /> {t('profile.launch')}</>}
                  </button>
                  <button
                    className="btn"
                    onClick={(e) => { e.stopPropagation(); onEditProfile(profile); }}
                  >
                    <Edit2 size={14} /> {t('profile.edit')}
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
