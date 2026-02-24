import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import ReactDOM from 'react-dom';
import {
    Play, Square, Edit2, Copy, Trash2, MoreVertical,
    Cookie, FileText, Plus, CheckSquare, XSquare,
    Database, Bot, Globe, User, Fingerprint,
    Search, Filter, X
} from 'lucide-react';
import { useI18n } from '../i18n/index';
import './ProfileList.css';

/* ═══════ Context Menu (three-dot) ═══════ */
function ContextMenu({ profile, position, onClose, onEditProfile, onCloneProfile, onDeleteProfile, onManageCookies, onViewLogs, onCopyWs, isRunning }) {
    const ref = useRef(null);

    useEffect(() => {
        const handler = (e) => {
            if (ref.current && !ref.current.contains(e.target)) onClose();
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [onClose]);

    const menuStyle = {
        top: position?.top ?? 0,
        left: position?.left ?? 0,
    };

    return ReactDOM.createPortal(
        <div className="pl-ctx-menu" ref={ref} style={menuStyle}>
            <button className="pl-ctx-item" onClick={() => { onEditProfile(profile); onClose(); }}>
                <span className="ctx-icon"><Edit2 size={14} /></span> Edit
            </button>
            <button className="pl-ctx-item" onClick={() => { onCloneProfile && onCloneProfile(profile.id); onClose(); }}>
                <span className="ctx-icon"><Copy size={14} /></span> Copy
            </button>
            <button className="pl-ctx-item danger" onClick={() => { onDeleteProfile(profile.id); onClose(); }}>
                <span className="ctx-icon"><Trash2 size={14} /></span> Delete
            </button>

            <div className="pl-ctx-divider" />

            <button className="pl-ctx-item" onClick={() => { onViewLogs && onViewLogs(profile); onClose(); }}>
                <span className="ctx-icon"><Database size={14} /></span> Cache data
            </button>
            <button className="pl-ctx-item" onClick={() => { onManageCookies(profile); onClose(); }}>
                <span className="ctx-icon"><Cookie size={14} /></span> Cookie robot
                <span className="ctx-badge">🍪</span>
            </button>

            <div className="pl-ctx-divider" />

            <button className="pl-ctx-item" onClick={() => { onEditProfile(profile); onClose(); }}>
                <span className="ctx-icon"><Globe size={14} /></span> Edit proxy
            </button>
            <button className="pl-ctx-item" onClick={() => { onEditProfile(profile); onClose(); }}>
                <span className="ctx-icon"><User size={14} /></span> Edit account
            </button>
            <button className="pl-ctx-item" onClick={() => { onEditProfile(profile); onClose(); }}>
                <span className="ctx-icon"><Fingerprint size={14} /></span> Edit fingerprint
            </button>
        </div>,
        document.body
    );
}

/* ═══════ Main Component ═══════ */
function ProfileList({
    profiles, onCreateProfile, onEditProfile, onDeleteProfile, onToggleProfile,
    onManageCookies, runningWs = {}, onCopyWs, onStopProfile, onViewLogs,
    selectedIds = {}, onToggleSelect, onSelectAll, onClearSelection,
    onStartSelected, onStopSelected, onCloneProfile,
    headlessPrefs = {}, onSetHeadless, enginePrefs = {}, onSetEngine, onDeleteSelected
}) {
    const { t } = useI18n();
    const selectedCount = Object.values(selectedIds || {}).filter(Boolean).length;
    const [openMenuId, setOpenMenuId] = useState(null);
    const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });

    /* ── Search & Filter state ── */
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [proxyFilter, setProxyFilter] = useState('all');

    const filteredProfiles = useMemo(() => {
        let result = profiles;

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            result = result.filter(p =>
                (p.name || '').toLowerCase().includes(q) ||
                (p.id || '').toLowerCase().includes(q)
            );
        }

        if (statusFilter === 'running') {
            result = result.filter(p => !!runningWs[p.id]);
        } else if (statusFilter === 'stopped') {
            result = result.filter(p => !runningWs[p.id]);
        }

        if (proxyFilter === 'has') {
            result = result.filter(p => !!p.settings?.proxy?.server);
        } else if (proxyFilter === 'none') {
            result = result.filter(p => !p.settings?.proxy?.server);
        }

        return result;
    }, [profiles, searchQuery, statusFilter, proxyFilter, runningWs]);

    const allChecked = filteredProfiles.length > 0 && filteredProfiles.every(p => selectedIds[p.id]);
    const hasActiveFilters = searchQuery || statusFilter !== 'all' || proxyFilter !== 'all';

    const clearAllFilters = () => {
        setSearchQuery('');
        setStatusFilter('all');
        setProxyFilter('all');
    };

    /* ── Helpers ── */
    const shortId = (id) => (id || '').substring(0, 8);

    const fmtDate = (dateStr) => {
        if (!dateStr) return '—';
        const d = new Date(dateStr);
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const hh = String(d.getHours()).padStart(2, '0');
        const mi = String(d.getMinutes()).padStart(2, '0');
        const ss = String(d.getSeconds()).padStart(2, '0');
        return `${mm}-${dd} ${hh}:${mi}:${ss}`;
    };

    const getProxyIp = (profile) => {
        const server = profile.settings?.proxy?.server;
        if (!server) return null;
        let host = server.replace(/^https?:\/\//, '').split(':')[0];
        return host || null;
    };

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

            {/* ── Search & Filter Bar ── */}
            <div className="pl-filter-bar">
                <div className="pl-search-box">
                    <Search size={15} className="pl-search-icon" />
                    <input
                        type="text"
                        className="pl-search-input"
                        placeholder={t('pl.search.placeholder', 'Search by name or ID...')}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                        <button className="pl-search-clear" onClick={() => setSearchQuery('')}>
                            <X size={14} />
                        </button>
                    )}
                </div>

                <div className="pl-filter-group">
                    <Filter size={14} className="pl-filter-icon" />

                    <select
                        className="pl-filter-select"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                    >
                        <option value="all">{t('pl.filter.allStatus', 'All Status')}</option>
                        <option value="running">{t('pl.filter.running', 'Running')}</option>
                        <option value="stopped">{t('pl.filter.stopped', 'Stopped')}</option>
                    </select>

                    <select
                        className="pl-filter-select"
                        value={proxyFilter}
                        onChange={(e) => setProxyFilter(e.target.value)}
                    >
                        <option value="all">{t('pl.filter.allProxy', 'All Proxy')}</option>
                        <option value="has">{t('pl.filter.hasProxy', 'Has Proxy')}</option>
                        <option value="none">{t('pl.filter.noProxy', 'No Proxy')}</option>
                    </select>

                    {hasActiveFilters && (
                        <button className="pl-clear-filters" onClick={clearAllFilters}>
                            <X size={13} /> {t('pl.filter.clear', 'Clear')}
                        </button>
                    )}
                </div>

                {hasActiveFilters && (
                    <span className="pl-filter-count">
                        {filteredProfiles.length} / {profiles.length}
                    </span>
                )}
            </div>

            {/* Table content */}
            <div className="profile-scroll">
                {filteredProfiles.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-icon">🌐</div>
                        <h3>{t('profiles.empty.title')}</h3>
                        <p>{t('profiles.empty.desc')}</p>
                        <button className="btn btn-accent" onClick={onCreateProfile}>
                            <Plus size={16} /> {t('profiles.empty.btn')}
                        </button>
                    </div>
                ) : (
                    <table className="pl-table">
                        <thead>
                            <tr>
                                <th className="pl-col-check">
                                    <input
                                        type="checkbox"
                                        className="pl-check"
                                        checked={allChecked}
                                        onChange={() => allChecked ? onClearSelection() : filteredProfiles.forEach(p => onToggleSelect(p.id))}
                                    />
                                </th>
                                <th className="pl-col-no sortable">
                                    {t('pl.col.noId', 'No./ID')} <span className="sort-icon">⇅</span>
                                </th>
                                <th className="pl-col-group">
                                    {t('pl.col.group', 'Group')}
                                </th>
                                <th className="pl-col-name sortable">
                                    {t('pl.col.name', 'Name')} <span className="sort-icon">⇅</span>
                                </th>
                                <th className="pl-col-ip">
                                    {t('pl.col.ip', 'IP')}
                                </th>
                                <th className="pl-col-last sortable">
                                    {t('pl.col.lastOp', 'Last op.')} <span className="sort-icon">⇅</span>
                                </th>
                                <th className="pl-col-plat">
                                    {t('pl.col.platform', 'Platform')}
                                </th>
                                <th className="pl-col-action">
                                    {t('pl.col.action', 'Action')}
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredProfiles.map((profile, index) => {
                                const isRunning = !!runningWs[profile.id];
                                const proxyIp = getProxyIp(profile);
                                return (
                                    <tr
                                        key={profile.id}
                                        className={selectedIds[profile.id] ? 'selected' : ''}
                                    >
                                        {/* Checkbox */}
                                        <td className="pl-col-check">
                                            <input
                                                type="checkbox"
                                                className="pl-check"
                                                checked={!!selectedIds[profile.id]}
                                                onChange={() => onToggleSelect(profile.id)}
                                            />
                                        </td>

                                        {/* No./ID */}
                                        <td className="pl-col-no">
                                            <div className="pl-no-cell">
                                                <span className="pl-seq">{index + 1}</span>
                                                <span className="pl-id">{shortId(profile.id)}</span>
                                            </div>
                                        </td>

                                        {/* Group */}
                                        <td className="pl-col-group">
                                            {profile.group || 'Ungrouped'}
                                        </td>

                                        {/* Name */}
                                        <td className="pl-col-name">
                                            <div className="pl-name-cell">
                                                {isRunning && <span className="pl-status-dot running" />}
                                                <span className="pl-name-text">{profile.name || `Profile ${index + 1}`}</span>
                                                <Edit2
                                                    size={13}
                                                    className="pl-edit-icon"
                                                    onClick={(e) => { e.stopPropagation(); onEditProfile(profile); }}
                                                />
                                            </div>
                                        </td>

                                        {/* IP */}
                                        <td className="pl-col-ip">
                                            {proxyIp ? (
                                                <div className="pl-ip-cell">
                                                    <span className="pl-ip-addr">
                                                        <span className="pl-flag">🔴</span>
                                                        {proxyIp}
                                                    </span>
                                                    <span className="pl-ip-loc">
                                                        {profile.settings?.proxy?.type?.toUpperCase() || 'Proxy'}
                                                    </span>
                                                </div>
                                            ) : (
                                                <span style={{ color: 'var(--muted)', fontSize: '0.78rem' }}>—</span>
                                            )}
                                        </td>

                                        {/* Last op. */}
                                        <td className="pl-col-last">
                                            <div className="pl-last-cell">
                                                {fmtDate(profile.updatedAt || profile.createdAt)}
                                            </div>
                                        </td>

                                        {/* Platform */}
                                        <td className="pl-col-plat">
                                            <div className="pl-platform-cell">
                                                <span className="pl-platform-dot dot-blue" title="Browser" />
                                                {isRunning && <span className="pl-platform-dot dot-green" title="Running" />}
                                            </div>
                                        </td>

                                        {/* Action */}
                                        <td className="pl-col-action">
                                            <div className="pl-action-cell">
                                                <button
                                                    className={`pl-open-btn${isRunning ? ' running' : ''}`}
                                                    onClick={(e) => { e.stopPropagation(); onToggleProfile(profile.id); }}
                                                >
                                                    <span className="btn-icon-emoji">{isRunning ? '⏹' : '🌐'}</span>
                                                    {isRunning ? 'Close' : 'Open'}
                                                </button>

                                                <div>
                                                    <button
                                                        className="pl-menu-btn"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (openMenuId === profile.id) {
                                                                setOpenMenuId(null);
                                                            } else {
                                                                const rect = e.currentTarget.getBoundingClientRect();
                                                                setMenuPos({ top: rect.bottom + 4, left: rect.right - 180 });
                                                                setOpenMenuId(profile.id);
                                                            }
                                                        }}
                                                    >
                                                        <MoreVertical size={16} />
                                                    </button>
                                                    {openMenuId === profile.id && (
                                                        <ContextMenu
                                                            profile={profile}
                                                            position={menuPos}
                                                            isRunning={isRunning}
                                                            onClose={() => setOpenMenuId(null)}
                                                            onEditProfile={onEditProfile}
                                                            onCloneProfile={onCloneProfile}
                                                            onDeleteProfile={onDeleteProfile}
                                                            onManageCookies={onManageCookies}
                                                            onViewLogs={onViewLogs}
                                                            onCopyWs={onCopyWs}
                                                        />
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}

export default ProfileList;
