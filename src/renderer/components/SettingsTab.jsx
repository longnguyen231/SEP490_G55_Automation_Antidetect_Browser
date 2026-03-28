import React, { useState } from 'react';
import { useI18n } from '../i18n/index';

export default function SettingsTab({ 
    apiStatus, 
    apiDesiredPort, 
    setApiDesiredPort, 
    applyPortChange, 
    handleToggleApiRun, 
    handleRestartApi,
    theme,
    setTheme
}) {
    const { t } = useI18n();
    const [licenseKey, setLicenseKey] = useState('');
    const machineCode = "99D6-05C6-6BEC-912C";
    const [autoStartApi, setAutoStartApi] = useState(false);
    const [maxBrowsers, setMaxBrowsers] = useState(5);

    return (
        <div className="w-full h-full flex flex-col p-8 bg-[#f1f5f9] overflow-y-auto">
            <div className="max-w-[700px]">
                <h1 className="text-2xl font-bold text-slate-800 mb-8 tracking-tight">{t('settings.title') || 'Settings'}</h1>

                {/* Appearance */}
                <div className="relative border border-slate-200 rounded-xl p-5 mb-8 bg-white shadow-sm mt-4">
                    <div className="absolute -top-3 left-4 bg-white px-2 text-[0.95rem] font-bold text-slate-700">
                        Appearance
                    </div>
                    
                    <div className="mb-2 pt-1">
                        <label className="block text-sm text-slate-600 mb-1.5">Theme</label>
                        <select 
                            value={theme}
                            onChange={(e) => setTheme(e.target.value)}
                            className="w-[180px] bg-[#f1f5f9] border border-slate-200 text-slate-700 text-[0.9rem] rounded-md px-3 py-2 cursor-pointer focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition"
                        >
                            <option value="Light">Light</option>
                            <option value="Dark">Dark</option>
                        </select>
                    </div>
                    <p className="text-[0.8rem] text-slate-500">Current mode: {theme}</p>
                </div>

                {/* License */}
                <div className="relative border border-slate-200 rounded-xl p-5 mb-8 bg-white shadow-sm mt-4">
                    <div className="absolute -top-3 left-4 bg-white px-2 text-[0.95rem] font-bold text-slate-700">
                        License
                    </div>
                    
                    <div className="flex items-center gap-2 mb-3 pt-1">
                        <div className="w-2 h-2 rounded-full bg-red-500"></div>
                        <span className="text-[0.95rem] font-medium text-slate-700">Not licensed</span>
                    </div>
                    <p className="text-[0.85rem] text-red-400 mb-1">No license key configured</p>
                    <p className="text-[0.85rem] text-slate-500 mb-3">Free plan: up to 5 profiles.</p>
                    
                    <div className="flex gap-2 mb-5">
                        <input 
                            type="text" 
                            placeholder="OBT1-..."
                            value={licenseKey}
                            onChange={e => setLicenseKey(e.target.value)}
                            className="flex-1 bg-[#f1f5f9] border border-slate-200 text-slate-700 text-[0.9rem] rounded-md px-3 py-2.5 focus:outline-none focus:border-blue-400 transition"
                        />
                        <button className="bg-[#8ba4f9] hover:bg-blue-500 text-white font-medium px-5 py-2.5 rounded-md text-[0.9rem] transition shadow-sm">
                            Activate
                        </button>
                    </div>

                    <div>
                        <label className="block text-[0.8rem] text-slate-600 mb-1">Machine Code</label>
                        <div className="flex items-center gap-2 mb-1.5">
                            <code className="bg-[#e2e8f0] text-slate-600 text-[0.85rem] px-3 py-1.5 rounded-md font-mono tracking-wider">
                                {machineCode}
                            </code>
                            <button 
                                onClick={() => navigator.clipboard.writeText(machineCode)}
                                className="text-[0.85rem] text-slate-500 hover:text-slate-700 font-medium px-2"
                            >
                                Copy
                            </button>
                        </div>
                        <p className="text-[0.8rem] text-slate-500">Send this code to obtain a license key for this machine.</p>
                    </div>
                </div>

                {/* REST API Server */}
                <div className="relative border border-slate-200 rounded-xl p-5 mb-8 bg-[#f4f7fb] mt-4">
                    <div className="absolute -top-3 left-4 bg-[#f4f7fb] px-2 text-[0.95rem] font-bold text-slate-700">
                        REST API Server
                    </div>
                    
                    <div className="flex items-center gap-2 mb-4 pt-1">
                        <div className={`w-2 h-2 rounded-full ${apiStatus?.running ? 'bg-emerald-500' : 'bg-[#9ca3af]'}`}></div>
                        <span className="text-[0.95rem] font-medium text-slate-700">
                            {apiStatus?.running ? 'Running' : 'Stopped'}
                        </span>
                    </div>

                    <div className="flex items-center gap-3 mb-4">
                        <span className="text-[0.9rem] text-slate-600 font-medium">Port</span>
                        <input 
                            type="number" 
                            min="1" max="65535"
                            value={apiDesiredPort || 3000}
                            onChange={e => {
                                setApiDesiredPort(e.target.value);
                                applyPortChange(Number(e.target.value));
                            }}
                            className="w-[90px] bg-[#e2e8f0] border border-slate-300 text-slate-700 text-[0.9rem] rounded-md px-3 py-1.5 focus:outline-none focus:border-blue-400 transition"
                        />
                        <button 
                            onClick={handleToggleApiRun}
                            className={`px-4 py-1.5 text-[0.9rem] font-semibold text-white rounded-md transition shadow-sm ${apiStatus?.running ? 'bg-red-500 hover:bg-red-600' : 'bg-[#16a34a] hover:bg-green-700'}`}
                        >
                            {apiStatus?.running ? 'Stop Server' : 'Start Server'}
                        </button>
                    </div>

                    <label className="flex items-center gap-2 text-[0.85rem] text-slate-600 mb-2 cursor-pointer">
                        <input 
                            type="checkbox" 
                            checked={autoStartApi}
                            onChange={e => setAutoStartApi(e.target.checked)}
                            className="rounded border-slate-300 text-blue-500 focus:ring-blue-500 w-3.5 h-3.5 cursor-pointer"
                        />
                        Auto-start server on app launch
                    </label>

                    <p className="text-[0.85rem] text-slate-500">
                        Exposes REST API for automation scripting. Swagger docs available at /docs when running.
                    </p>
                </div>

                {/* Playwright Chromium */}
                <div className="relative border border-slate-200 rounded-xl p-5 mb-8 bg-white shadow-sm mt-4">
                    <div className="absolute -top-3 left-4 bg-white px-2 text-[0.95rem] font-bold text-slate-700">
                        Playwright Chromium
                    </div>
                    
                    <div className="flex items-center gap-2 mb-3 pt-1">
                        <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                        <span className="text-[0.95rem] font-medium text-slate-700">Installed</span>
                    </div>
                    <p className="text-[0.8rem] text-slate-500 font-mono break-all mb-3">
                        Path: C:\Users\ManhZizou\AppData\Local\Programs\ObtBrowser\data\.playwright\browsers\chromium-1208\chrome-win64\chrome.exe
                    </p>
                    <p className="text-[0.85rem] text-slate-600 mb-4">
                        Playwright Chromium is required for headless and visible browser profiles.
                    </p>
                    <div className="flex gap-3">
                        <button className="bg-[#2563eb] hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-md text-[0.85rem] transition shadow-sm">
                            Reinstall Chromium
                        </button>
                        <button className="bg-[#b91c1c] hover:bg-red-800 text-white font-medium px-4 py-2 rounded-md text-[0.85rem] transition shadow-sm">
                            Uninstall Chromium
                        </button>
                    </div>
                </div>

                {/* Playwright Firefox */}
                <div className="relative border border-slate-200 rounded-xl p-5 mb-8 bg-white shadow-sm mt-4">
                    <div className="absolute -top-3 left-4 bg-white px-2 text-[0.95rem] font-bold text-slate-700">
                        Playwright Firefox
                    </div>
                    
                    <div className="flex items-center gap-2 mb-3 pt-1">
                        <div className="w-2 h-2 rounded-full bg-red-500"></div>
                        <span className="text-[0.95rem] font-medium text-slate-700">Not installed</span>
                    </div>
                    <p className="text-[0.85rem] text-slate-500 mb-4">
                        Playwright Firefox is required for profiles using the Firefox engine. Firefox doesn't need stealth patches — naturally stealthier than Chromium.
                    </p>
                    <div className="flex gap-3">
                        <button className="bg-[#2563eb] hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-md text-[0.85rem] transition shadow-sm">
                            Install Firefox
                        </button>
                        <button className="bg-[#f87171]/70 text-white font-medium px-4 py-2 rounded-md text-[0.85rem] cursor-not-allowed">
                            Uninstall Firefox
                        </button>
                    </div>
                </div>

                {/* Main Settings Root Options */}
                <div className="mb-6 ml-2">
                    <h3 className="text-[0.95rem] font-bold text-slate-800 mb-3">Max concurrent browsers</h3>
                    <input 
                        type="number" 
                        value={maxBrowsers}
                        onChange={e => setMaxBrowsers(e.target.value)}
                        className="w-[100px] bg-[#f1f5f9] border border-slate-200 text-slate-700 text-[0.9rem] rounded-md px-3 py-2 outline-none focus:border-blue-400 mb-2"
                    />
                    <p className="text-[0.85rem] text-slate-500 mb-6">
                        Limits simultaneous browser instances. Higher = more RAM usage.
                    </p>
                    <button className="bg-[#2563eb] hover:bg-blue-700 text-white font-semibold px-6 py-2.5 rounded-md text-[0.95rem] transition shadow-sm">
                        Save Settings
                    </button>
                </div>

                {/* Environment Variables */}
                <div className="relative border border-slate-200 rounded-xl p-5 mb-8 bg-white shadow-sm mt-8">
                    <div className="absolute -top-3 left-4 bg-white px-2 text-[0.95rem] font-bold text-slate-700">
                        Environment Variables
                    </div>
                    
                    <div className="mb-4 pt-1">
                        <span className="text-[0.85rem] font-bold text-emerald-500 block mb-1">LOG_LEVEL</span>
                        <p className="text-[0.8rem] text-slate-500 ml-4">Logging level: trace, debug, info, warn, error, fatal</p>
                        <p className="text-[0.8rem] text-slate-500 ml-4">Default: info</p>
                    </div>

                    <div className="mb-4">
                        <span className="text-[0.85rem] font-bold text-emerald-500 block mb-1">MAX_CONCURRENT_BROWSERS</span>
                        <p className="text-[0.8rem] text-slate-500 ml-4">Maximum number of browser instances running simultaneously</p>
                        <p className="text-[0.8rem] text-slate-500 ml-4">Default: 5 (overrides UI setting above)</p>
                    </div>

                    <div className="mb-4">
                        <span className="text-[0.85rem] font-bold text-emerald-500 block mb-1">MASTER_ENCRYPTION_KEY</span>
                        <p className="text-[0.8rem] text-slate-500 ml-4">32-byte base64-encoded key for encrypting proxy credentials in database</p>
                        <p className="text-[0.8rem] text-amber-500 ml-4 mt-0.5 flex items-center gap-1">
                            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><path d="M12 2L1 21h22L12 2zm0 3.8l7.5 13.2H4.5L12 5.8zM11 10v4h2v-4h-2zm0 6v2h2v-2h-2z"/></svg>
                            Required for production use. Dev mode uses insecure default key.
                        </p>
                    </div>

                    <div className="mt-6 border-t border-slate-100 pt-3">
                        <p className="text-[0.8rem] text-slate-500 italic">
                            <strong className="font-semibold not-italic">Note:</strong> Environment variables must be set before launching the application. Restart required after changes.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
