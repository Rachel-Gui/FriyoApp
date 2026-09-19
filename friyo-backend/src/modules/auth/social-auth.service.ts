import { Injectable, Inject, UnauthorizedException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Redis from 'ioredis';
import { createRemoteJWKSet, jwtVerify, SignJWT, importPKCS8 } from 'jose';
import { randomBytes, createCipheriv, createDecipheriv, createHash } from 'crypto';
import { AuthService } from './auth.service';
import { User, AuthProvider } from '../../database/entities/user.entity';

@Injectable()
export class SocialAuthService {
  private readonly googleKeys = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
  private readonly appleKeys = createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'));
  constructor(private readonly config: ConfigService, private readonly auth: AuthService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
    @InjectRepository(User) private readonly users: Repository<User>) {}

  async challenge() {
    const nonce = randomBytes(32).toString('hex');
    await this.redis.set(`apple:nonce:${nonce}`, '1', 'EX', 300);
    return { nonce };
  }

  async google(identityToken: string) {
    const audience = (this.config.get<string>('GOOGLE_CLIENT_IDS') || '').split(',').map(s => s.trim()).filter(Boolean);
    if (!audience.length) throw new ServiceUnavailableException('Google sign-in is not configured');
    let payload;
    try {
      ({ payload } = await jwtVerify(identityToken, this.googleKeys, {
        audience, issuer: ['https://accounts.google.com', 'accounts.google.com'], algorithms: ['RS256'],
      }));
      if (!payload.sub || payload.email_verified !== true || typeof payload.email !== 'string') throw new Error();
    } catch { throw new UnauthorizedException('Invalid Google identity token'); }
    const user = await this.auth.findOrCreateOAuthUser({ provider: AuthProvider.GOOGLE,
      providerId: payload.sub, email: payload.email as string,
      name: typeof payload.name === 'string' ? payload.name : 'Google User',
      avatarUrl: typeof payload.picture === 'string' ? payload.picture : null });
    return this.auth.oauthCallback(user);
  }

  async apple(identityToken: string, authorizationCode: string, nonce: string, name?: string) {
    const audience = this.config.get<string>('APPLE_CLIENT_ID');
    if (!audience) throw new ServiceUnavailableException('Apple sign-in is not configured');
    let payload;
    try {
      ({ payload } = await jwtVerify(identityToken, this.appleKeys, {
        audience, issuer: 'https://appleid.apple.com', algorithms: ['RS256'],
      }));
      // Expo passes the nonce through to Apple's native request unchanged.
      if (!payload.sub || payload.nonce !== nonce) throw new Error();
      const used = await this.redis.eval("local v=redis.call('GET',KEYS[1]); if v then redis.call('DEL',KEYS[1]); end; return v", 1, `apple:nonce:${nonce}`);
      if (!used) throw new Error();
    } catch { throw new UnauthorizedException('Invalid or expired Apple sign-in'); }
    const tokens = await this.appleRequest('token', { code: authorizationCode, grant_type: 'authorization_code' });
    if (typeof tokens.refresh_token !== 'string' || typeof tokens.id_token !== 'string') {
      throw new UnauthorizedException('Apple authorization code is invalid');
    }
    const exchanged = await jwtVerify(tokens.id_token, this.appleKeys, { audience, issuer: 'https://appleid.apple.com', algorithms: ['RS256'] });
    if (exchanged.payload.sub !== payload.sub) throw new UnauthorizedException('Apple identity mismatch');
    const user = await this.auth.findOrCreateOAuthUser({ provider: AuthProvider.APPLE, providerId: payload.sub,
      email: (payload.email_verified === true || payload.email_verified === 'true') && typeof payload.email === 'string' ? payload.email : null,
      name: name || 'Apple User', avatarUrl: null });
    await this.users.update(user.id, { appleRefreshToken: this.encrypt(tokens.refresh_token) });
    return this.auth.oauthCallback(user);
  }

  async revokeApple(user: User) {
    if (!user.appleRefreshToken) return;
    await this.appleRequest('revoke', { token: this.decrypt(user.appleRefreshToken), token_type_hint: 'refresh_token' });
  }

  private async appleRequest(endpoint: string, fields: Record<string, string>): Promise<Record<string, any>> {
    const clientId = this.config.get<string>('APPLE_CLIENT_ID');
    const keyId = this.config.get<string>('APPLE_KEY_ID');
    const teamId = this.config.get<string>('APPLE_TEAM_ID');
    const pem = this.config.get<string>('APPLE_PRIVATE_KEY')?.replace(/\\n/g, '\n');
    if (!clientId || !keyId || !teamId || !pem) throw new ServiceUnavailableException('Apple sign-in is not configured');
    const key = await importPKCS8(pem, 'ES256');
    const secret = await new SignJWT({}).setProtectedHeader({ alg: 'ES256', kid: keyId })
      .setIssuer(teamId).setSubject(clientId).setAudience('https://appleid.apple.com').setIssuedAt().setExpirationTime('5m').sign(key);
    const response = await fetch(`https://appleid.apple.com/auth/${endpoint}`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: clientId, client_secret: secret, ...fields }), signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new ServiceUnavailableException('Apple authorization service rejected the request');
    return endpoint === 'revoke' ? {} : response.json();
  }

  private encryptionKey() {
    const raw = this.config.get<string>('OAUTH_TOKEN_ENCRYPTION_KEY');
    if (!raw || !/^[a-f0-9]{64}$/i.test(raw)) throw new ServiceUnavailableException('OAuth token encryption is not configured');
    return Buffer.from(raw, 'hex');
  }
  private encrypt(value: string) {
    const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', this.encryptionKey(), iv);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    return [iv, cipher.getAuthTag(), encrypted].map(v => v.toString('base64')).join('.');
  }
  private decrypt(value: string) {
    const [iv, tag, encrypted] = value.split('.').map(v => Buffer.from(v, 'base64'));
    const cipher = createDecipheriv('aes-256-gcm', this.encryptionKey(), iv); cipher.setAuthTag(tag);
    return Buffer.concat([cipher.update(encrypted), cipher.final()]).toString('utf8');
  }
}
