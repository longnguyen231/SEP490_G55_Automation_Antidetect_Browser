import React, { useState, useEffect } from 'react';

const LICENSE_KEY = 'hl-license-activated';

export default function LicenseModal({ onClose, onActivated }) {
    const [licenseKey, setLicenseKey] = useState('');
    const [machineCode, setMachineCode] = useState('Loading...');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        window.electronAPI.getMachineCode()
            .then(code => setMachineCode(code || 'UNKNOWN'))
            .catch(() => setMachineCode('UNKNOWN'));
    }, []);

    const handleCopy = () => {
        navigator.clipboard.writeText(machineCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

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
                onActivated?.();
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

    const handleRequestKey = () => {
        const subject = encodeURIComponent('[Vanguard] Yêu cầu License Key');
        const body = encodeURIComponent(
            `Xin chào Admin,\n\nMachine Code của tôi: ${machineCode}\n\nVui lòng cấp license key cho máy này.\n\nCảm ơn!`
        );
        const gmailUrl = `https://mail.google.com/mail/?view=cm&to=xuankien090103%40gmail.com&su=${subject}&body=${body}`;
        window.electronAPI.openExternal(gmailUrl);
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4">
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-[1.25rem] shadow-2xl w-full max-w-[460px] p-8 relative flex flex-col items-stretch">
                <h2 className="text-[1.4rem] font-bold text-[var(--fg)] mb-2">
                    Activate License
                </h2>
                <p className="text-[0.95rem] text-[var(--muted)] mb-6 font-medium">
                    Free plan: tối đa <strong className="font-semibold text-[var(--fg)]">5 profiles</strong>. Nhập license key để mở khóa toàn bộ.
                </p>

                {/* Machine Code */}
                <div className="mb-2">
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
                            className="bg-[var(--glass-strong)] hover:brightness-110 text-[var(--fg)] font-medium px-4 py-2.5 rounded-r-[0.4rem] text-[0.85rem] transition border border-[var(--border)] min-w-[70px]"
                        >
                            {copied ? '✔ Copied' : 'Copy'}
                        </button>
                    </div>
                    <button
                        type="button"
                        onClick={handleRequestKey}
                        className="mt-2 text-[0.8rem] text-[var(--primary)] hover:underline transition"
                    >
                        📧 Gửi yêu cầu key qua email →
                    </button>
                </div>

                {/* License Key input */}
                <div className="mb-2">
                    <label className="block text-[0.8rem] font-semibold text-[var(--muted)] mb-1.5 mt-2">License Key</label>
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
                    {loading ? 'Checking...' : 'Activate License'}
                </button>

                <button
                    onClick={onClose}
                    disabled={loading}
                    className="w-full bg-transparent hover:bg-[var(--glass-strong)] text-[var(--fg)] font-medium py-2.5 rounded-[0.45rem] mt-3 border border-[var(--border)] transition disabled:opacity-60"
                >
                    Continue with free plan
                </button>

                <div className="mt-7 text-center w-full">
                    <span className="text-[0.85rem] font-medium text-[var(--muted)]">
                        Get a license at{' '}
                        <a href="https://browser.hl-mck.store" target="_blank" rel="noreferrer"
                           className="text-[var(--primary)] hover:underline opacity-90 hover:opacity-100 transition">
                            browser.hl-mck.store
                        </a>
                    </span>
                </div>
            </div>
        </div>
    );
}
