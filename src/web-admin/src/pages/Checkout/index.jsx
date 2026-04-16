import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import toast from 'react-hot-toast';

// ── Tier catalogue ────────────────────────────────────────────────────────────
const TIER_INFO = {
  pro: {
    name: 'Pro',
    priceLabel: '10.000₫',
    period: 'one-time license',
    features: [
      'Unlimited browser profiles',
      'Advanced fingerprint spoofing',
      'Full automation engine',
      'REST API access',
      'Priority support',
      'All future updates',
    ],
  },
};

// ── Page ──────────────────────────────────────────────────────────────────────
export default function CheckoutPage() {
  const [searchParams] = useSearchParams();
  const tier = searchParams.get('tier') || 'pro';
  const cancelled = searchParams.get('cancelled') === 'true';

  const { user } = useAuthStore();
  const [email, setEmail] = useState(user?.email || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Sync email if auth state loads after component mounts (e.g. after redirect from login)
  useEffect(() => {
    if (user?.email && !email) setEmail(user.email);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.email]);

  const tierInfo = TIER_INFO[tier];

  useEffect(() => {
    if (cancelled) {
      toast.error('Payment was cancelled. You can try again.', { id: 'cancelled' });
    }
  }, [cancelled]);

  if (!tierInfo) {
    return (
      <div className="min-h-screen bg-[#080a0c] flex items-center justify-center">
        <p className="text-white/60">
          Invalid tier.{' '}
          <Link to="/#pricing" className="text-[#00bcd4] underline">
            See plans
          </Link>
        </p>
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/create-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, tier }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create payment');
      window.location.href = data.checkoutUrl;
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#080a0c] flex flex-col items-center justify-center p-4">
      {/* Back link */}
      <div className="w-full max-w-4xl mb-6">
        <Link
          to="/#pricing"
          className="text-[#00bcd4] text-sm font-medium inline-flex items-center gap-1 hover:opacity-80 transition-opacity"
        >
          ← Back to pricing
        </Link>
      </div>

      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* ── Order summary ─────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 self-start">
          <p className="text-white/40 text-xs font-semibold uppercase tracking-widest mb-4">
            Order Summary
          </p>

          <div className="flex items-start justify-between mb-1">
            <div>
              <h2 className="text-white font-bold text-lg">HL-MCK {tierInfo.name} License</h2>
              <p className="text-white/40 text-xs mt-0.5">{tierInfo.period}</p>
            </div>
            <span className="text-[#00bcd4] font-bold text-xl">{tierInfo.priceLabel}</span>
          </div>

          <div className="my-5 border-t border-white/10" />

          <ul className="space-y-2.5 mb-6">
            {tierInfo.features.map((f) => (
              <li key={f} className="flex items-center gap-2.5 text-white/70 text-sm">
                <span className="shrink-0 w-4 h-4 rounded-full bg-[#00bcd4]/20 flex items-center justify-center text-[#00bcd4] text-[10px] font-bold">
                  ✓
                </span>
                {f}
              </li>
            ))}
          </ul>

          <div className="border-t border-white/10 pt-4 flex items-center justify-between">
            <span className="text-white/70 font-medium">Total due today</span>
            <span className="text-white font-bold text-xl">{tierInfo.priceLabel}</span>
          </div>
        </div>

        {/* ── Payment form ──────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <p className="text-white/40 text-xs font-semibold uppercase tracking-widest mb-4">
            Contact Information
          </p>
          <h2 className="text-white font-bold text-lg mb-1">Complete Purchase</h2>
          <p className="text-white/40 text-sm mb-6">
            Your license key will be shown immediately after payment
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-white/60 text-sm mb-1.5" htmlFor="email">
                Email address
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full bg-white/5 border border-white/15 rounded-lg px-4 py-2.5 text-white placeholder-white/25 focus:outline-none focus:border-[#00bcd4] text-sm transition-colors"
              />
              <p className="text-white/30 text-xs mt-1.5">
                Only used to identify your license key on this page
              </p>
            </div>

            {error && (
              <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#00bcd4] hover:bg-[#00bcd4]/90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-all text-sm"
            >
              {loading
                ? 'Redirecting to PayOS...'
                : `Pay ${tierInfo.priceLabel} with PayOS`}
            </button>

            <p className="text-white/25 text-xs text-center leading-relaxed">
              Secure payment via PayOS · QR, ATM card, Visa / Mastercard supported
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
