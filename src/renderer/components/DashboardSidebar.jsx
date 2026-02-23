import React, { useState } from 'react';
import { Offcanvas } from 'react-bootstrap';
import {
    Menu, X, Globe, Settings, Plus, FileCode
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

    const NAVIGATION_ITEMS = [
        { id: 'profiles', labelKey: 'nav.profiles', icon: <Globe size={18} /> },
        { id: 'scripts', labelKey: 'nav.scripts', icon: <FileCode size={18} /> },
        { id: 'settings', labelKey: 'nav.settings', icon: <Settings size={18} /> },
    ];

    const renderNav = (closeMobile) => (
        <>
            {/* Brand */}
            <div className="sidebar-brand">
                <div className="sidebar-logo">OBT</div>
                <div className="sidebar-brand-text">
                    <h2>OBT Browser</h2>
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
                {/* Language toggle button */}
                <button
                    className="btn sidebar-lang-btn"
                    onClick={() => setLang(lang === 'vi' ? 'en' : 'vi')}
                    title={lang === 'vi' ? 'Switch to English' : 'Chuyển sang Tiếng Việt'}
                >
                    {lang === 'vi' ? '🇻🇳 VI' : '🇬🇧 EN'}
                </button>

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
