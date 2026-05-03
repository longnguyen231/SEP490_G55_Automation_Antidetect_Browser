import React, { useState } from 'react';
import { Offcanvas } from 'react-bootstrap';
import { Menu, X } from 'lucide-react';
import { useI18n } from '../i18n/index';

export default function DashboardSidebar({
    activeNav,
    onNavigate,
    onCreateProfile,
    apiStatus = {},
}) {
    const [mobileOpen, setMobileOpen] = useState(false);


    const NAVIGATION_ITEMS = [
        {
            id: 'profiles', label: 'Profiles',
            icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
        },
        {
            id: 'proxies', label: 'Proxies',
            icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>,
        },
        {
            id: 'scripts', label: 'Scripts',
            icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>,
        },
        {
            id: 'logs', label: 'Logs',
            icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
        },
        {
            id: 'settings', label: 'Settings',
            icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
        },
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
                        <span className="nav-icon">{item.icon}</span>
                        {item.label}
                    </div>
                ))}
            </nav>
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
