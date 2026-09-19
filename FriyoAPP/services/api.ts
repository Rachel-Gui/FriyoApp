// ─────────────────────────────────────────────────────────────────────────────
// services/api.ts  —  Core API client for Friyo
//
// Features:
//   • Base URL switches via __DEV__ flag
//   • Reads/stores tokens in expo-secure-store
//   • Auto-refreshes on 401 and retries once
//   • Converts snake_case responses → camelCase automatically
//   • 15-second request timeout
//   • Typed with generics; FriyoError carries HTTP status
// ─────────────────────────────────────────────────────────────────────────────

import * as SecureStore from 'expo-secure-store';

// ── Config ────────────────────────────────────────────────────────────────────
// Production API URL is injected by EAS; release preflight rejects missing configuration.
export const BASE_URL = (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1').replace(/\/$/, '');

let onSessionExpired: (() => void) | undefined;
export function setSessionExpiredHandler(handler: () => void) { onSessionExpired = handler; }

const TIMEOUT_MS = 15_000;

export const TOKEN_KEYS = {
  access:  'friyo_access_token',
  refresh: 'friyo_refresh_token',
} as const;

// ── Token store ───────────────────────────────────────────────────────────────
export const tokenStore = {
  getAccess:    ()           => SecureStore.getItemAsync(TOKEN_KEYS.access),
  getRefresh:   ()           => SecureStore.getItemAsync(TOKEN_KEYS.refresh),
  setAccess:    (t: string)  => SecureStore.setItemAsync(TOKEN_KEYS.access,  t),
  setRefresh:   (t: string)  => SecureStore.setItemAsync(TOKEN_KEYS.refresh, t),
  clearAccess:  ()           => SecureStore.deleteItemAsync(TOKEN_KEYS.access),
  clearRefresh: ()           => SecureStore.deleteItemAsync(TOKEN_KEYS.refresh),
  clearAll:     async ()     => {
    await SecureStore.deleteItemAsync(TOKEN_KEYS.access);
    await SecureStore.deleteItemAsync(TOKEN_KEYS.refresh);
  },
};

// ── Error class ────────────────────────────────────────────────────────────────
export class FriyoError extends Error {
  constructor(
    public status:  number,
    public code:    string,
    message:        string,
  ) {
    super(message);
    this.name = 'FriyoError';
  }
}

// ── snake_case → camelCase converter ──────────────────────────────────────────
function toCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

function deepCamel<T>(obj: unknown): T {
  if (Array.isArray(obj))        return obj.map(deepCamel) as unknown as T;
  if (obj === null || typeof obj !== 'object') return obj as T;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    out[toCamel(k)] = deepCamel(v);
  }
  return out as T;
}

// ── Timeout helper ────────────────────────────────────────────────────────────
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = setTimeout(() => reject(new FriyoError(408, 'TIMEOUT', `Request timed out after ${ms}ms`)), ms);
    promise.then(v => { clearTimeout(id); resolve(v); }, e => { clearTimeout(id); reject(e); });
  });
}

// ── Refresh logic (singleton promise to avoid parallel refreshes) ─────────────
let refreshPromise: Promise<string> | null = null;

async function doRefresh(): Promise<string> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    const refresh = await tokenStore.getRefresh();
    if (!refresh) {
      await tokenStore.clearAll();
      onSessionExpired?.();
      throw new FriyoError(401, 'NO_REFRESH_TOKEN', 'No refresh token');
    }
    const res = await withTimeout(fetch(`${BASE_URL}/auth/refresh`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ refresh_token: refresh }),
    }), TIMEOUT_MS).catch((error: unknown) => {
      if (error instanceof FriyoError) throw error;
      throw new FriyoError(0, 'NETWORK_ERROR', 'Could not connect. Please try again.');
    });
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        await tokenStore.clearAll();
        onSessionExpired?.();
      }
      throw new FriyoError(res.status, 'REFRESH_FAILED', 'Session expired — please log in again');
    }
    const json = await res.json();
    const data = json.data ?? json;
    const access  = data.access_token  ?? data.accessToken;
    const newRefresh = data.refresh_token ?? data.refreshToken;
    if (typeof access !== 'string' || typeof newRefresh !== 'string') {
      throw new FriyoError(502, 'INVALID_AUTH_RESPONSE', 'Invalid authentication response');
    }
    await tokenStore.setAccess(access);
    if (newRefresh) await tokenStore.setRefresh(newRefresh);
    return access as string;
  })();
  const pending = refreshPromise;
  try { return await pending; } finally { if (refreshPromise === pending) refreshPromise = null; }
}

