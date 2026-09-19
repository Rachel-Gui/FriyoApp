import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-facebook';

type VerifyCallback = (err: Error | null, user?: unknown) => void;
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';
import { AuthProvider } from '../../../database/entities/user.entity';

@Injectable()
export class FacebookStrategy extends PassportStrategy(Strategy, 'facebook') {
  private readonly configured: boolean;

  constructor(
    config: ConfigService,
    private readonly authService: AuthService,
  ) {
    const clientID     = config.get<string>('FACEBOOK_APP_ID');
    const clientSecret = config.get<string>('FACEBOOK_APP_SECRET');

    super({
      clientID:     clientID     || 'NOT_CONFIGURED',
      clientSecret: clientSecret || 'NOT_CONFIGURED',
      callbackURL:  config.get<string>('FACEBOOK_CALLBACK_URL') || 'http://localhost:3000/auth/facebook/callback',
      profileFields: ['id', 'emails', 'name', 'picture.type(large)'],
      scope: ['email'],
    });

    this.configured = !!(clientID && clientSecret);
  }

  authenticate(req: any, options?: any) {
    if (!this.configured) {
      return this.error(new Error('Facebook OAuth is not configured on this server.') as any);
    }
    super.authenticate(req, options);
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): Promise<void> {
    const email = profile.emails?.[0]?.value ?? null;
    const photo = profile.photos?.[0]?.value ?? null;

    const firstName = profile.name?.givenName ?? '';
    const lastName  = profile.name?.familyName ?? '';
    const fullName  = `${firstName} ${lastName}`.trim() || (email?.split('@')[0] ?? 'User');

    const user = await this.authService.findOrCreateOAuthUser({
      provider:   AuthProvider.FACEBOOK,
      providerId: profile.id,
      email,
      name:       fullName,
      avatarUrl:  photo,
    });

    done(null, user);
  }
}
