import React, { useState, useEffect, useMemo } from 'react';
import { message, ConfigProvider, theme, Drawer, Descriptions, Tag, Popconfirm } from 'antd';
import ProfileEditDrawer from './ProfileEditDrawer';
import { collection, doc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuthStore } from '../../store/authStore';
import dayjs from 'dayjs';
import { LogOut, ArrowLeft, Shield, Search, X, Info, Settings2, Box, Fingerprint, Eye, Play } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import './ProfileList.css';

// SVG Icons from Desktop App
const ChromiumIcon = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="4" />
    <line x1="21.17" y1="8" x2="12" y2="8" />
    <line x1="3.95" y1="6.06" x2="8.54" y2="14" />
    <line x1="10.88" y1="21.94" x2="15.46" y2="14" />
  </svg>
);

const AppleIcon = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" stroke="none">
    <path d="M12 2.04C10.5 2.04 9 3.54 9 5c1.5 0 3-1.5 3-2.96zm1.2 19.33c-.71.55-1.55.84-3.2.84-1.65 0-2.49-.29-3.2-.84-2.1-1.65-4.8-6.15-4.8-10.35 0-3.3 2.1-5.1 4.5-5.1 1.2 0 2.4.6 3.3 1.2.9-.6 2.1-1.2 3.3-1.2 2.4 0 4.5 1.8 4.5 5.1 0 4.2-2.7 8.7-4.8 10.35z"/>
  </svg>
);

const FoxIcon = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#ea580c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 6s-2-2-5-2-4 2-4 2-2-2-4-2-5 2-5 2l1.6 4.8c0 0-1.6 3.2-1.6 6.4 0 3.2 2.4 4.8 4 4.8s4-2 6-2 4.4 2 6 2 4-1.6 4-4.8c0-3.2-1.6-6.4-1.6-6.4L22 6z"/>
  </svg>
);

const MonitorIcon = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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

