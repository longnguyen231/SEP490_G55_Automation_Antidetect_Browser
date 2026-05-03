import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import toast from 'react-hot-toast';
import EulaModal from '../../components/EulaModal';

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

function getStrength(pw) {
  if (!pw) return { level: 0, label: '', color: '' };
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return [
    { level: 0, label: '', color: '' },
    { level: 1, label: 'Weak', color: 'bg-rose-500' },
    { level: 2, label: 'Fair', color: 'bg-amber-400' },
    { level: 3, label: 'Good', color: 'bg-emerald-400' },
    { level: 4, label: 'Strong', color: 'bg-primary' },
  ][score] ?? { level: 0, label: '', color: '' };
}

function parseFirebaseError(err) {
  const code = err?.code || '';
  const map = {
    'auth/email-already-in-use':   'This email is already registered.',
    'auth/invalid-email':          'Invalid email address.',
    'auth/weak-password':          'Password is too weak (minimum 6 characters).',
    'auth/popup-closed-by-user':   'Sign-in window was closed.',
    'auth/popup-blocked':          'Browser blocked the popup. Please allow popups.',
    'auth/network-request-failed': 'Network error.',
    'auth/configuration-not-found':
      'Firebase is not configured. Fill in firebaseConfig in src/config/firebase.config.js',
  };
  return map[code] || err?.message || 'An error occurred.';
}

