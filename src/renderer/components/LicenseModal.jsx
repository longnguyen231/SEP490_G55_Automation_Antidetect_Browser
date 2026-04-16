import React, { useState } from 'react';
import { getLicenseRequestUrl, WEB_ADMIN_URL } from '../config/app.config';

const LICENSE_KEY = 'hl-license-activated';

export default function LicenseModal({ onClose, onActivated }) {
    const [licenseKey, setLicenseKey] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleActivate = async () => {
        const key = licenseKey.trim();
        if (!key) {
            setError('Please enter your license key.');
            return;
        }
        setLoading(true);
        setError('');
        try {
            const result = await window.electronAPI.validateJwtLicense(key);
            if (result?.valid) {
                localStorage.setItem(LICENSE_KEY, 'true');
                localStorage.setItem('hl-license-tier', result.payload?.tier || 'free');
                if (result.payload?.expiresAt) {
                    localStorage.setItem('hl-license-expiry', result.payload.expiresAt);
                }
                onActivated?.(result.payload);
            } else {
                setError(result?.error || 'Invalid license key.');
            }
        } catch {
            setError('An error occurred. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') handleActivate();
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4">
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-[1.25rem] shadow-2xl w-full max-w-[460px] p-8 relative flex flex-col items-stretch">
                <h2 className="text-[1.4rem] font-bold text-[var(--fg)] mb-2">
                    Get Started
                </h2>
                <p className="text-[0.95rem] text-[var(--muted)] mb-6 font-medium">
                    Use the <strong className="font-semibold text-[var(--fg)]">Free plan</strong> (max 5 profiles) or enter a PRO license key to unlock all features.
                </p>

                {/* License Key input */}
                <div className="mb-2">
                    <label className="block text-[0.8rem] font-semibold text-[var(--muted)] mb-1.5">License Key</label>
                    <input
                        type="text"
                        placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                        value={licenseKey}
                        onChange={(e) => { setLicenseKey(e.target.value); setError(''); }}
                        onKeyDown={handleKeyDown}
                        disabled={loading}
                        className="w-full bg-[var(--bg)] border border-[var(--border)] text-[var(--fg)] font-mono text-[0.85rem] px-3 py-2.5 rounded-md focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] transition placeholder:text-[var(--muted)] disabled:opacity-50"
                    />
                </div>

                {/* Error message */}
                {error && (
                    <p className="text-[0.82rem] text-red-400 mb-3 mt-1">{error}</p>
                )}
                {!error && <div className="mb-3" />}

                <button
                    onClick={handleActivate}
                    disabled={loading}
                    className="w-full bg-[var(--primary)] hover:brightness-110 text-white font-semibold py-2.5 rounded-[0.45rem] mt-1 shadow-sm transition disabled:opacity-60 disabled:cursor-not-allowed"
                >
                    {loading ? 'Checking...' : 'Activate License'}
                </button>

                <button
                    onClick={onClose}
                    disabled={loading}
                    className="w-full bg-transparent hover:bg-[var(--glass-strong)] text-[var(--fg)] font-medium py-2.5 rounded-[0.45rem] mt-3 border border-[var(--border)] transition disabled:opacity-60 cursor-pointer"
                >
                    ✓ Use Free Plan (5 profiles)
                </button>

                <div className="mt-7 text-center w-full">
                    <span className="text-[0.85rem] font-medium text-[var(--muted)]">
                        Get a license at{' '}
                        <a href={getLicenseRequestUrl()} target="_blank" rel="noreferrer"
                           className="text-[var(--primary)] hover:underline opacity-90 hover:opacity-100 transition">
                            {WEB_ADMIN_URL.replace('http://', '')}
                        </a>
                    </span>
                </div>
            </div>
        </div>
    );
}
