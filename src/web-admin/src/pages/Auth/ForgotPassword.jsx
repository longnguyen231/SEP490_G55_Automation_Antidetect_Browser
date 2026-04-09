import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import toast from 'react-hot-toast';

// ─── Firebase error → Vietnamese ─────────────────────────────────────────────
function parseFirebaseError(err) {
  const code = err?.code || '';
  const map = {
    'auth/user-not-found':         'Email không tồn tại trong hệ thống.',
    'auth/invalid-email':          'Địa chỉ email không hợp lệ.',
    'auth/too-many-requests':      'Quá nhiều yêu cầu. Vui lòng thử lại sau.',
    'auth/network-request-failed': 'Lỗi kết nối mạng. Kiểm tra internet và thử lại.',
    'auth/configuration-not-found':
      'Firebase chưa được cấu hình. Vui lòng điền firebaseConfig trong src/config/firebase.config.js',
  };
  return map[code] || err?.message || 'Đã có lỗi xảy ra. Thử lại sau.';
}

// ─── Envelope illustration ────────────────────────────────────────────────────
const EnvelopeIcon = () => (
  <svg viewBox="0 0 64 64" fill="none" className="w-16 h-16" xmlns="http://www.w3.org/2000/svg">
    <rect x="4" y="14" width="56" height="36" rx="5" stroke="#00bcd4" strokeWidth="2.5" fill="none"/>
    <path d="M4 18l28 20 28-20" stroke="#00bcd4" strokeWidth="2.5" strokeLinejoin="round"/>
    <circle cx="49" cy="18" r="9" fill="#00bcd4" opacity="0.15"/>
    <circle cx="49" cy="18" r="6" fill="#00bcd4" opacity="0.4"/>
    <path d="M46 18h6M49 15v6" stroke="#fff" strokeWidth="1.8" strokeLinecap="round"/>
  </svg>
);

const LockIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-slate-400" xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="1.8"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    <circle cx="12" cy="16" r="1.5" fill="currentColor"/>
  </svg>
);

const ArrowLeftIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4" xmlns="http://www.w3.org/2000/svg">
    <path d="M19 12H5M5 12l7-7M5 12l7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// ─── Main component ───────────────────────────────────────────────────────────