// ─── Main component ───────────────────────────────────────────────────────────
const RegisterPage = () => {
  const navigate = useNavigate();
  const { register: authRegister, loginWithGoogle } = useAuthStore();

  const [name, setName]         = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [agree, setAgree]       = useState(false);
  const [loading, setLoading]   = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  // After successful email register → show verify banner
  const [showVerifyBanner, setShowVerifyBanner] = useState(false);
  const [registeredEmail, setRegisteredEmail]   = useState('');
  const [eulaOpen, setEulaOpen] = useState(false);
  const [maintenance, setMaintenance] = useState({ maintenanceMode: false, maintenanceBanner: '' });

  useEffect(() => {
    fetch('/api/status')
      .then(r => r.json())
      .then(d => setMaintenance(d))
      .catch(() => {});
  }, []);

  const strength  = getStrength(password);
  const pwMatch   = confirm.length === 0 || password === confirm;
  const isSubmitting = loading || oauthLoading;

  // ── Email register ──────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!agree)              { toast.error('Please agree to the terms of service.'); return; }
    if (password !== confirm){ toast.error('Passwords do not match.'); return; }
    if (password.length < 6) { toast.error('Password must be at least 6 characters.'); return; }
    setLoading(true);
    try {
      await authRegister({ name: name.trim(), email: email.trim(), password });
      setRegisteredEmail(email.trim());
      setShowVerifyBanner(true);
      toast.success('Account created! Check your email to verify.', { duration: 5000 });
    } catch (err) {
      toast.error(parseFirebaseError(err));
    } finally {
      setLoading(false);
    }
  };

  // ── Google register ─────────────────────────────────────────────────────────
  const handleGoogleRegister = async () => {
    setOauthLoading(true);
    try {
      const user = await loginWithGoogle();
      toast.success(`Registered with Google: ${user.name}`);
      navigate('/', { replace: true });
    } catch (err) {
      if (err?.code !== 'auth/popup-closed-by-user') {
        toast.error(parseFirebaseError(err));
      }
    } finally {
      setOauthLoading(false);
    }
  };

  // ── Email verification banner ───────────────────────────────────────────────
  if (showVerifyBanner) {
    return (
      <div className="min-h-screen bg-background-dark flex items-center justify-center p-4 font-display">
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full bg-primary/8 blur-3xl" />
        </div>

        <div className="relative w-full max-w-md">
          <div className="bg-slate-900/80 border border-primary/20 rounded-2xl p-8 shadow-2xl backdrop-blur-sm text-center">
            {/* Icon */}
            <div className="w-20 h-20 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-6">
              <span className="material-symbols-outlined text-primary text-5xl">mark_email_unread</span>
            </div>

            <h2 className="text-2xl font-extrabold text-white mb-2">Verify your email</h2>
            <p className="text-slate-400 text-sm mb-1">
              We sent a verification email to:
            </p>
            <p className="text-primary font-semibold text-sm mb-6 break-all">{registeredEmail}</p>

            <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4 text-left mb-6 space-y-2">
              {[
                'Open your inbox',
                'Find the email from Firebase / HL-MCK',
                'Click the "Verify email" link',
                'Come back and sign in',
              ].map((step, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <span className="text-sm text-slate-300">{step}</span>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <button
                onClick={async () => {
                  try {
                    const { resendVerificationEmail } = await import('../../services/firebase');
                    await resendVerificationEmail();
                    toast.success('Verification email resent!');
                  } catch {
                    toast.error('Could not resend. Try signing in first.');
                  }
                }}
                className="w-full py-2.5 rounded-xl border border-slate-700/60 text-slate-300 text-sm font-medium
                  hover:border-primary/50 hover:text-primary transition-all duration-200"
              >
                <span className="material-symbols-outlined text-base align-middle mr-1.5">refresh</span>
                Resend email
              </button>

              <Link
                to="/login"
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl
                  bg-primary text-background-dark font-bold text-sm
                  hover:bg-primary/90 transition-colors"
              >
                <span className="material-symbols-outlined text-lg">login</span>
                Go to sign in
              </Link>
            </div>

            <p className="text-xs text-slate-600 mt-5">
              Didn't receive the email? Check your Spam folder.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-dark flex items-center justify-center p-4 font-display">
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
              <span className="text-2xl font-extrabold tracking-tight text-white">HL-MCK</span>
            </div>
            <h1 className="text-xl font-bold text-white">Create account</h1>
            <p className="text-sm text-slate-400 mt-1">Free · No credit card required</p>
          </div>

          {/* Maintenance banner */}
          {maintenance.maintenanceMode && (
            <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 mb-5">
              <span className="material-symbols-outlined text-amber-400 text-lg flex-shrink-0 mt-0.5">construction</span>
              <div>
                <p className="text-amber-400 text-sm font-semibold">Registration Unavailable</p>
                <p className="text-amber-300/70 text-xs mt-0.5">
                  {maintenance.maintenanceBanner || 'New registrations are temporarily disabled. Please try again later.'}
                </p>
              </div>
            </div>
          )}

          {/* Google sign-up */}
          <button
            onClick={handleGoogleRegister}
            disabled={isSubmitting || maintenance.maintenanceMode}
            className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-xl
              bg-white/5 border border-slate-700/60 text-slate-200 text-sm font-medium
              hover:bg-white/10 hover:border-slate-600 transition-all duration-200
              disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {oauthLoading ? (
              <span className="w-5 h-5 border-2 border-primary/40 border-t-primary rounded-full animate-spin" />
            ) : <GoogleIcon />}
            Sign up with Google
          </button>

          <OrDivider />

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-widest">Full Name</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-500 text-lg pointer-events-none">person</span>
                <input
                  type="text" required autoComplete="name"
                  value={name} onChange={(e) => setName(e.target.value)}
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
              <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-widest">Email</label>
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

            {/* Password */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-widest">Password</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-500 text-lg pointer-events-none">lock</span>
                <input
                  type={showPw ? 'text' : 'password'} required autoComplete="new-password"
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  disabled={isSubmitting}
                  className="w-full bg-slate-800/60 border border-slate-700/60 rounded-xl pl-10 pr-11 py-2.5
                    text-sm text-slate-200 placeholder-slate-600
                    focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30
                    disabled:opacity-50 transition-colors"
                />
                <button type="button" onClick={() => setShowPw(v => !v)} tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                  <span className="material-symbols-outlined text-lg">{showPw ? 'visibility_off' : 'visibility'}</span>
                </button>
              </div>
              {password && (
                <div className="mt-2 space-y-1">
                  <div className="flex gap-1">
                    {[1,2,3,4].map(i => (
                      <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-300 ${i <= strength.level ? strength.color : 'bg-slate-700'}`} />
                    ))}
                  </div>
                  <p className={`text-xs font-medium ${strength.level <= 1 ? 'text-rose-400' : strength.level === 2 ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {strength.label}
                  </p>
                </div>
              )}
            </div>

            {/* Confirm */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-widest">Confirm Password</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-500 text-lg pointer-events-none">lock_reset</span>
                <input
                  type={showPw ? 'text' : 'password'} required autoComplete="new-password"
                  value={confirm} onChange={(e) => setConfirm(e.target.value)}
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
              <div onClick={() => setAgree(v => !v)}
                className={`mt-0.5 w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center transition-all cursor-pointer
                  ${agree ? 'bg-primary border-primary' : 'border-slate-600 group-hover:border-slate-400'}`}>
                {agree && <span className="material-symbols-outlined text-background-dark" style={{ fontSize: '11px', fontVariationSettings: "'FILL' 1" }}>check</span>}
              </div>
              <span className="text-xs text-slate-400 leading-relaxed">
                I agree to the{' '}
                <button
                  type="button"
                  onClick={() => setEulaOpen(true)}
                  className="text-primary hover:underline focus:outline-none"
                >
                  Terms of Service
                </button>
                {' '}and{' '}
                <button
                  type="button"
                  onClick={() => setEulaOpen(true)}
                  className="text-primary hover:underline focus:outline-none"
                >
                  Privacy Policy
                </button>
              </span>
            </label>

            <button
              type="submit" disabled={isSubmitting || !pwMatch || maintenance.maintenanceMode}
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
                  Create account
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
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-primary transition-colors">
            <span className="material-symbols-outlined text-base">arrow_back</span>
            Back to home
          </Link>
        </div>
      </div>

      <EulaModal
        isOpen={eulaOpen}
        onClose={() => setEulaOpen(false)}
        readOnly
      />
    </div>
  );
};

export default RegisterPage;
