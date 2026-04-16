import React, { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../store/authStore';

export default function MyLicensePage() {
  const { user, isPro, loading } = useAuthStore();

  const [machineCode, setMachineCode] = useState('');
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState('');
  const [licenseKey, setLicenseKey] = useState('');
  const [copied, setCopied] = useState(false);

  // Still restoring session
  if (loading) return null;

  // Not Pro → redirect to checkout
  if (!isPro) {
    return (
      <div className="min-h-screen bg-[#080a0c] flex items-center justify-center p-4">
        <div className="w-full max-w-sm text-center">
          <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-5">
            <svg className="w-7 h-7 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-white mb-2">Pro License Required</h1>
          <p className="text-white/50 text-sm mb-6">You need an active Pro plan to access your license key.</p>
          <Link
            to="/checkout?tier=pro"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 text-black font-bold px-6 py-3 rounded-xl text-sm hover:opacity-90 transition-opacity"
          >
            ⚡ Upgrade to Pro
          </Link>
          <p className="mt-4">
            <Link to="/" className="text-white/30 text-xs hover:text-white/60 transition-colors">← Back to home</Link>
          </p>
        </div>
      </div>
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    const trimmed = machineCode.trim();
    if (!trimmed) { setError('Please enter your Machine Code.'); return; }

    setActivating(true);
    try {
      const res = await fetch('/api/my-license', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user?.email, machineCode: trimmed }),
      });
      const data = await res.json();

      if (res.ok && data.licenseKey) {
        setLicenseKey(data.licenseKey);
        toast.success('License key retrieved!');
      } else {
        setError(data.error || 'Failed to get license key. Please try again.');
      }
    } catch {
      setError('Network error. Please check your connection and retry.');
    } finally {
      setActivating(false);
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(licenseKey).catch(() => {});
    setCopied(true);
    toast.success('License key copied!');
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <div className="min-h-screen bg-[#080a0c] flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold px-3 py-1 rounded-full mb-4">
            ⚡ PRO
          </div>
          <h1 className="text-2xl font-bold text-white">My License Key</h1>
          <p className="text-white/40 text-sm mt-1">Logged in as <span className="text-white/70">{user?.email}</span></p>
        </div>

        {licenseKey ? (
          /* ── License key result ─────────────────────────────────────── */
          <div className="rounded-2xl border border-green-500/25 bg-green-500/5 p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-green-500/15 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Your License Key</h2>
                <p className="text-white/40 text-xs">Copy and paste into the app</p>
              </div>
            </div>

            <div className="bg-black/50 border border-white/10 rounded-xl p-4 flex items-center justify-between gap-3 mb-4">
              <span className="text-[#00bcd4] font-mono text-lg font-bold tracking-widest select-all">
                {licenseKey}
              </span>
              <button
                onClick={handleCopy}
                className="shrink-0 text-white/50 hover:text-white transition-colors"
                title="Copy to clipboard"
              >
                {copied ? (
                  <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                )}
              </button>
            </div>

            <div className="text-white/40 text-xs text-center space-y-1">
              <p>Paste this key in <span className="text-white/70 font-medium">HL-MCK Browser → Settings → License</span></p>
              <p>This key is bound to the machine code you entered.</p>
            </div>

            <button
              onClick={() => { setLicenseKey(''); setMachineCode(''); }}
              className="mt-5 w-full border border-white/10 text-white/40 hover:text-white/70 hover:border-white/20 rounded-xl py-2.5 text-sm transition-colors"
            >
              Get key for a different machine
            </button>
          </div>
        ) : (
          /* ── Machine code form ──────────────────────────────────────── */
          <div className="rounded-2xl border border-white/8 bg-white/2 p-8">
            {/* How-to instructions */}
            <div className="bg-black/30 border border-white/8 rounded-xl p-4 mb-6 text-sm text-white/60 leading-relaxed">
              <p className="font-semibold text-white/80 mb-2">How to find your Machine Code:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Open <span className="text-white font-medium">HL-MCK Browser</span> app</li>
                <li>Go to <span className="text-white font-medium">Settings → License</span></li>
                <li>Copy the <span className="text-white font-medium">Machine Code</span><br />
                  <code className="text-[#00bcd4] ml-5">e.g. A1B2 C3D4 E5F6 7890</code>
                </li>
                <li>Paste it below and click <span className="text-white font-medium">Get My Key</span></li>
              </ol>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-white/60 text-xs font-semibold uppercase tracking-widest mb-2">
                  Machine Code
                </label>
                <input
                  type="text"
                  value={machineCode}
                  onChange={e => { setMachineCode(e.target.value); setError(''); }}
                  placeholder="XXXX XXXX XXXX XXXX"
                  className="w-full bg-black/40 border border-white/15 rounded-xl px-4 py-3 text-white font-mono text-sm placeholder-white/20 focus:outline-none focus:border-[#00bcd4]/60 transition-colors tracking-wider"
                  autoComplete="off"
                  spellCheck={false}
                />
                {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
              </div>

              <button
                type="submit"
                disabled={activating}
                className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:opacity-90 disabled:opacity-50 text-black font-bold py-3.5 rounded-xl transition-all text-sm"
              >
                {activating ? 'Retrieving…' : '🔑 Get My License Key'}
              </button>
            </form>
          </div>
        )}

        <p className="text-center mt-6">
          <Link to="/" className="text-white/25 text-xs hover:text-white/50 transition-colors">← Back to home</Link>
        </p>
      </div>
    </div>
  );
}
