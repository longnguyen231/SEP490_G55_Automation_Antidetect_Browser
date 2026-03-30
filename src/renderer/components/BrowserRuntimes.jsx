import React, { useState, useEffect } from 'react';
import { DownloadCloud, Trash2, RefreshCw, CheckCircle, AlertTriangle, AlertCircle, HardDrive } from 'lucide-react';
import './BrowserRuntimes.css';

export default function BrowserRuntimes() {
    const [browsers, setBrowsers] = useState({
        chromium: { status: 'loading', path: null, version: null, size: null },
        firefox: { status: 'loading', path: null, version: null, size: null }
    });
    
    const [installing, setInstalling] = useState({
        chromium: false,
        firefox: false
    });
    const [progressLogs, setProgressLogs] = useState({
        chromium: '',
        firefox: ''
    });

    useEffect(() => {
        loadBrowserStatus();
        
        let unsub = () => {};
        if (window.electronAPI && window.electronAPI.onBrowserProgress) {
            unsub = window.electronAPI.onBrowserProgress(({ browserName, log }) => {
                setProgressLogs(prev => ({ ...prev, [browserName]: log }));
            });
        }
        return () => {
             if (window.electronAPI && window.electronAPI.removeAllBrowserProgress) {
                 window.electronAPI.removeAllBrowserProgress();
             }
             if (unsub) unsub();
        };
    }, []);

    const loadBrowserStatus = async () => {
        if (!window.electronAPI || !window.electronAPI.checkBrowserStatus) return;
        try {
            const chromiumData = await window.electronAPI.checkBrowserStatus('chromium');
            const firefoxData = await window.electronAPI.checkBrowserStatus('firefox');
            setBrowsers({
                chromium: chromiumData,
                firefox: firefoxData
            });

            // Restore installing states
            setInstalling({
                chromium: !!chromiumData.isInstalling,
                firefox: !!firefoxData.isInstalling
            });
            setProgressLogs({
                chromium: chromiumData.lastLog || '',
                firefox: firefoxData.lastLog || ''
            });
        } catch (e) {
            console.error("Failed to load browser status", e);
        }
    };

    const handleInstall = async (name) => {
        setInstalling(prev => ({ ...prev, [name]: true }));
        setProgressLogs(prev => ({ ...prev, [name]: 'Starting download...' }));
        try {
            const res = await window.electronAPI.installBrowser(name);
            if (!res.success) {
                alert(`Failed to install ${name}:\n${res.error}`);
            }
        } catch (err) {
            alert(`Error installing ${name}: ${err.message}`);
        } finally {
            setInstalling(prev => ({ ...prev, [name]: false }));
            setProgressLogs(prev => ({ ...prev, [name]: '' }));
            await loadBrowserStatus();
        }
    };

    const handleReinstall = async (name) => {
        if (!window.confirm(`Are you sure you want to reinstall ${name}? This will delete the current data.`)) return;
        setInstalling(prev => ({ ...prev, [name]: true }));
        setProgressLogs(prev => ({ ...prev, [name]: 'Uninstalling old version...' }));
        try {
            const res = await window.electronAPI.reinstallBrowser(name);
            if (!res.success) {
                alert(`Failed to reinstall ${name}:\n${res.error}`);
            }
        } catch (err) {
            alert(`Error reinstalling ${name}: ${err.message}`);
        } finally {
            setInstalling(prev => ({ ...prev, [name]: false }));
            setProgressLogs(prev => ({ ...prev, [name]: '' }));
            await loadBrowserStatus();
        }
    };

    const handleUninstall = async (name) => {
        if (!window.confirm(`Are you sure you want to completely uninstall ${name}?`)) return;
        try {
            const res = await window.electronAPI.uninstallBrowser(name);
            if (!res.success) {
                alert(`Failed to uninstall ${name}:\n${res.error}`);
            }
            await loadBrowserStatus();
        } catch (err) {
            alert(`Error uninstalling ${name}: ${err.message}`);
        }
    };

    const renderCard = (name, title, iconClass, description) => {
        const info = browsers[name];
        const isInstalling = installing[name];
        const log = progressLogs[name];

        let statusBadge = null;
        if (info.status === 'loading') {
            statusBadge = <span className="badge bg-secondary">Checking...</span>;
        } else if (info.status === 'installed') {
            statusBadge = <span className="badge bg-success"><CheckCircle size={14} className="me-1" /> Installed</span>;
        } else if (info.status === 'broken') {
            statusBadge = <span className="badge bg-warning text-dark"><AlertTriangle size={14} className="me-1" /> Broken Installation</span>;
        } else {
            statusBadge = <span className="badge bg-danger"><AlertCircle size={14} className="me-1" /> Not Installed</span>;
        }

        return (
            <div className="card browser-manager-card shadow-sm mb-4">
                <div className="card-body">
                    <div className="d-flex justify-content-between align-items-start mb-3">
                        <div className="d-flex align-items-center gap-3">
                            <div className={`browser-icon-container ${iconClass}`}>
                                {name === 'chromium' ? (
                                    <svg viewBox="0 0 24 24" width="32" height="32" fill="currentColor">
                                        <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,6.46C15.06,6.46 17.54,8.94 17.54,12C17.54,15.06 15.06,17.54 12,17.54C8.94,17.54 6.46,15.06 6.46,12C6.46,8.94 8.94,6.46 12,6.46Z" />
                                    </svg>
                                ) : (
                                    <svg viewBox="0 0 24 24" width="32" height="32" fill="currentColor">
                                        <path d="M12,2A10,10 0 0,0 2,12C2,17.5 6.5,22 12,22C17.5,22 22,17.5 22,12C22,6.5 17.5,2 12,2M16.5,18.25C15.1,19.34 13.5,20 12,20C7.58,20 4,16.42 4,12C4,9.2 5.42,6.72 7.5,5.25C7.2,6.33 7.25,7.75 8,9C8.95,10.6 11,11 11.5,13C11.95,14.77 10.5,16.5 10.5,16.5C10.5,16.5 13.5,17 15,14.5C15.39,13.82 15.5,12.91 15.2,12C14.75,10.64 13.25,9.5 12,9.5C10.75,9.5 9.75,10.14 9.38,11.25C9.38,11.25 10,10.5 11.5,10.5C12.5,10.5 13,11.5 13,12C13,12.5 12.38,13 11.5,13C10.6,13 9.75,12.5 9,11C8.25,9.5 8.35,7.25 9,5.75C10,5.27 11,5 12,5C15.86,5 19,8.14 19,12C19,14.4 18,16.63 16.5,18.25Z" />
                                    </svg>
                                )}
                            </div>
                            <div>
                                <h4 className="mb-1 text-bold d-flex align-items-center gap-2">
                                    {title} {statusBadge}
                                </h4>
                                <p className="text-muted mb-0 small">{description}</p>
                            </div>
                        </div>
                        <div className="btn-group">
                            {(info.status === 'missing' || info.status === 'broken') && !isInstalling && (
                                <button className="btn btn-primary btn-sm d-flex align-items-center gap-1" onClick={() => handleInstall(name)}>
                                    <DownloadCloud size={16} /> Install
                                </button>
                            )}
                            {info.status === 'installed' && !isInstalling && (
                                <>
                                    <button className="btn btn-outline-primary btn-sm d-flex align-items-center gap-1" onClick={() => handleReinstall(name)}>
                                        <RefreshCw size={16} /> Reinstall
                                    </button>
                                    <button className="btn btn-outline-danger btn-sm d-flex align-items-center gap-1" onClick={() => handleUninstall(name)}>
                                        <Trash2 size={16} /> Uninstall
                                    </button>
                                </>
                            )}
                            {info.status === 'broken' && !isInstalling && (
                                <button className="btn btn-outline-danger btn-sm d-flex align-items-center gap-1" onClick={() => handleUninstall(name)}>
                                    <Trash2 size={16} /> Delete Leftovers
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="mt-3 bg-light p-3 rounded-3 border">
                        <div className="row gc-2 gy-2">
                            <div className="col-md-12 text-truncate">
                                <span className="text-secondary small fw-bold">Executable Path:</span><br/>
                                <code className="bg-white px-2 py-1 rounded border user-select-all font-monospace mt-1 d-inline-block text-body" style={{fontSize: '0.8rem', wordBreak: 'break-all'}}>
                                    {info.path || 'Not setup'}
                                </code>
                            </div>
                            <div className="col-md-6 mt-3">
                                <span className="text-secondary small fw-bold">Runtime Version:</span><br/>
                                <span className="font-monospace fw-medium">{info.version || 'v----'}</span>
                            </div>
                            <div className="col-md-6 mt-3">
                                <span className="text-secondary small fw-bold"><HardDrive size={12} className="me-1 mb-1"/>Storage Size:</span><br/>
                                <span className="font-monospace fw-medium">{info.size || '0 MB'}</span>
                            </div>
                        </div>
                    </div>

                    {isInstalling && (
                        <div className="mt-3 p-3 bg-white border border-primary rounded border-opacity-50">
                            <h6 className="text-primary mb-2 d-flex align-items-center gap-2">
                                <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                                Downloading & Extracting {title}...
                            </h6>
                            <div className="progress mb-2" style={{ height: '8px' }}>
                                <div className="progress-bar progress-bar-striped progress-bar-animated bg-primary" role="progressbar" style={{ width: '100%' }}></div>
                            </div>
                            <div className="small font-monospace text-muted text-truncate" style={{maxHeight: '40px', overflow: 'hidden'}}>
                                {log || 'Initializing...'}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="browser-manager-page w-[100%]">
            <h3 className="text-[0.85rem] font-bold text-[var(--fg)] mb-2 mt-4">Browser Runtimes Engine</h3>
            
            <div className="row gc-2">
                <div className="col-12">
                    {renderCard('chromium', 'Playwright Chromium', 'text-emerald-500', 'High-performance engine built on Chrome architecture. Recommended for 90% of profiles.')}
                    {renderCard('firefox', 'Playwright Firefox', 'text-amber-500', 'Isolated Mozilla engine. Excellent for deeply obfuscating hardware fingerprints.')}
                </div>
            </div>
        </div>
    );
}
