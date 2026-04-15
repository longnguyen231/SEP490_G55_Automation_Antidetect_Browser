/**
 * PublicRequest.jsx
 *
 * Page for authenticated users to submit a license request.
 * Uses react-hook-form + yup for validation, Antd for UI, date-fns for dates.
 * Reads ?tier= query param to pre-select the tier.
 */

import React, { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Select, ConfigProvider, theme } from 'antd';
import { ArrowLeft, Send, KeyRound, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../store/authStore';
import { useLicenseStore } from '../../store/licenseStore';
import { TIER_CONFIG } from '../../services/licenseService';

const { Option } = Select;

// ─── Validation schema ────────────────────────────────────────────────────────
const schema = yup.object({
  tier: yup.string().oneOf(['free', 'pro', 'enterprise'], 'Please select a valid plan').required('Please select a plan'),
  durationDays: yup.mixed().nullable(),
  reason: yup.string().max(500, 'Maximum 500 characters'),
});

// ─── Duration select options per tier ─────────────────────────────────────────
function getDurationOptions(tier) {
  return TIER_CONFIG[tier]?.durationOptions ?? [];
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function PublicRequest() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuthStore();
  const { submitRequest, submitting, myRequests, fetchMyRequests } = useLicenseStore();

  const defaultTier = searchParams.get('tier') || 'pro';

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: yupResolver(schema),
    defaultValues: {
      tier: ['free', 'pro', 'enterprise'].includes(defaultTier) ? defaultTier : 'pro',
      durationDays: TIER_CONFIG[defaultTier]?.defaultDuration ?? 30,
      reason: '',
    },
  });

  const selectedTier = watch('tier');

  // When tier changes, reset durationDays to the tier's default
  useEffect(() => {
    const def = TIER_CONFIG[selectedTier]?.defaultDuration ?? null;
    setValue('durationDays', def);
  }, [selectedTier, setValue]);

  // Fetch user's existing requests to check for pending ones
  useEffect(() => {
    if (user?.id) fetchMyRequests(user.id);
  }, [user?.id, fetchMyRequests]);

  const hasPendingRequest = myRequests.some((r) => r.status === 'pending');

  const onSubmit = async (data) => {
    try {
      await submitRequest({
        userId: user.id,
        email: user.email,
        name: user.name,
        tier: data.tier,
        durationDays: data.durationDays,
        reason: data.reason,
      });
      toast.success('License request submitted! Admin will review it shortly.');
      navigate('/my-license');
    } catch (err) {
      toast.error('Failed to submit request: ' + err.message);
    }
  };

  const tierConfig = TIER_CONFIG[selectedTier] || {};
  const durationOptions = getDurationOptions(selectedTier);

  return (
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: { colorPrimary: '#00bcd4', borderRadius: 8, colorBgContainer: '#1e293b', colorBorder: 'rgba(148,163,184,0.15)' },
      }}
    >
      <div className="min-h-screen bg-background-dark text-slate-100 font-display">
        {/* Navbar */}
        <header className="border-b border-slate-800/60 px-6 py-4 flex items-center gap-4">
          <Link
            to="/"
            className="flex items-center gap-2 text-slate-400 hover:text-primary transition-colors text-sm"
          >
            <ArrowLeft size={16} />
            Home
          </Link>
          <span className="text-slate-700">/</span>
          <span className="text-sm text-slate-300">Request License</span>
        </header>

        <main className="max-w-2xl mx-auto px-6 py-14">
          {/* Title */}
          <div className="mb-10">
            <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-5">
              <KeyRound size={22} className="text-primary" />
            </div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight mb-2">Request License Key</h1>
            <p className="text-slate-400 text-sm">
              Fill in the form below. Admin will review and issue a JWT license key to your account.
            </p>
          </div>

          {/* Warning: has pending request */}
          {hasPendingRequest && (
            <div className="mb-6 p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 flex items-start gap-3">
              <span className="material-symbols-outlined text-amber-400 text-lg mt-0.5">info</span>
              <div>
                <p className="text-sm font-semibold text-amber-400">You already have a pending request.</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  You can still submit a new one.{' '}
                  <Link to="/my-license" className="text-primary underline">View status →</Link>
                </p>
              </div>
            </div>
          )}

          {/* User info display */}
          <div className="mb-8 p-4 rounded-xl border border-slate-700/50 bg-slate-800/40 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm flex-shrink-0">
              {user?.name?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate">{user?.name}</p>
              <p className="text-xs text-slate-400 truncate">{user?.email}</p>
            </div>
            <span className="ml-auto text-xs text-slate-500 flex-shrink-0">License will be tied to this account</span>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Tier select */}
            <div>
              <label className="block text-sm font-semibold text-slate-200 mb-2">
                Select plan <span className="text-rose-400">*</span>
              </label>
              <div className="grid grid-cols-3 gap-3">
                {['free', 'pro', 'enterprise'].map((t) => {
                  const cfg = TIER_CONFIG[t];
                  const isSelected = selectedTier === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setValue('tier', t, { shouldValidate: true })}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        isSelected
                          ? 'border-primary bg-primary/10'
                          : 'border-slate-700/50 bg-slate-800/30 hover:border-primary/40'
                      }`}
                    >
                      <p className="text-sm font-bold text-primary">{cfg.label}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{cfg.price}</p>
                    </button>
                  );
                })}
              </div>
              {errors.tier && <p className="mt-1.5 text-xs text-rose-400">{errors.tier.message}</p>}
            </div>

            {/* Duration select */}
            <div>
              <label className="block text-sm font-semibold text-slate-200 mb-2">
                Duration <span className="text-rose-400">*</span>
              </label>
              <Controller
                name="durationDays"
                control={control}
                render={({ field }) => (
                  <Select
                    {...field}
                    style={{ width: '100%' }}
                    size="large"
                    placeholder="Chọn thời hạn"
                    popupMatchSelectWidth
                  >
                    {durationOptions.map((opt) => (
                      <Option key={String(opt.value)} value={opt.value}>
                        {opt.label}
                      </Option>
                    ))}
                  </Select>
                )}
              />
              {errors.durationDays && (
                <p className="mt-1.5 text-xs text-rose-400">{errors.durationDays.message}</p>
              )}
            </div>

            {/* Reason / note */}
            <div>
              <label className="block text-sm font-semibold text-slate-200 mb-2">
                Note (optional)
              </label>
              <textarea
                {...register('reason')}
                rows={3}
                placeholder="Describe your use case, project, or any special requirements..."
                className="w-full rounded-xl border border-slate-700/50 bg-slate-800/60 text-slate-200 placeholder-slate-500
                  text-sm px-4 py-3 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 resize-none transition"
              />
              {errors.reason && <p className="mt-1 text-xs text-rose-400">{errors.reason.message}</p>}
            </div>

            {/* Selected tier summary */}
            {tierConfig.featureLabels && (
              <div className="p-4 rounded-xl border border-slate-700/30 bg-slate-800/30">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
                  Selected plan: <span className="text-primary">{tierConfig.label}</span>
                </p>
                <ul className="space-y-1.5">
                  {tierConfig.featureLabels.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-xs text-slate-300">
                      <Check size={11} className={tierConfig.color + ' flex-shrink-0'} />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Submit */}
            <div className="flex items-center gap-4 pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-background-dark
                  font-semibold text-sm hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed
                  shadow-lg shadow-primary/20"
              >
                <Send size={16} />
                {submitting ? 'Submitting...' : 'Submit Request'}
              </button>
              <Link to="/" className="text-sm text-slate-400 hover:text-white transition-colors">
                Cancel
              </Link>
            </div>
          </form>

          {/* Info note */}
          <div className="mt-10 p-4 rounded-xl border border-slate-700/30 bg-slate-800/20 text-xs text-slate-500 space-y-1">
            <p>📋 After submitting, admin will review your request within 24 hours.</p>
            <p>📧 Your JWT license key will appear in <Link to="/my-license" className="text-primary">My License</Link> once approved.</p>
            <p>🔑 Copy the JWT key and paste it into the app → Settings → License → Activate.</p>
          </div>
        </main>
      </div>
    </ConfigProvider>
  );
}
