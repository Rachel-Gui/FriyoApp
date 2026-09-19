export interface JwtPayload {
  sub: string;          // userId
  email: string | null;
  jti: string;          // unique token ID (uuid) — used as Redis key suffix
  type: 'access' | 'refresh';
  iat?: number;
  exp?: number;
}

export interface AdminJwtPayload {
  sub: string;          // adminUserId
  username: string;
  role: string;
  permissions: Record<string, boolean>;
  type: 'admin';
  jti: string;
  iat?: number;
  exp?: number;
}
