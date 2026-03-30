import React, { useState, useEffect } from 'react';

export default function LicenseModal({ onClose }) {
    const [licenseKey, setLicenseKey] = useState('');
    const [machineCode, setMachineCode] = useState('Loading...');

    useEffect(() => {
        window.electronAPI.getMachineCode()
            .then(code => setMachineCode(code || 'UNKNOWN'))
            .catch(console.error);
    }, []);

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
        <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4">
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-[1.25rem] shadow-2xl w-full max-w-[460px] p-8 relative flex flex-col items-stretch">
                <h2 className="text-[1.4rem] font-bold text-[var(--fg)] mb-2">
                    Activate License
                </h2>
                <p className="text-[0.95rem] text-[var(--muted)] mb-6 font-medium">
                    Free plan: up to <strong className="font-semibold text-[var(--fg)]">5 profiles</strong>. Enter a license key to unlock more.
                </p>

                <div className="mb-4">
                    <label className="block text-[0.8rem] font-semibold text-[var(--muted)] mb-1.5">Machine Code</label>
                    <div className="flex">
                        <input
                            type="text"
                            readOnly
                            value={machineCode}
                            className="flex-1 bg-[var(--bg)] border border-[var(--border)] border-r-0 text-[var(--fg)] font-mono text-[0.85rem] px-3 py-2.5 rounded-l-[0.4rem] focus:outline-none"
                        />
                        <button
                            type="button"
                            onClick={handleCopy}
                            className="bg-[var(--glass-strong)] hover:brightness-110 text-[var(--fg)] font-medium px-4 py-2.5 rounded-r-[0.4rem] text-[0.85rem] transition border border-[var(--border)]"
                        >
                            Copy
                        </button>
                    </div>
                </div>

                <div className="mb-6">
                    <label className="block text-[0.8rem] font-semibold text-[var(--muted)] mb-1.5 mt-2">License Key</label>
                    <input
                        type="text"
                        placeholder="HL-MCK1-..."
                        value={licenseKey}
                        onChange={(e) => setLicenseKey(e.target.value)}
                        className="w-full bg-[var(--bg)] border border-[var(--border)] text-[var(--fg)] font-mono text-[0.85rem] px-3 py-2.5 rounded-md focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] transition placeholder:text-[var(--muted)]"
                    />
                </div>

                <button
                    onClick={handleActivate}
                    className="w-full bg-[var(--primary)] hover:brightness-110 text-white font-semibold py-2.5 rounded-[0.45rem] mt-1 shadow-sm transition"
                >
                    Activate License
                </button>
                
                <button
                    onClick={onClose}
                    className="w-full bg-transparent hover:bg-[var(--glass-strong)] text-[var(--fg)] font-medium py-2.5 rounded-[0.45rem] mt-3 border border-[var(--border)] transition"
                >
                    Continue with free plan
                </button>

                <div className="mt-7 text-center w-full">
                    <span className="text-[0.85rem] font-medium text-[var(--muted)]">
                        Get a license at <a href="https://browser.ongbantat.store" target="_blank" rel="noreferrer" className="text-[var(--primary)] hover:underline opacity-90 hover:opacity-100 transition">browser.ongbantat.store</a>
                    </span>
                </div>
            </div>
        </div>
    );
}
