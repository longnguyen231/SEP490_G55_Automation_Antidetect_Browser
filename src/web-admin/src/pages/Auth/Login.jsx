import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import toast from 'react-hot-toast';

// ─── OAuth mock profiles (simulate what the provider returns) ─────────────────
const GOOGLE_MOCK = {
  name: 'Nguyễn Minh Khôi',
  email: 'minkhoi.nguyen@gmail.com',
  avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDTZeE4lcD3rTLJIN7QPf6xmNMngrZWIxqohovsaT1w9JroY68p8jUf2q-s1gcwTTNzauTZBx-lJN_gmkSRypzOkD0T1RZbcScl2tD8NVtaRTs9m0OTOEmPvgf2mU6GxpRdHVMX5pnu67a_hHrQ7YdsIRc9hBFLpDUPl5G5lbON-1DxZp4M7C5K-rB6a4tBL1x6oUF9HTuOk_-pO_S_dLlrW90b5R-K0fMZ-mkoWB3X2sl1ZOdt4p_n5k5a7RuV0K_J-3rVnGbk0Hyg',
  provider: 'google',
};
const FACEBOOK_MOCK = {
  name: 'Trần Thị Ánh Tuất',
  email: 'anhtuat.tran@facebook.com',
  // UI Avatars generates a profile-style placeholder with Facebook brand colour
  avatar: 'https://ui-avatars.com/api/?name=Tran+Thi+Anh+Tuat&background=1877F2&color=fff&size=128&bold=true',
  provider: 'facebook',
};

// ─── Divider ──────────────────────────────────────────────────────────────────
const OrDivider = () => (
  <div className="flex items-center gap-3 my-6">
    <div className="flex-1 h-px bg-slate-700/60" />
    <span className="text-xs text-slate-500 font-medium uppercase tracking-widest">or</span>
    <div className="flex-1 h-px bg-slate-700/60" />
  </div>
);

// ─── Google SVG icon ──────────────────────────────────────────────────────────
const GoogleIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

// ─── Facebook SVG icon ────────────────────────────────────────────────────────
const FacebookIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#1877F2">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
  </svg>
);

// ─── Main component ───────────────────────────────────────────────────────────
const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, oauthLogin } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(null); // 'google' | 'facebook'

  // Redirect destination after login (default: landing page; admins go to dashboard)
  const from = location.state?.from?.pathname || null;

  const handleRedirect = (user) => {
    if (from) {
      navigate(from, { replace: true });
    } else if (user.role === 'admin') {
      navigate('/dashboard', { replace: true });
    } else {
      navigate('/', { replace: true });
    }
  };

  // ── Email / password login ──────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setLoading(true);
    try {
      // Simulate network delay
      await new Promise((r) => setTimeout(r, 600));
      const user = login({ email: email.trim(), password });
      toast.success(`Welcome back, ${user.name}!`);
      handleRedirect(user);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── OAuth ───────────────────────────────────────────────────────────────────
  const handleOAuth = async (provider) => {
    setOauthLoading(provider);
    try {
      // Fake OAuth popup delay
      await new Promise((r) => setTimeout(r, 900));
      const mockProfile = provider === 'google' ? GOOGLE_MOCK : FACEBOOK_MOCK;
      const user = oauthLogin({ provider, mockProfile });
      toast.success(`Signed in with ${provider === 'google' ? 'Google' : 'Facebook'}!`);
      handleRedirect(user);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setOauthLoading(null);
    }
  };

  const isSubmitting = loading || oauthLoading !== null;

  return (
    <div className="min-h-screen bg-background-dark flex items-center justify-center p-4 font-display">
      {/* Background glows */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/3 w-80 h-80 rounded-full bg-primary/8 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/3 w-80 h-80 rounded-full bg-cyan-500/5 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Card */}
        <div className="bg-slate-900/80 border border-slate-700/60 rounded-2xl p-8 shadow-2xl backdrop-blur-sm">

          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="bg-primary/20 p-2 rounded-xl">
                <span className="material-symbols-outlined text-primary text-3xl">shield_person</span>
              </div>
              <span className="text-2xl font-extrabold tracking-tight text-white">Vanguard</span>
            </div>
            <h1 className="text-xl font-bold text-white">Welcome back</h1>
            <p className="text-sm text-slate-400 mt-1">Sign in to your account</p>
          </div>

          {/* OAuth buttons */}
          <div className="space-y-3">
            <button
              onClick={() => handleOAuth('google')}
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-xl
                bg-white/5 border border-slate-700/60 text-slate-200 text-sm font-medium
                hover:bg-white/10 hover:border-slate-600 transition-all duration-200
                disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {oauthLoading === 'google' ? (
                <span className="w-5 h-5 border-2 border-primary/40 border-t-primary rounded-full animate-spin" />
              ) : (
                <GoogleIcon />
              )}
              Continue with Google
            </button>

            <button
              onClick={() => handleOAuth('facebook')}
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-xl
                bg-white/5 border border-slate-700/60 text-slate-200 text-sm font-medium
                hover:bg-white/10 hover:border-slate-600 transition-all duration-200
                disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {oauthLoading === 'facebook' ? (
                <span className="w-5 h-5 border-2 border-[#1877F2]/40 border-t-[#1877F2] rounded-full animate-spin" />
              ) : (
                <FacebookIcon />
              )}
              Continue with Facebook
            </button>
          </div>

          <OrDivider />

          {/* Email / password form */}
          <form onSubmit={handleSubmit} className="space-y-4">
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
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest">
                  Password
                </label>
                <Link
                  to="/forgot-password"
                  className="text-xs text-primary hover:text-primary/80 transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-500 text-lg pointer-events-none">
                  lock
                </span>
                <input
                  type={showPw ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
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
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl
                bg-primary text-background-dark font-bold text-sm
                hover:bg-primary/90 transition-all duration-200
                shadow-lg shadow-primary/25 hover:shadow-primary/40
                disabled:opacity-60 disabled:cursor-not-allowed mt-2"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-background-dark/40 border-t-background-dark rounded-full animate-spin" />
                  Signing in…
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-lg">login</span>
                  Sign In
                </>
              )}
            </button>
          </form>

          {/* Register link */}
          <p className="text-center text-sm text-slate-500 mt-6">
            Don't have an account?{' '}
            <Link to="/register" className="text-primary font-semibold hover:text-primary/80 transition-colors">
              Create one
            </Link>
          </p>
        </div>

        {/* Back to home */}
        <div className="text-center mt-5">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-primary transition-colors"
          >
            <span className="material-symbols-outlined text-base">arrow_back</span>
            Back to homepage
          </Link>
        </div>

        {/* Demo hint */}
        <div className="mt-4 p-3 rounded-xl bg-primary/5 border border-primary/15 text-xs text-slate-500 text-center">
          <span className="text-primary font-semibold">Demo admin:</span>{' '}
          <span className="font-mono">admin@vanguard.local</span> /{' '}
          <span className="font-mono">admin123</span>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
