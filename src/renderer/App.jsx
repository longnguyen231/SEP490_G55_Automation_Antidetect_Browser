import React, { useState, useEffect, useRef, useMemo } from 'react';
import DashboardSidebar from './components/DashboardSidebar';
import ProfileList from './components/ProfileList';
import ProfileForm from './components/ProfileForm';
import CookieManager from './components/CookieManager';
import LogViewer from './components/LogViewer';
import Toasts from './components/Toasts';
import ScriptsManager from './components/ScriptsManager';
import './App.css';
import { useI18n } from './i18n/index';

function App() {
  const { t, lang, setLang } = useI18n();
  const [activeNav, setActiveNav] = useState('profiles');
  const [profiles, setProfiles] = useState([]);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [cookieProfile, setCookieProfile] = useState(null);
  const [runningWs, setRunningWs] = useState({});
  const [logProfile, setLogProfile] = useState(null);
  const [selectedIds, setSelectedIds] = useState({});
  const [headlessPrefs, setHeadlessPrefs] = useState({});
  const [toasts, setToasts] = useState([]);
  const [enginePrefs, setEnginePrefs] = useState({});
  const [apiStatus, setApiStatus] = useState({ enabled: true, running: false, host: '127.0.0.1', port: 5478, error: null });
  const [apiDesiredPort, setApiDesiredPort] = useState(5478);
  const apiPortTimerRef = useRef(null);
  const [showApiPwdModal, setShowApiPwdModal] = useState(false);
  const [apiPwdInput, setApiPwdInput] = useState('');

  // Bridge helper: prefer IPC via preload; fallback to REST API when unavailable
  const api = useMemo(() => {
    const base = 'http://127.0.0.1:5478';
    const hasIpc = !!(window.electronAPI && typeof window.electronAPI === 'object');
    return {
      async getProfiles() {
        if (hasIpc && window.electronAPI.getProfiles) return await window.electronAPI.getProfiles();
        const r = await fetch(base + '/api/profiles');
        return await r.json();
      },
      async saveProfile(profile) {
        if (hasIpc && window.electronAPI.saveProfile) return await window.electronAPI.saveProfile(profile);
        const isUpdate = !!profile?.id;
        const url = base + '/api/profiles' + (isUpdate ? `/${profile.id}` : '');
        const r = await fetch(url, { method: isUpdate ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(profile || {}) });
        return await r.json();
      },
      async deleteProfile(profileId) {
        if (hasIpc && window.electronAPI.deleteProfile) return await window.electronAPI.deleteProfile(profileId);
        const r = await fetch(base + `/api/profiles/${profileId}`, { method: 'DELETE' });
        return await r.json();
      },
    };
  }, []);

  // Effects: initial load, subscribe to running map & API status
  useEffect(() => { loadProfiles(); }, []);
  useEffect(() => {
    let unsub;
    (async () => {
      try {
        unsub = window.electronAPI.onRunningMapChanged?.((payload) => setRunningWs(payload?.map || {}));
        await refreshRunningStatus();
      } catch { }
    })();
    return () => { try { unsub && unsub(); } catch { }; try { window.electronAPI.removeAllRunningMapChanged?.(); } catch { } };
  }, []);
  useEffect(() => {
    let unsub;
    (async () => {
      try {
        unsub = window.electronAPI.onApiServerStatus?.((state) => {
          if (state && typeof state === 'object') {
            setApiStatus(state);
            if (state.port) setApiDesiredPort(state.port);
          }
        });
        const res = await window.electronAPI.getApiServerStatus?.();
        if (res?.success && res.state) {
          setApiStatus(res.state);
          if (res.state.port) setApiDesiredPort(res.state.port);
        }
      } catch { }
    })();
    return () => { try { unsub && unsub(); } catch { }; try { window.electronAPI.removeAllApiServerStatus?.(); } catch { } };
  }, []);

  const addToast = (message, variant = 'success', duration = 3000) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, variant }]);
    if (duration > 0) setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration);
  };

  const loadProfiles = async () => {
    try {
      const data = await api.getProfiles();
      setProfiles(data);
      setHeadlessPrefs(prev => { const next = { ...prev }; (data || []).forEach(p => { if (next[p.id] === undefined) next[p.id] = !!p?.settings?.headless; }); return next; });
      setEnginePrefs(prev => { const next = { ...prev }; (data || []).forEach(p => { if (!next[p.id]) next[p.id] = (p?.settings?.engine === 'cdp' ? 'cdp' : 'playwright'); }); return next; });
      await refreshRunningStatus(data);
    } catch (e) { console.error('Error loading profiles:', e); }
  };

  const refreshRunningStatus = async (list = profiles) => {
    try {
      if (window.electronAPI.getRunningMap) {
        const res = await window.electronAPI.getRunningMap();
        if (res?.success) { setRunningWs(res.map || {}); return; }
      }
      const entries = await Promise.all((list || []).map(async p => { try { const r = await window.electronAPI.getProfileWs(p.id); return [p.id, r?.wsEndpoint || null]; } catch { return [p.id, null]; } }));
      setRunningWs(Object.fromEntries(entries));
    } catch (e) { console.warn('Failed to refresh running status', e); }
  };

  const handleCreateProfile = () => {
    const base = 'Profile'; const existing = new Set((profiles || []).map(p => (p.name || '').trim()));
    let name = `${base} ${(profiles || []).length + 1}`; for (let i = 1; i <= (profiles || []).length + 100; i++) { const c = `${base} ${i}`; if (!existing.has(c)) { name = c; break; } }
    setSelectedProfile({ name }); setShowForm(true);
  };
  const handleEditProfile = (profile) => { setSelectedProfile(profile); setShowForm(true); };
  const handleDeleteProfile = async (profileId) => { if (!window.confirm('Delete this profile?')) return; try { await api.deleteProfile(profileId); await loadProfiles(); } catch (e) { console.error('Delete error', e); } };

  const handleLaunchProfile = async (profileId) => {
    try { const headless = !!headlessPrefs[profileId]; const engine = enginePrefs[profileId] || 'playwright'; const options = { headless, engine: engine === 'cdp' ? 'cdp' : 'playwright' }; const result = await window.electronAPI.launchProfile(profileId, options); if (!result.success) alert('Error launching profile: ' + result.error); await refreshRunningStatus(profiles.filter(p => p.id === profileId)); } catch (e) { alert('Error launching profile: ' + e.message); }
  };
  const handleStopProfile = async (profileId) => { try { const res = profileId === '__ALL__' ? await window.electronAPI.stopAllProfiles() : await window.electronAPI.stopProfile(profileId); if (!res.success) alert('Error stopping profile: ' + res.error); await refreshRunningStatus(); } catch (e) { alert('Error stopping profile: ' + e.message); } };
  const handleSetHeadless = async (profileId, value) => { if (runningWs[profileId]) return; setHeadlessPrefs(prev => ({ ...prev, [profileId]: !!value })); try { const p = profiles.find(x => x.id === profileId); if (p) { const updated = { ...p, settings: { ...(p.settings || {}), headless: !!value } }; const res = await window.electronAPI.saveProfile(updated); if (res?.success && res.profile) setProfiles(prev => prev.map(pp => pp.id === profileId ? res.profile : pp)); } } catch { } };
  const handleSetEngine = async (profileId, value) => { if (runningWs[profileId]) return; const normalized = value === 'cdp' ? 'cdp' : 'playwright'; setEnginePrefs(prev => ({ ...prev, [profileId]: normalized })); try { const p = profiles.find(x => x.id === profileId); if (p) { const updated = { ...p, settings: { ...(p.settings || {}), engine: normalized } }; const res = await window.electronAPI.saveProfile(updated); if (res?.success && res.profile) setProfiles(prev => prev.map(pp => pp.id === profileId ? res.profile : pp)); } } catch { } };
  const handleToggleProfile = async (profileId) => runningWs[profileId] ? handleStopProfile(profileId) : handleLaunchProfile(profileId);
  const handleSaveProfile = async (profile) => { try { const result = await api.saveProfile(profile); if (result.success) { setShowForm(false); setSelectedProfile(null); await loadProfiles(); } else alert('Error saving profile: ' + result.error); } catch (e) { alert('Error saving profile: ' + e.message); } };
  const handleCancel = () => { setShowForm(false); setSelectedProfile(null); };
  const handleManageCookies = (profile) => setCookieProfile(profile);
  const handleViewLogs = (profile) => setLogProfile(profile);
  const handleCloneProfile = async (profileId) => { try { const res = await window.electronAPI.cloneProfile(profileId, {}); if (!res.success) throw new Error(res.error || 'Clone failed'); await loadProfiles(); } catch (e) { alert('Clone error: ' + e.message); } };
  const handleCopyWs = async (profileId) => { try { const res = await window.electronAPI.getProfileWs(profileId); const ws = res?.wsEndpoint; if (!ws) { alert('Profile is not running. Launch first.'); return; } await navigator.clipboard.writeText(ws); addToast('WS endpoint copied!', 'success', 2000); } catch (e) { alert('Failed to copy WS endpoint: ' + e.message); } };

  // Bulk selection helpers
  const toggleSelect = (profileId) => setSelectedIds(prev => ({ ...prev, [profileId]: !prev[profileId] }));
  const clearSelection = () => setSelectedIds({});
  const selectAll = () => setSelectedIds(Object.fromEntries(profiles.map(p => [p.id, true])));
  const getSelectedList = () => Object.keys(selectedIds).filter(id => selectedIds[id]);
  const handleStartSelected = async () => { const ids = getSelectedList(); await Promise.all(ids.map(id => handleLaunchProfile(id))); await refreshRunningStatus(); };
  const handleStopSelected = async () => { const ids = getSelectedList(); await Promise.all(ids.map(id => window.electronAPI.stopProfile(id))); await refreshRunningStatus(); };
  const handleDeleteSelected = async () => { const ids = getSelectedList(); if (!ids.length) return; const runningIds = ids.filter(id => !!runningWs[id]); const runningMsg = runningIds.length ? `\nNote: ${runningIds.length} running profile(s) will be stopped before deletion.` : ''; if (!window.confirm(`Delete ${ids.length} selected profile(s)? This cannot be undone.${runningMsg}`)) return; try { if (runningIds.length) { await Promise.all(runningIds.map(id => window.electronAPI.stopProfile(id).catch(() => null))); await new Promise(r => setTimeout(r, 300)); } await Promise.all(ids.map(id => api.deleteProfile(id))); addToast(`Deleted ${ids.length} profile(s)`, 'success', 2500); clearSelection(); await loadProfiles(); } catch (e) { addToast('Bulk delete failed: ' + (e?.message || e), 'error', 5000); } };

  // API server control handlers
  const applyPortChange = async (portNum) => { if (!Number.isInteger(portNum) || portNum < 1 || portNum > 65535) return; try { const res = await window.electronAPI.setApiServerPort(portNum); if (res?.success && res.state) setApiStatus(res.state); } catch (e) { console.warn('Set port failed', e); } };
  const handleRestartApi = async () => { try { const res = await window.electronAPI.restartApiServer(); if (res?.success && res.state) setApiStatus(res.state); } catch (e) { console.warn('Restart API error', e); } };

  const handleToggleApiRun = async () => {
    try {
      const wantStart = !apiStatus.running;
      if (!wantStart) {
        const res = await window.electronAPI.setApiServerEnabled(false);
        if (res?.success && res.state) setApiStatus(res.state);
        else { const cur = await window.electronAPI.getApiServerStatus?.(); if (cur?.success && cur.state) setApiStatus(cur.state); }
        return;
      }
      const res = await window.electronAPI.setApiServerEnabled(true);
      if (res?.success && res.state) {
        setApiStatus(res.state);
      } else {
        const needPwd = (res && res.error === 'PASSWORD_REQUIRED') || (res && res.state && res.state.error === 'PASSWORD_REQUIRED') || (apiStatus && apiStatus.error === 'PASSWORD_REQUIRED');
        if (needPwd) { setShowApiPwdModal(true); }
        else { const cur = await window.electronAPI.getApiServerStatus?.(); if (cur?.success && cur.state) setApiStatus(cur.state); }
      }
    } catch (e) { console.warn('Toggle API run error', e); }
  };

  // ---- Render Content based on activeNav ----
  const renderContent = () => {
    if (showForm) {
      return (
        <ProfileForm
          profile={selectedProfile}
          onSave={handleSaveProfile}
          onCancel={handleCancel}
        />
      );
    }

    switch (activeNav) {
      case 'profiles':
        return (
          <ProfileList
            profiles={profiles}
            onCreateProfile={handleCreateProfile}
            onEditProfile={handleEditProfile}
            onDeleteProfile={handleDeleteProfile}
            onToggleProfile={handleToggleProfile}
            onManageCookies={handleManageCookies}
            runningWs={runningWs}
            onCopyWs={handleCopyWs}
            onStopProfile={handleStopProfile}
            onViewLogs={handleViewLogs}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            onSelectAll={selectAll}
            onClearSelection={clearSelection}
            onStartSelected={handleStartSelected}
            onStopSelected={handleStopSelected}
            onCloneProfile={handleCloneProfile}
            headlessPrefs={headlessPrefs}
            onSetHeadless={handleSetHeadless}
            enginePrefs={enginePrefs}
            onSetEngine={handleSetEngine}
            onDeleteSelected={handleDeleteSelected}
          />
        );

      case 'scripts':
        return (
          <ScriptsManager
            open={true}
            onClose={() => setActiveNav('profiles')}
            profiles={profiles}
            onRunScript={(pid, sid) => { /* optional hook */ }}
            fullPage={true}
          />
        );

      case 'settings':
        return renderSettingsView();

      default:
        return null;
    }
  };

  const renderSettingsView = () => (
    <div>
      <div className="page-header">
        <h1>{t('settings.title')}</h1>
      </div>
      <div className="settings-card">
        <h3>{t('settings.apiServer')}</h3>
        <div className="settings-row">
          <span className="settings-label">{t('settings.status')}</span>
          <span className={`status-pill ${apiStatus.running ? 'status-running' : 'status-stopped'}`}>
            {apiStatus.running ? t('settings.running') : (apiStatus.error ? `Error: ${apiStatus.error}` : t('settings.stopped'))}
          </span>
        </div>
        <div className="settings-row">
          <span className="settings-label">{t('settings.port')}</span>
          <input
            type="number" min={1} max={65535} value={apiDesiredPort}
            onChange={(e) => {
              const val = e.target.value; setApiDesiredPort(val); const num = Number(val);
              if (apiPortTimerRef.current) clearTimeout(apiPortTimerRef.current);
              apiPortTimerRef.current = setTimeout(() => applyPortChange(num), 600);
            }}
            style={{ width: 100 }}
          />
        </div>
        <div className="settings-row">
          <span className="settings-label">{t('settings.control')}</span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className={`btn ${apiStatus.running ? 'btn-danger' : 'btn-success'}`} onClick={handleToggleApiRun}>
              {apiStatus.running ? t('settings.stop') : t('settings.start')}
            </button>
            <button className="btn btn-secondary" onClick={handleRestartApi}>{t('settings.restart')}</button>
            <button className="btn" onClick={() => {
              const host = apiStatus.host || '127.0.0.1';
              const port = apiStatus.port || 5478;
              window.electronAPI.openExternal?.(`http://${host}:${port}/api-docs`);
            }}>{t('settings.apiDocs')}</button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="app">
      <DashboardSidebar
        activeNav={showForm ? 'profiles' : activeNav}
        onNavigate={(id) => { setShowForm(false); setSelectedProfile(null); setActiveNav(id); }}
        onCreateProfile={handleCreateProfile}
        apiStatus={apiStatus}
      />

      <main className="app-main">
        {renderContent()}
      </main>

      {/* Overlays */}
      {cookieProfile && <CookieManager profile={cookieProfile} onClose={() => setCookieProfile(null)} />}
      {logProfile && <LogViewer profile={logProfile} onClose={() => setLogProfile(null)} />}
      <Toasts toasts={toasts} onDismiss={(id) => setToasts(prev => prev.filter(t => t.id !== id))} />

      {/* API Password Modal */}
      {showApiPwdModal && (
        <div className="pwd-modal-backdrop">
          <div className="pwd-modal-card">
            <h3>{t('api.password.title')}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ opacity: 0.85, fontSize: '0.85rem' }}>{t('api.password.prompt')}</label>
              <input type="password" value={apiPwdInput} onChange={(e) => setApiPwdInput(e.target.value)} />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                <button className="btn" onClick={() => { setShowApiPwdModal(false); setApiPwdInput(''); }}>
                  {t('profileForm.cancel')}
                </button>
                <button className="btn btn-success" onClick={async () => {
                  const pwd = String(apiPwdInput || '').trim();
                  if (!pwd) { addToast('Password is required', 'error', 2500); return; }
                  try {
                    const r2 = await window.electronAPI.startApiServerWithPassword?.(pwd);
                    if (r2?.success) {
                      const cur = await window.electronAPI.getApiServerStatus?.(); if (cur?.success && cur.state) setApiStatus(cur.state);
                      setShowApiPwdModal(false); setApiPwdInput('');
                      addToast('API started', 'success', 2000);
                    } else {
                      addToast(r2?.error || 'Invalid password', 'error', 3000);
                    }
                  } catch (e) {
                    addToast(e?.message || String(e), 'error', 3000);
                  }
                }}>
                  {t('api.password.start')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
