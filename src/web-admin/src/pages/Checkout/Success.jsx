import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import toast from 'react-hot-toast';

export default function CheckoutSuccessPage() {
  const [searchParams] = useSearchParams();
  const orderCode = searchParams.get('orderCode');
  // PayOS appends these to returnUrl on redirect
  const payosStatus = searchParams.get('status');   // 'PAID' | 'CANCELLED'
  const payosCode   = searchParams.get('code');     // '00' = success

  const [viewState, setViewState] = useState('verifying'); // verifying | paid | cancelled | error
  const [licenseKey, setLicenseKey] = useState('');
  const [copied, setCopied] = useState(false);
  const [retries, setRetries] = useState(0);

  // ── Verify payment directly via PayOS API ──────────────────────────────────
  useEffect(() => {
    if (!orderCode) { setViewState('error'); return; }

    // PayOS set cancel=true → go back to checkout
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

        if (data.status === 'paid' && data.licenseKey) {
          setLicenseKey(data.licenseKey);
          setViewState('paid');
        } else if (attempts < MAX_ATTEMPTS) {
          // PayOS may take a moment to mark as paid — retry after 2s
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

  // ── Copy handler ───────────────────────────────────────────────────────────
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

        {/* ── Paid ────────────────────────────────────────────────────────── */}
        {viewState === 'paid' && (
          <div className="rounded-2xl border border-green-500/25 bg-green-500/5 p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-green-500/15 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Payment Successful!</h1>
            <p className="text-white/50 text-sm mb-6">
              Copy your license key below and activate it in the HL-MCK desktop app
            </p>

            <div className="bg-black/40 border border-white/10 rounded-xl p-4 mb-5">
              <p className="text-white/30 text-[10px] uppercase tracking-widest font-semibold mb-2">
                Your License Key
              </p>
              <p className="text-[#00bcd4] font-mono font-bold text-base tracking-wider break-all">
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
