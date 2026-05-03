import React, { useState, useEffect } from 'react';
import { useI18n } from '../i18n/index';
import BrowserRuntimes from './BrowserRuntimes';
import { getCheckoutUrl } from '../config/app.config';
import AuditLogViewer from './AuditLogViewer';

export default function SettingsTab({
    apiStatus,
    apiDesiredPort,
    setApiDesiredPort,
    applyPortChange,
    handleToggleApiRun,
    handleRestartApi,
    theme,
    setTheme,
}) {
    const { t } = useI18n();
    const [licenseKey, setLicenseKey] = useState('');
    const [machineCode, setMachineCode] = useState('Loading...');
    const [licenseStatus, setLicenseStatus] = useState(() => !!localStorage.getItem('hl-license-activated'));
    const [licenseError, setLicenseError] = useState('');
    const [licenseLoading, setLicenseLoading] = useState(false);
    const [confirmDeactivate, setConfirmDeactivate] = useState(false);
    const [autoStartApi, setAutoStartApi] = useState(false);
    const [maxBrowsers, setMaxBrowsers] = useState(5);
    const [saveFeedback, setSaveFeedback] = useState(null); // 'ok' | 'err' | null

    useEffect(() => {
        window.electronAPI.getMachineCode()
            .then(code => setMachineCode(code || 'UNKNOWN'))
            .catch(console.error);
        // Load saved maxConcurrentBrowsers
        window.electronAPI.loadSettings?.()
            .then(res => {
                const val = res?.settings?.maxConcurrentBrowsers;
                if (val != null) setMaxBrowsers(Number(val));
            })
            .catch(() => {});
    }, []);

    const handleSaveSettings = async () => {
        try {
            await window.electronAPI.saveSettings({ maxConcurrentBrowsers: Math.max(1, parseInt(maxBrowsers, 10) || 5) });
            setSaveFeedback('ok');
        } catch {
            setSaveFeedback('err');
        } finally {
            setTimeout(() => setSaveFeedback(null), 2000);
        }
    };

    const handleActivateLicense = async () => {
        const key = licenseKey.trim();
        if (!key) { setLicenseError(t('license.error.empty', 'Please enter a license key.')); return; }
        setLicenseLoading(true);
        setLicenseError('');
        try {
            const result = await window.electronAPI.validateLicense(key);
            if (result?.valid) {
                localStorage.setItem('hl-license-activated', key);
                setLicenseStatus(true);
            } else {
                setLicenseError(t('license.error.invalid', 'Invalid license key for this machine.'));
            }
        } catch {
            setLicenseError(t('license.error.system', 'An error occurred. Please try again later.'));
        } finally {
            setLicenseLoading(false);
        }
    };

    const handleDeactivateLicense = async () => {
        if (window.electronAPI.deactivateLicense) {
            await window.electronAPI.deactivateLicense();
        }
        localStorage.removeItem('hl-license-activated');
        setLicenseStatus(false);
        setLicenseKey('');
        setConfirmDeactivate(false);
    };

    return (
        <div className="w-full h-full flex flex-col p-4 overflow-y-auto overflow-x-hidden">
            <div className="w-full max-w-[700px] min-w-0">
                <h1 className="text-2xl font-bold text-[var(--fg)] mb-6 tracking-tight">{t('settings.title') || 'Settings'}</h1>

                {/* Appearance */}
                <div className="card relative p-4 mb-6 mt-4">
                    <div className="absolute -top-3 left-4 bg-[var(--card)] px-2 text-[0.85rem] font-bold text-[var(--fg)]">Appearance</div>
                    <div className="mb-2 pt-1">
                        <label className="block text-[0.75rem] text-[var(--muted)] mb-1.5">Theme</label>
                        <select
                            value={theme}
                            onChange={(e) => setTheme(e.target.value)}
                            className="w-[160px] text-[0.75rem] py-1 cursor-pointer"
                        >
                            <option value="Light">Light</option>
                            <option value="Dark">Dark</option>
                        </select>
                        <p className="text-[0.7rem] text-[var(--muted)] mt-1">Current mode: {theme}</p>
                    </div>
                </div>

                {/* License */}
                <div className="card relative p-4 mb-6 mt-4">
                    <div className="absolute -top-3 left-4 bg-[var(--card)] px-2 text-[0.85rem] font-bold text-[var(--fg)]">License</div>
                    <div className="flex items-center gap-2 mb-3 pt-1">
                        <div className={`w-2 h-2 rounded-full ${licenseStatus ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                        <span className="text-[0.85rem] font-medium text-[var(--fg)]">
                            {licenseStatus ? t('license.status.licensed', 'Licensed ✔') : t('license.status.notLicensed', 'Not licensed')}
                        </span>
                    </div>
                    {licenseStatus ? (
                        <div>
                            <p className="text-[0.7rem] text-emerald-500 mb-3">{t('license.status.activated', 'Activated. Unlimited profiles.')}</p>
                            {confirmDeactivate ? (
                                <div className="flex items-center gap-3 mt-1">
                                    <span className="text-[0.72rem] text-[var(--fg)]">
                                        {t('license.deactivateConfirm', 'Your license key will be permanently lost. This action cannot be undone.')}
                                    </span>
                                    <button
                                        onClick={handleDeactivateLicense}
                                        className="text-[0.72rem] font-semibold text-white bg-red-500 hover:bg-red-600 px-2.5 py-1 rounded transition"
                                    >
                                        {t('license.deactivateConfirmYes', 'Yes, deactivate')}
                                    </button>
                                    <button
                                        onClick={() => setConfirmDeactivate(false)}
                                        className="text-[0.72rem] text-[var(--muted)] hover:text-[var(--fg)] transition"
                                    >
                                        {t('common.cancel', 'Cancel')}
                                    </button>
                                </div>
                            ) : (
                                <button
                                    onClick={() => setConfirmDeactivate(true)}
                                    className="text-[0.7rem] text-red-400 hover:underline"
                                >
                                    {t('license.deactivateBtn', 'Deactivate License')}
                                </button>
                            )}
                        </div>
                    ) : (
                        <>
                            <p className="text-[0.7rem] text-red-500 mb-1">{t('license.status.noKey', 'No license key configured')}</p>
                            <p className="text-[0.7rem] text-[var(--muted)] mb-3">{t('license.status.freePlan', 'Free plan: up to 5 profiles.')}</p>
                            <div className="flex gap-2 mb-1">
                                <input
                                    type="text"
                                    placeholder="HL-XXXX-XXXX-XXXX"
                                    value={licenseKey}
                                    onChange={e => { setLicenseKey(e.target.value); setLicenseError(''); }}
                                    onKeyDown={e => e.key === 'Enter' && handleActivateLicense()}
                                    disabled={licenseLoading}
                                    className="flex-1 text-[0.75rem] py-1.5"
                                />
                                <button
                                    onClick={handleActivateLicense}
                                    disabled={licenseLoading}
                                    className="btn btn-success px-3 py-1.5 text-[0.75rem] disabled:opacity-50"
                                >
                                    {licenseLoading ? t('license.checking', 'Checking...') : t('license.activateBtn', 'Activate')}
                                </button>
                            </div>
                            {licenseError && <p className="text-[0.7rem] text-red-400 mb-2">{licenseError}</p>}
                        </>
                    )}
                    <div className="mt-3">
                        <label className="block text-[0.7rem] text-[var(--muted)] mb-1">Machine Code</label>
                        <div className="flex items-center gap-2 mb-2">
                            <code className="bg-[var(--glass-strong)] border border-[var(--border2)] text-[var(--fg)] text-[0.7rem] px-2 py-1 rounded-md font-mono tracking-wider">{machineCode}</code>
                            <button onClick={() => navigator.clipboard.writeText(machineCode)} className="text-[0.7rem] text-[var(--primary)] hover:text-[var(--primary-hover)] font-medium px-1">Copy</button>
                        </div>
                        {!licenseStatus && (
                            <button
                                onClick={() => window.electronAPI.openExternal(getCheckoutUrl())}
                                className="w-full mt-1 flex items-center justify-center gap-2 bg-gradient-to-r from-[var(--primary)] to-purple-500 hover:brightness-110 text-white font-semibold text-[0.78rem] py-2 px-4 rounded-md transition"
                            >
                                ⚡ Upgrade to Pro →
                            </button>
                        )}
                    </div>
                </div>

                {/* REST API Server */}
                <div className="card border border-[var(--border)] rounded-md overflow-hidden mb-6 mt-4">
                    <div className="bg-[var(--card)] px-4 py-3 border-b border-[var(--border)]">
                        <h2 className="text-[0.85rem] font-bold text-[var(--fg)] uppercase tracking-wider">REST API SERVER</h2>
                    </div>
                    <div className="p-4">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <div className={`w-2.5 h-2.5 rounded-full ${apiStatus?.running ? 'bg-emerald-500' : 'bg-slate-400'}`}></div>
                                <span className="text-[0.95rem] font-medium text-[var(--fg)]">{apiStatus?.running ? 'Running' : 'Stopped'}</span>
                            </div>
                            {apiStatus?.running && (
                                <button
                                    onClick={() => window.electronAPI.openExternal(`http://localhost:${apiDesiredPort || 4000}/docs`)}
                                    className="text-[0.85rem] text-[var(--primary)] hover:underline flex items-center gap-1 font-medium"
                                >
                                    Swagger UI <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                                </button>
                            )}
                        </div>

                        {apiStatus?.running && (
                            <div className="mb-5">
                                <div className="bg-[var(--bg)] border border-[var(--border)] rounded-md px-3 py-2 text-[0.85rem] text-[var(--muted)] font-mono flex items-center">
                                    http://localhost:{apiDesiredPort || 4000}/docs
                                </div>
                            </div>
                        )}

                        <div className="flex flex-wrap items-center gap-3 mb-4">
                            <span className="text-[0.85rem] text-[var(--muted)]">Port</span>
                            <input
                                type="number"
                                min="1" max="65535"
                                value={apiDesiredPort || 4000}
                                onChange={e => { setApiDesiredPort(e.target.value); applyPortChange(Number(e.target.value)); }}
                                className="w-[80px] text-[0.85rem] py-1 px-2 rounded border border-[var(--border)] bg-[var(--bg)]"
                                disabled={apiStatus?.running}
                            />
                            <button
                                onClick={handleToggleApiRun}
                                className={`btn px-4 py-1.5 text-[0.85rem] font-medium ${apiStatus?.running ? 'btn-danger' : 'btn-success'}`}
                            >
                                {apiStatus?.running ? 'Stop' : 'Start Server'}
                            </button>
                        </div>

                        <label className="flex items-center gap-2 text-[0.85rem] text-[var(--fg)] mb-2 cursor-pointer">
                            <input 
                                type="checkbox" 
                                checked={autoStartApi} 
                                onChange={e => setAutoStartApi(e.target.checked)} 
                                className="rounded border-[var(--border)] w-4 h-4 cursor-pointer" 
                            />
                            Auto-start server on app launch
                        </label>
                        <p className="text-[0.8rem] text-[var(--muted)]">Exposes REST API for automation scripting. Swagger docs at /docs.</p>
                    </div>
                </div>

                {/* Playwright Engines Control */}
                <div className="mb-6 mt-4">
                    <BrowserRuntimes />
                </div>

                {/* Main Settings Root Options */}
                <div className="mb-4 ml-2">
                    <h3 className="text-[0.85rem] font-bold text-[var(--fg)] mb-2">Max concurrent browsers</h3>
                    <input
                        type="number"
                        value={maxBrowsers}
                        onChange={e => setMaxBrowsers(e.target.value)}
                        className="w-[80px] text-[0.75rem] py-1 mb-2"
                    />
                    <p className="text-[0.7rem] text-[var(--muted)] mb-4">Limits simultaneous browser instances. Higher = more RAM usage.</p>
                    <button className="btn btn-success px-4 py-1.5 text-[0.75rem]" onClick={handleSaveSettings}>
                        {saveFeedback === 'ok' ? '✓ Saved' : saveFeedback === 'err' ? '✗ Failed' : 'Save Settings'}
                    </button>
                </div>


                {/* Audit Log */}
                <div className="card relative p-4 mb-6 mt-4">
                    <div className="absolute -top-3 left-4 bg-[var(--card)] px-2 text-[0.85rem] font-bold text-[var(--fg)]">Audit Log</div>
                    <div className="pt-1">
                        <AuditLogViewer />
                    </div>
                </div>

            </div>
        </div>
    );
}
