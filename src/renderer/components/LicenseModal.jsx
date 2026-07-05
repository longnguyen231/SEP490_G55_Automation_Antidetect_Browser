import React, { useState } from 'react';
import { getCheckoutUrl } from '../config/app.config';
import { useI18n } from '../i18n/index';

export default function LicenseModal({ onClose, onActivated }) {
    const { t } = useI18n();
    const [licenseKey, setLicenseKey] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const userEmail = localStorage.getItem('firebase_email') || '';
    const userLicenseKey = `hl-license-activated_${userEmail}`;

    const handleActivate = async () => {
        const key = licenseKey.trim();
        if (!key) {
            setError(t('license.error.empty', 'Please enter a license key.'));
            return;
        }
        setLoading(true);
        setError('');
        try {
            const result = await window.electronAPI.validateLicense(key, userEmail);
            if (result?.valid) {
                localStorage.setItem(userLicenseKey, key);
                onActivated?.(result);
            } else {
                setError(t('license.error.invalid', 'Invalid license key for this machine.'));
            }
        } catch {
            setError(t('license.error.system', 'An error occurred. Please try again later.'));
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
                    {t('license.getStarted', 'Get Started')}
                </h2>
                <p className="text-[0.95rem] text-[var(--muted)] mb-6 font-medium">
                    Use <strong className="font-semibold text-[var(--fg)]">Free</strong> (max 5 profiles) or enter a PRO key to unlock all features.
                </p>

                {/* Upgrade to Pro button */}
                <button
                    onClick={() => window.electronAPI.openExternal(getCheckoutUrl(userEmail))}
                    className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-[var(--primary)] to-purple-500 hover:brightness-110 text-white font-bold py-3 rounded-[0.6rem] mb-4 shadow-md transition text-[0.95rem]"
                >
                    {t('license.buyPro', '⚡ Buy Pro License →')}
                </button>

                <div className="flex items-center gap-2 mb-4">
                    <div className="flex-1 h-px bg-[var(--border)]" />
                    <span className="text-[0.75rem] text-[var(--muted)]">{t('license.orEnterKey', 'or enter purchased key')}</span>
                    <div className="flex-1 h-px bg-[var(--border)]" />
                </div>

                {/* License Key input */}
                <div className="mb-2">
                    <label className="block text-[0.8rem] font-semibold text-[var(--muted)] mb-1.5">License Key</label>
                    <input
                        type="text"
                        placeholder="HL-XXXX-XXXX-XXXX"
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
                    {loading ? t('license.checking', 'Checking...') : t('license.activateBtn', 'Activate License')}
                </button>

                <button
                    onClick={onClose}
                    disabled={loading}
                    className="w-full bg-transparent hover:bg-[var(--glass-strong)] text-[var(--muted)] font-medium py-2.5 rounded-[0.45rem] mt-3 border border-[var(--border)] transition disabled:opacity-60 cursor-pointer text-[0.85rem]"
                >
                    {t('license.continueFree', 'Continue Free (5 profiles)')}
                </button>
            </div>
        </div>
    );
}
