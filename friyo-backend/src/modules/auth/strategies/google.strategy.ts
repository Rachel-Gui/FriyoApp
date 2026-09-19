import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback, Profile } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';
import { AuthProvider } from '../../../database/entities/user.entity';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  private readonly configured: boolean;

  constructor(
    config: ConfigService,
    private readonly authService: AuthService,
  ) {
    const clientID     = config.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = config.get<string>('GOOGLE_CLIENT_SECRET');
    const callbackURL  = config.get<string>('GOOGLE_CALLBACK_URL');

    // passport-oauth2 throws if clientID is falsy — use placeholder when unconfigured
    super({
      clientID:     clientID     || 'NOT_CONFIGURED',
      clientSecret: clientSecret || 'NOT_CONFIGURED',
      callbackURL:  callbackURL  || 'http://localhost:3000/auth/google/callback',
      scope: ['email', 'profile'],
    });

    this.configured = !!(clientID && clientSecret);
  }

  // Override authenticate so unconfigured deployments return a clear error
  authenticate(req: any, options?: any) {
    if (!this.configured) {
      return this.error(new Error('Google OAuth is not configured on this server.') as any);
    }
    super.authenticate(req, options);
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): Promise<void> {
    const email     = profile.emails?.[0]?.value ?? null;
    const avatarUrl = profile.photos?.[0]?.value ?? null;

    const user = await this.authService.findOrCreateOAuthUser({
      provider:   AuthProvider.GOOGLE,
      providerId: profile.id,
      email,
      name:       profile.displayName || (email?.split('@')[0] ?? 'User'),
      avatarUrl,
    });

    done(null, user);
  }
}