// ── Core request ──────────────────────────────────────────────────────────────
export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

interface RequestOptions {
  method?:  HttpMethod;
  body?:    unknown;
  formData?: FormData;
  /** Skip auth header (login, register, refresh) */
  public?:  boolean;
  /** Skip camelCase conversion (e.g. already-processed payloads) */
  raw?:     boolean;
}

export async function request<T = unknown>(
  path:     string,
  options:  RequestOptions = {},
): Promise<T> {
  const { method = 'GET', body, formData, public: isPublic = false, raw = false } = options;

  const buildHeaders = async (): Promise<Record<string, string>> => {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (!formData) headers['Content-Type'] = 'application/json';
    if (!isPublic) {
      const token = await tokenStore.getAccess();
      if (token) headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  };

  const execute = async (retry = false): Promise<T> => {
    const headers = await buildHeaders();
    const fetchOptions: RequestInit = {
      method,
      headers,
      body: formData ? formData : body !== undefined ? JSON.stringify(body) : undefined,
    };

    let res: Response;
    try {
      res = await withTimeout(fetch(`${BASE_URL}${path}`, fetchOptions), TIMEOUT_MS);
    } catch (err: any) {
      if (err instanceof FriyoError) throw err;
      throw new FriyoError(0, 'NETWORK_ERROR', err?.message ?? 'Network request failed');
    }

    // ── 401: try refresh once ────────────────────────────────────────────────
    if (res.status === 401 && !isPublic && !retry) {
      try {
        await doRefresh();
        return execute(true);           // retry with new token
      } catch (error) {
        if (error instanceof FriyoError && (error.status === 0 || error.status === 408 || error.status >= 500)) throw error;
        throw new FriyoError(401, 'UNAUTHORIZED', 'Session expired — please log in again');
      }
    }

    // ── 204 No Content ───────────────────────────────────────────────────────
    if (res.status === 204) return undefined as T;

    let json: unknown;
    try {
      json = await res.json();
    } catch {
      if (!res.ok) throw new FriyoError(res.status, 'PARSE_ERROR', res.statusText);
      return undefined as T;
    }

    if (!res.ok) {
      if (res.status === 401 && !isPublic) {
        await tokenStore.clearAll();
        onSessionExpired?.();
      }
      const err = json as any;
      throw new FriyoError(
        res.status,
        err?.error ?? err?.code ?? 'API_ERROR',
        Array.isArray(err?.message) ? err.message.join('\n') : (err?.message ?? `Request failed with status ${res.status}`),
      );
    }

    const camelized = raw ? (json as unknown) : deepCamel<unknown>(json);
    // Unwrap { success, data, timestamp } envelope that the backend TransformInterceptor adds
    const payload =
      camelized !== null &&
      typeof camelized === 'object' &&
      'success' in (camelized as object) &&
      'data' in (camelized as object)
        ? (camelized as { data: unknown }).data
        : camelized;
    return payload as T;
  };

  return execute();
}

// ── Convenience helpers ───────────────────────────────────────────────────────
export const get  = <T>(path: string, opts?: Omit<RequestOptions, 'method'>) =>
  request<T>(path, { ...opts, method: 'GET' });

export const post = <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, 'method' | 'body'>) =>
  request<T>(path, { ...opts, method: 'POST', body });

export const patch = <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, 'method' | 'body'>) =>
  request<T>(path, { ...opts, method: 'PATCH', body });

export const put = <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, 'method' | 'body'>) =>
  request<T>(path, { ...opts, method: 'PUT', body });

export const del = <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, 'method' | 'body'>) =>
  request<T>(path, { ...opts, method: 'DELETE', body });

export const postForm = <T>(path: string, formData: FormData, opts?: Omit<RequestOptions, 'method' | 'formData'>) =>
  request<T>(path, { ...opts, method: 'POST', formData });
