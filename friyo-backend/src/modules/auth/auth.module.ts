import { PasswordResetService } from './password-reset.service';
import { SocialAuthService } from './social-auth.service';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { User }        from '../../database/entities/user.entity';
import { UserProfile } from '../../database/entities/user-profile.entity';
import { AdminUser }   from '../../database/entities/admin-user.entity';

import { AuthController }       from './auth.controller';
import { AdminAuthController }  from './admin-auth.controller';
import { AuthService }          from './auth.service';
import { TokenService }         from './token.service';

import { JwtStrategy }          from './strategies/jwt.strategy';
import { JwtRefreshStrategy }   from './strategies/jwt-refresh.strategy';
import { AdminJwtStrategy }     from './strategies/admin-jwt.strategy';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, UserProfile, AdminUser]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({}),
  ],
  controllers: [AuthController, AdminAuthController],
  providers: [
    AuthService,
    SocialAuthService,
    PasswordResetService,
    TokenService,
    JwtStrategy,
    JwtRefreshStrategy,
    AdminJwtStrategy,
  ],
  exports: [SocialAuthService, AuthService, TokenService, JwtModule, PassportModule],
})
export class AuthModule {}
