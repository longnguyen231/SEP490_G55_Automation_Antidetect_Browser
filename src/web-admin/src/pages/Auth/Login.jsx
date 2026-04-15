import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import toast from 'react-hot-toast';

// ─── Icons ────────────────────────────────────────────────────────────────────
const GoogleIcon = () => (
  <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="none">
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

// ─── Firebase error messages → human-readable Vietnamese ──────────────────────
function parseFirebaseError(err) {
  const code = err?.code || '';
  const map = {
    'auth/user-not-found':        'Email does not exist in the system.',
    'auth/wrong-password':        'Incorrect password.',
    'auth/invalid-email':         'Invalid email.',
    'auth/invalid-credential':    'Email or password is incorrect.',
    'auth/too-many-requests':     'Too many attempts. Please try again later.',
    'auth/popup-closed-by-user':  'Sign-in popup closed.',
    'auth/popup-blocked':         'Browser blocked popup. Please allow popups and try again.',
    'auth/account-exists-with-different-credential':
      'This email is already registered with a different method.',
    'auth/network-request-failed': 'Network error. Check your internet connection.',
    'auth/configuration-not-found':
      'Firebase not configured. Please fill firebaseConfig in src/config/firebase.config.js',
  };
  return map[code] || err?.message || 'An error occurred. Please try again.';
}

// ─── Main component ───────────────────────────────────────────────────────────
const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, loginWithGoogle } = useAuthStore();

  const [email, setEmail]     = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]   = useState(false);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);

  // Show success toast if redirected from email verification
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('verified') === '1') {
      toast.success('Email verified! Please login to continue.');
    }
  }, [location.search]);

  const from = location.state?.from?.pathname || null;

  const handleRedirect = (user) => {
    if (from && from !== '/login' && from !== '/register') {
      navigate(from, { replace: true });
    } else if (user.role === 'admin') {
      navigate('/dashboard', { replace: true });
    } else {
      navigate('/', { replace: true });
    }
  };

  // ── Email / password ──────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setLoading(true);
    try {
      const user = await login({ email: email.trim(), password });
      toast.success(`Chào mừng trở lại, ${user.name}!`);
      handleRedirect(user);
    } catch (err) {
      toast.error(parseFirebaseError(err));
    } finally {
      setLoading(false);
    }
  };

  // ── Google OAuth ──────────────────────────────────────────────────────────
  const handleGoogle = async () => {
    setOauthLoading(true);
    try {
      const user = await loginWithGoogle();
      toast.success(`Logged in with Google: ${user.name}`);
      handleRedirect(user);
    } catch (err) {
      if (err?.code !== 'auth/popup-closed-by-user') {
        toast.error(parseFirebaseError(err));
      }
    } finally {
      setOauthLoading(false);
    }
  };

  const isSubmitting = loading || oauthLoading;

  return (
    <div className="min-h-screen bg-background-dark flex items-center justify-center p-4 font-display">
      {/* Background glows */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/3 w-80 h-80 rounded-full bg-primary/8 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/3 w-80 h-80 rounded-full bg-cyan-500/5 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="bg-slate-900/80 border border-slate-700/60 rounded-2xl p-8 shadow-2xl backdrop-blur-sm">

          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="bg-primary/20 p-2 rounded-xl">
                <span className="material-symbols-outlined text-primary text-3xl">shield_person</span>
              </div>
              <span className="text-2xl font-extrabold tracking-tight text-white">Vanguard</span>
            </div>
            <h1 className="text-xl font-bold text-white">Chào mừng trở lại</h1>
            <p className="text-sm text-slate-400 mt-1">Đăng nhập vào tài khoản của bạn</p>
          </div>

          {/* OAuth buttons */}
          <div className="space-y-3">
            <button
              onClick={handleGoogle}
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-xl
                bg-white/5 border border-slate-700/60 text-slate-200 text-sm font-medium
                hover:bg-white/10 hover:border-slate-600 transition-all duration-200
                disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {oauthLoading ? (
                <span className="w-5 h-5 border-2 border-primary/40 border-t-primary rounded-full animate-spin" />
              ) : <GoogleIcon />}
              Đăng nhập bằng Google
            </button>
          </div>

          <OrDivider />

          {/* Email + password form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-widest">
                Email
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-500 text-lg pointer-events-none">mail</span>
                <input
                  type="email" required autoComplete="email"
                  value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  disabled={isSubmitting}
                  className="w-full bg-slate-800/60 border border-slate-700/60 rounded-xl pl-10 pr-4 py-2.5
                    text-sm text-slate-200 placeholder-slate-600
                    focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30
                    disabled:opacity-50 transition-colors"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest">Mật khẩu</label>
                <Link to="/forgot-password" className="text-xs text-primary hover:text-primary/80 transition-colors cursor-pointer">
                  Quên mật khẩu?
                </Link>
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-500 text-lg pointer-events-none">lock</span>
                <input
                  type={showPw ? 'text' : 'password'} required autoComplete="current-password"
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={isSubmitting}
                  className="w-full bg-slate-800/60 border border-slate-700/60 rounded-xl pl-10 pr-11 py-2.5
                    text-sm text-slate-200 placeholder-slate-600
                    focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30
                    disabled:opacity-50 transition-colors"
                />
                <button type="button" onClick={() => setShowPw(v => !v)} tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer">
                  <span className="material-symbols-outlined text-lg">{showPw ? 'visibility_off' : 'visibility'}</span>
                </button>
              </div>
            </div>

            <button
              type="submit" disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl
                bg-primary text-background-dark font-bold text-sm
                hover:bg-primary/90 transition-all duration-200
                shadow-lg shadow-primary/25 hover:shadow-primary/40
                disabled:opacity-60 disabled:cursor-not-allowed mt-2"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-background-dark/40 border-t-background-dark rounded-full animate-spin" />
                  Đang đăng nhập…
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-lg">login</span>
                  Đăng Nhập
                </>
              )}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-6">
            Chưa có tài khoản?{' '}
            <Link to="/register" className="text-primary font-semibold hover:text-primary/80 transition-colors cursor-pointer">
              Đăng ký ngay
            </Link>
          </p>
        </div>

        <div className="text-center mt-5">
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-primary transition-colors cursor-pointer">
            <span className="material-symbols-outlined text-base">arrow_back</span>
            Về trang chủ
          </Link>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
