import { Injectable, Inject, UnauthorizedException } from '@nestjs/common';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import Redis from 'ioredis';
import { JwtPayload, AdminJwtPayload } from './interfaces/jwt-payload.interface';
import { AuthResponse, AdminAuthResponse, AuthUser } from './interfaces/auth-response.interface';
import { User } from '../../database/entities/user.entity';
import { AdminUser } from '../../database/entities/admin-user.entity';

const REFRESH_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {}

  // ── Token creation ────────────────────────────────────────────────────────

  async generateAuthResponse(
    user: User,
    onboardingCompleted: boolean,
  ): Promise<AuthResponse> {
    const jti = uuidv4();
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      jti,
      type: 'access',
    };

    const accessToken = this.jwt.sign(payload, {
      secret: this.config.get<string>('jwt.secret'),
      expiresIn: this.config.get<JwtSignOptions['expiresIn']>('jwt.expiresIn') ?? '15m',
    });

    const refreshPayload: JwtPayload = { ...payload, type: 'refresh' };
    const refreshToken = this.jwt.sign(refreshPayload, {
      secret: this.config.get<string>('jwt.refreshSecret'),
      expiresIn: `${REFRESH_TTL_SECONDS}s`,
    });

    await this.storeRefreshToken(user.id, jti, refreshToken);

    const authUser: AuthUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      avatar_url: user.avatarUrl,
      onboarding_completed: onboardingCompleted,
    };

    return { access_token: accessToken, refresh_token: refreshToken, user: authUser };
  }

  async generateAdminResponse(admin: AdminUser): Promise<AdminAuthResponse> {
    const jti = uuidv4();
    const payload: AdminJwtPayload = {
      sub: admin.id,
      username: admin.username,
      role: admin.role,
      permissions: admin.permissions,
      type: 'admin',
      jti,
    };

    const accessToken = this.jwt.sign(payload, {
      secret: this.config.get<string>('jwt.adminSecret'),
      expiresIn: '8h',
    });

    return {
      access_token: accessToken,
      admin: {
        id: admin.id,
        username: admin.username,
        email: admin.email,
        role: admin.role,
        permissions: admin.permissions,
      },
    };
  }

  // ── Refresh token issue: generate new access token only ──────────────────

  async rotateAccessToken(
    user: User,
    oldJti: string,
    onboardingCompleted: boolean,
  ): Promise<AuthResponse> {
    // Invalidate the used refresh token (rotation — one-time use)
    await this.deleteRefreshToken(user.id, oldJti);

    // Issue a brand-new pair
    return this.generateAuthResponse(user, onboardingCompleted);
  }

  // ── Redis operations ──────────────────────────────────────────────────────

  async storeRefreshToken(userId: string, jti: string, token: string): Promise<void> {
    const key = this.refreshKey(userId, jti);
    await this.redis.setex(key, REFRESH_TTL_SECONDS, token);
  }

  async getRefreshToken(userId: string, jti: string): Promise<string | null> {
    return this.redis.get(this.refreshKey(userId, jti));
  }

  async deleteRefreshToken(userId: string, jti: string): Promise<void> {
    await this.redis.del(this.refreshKey(userId, jti));
  }

  async deleteAllUserRefreshTokens(userId: string): Promise<void> {
    const pattern = this.refreshKey(userId, '*');
    let cursor = '0';
    do {
      const [next, keys] = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = next;
      if (keys.length) await this.redis.del(...keys);
    } while (cursor !== '0');
  }

  async validateRefreshToken(userId: string, jti: string, incoming: string): Promise<void> {
    const consumed = await this.redis.eval(
      "if redis.call('GET',KEYS[1]) == ARGV[1] then return redis.call('DEL',KEYS[1]) else return 0 end",
      1, this.refreshKey(userId, jti), incoming,
    );
    if (!consumed) {
      throw new UnauthorizedException('Refresh token is invalid or has expired');
    }
  }

  // ── JWT decoding (without signature verification) ─────────────────────────

  decodeRefreshPayload(token: string): JwtPayload {
    try {
      const payload = this.jwt.verify<JwtPayload>(token, {
        secret: this.config.get<string>('jwt.refreshSecret'),
      });
      if (payload.type !== 'refresh' || !payload.sub || !payload.jti) throw new Error('Invalid token');
      return payload;
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private refreshKey(userId: string, jti: string): string {
    return `refresh:${userId}:${jti}`;
  }
}
