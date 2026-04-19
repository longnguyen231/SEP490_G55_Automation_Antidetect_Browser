import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../store/authStore';

export default function CheckoutSuccessPage() {
  const [searchParams] = useSearchParams();
  const orderCode = searchParams.get('orderCode');
  const payosStatus = searchParams.get('status');
  const { user, checkProStatus } = useAuthStore();

  // verifying → paid (enter machine code) → activating → activated | cancelled | error
  const [viewState, setViewState] = useState('verifying');
  const [retries, setRetries] = useState(0);

  // Activation form
  const [machineCode, setMachineCode] = useState('');
  const [activating, setActivating] = useState(false);
  const [activateError, setActivateError] = useState('');

  // Final license key (machine-bound)
  const [licenseKey, setLicenseKey] = useState('');
  const [copied, setCopied] = useState(false);

  // ── Step 1: Verify payment ─────────────────────────────────────────────────
  useEffect(() => {
    if (!orderCode) { setViewState('error'); return; }
    if (searchParams.get('cancel') === 'true' || payosStatus === 'CANCELLED') {
      setViewState('cancelled');
      return;
    }

    let attempts = 0;
    const MAX_ATTEMPTS = 4;

    async function verify() {
      try {
        const res = await fetch(`/api/verify-payment?orderCode=${orderCode}`);
        const data = await res.json();

        if (data.status === 'paid') {
          setViewState('paid'); // show machine code form
        } else if (attempts < MAX_ATTEMPTS) {
          attempts += 1;
          setRetries(attempts);
          setTimeout(verify, 2000);
        } else {
          setViewState('error');
        }
      } catch {
        if (attempts < MAX_ATTEMPTS) {
          attempts += 1;
          setTimeout(verify, 2000);
        } else {
          setViewState('error');
        }
      }
    }

    verify();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderCode]);

  // ── Step 2: Activate with machine code ────────────────────────────────────
  async function handleActivate(e) {
    e.preventDefault();
    setActivateError('');
    const trimmed = machineCode.trim();
    if (!trimmed) { setActivateError('Please enter your Machine Code.'); return; }

    setActivating(true);
    try {
      const res = await fetch('/api/activate-license', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderCode, machineCode: trimmed, userEmail: user?.email }),
      });
      const data = await res.json();

      if (res.ok && data.licenseKey) {
        setLicenseKey(data.licenseKey);
        setViewState('activated');
        toast.success('License activated!');
        // Cập nhật trạng thái Pro trong auth store
        if (typeof checkProStatus === 'function') checkProStatus(user?.email);
      } else {
        setActivateError(data.error || 'Activation failed. Please try again.');
      }
    } catch {
      setActivateError('Network error. Please check your connection and retry.');
    } finally {
      setActivating(false);
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(licenseKey).catch(() => {});
    setCopied(true);
    toast.success('License key copied!');
    setTimeout(() => setCopied(false), 2500);
  };

  if (!orderCode) {
    return (
      <div className="min-h-screen bg-[#080a0c] flex items-center justify-center">
        <div className="text-center">
          <p className="text-white/50 mb-4">Invalid order link.</p>
          <Link to="/" className="text-[#00bcd4] underline text-sm">Go back to home</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080a0c] flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* ── Payment confirmed — enter machine code ─────────────────────── */}
        {viewState === 'paid' && (
          <div className="rounded-2xl border border-green-500/25 bg-green-500/5 p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-green-500/15 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">Payment Confirmed!</h1>
                <p className="text-white/40 text-xs">One more step to activate your license</p>
              </div>
            </div>

            {/* How-to */}
            <div className="bg-black/30 border border-white/8 rounded-xl p-4 mb-5 text-sm text-white/60 leading-relaxed">
              <p className="font-semibold text-white/80 mb-2">How to find your Machine Code:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Open <span className="text-white font-medium">HL-MCK Browser</span> app</li>
                <li>Go to <span className="text-white font-medium">Settings → License</span></li>
                <li>Copy the <span className="text-white font-medium">Machine Code</span> (e.g. <code className="text-[#00bcd4]">A1B2 C3D4 E5F6 7890</code>)</li>
                <li>Paste it below</li>
              </ol>
            </div>

            <form onSubmit={handleActivate} className="space-y-4">
              <div>
                <label className="block text-white/60 text-xs font-semibold uppercase tracking-widest mb-2">
                  Machine Code
                </label>
                <input
                  type="text"
                  value={machineCode}
                  onChange={e => { setMachineCode(e.target.value); setActivateError(''); }}
                  placeholder="XXXX XXXX XXXX XXXX"
                  className="w-full bg-black/40 border border-white/15 rounded-xl px-4 py-3 text-white font-mono text-sm placeholder-white/20 focus:outline-none focus:border-[#00bcd4]/60 transition-colors tracking-wider"
                  autoComplete="off"
                  spellCheck={false}
                />
                {activateError && (
                  <p className="text-red-400 text-xs mt-2">{activateError}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={activating || !machineCode.trim()}
                className="w-full bg-[#00bcd4] hover:bg-[#00bcd4]/90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-all text-sm flex items-center justify-center gap-2"
              >
                {activating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Generating key…
                  </>
                ) : 'Get My License Key'}
              </button>
            </form>
          </div>
        )}

        {/* ── Activated — show final license key ────────────────────────── */}
        {viewState === 'activated' && (
          <div className="rounded-2xl border border-green-500/25 bg-green-500/5 p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-green-500/15 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">License Activated!</h1>
            <p className="text-white/50 text-sm mb-6">
              Copy the key below and enter it in the HL-MCK app
            </p>

            <div className="bg-black/40 border border-white/10 rounded-xl p-4 mb-5">
              <p className="text-white/30 text-[10px] uppercase tracking-widest font-semibold mb-2">
                Your License Key
              </p>
              <p className="text-[#00bcd4] font-mono font-bold text-xl tracking-widest">
                {licenseKey}
              </p>
            </div>

            <button
              onClick={handleCopy}
              className="w-full bg-[#00bcd4] hover:bg-[#00bcd4]/90 text-white font-semibold py-3 rounded-xl transition-all text-sm mb-5"
            >
              {copied ? '✓ Copied to clipboard' : 'Copy License Key'}
            </button>

            <p className="text-white/30 text-xs leading-relaxed">
              Open HL-MCK Browser → Settings → License tab → Paste key → Activate
            </p>
          </div>
        )}

        {/* ── Verifying ─────────────────────────────────────────────────── */}
        {viewState === 'verifying' && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-[#00bcd4]/10 flex items-center justify-center mx-auto mb-4">
              <div className="w-8 h-8 border-2 border-[#00bcd4]/30 border-t-[#00bcd4] rounded-full animate-spin" />
            </div>
            <h1 className="text-xl font-bold text-white mb-2">Verifying Payment…</h1>
            <p className="text-white/50 text-sm">
              {retries > 0 ? `Checking… (attempt ${retries + 1}/5)` : 'Please wait a moment'}
            </p>
          </div>
        )}

        {/* ── Cancelled ─────────────────────────────────────────────────── */}
        {viewState === 'cancelled' && (
          <div className="rounded-2xl border border-yellow-500/25 bg-yellow-500/5 p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-yellow-500/10 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-white mb-2">Payment Cancelled</h1>
            <p className="text-white/50 text-sm mb-6">No charge was made to your account.</p>
            <Link
              to="/checkout?tier=pro"
              className="inline-block bg-[#00bcd4] hover:bg-[#00bcd4]/90 text-white font-semibold py-2.5 px-6 rounded-xl text-sm transition-all"
            >
              Try Again
            </Link>
          </div>
        )}

        {/* ── Error ─────────────────────────────────────────────────────── */}
        {viewState === 'error' && (
          <div className="rounded-2xl border border-red-500/25 bg-red-500/5 p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-white mb-2">Could not verify payment</h1>
            <p className="text-white/50 text-sm mb-1 leading-relaxed">
              If you completed payment on PayOS, please contact support with order code:
            </p>
            <p className="text-white font-mono text-sm mb-6">{orderCode}</p>
            <Link to="/" className="text-[#00bcd4] underline text-sm">Back to home</Link>
          </div>
        )}

      </div>
    </div>
  );
}
