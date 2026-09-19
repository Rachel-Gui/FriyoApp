import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import {
  Injectable, NotFoundException, ConflictException,
  ForbiddenException, BadRequestException, Logger, Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In, ILike, Not } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import Redis from 'ioredis';

import { User }           from '../../database/entities/user.entity';
import { Ingredient }     from '../../database/entities/ingredient.entity';
import { FridgeItem }     from '../../database/entities/fridge-item.entity';
import { RecipeIngredient } from '../../database/entities/recipe-ingredient.entity';
import { Recipe, RecipeReviewStatus, RecipeStatus } from '../../database/entities/recipe.entity';
import { MealLog }        from '../../database/entities/meal-log.entity';
import { ScanSession, ScanStatus } from '../../database/entities/scan-session.entity';
import { CommunityPost, ModerationStatus } from '../../database/entities/community-post.entity';
import { ContentReport, ReportStatus }    from '../../database/entities/content-report.entity';
import { AdminUser, AdminRole }           from '../../database/entities/admin-user.entity';
import { AdminLog }       from '../../database/entities/admin-log.entity';
import { Banner, BannerStatus } from '../../database/entities/banner.entity';
import { Agreement, AgreementType } from '../../database/entities/agreement.entity';

import { ListUsersDto }         from './dto/list-users.dto';
import { BanUserDto }           from './dto/ban-user.dto';
import { CreateIngredientDto }  from './dto/create-ingredient.dto';
import { UpdateIngredientDto }  from './dto/update-ingredient.dto';
import { MergeIngredientsDto }  from './dto/merge-ingredients.dto';
import { RejectRecipeDto }      from './dto/reject-recipe.dto';
import { ResolveReportDto }     from './dto/resolve-report.dto';
import { CreateBannerDto }      from './dto/create-banner.dto';
import { SendPushDto }          from './dto/send-push.dto';
import { CreateAgreementDto }   from './dto/create-agreement.dto';
import { CreateAdminDto }       from './dto/create-admin.dto';
import { UpdateAdminDto }       from './dto/update-admin.dto';
import { ListRecipesDto }       from './dto/list-recipes.dto';
import { ListReportsDto }       from './dto/list-reports.dto';
import { AnalyticsQueryDto, AnalyticsPeriod } from './dto/analytics-query.dto';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    @InjectQueue('notifications.push') private readonly pushQueue: Queue,
    @InjectRepository(User)             private readonly userRepo: Repository<User>,
    @InjectRepository(Ingredient)       private readonly ingredientRepo: Repository<Ingredient>,
    @InjectRepository(FridgeItem)       private readonly fridgeItemRepo: Repository<FridgeItem>,
    @InjectRepository(RecipeIngredient) private readonly recipeIngredientRepo: Repository<RecipeIngredient>,
    @InjectRepository(Recipe)           private readonly recipeRepo: Repository<Recipe>,
    @InjectRepository(MealLog)          private readonly mealLogRepo: Repository<MealLog>,
    @InjectRepository(ScanSession)      private readonly scanSessionRepo: Repository<ScanSession>,
    @InjectRepository(CommunityPost)    private readonly postRepo: Repository<CommunityPost>,
    @InjectRepository(ContentReport)    private readonly reportRepo: Repository<ContentReport>,
    @InjectRepository(AdminUser)        private readonly adminUserRepo: Repository<AdminUser>,
    @InjectRepository(AdminLog)         private readonly adminLogRepo: Repository<AdminLog>,
    @InjectRepository(Banner)           private readonly bannerRepo: Repository<Banner>,
    @InjectRepository(Agreement)        private readonly agreementRepo: Repository<Agreement>,

    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,

    @Inject('REDIS_CLIENT')
    private readonly redis: Redis,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────────
  // Audit logging helper
  // ─────────────────────────────────────────────────────────────────────────────

  private async log(
    adminId: string,
    action: string,
    targetType?: string,
    targetId?: string,
    beforeData?: Record<string, unknown>,
    afterData?: Record<string, unknown>,
    ip?: string,
  ): Promise<void> {
    try {
      const entry = this.adminLogRepo.create({
        adminId,
        action,
        targetType: targetType ?? null,
        targetId:   targetId   ?? null,
        beforeData: beforeData ?? null,
        afterData:  afterData  ?? null,
        ip:         ip         ?? null,
      });
      await this.adminLogRepo.save(entry);
    } catch (err) {
      this.logger.error(`Failed to write audit log: ${(err as Error).message}`);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Dashboard
  // ─────────────────────────────────────────────────────────────────────────────

  async getDashboard(): Promise<Record<string, unknown>> {
    const [
      totalUsers,
      totalRecipes,
      pendingReviews,
      flaggedPosts,
      pendingReports,
      totalScans,
    ] = await Promise.all([
      this.userRepo.count(),
      this.recipeRepo.count(),
      this.recipeRepo.count({ where: { reviewStatus: RecipeReviewStatus.PENDING } }),
      this.postRepo.count({ where: { moderationStatus: ModerationStatus.FLAGGED } }),
      this.reportRepo.count({ where: { status: ReportStatus.PENDING } }),
      this.scanSessionRepo.count(),
    ]);

    // New users in last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const newUsersWeek = await this.userRepo
      .createQueryBuilder('u')
      .where('u.createdAt >= :date', { date: sevenDaysAgo })
      .getCount();

    // Meal logs this month
    const monthStart = new Date();
    monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    const mealLogsMonth = await this.mealLogRepo
      .createQueryBuilder('ml')
      .where('ml.loggedAt >= :date', { date: monthStart })
      .getCount();

    return {
      users: {
        total: totalUsers,
        newLast7Days: newUsersWeek,
      },
      recipes: {
        total: totalRecipes,
        pendingReview: pendingReviews,
      },
      community: {
        flaggedPosts,
        pendingReports,
      },
      activity: {
        totalAiScans: totalScans,
        mealLogsThisMonth: mealLogsMonth,
      },
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Users
  // ─────────────────────────────────────────────────────────────────────────────

  async listUsers(dto: ListUsersDto) {
    const page  = dto.page  ?? 1;
    const limit = dto.limit ?? 20;

    const qb = this.userRepo.createQueryBuilder('u')
      .leftJoinAndSelect('u.profile', 'p')
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('u.createdAt', 'DESC');

    if (dto.search) {
      qb.andWhere('(u.name ILIKE :q OR u.email ILIKE :q OR u.phone ILIKE :q)', {
        q: `%${dto.search}%`,
      });
    }
    if (dto.status === 'banned') {
      qb.andWhere('u.isBanned = true');
    } else if (dto.status === 'active') {
      qb.andWhere('u.isBanned = false');
    }
    if (dto.sort === 'created_at') {
      qb.orderBy('u.createdAt', 'DESC');
    } else if (dto.sort === 'last_active') {
      qb.orderBy('u.lastActiveAt', 'DESC');
    }

    const [users, total] = await qb.getManyAndCount();
    return { data: users, total, page, limit };
  }

  async getUserDetail(userId: string) {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: ['profile'],
    });
    if (!user) throw new NotFoundException('User not found');

    const [mealCount, postCount, fridgeCount, scanCount] = await Promise.all([
      this.mealLogRepo.count({ where: { userId } }),
      this.postRepo.count({ where: { userId } }),
      this.fridgeItemRepo.count({ where: { userId } }),
      this.scanSessionRepo.count({ where: { userId } }),
    ]);

    return { ...user, stats: { mealCount, postCount, fridgeCount, scanCount } };
  }

  async banUser(adminId: string, userId: string, dto: BanUserDto, ip?: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.isBanned) throw new ConflictException('User already banned');

    const before = { isBanned: user.isBanned };
    user.isBanned  = true;
    user.isActive  = false;
    await this.userRepo.save(user);

    await this.log(adminId, 'ban_user', 'user', userId, before,
      { isBanned: true, reason: dto.reason, durationDays: dto.durationDays ?? 0 }, ip);

    return { message: 'User banned', userId };
  }

  async unbanUser(adminId: string, userId: string, ip?: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (!user.isBanned) throw new ConflictException('User is not banned');

    const before = { isBanned: user.isBanned };
    user.isBanned = false;
    user.isActive = true;
    await this.userRepo.save(user);

    await this.log(adminId, 'unban_user', 'user', userId, before, { isBanned: false }, ip);
    return { message: 'User unbanned', userId };
  }

  async deleteUser(adminId: string, userId: string, ip?: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    await this.log(adminId, 'delete_user', 'user', userId,
      { email: user.email, name: user.name }, undefined, ip);

    await this.userRepo.remove(user);
    return { message: 'User deleted', userId };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Ingredients
  // ─────────────────────────────────────────────────────────────────────────────

  async listIngredients(page = 1, limit = 30, search?: string) {
    const where = search ? { name: ILike(`%${search}%`) } : undefined;
    const [data, total] = await this.ingredientRepo.findAndCount({
      where,
      skip: (page - 1) * limit,
      take: limit,
      order: { name: 'ASC' },
    });
    return { data, total, page, limit };
  }

  async createIngredient(adminId: string, dto: CreateIngredientDto, ip?: string) {
    const exists = await this.ingredientRepo.findOne({ where: { name: dto.name } });
    if (exists) throw new ConflictException(`Ingredient "${dto.name}" already exists`);

    const ingredient = this.ingredientRepo.create({
      name:              dto.name,
      category:          dto.category as any,
      unit:              dto.defaultUnit ?? null,
      caloriesPer100g:   dto.calories ?? null,
      aliases:           dto.aliases ?? null,
      tags:              null,
      createdByAdmin:    true,
    });
    const saved = await this.ingredientRepo.save(ingredient);
    await this.log(adminId, 'create_ingredient', 'ingredient', saved.id, undefined, { name: dto.name }, ip);
    return saved;
  }

  async updateIngredient(adminId: string, id: string, dto: UpdateIngredientDto, ip?: string) {
    const ingredient = await this.ingredientRepo.findOne({ where: { id } });
    if (!ingredient) throw new NotFoundException('Ingredient not found');

    const before: Record<string, unknown> = { name: ingredient.name, category: ingredient.category };
    const updates: Record<string, unknown> = {};
    if (dto.name !== undefined)        updates['name']            = dto.name;
    if (dto.category !== undefined)    updates['category']        = dto.category;
    if (dto.defaultUnit !== undefined) updates['unit']            = dto.defaultUnit;
    if (dto.calories !== undefined)    updates['caloriesPer100g'] = dto.calories;
    if (dto.aliases !== undefined)     updates['aliases']         = dto.aliases;

    await this.ingredientRepo.update(id, updates as any);
    await this.log(adminId, 'update_ingredient', 'ingredient', id, before, updates, ip);
    return this.ingredientRepo.findOneOrFail({ where: { id } });
  }

  async deleteIngredient(adminId: string, id: string, ip?: string) {
    const ingredient = await this.ingredientRepo.findOne({ where: { id } });
    if (!ingredient) throw new NotFoundException('Ingredient not found');

    const fridgeCount  = await this.fridgeItemRepo.count({ where: { ingredientId: id } });
    const recipeCount  = await this.recipeIngredientRepo.count({ where: { ingredientId: id } });
    if (fridgeCount > 0 || recipeCount > 0) {
      throw new BadRequestException(
        `Cannot delete: ingredient is referenced by ${fridgeCount} fridge item(s) and ${recipeCount} recipe ingredient(s)`,
      );
    }

    await this.log(adminId, 'delete_ingredient', 'ingredient', id, { name: ingredient.name }, undefined, ip);
    await this.ingredientRepo.remove(ingredient);
    return { message: 'Ingredient deleted', id };
  }

  async mergeIngredients(adminId: string, dto: MergeIngredientsDto, ip?: string) {
    const { targetId, sourceIds } = dto;

    const target = await this.ingredientRepo.findOne({ where: { id: targetId } });
    if (!target) throw new NotFoundException('Target ingredient not found');

    const sources = await this.ingredientRepo.find({ where: { id: In(sourceIds) } });
    if (sources.length !== sourceIds.length) {
      throw new NotFoundException('One or more source ingredients not found');
    }
    if (sourceIds.includes(targetId)) {
      throw new BadRequestException('targetId cannot appear in sourceIds');
    }

    await this.dataSource.transaction(async (manager) => {
      // Re-point fridge items
      await manager.createQueryBuilder()
        .update(FridgeItem)
        .set({ ingredientId: targetId })
        .where({ ingredientId: In(sourceIds) })
        .execute();

      // Re-point recipe ingredients (delete duplicates that would collide on recipe+ingredient)
      for (const sourceId of sourceIds) {
        const colliding = await manager.find(RecipeIngredient, {
          where: { ingredientId: targetId },
          select: ['recipeId'],
        });
        const collidingRecipeIds = colliding.map((ri) => ri.recipeId);

        // Delete source RIs that would duplicate (same recipe already has targetId)
        if (collidingRecipeIds.length > 0) {
          await manager.delete(RecipeIngredient, {
            ingredientId: sourceId,
            recipeId:     In(collidingRecipeIds),
          });
        }
        // Update the remaining
        await manager.createQueryBuilder()
          .update(RecipeIngredient)
          .set({ ingredientId: targetId })
          .where({ ingredientId: sourceId })
          .execute();
      }

      // Merge aliases into target
      const allAliases = new Set<string>([...(target.aliases ?? [])]);
      for (const src of sources) {
        allAliases.add(src.name);
        for (const a of src.aliases ?? []) allAliases.add(a);
      }
      await manager.update(Ingredient, targetId, { aliases: Array.from(allAliases) } as any);

      // Delete source ingredients
      await manager.delete(Ingredient, { id: In(sourceIds) });
    });

    await this.log(adminId, 'merge_ingredients', 'ingredient', targetId,
      { sourceIds }, { targetId }, ip);

    return { message: 'Ingredients merged', targetId, mergedCount: sourceIds.length };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Recipes
  // ─────────────────────────────────────────────────────────────────────────────

  async listRecipes(dto: ListRecipesDto) {
    const page  = dto.page  ?? 1;
    const limit = dto.limit ?? 20;

    const qb = this.recipeRepo.createQueryBuilder('r')
      .leftJoin('r.author', 'u')
      .addSelect(['u.id', 'u.name', 'u.email'])
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('r.createdAt', 'DESC');

    if (dto.search) {
      qb.andWhere('r.title ILIKE :q', { q: `%${dto.search}%` });
    }
    if (dto.status) {
      qb.andWhere('r.status = :status', { status: dto.status });
    } else {
      // Default: show pending review
      qb.andWhere('r.reviewStatus = :rs', { rs: RecipeReviewStatus.PENDING });
    }
    if (dto.cuisine) {
      qb.andWhere('r.cuisineType ILIKE :cuisine', { cuisine: `%${dto.cuisine}%` });
    }

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }

  async approveRecipe(adminId: string, recipeId: string, ip?: string) {
    const recipe = await this.recipeRepo.findOne({ where: { id: recipeId } });
    if (!recipe) throw new NotFoundException('Recipe not found');

    const before = { reviewStatus: recipe.reviewStatus, status: recipe.status };
    await this.recipeRepo.update(recipeId, {
      reviewStatus: RecipeReviewStatus.APPROVED,
      status:       RecipeStatus.PUBLISHED,
      approverId:   adminId,
    } as any);

    await this.log(adminId, 'approve_recipe', 'recipe', recipeId, before,
      { reviewStatus: RecipeReviewStatus.APPROVED }, ip);

    return { message: 'Recipe approved', recipeId };
  }

  async rejectRecipe(adminId: string, recipeId: string, dto: RejectRecipeDto, ip?: string) {
    const recipe = await this.recipeRepo.findOne({ where: { id: recipeId } });
    if (!recipe) throw new NotFoundException('Recipe not found');

    const before = { reviewStatus: recipe.reviewStatus };
    await this.recipeRepo.update(recipeId, {
      reviewStatus: RecipeReviewStatus.REJECTED,
    } as any);

    await this.log(adminId, 'reject_recipe', 'recipe', recipeId, before,
      { reviewStatus: RecipeReviewStatus.REJECTED, reason: dto.reason }, ip);

    return { message: 'Recipe rejected', recipeId, reason: dto.reason };
  }

  async deleteRecipe(adminId: string, recipeId: string, ip?: string) {
    const recipe = await this.recipeRepo.findOne({ where: { id: recipeId } });
    if (!recipe) throw new NotFoundException('Recipe not found');

    await this.log(adminId, 'delete_recipe', 'recipe', recipeId,
      { title: recipe.title, status: recipe.status }, undefined, ip);
    await this.recipeRepo.remove(recipe);
    return { message: 'Recipe deleted', recipeId };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Community moderation
  // ─────────────────────────────────────────────────────────────────────────────

  async listFlaggedPosts(page = 1, limit = 20) {
    const [data, total] = await this.postRepo.findAndCount({
      where: { moderationStatus: ModerationStatus.FLAGGED },
      relations: ['user'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total, page, limit };
  }

  async approvePost(adminId: string, postId: string, ip?: string) {
    const post = await this.postRepo.findOne({ where: { id: postId } });
    if (!post) throw new NotFoundException('Post not found');

    const before = { moderationStatus: post.moderationStatus };
    await this.postRepo.update(postId, { moderationStatus: ModerationStatus.APPROVED });
    await this.log(adminId, 'approve_post', 'community_post', postId, before,
      { moderationStatus: ModerationStatus.APPROVED }, ip);
    return { message: 'Post approved', postId };
  }

  async removePost(adminId: string, postId: string, ip?: string) {
    const post = await this.postRepo.findOne({ where: { id: postId } });
    if (!post) throw new NotFoundException('Post not found');

    const before = { moderationStatus: post.moderationStatus, isHidden: post.isHidden };
    await this.postRepo.update(postId, {
      moderationStatus: ModerationStatus.REMOVED,
      isHidden: true,
    });
    await this.log(adminId, 'remove_post', 'community_post', postId, before,
      { moderationStatus: ModerationStatus.REMOVED }, ip);
    return { message: 'Post removed', postId };
  }

  async listReports(dto: ListReportsDto) {
    const page  = dto.page  ?? 1;
    const limit = dto.limit ?? 20;

    const qb = this.reportRepo.createQueryBuilder('r')
      .leftJoin('r.reporter', 'u')
      .addSelect(['u.id', 'u.name', 'u.email'])
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('r.createdAt', 'DESC');

    if (dto.status) {
      qb.andWhere('r.status = :status', { status: dto.status });
    } else {
      qb.andWhere('r.status = :status', { status: ReportStatus.PENDING });
    }
    if (dto.contentType) {
      qb.andWhere('r.contentType = :ct', { ct: dto.contentType });
    }

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }

  async resolveReport(adminId: string, reportId: string, dto: ResolveReportDto, ip?: string) {
    const report = await this.reportRepo.findOne({ where: { id: reportId } });
    if (!report) throw new NotFoundException('Report not found');
    if (report.status !== ReportStatus.PENDING) {
      throw new ConflictException('Report is already resolved or dismissed');
    }

    const before = { status: report.status };
    await this.reportRepo.update(reportId, {
      status:      dto.action,
      handledBy:   adminId,
      resolvedAt:  new Date(),
    });

    await this.log(adminId, `${dto.action}_report`, 'content_report', reportId,
      before, { status: dto.action, notes: dto.notes }, ip);
    return { message: `Report ${dto.action}`, reportId };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Ops — Banners
  // ─────────────────────────────────────────────────────────────────────────────

  async listBanners() {
    return this.bannerRepo.find({ order: { createdAt: 'DESC' } });
  }

  async createBanner(adminId: string, dto: CreateBannerDto, ip?: string) {
    const banner = this.bannerRepo.create({
      title:     dto.title,
      imageUrl:  dto.imageUrl,
      linkUrl:   dto.linkUrl ?? null,
      status:    dto.status  ?? BannerStatus.ACTIVE,
      startAt:   dto.startAt ? new Date(dto.startAt) : null,
      endAt:     dto.endAt   ? new Date(dto.endAt)   : null,
      createdBy: adminId,
    });
    const saved = await this.bannerRepo.save(banner);
    await this.log(adminId, 'create_banner', 'banner', saved.id, undefined, { title: dto.title }, ip);
    return saved;
  }

  async updateBanner(adminId: string, bannerId: string, dto: Partial<CreateBannerDto>, ip?: string) {
    const banner = await this.bannerRepo.findOne({ where: { id: bannerId } });
    if (!banner) throw new NotFoundException('Banner not found');

    const updates: Record<string, unknown> = {};
    if (dto.title    !== undefined) updates['title']    = dto.title;
    if (dto.imageUrl !== undefined) updates['imageUrl'] = dto.imageUrl;
    if (dto.linkUrl  !== undefined) updates['linkUrl']  = dto.linkUrl;
    if (dto.status   !== undefined) updates['status']   = dto.status;
    if (dto.startAt  !== undefined) updates['startAt']  = new Date(dto.startAt);
    if (dto.endAt    !== undefined) updates['endAt']    = new Date(dto.endAt);

    await this.bannerRepo.update(bannerId, updates as any);
    await this.log(adminId, 'update_banner', 'banner', bannerId, undefined, updates, ip);
    return this.bannerRepo.findOneOrFail({ where: { id: bannerId } });
  }

  async deleteBanner(adminId: string, bannerId: string, ip?: string) {
    const banner = await this.bannerRepo.findOne({ where: { id: bannerId } });
    if (!banner) throw new NotFoundException('Banner not found');

    await this.log(adminId, 'delete_banner', 'banner', bannerId, { title: banner.title }, undefined, ip);
    await this.bannerRepo.remove(banner);
    return { message: 'Banner deleted', bannerId };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Ops — Push Notifications (stubbed — wire into FCM/APNS via NotificationsModule)
  // ─────────────────────────────────────────────────────────────────────────────

  async sendPushNotification(adminId: string, dto: SendPushDto, ip?: string) {
    this.logger.log(
      `Admin ${adminId} sending push "${dto.title}" to ${dto.userIds?.length ?? 'ALL'} users`,
    );

    // Publish to Redis channel for NotificationsModule worker to pick up
    const payload = {
      type: 'users',
      title:   dto.title,
      body:    dto.body,
      userIds: dto.userIds,
      data:    dto.data    ?? {},
      sentBy:  adminId,
      sentAt:  new Date().toISOString(),
    };
    await this.pushQueue.add('push', payload, { attempts: 3, backoff: { type: 'exponential', delay: 5000 }, removeOnComplete: true, removeOnFail: 100 });

    await this.log(adminId, 'send_push', undefined, undefined, undefined,
      { title: dto.title, recipientCount: dto.userIds?.length ?? 'all' }, ip);

    return {
      message: 'Push notification queued',
      recipientCount: dto.userIds?.length ?? 'all',
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Ops — Agreements
  // ─────────────────────────────────────────────────────────────────────────────

  async listAgreements() {
    return this.agreementRepo.find({ order: { type: 'ASC', createdAt: 'DESC' } });
  }

  async createAgreement(adminId: string, dto: CreateAgreementDto, ip?: string) {
    const existing = await this.agreementRepo.findOne({
      where: { type: dto.type, version: dto.version },
    });
    if (existing) {
      throw new ConflictException(`Agreement type="${dto.type}" version="${dto.version}" already exists`);
    }

    const agreement = this.agreementRepo.create({
      type:        dto.type,
      version:     dto.version,
      content:     dto.content,
      isCurrent:   false,
      createdBy:   adminId,
      publishedAt: null,
    });
    const saved = await this.agreementRepo.save(agreement);

    if (dto.publishNow) {
      await this.publishAgreement(adminId, saved.id, ip);
      return this.agreementRepo.findOneOrFail({ where: { id: saved.id } });
    }

    await this.log(adminId, 'create_agreement', 'agreement', saved.id, undefined,
      { type: dto.type, version: dto.version }, ip);
    return saved;
  }

  async publishAgreement(adminId: string, agreementId: string, ip?: string) {
    const agreement = await this.agreementRepo.findOne({ where: { id: agreementId } });
    if (!agreement) throw new NotFoundException('Agreement not found');

    await this.dataSource.transaction(async (manager) => {
      // Unset all current flags for same type
      await manager.update(Agreement, { type: agreement.type, isCurrent: true }, {
        isCurrent: false,
      } as any);
      // Publish this one
      await manager.update(Agreement, agreementId, {
        isCurrent:   true,
        publishedAt: new Date(),
      } as any);
    });

    await this.log(adminId, 'publish_agreement', 'agreement', agreementId, undefined,
      { type: agreement.type, version: agreement.version }, ip);

    return this.agreementRepo.findOneOrFail({ where: { id: agreementId } });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Analytics
  // ─────────────────────────────────────────────────────────────────────────────

  async getAnalytics(dto: AnalyticsQueryDto): Promise<Record<string, unknown>> {
    const period = dto.period ?? AnalyticsPeriod.WEEK;
    const to   = dto.to   ? new Date(dto.to)   : new Date();
    const from = dto.from ? new Date(dto.from)  : this.periodStart(period, to);

    const pgDateTrunc = period === AnalyticsPeriod.DAY ? 'hour' : 'day';

    // User signups over time
    const userGrowth = await this.userRepo
      .createQueryBuilder('u')
      .select(`DATE_TRUNC('${pgDateTrunc}', u.createdAt)`, 'bucket')
      .addSelect('COUNT(*)', 'count')
      .where('u.createdAt BETWEEN :from AND :to', { from, to })
      .groupBy('bucket')
      .orderBy('bucket', 'ASC')
      .getRawMany();

    // Meal logs over time
    const mealActivity = await this.mealLogRepo
      .createQueryBuilder('ml')
      .select(`DATE_TRUNC('${pgDateTrunc}', ml.loggedAt)`, 'bucket')
      .addSelect('COUNT(*)', 'count')
      .where('ml.loggedAt BETWEEN :from AND :to', { from, to })
      .groupBy('bucket')
      .orderBy('bucket', 'ASC')
      .getRawMany();

    // Top 10 recipes by meal log count
    const topRecipes = await this.mealLogRepo
      .createQueryBuilder('ml')
      .select('ml.recipeId', 'recipeId')
      .addSelect('COUNT(*)', 'count')
      .where('ml.loggedAt BETWEEN :from AND :to', { from, to })
      .andWhere('ml.recipeId IS NOT NULL')
      .groupBy('ml.recipeId')
      .orderBy('count', 'DESC')
      .limit(10)
      .getRawMany();

    // AI scans over time
    const scanActivity = await this.scanSessionRepo
      .createQueryBuilder('ss')
      .select(`DATE_TRUNC('${pgDateTrunc}', ss.createdAt)`, 'bucket')
      .addSelect('COUNT(*)', 'count')
      .where('ss.createdAt BETWEEN :from AND :to', { from, to })
      .groupBy('bucket')
      .orderBy('bucket', 'ASC')
      .getRawMany();

    // New community posts
    const postActivity = await this.postRepo
      .createQueryBuilder('cp')
      .select(`DATE_TRUNC('${pgDateTrunc}', cp.createdAt)`, 'bucket')
      .addSelect('COUNT(*)', 'count')
      .where('cp.createdAt BETWEEN :from AND :to', { from, to })
      .groupBy('bucket')
      .orderBy('bucket', 'ASC')
      .getRawMany();

    return {
      period,
      range: { from, to },
      userGrowth,
      mealActivity,
      topRecipes,
      scanActivity,
      postActivity,
    };
  }

  private periodStart(period: AnalyticsPeriod, to: Date): Date {
    const d = new Date(to);
    if (period === AnalyticsPeriod.DAY)   { d.setDate(d.getDate() - 1);   return d; }
    if (period === AnalyticsPeriod.WEEK)  { d.setDate(d.getDate() - 7);   return d; }
    if (period === AnalyticsPeriod.MONTH) { d.setMonth(d.getMonth() - 1); return d; }
    return d;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Admin account management
  // ─────────────────────────────────────────────────────────────────────────────

  async listAdmins() {
    return this.adminUserRepo.find({
      select: ['id', 'username', 'email', 'role', 'isActive', 'lastLoginAt', 'createdAt'],
      order:  { createdAt: 'DESC' },
    });
  }

  async createAdmin(requesterId: string, dto: CreateAdminDto, ip?: string) {
    const existsByEmail    = await this.adminUserRepo.findOne({ where: { email: dto.email } });
    const existsByUsername = await this.adminUserRepo.findOne({ where: { username: dto.username } });
    if (existsByEmail)    throw new ConflictException('Email already in use');
    if (existsByUsername) throw new ConflictException('Username already in use');

    const admin = this.adminUserRepo.create({
      username:     dto.username,
      email:        dto.email,
      passwordHash: dto.password, // @BeforeInsert hashes it
      role:         dto.role,
      permissions:  dto.permissions ?? {},
      isActive:     true,
    });
    const saved = await this.adminUserRepo.save(admin);

    await this.log(requesterId, 'create_admin', 'admin_user', saved.id, undefined,
      { username: dto.username, role: dto.role }, ip);

    // Return without hash
    const { passwordHash: _, ...result } = saved;
    return result;
  }

  async updateAdmin(requesterId: string, adminId: string, dto: UpdateAdminDto, ip?: string) {
    const admin = await this.adminUserRepo.findOne({ where: { id: adminId } });
    if (!admin) throw new NotFoundException('Admin user not found');

    // Only super_admin can change roles of other admins
    const requester = await this.adminUserRepo.findOne({ where: { id: requesterId } });
    if (dto.role && requester?.role !== AdminRole.SUPER_ADMIN && requesterId !== adminId) {
      throw new ForbiddenException('Only super_admin can change roles');
    }

    const before: Record<string, unknown> = { role: admin.role, isActive: admin.isActive };
    const updates: Record<string, unknown> = {};

    if (dto.email       !== undefined) updates['email']       = dto.email;
    if (dto.role        !== undefined) updates['role']        = dto.role;
    if (dto.isActive    !== undefined) updates['isActive']    = dto.isActive;
    if (dto.permissions !== undefined) updates['permissions'] = dto.permissions;
    if (dto.password) {
      updates['passwordHash'] = await bcrypt.hash(dto.password, 12);
    }

    await this.adminUserRepo.update(adminId, updates as any);
    await this.log(requesterId, 'update_admin', 'admin_user', adminId, before, updates, ip);

    const updated = await this.adminUserRepo.findOneOrFail({ where: { id: adminId } });
    const { passwordHash: _, ...result } = updated;
    return result;
  }

  async deactivateAdmin(requesterId: string, adminId: string, ip?: string) {
    if (requesterId === adminId) {
      throw new ForbiddenException('Cannot deactivate your own account');
    }
    const admin = await this.adminUserRepo.findOne({ where: { id: adminId } });
    if (!admin) throw new NotFoundException('Admin user not found');

    await this.adminUserRepo.update(adminId, { isActive: false });
    await this.log(requesterId, 'deactivate_admin', 'admin_user', adminId,
      { isActive: true }, { isActive: false }, ip);
    return { message: 'Admin deactivated', adminId };
  }

  async getAdminLogs(adminId: string, page = 1, limit = 50) {
    const [data, total] = await this.adminLogRepo.findAndCount({
      where:  { adminId },
      order:  { createdAt: 'DESC' },
      skip:   (page - 1) * limit,
      take:   limit,
    });
    return { data, total, page, limit };
  }
}
