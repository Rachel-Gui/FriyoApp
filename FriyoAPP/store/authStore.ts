import { aiConsentService } from '@/services/aiConsentService';
// ─────────────────────────────────────────────────────────────────────────────
// store/authStore.ts  —  Zustand auth store with AsyncStorage persistence
// ─────────────────────────────────────────────────────────────────────────────
//
// Usage:
//   const { user, isLoggedIn, login, logout } = useAuthStore();
//
// On app launch call:
//   useAuthStore.getState().checkAuthState();
// ─────────────────────────────────────────────────────────────────────────────

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authService } from '@/services/authService';
import { FriyoError, setSessionExpiredHandler } from '@/services/api';
import { useOnboardingStore } from './onboardingStore';
import { useAiChatStore } from './aiChatStore';
import type { AuthUser } from '@/services/types';

// ── State shape ───────────────────────────────────────────────────────────────
interface AuthState {
  /** Hydrated user object (null when logged out). */
  user:               AuthUser | null;
  /** True once the initial auth check has finished. */
  isReady:            boolean;
  /** Convenience flag derived from user !== null. */
  isLoggedIn:         boolean;
  /** True if the user has completed the onboarding flow. */
  onboardingComplete: boolean;
}

// ── Action shape ──────────────────────────────────────────────────────────────
interface AuthActions {
  /**
   * Check SecureStore for a saved access token.
   * If found, loads the cached user from AsyncStorage and marks ready.
   * Called once on app launch from _layout.tsx.
   */
  checkAuthState: () => Promise<void>;

  /** Email / password login. */
  login: (email: string, password: string) => Promise<void>;

  /** Register a new account. */
  register: (email: string, password: string, name: string) => Promise<void>;

  /** Clear tokens and reset state. */
  logout: () => Promise<void>;

  /** Permanently delete the remote account, then clear all local auth data. */
  deleteAccount: () => Promise<void>;

  /** Google OAuth login. */
  loginWithGoogle: () => Promise<void>;

  /** Apple Sign-In. */
  loginWithApple: () => Promise<void>;

  /** Called when the onboarding wizard completes. */
  setOnboardingComplete: () => void;
}

// ── Store ─────────────────────────────────────────────────────────────────────
export const useAuthStore = create<AuthState & AuthActions>()(
  persist(
    (set, get) => ({
      // ── Initial state ──────────────────────────────────────────────────────
      user:               null,
      isReady:            false,
      isLoggedIn:         false,
      onboardingComplete: false,

      // ── Actions ────────────────────────────────────────────────────────────

      checkAuthState: async () => {
        try {
          const loggedIn = await authService.isLoggedIn();
          if (!loggedIn) {
            set({ isReady: true, isLoggedIn: false, user: null });
            return;
          }
          // Try the cached user first (instant), then refresh in background
          const cached = await authService.getStoredUser();
          if (cached) {
            set({
              user:               cached,
              isLoggedIn:         true,
              onboardingComplete: cached.onboardingCompleted,
              isReady:            true,
            });
          }
          try {
            const fresh = await authService.getCurrentUser();
            set({ user: fresh, isLoggedIn: true, onboardingComplete: fresh.onboardingCompleted, isReady: true });
          } catch (error) {
            if (!cached || (error instanceof FriyoError && error.status === 401)) {
              set({ user: null, isLoggedIn: false, onboardingComplete: false, isReady: true });
            }
          }
        } catch {
          set({ isReady: true, isLoggedIn: false, user: null });
        }
      },

      login: async (email, password) => {
        const res = await authService.login(email, password);
        set({
          user:               res.user,
          isLoggedIn:         true,
          onboardingComplete: res.user.onboardingCompleted,
        });
      },

      register: async (email, password, name) => {
        const res = await authService.register(email, password, name);
        set({
          user:               res.user,
          isLoggedIn:         true,
          onboardingComplete: res.user.onboardingCompleted,
        });
      },

      logout: async () => {
        await authService.logout();
        set({
          user:               null,
          isLoggedIn:         false,
          onboardingComplete: false,
        });
      },

      deleteAccount: async () => {
        await authService.deleteAccount();
        set({
          user:               null,
          isLoggedIn:         false,
          onboardingComplete: false,
          isReady:            true,
        });
      },

      loginWithGoogle: async () => {
        const res = await authService.loginWithGoogle();
        set({
          user:               res.user,
          isLoggedIn:         true,
          onboardingComplete: res.user.onboardingCompleted,
        });
      },

      loginWithApple: async () => {
        const res = await authService.loginWithApple();
        set({
          user:               res.user,
          isLoggedIn:         true,
          onboardingComplete: res.user.onboardingCompleted,
        });
      },

      setOnboardingComplete: () => {
        const user = get().user;
        if (!user) {
          set({
            onboardingComplete: false,
            isLoggedIn:         false,
            isReady:            true,
          });
          return;
        }
        set({
          onboardingComplete: true,
          isLoggedIn:         true,
          isReady:            true,
          user: { ...user, onboardingCompleted: true },
        });
      },
    }),

    {
      name:    'friyo_auth',
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist the user object and onboarding flag.
      // isReady / isLoggedIn are derived at runtime.
      partialize: (state) => ({
        user:               state.user,
        onboardingComplete: state.onboardingComplete,
      }),
    },
  ),
);

setSessionExpiredHandler(() => {
  useAuthStore.setState({ user: null, isLoggedIn: false, onboardingComplete: false, isReady: true });
  void AsyncStorage.removeItem('friyo_cached_user');
  void aiConsentService.withdrawConsent();
  useOnboardingStore.getState().reset();
  useAiChatStore.setState({ input: '', lastSent: '', sendFlag: 0, isRecording: false });
});
