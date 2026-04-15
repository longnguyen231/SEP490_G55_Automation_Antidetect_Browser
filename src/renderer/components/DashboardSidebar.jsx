import React, { useState } from 'react';
import { Offcanvas } from 'react-bootstrap';
import { Menu, X } from 'lucide-react';
import { useI18n } from '../i18n/index';
import { getLicenseRequestUrl } from '../config/app.config';

export default function DashboardSidebar({
    activeNav,
    onNavigate,
    onCreateProfile,
    apiStatus = {},
    licenseInfo = { tier: 'free', maxProfiles: 5, valid: false },
    profileCount = 0,
    onUpgrade,
}) {
    const [mobileOpen, setMobileOpen] = useState(false);


    const NAVIGATION_ITEMS = [
        { id: 'profiles', label: 'Profiles' },
        { id: 'proxies', label: 'Proxies' },
        { id: 'scripts', label: 'Scripts' },
        { id: 'logs', label: 'Logs' },
        { id: 'settings', label: 'Settings' },
    ];

    const renderNav = (closeMobile) => (
        <>
            {/* Brand */}
            <div className="sidebar-brand pb-6 pt-2 px-2 border-b-0 mb-2 mt-2">
                <div className="flex flex-col gap-1">
                    <h2 className="text-[1.2rem] font-bold text-[var(--fg)] tracking-tight leading-none">HL-MCK Browser</h2>
                    <span className="text-[0.75rem] text-[var(--muted)] font-medium">Antidetect Manager</span>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex flex-col gap-1 px-1">
                {NAVIGATION_ITEMS.map((item) => (
                    <div
                        key={item.id}
                        className={`sidebar-nav-item py-2.5 px-4 rounded-lg cursor-pointer transition-colors ${activeNav === item.id ? 'active' : ''}`}
                        onClick={() => { onNavigate(item.id); closeMobile && closeMobile(); }}
                        role="button"
                        tabIndex={0}
                    >
                        {item.label}
                    </div>
                ))}
            </nav>

            {/* License Upgrade Banner - Show only for Free tier */}
            {licenseInfo?.tier === 'free' && (
                <div className="mx-2 mt-4 mb-2 p-4 rounded-xl bg-gradient-to-br from-[var(--primary)]/10 to-[var(--primary)]/5 border border-[var(--primary)]/20">
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-bold text-[var(--primary)] uppercase tracking-wider">FREE PLAN</p>
                        <span className="text-xs font-semibold text-[var(--muted)]">
                            {profileCount}/{licenseInfo.maxProfiles}
                        </span>
                    </div>
                    <p className="text-xs text-[var(--muted)] mb-3 leading-relaxed">
                        Upgrade to <strong className="text-[var(--fg)]">PRO</strong> for unlimited profiles, automation & API access
                    </p>
                    <button 
                        onClick={async () => { 
                            // Open web admin pricing page in browser
                            const url = getLicenseRequestUrl('pro');
                            if (window.electronAPI?.openExternal) {
                                await window.electronAPI.openExternal(url);
                            } else {
                                window.open(url, '_blank');
                            }
                            closeMobile && closeMobile(); 
                        }}
                        className="w-full bg-[var(--primary)] hover:brightness-110 text-white text-sm font-semibold py-2 px-3 rounded-lg transition shadow-sm cursor-pointer"
                    >
                        🚀 Get Pro License
                    </button>
                    <button 
                        onClick={() => { 
                            onUpgrade?.(); 
                            closeMobile && closeMobile(); 
                        }}
                        className="w-full bg-transparent hover:bg-[var(--glass)] text-[var(--primary)] text-xs font-medium py-2 px-3 rounded-lg transition mt-2 border border-[var(--primary)]/30 cursor-pointer"
                    >
                        📋 I have a license key
                    </button>
                </div>
            )}

            {/* Pro tier badge - Show checkmark for activated users */}
            {licenseInfo?.tier === 'pro' && licenseInfo?.valid && (
                <div className="mx-2 mt-4 mb-2 p-3 rounded-xl bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border border-emerald-500/20">
                    <div className="flex items-center gap-2">
                        <span className="text-lg">✅</span>
                        <div className="flex-1">
                            <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">PRO LICENSE</p>
                            <p className="text-xs text-[var(--muted)] mt-0.5">
                                {licenseInfo.maxProfiles === -1 ? '∞ Unlimited' : licenseInfo.maxProfiles} profiles
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </>
    );

    return (
        <>
            {/* Desktop sidebar */}
            <aside className="app-sidebar w-[240px]">
                {renderNav(null)}
            </aside>

            {/* Mobile menu button */}
            <button className="mobile-menu-btn fixed top-3 left-3 z-[200] md:hidden p-2 rounded bg-[var(--card)] shadow" onClick={() => setMobileOpen(true)}>
                <Menu size={22} className="text-[var(--fg)]" />
            </button>

            {/* Mobile offcanvas */}
            <Offcanvas show={mobileOpen} onHide={() => setMobileOpen(false)} placement="start"
                style={{ width: 280, background: 'white', color: '#1e293b' }}>
                <Offcanvas.Header>
                    <button className="p-2 border-0 bg-transparent hover:bg-slate-100 rounded" onClick={() => setMobileOpen(false)}>
                        <X size={20} className="text-slate-800" />
                    </button>
                </Offcanvas.Header>
                <Offcanvas.Body style={{ display: 'flex', flexDirection: 'column', padding: '0 0.75rem 1rem' }}>
                    {renderNav(() => setMobileOpen(false))}
                </Offcanvas.Body>
            </Offcanvas>
        </>
    );
}
