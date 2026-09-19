import { PasswordResetService } from './password-reset.service';
import { ForgotPasswordDto, ResetPasswordDto } from './dto/password-reset.dto';
import { SocialAuthService } from './social-auth.service';
import { GoogleLoginDto, AppleLoginDto } from './dto/social-login.dto';
import {
  Controller, Post, Get, Body, Req, Res, UseGuards,
  HttpCode, HttpStatus, UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { AccessTokenGuard } from './guards/access-token.guard';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../../database/entities/user.entity';
import { AuthResponse } from './interfaces/auth-response.interface';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService, private readonly social: SocialAuthService, private readonly passwords: PasswordResetService) {}

  @Public()
  @Post('forgot-password')
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  forgotPassword(@Body() dto: ForgotPasswordDto) { return this.passwords.request(dto.email); }

  @Public()
  @Post('reset-password')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  resetPassword(@Body() dto: ResetPasswordDto) { return this.passwords.reset(dto.email, dto.code, dto.password); }

  // ── Email / Password ──────────────────────────────────────────────────────

  @Public()
  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Register with email and password' })
  async register(@Body() dto: RegisterDto): Promise<AuthResponse> {
    return this.authService.register(dto);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email and password' })
  // 5 attempts per minute per IP
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async login(@Body() dto: LoginDto): Promise<AuthResponse> {
    return this.authService.login(dto);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Exchange refresh token for a new access token' })
  @ApiBody({ type: RefreshTokenDto })
  async refresh(@Body() dto: RefreshTokenDto): Promise<AuthResponse> {
    return this.authService.refresh(dto.refresh_token);
  }

  @UseGuards(AccessTokenGuard)
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Invalidate the current refresh token' })
  async logout(
    @CurrentUser() user: User,
    @Req() req: Request,
  ): Promise<void> {
    // jti is injected into the request by JwtStrategy
    const jti: string | undefined = (req as Request & { jti?: string }).jti;
    if (!jti) throw new UnauthorizedException('Missing token ID');
    await this.authService.logout(user.id, jti);
  }

  @UseGuards(AccessTokenGuard)
  @Post('logout-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Invalidate ALL refresh tokens for this user' })
  async logoutAll(@CurrentUser() user: User): Promise<void> {
    await this.authService.logoutAll(user.id);
  }

  @Public()
  @Post('google')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  googleNative(@Body() dto: GoogleLoginDto) { return this.social.google(dto.identityToken); }

  @Public()
  @Post('apple/challenge')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  appleChallenge() { return this.social.challenge(); }

  @Public()
  @Post('apple')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  appleNative(@Body() dto: AppleLoginDto) {
    return this.social.apple(dto.identityToken, dto.authorizationCode, dto.nonce, dto.name);
  }

  // ── Introspect ────────────────────────────────────────────────────────────

  @UseGuards(AccessTokenGuard)
  @Get('me')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Return the authenticated user profile' })
  me(@CurrentUser() user: User): Partial<User> {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl,
      authProvider: user.authProvider,
      createdAt: user.createdAt,
    };
  }
}
