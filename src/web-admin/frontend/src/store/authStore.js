import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  signInWithGoogle,
  signInWithEmail,
  registerWithEmail,
  resendVerificationEmail,
  resetPassword,
  firebaseSignOut,
  onAuthStateChanged,
  auth,
} from '../services/firebase';

/**
 * Auth store backed by Firebase Auth.
 *
 * User shape:
 *   { id, name, email, avatar, role: 'admin'|'user',
 *     provider: 'local'|'google', emailVerified: boolean }
 */
export const useAuthStore = create(
  persist(
    (set, get) => ({
      /** @type {import('../services/firebase').normaliseUser|null} */
      user: null,
      isAuthenticated: false,
      /** true while Firebase is still restoring session on page load */
      loading: true,
      /** true khi tài khoản đã mua gói Pro hoặc đang dùng trial */
      isPro: false,
      /** true khi đang dùng trial (subset of isPro) */
      isTrial: false,
      /** ISO string — khi nào trial hết hạn */
      trialExpiresAt: null,

      // ── Bootstrap: called once in main.jsx to sync Firebase state ───────────
      initAuth: () => {
        const unsub = onAuthStateChanged(auth, (firebaseUser) => {
          if (firebaseUser) {
            // Dynamic import to avoid circular deps
            import('../services/firebase').then(({ normaliseUser }) => {
              const user = normaliseUser(firebaseUser);
              set({ user, isAuthenticated: true, loading: false });
              // Kiểm tra trạng thái Pro ngay sau khi đăng nhập
              get().checkProStatus(user.email);
            });
          } else {
            set({ user: null, isAuthenticated: false, loading: false, isPro: false });
          }
        });
        return unsub; // caller can unsubscribe
      },

      // ── Kiểm tra user có gói Pro không bằng cách gọi API ──────────────────────
      checkProStatus: async (email) => {
        if (!email) return;
        try {
          const res = await fetch(`/api/user-status?email=${encodeURIComponent(email)}`);
          if (res.ok) {
            const data = await res.json();
            set({
              isPro: data.isPro === true,
              isTrial: data.isTrial === true,
              trialExpiresAt: data.trialExpiresAt || null,
            });
          }
        } catch {
          // Không ảnh hưởng đến luồng đăng nhập nếu API bị lỗi
        }
      },

      // ── Google OAuth ─────────────────────────────────────────────────────────
      loginWithGoogle: async () => {
        const user = await signInWithGoogle();
        set({ user, isAuthenticated: true });
        get().checkProStatus(user.email);
        return user;
      },

      // ── Email + password login ──────────────────────────────────
      login: async ({ email, password }) => {
        const user = await signInWithEmail(email, password);
        set({ user, isAuthenticated: true });
        get().checkProStatus(user.email);
        return user;
      },

      // ── Register + send email verification ───────────────────────────────────
      register: async ({ name, email, password }) => {
        const user = await registerWithEmail(name, email, password);
        // Keep authenticated but emailVerified = false → UI shows verify banner
        set({ user, isAuthenticated: true });
        return user;
      },

      // ── Resend verification email ────────────────────────────────────────────
      resendVerification: async () => {
        await resendVerificationEmail();
      },

      // ── Password reset ────────────────────────────────────────────────────────
      sendPasswordReset: async (email) => {
        await resetPassword(email);
      },

      // ── Logout ────────────────────────────────────────────────────────────────
      logout: async () => {
        await firebaseSignOut();
        set({ user: null, isAuthenticated: false, isPro: false, isTrial: false, trialExpiresAt: null });
      },

      // ── Refresh current user (after email verified) ───────────────────────────
      refreshUser: async () => {
        if (auth.currentUser) {
          await auth.currentUser.reload();
          const { normaliseUser } = await import('../services/firebase');
          const user = normaliseUser(auth.currentUser);
          set({ user, isAuthenticated: true });
          return user;
        }
      },

      // ── Helpers ──────────────────────────────────────────────────────────────
      isAdmin: () => get().user?.role === 'admin',
    }),
    {
      name: 'hlmck-auth',
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
    }
  )
);
