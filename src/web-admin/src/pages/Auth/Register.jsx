import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import toast from 'react-hot-toast';

// ─── OAuth mock profiles ──────────────────────────────────────────────────────
const GOOGLE_MOCK = {
  name: 'Nguyễn Minh Khôi',
  email: 'minhkhoi.nguyen@gmail.com',
  avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDTZeE4lcD3rTLJIN7QPf6xmNMngrZWIxqohovsaT1w9JroY68p8jUf2q-s1gcwTTNzauTZBx-lJN_gmkSRypzOkD0T1RZbcScl2tD8NVtaRTs9m0OTOEmPvgf2mU6GxpRdHVMX5pnu67a_hHrQ7YdsIRc9hBFLpDUPl5G5lbON-1DxZp4M7C5K-rB6a4tBL1x6oUF9HTuOk_-pO_S_dLlrW90b5R-K0fMZ-mkoWB3X2sl1ZOdt4p_n5k5a7RuV0K_J-3rVnGbk0Hyg',
  provider: 'google',
};

const GoogleIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

const OrDivider = () => (
  <div className="flex items-center gap-3 my-6">
    <div className="flex-1 h-px bg-slate-700/60" />
    <span className="text-xs text-slate-500 font-medium uppercase tracking-widest">or</span>
    <div className="flex-1 h-px bg-slate-700/60" />
  </div>
);

// ─── Password strength helper ─────────────────────────────────────────────────
function getStrength(pw) {
  if (!pw) return { level: 0, label: '', color: '' };
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const map = [
    { level: 0, label: '', color: '' },
    { level: 1, label: 'Weak', color: 'bg-rose-500' },
    { level: 2, label: 'Fair', color: 'bg-amber-400' },
    { level: 3, label: 'Good', color: 'bg-emerald-400' },
    { level: 4, label: 'Strong', color: 'bg-primary' },
  ];
  return map[score] ?? map[0];
}

