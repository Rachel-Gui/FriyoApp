// ─────────────────────────────────────────────────────────────────────────────
// services/authService.ts
// ─────────────────────────────────────────────────────────────────────────────

import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import { notificationService } from './notificationService';
import { aiConsentService } from './aiConsentService';
import { useOnboardingStore } from '../store/onboardingStore';
import { useAiChatStore } from '../store/aiChatStore';
import * as AppleAuthentication from 'expo-apple-authentication';
import { del, get, post, tokenStore } from './api';
import type { AuthResponse, AuthUser } from './types';

WebBrowser.maybeCompleteAuthSession();

const USER_CACHE_KEY = 'friyo_cached_user';

// ── Token persistence helpers ─────────────────────────────────────────────────
async function saveTokens(res: AuthResponse): Promise<void> {
  await tokenStore.setAccess(res.accessToken);
  await tokenStore.setRefresh(res.refreshToken);
  await AsyncStorage.setItem(USER_CACHE_KEY, JSON.stringify(res.user));
}

// ── Auth functions ────────────────────────────────────────────────────────────
export const authService = {

  /** Email/password login. Saves tokens; returns full AuthResponse. */
  async login(email: string, password: string): Promise<AuthResponse> {
    const res = await post<AuthResponse>('/auth/login', { email, password }, { public: true });
    await saveTokens(res);
    return res;
  },

  /** Register new account. Saves tokens; returns full AuthResponse. */
  async register(email: string, password: string, name: string): Promise<AuthResponse> {
    const res = await post<AuthResponse>('/auth/register', { email, password, name }, { public: true });
    await saveTokens(res);
    return res;
  },

  /** Logout — clears SecureStore tokens and cached user. */
  async logout(): Promise<void> {
    await notificationService.unregister();
    try { await post('/auth/logout'); } catch { /* local logout still succeeds */ }
    await clearLocalUserData();
    try { const { GoogleSignin } = await import('@react-native-google-signin/google-signin'); await GoogleSignin.signOut(); } catch { /* Native Google may be unavailable in Expo Go. */ }
    await tokenStore.clearAll();
    await AsyncStorage.removeItem(USER_CACHE_KEY);
  },

  /** Permanently delete the authenticated account and clear all local data. */
  async deleteAccount(): Promise<void> {
    await del<void>('/users/me', { confirmation: 'DELETE' });
    await clearLocalUserData();
    await AsyncStorage.multiRemove(['friyo_push_token', 'friyo_push_opt_in']);
    await tokenStore.clearAll();
    await AsyncStorage.removeItem(USER_CACHE_KEY);
    await AsyncStorage.removeItem('friyo_auth');
  },

  /** Google native SDK; requires a development or production build. */
  async loginWithGoogle(): Promise<AuthResponse> {
    const { GoogleSignin, isSuccessResponse } = await import('@react-native-google-signin/google-signin');
    const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
    const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
    if (!webClientId || !iosClientId) throw new Error('Google sign-in is not configured. Please use email for now.');
    GoogleSignin.configure({ webClientId, iosClientId });
    await GoogleSignin.hasPlayServices();
    const result = await GoogleSignin.signIn();
    if (!isSuccessResponse(result) || !result.data.idToken) throw new Error('Google sign-in cancelled');
    const res = await post<AuthResponse>('/auth/google', { identityToken: result.data.idToken }, { public: true });
    await saveTokens(res);
    return res;
  },

  async loginWithApple(): Promise<AuthResponse> {
    const { nonce } = await post<{ nonce: string }>('/auth/apple/challenge', {}, { public: true });
    const credential = await AppleAuthentication.signInAsync({ nonce,
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
    });
    if (!credential.identityToken || !credential.authorizationCode) throw new Error('Apple sign-in did not complete');
    const name = credential.fullName ? AppleAuthentication.formatFullName(credential.fullName).trim() : '';
    const res = await post<AuthResponse>('/auth/apple', {
      identityToken: credential.identityToken, authorizationCode: credential.authorizationCode, nonce,
      ...(name ? { name } : {}),
    }, { public: true });
    await saveTokens(res);
    return res;
  },

  async forgotPassword(email: string): Promise<void> {
    await post('/auth/forgot-password', { email: email.trim() }, { public: true });
  },
  async resetPassword(email: string, code: string, password: string): Promise<void> {
    await post('/auth/reset-password', { email: email.trim(), code: code.trim(), password }, { public: true });
  },

  /** Fetch fresh user profile from server. */
  async getCurrentUser(): Promise<AuthUser> {
    const user = await get<AuthUser>('/users/me');
    await AsyncStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
    return user;
  },

  /** Fast check — returns true if access token exists in SecureStore. */
  async isLoggedIn(): Promise<boolean> {
    const [accessToken, refreshToken] = await Promise.all([
      SecureStore.getItemAsync('friyo_access_token'),
      SecureStore.getItemAsync('friyo_refresh_token'),
    ]);
    return Boolean(accessToken?.length && refreshToken?.length);
  },

  /** Returns the last user object cached in AsyncStorage (no network). */
  async getStoredUser(): Promise<AuthUser | null> {
    const raw = await AsyncStorage.getItem(USER_CACHE_KEY);
    if (!raw) return null;
    try { return JSON.parse(raw) as AuthUser; } catch { return null; }
  },
};

async function clearLocalUserData() {
  await aiConsentService.withdrawConsent();
  useOnboardingStore.getState().reset();
  useAiChatStore.setState({ input: '', isRecording: false, sendFlag: 0, lastSent: '' });
}
