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

      // ── Bootstrap: called once in main.jsx to sync Firebase state ───────────
      initAuth: () => {
        const unsub = onAuthStateChanged(auth, (firebaseUser) => {
          if (firebaseUser) {
            // Dynamic import to avoid circular deps
            import('../services/firebase').then(({ normaliseUser }) => {
              const user = normaliseUser(firebaseUser);
              set({ user, isAuthenticated: true, loading: false });
            });
          } else {
            set({ user: null, isAuthenticated: false, loading: false });
          }
        });
        return unsub; // caller can unsubscribe
      },

      // ── Google OAuth ─────────────────────────────────────────────────────────
      loginWithGoogle: async () => {
        const user = await signInWithGoogle();
        set({ user, isAuthenticated: true });
        return user;
      },

      // ── Email + password login ────────────────────────────────────────────
      login: async ({ email, password }) => {
        const user = await signInWithEmail(email, password);
        set({ user, isAuthenticated: true });
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
        set({ user: null, isAuthenticated: false });
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
      name: 'vanguard-auth',
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
    }
  )
);
