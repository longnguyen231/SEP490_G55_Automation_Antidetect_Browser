import React, { useState } from 'react';
import { Offcanvas } from 'react-bootstrap';
import {
    Menu, X, Globe, Settings, Plus, FileCode, Sun, Moon
} from 'lucide-react';
import { useI18n } from '../i18n/index';

export default function DashboardSidebar({
    activeNav,
    onNavigate,
    onCreateProfile,
    apiStatus = {},
}) {
    const { t, lang, setLang } = useI18n();
    const [mobileOpen, setMobileOpen] = useState(false);

    // Theme state — persist in localStorage, apply on <html>
    const [theme, setTheme] = useState(() => {
        return localStorage.getItem('app-theme') || 'dark';
    });

    const toggleTheme = () => {
        setTheme(prev => {
            const next = prev === 'dark' ? 'light' : 'dark';
            localStorage.setItem('app-theme', next);
            document.documentElement.setAttribute('data-theme', next);
            return next;
        });
    };

    // Apply theme on mount
    React.useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
    }, []);

    const NAVIGATION_ITEMS = [
        { id: 'profiles', labelKey: 'nav.profiles', icon: <Globe size={18} /> },
        { id: 'scripts', labelKey: 'nav.scripts', icon: <FileCode size={18} /> },
        { id: 'settings', labelKey: 'nav.settings', icon: <Settings size={18} /> },
    ];

    const renderNav = (closeMobile) => (
        <>
            {/* Brand */}
            <div className="sidebar-brand">
                <div className="sidebar-logo">HL-MCK</div>
                <div className="sidebar-brand-text">
                    <h2>HL-MCK Browser</h2>
                    <span>v1.0.0</span>
                </div>
            </div>

            {/* Navigation */}
            <div className="sidebar-section-label">{t('nav.navigation')}</div>
            <nav className="sidebar-nav">
                {NAVIGATION_ITEMS.map((item) => (
                    <div
                        key={item.id}
                        className={`sidebar-nav-item ${activeNav === item.id ? 'active' : ''}`}
                        onClick={() => { onNavigate(item.id); closeMobile && closeMobile(); }}
                        role="button"
                        tabIndex={0}
                    >
                        <span className="nav-icon">{item.icon}</span>
                        {t(item.labelKey)}
                    </div>
                ))}
            </nav>

            {/* Bottom CTA + Info */}
            <div className="sidebar-cta">
                {/* Language toggle switch */}
                <div className="sidebar-toggle-row">
                    <span className="sidebar-toggle-label">
                        <Globe size={14} /> {t('nav.language') || 'Language'}
                    </span>
                    <div
                        className={`toggle-switch ${lang === 'en' ? 'on' : ''}`}
                        onClick={() => setLang(lang === 'vi' ? 'en' : 'vi')}
                        role="button"
                        tabIndex={0}
                        title={lang === 'vi' ? 'Switch to English' : 'Chuyển sang Tiếng Việt'}
                    >
                        <span className="toggle-label-left">VI</span>
                        <span className="toggle-label-right">EN</span>
                        <span className="toggle-knob" />
                    </div>
                </div>

                {/* Theme toggle switch */}
                <div className="sidebar-toggle-row">
                    <span className="sidebar-toggle-label">
                        {theme === 'dark' ? <Moon size={14} /> : <Sun size={14} />}
                        {' '}{t('nav.theme') || 'Theme'}
                    </span>
                    <div
                        className={`toggle-switch ${theme === 'light' ? 'on' : ''}`}
                        onClick={toggleTheme}
                        role="button"
                        tabIndex={0}
                        title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                    >
                        <span className="toggle-label-left"><Moon size={11} /></span>
                        <span className="toggle-label-right"><Sun size={11} /></span>
                        <span className="toggle-knob" />
                    </div>
                </div>

                {/* New Profile button */}
                <button className="btn btn-accent" style={{ width: '100%' }} onClick={() => { onCreateProfile(); closeMobile && closeMobile(); }}>
                    <Plus size={16} /> {t('actions.create')}
                </button>

                {/* API Status */}
                <div className="sidebar-api-status">
                    <div>
                        <span
                            className="sidebar-api-dot"
                            style={{ background: apiStatus.running ? '#28c76f' : (apiStatus.error ? '#ff4d4f' : '#555') }}
                        />
                        {apiStatus.running
                            ? `${t('api.status.running')} · ${apiStatus.host || '127.0.0.1'}:${apiStatus.port || 5478}`
                            : (apiStatus.error ? t('api.status.error') : t('api.status.stopped'))
                        }
                    </div>
                </div>
            </div>
        </>
    );

    return (
        <>
            {/* Desktop sidebar */}
            <aside className="app-sidebar">
                {renderNav(null)}
            </aside>

            {/* Mobile menu button */}
            <button className="mobile-menu-btn" onClick={() => setMobileOpen(true)}>
                <Menu size={22} />
            </button>

            {/* Mobile offcanvas */}
            <Offcanvas show={mobileOpen} onHide={() => setMobileOpen(false)} placement="start"
                style={{ width: 280, background: 'var(--card)', color: 'var(--fg)' }}>
                <Offcanvas.Header>
                    <button className="btn btn-icon" onClick={() => setMobileOpen(false)}>
                        <X size={20} />
                    </button>
                </Offcanvas.Header>
                <Offcanvas.Body style={{ display: 'flex', flexDirection: 'column', padding: '0 0.75rem 1rem' }}>
                    {renderNav(() => setMobileOpen(false))}
                </Offcanvas.Body>
            </Offcanvas>
        </>
    );
}
