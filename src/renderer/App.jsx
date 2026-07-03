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
import MacroManager from './components/MacroManager';
import AuthModal from './components/AuthModal';
import './App.css';
import { useI18n } from './i18n/index';
import { db } from './services/firebase';
import { collection, getDocs, doc, setDoc, deleteDoc, writeBatch, getCountFromServer } from 'firebase/firestore';
 
function App() {
  const { t, lang, setLang } = useI18n();
  // Engine install modal: { profileId, engine, headless } | null
  const [engineInstallState, setEngineInstallState] = useState(null);
  
  const [currentUser, setCurrentUser] = useState(() => {
    const token = localStorage.getItem('firebase_id_token');
    const uid = localStorage.getItem('firebase_uid');
    const email = localStorage.getItem('firebase_email');
    return token && uid ? { token, uid, email } : null;
  });

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
  const [deleteConfirm, setDeleteConfirm] = useState(null); // { profileId, profileName }
  const [deleteBulkConfirm, setDeleteBulkConfirm] = useState(null); // { ids, runningCount }

  // Auto-update
  const [updateInfo, setUpdateInfo] = useState(null);       // release object khi có bản mới
  const [updatePhase, setUpdatePhase] = useState(null);     // 'downloading' | 'downloaded' | 'installing'
  const [updateProgress, setUpdateProgress] = useState(0);  // 0–1

  // Kiểm tra bản cập nhật khi app khởi động xong
  useEffect(() => {
    if (!window.electronAPI?.checkForUpdate) return;
    const runCheck = async () => {
      try {
        const result = await window.electronAPI.checkForUpdate();
        if (result?.hasUpdate && result?.release) {
          setUpdateInfo(result.release);
        }
      } catch {}
    };

    // Đợi 5 giây sau khi load để tránh làm chậm khởi động
    const timer = setTimeout(runCheck, 5000);
    // Poll định kỳ mỗi 3 phút để bắt được bản vừa được admin Publish sớm nhất
    const interval = setInterval(runCheck, 3 * 60 * 1000);

    // Lắng nghe event update-available từ main process (bootstrap tự gửi)
    const cleanupAvailable = window.electronAPI.onUpdateAvailable?.((release) => {
      if (release) setUpdateInfo(release);
    });

    // Lắng nghe tiến trình download
    const cleanupProgress = window.electronAPI.onUpdateProgress?.((payload) => {
      setUpdatePhase(payload.phase);
      setUpdateProgress(payload.progress || 0);
    });

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
      try { cleanupAvailable?.(); } catch {}
      try { cleanupProgress?.(); } catch {}
    };
  }, []);

  const handleInstallUpdate = async () => {
    if (!updateInfo || !window.electronAPI?.installUpdate) return;
    setUpdatePhase('downloading');
    setUpdateProgress(0);
    try {
      await window.electronAPI.installUpdate(updateInfo);
    } catch (e) {
      setUpdatePhase(null);
      console.error('[Update] install error:', e);
    }
  };

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

  const licenseKey = `hl-license-activated_${localStorage.getItem('firebase_email') || ''}`;
  const [showLicenseModal, setShowLicenseModal] = useState(() => {
    // Skip modal if user already activated OR chose free plan this session
    const email = localStorage.getItem('firebase_email') || '';
    return !localStorage.getItem(`hl-license-activated_${email}`) &&
           !sessionStorage.getItem('license-skipped');
  });
  const handleCloseLicense = () => {
    sessionStorage.setItem('license-skipped', 'true');
    setShowLicenseModal(false);
  };
  const handleLicenseActivated = () => {
    setShowLicenseModal(false);
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

  // Bridge helper: Syncs between Firebase Firestore and Local IPC
  const api = useMemo(() => {
    const hasIpc = !!(window.electronAPI && typeof window.electronAPI === 'object');
    return {
      async getProfiles() {
        if (!currentUser?.uid) {
          // Fallback if offline/not logged in
          if (hasIpc && window.electronAPI.getProfiles) return await window.electronAPI.getProfiles();
          return [];
        }
        try {
          // Fetch from Firestore
          const querySnapshot = await getDocs(collection(db, `users/${currentUser.uid}/profiles`));
          const firestoreProfiles = [];
          querySnapshot.forEach((doc) => {
            firestoreProfiles.push({ id: doc.id, ...doc.data() });
          });
          
          if (hasIpc && window.electronAPI.syncLocalProfiles) {
            // Check if this is the first time syncing (cloud empty but local has data)
            const localProfiles = await window.electronAPI.getProfiles();
            if (firestoreProfiles.length === 0 && localProfiles && localProfiles.length > 0) {
              console.log("Migrating local profiles to cloud...");
              const batch = writeBatch(db);
              localProfiles.forEach(p => {
                batch.set(doc(db, `users/${currentUser.uid}/profiles`, p.id), p);
              });
              await batch.commit();
              return localProfiles; // Return local, they are now on the cloud
            }
            
            // Otherwise, normal sync: overwrite local with cloud data
            await window.electronAPI.syncLocalProfiles(firestoreProfiles);
          }
          return firestoreProfiles;
        } catch (e) {
          console.error("Firestore getProfiles error:", e);
          // Fallback to local
          if (hasIpc && window.electronAPI.getProfiles) return await window.electronAPI.getProfiles();
          return [];
        }
      },
      async saveProfile(profile) {
        if (!currentUser?.uid) return { success: false, error: 'Not logged in' };
        try {
          const profileId = profile.id || `prof-${Date.now()}`;
          const profileData = { ...profile, id: profileId };
          
          // Save to Firestore
          await setDoc(doc(db, `users/${currentUser.uid}/profiles`, profileId), profileData);
          
          // Save to Local Cache
          if (hasIpc && window.electronAPI.saveProfile) {
            await window.electronAPI.saveProfile(profileData);
          }
          return { success: true, profile: profileData };
        } catch (e) {
          console.error("Firestore saveProfile error:", e);
          return { success: false, error: e.message };
        }
      },
      async deleteProfile(profileId) {
        if (!currentUser?.uid) return { success: false, error: 'Not logged in' };
        try {
          // Delete from Firestore
          await deleteDoc(doc(db, `users/${currentUser.uid}/profiles`, profileId));
          
          // Delete from Local Cache
          if (hasIpc && window.electronAPI.deleteProfile) {
            await window.electronAPI.deleteProfile(profileId);
          }
          return { success: true };
        } catch (e) {
          console.error("Firestore deleteProfile error:", e);
          return { success: false, error: e.message };
        }
      },
      async saveProfilesBulk(profilesList) {
        if (!currentUser?.uid) return { success: false, error: 'Not logged in' };
        try {
          const batch = writeBatch(db);
          const finalProfiles = [];
          profilesList.forEach(p => {
            const profileId = p.id || `prof-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const profileData = { ...p, id: profileId };
            finalProfiles.push(profileData);
            batch.set(doc(db, `users/${currentUser.uid}/profiles`, profileId), profileData);
          });
          
          await batch.commit();
          
          if (hasIpc && window.electronAPI.saveProfilesBulk) {
            await window.electronAPI.saveProfilesBulk(finalProfiles);
          }
          return { success: true, profiles: finalProfiles };
        } catch (e) {
          console.error("Firestore saveProfilesBulk error:", e);
          return { success: false, error: e.message };
        }
      },
      async deleteProfilesBulk(ids) {
        if (!currentUser?.uid) return { success: false, error: 'Not logged in' };
        try {
          const batch = writeBatch(db);
          ids.forEach(id => {
            batch.delete(doc(db, `users/${currentUser.uid}/profiles`, id));
          });
          await batch.commit();
          
          if (hasIpc && window.electronAPI.deleteProfilesBulk) {
            await window.electronAPI.deleteProfilesBulk(ids);
          }
          return { success: true, deleted: ids.length };
        } catch (e) {
          console.error("Firestore deleteProfilesBulk error:", e);
          return { success: false, error: e.message };
        }
      },
      async cloneProfilesBulk(ids, overrides) {
        if (!currentUser?.uid) return { success: false, error: 'Not logged in' };
        try {
          // First, get the current local profiles to clone from
          let existingProfiles = [];
          if (hasIpc && window.electronAPI.getProfiles) {
            existingProfiles = await window.electronAPI.getProfiles();
          } else {
            const querySnapshot = await getDocs(collection(db, `users/${currentUser.uid}/profiles`));
            querySnapshot.forEach((doc) => existingProfiles.push({ id: doc.id, ...doc.data() }));
          }
          
          const profilesToClone = existingProfiles.filter(p => ids.includes(p.id));
          const batch = writeBatch(db);
          const finalProfiles = [];
          
          profilesToClone.forEach(p => {
            const newId = `prof-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const clonedProfile = JSON.parse(JSON.stringify(p));
            clonedProfile.id = newId;
            clonedProfile.name = `${clonedProfile.name} (Clone)`;
            Object.assign(clonedProfile, overrides || {});
            
            finalProfiles.push(clonedProfile);
            batch.set(doc(db, `users/${currentUser.uid}/profiles`, newId), clonedProfile);
          });
          
          await batch.commit();
          
          if (hasIpc && window.electronAPI.saveProfilesBulk) {
            await window.electronAPI.saveProfilesBulk(finalProfiles);
          }
          return { success: true, profiles: finalProfiles };
        } catch (e) {
          console.error("Firestore cloneProfilesBulk error:", e);
          return { success: false, error: e.message };
        }
      },
    };
  }, [currentUser?.uid]);

  // Wait for backend IPC to be ready, then load data
  useEffect(() => {
    let unsub = null;
    const init = () => { setBackendReady(true); loadProfiles(); };
    // In production, IPC handlers may register after window loads.
    // Listen for explicit 'backend-ready' signal from main process.
    if (window.electronAPI?.onBackendReady) {
      unsub = window.electronAPI.onBackendReady(() => init());
    }
    // Also try immediately — in dev, handlers are usually ready already
    loadProfiles();
    return () => { try { unsub?.(); } catch {} };
  }, [api]);

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
  }, [api]);

  // Listen for deep-link launch commands from main process (hlmck://launch/{profileId})
  useEffect(() => {
    if (!window.electronAPI?.onDeeplinkLaunchProfile) return;
    const unsub = window.electronAPI.onDeeplinkLaunchProfile((profileId) => {
      if (profileId) handleLaunchProfile(profileId);
    });
    return () => { try { unsub?.(); } catch {} };
  }, [profiles, profileStatuses]);

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

  // Reload profiles whenever the logged-in user changes (login/logout/switch account)
  useEffect(() => {
    loadProfiles();
  }, [api]);

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

  // ── Helper: lấy số profile thực tế từ Firestore (tránh bypass bằng state cũ) ──
  const getCloudProfileCount = async () => {
    if (!currentUser?.uid) return (profiles || []).length;
    try {
      const snap = await getCountFromServer(collection(db, `users/${currentUser.uid}/profiles`));
      return snap.data().count;
    } catch {
      return (profiles || []).length;
    }
  };

  const handleCreateProfile = () => {
    const base = 'Profile'; const existing = new Set((profiles || []).map(p => (p.name || '').trim()));
    let name = `${base} ${(profiles || []).length + 1}`; for (let i = 1; i <= (profiles || []).length + 100; i++) { const c = `${base} ${i}`; if (!existing.has(c)) { name = c; break; } }
    setSelectedProfile({ name }); setFormInitialTab('general'); setShowForm(true);
  };
  const handleEditProfile = (profile, tab = 'general') => { setSelectedProfile(profile); setFormInitialTab(tab); setShowForm(true); };
  const handleDeleteProfile = (profileId) => {
    const profile = (profiles || []).find(p => p.id === profileId);
    setDeleteConfirm({ profileId, profileName: profile?.name || profileId });
  };
  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    const { profileId } = deleteConfirm;
    setDeleteConfirm(null);
    try { await api.deleteProfile(profileId); await loadProfiles(); } catch (e) { console.error('Delete error', e); }
  };

  const handleLaunchProfile = async (profileId) => {
    // Block if already starting or running
    const st = profileStatuses[profileId]?.status;
    if (st === 'STARTING' || st === 'RUNNING' || st === 'STOPPING') return;
    setErrorProfiles(prev => { const n = { ...prev }; delete n[profileId]; return n; });
    try {
      // Launch button → always visible browser (headless=false)
      const headless = false;
      setHeadlessPrefs(prev => ({ ...prev, [profileId]: false }));
      const p = profiles.find(x => x.id === profileId);
      if (!p) {
        addToast('Lỗi: Profile này không thuộc về tài khoản đang đăng nhập trên App.', 'error', 8000);
        setErrorProfiles(prev => ({ ...prev, [profileId]: true }));
        return;
      }
      const engine = p?.settings?.engine || 'playwright';

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

      await doLaunchProfile(profileId, { headless, engine });
    } catch (e) {
      setErrorProfiles(prev => ({ ...prev, [profileId]: true }));
      addToast('Error launching profile: ' + e.message, 'error', 5000);
    }
  };

  const doLaunchProfile = async (profileId, { headless, engine } = {}) => {
    const p = profiles.find(x => x.id === profileId);
    if (!p) {
      addToast('Lỗi: Profile này không thuộc về tài khoản đang đăng nhập trên App.', 'error', 8000);
      setErrorProfiles(prev => ({ ...prev, [profileId]: true }));
      return;
    }
    const h = headless !== undefined ? headless : !!p?.settings?.headless;
    const eng = engine || p?.settings?.engine || 'playwright';
    try {
      const options = { headless: h, engine: eng, token: currentUser?.token };
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
  const handleStopProfile = async (profileId) => { try { const res = profileId === '__ALL__' ? await window.electronAPI.stopAllProfiles() : await window.electronAPI.stopProfile(profileId, { token: currentUser?.token }); if (!res.success) alert('Error stopping profile: ' + res.error); await refreshRunningStatus(); } catch (e) { alert('Error stopping profile: ' + e.message); } };
  const handleSetHeadless = async (profileId, value) => { if (runningWs[profileId]) return; setHeadlessPrefs(prev => ({ ...prev, [profileId]: !!value })); try { const p = profiles.find(x => x.id === profileId); if (p) { const updated = { ...p, settings: { ...(p.settings || {}), headless: !!value } }; const res = await window.electronAPI.saveProfile(updated); if (res?.success && res.profile) setProfiles(prev => prev.map(pp => pp.id === profileId ? res.profile : pp)); } } catch { } };
  const handleSetEngine = async (profileId, value) => { if (runningWs[profileId]) return; setEnginePrefs(prev => ({ ...prev, [profileId]: value })); try { const p = profiles.find(x => x.id === profileId); if (p) { const updated = { ...p, settings: { ...(p.settings || {}), engine: value } }; const res = await window.electronAPI.saveProfile(updated); if (res?.success && res.profile) setProfiles(prev => prev.map(pp => pp.id === profileId ? res.profile : pp)); } } catch { } };
  const handleToggleProfile = async (profileId) => {
    const st = profileStatuses[profileId]?.status;
    if (st === 'STARTING' || st === 'STOPPING') return;
    return (st === 'RUNNING' || runningWs[profileId]) ? handleStopProfile(profileId) : handleLaunchProfile(profileId);
  };
  const handleLaunchHeadless = async (profileId) => {
    // Block if already starting or running
    const st = profileStatuses[profileId]?.status;
    if (st === 'STARTING' || st === 'RUNNING' || st === 'STOPPING') return;
    setErrorProfiles(prev => { const n = { ...prev }; delete n[profileId]; return n; });
    try {
      // Headless button → always hidden (headless=true), show View button after launch
      setHeadlessPrefs(prev => ({ ...prev, [profileId]: true }));
      const p = profiles.find(x => x.id === profileId);
      if (!p) {
        addToast('Lỗi: Profile này không thuộc về tài khoản đang đăng nhập trên App.', 'error', 8000);
        setErrorProfiles(prev => ({ ...prev, [profileId]: true }));
        return;
      }
      const engine = p?.settings?.engine || 'playwright';
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
      const email = localStorage.getItem('firebase_email') || '';
      const isPaidUser = !!localStorage.getItem(`hl-license-activated_${email}`);
      
      if (isNewProfile && !isPaidUser) {
        const cloudCount = await getCloudProfileCount();
        if (cloudCount >= 5) {
          alert(`Tài khoản Free chỉ được tạo tối đa 5 profile.\nBạn đang có ${cloudCount} profile trên cloud.\n\nVui lòng nâng cấp lên Pro để tạo thêm.`);
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

  // Bulk operations
  const handleCreateBulk = async (count, namePrefix, engine = 'playwright') => {
    try {
      const email = localStorage.getItem('firebase_email') || '';
      const isPaidUser = !!localStorage.getItem(`hl-license-activated_${email}`);
      const cloudCount = await getCloudProfileCount();
      if (!isPaidUser && cloudCount + count > 5) {
        const canCreate = Math.max(0, 5 - cloudCount);
        alert(`Tài khoản Free chỉ được tạo tối đa 5 profile.\nBạn đang có ${cloudCount} profile trên cloud, chỉ còn có thể tạo thêm ${canCreate} profile.\n\nVui lòng nâng cấp lên Pro để tạo thêm.`);
        return;
      }

      // Find the highest existing number for this prefix to avoid duplicates
      const prefixLower = namePrefix.toLowerCase();
      let maxNum = 0;
      for (const p of profiles) {
        const name = (p.name || '').toLowerCase();
        if (name.startsWith(prefixLower)) {
          const suffix = (p.name || '').slice(namePrefix.length).trim();
          const n = parseInt(suffix, 10);
          if (!isNaN(n) && n > maxNum) maxNum = n;
        }
      }

      const batch = [];
      for (let i = 1; i <= count; i++) {
        const num = String(maxNum + i).padStart(4, '0');
        batch.push({
          name: `${namePrefix} ${num}`,
          settings: {
            engine,
            identity: { enabled: false },
            hardware: { enabled: false },
            display:  { enabled: false },
            canvas:   { enabled: false },
            webgl:    { enabled: false },
            audio:    { enabled: false },
            media:    { enabled: false },
            network:  { enabled: false },
            battery:  { enabled: false },
          },
        });
      }
      const res = await api.saveProfilesBulk(batch);
      if (res.success) {
        if (res.errors && res.errors.length > 0) {
          addToast(`Created ${res.profiles?.length ?? 0} profiles. ${res.errors.length} failed: ${res.errors[0].error}`, 'warning', 5000);
        } else {
          addToast(`Created ${res.profiles?.length ?? count} profiles`, 'success', 2500);
        }
        await loadProfiles();
      } else {
        addToast(res.error || 'Bulk create error', 'error', 5000);
      }
    } catch (e) {
      addToast('Bulk create error: ' + e.message, 'error', 5000);
    }
  };
  const handleDeleteBulk = async (ids) => {
    if (!ids?.length) return;
    const runningIds = ids.filter(id => !!runningWs[id]);
    setDeleteBulkConfirm({ ids, runningCount: runningIds.length });
  };
  const confirmDeleteBulk = async () => {
    if (!deleteBulkConfirm) return;
    const { ids } = deleteBulkConfirm;
    setDeleteBulkConfirm(null);
    try {
      const res = await api.deleteProfilesBulk(ids);
      if (res.success) {
        addToast(`Deleted ${res.deleted || ids.length} profiles`, 'success', 2500);
        clearSelection();
        await loadProfiles();
      } else {
        addToast('Bulk delete error: ' + (res.error || 'unknown'), 'error', 5000);
      }
    } catch (e) {
      addToast('Bulk delete failed: ' + e.message, 'error', 5000);
    }
  };
  const handleCloneBulk = async (ids) => {
    if (!ids?.length) return;
    try {
      const email = localStorage.getItem('firebase_email') || '';
      const isPaidUser = !!localStorage.getItem(`hl-license-activated_${email}`);
      const cloudCount = await getCloudProfileCount();
      if (!isPaidUser && cloudCount + ids.length > 5) {
        const canClone = Math.max(0, 5 - cloudCount);
        alert(`Tài khoản Free chỉ được tạo tối đa 5 profile.\nBạn đang có ${cloudCount} profile trên cloud, chỉ còn có thể clone thêm ${canClone} profile.\n\nVui lòng nâng cấp lên Pro để tạo thêm.`);
        return;
      }

      const res = await api.cloneProfilesBulk(ids, {});
      if (res.success) {
        if (res.errors && res.errors.length > 0) {
          addToast(`Cloned ${res.profiles?.length ?? 0} profiles. ${res.errors.length} failed: ${res.errors[0].error}`, 'warning', 5000);
        } else {
          addToast(`Cloned ${res.profiles?.length ?? ids.length} profiles`, 'success', 2500);
        }
        clearSelection();
        await loadProfiles();
      } else {
        addToast(res.error || 'Bulk clone error', 'error', 5000);
      }
    } catch (e) {
      addToast('Bulk clone failed: ' + e.message, 'error', 5000);
    }
  };

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
  const handleStartSelected = async () => {
    const ids = getSelectedList();
    if (!ids.length) return;
    // Filter out already-running/starting profiles
    const toStart = ids.filter(id => {
      const st = profileStatuses[id]?.status;
      return st !== 'RUNNING' && st !== 'STARTING' && st !== 'STOPPING';
    });
    if (!toStart.length) return;
    // Load max concurrent limit
    let maxConcurrent = 5;
    try {
      const res = await window.electronAPI.loadSettings?.();
      if (res?.settings?.maxConcurrentBrowsers) maxConcurrent = Number(res.settings.maxConcurrentBrowsers);
    } catch {}
    const currentlyRunning = Object.values(profileStatuses).filter(s => s?.status === 'RUNNING' || s?.status === 'STARTING').length;
    const slotsAvailable = Math.max(0, maxConcurrent - currentlyRunning);
    const toLaunch = toStart.slice(0, slotsAvailable);
    const skipped = toStart.length - toLaunch.length;
    if (toLaunch.length > 0) await Promise.all(toLaunch.map(id => handleLaunchProfile(id)));
    if (skipped > 0) addToast(`${skipped} profile(s) skipped — max ${maxConcurrent} concurrent browsers reached.`, 'warning', 5000);
    await refreshRunningStatus();
  };
  const handleStopSelected = async () => { const ids = getSelectedList(); await Promise.all(ids.map(id => window.electronAPI.stopProfile(id, { token: currentUser?.token }))); await refreshRunningStatus(); };
  const handleDeleteSelected = async () => { const ids = getSelectedList(); if (!ids.length) return; await handleDeleteBulk(ids); };
  const handleCloneSelected = async () => { const ids = getSelectedList(); if (!ids.length) return; await handleCloneBulk(ids); };

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
            onSaveProfile={handleSaveProfile}
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
            onCloneSelected={handleCloneSelected}
            onCreateBulk={handleCreateBulk}
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

      case 'macros':
        return (
          <MacroManager profiles={profiles} />
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

  const handleLogout = async () => {
    const confirmed = window.confirm(
      'Bạn có chắc muốn đăng xuất không?\n\nLịch sử profile sẽ được lưu lại cho tài khoản của bạn trên cloud.'
    );
    if (!confirmed) return;

    // Clear local profile cache so next user starts fresh
    try {
      if (window.electronAPI?.syncLocalProfiles) {
        await window.electronAPI.syncLocalProfiles([]);
      }
    } catch (e) {
      console.warn('Could not clear local profile cache:', e);
    }

    // Clear session & auth data
    localStorage.removeItem('firebase_id_token');
    localStorage.removeItem('firebase_uid');
    localStorage.removeItem('firebase_email');
    sessionStorage.removeItem('license-skipped');
    setProfiles([]);
    setCurrentUser(null);
  };

  if (!currentUser) {
    return (
      <div className="app">
        <AuthModal onLoginSuccess={(user) => setCurrentUser(user)} />
      </div>
    );
  }

  return (
    <div className="app">
      {/* ── Update banner ──────────────────────────────────────────────── */}
      {updateInfo && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
          background: 'linear-gradient(90deg, #0e7490, #0891b2)',
          color: '#fff', padding: '8px 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          fontSize: '13px', gap: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>⬆️</span>
            <strong>Update available: v{updateInfo.version}</strong>
            {updateInfo.notes && (
              <span style={{ opacity: 0.75, fontSize: '12px' }}>— {updateInfo.notes.slice(0, 80)}{updateInfo.notes.length > 80 ? '…' : ''}</span>
            )}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {updatePhase === 'downloading' && (
              <span style={{ fontSize: '12px', opacity: 0.85 }}>
                Downloading… {Math.round(updateProgress * 100)}%
              </span>
            )}
            {updatePhase === 'installing' && (
              <span style={{ fontSize: '12px', opacity: 0.85 }}>Installing… App will restart shortly.</span>
            )}
            {!updatePhase && (
              <button
                onClick={handleInstallUpdate}
                style={{
                  background: '#fff', color: '#0e7490', border: 'none',
                  borderRadius: '6px', padding: '4px 14px', fontWeight: 700,
                  fontSize: '12px', cursor: 'pointer',
                }}
              >
                Update now
              </button>
            )}
            <button
              onClick={() => setUpdateInfo(null)}
              style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', opacity: 0.7, fontSize: '16px', lineHeight: 1, padding: '0 4px' }}
              title="Dismiss"
            >✕</button>
          </span>
        </div>
      )}

      {!showForm && (
        <DashboardSidebar
          activeNav={activeNav}
          onNavigate={(id) => { setShowForm(false); setSelectedProfile(null); setActiveNav(id); }}
          onCreateProfile={handleCreateProfile}
          apiStatus={apiStatus}
          onLogout={handleLogout}
          currentUser={currentUser}
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
              engine: engine === 'firefox' ? 'playwright-firefox' : engine === 'camoufox' ? 'camoufox' : 'playwright',
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

      {/* Delete Profile Confirmation Modal */}
      {deleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)' }}
          onClick={() => setDeleteConfirm(null)}>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '28px 28px 24px', width: '420px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', marginBottom: '20px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>
              <div>
                <div style={{ fontSize: '16px', fontWeight: '700', color: '#111827', marginBottom: '4px' }}>Delete Profile</div>
                <div style={{ fontSize: '14px', color: '#6b7280', lineHeight: 1.5 }}>
                  <span style={{ fontWeight: '600', color: '#374151' }}>{deleteConfirm.profileName}</span> and all its data will be permanently removed.
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button onClick={() => setDeleteConfirm(null)}
                style={{ padding: '8px 20px', borderRadius: '8px', border: '1px solid #d1d5db', background: '#fff', color: '#374151', fontSize: '14px', fontWeight: '500', cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={confirmDelete}
                style={{ padding: '8px 20px', borderRadius: '8px', border: 'none', background: '#ef4444', color: '#fff', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation Modal */}
      {deleteBulkConfirm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)' }}
          onClick={() => setDeleteBulkConfirm(null)}>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '28px 28px 24px', width: '420px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', marginBottom: '20px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>
              <div>
                <div style={{ fontSize: '16px', fontWeight: '700', color: '#111827', marginBottom: '4px' }}>Delete {deleteBulkConfirm.ids.length} Profiles</div>
                <div style={{ fontSize: '14px', color: '#6b7280', lineHeight: 1.5 }}>
                  <span style={{ fontWeight: '600', color: '#374151' }}>{deleteBulkConfirm.ids.length} selected profiles</span> and all their data will be permanently removed.
                  {deleteBulkConfirm.runningCount > 0 && (
                    <div style={{ marginTop: '6px', color: '#f59e0b', fontSize: '13px' }}>
                      ⚠ {deleteBulkConfirm.runningCount} running profile(s) will be stopped first.
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button onClick={() => setDeleteBulkConfirm(null)}
                style={{ padding: '8px 20px', borderRadius: '8px', border: '1px solid #d1d5db', background: '#fff', color: '#374151', fontSize: '14px', fontWeight: '500', cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={confirmDeleteBulk}
                style={{ padding: '8px 20px', borderRadius: '8px', border: 'none', background: '#ef4444', color: '#fff', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

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
