import React, { useState, useEffect } from 'react';
import { useI18n } from '../i18n/index';
import BrowserRuntimes from './BrowserRuntimes';

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
    const [autoStartApi, setAutoStartApi] = useState(false);
    const [maxBrowsers, setMaxBrowsers] = useState(5);

    useEffect(() => {
        window.electronAPI.getMachineCode()
            .then(code => setMachineCode(code || 'UNKNOWN'))
            .catch(console.error);
    }, []);

    return (
        <div className="w-full h-full flex flex-col p-4 overflow-y-auto">
            <div className="max-w-[700px]">
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
                    </div>
                    <p className="text-[0.7rem] text-[var(--muted)]">Current mode: {theme}</p>
                </div>

                {/* License */}
                <div className="card relative p-4 mb-6 mt-4">
                    <div className="absolute -top-3 left-4 bg-[var(--card)] px-2 text-[0.85rem] font-bold text-[var(--fg)]">License</div>
                    <div className="flex items-center gap-2 mb-3 pt-1">
                        <div className="w-2 h-2 rounded-full bg-red-500"></div>
                        <span className="text-[0.85rem] font-medium text-[var(--fg)]">Not licensed</span>
                    </div>
                    <p className="text-[0.7rem] text-red-500 mb-1">No license key configured</p>
                    <p className="text-[0.7rem] text-[var(--muted)] mb-3">Free plan: up to 5 profiles.</p>
                    <div className="flex gap-2 mb-4">
                        <input
                            type="text"
                            placeholder="OBT1-..."
                            value={licenseKey}
                            onChange={e => setLicenseKey(e.target.value)}
                            className="flex-1 text-[0.75rem] py-1.5"
                        />
                        <button className="btn btn-success px-3 py-1.5 text-[0.75rem]">Activate</button>
                    </div>
                    <div>
                        <label className="block text-[0.7rem] text-[var(--muted)] mb-1">Machine Code</label>
                        <div className="flex items-center gap-2 mb-1.5">
                            <code className="bg-[var(--glass-strong)] border border-[var(--border2)] text-[var(--fg)] text-[0.7rem] px-2 py-1 rounded-md font-mono tracking-wider">{machineCode}</code>
                            <button onClick={() => navigator.clipboard.writeText(machineCode)} className="text-[0.7rem] text-[var(--primary)] hover:text-[var(--primary-hover)] font-medium px-1">Copy</button>
                        </div>
                        <p className="text-[0.7rem] text-[var(--muted)]">Send this code to obtain a license key for this machine.</p>
                    </div>
                </div>

                {/* REST API Server */}
                <div className="card relative p-4 mb-6 mt-4">
                    <div className="absolute -top-3 left-4 bg-[var(--card)] px-2 text-[0.85rem] font-bold text-[var(--fg)]">REST API Server</div>
                    <div className="flex items-center justify-between mb-3 pt-1">
                        <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${apiStatus?.running ? 'bg-emerald-500' : 'bg-slate-400'}`}></div>
                            <span className="text-[0.85rem] font-medium text-[var(--fg)]">{apiStatus?.running ? 'Running' : 'Stopped'}</span>
                        </div>
                        {apiStatus?.running && (
                            <button
                                onClick={() => window.electronAPI.openExternal(`http://localhost:${apiDesiredPort || 4000}/docs`)}
                                className="text-[0.8rem] text-[var(--primary)] hover:underline flex items-center gap-1"
                            >
                                Open Swagger UI ↗
                            </button>
                        )}
                    </div>
                    {apiStatus?.running && (
                        <div className="mb-3 text-[0.8rem] text-[var(--fg)] font-mono">
                            http://localhost:{apiDesiredPort || 4000}/docs
                        </div>
                    )}
                    <div className="flex items-center gap-3 mb-3">
                        <span className="text-[0.75rem] text-[var(--muted)] font-medium">Port</span>
                        <input
                            type="number"
                            min="1" max="65535"
                            value={apiDesiredPort || 4000}
                            onChange={e => { setApiDesiredPort(e.target.value); applyPortChange(Number(e.target.value)); }}
                            className="w-[80px] text-[0.75rem] py-1"
                        />
                        <button
                            onClick={handleToggleApiRun}
                            className={`btn px-3 py-1.5 text-[0.75rem] ${apiStatus?.running ? 'btn-danger' : 'btn-success'}`}
                        >
                            {apiStatus?.running ? 'Stop Server' : 'Start Server'}
                        </button>
                    </div>
                    <label className="flex items-center gap-2 text-[0.7rem] text-[var(--muted)] mb-2 cursor-pointer">
                        <input type="checkbox" checked={autoStartApi} onChange={e => setAutoStartApi(e.target.checked)} className="rounded cursor-pointer" />
                        Auto-start server on app launch
                    </label>
                    <p className="text-[0.7rem] text-[var(--muted)]">Exposes REST API for automation scripting. Swagger docs available at /docs when running.</p>
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
                    <button className="btn btn-success px-4 py-1.5 text-[0.75rem]">Save Settings</button>
                </div>

                {/* Environment Variables */}
                <div className="card relative p-4 mb-6 mt-8">
                    <div className="absolute -top-3 left-4 bg-[var(--card)] px-2 text-[0.85rem] font-bold text-[var(--fg)]">Environment Variables</div>
                    <div className="mb-4 pt-1">
                        <span className="text-[0.75rem] font-bold text-emerald-500 block mb-1">LOG_LEVEL</span>
                        <p className="text-[0.7rem] text-[var(--muted)] ml-4">Logging level: trace, debug, info, warn, error, fatal</p>
                        <p className="text-[0.7rem] text-[var(--muted)] ml-4">Default: info</p>
                    </div>
                    <div className="mb-4">
                        <span className="text-[0.75rem] font-bold text-emerald-500 block mb-1">MAX_CONCURRENT_BROWSERS</span>
                        <p className="text-[0.7rem] text-[var(--muted)] ml-4">Maximum number of browser instances running simultaneously</p>
                        <p className="text-[0.7rem] text-[var(--muted)] ml-4">Default: 5 (overrides UI setting above)</p>
                    </div>
                    <div className="mb-4">
                        <span className="text-[0.75rem] font-bold text-emerald-500 block mb-1">MASTER_ENCRYPTION_KEY</span>
                        <p className="text-[0.7rem] text-[var(--muted)] ml-4">32-byte base64-encoded key for encrypting proxy credentials in database</p>
                        <p className="text-[0.7rem] text-amber-500 ml-4 mt-0.5 flex items-center gap-1"><svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><path d="M12 2L1 21h22L12 2zm0 3.8l7.5 13.2H4.5L12 5.8zM11 10v4h2v-4h-2zm0 6v2h2v-2h-2z"/></svg>Required for production use. Dev mode uses insecure default key.</p>
                    </div>
                    <div className="mt-4 border-t border-[var(--border)] pt-2">
                        <p className="text-[0.7rem] text-[var(--muted)] italic"><strong className="font-semibold not-italic">Note:</strong> Environment variables must be set before launching the application. Restart required after changes.</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
