import React, { useState, useEffect } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();
  const tier = searchParams.get('tier') || 'pro';

  const { user } = useAuthStore();
  const tierInfo = TIER_INFO[tier];

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
        {/* Notice banner */}
        <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/8 px-5 py-4 flex items-start gap-3">
          <svg className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-amber-300 font-semibold text-sm mb-0.5">Paid licensing is temporarily disabled</p>
            <p className="text-amber-400/70 text-xs leading-relaxed">
              We're offering a free 30-day trial instead. No credit card required.
            </p>
          </div>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#00bcd4]/10 border border-[#00bcd4]/20 flex items-center justify-center mx-auto mb-5">
            <svg className="w-7 h-7 text-[#00bcd4]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>

          <h2 className="text-white font-bold text-xl mb-2">Get Free 30-Day Trial</h2>
          <p className="text-white/40 text-sm mb-6 max-w-xs mx-auto">
            Try all Pro features for free — automation, unlimited profiles, and REST API.
          </p>

          <ul className="space-y-2.5 mb-8 text-left">
            {tierInfo.features.map((f) => (
              <li key={f} className="flex items-center gap-2.5 text-white/70 text-sm">
                <span className="shrink-0 w-4 h-4 rounded-full bg-[#00bcd4]/20 flex items-center justify-center text-[#00bcd4] text-[10px] font-bold">
                  ✓
                </span>
                {f}
              </li>
            ))}
          </ul>

          <button
            onClick={() => navigate('/my-license')}
            className="w-full bg-gradient-to-r from-[#00bcd4] to-cyan-500 hover:opacity-90 text-black font-bold py-3.5 rounded-xl transition-all text-sm"
          >
            🚀 Start Free Trial
          </button>

          <p className="text-white/25 text-xs mt-4">
            One trial per account · No payment required
          </p>
        </div>

        {/*
          ── PAYMENT_DISABLED ──────────────────────────────────────────────────
          Real PayOS payment is commented out. To re-enable:
          1. Uncomment the form below
          2. Remove the notice banner and free trial card above
          3. Ensure PAYOS_CLIENT_ID, PAYOS_API_KEY, PAYOS_CHECKSUM_KEY are set in .env

        <form onSubmit={handlePayosSubmit} className="...">
          <input type="email" value={email} onChange={...} />
          <button type="submit">Pay {tierInfo.priceLabel} with PayOS</button>
        </form>
        ── END PAYMENT_DISABLED ──────────────────────────────────────────── */}
      </div>
    </div>
  );
}
