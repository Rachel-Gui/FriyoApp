import {
  Injectable, ConflictException, UnauthorizedException,
  BadRequestException, NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AdminLoginDto } from './dto/admin-login.dto';
import { TokenService } from './token.service';
import { AuthResponse, AdminAuthResponse } from './interfaces/auth-response.interface';
import { User, AuthProvider } from '../../database/entities/user.entity';
import { UserProfile } from '../../database/entities/user-profile.entity';
import { AdminUser } from '../../database/entities/admin-user.entity';
import * as bcrypt from 'bcrypt';

export interface OAuthUserDto {
  provider: AuthProvider;
  providerId: string;
  email: string | null;
  name: string;
  avatarUrl: string | null;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    @InjectRepository(UserProfile)
    private readonly profileRepo: Repository<UserProfile>,

    @InjectRepository(AdminUser)
    private readonly adminRepo: Repository<AdminUser>,

    private readonly tokenService: TokenService,
    private readonly dataSource: DataSource,
  ) {}

  // ── Email / Password ──────────────────────────────────────────────────────

  async register(dto: RegisterDto): Promise<AuthResponse> {
    if (Buffer.byteLength(dto.password, 'utf8') > 72) throw new BadRequestException('Password must be at most 72 UTF-8 bytes');
    const existing = await this.userRepo.findOne({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    return this.dataSource.transaction(async (manager) => {
      const user = manager.create(User, {
        email: dto.email,
        phone: dto.phone ?? null,
        name: dto.name,
        passwordHash: dto.password,
        authProvider: AuthProvider.LOCAL,
      });
      await manager.save(user);

      const profile = manager.create(UserProfile, { userId: user.id });
      await manager.save(profile);

      return this.tokenService.generateAuthResponse(user, false);
    });
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.userRepo.findOne({ where: { email: dto.email } });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid email or password');
    }
    if (user.isBanned) {
      throw new UnauthorizedException('Account has been suspended');
    }
    if (!user.isActive) {
      throw new UnauthorizedException('Account is inactive');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Update last active
    await this.userRepo.update(user.id, { lastActiveAt: new Date() });

    const profile = await this.profileRepo.findOne({ where: { userId: user.id } });
    const onboarded = !!profile?.onboardingCompletedAt;

    return this.tokenService.generateAuthResponse(user, onboarded);
  }

  async refresh(refreshToken: string): Promise<AuthResponse> {
    const payload = this.tokenService.decodeRefreshPayload(refreshToken);

    await this.tokenService.validateRefreshToken(payload.sub, payload.jti, refreshToken);

    const user = await this.userRepo.findOne({
      where: { id: payload.sub, isActive: true, isBanned: false },
    });
    if (!user) {
      throw new UnauthorizedException('User not found or account disabled');
    }

    const profile = await this.profileRepo.findOne({ where: { userId: user.id } });
    return this.tokenService.rotateAccessToken(user, payload.jti, !!profile?.onboardingCompletedAt);
  }

  async logout(userId: string, jti: string): Promise<void> {
    await this.tokenService.deleteRefreshToken(userId, jti);
  }

  async logoutAll(userId: string): Promise<void> {
    await this.tokenService.deleteAllUserRefreshTokens(userId);
  }

  // ── OAuth ─────────────────────────────────────────────────────────────────

  async findOrCreateOAuthUser(dto: OAuthUserDto): Promise<User> {
    // 1. Try to find by providerId
    let user = await this.userRepo.findOne({
      where: { authProvider: dto.provider, providerId: dto.providerId },
    });
    if (user) return user;

    // 2. If email exists, link the provider to the existing account
    if (dto.email) {
      user = await this.userRepo.findOne({ where: { email: dto.email } });
      if (user) {
        throw new ConflictException('This email already has an account. Sign in using your original method.');
      }
    }

    // 3. Brand-new user — create with profile
    return this.dataSource.transaction(async (manager) => {
      const newUser = manager.create(User, {
        email: dto.email,
        name: dto.name,
        avatarUrl: dto.avatarUrl,
        authProvider: dto.provider,
        providerId: dto.providerId,
        lastActiveAt: new Date(),
      });
      await manager.save(newUser);

      const profile = manager.create(UserProfile, { userId: newUser.id });
      await manager.save(profile);

      return newUser;
    });
  }

  async oauthCallback(user: User): Promise<AuthResponse> {
    if (!user.isActive || user.isBanned) throw new UnauthorizedException('Account is unavailable');
    const profile = await this.profileRepo.findOne({ where: { userId: user.id } });
    return this.tokenService.generateAuthResponse(user, !!profile?.onboardingCompletedAt);
  }

  // ── Admin ─────────────────────────────────────────────────────────────────

  async adminLogin(dto: AdminLoginDto): Promise<AdminAuthResponse> {
    const admin = await this.adminRepo.findOne({ where: { username: dto.username } });

    if (!admin) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (!admin.isActive) {
      throw new UnauthorizedException('Admin account is disabled');
    }

    const valid = await admin.validatePassword(dto.password);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.adminRepo.update(admin.id, { lastLoginAt: new Date() });

    return this.tokenService.generateAdminResponse(admin);
  }
}