export default function MyProfiles() {
  const { user, logout } = useAuthStore();
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Edit Drawer
  const [editDrawerVisible, setEditDrawerVisible] = useState(false);
  const [editingProfile, setEditingProfile] = useState(null);

  // Details Drawer
  const [detailsVisible, setDetailsVisible] = useState(false);
  const [detailsRecord, setDetailsRecord] = useState(null);
  const [launchingId, setLaunchingId] = useState(null); // profile being launched via web
  const navigate = useNavigate();

  // Search, Filter, Sort, Pagination
  const [searchQuery, setSearchQuery] = useState('');
  const [engineFilter, setEngineFilter] = useState('all');
  const [sortBy, setSortBy] = useState('created-desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedIds, setSelectedIds] = useState({});

  useEffect(() => {
    if (!user?.id) return;

    setLoading(true);
    const unsubscribe = onSnapshot(
      collection(db, `users/${user.id}/profiles`),
      (qSnap) => {
        const data = [];
        qSnap.forEach(docSnap => {
          data.push({ id: docSnap.id, ...docSnap.data() });
        });
        setProfiles(data);
        setLoading(false);
      },
      (err) => {
        console.error("Firestore Error:", err);
        message.error('Failed to load profiles');
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [user]);

  // Reset page on filter change
  useEffect(() => { setCurrentPage(1); }, [searchQuery, engineFilter, sortBy]);

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
    
    // Engine filter
    if (engineFilter !== 'all') {
      list = list.filter(p => {
        const eng = (p.settings?.engine || 'playwright').toLowerCase();
        if (engineFilter === 'chromium') return eng === 'playwright';
        if (engineFilter === 'firefox') return eng === 'playwright-firefox' || eng === 'firefox';
        if (engineFilter === 'camoufox') return eng === 'camoufox';
        if (engineFilter === 'cloakbrowser') return eng === 'cloakbrowser';
        return true;
      });
    }

    // Sort
    list = [...list].sort((a, b) => {
      switch (sortBy) {
        case 'name-asc': return (a.name || '').localeCompare(b.name || '');
        case 'name-desc': return (b.name || '').localeCompare(a.name || '');
        case 'created-asc': return (a.createdAt || 0) - (b.createdAt || 0);
        case 'created-desc': return (b.createdAt || 0) - (a.createdAt || 0);
        default: return 0;
      }
    });

    return list;
  }, [profiles, searchQuery, engineFilter, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredProfiles.length / pageSize));
  useEffect(() => { if (currentPage > totalPages) setCurrentPage(totalPages); }, [filteredProfiles.length, pageSize]);
  const paginatedProfiles = filteredProfiles.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const isFiltered = searchQuery || engineFilter !== 'all';
  const clearFilters = () => { setSearchQuery(''); setEngineFilter('all'); };

  // Bulk selection logic
  const selectedCount = Object.keys(selectedIds).filter(id => selectedIds[id]).length;
  
  const handleSelectAll = () => {
    const newSelected = {};
    profiles.forEach(p => newSelected[p.id] = true);
    setSelectedIds(newSelected);
  };
  
  const handleClearSelection = () => setSelectedIds({});
  
  const handleToggleSelect = (id) => {
    setSelectedIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleDeleteSelected = async () => {
    if (!window.confirm(`Are you sure you want to delete ${selectedCount} profiles? This action cannot be undone.`)) return;
    try {
      const idsToDelete = Object.keys(selectedIds).filter(id => selectedIds[id]);
      await Promise.all(idsToDelete.map(id => deleteDoc(doc(db, `users/${user.id}/profiles`, id))));
      message.success(`Deleted ${idsToDelete.length} profiles.`);
      setSelectedIds({});
    } catch (e) {
      message.error('Failed to delete some profiles.');
    }
  };


  const handleDelete = async (id) => {
    try {
      await deleteDoc(doc(db, `users/${user.id}/profiles`, id));
      message.success('Profile deleted!');
      if (selectedIds[id]) handleToggleSelect(id);
    } catch (err) {
      console.error(err);
      message.error('Failed to delete profile');
    }
  };

  const openEdit = (record) => {
    setEditingProfile(record);
    setEditDrawerVisible(true);
  };

  const openDetails = (record) => {
    setDetailsRecord(record);
    setDetailsVisible(true);
  };

  // Open profile in Desktop App:
  // 1. If on HTTP (local dev): try calling the local REST API first (app is running, port 4000)
  // 2. Fallback to deep link hlmck://launch/{profileId} (works in all environments)
  //    Note: Browsers block http://localhost calls from HTTPS pages (mixed-content), so
  //    on production (Vercel/HTTPS) we skip straight to the deep link.
  const handleOpenInApp = async (profile) => {
    setLaunchingId(profile.id);
    try {
      const isLocalHttp = window.location.protocol === 'http:';

      if (isLocalHttp) {
        // Attempt 1: Local REST API (only safe on HTTP, avoids mixed-content block on HTTPS)
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 2000);
        try {
          const res = await fetch(`http://localhost:4000/api/browsers/${profile.id}/launch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ headless: false }),
            signal: controller.signal,
          });
          clearTimeout(timer);
          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            const errMsg = errData.error || 'Profile này không thuộc về tài khoản đang đăng nhập trên App.';
            message.error(`Từ chối mở: ${errMsg}`);
            return;
          }
          message.success(`Đã mở "${profile.name}" trong Desktop App!`);
          return;
        } catch {
          clearTimeout(timer);
          // App not running or unreachable — fall through to deep link
        }
      }

      // Attempt 2: Deep Link hlmck://launch/{profileId}
      // Works whether app is open (focuses it) or closed (OS opens it).
      message.info('Đang mở Desktop App…');
      window.location.href = `hlmck://launch/${profile.id}`;
    } finally {
      setTimeout(() => setLaunchingId(null), 2500);
    }
  };

  const getEngineColor = (engine) => {
    switch (engine) {
      case 'camoufox': return 'purple';
      case 'playwright-firefox': return 'orange';
      case 'cloakbrowser': return 'cyan';
      default: return 'blue';
    }
  };

  const shortId = (id) => (id || '').substring(0, 6);

  const getOsInfo = (p) => {
    const os = p?.fingerprint?.os || 'Windows';
    if (os === 'Windows') return { label: 'Win', icon: <WindowsIcon /> };
    if (os === 'macOS') return { label: 'macOS', icon: <AppleIcon /> };
    return { label: 'Linux', icon: null };
  };

  return (
    <div className="min-h-screen bg-[#080a0c] text-white flex flex-col font-sans relative overflow-hidden">
      {/* Set CSS variables for ProfileList compatibility */}
      <style>{`
        :root {
          --fg: #f8fafc;
          --muted: #94a3b8;
          --card: rgba(18, 22, 27, 0.85);
          --card2: rgba(30, 41, 59, 0.4);
          --border: rgba(255, 255, 255, 0.1);
          --border2: rgba(255, 255, 255, 0.15);
          --primary: #3b82f6;
          --glass-strong: rgba(255, 255, 255, 0.05);
          --glass-hover: rgba(255, 255, 255, 0.1);
        }
        
        .premium-dark-modal .ant-modal-content { background: #161b22 !important; border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); }
        .premium-dark-modal .ant-modal-header { background: transparent !important; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 16px; }
        .premium-dark-modal .ant-btn-primary { background: #3b82f6; border: none; }
        .premium-dark-modal .ant-btn-primary:hover { background: #2563eb !important; }
        
        .premium-dark-drawer .ant-drawer-content { background: #080a0c !important; border-left: 1px solid rgba(255,255,255,0.05); }
        .premium-dark-drawer .ant-drawer-header { background: #12161b !important; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .premium-dark-drawer .ant-drawer-close { color: rgba(255,255,255,0.5) !important; }
        .premium-dark-drawer .ant-drawer-close:hover { color: white !important; }
        .premium-dark-drawer .ant-descriptions-title { color: white !important; margin-bottom: 12px; }
        
        .dark-descriptions .ant-descriptions-item-label { background: rgba(255,255,255,0.02) !important; color: rgba(255,255,255,0.6) !important; border-color: rgba(255,255,255,0.05) !important; width: 140px; }
        .dark-descriptions .ant-descriptions-item-content { background: transparent !important; color: white !important; border-color: rgba(255,255,255,0.05) !important; word-break: break-all; }
      `}</style>

      {/* Background Effects */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] bg-primary/20 blur-[120px] rounded-full pointer-events-none" />
      
      <header className="border-b border-white/5 bg-[#080a0c]/60 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <button 
              className="group flex items-center gap-2 px-4 py-1.5 mr-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-all duration-300 backdrop-blur-md cursor-pointer shadow-lg shadow-black/20"
              onClick={() => navigate('/')}
            >
              <div className="w-6 h-6 rounded-full bg-cyan-500/20 flex items-center justify-center group-hover:-translate-x-1 transition-transform">
                <ArrowLeft size={14} className="text-cyan-400" />
              </div>
              <span className="text-sm font-medium text-white/80 group-hover:text-white transition-colors">Home</span>
            </button>
            
            <div className="flex items-center gap-3 cursor-pointer group" onClick={() => navigate('/')}>
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary/30 to-primary/10 border border-primary/30 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Shield className="text-primary" size={20} />
              </div>
              <span className="font-bold text-lg tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-white to-white/70 hidden sm:inline-block">HL-MCK</span>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 text-sm text-white/50 bg-white/5 px-3 py-1.5 rounded-full border border-white/5">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              {user?.email}
            </div>
            <button className="text-white/50 hover:text-red-400 flex items-center gap-2 transition-colors" onClick={() => logout()}>
              <LogOut size={16} /> Sign out
            </button>
          </div>
        </div>
      </header>
      
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 mt-4 relative z-10 flex flex-col h-full overflow-hidden">
        
        {/* Header Stats */}
        <div className="mb-6 flex-shrink-0">
          <h1 className="text-3xl font-extrabold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-white to-white/50">
            Profile Dashboard
          </h1>
          <p className="text-white/40">Manage your synced browser profiles from the cloud.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6 flex-shrink-0">
          <div className="bg-gradient-to-br from-white/5 to-transparent p-4 rounded-2xl border border-white/5 backdrop-blur-sm">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-500/10 rounded-xl text-blue-400"><Box size={24} /></div>
              <div>
                <p className="text-white/40 text-sm font-medium">Total Profiles</p>
                <h3 className="text-3xl font-bold text-white">{profiles.length}</h3>
              </div>
            </div>
          </div>
          <div className="bg-gradient-to-br from-white/5 to-transparent p-4 rounded-2xl border border-white/5 backdrop-blur-sm">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-500/10 rounded-xl text-purple-400"><Fingerprint size={24} /></div>
              <div>
                <p className="text-white/40 text-sm font-medium">Active Sync</p>
                <h3 className="text-3xl font-bold text-white">Real-time</h3>
              </div>
            </div>
          </div>
        </div>

        {/* --- PROFILE LIST UI --- */}
        <div className="bg-[#12161b]/80 backdrop-blur-md p-6 rounded-2xl border border-white/5 shadow-2xl flex-1 flex flex-col overflow-hidden relative">
          {/* Toolbar */}
          {profiles.length > 0 && (
            <div className="pl-toolbar flex-shrink-0 mb-4">
              <label className="pl-select-all mr-2">
                <input
                  type="checkbox"
                  checked={selectedCount > 0 && selectedCount === profiles.length}
                  onChange={selectedCount > 0 ? handleClearSelection : handleSelectAll}
                />
                <span className="text-sm font-medium ml-2">{selectedCount > 0 ? `${selectedCount}` : 'All'}</span>
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
              
              <select className="pl-filter-select" value={engineFilter} onChange={e => setEngineFilter(e.target.value)}>
                <option value="all">All Engines</option>
                <option value="chromium">Chromium</option>
                <option value="firefox">Firefox</option>
                <option value="camoufox">Camoufox</option>
                <option value="cloakbrowser">CloakBrowser</option>
              </select>
              
              <select className="pl-filter-select" value={sortBy} onChange={e => setSortBy(e.target.value)}>
                <option value="created-desc">Newest first</option>
                <option value="created-asc">Oldest first</option>
                <option value="name-asc">Name A–Z</option>
                <option value="name-desc">Name Z–A</option>
              </select>
              
              {isFiltered && (
                <span className="pl-result-count ml-2">
                  {filteredProfiles.length} of {profiles.length}
                  {' '}<button className="pl-clear-filters ml-2" onClick={clearFilters}>Clear</button>
                </span>
              )}
            </div>
          )}

          {/* Cards List */}
          <div className="pl-cards flex-1 overflow-y-auto mb-2 pr-2 custom-scrollbar">
            {loading ? (
              <div className="pl-empty text-white/50">Loading profiles...</div>
            ) : profiles.length === 0 ? (
              <div className="pl-empty-state">
                <div className="pl-empty-icon"><Search size={32} className="text-white/30" /></div>
                <h3 className="text-white">No profiles yet</h3>
                <p className="text-white/40">You don't have any synced profiles in the cloud.</p>
              </div>
            ) : filteredProfiles.length === 0 ? (
              <div className="pl-empty text-white/50">
                No profiles match your filters. <button className="pl-clear-filters ml-2 text-cyan-400" onClick={clearFilters}>Clear filters</button>
              </div>
            ) : (
              paginatedProfiles.map(profile => {
                const osInfo = getOsInfo(profile);
                const browser = profile?.fingerprint?.browser || 'Chrome';
                const res = profile?.fingerprint?.screenResolution || '1920x1080';
                const engine = profile?.settings?.engine || 'playwright';
                const isFirefox = engine === 'playwright-firefox' || engine === 'firefox';
                const isCamoufox = engine === 'camoufox';
                const isCloakBrowser = engine === 'cloakbrowser';
                
                const hasProxy = profile?.settings?.proxy?.type && profile.settings.proxy.type !== 'none' && profile.settings.proxy.server;
                const proxyType = hasProxy ? profile.settings.proxy.type.toUpperCase() : '';
                const proxyServer = hasProxy ? profile.settings.proxy.server : '';

                return (
                  <div key={profile.id} className="pl-card bg-[#1a212c]/60 border border-white/5 hover:border-white/10">
                    <input
                      type="checkbox"
                      className="pl-checkbox"
                      checked={!!selectedIds[profile.id]}
                      onChange={() => handleToggleSelect(profile.id)}
                    />
                    
                    <div className="pl-dot" style={{ background: 'rgba(255,255,255,0.2)' }} />

                    <div style={{
                      width: '30px', height: '30px', borderRadius: '7px', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: isCamoufox ? 'rgba(168,85,247,0.3)' : isCloakBrowser ? 'rgba(6,182,212,0.3)' : isFirefox ? 'rgba(234,88,12,0.3)' : 'rgba(37,99,235,0.3)',
                      color: isCamoufox ? '#c084fc' : isCloakBrowser ? '#22d3ee' : isFirefox ? '#fb923c' : '#60a5fa',
                      fontWeight: 700, fontSize: '0.82rem'
                    }}>
                      P
                    </div>

                    <div className="pl-info">
                      <div className="pl-name-row">
                        <span className="pl-name text-white">{profile.name || 'Profile'}</span>
                        
                        <span
                          title="Click to copy profile ID"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigator.clipboard.writeText(profile.id || '');
                          }}
                          className="text-[0.6rem] text-white/40 font-mono bg-white/5 border border-white/10 rounded px-1 cursor-pointer flex items-center gap-1 hover:text-white hover:bg-white/10"
                        >
                          <span>{shortId(profile.id)}</span>
                        </span>

                        <span style={{
                          display: 'inline-flex', alignItems: 'center',
                          padding: '1px 5px', borderRadius: '3px', fontSize: '0.6rem', fontWeight: 700,
                          background: isCamoufox ? 'rgba(168,85,247,0.1)' : isCloakBrowser ? 'rgba(6,182,212,0.1)' : isFirefox ? 'rgba(234,88,12,0.1)' : 'rgba(37,99,235,0.1)',
                          color: isCamoufox ? '#c084fc' : isCloakBrowser ? '#22d3ee' : isFirefox ? '#fb923c' : '#60a5fa',
                          border: `1px solid ${isCamoufox ? 'rgba(168,85,247,0.2)' : isCloakBrowser ? 'rgba(6,182,212,0.2)' : isFirefox ? 'rgba(234,88,12,0.2)' : 'rgba(37,99,235,0.2)'}`,
                        }}>
                          {isCamoufox ? 'CF' : isCloakBrowser ? 'CB' : isFirefox ? 'FF' : 'CR'}
                        </span>

                        <span className="pl-tag bg-white/5 border-white/10 text-white/80">
                          {osInfo.icon && <span className="pl-tag-icon">{osInfo.icon}</span>}
                          {osInfo.label}
                        </span>
                        <span className="pl-tag bg-white/5 border-white/10 text-white/80">
                          <span className="pl-tag-icon">{(isFirefox || isCamoufox) ? <FoxIcon /> : <ChromiumIcon />}</span>
                          {browser}
                        </span>
                        <span className="pl-tag bg-white/5 border-white/10 text-white/80">
                          <span className="pl-tag-icon"><MonitorIcon /></span>
                          {res}
                        </span>
                      </div>

                      {hasProxy && (
                        <div style={{ marginBottom: '4px' }}>
                          <span className="pl-tag bg-indigo-500/10 border-indigo-500/20 text-white">
                            <span className="pl-tag-icon"><LinkIcon /></span>
                            <span className="text-indigo-400 font-bold">{proxyType}</span>
                            <span className="text-white/50 ml-1">{proxyServer}</span>
                          </span>
                        </div>
                      )}

                      <div style={{ display: 'flex', gap: '2px', flexWrap: 'wrap', marginTop: '4px' }}>
                        {BADGE_MAP.map(({ key, label, section }) => {
                          const isEnabled = !!profile?.settings?.[section]?.enabled;
                          return (
                            <span
                              key={key}
                              className={`pl-fp-badge cursor-default ${isEnabled ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-white/5 border-white/10 text-white/30'}`}
                            >
                              {label}
                            </span>
                          );
                        })}
                      </div>
                    </div>

                    <div className="pl-actions flex gap-2">
                      {/* Open in App */}
                      <button
                        title="Open in Desktop App"
                        onClick={() => handleOpenInApp(profile)}
                        disabled={launchingId === profile.id}
                        className="w-[28px] h-[28px] border border-emerald-500/30 rounded-md bg-emerald-500/10 cursor-pointer flex items-center justify-center text-emerald-400 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
                      >
                        {launchingId === profile.id
                          ? <span className="w-3 h-3 border-2 border-emerald-400/40 border-t-emerald-400 rounded-full animate-spin" />
                          : <Play size={12} fill="currentColor" />}
                      </button>
                      <button
                        title="View Details"
                        onClick={() => openDetails(profile)}
                        className="w-[28px] h-[28px] border border-white/10 rounded-md bg-white/5 cursor-pointer flex items-center justify-center text-cyan-400 hover:bg-white/10 transition-colors"
                      >
                        <Eye size={14} />
                      </button>
                      <button
                        title="Edit Settings"
                        onClick={() => openEdit(profile)}
                        className="w-[28px] h-[28px] border border-white/10 rounded-md bg-white/5 cursor-pointer flex items-center justify-center text-amber-400 hover:bg-white/10 transition-colors"
                      >
                        <Settings2 size={14} />
                      </button>
                      
                      <Popconfirm 
                        title="Delete Profile?" 
                        onConfirm={() => handleDelete(profile.id)}
                        okText="Yes"
                        cancelText="No"
                        placement="topRight"
                      >
                        <button
                          title="Delete"
                          className="w-[28px] h-[28px] border border-red-500/20 rounded-md bg-red-500/5 cursor-pointer flex items-center justify-center text-red-400 hover:bg-red-500/20 transition-colors"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                        </button>
                      </Popconfirm>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Floating Bulk Action Bar */}
          {selectedCount > 0 && (
            <div className="absolute bottom-[70px] left-1/2 -translate-x-1/2 flex items-center gap-4 py-3 px-6 bg-[#161b22] border border-white/10 rounded-2xl shadow-2xl z-20">
              <span className="text-sm font-bold text-white">{selectedCount} selected</span>
              <button 
                className="px-4 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-semibold transition-colors shadow-lg shadow-red-500/20"
                onClick={handleDeleteSelected}
              >
                Delete ({selectedCount})
              </button>
              <button 
                className="px-4 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm font-semibold transition-colors"
                onClick={handleClearSelection}
              >
                Clear
              </button>
            </div>
          )}

          {/* Pagination */}
          {profiles.length > 0 && (
            <div className="pl-pagination pt-4 mt-auto border-t border-white/10">
              <div className="pl-pagination-info text-white/50">
                {filteredProfiles.length > 0
                  ? <>Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filteredProfiles.length)} of {filteredProfiles.length} profiles</>
                  : <>0 profiles</>}
              </div>
              <div className="pl-pagination-controls flex items-center gap-1">
                <select 
                  className="bg-[#1a212c] border border-white/10 text-white/80 rounded px-2 py-1 text-xs mr-2 outline-none focus:border-cyan-500" 
                  value={pageSize} 
                  onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                >
                  {[5, 10, 15, 20, 50].map(n => <option key={n} value={n}>{n} / page</option>)}
                </select>
                
                <button className="pl-pagination-btn bg-white/5 border-white/10 text-white disabled:opacity-30" disabled={currentPage <= 1} onClick={() => setCurrentPage(1)}>«</button>
                <button className="pl-pagination-btn bg-white/5 border-white/10 text-white disabled:opacity-30" disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)}>‹</button>
                
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                  .reduce((acc, p, i, arr) => {
                    if (i > 0 && p - arr[i - 1] > 1) acc.push('...');
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((p, i) =>
                    p === '...'
                      ? <span key={'dot' + i} className="text-white/50 px-1">…</span>
                      : <button key={p} className={`pl-pagination-btn border-white/10 ${p === currentPage ? 'bg-cyan-500 text-white border-cyan-500 font-bold' : 'bg-white/5 text-white/80'}`} onClick={() => setCurrentPage(p)}>{p}</button>
                  )}
                  
                <button className="pl-pagination-btn bg-white/5 border-white/10 text-white disabled:opacity-30" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)}>›</button>
                <button className="pl-pagination-btn bg-white/5 border-white/10 text-white disabled:opacity-30" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(totalPages)}>»</button>
              </div>
            </div>
          )}
        </div>
      </main>

      <ConfigProvider theme={{ algorithm: theme.darkAlgorithm }}>
        <ProfileEditDrawer
          visible={editDrawerVisible}
          profile={editingProfile}
          userId={user?.id}
          onClose={() => setEditDrawerVisible(false)}
          onSaved={() => { setEditDrawerVisible(false); message.success('Profile updated!'); }}
        />

        <Drawer
          title={<div className="flex items-center gap-2 text-white"><Info className="text-cyan-400" size={20} /> Profile Configuration Details</div>}
          placement="right"
          width={700}
          onClose={() => setDetailsVisible(false)}
          open={detailsVisible}
          className="premium-dark-drawer"
        >
          {detailsRecord && (
            <div className="space-y-6 pb-10">
              <div className="p-4 bg-white/5 rounded-xl border border-white/10 flex items-start justify-between">
                <div>
                  <h3 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
                    {detailsRecord.name}
                    <Tag color={getEngineColor(detailsRecord.settings?.engine)} className="ml-2 m-0 border-0">{detailsRecord.settings?.engine?.toUpperCase() || 'PLAYWRIGHT'}</Tag>
                  </h3>
                  <p className="text-white/40 text-xs font-mono">ID: {detailsRecord.id}</p>
                </div>
                <div className="text-right">
                  <div className="text-xs text-white/40 mb-1">Created At</div>
                  <div className="text-sm text-white/80">{dayjs(detailsRecord.createdAt).format('DD MMM YYYY, HH:mm')}</div>
                </div>
              </div>

              {detailsRecord.note && (
                <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                  <div className="text-xs text-blue-400 font-bold uppercase tracking-wider mb-1">Internal Note</div>
                  <div className="text-sm text-white/80 italic">{detailsRecord.note}</div>
                </div>
              )}

              <Descriptions title={<span className="text-white/80 font-bold border-b border-white/10 pb-1 flex w-full">Connectivity & Launch</span>} bordered column={2} size="small" className="dark-descriptions">
                <Descriptions.Item label="Proxy" span={2}>
                  {detailsRecord.settings?.proxy?.type && detailsRecord.settings.proxy.type !== 'none' ? (
                    <div className="flex flex-col">
                      <span className="text-green-400 font-bold">{detailsRecord.settings.proxy.type.toUpperCase()}</span>
                      <span className="font-mono text-white/80">{detailsRecord.settings.proxy.server}</span>
                      {detailsRecord.settings.proxy.username && <span className="text-xs text-white/40">Auth configured</span>}
                    </div>
                  ) : <span className="text-white/40">Direct Connection</span>}
                </Descriptions.Item>
                <Descriptions.Item label="Headless Mode">{detailsRecord.settings?.headless ? <span className="text-green-400">Enabled</span> : <span className="text-white/50">Disabled</span>}</Descriptions.Item>
                <Descriptions.Item label="WebRTC Mode"><span className="text-cyan-400">{detailsRecord.settings?.webrtc?.toUpperCase() || 'DEFAULT'}</span></Descriptions.Item>
              </Descriptions>

              <Descriptions title={<span className="text-white/80 font-bold border-b border-white/10 pb-1 flex w-full">Hardware Setup</span>} bordered column={2} size="small" className="dark-descriptions">
                <Descriptions.Item label="CPU Cores">{detailsRecord.settings?.cpuCores || 'Auto'}</Descriptions.Item>
                <Descriptions.Item label="Memory (RAM)">{detailsRecord.settings?.memoryGB ? `${detailsRecord.settings.memoryGB} GB` : 'Auto'}</Descriptions.Item>
                <Descriptions.Item label="Screen Resolution">{detailsRecord.fingerprint?.screenResolution || `${detailsRecord.settings?.windowWidth || 1920}x${detailsRecord.settings?.windowHeight || 1080}`}</Descriptions.Item>
                <Descriptions.Item label="Color Depth">{detailsRecord.fingerprint?.colorDepth || detailsRecord.settings?.display?.colorDepth || 24}-bit</Descriptions.Item>
                <Descriptions.Item label="Pixel Ratio">{detailsRecord.fingerprint?.pixelRatio || detailsRecord.settings?.display?.pixelRatio || 1}</Descriptions.Item>
                <Descriptions.Item label="Touch Support">{detailsRecord.fingerprint?.touchSupport ? 'Yes' : 'No'}</Descriptions.Item>
                <Descriptions.Item label="GPU Vendor" span={2}>{detailsRecord.settings?.gpuVendor || detailsRecord.settings?.hardware?.gpuVendor || 'Auto'}</Descriptions.Item>
                <Descriptions.Item label="GPU Renderer" span={2}>{detailsRecord.settings?.gpuRenderer || detailsRecord.settings?.hardware?.gpuRenderer || 'Auto'}</Descriptions.Item>
              </Descriptions>

              {detailsRecord.fingerprint && (
                <Descriptions title={<span className="text-white/80 font-bold border-b border-white/10 pb-1 flex w-full">Identity Fingerprint</span>} bordered column={1} size="small" className="dark-descriptions">
                  <Descriptions.Item label="Operating System">
                    <span className="font-bold text-white">{detailsRecord.fingerprint.os}</span> 
                    {detailsRecord.fingerprint.platform && <span className="text-white/50 ml-2">({detailsRecord.fingerprint.platform})</span>}
                  </Descriptions.Item>
                  <Descriptions.Item label="Browser">
                    <span className="font-bold text-white">{detailsRecord.fingerprint.browser}</span> v{detailsRecord.fingerprint.browserVersion}
                  </Descriptions.Item>
                  <Descriptions.Item label="User Agent">
                    <div className="bg-[#0a0c0f] p-2 rounded text-xs font-mono text-emerald-400 break-all border border-white/5">
                      {detailsRecord.fingerprint.userAgent}
                    </div>
                  </Descriptions.Item>
                  <Descriptions.Item label="Locale / Lang">{detailsRecord.fingerprint.language || 'Auto'} (Accept-Language: {detailsRecord.fingerprint.acceptLanguage || 'Default'})</Descriptions.Item>
                  <Descriptions.Item label="Timezone">{detailsRecord.fingerprint.timezone || 'Auto'}</Descriptions.Item>
                  <Descriptions.Item label="Connection Type">{detailsRecord.fingerprint.connectionType || 'Default'} {detailsRecord.fingerprint.connectionRtt ? `(${detailsRecord.fingerprint.connectionRtt}ms RTT, ${detailsRecord.fingerprint.connectionDownlink}Mbps)` : ''}</Descriptions.Item>
                  <Descriptions.Item label="Do Not Track (DNT)">{detailsRecord.fingerprint.doNotTrack ? 'Enabled (1)' : 'Disabled (0)'}</Descriptions.Item>
                </Descriptions>
              )}

              <Descriptions title={<span className="text-white/80 font-bold border-b border-white/10 pb-1 flex w-full">Spoofing Engines (Evasion)</span>} bordered column={2} size="small" className="dark-descriptions">
                {[
                  { key: 'canvas', label: 'Canvas Fingerprint' },
                  { key: 'webgl', label: 'WebGL Data' },
                  { key: 'audio', label: 'Audio Context' },
                  { key: 'media', label: 'Media Devices' },
                  { key: 'network', label: 'Network/WebRTC' },
                  { key: 'battery', label: 'Battery API' },
                  { key: 'fonts', label: 'System Fonts' },
                  { key: 'geolocation', label: 'Geolocation' }
                ].map(({ key, label }) => {
                  const setting = detailsRecord.settings?.[key];
                  const fp = detailsRecord.fingerprint;
                  let status = <span className="text-white/30">Off</span>;
                  let details = '';

                  if (setting?.enabled || (fp && fp[key])) {
                    status = <span className="text-emerald-400 font-bold">Spoofed</span>;
                    if (key === 'canvas') details = fp?.canvasNoiseIntensity ? `Noise Int: ${fp.canvasNoiseIntensity}` : 'Noise Mode';
                    else if (key === 'webgl') details = fp?.webglNoise ? `Noise Mode` : '';
                    else if (key === 'audio') details = fp?.audioSampleRate ? `${fp.audioSampleRate}Hz / ${fp.audioChannels}ch` : 'Noise Mode';
                    else if (key === 'media') details = `Custom Media Devices`;
                    else if (key === 'battery') details = `Level: 100%, Charging: Yes`;
                  } else {
                    status = <span className="text-amber-500 font-bold">Real (Leaked)</span>;
                  }

                  return (
                    <Descriptions.Item key={key} label={label}>
                      {status} {details && <span className="text-white/50 text-xs ml-1">({details})</span>}
                    </Descriptions.Item>
                  );
                })}
              </Descriptions>
            </div>
          )}
        </Drawer>
      </ConfigProvider>
    </div>
  );
}
