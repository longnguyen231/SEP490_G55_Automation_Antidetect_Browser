import React, { useState, useEffect, useRef, useMemo } from 'react';
import DashboardSidebar from './components/DashboardSidebar';
import ProfileList from './components/ProfileList';
import ProfileForm from './components/ProfileForm';
import CookieManager from './components/CookieManager';
import LogViewer from './components/LogViewer';
import Toasts from './components/Toasts';
import ScriptsManager from './components/ScriptsManager';
import ProxyManager from './components/ProxyManager';
import AppLogsTab from './components/AppLogsTab';
import SettingsTab from './components/SettingsTab';
import LicenseModal from './components/LicenseModal';
import EngineInstallModal from './components/EngineInstallModal';
import LinkProxyModal from './components/LinkProxyModal';
import LivePreviewPanel from './components/LivePreviewPanel';
import './App.css';
import { useI18n } from './i18n/index';
import { getLicenseRequestUrl } from './config/app.config';
 
function App() {
  const { t, lang, setLang } = useI18n();
  // Engine install modal: { profileId, engine, headless } | null
  const [engineInstallState, setEngineInstallState] = useState(null);
  const [activeNav, setActiveNav] = useState('profiles');
  const [profiles, setProfiles] = useState([]);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formInitialTab, setFormInitialTab] = useState('general');
  const [cookieProfile, setCookieProfile] = useState(null);
  const [runningWs, setRunningWs] = useState({});
  const [profileStatuses, setProfileStatuses] = useState({});
  const [logProfile, setLogProfile] = useState(null);
  const [linkProxyProfile, setLinkProxyProfile] = useState(null);
  const [selectedIds, setSelectedIds] = useState({});
  const [headlessPrefs, setHeadlessPrefs] = useState({});
  const [toasts, setToasts] = useState([]);
  const [enginePrefs, setEnginePrefs] = useState({});
  const [errorProfiles, setErrorProfiles] = useState({});
  const [backendReady, setBackendReady] = useState(false);
  const [apiStatus, setApiStatus] = useState({ enabled: true, running: false, host: '127.0.0.1', port: 4000, error: null });
  const [apiDesiredPort, setApiDesiredPort] = useState(4000);
  const apiPortTimerRef = useRef(null);
  const [showApiPwdModal, setShowApiPwdModal] = useState(false);
  const [apiPwdInput, setApiPwdInput] = useState('');
  const [appLogs, setAppLogs] = useState([]);
  // Live preview: profile being previewed (or null)
  const [previewProfile, setPreviewProfile] = useState(null);
  // License info state
  const [licenseInfo, setLicenseInfo] = useState({ valid: false, tier: 'free', maxProfiles: 5, features: [] });

  // Subscribe to app-log events at app level so logs are captured regardless of active tab
  useEffect(() => {
    if (!window.electronAPI?.onAppLog) return;
    const cleanup = window.electronAPI.onAppLog(logData => {
      const prefix = logData.profileId && logData.profileId !== 'system' ? `[${logData.profileId}] ` : '';
      setAppLogs(prev => {
        const entry = { id: Date.now() + Math.random(), time: new Date().toLocaleTimeString('en-US', { hour12: false }), level: logData.level || 'INF', text: prefix + (logData.message || '') };
        const next = [...prev, entry];
        return next.length > 2000 ? next.slice(-2000) : next;
      });
    });
    return cleanup;
  }, []);

  const [showLicenseModal, setShowLicenseModal] = useState(() => {
    // Skip modal if user already activated OR chose free plan this session
    return !localStorage.getItem('hl-license-activated') &&
           !sessionStorage.getItem('license-skipped');
  });
  const handleCloseLicense = () => {
    sessionStorage.setItem('license-skipped', 'true');
    setShowLicenseModal(false);
  };
  const handleLicenseActivated = async (payload) => {
    setShowLicenseModal(false);
    // Reload license info after activation
    await loadLicenseInfo();
    addToast(`✅ License activated: ${payload?.tier?.toUpperCase()} tier`, 'success', 5000);
  };

  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('app-theme') || 'Light';
  });

  useEffect(() => {
    localStorage.setItem('app-theme', theme);
    if (theme === 'Dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.setAttribute('data-theme', 'light');
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Bridge helper: prefer IPC via preload; fallback to REST API when unavailable
  const api = useMemo(() => {
    const base = 'http://127.0.0.1:4000';
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

  // Wait for backend IPC to be ready, then load data
  useEffect(() => {
    let unsub = null;
    const init = () => { 
      setBackendReady(true); 
      loadProfiles(); 
      loadLicenseInfo(); // Load license info on app mount
    };
    // In production, IPC handlers may register after window loads.
    // Listen for explicit 'backend-ready' signal from main process.
    if (window.electronAPI?.onBackendReady) {
      unsub = window.electronAPI.onBackendReady(() => init());
    }
    // Also try immediately — in dev, handlers are usually ready already
    loadProfiles();
    loadLicenseInfo(); // Load license info immediately
    return () => { try { unsub?.(); } catch {} };
  }, []);

  // Subscribe to profile updates
  useEffect(() => {
    let unsub = null;
    if (window.electronAPI?.onProfilesUpdated) {
      unsub = window.electronAPI.onProfilesUpdated(() => loadProfiles());
    }
    return () => {
      try { unsub?.(); } catch {}
      try { window.electronAPI?.removeAllProfilesUpdated?.(); } catch {}
    };
  }, []);
  useEffect(() => {
    let unsub;
    let pollTimer;
    (async () => {
      try {
        unsub = window.electronAPI.onRunningMapChanged?.((payload) => {
          setRunningWs(payload?.map || {});
          if (payload?.statuses) setProfileStatuses(payload.statuses);
        });
        await refreshRunningStatus();
      } catch { }
      // Polling every 3s as safety net
      pollTimer = setInterval(async () => {
        try {
          const res = await window.electronAPI.getStatusMap?.();
          if (res?.success && res.statuses) setProfileStatuses(res.statuses);
        } catch { }
      }, 3000);
    })();
    return () => {
      try { unsub && unsub(); } catch { }
      try { window.electronAPI.removeAllRunningMapChanged?.(); } catch { }
      if (pollTimer) clearInterval(pollTimer);
    };
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
      setEnginePrefs(prev => { const next = { ...prev }; (data || []).forEach(p => { next[p.id] = p?.settings?.engine || 'playwright'; }); return next; });
      await refreshRunningStatus(data);
    } catch (e) { console.error('Error loading profiles:', e); }
  };

  const loadLicenseInfo = async () => {
    try {
      if (!window.electronAPI?.getLicenseInfo) {
        console.warn('getLicenseInfo API not available');
        return;
      }
      const info = await window.electronAPI.getLicenseInfo();
      setLicenseInfo(info || { valid: false, tier: 'free', maxProfiles: 5, features: [] });
      console.log(`[License] Loaded: tier=${info?.tier}, maxProfiles=${info?.maxProfiles}, valid=${info?.valid}`);
    } catch (e) {
      console.error('Error loading license info:', e);
      setLicenseInfo({ valid: false, tier: 'free', maxProfiles: 5, features: [] });
    }
  };

  const refreshRunningStatus = async (list = profiles) => {
    try {
      if (window.electronAPI.getRunningMap) {
        const res = await window.electronAPI.getRunningMap();
        if (res?.success) {
          setRunningWs(res.map || {});
          if (res.statuses) setProfileStatuses(res.statuses);
          return;
        }
      }
      const entries = await Promise.all((list || []).map(async p => { try { const r = await window.electronAPI.getProfileWs(p.id); return [p.id, r?.wsEndpoint || null]; } catch { return [p.id, null]; } }));
      setRunningWs(Object.fromEntries(entries));
    } catch (e) { console.warn('Failed to refresh running status', e); }
  };

  const handleCreateProfile = async () => {
    // Check license limit before creating profile
    const currentCount = profiles.length;
    const maxAllowed = licenseInfo.maxProfiles;
    
    if (maxAllowed !== -1 && currentCount >= maxAllowed) {
      const tierName = licenseInfo.tier?.toUpperCase() || 'FREE';
      const message = `⚠️ Profile Limit Reached!\n\nYour ${tierName} plan allows ${maxAllowed} profile${maxAllowed > 1 ? 's' : ''} maximum.\nCurrently: ${currentCount}/${maxAllowed}\n\n🚀 Upgrade to PRO for unlimited profiles!`;
      
      // First, ask if user wants to get license from web
      if (window.confirm(message + '\n\n📱 Do you want to open the web admin to get a PRO license?\n(Click OK to open web, Cancel to enter license key manually)')) {
        // Open web admin pricing page
        const url = getLicenseRequestUrl('pro');
        if (window.electronAPI?.openExternal) {
          await window.electronAPI.openExternal(url);
        } else {
          window.open(url, '_blank');
        }
        addToast('Web admin opened. After getting your license, go to Settings to activate it.', 'info', 7000);
      } else {
        // User wants to enter license key manually
        if (window.confirm('Do you already have a license key?\n\nClick OK to open activation modal.')) {
          setShowLicenseModal(true);
        }
      }
      return;
    }
    
    const base = 'Profile'; const existing = new Set((profiles || []).map(p => (p.name || '').trim()));
    let name = `${base} ${(profiles || []).length + 1}`; for (let i = 1; i <= (profiles || []).length + 100; i++) { const c = `${base} ${i}`; if (!existing.has(c)) { name = c; break; } }
    setSelectedProfile({ name }); setFormInitialTab('general'); setShowForm(true);
  };
  const handleEditProfile = (profile, tab = 'general') => { setSelectedProfile(profile); setFormInitialTab(tab); setShowForm(true); };
  const handleDeleteProfile = async (profileId) => { if (!window.confirm('Delete this profile?')) return; try { await api.deleteProfile(profileId); await loadProfiles(); } catch (e) { console.error('Delete error', e); } };

  const handleLaunchProfile = async (profileId) => {
    // Block if already starting or running
    const st = profileStatuses[profileId]?.status;
    if (st === 'STARTING' || st === 'RUNNING' || st === 'STOPPING') return;
    setErrorProfiles(prev => { const n = { ...prev }; delete n[profileId]; return n; });
    try {
      const headless = !!headlessPrefs[profileId];
      const engine = enginePrefs[profileId] || 'playwright';

      // Only check Playwright engines (cdp uses system Chrome, no install needed)
      if (engine !== 'cdp') {
        const isCamoufox = engine === 'camoufox';
        const isFirefox = engine === 'playwright-firefox' || engine === 'firefox';
        const requiredBrowser = isCamoufox ? 'camoufox' : isFirefox ? 'firefox' : 'chromium';
        try {
          const status = await window.electronAPI?.checkBrowserStatus?.(requiredBrowser);
          if (status?.status !== 'installed') {
            setEngineInstallState({ profileId, engine: requiredBrowser, headless });
            return;
          }
        } catch { }
      }

      await doLaunchProfile(profileId, { headless, engine });
    } catch (e) {
      setErrorProfiles(prev => ({ ...prev, [profileId]: true }));
      addToast('Error launching profile: ' + e.message, 'error', 5000);
    }
  };

  const doLaunchProfile = async (profileId, { headless, engine } = {}) => {
    const h = headless !== undefined ? headless : !!headlessPrefs[profileId];
    const eng = engine || enginePrefs[profileId] || 'playwright';
    try {
      const options = { headless: h, engine: eng };
      const result = await window.electronAPI.launchProfile(profileId, options);
      if (!result.success) {
        setErrorProfiles(prev => ({ ...prev, [profileId]: true }));
        addToast('Error launching profile: ' + result.error, 'error', 5000);
      }
      // No manual refreshRunningStatus - backend broadcasts status changes
    } catch (e) {
      setErrorProfiles(prev => ({ ...prev, [profileId]: true }));
      addToast('Error launching profile: ' + e.message, 'error', 5000);
    }
  };
  const handleStopProfile = async (profileId) => { try { const res = profileId === '__ALL__' ? await window.electronAPI.stopAllProfiles() : await window.electronAPI.stopProfile(profileId); if (!res.success) alert('Error stopping profile: ' + res.error); await refreshRunningStatus(); } catch (e) { alert('Error stopping profile: ' + e.message); } };
  const handleSetHeadless = async (profileId, value) => { if (runningWs[profileId]) return; setHeadlessPrefs(prev => ({ ...prev, [profileId]: !!value })); try { const p = profiles.find(x => x.id === profileId); if (p) { const updated = { ...p, settings: { ...(p.settings || {}), headless: !!value } }; const res = await window.electronAPI.saveProfile(updated); if (res?.success && res.profile) setProfiles(prev => prev.map(pp => pp.id === profileId ? res.profile : pp)); } } catch { } };
  const handleSetEngine = async (profileId, value) => { if (runningWs[profileId]) return; setEnginePrefs(prev => ({ ...prev, [profileId]: value })); try { const p = profiles.find(x => x.id === profileId); if (p) { const updated = { ...p, settings: { ...(p.settings || {}), engine: value } }; const res = await window.electronAPI.saveProfile(updated); if (res?.success && res.profile) setProfiles(prev => prev.map(pp => pp.id === profileId ? res.profile : pp)); } } catch { } };
  const handleToggleProfile = async (profileId) => {
    const st = profileStatuses[profileId]?.status;
    if (st === 'STARTING' || st === 'STOPPING') return;
    return (st === 'RUNNING' || runningWs[profileId]) ? handleStopProfile(profileId) : handleLaunchProfile(profileId);
  };
  const handleLaunchHeadless = async (profileId) => {
    setErrorProfiles(prev => { const n = { ...prev }; delete n[profileId]; return n; });
    try {
      const engine = enginePrefs[profileId] || 'playwright';
      const options = { headless: true, engine };
      const result = await window.electronAPI.launchProfile(profileId, options);
      if (!result.success) { setErrorProfiles(prev => ({ ...prev, [profileId]: true })); alert('Error launching headless: ' + result.error); }
      await refreshRunningStatus();
    } catch (e) { setErrorProfiles(prev => ({ ...prev, [profileId]: true })); alert('Error launching headless: ' + e.message); }
  };
  const handleSaveProfile = async (profile) => {
    try {
      // Check license limit cho free users
      const isNewProfile = !profile.id;
      const isPaidUser = !!localStorage.getItem('hl-license-activated');
      
      if (isNewProfile && !isPaidUser) {
        const currentProfileCount = (profiles || []).length;
        if (currentProfileCount >= 5) {
          alert('Free plan giới hạn tối đa 5 profiles.\n\nVui lòng nâng cấp license để tạo thêm profile.');
          return;
        }
      }
      
      const result = await api.saveProfile(profile);
      if (result.success) {
        setShowForm(false);
        setSelectedProfile(null);
        await loadProfiles();
      } else {
        alert('Error saving profile: ' + result.error);
      }
    } catch (e) {
      alert('Error saving profile: ' + e.message);
    }
  };
  const handleCancel = () => { setShowForm(false); setSelectedProfile(null); };
  const handleManageCookies = (profile) => setCookieProfile(profile);
  const handleViewLogs = (profile) => setLogProfile(profile);
  const handleCloneProfile = async (profileId) => { try { const res = await window.electronAPI.cloneProfile(profileId, {}); if (!res.success) throw new Error(res.error || 'Clone failed'); await loadProfiles(); } catch (e) { alert('Clone error: ' + e.message); } };
  const handleCopyWs = async (profileId) => { try { const res = await window.electronAPI.getProfileWs(profileId); const ws = res?.wsEndpoint; if (!ws) { alert('Profile is not running. Launch first.'); return; } await navigator.clipboard.writeText(ws); addToast('WS endpoint copied!', 'success', 2000); } catch (e) { alert('Failed to copy WS endpoint: ' + e.message); } };

  // Toggle a fingerprint section (e.g. display, hardware) on/off directly from the profile card badge
  const handleToggleFp = async (profile, section, newValue) => {
    try {
      const updated = {
        ...profile,
        settings: {
          ...(profile.settings || {}),
          [section]: {
            ...(profile.settings?.[section] || {}),
            enabled: newValue,
          },
        },
      };
      const res = await window.electronAPI.saveProfile(updated);
      if (res?.success) {
        // Update local state optimistically for instant feedback
        setProfiles(prev => prev.map(p => p.id === profile.id ? (res.profile || updated) : p));
      }
    } catch (e) {
      addToast('Error: ' + e.message, 'error', 3000);
    }
  };

  const handleLinkProxy = async (proxy) => {
    if (!linkProxyProfile) return;
    try {
      let proxySettings = { type: 'none', server: '', username: '', password: '', rotateUrl: '' };
      
      if (proxy && proxy.type !== 'none') {
        const typeStr = (proxy.type || proxy.protocol || 'http').toLowerCase();
        const hostPort = proxy.port ? `${proxy.host}:${proxy.port}` : proxy.host;
        proxySettings = {
          type: typeStr,
          server: hostPort || '',
          username: proxy.username || '',
          password: proxy.password || '',
          rotateUrl: proxy.rotateUrl || ''
        };
      }
      
      const updated = {
        ...linkProxyProfile,
        settings: {
          ...(linkProxyProfile.settings || {}),
          proxy: proxySettings
        }
      };
      const res = await api.saveProfile(updated);
      if (res?.success) {
        setProfiles(prev => prev.map(p => p.id === linkProxyProfile.id ? (res.profile || updated) : p));
        setLinkProxyProfile(null);
        addToast(`Proxy linked to ${linkProxyProfile.name}`, 'success', 2500);
      } else {
        addToast('Error saving proxy to profile: ' + res?.error, 'error', 3000);
      }
    } catch (e) {
      addToast('Error linking proxy: ' + e.message, 'error', 3000);
    }
  };

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
        const cur = await window.electronAPI.getApiServerStatus?.(); if (cur?.success && cur.state) setApiStatus(cur.state);
      }
    } catch (e) { console.warn('Toggle API run error', e); }
  };

  // ---- Render Content based on activeNav ----
  const renderContent = () => {
    if (showForm) {
      return (
        <ProfileForm
          profile={selectedProfile}
          initialTab={formInitialTab}
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
            onLaunchHeadless={handleLaunchHeadless}
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
            errorProfiles={errorProfiles}
            profileStatuses={profileStatuses}
            onToggleFp={handleToggleFp}
            onReloadProfiles={loadProfiles}
            onViewLiveScreen={(profile) => setPreviewProfile(profile)}
          />
        );

      case 'scripts':
        return (
          <ScriptsManager
            open={true}
            onClose={() => setActiveNav('profiles')}
            profiles={profiles}
            onRunScript={(pid, sid) => { }}
            fullPage={true}
          />
        );

      case 'proxies':
        return (
          <ProxyManager />
        );

      case 'logs':
        return (
          <AppLogsTab logs={appLogs} onClear={() => setAppLogs([])} />
        );

      case 'settings':
        return (
          <SettingsTab
            apiStatus={apiStatus}
            apiDesiredPort={apiDesiredPort}
            setApiDesiredPort={setApiDesiredPort}
            applyPortChange={applyPortChange}
            handleToggleApiRun={handleToggleApiRun}
            handleRestartApi={handleRestartApi}
            theme={theme}
            setTheme={setTheme}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="app">
      {!showForm && (
        <DashboardSidebar
          activeNav={activeNav}
          onNavigate={(id) => { setShowForm(false); setSelectedProfile(null); setActiveNav(id); }}
          onCreateProfile={handleCreateProfile}
          apiStatus={apiStatus}
          licenseInfo={licenseInfo}
          profileCount={profiles.length}
          onUpgrade={() => setShowLicenseModal(true)}
        />
      )}

      <main className="app-main">
        {renderContent()}
      </main>

      {showLicenseModal && <LicenseModal onClose={handleCloseLicense} onActivated={handleLicenseActivated} />}

      {/* Engine Install Modal */}
      {engineInstallState && (
        <EngineInstallModal
          engine={engineInstallState.engine}
          onSkip={() => setEngineInstallState(null)}
          onInstall={() => {
            const { profileId, engine, headless } = engineInstallState;
            setEngineInstallState(null);
            // Relaunch automatically after successful install
            doLaunchProfile(profileId, {
              headless,
              engine: engine === 'firefox' ? 'playwright-firefox' : 'playwright',
            });
          }}
        />
      )}

      {/* Overlays */}
      {cookieProfile && <CookieManager profile={cookieProfile} onClose={() => setCookieProfile(null)} />}
      {logProfile && <LogViewer profile={logProfile} onClose={() => setLogProfile(null)} />}
      {linkProxyProfile && <LinkProxyModal profile={linkProxyProfile} onClose={() => setLinkProxyProfile(null)} onLink={handleLinkProxy} />}
      {previewProfile && (
        <LivePreviewPanel
          profile={previewProfile}
          apiPort={apiStatus.port || 4000}
          onClose={() => setPreviewProfile(null)}
        />
      )}
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
