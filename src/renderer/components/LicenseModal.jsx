import React, { useState } from 'react';
import { getCheckoutUrl } from '../config/app.config';

const LICENSE_KEY = 'hl-license-activated';

export default function LicenseModal({ onClose, onActivated }) {
    const [licenseKey, setLicenseKey] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleActivate = async () => {
        const key = licenseKey.trim();
        if (!key) {
            setError('Vui lòng nhập license key.');
            return;
        }
        setLoading(true);
        setError('');
        try {
            const result = await window.electronAPI.validateLicense(key);
            if (result?.valid) {
                localStorage.setItem(LICENSE_KEY, key);
                onActivated?.(result);
            } else {
                setError('License key không hợp lệ với máy này.');
            }
        } catch {
            setError('Đã xảy ra lỗi. Thử lại sau.');
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
                    Bắt đầu sử dụng
                </h2>
                <p className="text-[0.95rem] text-[var(--muted)] mb-6 font-medium">
                    Dùng <strong className="font-semibold text-[var(--fg)]">Free</strong> (tối đa 5 profiles) hoặc nhập key PRO để mở khóa toàn bộ tính năng.
                </p>

                {/* Upgrade to Pro button */}
                <button
                    onClick={() => window.electronAPI.openExternal(getCheckoutUrl())}
                    className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-[var(--primary)] to-purple-500 hover:brightness-110 text-white font-bold py-3 rounded-[0.6rem] mb-4 shadow-md transition text-[0.95rem]"
                >
                    ⚡ Mua Pro License →
                </button>

                <div className="flex items-center gap-2 mb-4">
                    <div className="flex-1 h-px bg-[var(--border)]" />
                    <span className="text-[0.75rem] text-[var(--muted)]">hoặc nhập key đã mua</span>
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
                    {loading ? 'Đang kiểm tra...' : 'Kích hoạt License'}
                </button>

                <button
                    onClick={onClose}
                    disabled={loading}
                    className="w-full bg-transparent hover:bg-[var(--glass-strong)] text-[var(--muted)] font-medium py-2.5 rounded-[0.45rem] mt-3 border border-[var(--border)] transition disabled:opacity-60 cursor-pointer text-[0.85rem]"
                >
                    Tiếp tục dùng Free (5 profiles)
                </button>
            </div>
        </div>
    );
}