const ForgotPasswordPage = () => {
  const { sendPasswordReset } = useAuthStore();

  const [email, setEmail]   = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent]     = useState(false);

  // ─── Submit ───────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error('Vui lòng nhập địa chỉ email.');
      return;
    }

    setLoading(true);
    try {
      await sendPasswordReset(email.trim());
      setSent(true);
      toast.success('Email đặt lại mật khẩu đã được gửi!');
    } catch (err) {
      toast.error(parseFirebaseError(err));
    } finally {
      setLoading(false);
    }
  };

  // ─── Resend ───────────────────────────────────────────────────────────────
  const handleResend = async () => {
    setLoading(true);
    try {
      await sendPasswordReset(email.trim());
      toast.success('Email đã được gửi lại!');
    } catch (err) {
      toast.error(parseFirebaseError(err));
    } finally {
      setLoading(false);
    }
  };

  // ─── Success screen ───────────────────────────────────────────────────────
  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4"
           style={{ background: 'linear-gradient(135deg, #080a0c 0%, #0d1117 50%, #080a0c 100%)' }}>
        {/* Ambient glow */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[300px] rounded-full opacity-10"
               style={{ background: 'radial-gradient(ellipse, #00bcd4 0%, transparent 70%)', filter: 'blur(60px)' }} />
        </div>

        <div className="relative w-full max-w-md">
          <div className="rounded-2xl border border-slate-700/60 p-8 text-center shadow-2xl"
               style={{ background: 'rgba(15, 20, 30, 0.95)', backdropFilter: 'blur(20px)' }}>

            {/* Icon */}
            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 rounded-full flex items-center justify-center"
                   style={{ background: 'rgba(0,188,212,0.1)', border: '1px solid rgba(0,188,212,0.3)' }}>
                <EnvelopeIcon />
              </div>
            </div>

            <h2 className="text-xl font-semibold text-white mb-2">Kiểm tra hộp thư đến</h2>
            <p className="text-sm text-slate-400 mb-1">
              Chúng tôi đã gửi liên kết đặt lại mật khẩu đến
            </p>
            <p className="text-sm font-medium text-primary mb-6 break-all">{email}</p>

            <div className="rounded-xl border border-slate-700/40 p-4 text-left mb-6"
                 style={{ background: 'rgba(0,188,212,0.04)' }}>
              <p className="text-xs text-slate-400 font-medium mb-2 uppercase tracking-wide">Hướng dẫn:</p>
              <ol className="space-y-1.5">
                {[
                  'Mở email từ Vanguard Browser.',
                  'Nhấp "Đặt lại mật khẩu" trong email.',
                  'Tạo mật khẩu mới và lưu lại.',
                  'Đăng nhập bằng mật khẩu mới.',
                ].map((step, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-slate-300">
                    <span className="flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold text-primary"
                          style={{ background: 'rgba(0,188,212,0.15)', marginTop: '1px' }}>
                      {i + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>

            <p className="text-xs text-slate-500 mb-4">
              Không thấy email? Kiểm tra thư mục <span className="text-slate-400">Spam/Junk</span>, hoặc
            </p>

            <button
              onClick={handleResend}
              disabled={loading}
              className="w-full py-2.5 rounded-xl text-sm font-medium text-primary border border-primary/40 mb-4 transition-all"
              style={{ background: 'rgba(0,188,212,0.06)' }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.background = 'rgba(0,188,212,0.12)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,188,212,0.06)'; }}
            >
              {loading ? 'Đang gửi...' : 'Gửi lại email'}
            </button>

            <Link to="/login"
              className="flex items-center justify-center gap-2 text-sm text-slate-400 hover:text-white transition-colors">
              <ArrowLeftIcon />
              Quay lại đăng nhập
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ─── Form screen ─────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center px-4"
         style={{ background: 'linear-gradient(135deg, #080a0c 0%, #0d1117 50%, #080a0c 100%)' }}>
      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[300px] rounded-full opacity-10"
             style={{ background: 'radial-gradient(ellipse, #00bcd4 0%, transparent 70%)', filter: 'blur(60px)' }} />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                 style={{ background: 'linear-gradient(135deg, #00bcd4, #0097a7)' }}>
              <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-white" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L3 7l9 5 9-5-9-5z" fill="currentColor" opacity="0.9"/>
                <path d="M3 12l9 5 9-5" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" fill="none"/>
                <path d="M3 17l9 5 9-5" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" fill="none" opacity="0.6"/>
              </svg>
            </div>
            <span className="text-lg font-bold text-white tracking-tight">Vanguard Browser</span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-700/60 p-8 shadow-2xl"
             style={{ background: 'rgba(15, 20, 30, 0.95)', backdropFilter: 'blur(20px)' }}>

          {/* Header */}
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                 style={{ background: 'rgba(0,188,212,0.12)', border: '1px solid rgba(0,188,212,0.2)' }}>
              <LockIcon />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-white leading-tight">Quên mật khẩu?</h1>
              <p className="text-xs text-slate-400">Không lo — ta sẽ gửi hướng dẫn đặt lại ngay.</p>
            </div>
          </div>

          <p className="text-sm text-slate-400 mt-4 mb-6">
            Nhập địa chỉ email bạn dùng để đăng ký.
            Chúng tôi sẽ gửi liên kết đặt lại mật khẩu vào hộp thư.
          </p>

          {/* Form */}
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Địa chỉ email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="ban@example.com"
                autoComplete="email"
                autoFocus
                className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-slate-500 border outline-none transition-all"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  borderColor: 'rgba(148,163,184,0.15)',
                }}
                onFocus={e => { e.currentTarget.style.borderColor = '#00bcd4'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(0,188,212,0.12)'; }}
                onBlur={e => { e.currentTarget.style.borderColor = 'rgba(148,163,184,0.15)'; e.currentTarget.style.boxShadow = 'none'; }}
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-all mt-2"
              style={{ background: loading ? '#0097a7' : 'linear-gradient(135deg, #00bcd4, #0097a7)', opacity: loading ? 0.7 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.background = 'linear-gradient(135deg, #0097a7, #00838f)'; }}
              onMouseLeave={e => { if (!loading) e.currentTarget.style.background = 'linear-gradient(135deg, #00bcd4, #0097a7)'; }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Đang gửi email...
                </span>
              ) : (
                'Gửi liên kết đặt lại mật khẩu'
              )}
            </button>
          </form>

          {/* Back to login */}
          <div className="mt-6 text-center">
            <Link to="/login"
              className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors">
              <ArrowLeftIcon />
              Quay lại đăng nhập
            </Link>
          </div>
        </div>

        <p className="text-center text-xs text-slate-600 mt-6">
          Chưa có tài khoản?{' '}
          <Link to="/register" className="text-primary hover:text-primary/80 font-medium transition-colors">
            Đăng ký miễn phí
          </Link>
        </p>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
