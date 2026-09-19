export interface AuthUser {
  id: string;
  name: string;
  email: string | null;
  avatar_url: string | null;
  onboarding_completed: boolean;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  user: AuthUser;
}

export interface AdminAuthResponse {
  access_token: string;
  admin: {
    id: string;
    username: string;
    email: string;
    role: string;
    permissions: Record<string, boolean>;
  };
}