// ─── Main component ───────────────────────────────────────────────────────────
const RegisterPage = () => {
  const navigate = useNavigate();
  const { register: authRegister, oauthLogin } = useAuthStore();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [agree, setAgree] = useState(false);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);

  const strength = getStrength(password);
  const pwMatch = confirm.length === 0 || password === confirm;
  const isSubmitting = loading || oauthLoading;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!agree) { toast.error('Please agree to the terms.'); return; }
    if (password !== confirm) { toast.error('Passwords do not match.'); return; }
    if (password.length < 8) { toast.error('Password must be at least 8 characters.'); return; }
    setLoading(true);
    try {
      await new Promise((r) => setTimeout(r, 600));
      authRegister({ name: name.trim(), email: email.trim(), password });
      toast.success('Account created! Welcome to Vanguard.');
      navigate('/', { replace: true });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleRegister = async () => {
    setOauthLoading(true);
    try {
      await new Promise((r) => setTimeout(r, 900));
      oauthLogin({ provider: 'google', mockProfile: GOOGLE_MOCK });
      toast.success('Signed up with Google!');
      navigate('/', { replace: true });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setOauthLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background-dark flex items-center justify-center p-4 font-display">
      {/* Background glows */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute top-1/4 right-1/3 w-80 h-80 rounded-full bg-primary/8 blur-3xl" />
        <div className="absolute bottom-1/3 left-1/4 w-72 h-72 rounded-full bg-cyan-500/5 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="bg-slate-900/80 border border-slate-700/60 rounded-2xl p-8 shadow-2xl backdrop-blur-sm">

          {/* Logo */}
          <div className="flex flex-col items-center mb-7">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="bg-primary/20 p-2 rounded-xl">
                <span className="material-symbols-outlined text-primary text-3xl">shield_person</span>
              </div>
              <span className="text-2xl font-extrabold tracking-tight text-white">Vanguard</span>
            </div>
            <h1 className="text-xl font-bold text-white">Create your account</h1>
            <p className="text-sm text-slate-400 mt-1">Free forever — no credit card required</p>
          </div>

          {/* Google OAuth (register only – Facebook for login) */}
          <button
            onClick={handleGoogleRegister}
            disabled={isSubmitting}
            className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-xl
              bg-white/5 border border-slate-700/60 text-slate-200 text-sm font-medium
              hover:bg-white/10 hover:border-slate-600 transition-all duration-200
              disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {oauthLoading ? (
              <span className="w-5 h-5 border-2 border-primary/40 border-t-primary rounded-full animate-spin" />
            ) : (
              <GoogleIcon />
            )}
            Sign up with Google
          </button>

          <OrDivider />

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-widest">
                Full name
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-500 text-lg pointer-events-none">
                  person
                </span>
                <input
                  type="text"
                  required
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  disabled={isSubmitting}
                  className="w-full bg-slate-800/60 border border-slate-700/60 rounded-xl pl-10 pr-4 py-2.5
                    text-sm text-slate-200 placeholder-slate-600
                    focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30
                    disabled:opacity-50 transition-colors"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-widest">
                Email address
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-500 text-lg pointer-events-none">
                  mail
                </span>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  disabled={isSubmitting}
                  className="w-full bg-slate-800/60 border border-slate-700/60 rounded-xl pl-10 pr-4 py-2.5
                    text-sm text-slate-200 placeholder-slate-600
                    focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30
                    disabled:opacity-50 transition-colors"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-widest">
                Password
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-500 text-lg pointer-events-none">
                  lock
                </span>
                <input
                  type={showPw ? 'text' : 'password'}
                  required
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  disabled={isSubmitting}
                  className="w-full bg-slate-800/60 border border-slate-700/60 rounded-xl pl-10 pr-11 py-2.5
                    text-sm text-slate-200 placeholder-slate-600
                    focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30
                    disabled:opacity-50 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  <span className="material-symbols-outlined text-lg">
                    {showPw ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>

              {/* Strength bar */}
              {password && (
                <div className="mt-2 space-y-1">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                          i <= strength.level ? strength.color : 'bg-slate-700'
                        }`}
                      />
                    ))}
                  </div>
                  <p className={`text-xs font-medium ${
                    strength.level <= 1 ? 'text-rose-400' :
                    strength.level === 2 ? 'text-amber-400' :
                    'text-emerald-400'
                  }`}>
                    {strength.label}
                  </p>
                </div>
              )}
            </div>

            {/* Confirm password */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-widest">
                Confirm password
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-500 text-lg pointer-events-none">
                  lock_reset
                </span>
                <input
                  type={showPw ? 'text' : 'password'}
                  required
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Re-enter password"
                  disabled={isSubmitting}
                  className={`w-full bg-slate-800/60 border rounded-xl pl-10 pr-4 py-2.5
                    text-sm text-slate-200 placeholder-slate-600
                    focus:outline-none focus:ring-1 disabled:opacity-50 transition-colors
                    ${!pwMatch ? 'border-rose-500/70 focus:border-rose-500 focus:ring-rose-500/20' : 'border-slate-700/60 focus:border-primary/60 focus:ring-primary/30'}`}
                />
              </div>
              {!pwMatch && confirm.length > 0 && (
                <p className="text-xs text-rose-400 mt-1">Passwords do not match</p>
              )}
            </div>

            {/* Terms */}
            <label className="flex items-start gap-3 cursor-pointer group">
              <div
                onClick={() => setAgree((v) => !v)}
                className={`mt-0.5 w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center transition-all cursor-pointer
                  ${agree ? 'bg-primary border-primary' : 'border-slate-600 group-hover:border-slate-400'}`}
              >
                {agree && <span className="material-symbols-outlined text-background-dark text-xs" style={{ fontSize: '11px', fontVariationSettings: "'FILL' 1" }}>check</span>}
              </div>
              <span className="text-xs text-slate-400 leading-relaxed">
                I agree to the{' '}
                <span className="text-primary">Terms of Service</span> and{' '}
                <span className="text-primary">Privacy Policy</span>
              </span>
            </label>

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting || !pwMatch}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl
                bg-primary text-background-dark font-bold text-sm
                hover:bg-primary/90 transition-all duration-200
                shadow-lg shadow-primary/25 hover:shadow-primary/40
                disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-background-dark/40 border-t-background-dark rounded-full animate-spin" />
                  Creating account…
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-lg">person_add</span>
                  Create Account
                </>
              )}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-primary font-semibold hover:text-primary/80 transition-colors">
              Sign in
            </Link>
          </p>
        </div>

        <div className="text-center mt-5">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-primary transition-colors"
          >
            <span className="material-symbols-outlined text-base">arrow_back</span>
            Back to homepage
          </Link>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
