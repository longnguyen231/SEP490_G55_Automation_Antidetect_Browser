import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Auth store.
 *
 * User shape:
 *   { id, name, email, avatar, role: 'admin' | 'user', provider: 'local' | 'google' | 'facebook' }
 *
 * In a real app these actions would call backend endpoints.
 * Here they simulate the flow so the UI is fully functional.
 */

// ─── Mock users DB (persisted via localStorage key "vanguard-mock-users") ─────
const MOCK_USERS_KEY = 'vanguard-mock-users';
const DEFAULT_ADMIN = {
  id: 'admin-1',
  name: 'Admin Vanguard',
  email: 'admin@vanguard.local',
  password: 'admin123',     // plain text – mock only, never do this in prod
  avatar: null,
  role: 'admin',
  provider: 'local',
};

function getMockUsers() {
  try {
    const raw = localStorage.getItem(MOCK_USERS_KEY);
    const stored = raw ? JSON.parse(raw) : [];
    // Always ensure the built-in admin exists
    if (!stored.find((u) => u.email === DEFAULT_ADMIN.email)) {
      stored.unshift(DEFAULT_ADMIN);
      localStorage.setItem(MOCK_USERS_KEY, JSON.stringify(stored));
    }
    return stored;
  } catch {
    return [DEFAULT_ADMIN];
  }
}

function saveMockUsers(users) {
  localStorage.setItem(MOCK_USERS_KEY, JSON.stringify(users));
}

// ─── Store ─────────────────────────────────────────────────────────────────────
export const useAuthStore = create(
  persist(
    (set, get) => ({
      /** @type {{ id, name, email, avatar, role, provider } | null} */
      user: null,
      isAuthenticated: false,

      // ── Local email/password login ──────────────────────────────────────────
      login: ({ email, password }) => {
        const users = getMockUsers();
        const found = users.find(
          (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password
        );
        if (!found) {
          throw new Error('Invalid email or password.');
        }
        const { password: _pw, ...safeUser } = found;
        set({ user: safeUser, isAuthenticated: true });
        return safeUser;
      },

      // ── OAuth login / register (Google / Facebook) ─────────────────────────
      // In production these would open a real OAuth popup.
      // Here we simulate a successful OAuth response with a mock user.
      oauthLogin: ({ provider, mockProfile }) => {
        const users = getMockUsers();
        // Look for existing account by email
        let existing = users.find(
          (u) => u.email.toLowerCase() === mockProfile.email.toLowerCase()
        );
        if (!existing) {
          // Auto-register as regular user on first OAuth login
          existing = {
            id: `${provider}-${Date.now()}`,
            name: mockProfile.name,
            email: mockProfile.email,
            avatar: mockProfile.avatar || null,
            role: 'user',
            provider,
            password: null,
          };
          users.push(existing);
          saveMockUsers(users);
        }
        const { password: _pw, ...safeUser } = existing;
        set({ user: safeUser, isAuthenticated: true });
        return safeUser;
      },

      // ── Register (email + password) ─────────────────────────────────────────
      register: ({ name, email, password }) => {
        const users = getMockUsers();
        if (users.find((u) => u.email.toLowerCase() === email.toLowerCase())) {
          throw new Error('An account with this email already exists.');
        }
        const newUser = {
          id: `local-${Date.now()}`,
          name,
          email,
          avatar: null,
          role: 'user',
          provider: 'local',
          password,
        };
        users.push(newUser);
        saveMockUsers(users);
        const { password: _pw, ...safeUser } = newUser;
        set({ user: safeUser, isAuthenticated: true });
        return safeUser;
      },

      // ── Logout ───────────────────────────────────────────────────────────────
      logout: () => {
        set({ user: null, isAuthenticated: false });
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
