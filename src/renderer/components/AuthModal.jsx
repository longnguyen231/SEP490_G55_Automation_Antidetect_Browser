import React, { useState } from 'react';
import { Mail, Lock, LogIn, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import { auth, googleProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail } from '../services/firebase';
import './AuthModal.css';

const GoogleIcon = () => (
  <svg className="auth-google-icon" viewBox="0 0 24 24" fill="none">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

const AuthModal = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleSuccess = async (userCredential) => {
    const user = userCredential.user;
    const token = await user.getIdToken();
    localStorage.setItem('firebase_id_token', token);
    localStorage.setItem('firebase_uid', user.uid);
    localStorage.setItem('firebase_email', user.email);

    if (onLoginSuccess) {
      onLoginSuccess({
        uid: user.uid,
        email: user.email,
        token: token
      });
    }
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      if (isForgotPassword) {
        await sendPasswordResetEmail(auth, email);
        setSuccessMsg('Password reset email sent! Check your inbox.');
        setIsForgotPassword(false);
        setPassword('');
      } else {
        let cred;
        if (isLogin) {
          cred = await signInWithEmailAndPassword(auth, email, password);
          await handleSuccess(cred);
        } else {
          cred = await createUserWithEmailAndPassword(auth, email, password);
          await auth.signOut();
          setIsLogin(true);
          setPassword('');
          setSuccessMsg('Registration successful! Please sign in.');
        }
      }
    } catch (err) {
      let msg = err.message;
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        msg = 'Invalid email or password.';
      } else if (err.code === 'auth/email-already-in-use') {
        msg = 'Email already exists. Please sign in instead.';
      } else if (err.code === 'auth/invalid-email') {
        msg = 'Invalid email format.';
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setError('');
    setOauthLoading(true);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      await handleSuccess(cred);
    } catch (err) {
      if (err.code !== 'auth/popup-closed-by-user') {
        setError(err.message || 'Google Sign-In failed.');
      }
    } finally {
      setOauthLoading(false);
    }
  };

  return (
    <div className="auth-overlay">
      <div className="auth-modal-container">
        <div className="auth-header-logo">
          <div className="auth-logo-box">
            <ShieldCheck size={24} color="#38bdf8" />
          </div>
          <h1>HL-MCK</h1>
        </div>

        <div className="auth-title">
          <h2>{isForgotPassword ? 'Reset Password' : (isLogin ? 'Welcome back' : 'Create an account')}</h2>
          <p>{isForgotPassword ? 'Enter your email to receive a reset link' : (isLogin ? 'Sign in to your account' : 'Sign up to start managing profiles')}</p>
        </div>

        {!isForgotPassword && (
          <>
            <button 
              className="auth-google-btn" 
              onClick={handleGoogleAuth} 
              disabled={oauthLoading || loading}
            >
              {oauthLoading ? <div className="auth-spinner mini"></div> : <GoogleIcon />}
              <span>{isLogin ? 'Sign in with Google' : 'Sign up with Google'}</span>
            </button>

            <div className="auth-divider">
              <div className="auth-divider-line"></div>
              <span className="auth-divider-text">OR</span>
              <div className="auth-divider-line"></div>
            </div>
          </>
        )}

        {successMsg && (
          <div className="auth-success-box" style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', color: '#34d399', padding: '12px 16px', borderRadius: '8px', fontSize: '13px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
            <span>{successMsg}</span>
          </div>
        )}

        {error && (
          <div className="auth-error-box">
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleAuth} className="auth-form-wrapper">
          <div className="auth-field">
            <label className="auth-label">EMAIL</label>
            <div className="auth-input-group">
              <Mail className="auth-input-icon" size={18} />
              <input 
                type="email" 
                className="auth-input"
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                placeholder="you@example.com"
                required 
                disabled={loading || oauthLoading}
              />
            </div>
          </div>
          
          {!isForgotPassword && (
            <div className="auth-field">
              <div className="auth-label-row">
                <label className="auth-label">PASSWORD</label>
                {isLogin && <button type="button" className="auth-forgot-link" onClick={() => { setIsForgotPassword(true); setError(''); setSuccessMsg(''); }}>Forgot password?</button>}
              </div>
              <div className="auth-input-group">
                <Lock className="auth-input-icon" size={18} />
                <input 
                  type={showPw ? "text" : "password"} 
                  className="auth-input"
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  placeholder="••••••••"
                  required 
                  minLength={6}
                  disabled={loading || oauthLoading}
                />
                <button 
                  type="button" 
                  className="auth-pw-toggle" 
                  onClick={() => setShowPw(!showPw)}
                  tabIndex="-1"
                >
                  {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
          )}

          <button type="submit" disabled={loading || oauthLoading} className="auth-submit-btn">
            {loading ? (
              <div className="auth-spinner"></div>
            ) : (
              isForgotPassword ? 'Send Reset Link' : (isLogin ? 'Sign In' : 'Create Account')
            )}
          </button>
        </form>

        <div className="auth-footer-text">
          {isForgotPassword ? (
            <>
              Remember your password?{' '}
              <button 
                type="button" 
                className="auth-toggle-link" 
                onClick={() => { setIsForgotPassword(false); setError(''); setSuccessMsg(''); }}
              >
                Back to Login
              </button>
            </>
          ) : (
            <>
              {isLogin ? "Don't have an account?" : "Already have an account?"}{' '}
              <button 
                type="button" 
                className="auth-toggle-link" 
                onClick={() => {
                  setIsLogin(!isLogin);
                  setError('');
                  setSuccessMsg('');
                }}
              >
                {isLogin ? 'Register now' : 'Log in here'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthModal;
