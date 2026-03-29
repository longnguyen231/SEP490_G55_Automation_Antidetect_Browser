import React, { useState } from 'react';

export default function LicenseModal({ onClose }) {
    const [licenseKey, setLicenseKey] = useState('');
    const machineCode = "99D6-05C6-6BEC-912C";

    const handleCopy = () => {
        navigator.clipboard.writeText(machineCode);
        // Could show a toast here, but simple alert or silent is fine for dummy
    };

    const handleActivate = () => {
        if (!licenseKey.trim()) {
            return;
        }
        // Dummy activation
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4">
            <div className="bg-white rounded-[1.25rem] shadow-2xl w-full max-w-[460px] p-8 relative flex flex-col items-stretch">
                <h2 className="text-[1.4rem] font-bold text-slate-800 mb-2">
                    Activate License
                </h2>
                <p className="text-[0.95rem] text-slate-600 mb-6 font-medium">
                    Free plan: up to <strong className="font-semibold text-slate-900">5 profiles</strong>. Enter a license key to unlock more.
                </p>

                <div className="mb-4">
                    <label className="block text-[0.8rem] font-semibold text-slate-500 mb-1.5">Machine Code</label>
                    <div className="flex">
                        <input
                            type="text"
                            readOnly
                            value={machineCode}
                            className="flex-1 bg-[#f1f5f9] border border-slate-200 border-r-0 text-slate-500 font-mono text-[0.85rem] px-3 py-2.5 rounded-l-[0.4rem] focus:outline-none"
                        />
                        <button
                            type="button"
                            onClick={handleCopy}
                            className="bg-[#e2e8f0] hover:bg-[#cbd5e1] text-slate-600 font-medium px-4 py-2.5 rounded-r-[0.4rem] text-[0.85rem] transition border border-slate-200"
                        >
                            Copy
                        </button>
                    </div>
                </div>

                <div className="mb-6">
                    <label className="block text-[0.8rem] font-semibold text-slate-500 mb-1.5 mt-2">License Key</label>
                    <input
                        type="text"
                        placeholder="HL-MCK1-..."
                        value={licenseKey}
                        onChange={(e) => setLicenseKey(e.target.value)}
                        className="w-full bg-[#f1f5f9] border border-slate-200 text-slate-700 font-mono text-[0.85rem] px-3 py-2.5 rounded-md focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition"
                    />
                </div>

                <button
                    onClick={handleActivate}
                    className="w-full bg-[#8ba4f9] hover:bg-blue-500 text-white font-semibold py-2.5 rounded-[0.45rem] mt-1 shadow-sm transition"
                >
                    Activate License
                </button>
                
                <button
                    onClick={onClose}
                    className="w-full bg-white hover:bg-slate-50 text-slate-600 font-medium py-2.5 rounded-[0.45rem] mt-3 border border-slate-200 transition"
                >
                    Continue with free plan
                </button>

                <div className="mt-7 text-center w-full">
                    <span className="text-[0.85rem] font-medium text-slate-500">
                        Get a license at <a href="https://browser.ongbantat.store" target="_blank" rel="noreferrer" className="text-blue-500 hover:text-blue-600 hover:underline">browser.ongbantat.store</a>
                    </span>
                </div>
            </div>
        </div>
    );
}
