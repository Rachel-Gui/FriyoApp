import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { SocialAuthService } from '../auth/social-auth.service';
import { Controller, Delete, Get, Patch, Body, UseGuards, HttpCode } from '@nestjs/common';
import { InjectRepository }  from '@nestjs/typeorm';
import { Repository }        from 'typeorm';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

import { AccessTokenGuard }  from '../auth/guards/access-token.guard';
import { CurrentUser }       from '../../common/decorators/current-user.decorator';
import { User }              from '../../database/entities/user.entity';
import { UserProfile }       from '../../database/entities/user-profile.entity';
import { UpdateProfileDto }  from './dto/update-profile.dto';
import { UpdateMeDto }       from './dto/update-me.dto';
import { DeleteAccountDto }  from './dto/delete-account.dto';
import { TokenService }      from '../auth/token.service';

@ApiTags('users')
@ApiBearerAuth('access-token')
@UseGuards(AccessTokenGuard)
@Controller('users')
export class UsersController {
  constructor(
    @InjectQueue('notifications.push') private readonly cleanupQueue: Queue,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    @InjectRepository(UserProfile)
    private readonly profileRepo: Repository<UserProfile>,

    private readonly tokenService: TokenService,
    private readonly social: SocialAuthService,
  ) {}

  // ── GET /users/me ──────────────────────────────────────────────────────────

  @Get('me')
  @ApiOperation({ summary: 'Get authenticated user info' })
  async getMe(@CurrentUser() user: User) {
    const profile = await this.profileRepo.findOne({ where: { userId: user.id } });
    return {
      id:                   user.id,
      name:                 user.name,
      email:                user.email,
      avatar_url:           user.avatarUrl,
      onboarding_completed: !!profile?.onboardingCompletedAt,
    };
  }

  // ── PATCH /users/me ────────────────────────────────────────────────────────

  @Patch('me')
  @ApiOperation({ summary: 'Update name / avatar' })
  async updateMe(@CurrentUser() user: User, @Body() dto: UpdateMeDto) {
    const updates: Partial<User> = {};
    if (dto.name       !== undefined) updates.name      = dto.name;
    if (dto.avatar_url !== undefined) updates.avatarUrl = dto.avatar_url;
    if (Object.keys(updates).length) {
      await this.userRepo.update(user.id, updates);
    }
    const updated = await this.userRepo.findOneOrFail({ where: { id: user.id } });
    return { id: updated.id, name: updated.name, email: updated.email, avatar_url: updated.avatarUrl };
  }

  // ── DELETE /users/me ───────────────────────────────────────────────────────

  @Delete('me')
  @HttpCode(204)
  @ApiOperation({ summary: 'Permanently delete the authenticated account and associated data' })
  async deleteMe(
    @CurrentUser() user: User,
    @Body() _dto: DeleteAccountDto,
  ): Promise<void> {
    // All user-owned database records use ON DELETE CASCADE (or SET NULL for
    // authored public recipes). Revoke every refresh session before removing
    // the root user record so no existing session can mint another token.
    await this.social.revokeApple(user);
    await this.tokenService.deleteAllUserRefreshTokens(user.id);
    await this.cleanupQueue.add('account-cleanup', { userId: user.id }, {
      delay: 60_000, attempts: 10, backoff: { type: 'exponential', delay: 60_000 },
      removeOnComplete: true, removeOnFail: 100,
    });
    await this.userRepo.delete(user.id);
  }

  // ── GET /users/profile ─────────────────────────────────────────────────────

  @Get('profile')
  @ApiOperation({ summary: 'Get full user preference profile' })
  async getProfile(@CurrentUser() user: User) {
    const profile = await this.profileRepo.findOne({ where: { userId: user.id } });
    return this.serializeProfile(profile);
  }

  // ── PATCH /users/profile ───────────────────────────────────────────────────

  @Patch('profile')
  @ApiOperation({ summary: 'Update onboarding preferences / mark onboarding complete' })
  async updateProfile(@CurrentUser() user: User, @Body() dto: UpdateProfileDto) {
    let profile = await this.profileRepo.findOne({ where: { userId: user.id } });

    if (!profile) {
      profile = this.profileRepo.create({ userId: user.id });
    }

    if (dto.diet_type           !== undefined) profile.dietType           = dto.diet_type;
    if (dto.allergies           !== undefined) profile.allergies          = dto.allergies;
    if (dto.cooking_skill       !== undefined) profile.cookingSkill       = dto.cooking_skill;
    if (dto.cooking_tools       !== undefined) profile.cookingTools       = dto.cooking_tools;
    if (dto.household_size      !== undefined) profile.householdSize      = dto.household_size;
    if (dto.health_goals        !== undefined) profile.healthGoals        = dto.health_goals;
    if (dto.preferred_cuisines  !== undefined) profile.preferredCuisines  = dto.preferred_cuisines;
    if (dto.disliked_ingredients !== undefined) profile.dislikedIngredients = dto.disliked_ingredients;
    if (dto.weekly_cooking_days !== undefined) profile.weeklyCookingDays  = dto.weekly_cooking_days;

    if (dto.onboarding_completed && !profile.onboardingCompletedAt) {
      profile.onboardingCompletedAt = new Date();
    }

    const saved = await this.profileRepo.save(profile);
    return this.serializeProfile(saved);
  }

  // ── Helper ─────────────────────────────────────────────────────────────────

  private serializeProfile(profile: UserProfile | null) {
    if (!profile) {
      return {
        diet_type: 'omnivore', allergies: [], cooking_skill: 'beginner',
        cooking_tools: [], household_size: 1, health_goals: [],
        preferred_cuisines: [], disliked_ingredients: [], weekly_cooking_days: 3,
        onboarding_completed: false,
      };
    }
    return {
      diet_type:            profile.dietType,
      allergies:            profile.allergies,
      cooking_skill:        profile.cookingSkill,
      cooking_tools:        profile.cookingTools,
      household_size:       profile.householdSize,
      health_goals:         profile.healthGoals,
      preferred_cuisines:   profile.preferredCuisines,
      disliked_ingredients: profile.dislikedIngredients,
      weekly_cooking_days:  profile.weeklyCookingDays,
      onboarding_completed: !!profile.onboardingCompletedAt,
    };
  }
}
