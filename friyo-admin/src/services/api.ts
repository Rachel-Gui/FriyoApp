/**
 * Friyo Admin API Service
 * All calls are authenticated via JWT injected from the NextAuth session.
 */
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { getSession } from 'next-auth/react';
import type {
  AdminUser, AppUser, Ingredient, Recipe, CommunityPost,
  ContentReport, Banner, Agreement, DashboardStats,
  AnalyticsData, PaginatedResponse,
} from '@/types';

// ── Axios instance ────────────────────────────────────────────────────────────

const http: AxiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1',
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
});

// ── Request interceptor: inject Bearer token ──────────────────────────────────

http.interceptors.request.use(async (config) => {
  // getSession works in the browser; on the server pass the token explicitly
  if (typeof window !== 'undefined') {
    const session = await getSession();
    if (session?.accessToken) {
      config.headers.Authorization = `Bearer ${session.accessToken}`;
    }
  }
  return config;
});

// ── Response interceptor: redirect on 401 ────────────────────────────────────

http.interceptors.response.use(
  (res) => {
    if (res.data?.success === true && 'data' in res.data) res.data = res.data.data;
    return res;
  },
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      window.location.href = '/login';
    }
    return Promise.reject(error as Error);
  },
);

// ── Helper to manually inject token (SSR usage) ───────────────────────────────

export function createAuthenticatedRequest(token: string): AxiosRequestConfig {
  return { headers: { Authorization: `Bearer ${token}` } };
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export const authApi = {
  /** Called by NextAuth credentials provider */
  login: (username: string, password: string) =>
    http.post<{ access_token: string; admin: AdminUser }>('/admin/auth/login', {
      username,
      password,
    }),
};

// ── Dashboard ─────────────────────────────────────────────────────────────────

export const dashboardApi = {
  getStats: () =>
    http.get<DashboardStats>('/admin/dashboard').then((r) => r.data),
};

// ── Users ─────────────────────────────────────────────────────────────────────

export const usersApi = {
  list: (params: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    sort?: string;
  }) =>
    http
      .get<PaginatedResponse<AppUser>>('/admin/users', { params })
      .then((r) => r.data),

  detail: (id: string) =>
    http.get<AppUser>(`/admin/users/${id}`).then((r) => r.data),

  ban: (id: string, payload: { reason: string; durationDays?: number }) =>
    http.post(`/admin/users/${id}/ban`, payload).then((r) => r.data),

  unban: (id: string) =>
    http.post(`/admin/users/${id}/unban`).then((r) => r.data),

  delete: (id: string) =>
    http.delete(`/admin/users/${id}`).then((r) => r.data),
};

// ── Ingredients ───────────────────────────────────────────────────────────────

export const ingredientsApi = {
  list: (params: { page?: number; limit?: number; search?: string }) =>
    http
      .get<PaginatedResponse<Ingredient>>('/admin/ingredients', { params })
      .then((r) => r.data),

  create: (payload: Partial<Ingredient>) =>
    http.post<Ingredient>('/admin/ingredients', payload).then((r) => r.data),

  update: (id: string, payload: Partial<Ingredient>) =>
    http.patch<Ingredient>(`/admin/ingredients/${id}`, payload).then((r) => r.data),

  delete: (id: string) =>
    http.delete(`/admin/ingredients/${id}`).then((r) => r.data),

  merge: (payload: { targetId: string; sourceIds: string[] }) =>
    http.post('/admin/ingredients/merge', payload).then((r) => r.data),
};

// ── Recipes ───────────────────────────────────────────────────────────────────

export const recipesApi = {
  list: (params: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    cuisine?: string;
  }) =>
    http
      .get<PaginatedResponse<Recipe>>('/admin/recipes', { params })
      .then((r) => r.data),

  approve: (id: string) =>
    http.post(`/admin/recipes/${id}/approve`).then((r) => r.data),

  reject: (id: string, reason: string) =>
    http.post(`/admin/recipes/${id}/reject`, { reason }).then((r) => r.data),

  delete: (id: string) =>
    http.delete(`/admin/recipes/${id}`).then((r) => r.data),
};

// ── Community ─────────────────────────────────────────────────────────────────

export const communityApi = {
  flaggedPosts: (params: { page?: number; limit?: number }) =>
    http
      .get<PaginatedResponse<CommunityPost>>('/admin/community/flagged', { params })
      .then((r) => r.data),

  approvePost: (id: string) =>
    http.post(`/admin/community/posts/${id}/approve`).then((r) => r.data),

  removePost: (id: string) =>
    http.delete(`/admin/community/posts/${id}`).then((r) => r.data),

  reports: (params: { page?: number; limit?: number; status?: string; contentType?: string }) =>
    http
      .get<PaginatedResponse<ContentReport>>('/admin/community/reports', { params })
      .then((r) => r.data),

  resolveReport: (id: string, payload: { action: 'resolved' | 'dismissed'; notes?: string }) =>
    http.post(`/admin/community/reports/${id}/resolve`, payload).then((r) => r.data),
};

// ── Banners ───────────────────────────────────────────────────────────────────

export const bannersApi = {
  list: () =>
    http.get<Banner[]>('/admin/banners').then((r) => r.data),

  create: (payload: Partial<Banner>) =>
    http.post<Banner>('/admin/banners', payload).then((r) => r.data),

  update: (id: string, payload: Partial<Banner>) =>
    http.patch<Banner>(`/admin/banners/${id}`, payload).then((r) => r.data),

  delete: (id: string) =>
    http.delete(`/admin/banners/${id}`).then((r) => r.data),
};

// ── Notifications ─────────────────────────────────────────────────────────────

export const notificationsApi = {
  sendPush: (payload: {
    title: string;
    body: string;
    userIds?: string[];
    data?: Record<string, string>;
  }) =>
    http.post('/admin/notifications/push', payload).then((r) => r.data),
};

// ── Agreements ────────────────────────────────────────────────────────────────

export const agreementsApi = {
  list: () =>
    http.get<Agreement[]>('/admin/agreements').then((r) => r.data),

  create: (payload: {
    type: string;
    version: string;
    content: string;
    publishNow?: boolean;
  }) =>
    http.post<Agreement>('/admin/agreements', payload).then((r) => r.data),

  publish: (id: string) =>
    http.post<Agreement>(`/admin/agreements/${id}/publish`).then((r) => r.data),
};

// ── Analytics ─────────────────────────────────────────────────────────────────

export const analyticsApi = {
  get: (params: { period?: string; from?: string; to?: string }) =>
    http.get<AnalyticsData>('/admin/analytics', { params }).then((r) => r.data),
};

// ── Admin accounts ────────────────────────────────────────────────────────────

export const adminsApi = {
  list: () =>
    http.get<AdminUser[]>('/admin/admins').then((r) => r.data),

  create: (payload: {
    username: string;
    email: string;
    password: string;
    role: string;
    permissions?: Record<string, boolean>;
  }) =>
    http.post<AdminUser>('/admin/admins', payload).then((r) => r.data),

  update: (
    id: string,
    payload: { email?: string; role?: string; isActive?: boolean; password?: string },
  ) =>
    http.patch<AdminUser>(`/admin/admins/${id}`, payload).then((r) => r.data),

  deactivate: (id: string) =>
    http.post(`/admin/admins/${id}/deactivate`).then((r) => r.data),

  logs: (id: string, params: { page?: number; limit?: number }) =>
    http.get(`/admin/admins/${id}/logs`, { params }).then((r) => r.data),
};

export default http;
