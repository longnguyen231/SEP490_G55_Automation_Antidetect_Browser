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

    // Hardcode theme to light as per screenshot
    React.useEffect(() => {
        document.documentElement.setAttribute('data-theme', 'light');
    }, []);

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
                    <h2 className="text-[1.2rem] font-bold text-slate-800 tracking-tight leading-none">HL-MCK Browser</h2>
                    <span className="text-[0.75rem] text-slate-500 font-medium">Antidetect Manager</span>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex flex-col gap-1 px-1">
                {NAVIGATION_ITEMS.map((item) => (
                    <div
                        key={item.id}
                        className={`sidebar-nav-item py-2.5 px-4 rounded-lg cursor-pointer transition-colors ${activeNav === item.id ? 'active bg-[#2563eb] text-white font-medium' : 'text-slate-600 hover:bg-slate-100'}`}
                        onClick={() => { onNavigate(item.id); closeMobile && closeMobile(); }}
                        role="button"
                        tabIndex={0}
                    >
                        {item.label}
                    </div>
                ))}
            </nav>
        </>
    );

    return (
        <>
            {/* Desktop sidebar */}
            <aside className="app-sidebar bg-white w-[240px] border-r border-slate-200">
                {renderNav(null)}
            </aside>

            {/* Mobile menu button */}
            <button className="mobile-menu-btn fixed top-3 left-3 z-[200] md:hidden p-2 rounded bg-white shadow" onClick={() => setMobileOpen(true)}>
                <Menu size={22} className="text-slate-800" />
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
