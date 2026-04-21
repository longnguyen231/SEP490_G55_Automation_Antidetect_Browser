import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../store/authStore';

// ─── License key form (shared by trial + paid) ────────────────────────────────
function LicenseKeyForm({ user, statusLabel, statusColor, expiresAt }) {
  const [machineCode, setMachineCode] = useState('');
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState('');
  const [licenseKey, setLicenseKey] = useState('');
  const [copied, setCopied] = useState(false);

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
    <>
      {/* Status badge */}
      <div className="text-center mb-8">
        <div className={`inline-flex items-center gap-1.5 border text-xs font-bold px-3 py-1 rounded-full mb-4 ${statusColor}`}>
          {statusLabel}
        </div>
        <h1 className="text-2xl font-bold text-white">My License Key</h1>
        <p className="text-white/40 text-sm mt-1">Logged in as <span className="text-white/70">{user?.email}</span></p>
        {expiresAt && (
          <p className="text-amber-400/70 text-xs mt-2">
            Trial expires: {new Date(expiresAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
          </p>
        )}
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
              className="w-full bg-gradient-to-r from-[#00bcd4] to-cyan-500 hover:opacity-90 disabled:opacity-50 text-black font-bold py-3.5 rounded-xl transition-all text-sm"
            >
              {activating ? 'Retrieving…' : '🔑 Get My License Key'}
            </button>
          </form>
        </div>
      )}
    </>
  );
}

// ─── No license → request trial ──────────────────────────────────────────────
function RequestTrialPanel({ user, onTrialGranted }) {
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState('');

  async function handleRequestTrial() {
    setError('');
    setRequesting(true);
    try {
      const res = await fetch('/api/request-trial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user?.email }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        toast.success('🚀 Free trial activated! You now have 30 days of Pro access.');
        onTrialGranted(data);
      } else if (res.status === 409 && data.alreadyHasLicense) {
        toast.success('You already have an active license.');
        onTrialGranted(data);
      } else {
        setError(data.error || 'Failed to activate trial. Please try again.');
      }
    } catch {
      setError('Network error. Please check your connection and retry.');
    } finally {
      setRequesting(false);
    }
  }

  return (
    <>
      <div className="text-center mb-8">
        <div className="w-16 h-16 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mx-auto mb-5">
          <svg className="w-7 h-7 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Get Your Free Trial</h1>
        <p className="text-white/50 text-sm mb-1">Logged in as <span className="text-white/70">{user?.email}</span></p>
        <p className="text-white/40 text-xs max-w-xs mx-auto">
          Activate 30 days of Pro access — no payment required. One trial per account.
        </p>
      </div>

      <div className="rounded-2xl border border-white/8 bg-white/2 p-6 mb-5">
        <p className="text-white/60 text-xs font-semibold uppercase tracking-widest mb-4">What you get (30 days)</p>
        <ul className="space-y-3">
          {[
            'Unlimited browser profiles',
            'Advanced fingerprint spoofing',
            'Full automation & scripting engine',
            'REST API access',
            'Priority support',
          ].map((f) => (
            <li key={f} className="flex items-center gap-2.5 text-sm text-white/70">
              <span className="w-5 h-5 rounded-full bg-[#00bcd4]/20 flex items-center justify-center text-[#00bcd4] text-[10px] font-bold shrink-0">✓</span>
              {f}
            </li>
          ))}
        </ul>
      </div>

      {error && (
        <p className="text-red-400 text-xs bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-3 mb-4">
          {error}
        </p>
      )}

      <button
        onClick={handleRequestTrial}
        disabled={requesting}
        className="w-full bg-gradient-to-r from-[#00bcd4] to-cyan-500 hover:opacity-90 disabled:opacity-50 text-black font-bold py-3.5 rounded-xl transition-all text-sm"
      >
        {requesting ? 'Activating…' : '🚀 Activate Free Trial'}
      </button>
      <p className="text-center text-white/30 text-xs mt-4">
        After activating, you'll enter your machine code to get the license key.
      </p>
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function MyLicensePage() {
  const { user, isPro, isTrial, trialExpiresAt, loading, checkProStatus } = useAuthStore();
  const [localState, setLocalState] = useState(null); // { isPro, isTrial, trialExpiresAt }

  const effectivePro = localState ? localState.isPro : isPro;
  const effectiveTrial = localState ? localState.isTrial : isTrial;
  const effectiveExpiry = localState ? localState.trialExpiresAt : trialExpiresAt;

  if (loading) return null;

  if (!user) {
    return (
      <div className="min-h-screen bg-[#080a0c] flex items-center justify-center p-4">
        <div className="w-full max-w-sm text-center">
          <h1 className="text-xl font-bold text-white mb-3">Sign in required</h1>
          <p className="text-white/50 text-sm mb-6">Please sign in to access your license.</p>
          <Link to="/login" className="inline-flex items-center gap-2 bg-[#00bcd4] text-black font-bold px-6 py-3 rounded-xl text-sm hover:opacity-90 transition-opacity">
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  function handleTrialGranted(data) {
    setLocalState({
      isPro: true,
      isTrial: data.status === 'trial',
      trialExpiresAt: data.trialExpiresAt || null,
    });
    checkProStatus(user.email);
  }

  const statusLabel = effectiveTrial ? '🚀 TRIAL ACTIVE' : '⚡ PRO';
  const statusColor = effectiveTrial
    ? 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400'
    : 'bg-amber-500/10 border-amber-500/20 text-amber-400';

  return (
    <div className="min-h-screen bg-[#080a0c] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {effectivePro ? (
          <LicenseKeyForm
            user={user}
            statusLabel={statusLabel}
            statusColor={statusColor}
            expiresAt={effectiveTrial ? effectiveExpiry : null}
          />
        ) : (
          <RequestTrialPanel user={user} onTrialGranted={handleTrialGranted} />
        )}

        <p className="text-center mt-6">
          <Link to="/" className="text-white/25 text-xs hover:text-white/50 transition-colors">← Back to home</Link>
        </p>
      </div>
    </div>
  );
}
