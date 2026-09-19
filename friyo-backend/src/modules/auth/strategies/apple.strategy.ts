import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile, VerifyCallback } from 'passport-apple';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';
import { AuthProvider } from '../../../database/entities/user.entity';

@Injectable()
export class AppleStrategy extends PassportStrategy(Strategy, 'apple') {
  private readonly configured: boolean;

  constructor(
    config: ConfigService,
    private readonly authService: AuthService,
  ) {
    const clientID  = config.get<string>('APPLE_CLIENT_ID');
    const teamID    = config.get<string>('APPLE_TEAM_ID');
    const keyID     = config.get<string>('APPLE_KEY_ID');
    const rawKey    = config.get<string>('APPLE_PRIVATE_KEY') ?? '';
    const privateKeyString = rawKey.replace(/\\n/g, '\n');

    super({
      clientID:         clientID         || 'NOT_CONFIGURED',
      teamID:           teamID           || 'NOT_CONFIGURED',
      keyID:            keyID            || 'NOT_CONFIGURED',
      privateKeyString: privateKeyString || '-----BEGIN PRIVATE KEY-----\nNOT_CONFIGURED\n-----END PRIVATE KEY-----',
      callbackURL:      config.get<string>('APPLE_CALLBACK_URL') || 'http://localhost:3000/auth/apple/callback',
      scope: ['name', 'email'],
      passReqToCallback: false,
    });

    this.configured = !!(clientID && teamID && keyID && rawKey);
  }

  authenticate(req: any, options?: any) {
    if (!this.configured) {
      return this.error(new Error('Apple Sign-In is not configured on this server.') as any);
    }
    super.authenticate(req, options);
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    idToken: Record<string, unknown>,
    profile: Profile,
    done: VerifyCallback,
  ): Promise<void> {
    const email = (idToken['email'] as string | undefined)
      ?? profile?.emails?.[0]?.value
      ?? null;
    const sub = (idToken['sub'] as string | undefined)
      ?? profile?.id
      ?? '';

    const nameParts = profile?.name;
    const name = nameParts
      ? `${nameParts.firstName ?? ''} ${nameParts.lastName ?? ''}`.trim()
      : (email?.split('@')[0] ?? 'Apple User');

    const user = await this.authService.findOrCreateOAuthUser({
      provider:   AuthProvider.APPLE,
      providerId: sub,
      email,
      name:       name || 'Apple User',
      avatarUrl:  null,
    });

    done(null, user);
  }
}
