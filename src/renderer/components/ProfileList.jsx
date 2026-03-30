import React from 'react';

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
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ea580c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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

export default function ProfileList({
  profiles, onCreateProfile, onEditProfile, onDeleteProfile, onToggleProfile,
  onLaunchHeadless, onManageCookies, runningWs = {}, onCopyWs, onStopProfile, onViewLogs,
  selectedIds = {}, onToggleSelect, onSelectAll, onClearSelection,
  onStartSelected, onStopSelected, onCloneProfile,
  headlessPrefs = {}, onSetHeadless, enginePrefs = {}, onSetEngine, onDeleteSelected,
  errorProfiles = {}
}) {
  const shortId = (id) => (id || '').substring(0, 6);

  const getOsLabel = (p) => {
    const os = p?.fingerprint?.os || 'Windows';
    if (os === 'Windows') return { label: 'WIN32', icon: null };
    if (os === 'macOS') return { label: 'MACINTEL', icon: <AppleIcon /> };
    return { label: 'LINUX', icon: null };
  };

  return (
    <div className="w-full h-full flex flex-col p-4">
      {/* Header Area */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-[1.2rem] font-bold text-[var(--fg)]">Profiles</h1>
        <button 
          className="btn btn-success text-[0.75rem] px-3 py-1.5"
          onClick={onCreateProfile}
        >
          + New Profile
        </button>
      </div>

      {/* Profiles Container */}
      <div className="bg-transparent rounded-lg flex flex-col gap-3 overflow-y-auto w-full flex-1">
        {(!profiles || profiles.length === 0) ? (
          <div className="card flex justify-center items-center py-10">
            <p className="text-[var(--muted)]">No profiles yet. Click <strong>+ New Profile</strong> to create one.</p>
          </div>
        ) : (
          profiles.map(profile => {
            const isRunning = !!runningWs[profile.id];
            const hasError = !!errorProfiles[profile.id] && !isRunning;
            const osInfo = getOsLabel(profile);
            const browser = profile?.fingerprint?.browser || 'Chromium';
            const res = profile?.fingerprint?.screenResolution || '1920x1080';

            return (
              <div key={profile.id} className="card p-2 xl:p-3 flex items-start gap-3 transition-shadow hover:brightness-110">
                
                {/* Active Dot indicator */}
                <div className="pt-[14px] pl-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${isRunning ? 'bg-[#10b981] shadow-[0_0_8px_rgba(16,185,129,0.5)]' : hasError ? 'bg-[#ef4444]' : 'bg-[var(--border2)]'}`}></div>
                </div>

                {/* Card Content Area - Taking most space */}
                <div className="flex-1 flex flex-col gap-2 ml-1">
                  
                  {/* Top Row: Details */}
                  <div className="flex flex-wrap items-center gap-2 xl:gap-3">
                    <span className="bg-[var(--glass-strong)] text-[var(--muted)] text-[0.75rem] font-bold px-2 py-0.5 rounded align-middle uppercase cursor-help" title={profile.id}>
                      {shortId(profile.id)}
                    </span>
                    
                    <div className="bg-[var(--glass)] text-[var(--primary)] px-2 py-0.5 rounded flex items-center gap-1.5 text-[0.75rem] font-semibold">
                      {browser === 'Firefox' ? <FoxIcon /> : <ChromiumIcon />}
                      {browser}
                    </div>
                    
                    <h3 className="text-[0.9rem] xl:text-[1rem] font-semibold text-[var(--fg)] leading-none truncate max-w-[250px] xl:max-w-md" title={profile.name || 'Profile'}>
                      {profile.name || 'Profile'}
                    </h3>
                  </div>

                  {/* Middle Row: OS and Screen Specs */}
                  <div className="flex flex-wrap items-center gap-2 pl-[2px] xl:pl-[4px]">
                    <div className="flex items-center gap-1.5 text-[0.75rem] font-bold text-[var(--muted)] border border-[var(--border2)] rounded px-1.5 py-0.5 bg-[var(--bg)]">
                      {osInfo.icon && <span className={osInfo.label === 'MACINTEL' ? "text-red-500" : ""}>{osInfo.icon}</span>}
                      {osInfo.label}
                    </div>
                    
                    <div className="flex items-center gap-1.5 text-[0.75rem] font-bold text-[var(--muted)] border border-[var(--border2)] rounded px-1.5 py-0.5 bg-[var(--bg)]">
                      {browser === 'Firefox' ? <FoxIcon /> : <ChromiumIcon />}
                      {browser}
                    </div>

                    <div className="flex items-center gap-1.5 text-[0.75rem] font-bold text-[var(--muted)] border border-[var(--border2)] rounded px-1.5 py-0.5 bg-[var(--bg)]">
                      <div className="text-[var(--muted)]"><MonitorIcon /></div>
                      {res}
                    </div>
                  </div>

                  {/* Bottom Row: Badges */}
                  <div className="flex flex-wrap items-center gap-1 xl:gap-1.5 pl-[2px] xl:pl-[4px]">
                    {['ID', 'DSP', 'HW', 'CVS', 'GL', 'AUD', 'MED', 'NET', 'BAT'].map(badge => (
                      <span key={badge} className="bg-[var(--glass-strong)] border border-[var(--border)] text-[var(--muted)] text-[7px] xl:text-[8px] font-bold px-1 xl:px-1.5 py-0.5 rounded uppercase">
                        {badge}
                      </span>
                    ))}
                  </div>
                  
                </div>

                {/* Right Side Actions Container - Flexed to right */}
                <div className="pt-2 flex flex-wrap items-center gap-1.5 xl:gap-2 self-start justify-end flex-shrink-0 max-w-[150px] sm:max-w-none">
                  {isRunning ? (
                    <button 
                      onClick={() => onStopProfile(profile.id)}
                      className="btn btn-danger text-[0.75rem] px-3 py-1.5"
                    >
                      Stop
                    </button>
                  ) : (
                    <>
                      <button 
                        onClick={() => onToggleProfile(profile.id)}
                        className="btn btn-success text-[0.75rem] px-3 py-1.5"
                      >
                        Launch
                      </button>
                      <button 
                        onClick={() => onLaunchHeadless(profile.id)}
                        className="btn btn-secondary text-[0.75rem] px-3 py-1.5"
                      >
                        Headless
                      </button>
                    </>
                  )}
                  <button 
                    onClick={() => onEditProfile(profile)}
                    className="btn btn-accent text-[0.75rem] px-3 py-1.5"
                  >
                    Proxy
                  </button>
                  <button 
                    onClick={() => onCloneProfile(profile.id)}
                    className="btn btn-primary text-[0.75rem] px-3 py-1.5"
                  >
                    Clone
                  </button>
                  <button 
                    onClick={() => onEditProfile(profile)}
                    className="btn btn-secondary text-[0.75rem] px-3 py-1.5"
                  >
                    Edit
                  </button>
                  <button 
                    onClick={() => onDeleteProfile(profile.id)}
                    className="btn btn-danger text-[0.75rem] px-3 py-1.5"
                  >
                    Delete
                  </button>
                </div>

              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
