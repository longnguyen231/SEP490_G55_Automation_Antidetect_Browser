import React, { useState } from 'react';
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

  const { user } = useAuthStore();
  const tierInfo = TIER_INFO[tier];

  const [email, setEmail] = useState(user?.email || '');
  const [loading, setLoading] = useState(false);

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

  async function handlePayosSubmit(e) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      toast.error('Please enter a valid email address.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/create-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed, tier }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create payment');
      window.location.href = data.checkoutUrl;
    } catch (err) {
      toast.error(err.message);
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#080a0c] flex flex-col items-center justify-center p-4">
      {/* Back link */}
      <div className="w-full max-w-lg mb-6">
        <Link
          to="/#pricing"
          className="text-[#00bcd4] text-sm font-medium inline-flex items-center gap-1 hover:opacity-80 transition-opacity"
        >
          ← Back to pricing
        </Link>
      </div>

      <div className="w-full max-w-lg">
        {/* Card */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8">
          {/* Header */}
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-xl bg-[#00bcd4]/10 border border-[#00bcd4]/20 flex items-center justify-center shrink-0">
              <svg className="w-6 h-6 text-[#00bcd4]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <h2 className="text-white font-bold text-lg leading-tight">{tierInfo.name} License</h2>
              <p className="text-[#00bcd4] font-semibold text-sm">{tierInfo.priceLabel} · {tierInfo.period}</p>
            </div>
          </div>

          {/* Features */}
          <ul className="space-y-2 mb-6">
            {tierInfo.features.map((f) => (
              <li key={f} className="flex items-center gap-2.5 text-white/60 text-sm">
                <span className="shrink-0 w-4 h-4 rounded-full bg-[#00bcd4]/20 flex items-center justify-center text-[#00bcd4] text-[10px] font-bold">
                  ✓
                </span>
                {f}
              </li>
            ))}
          </ul>

          <hr className="border-white/10 mb-6" />

          {/* Payment form */}
          <form onSubmit={handlePayosSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1.5">
                Email to receive license
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                disabled={loading}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-[#00bcd4]/50 focus:ring-1 focus:ring-[#00bcd4]/30 disabled:opacity-50 transition"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-[#00bcd4] to-cyan-500 hover:opacity-90 disabled:opacity-50 text-black font-bold py-3.5 rounded-xl transition-all text-sm flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Redirecting to PayOS…
                </>
              ) : (
                `Pay ${tierInfo.priceLabel} with PayOS`
              )}
            </button>

            <p className="text-white/25 text-xs text-center">
              Secure payment via PayOS · Your license key will be sent after payment
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
