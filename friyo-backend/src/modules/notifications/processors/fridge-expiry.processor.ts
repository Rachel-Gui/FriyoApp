import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, IsNull, Not } from 'typeorm';
import { InjectQueue }  from '@nestjs/bull';
import { Queue, Job }   from 'bull';
import { Process, Processor, OnQueueFailed } from '@nestjs/bull';

import { FridgeItem }       from '../../../database/entities/fridge-item.entity';
import { Ingredient }       from '../../../database/entities/ingredient.entity';
import { Recipe }           from '../../../database/entities/recipe.entity';
import { RecipeIngredient } from '../../../database/entities/recipe-ingredient.entity';
import { UserDeviceToken }  from '../../../database/entities/user-device-token.entity';
import { RecipeReviewStatus } from '../../../database/entities/recipe.entity';
import { renderTemplate }   from '../notification-templates';
import type { PushToUsersPayload } from './push-notification.processor';

export interface ExpiryReminderJobData {
  /** ISO date used as the "today" reference (allows backfills) */
  referenceDate?: string;
}

interface UserExpiryGroup {
  userId:  string;
  items:   Array<{ name: string; daysLeft: number; ingredientId: string | null }>;
}

@Processor('fridge.expiry.reminder')
export class FridgeExpiryProcessor {
  private readonly logger = new Logger(FridgeExpiryProcessor.name);

  constructor(
    @InjectRepository(FridgeItem)
    private readonly fridgeItemRepo: Repository<FridgeItem>,

    @InjectRepository(Ingredient)
    private readonly ingredientRepo: Repository<Ingredient>,

    @InjectRepository(Recipe)
    private readonly recipeRepo: Repository<Recipe>,

    @InjectRepository(RecipeIngredient)
    private readonly recipeIngredientRepo: Repository<RecipeIngredient>,

    @InjectRepository(UserDeviceToken)
    private readonly tokenRepo: Repository<UserDeviceToken>,

    @InjectQueue('notifications.push')
    private readonly pushQueue: Queue,
  ) {}

  // ── Main handler ──────────────────────────────────────────────────────────

  @Process('check-expiry')
  async handleCheckExpiry(job: Job<ExpiryReminderJobData>): Promise<void> {
    const now = job.data.referenceDate
      ? new Date(job.data.referenceDate)
      : new Date();

    // Threshold: items expiring within 2 days
    const threshold = new Date(now);
    threshold.setDate(threshold.getDate() + 2);
    threshold.setHours(23, 59, 59, 999);

    const today = new Date(now);
    today.setHours(0, 0, 0, 0);

    this.logger.log(`Checking fridge items expiring by ${threshold.toISOString()}`);

    // Find all items expiring in [today, today+2] across all users
    const expiringItems = await this.fridgeItemRepo
      .createQueryBuilder('fi')
      .leftJoinAndSelect('fi.ingredient', 'ing')
      .where('fi.expiryDate IS NOT NULL')
      .andWhere('fi.expiryDate >= :today', { today })
      .andWhere('fi.expiryDate <= :threshold', { threshold })
      .orderBy('fi.userId', 'ASC')
      .addOrderBy('fi.expiryDate', 'ASC')
      .getMany();

    if (expiringItems.length === 0) {
      this.logger.log('No expiring items found — nothing to notify');
      return;
    }

    // Group by userId
    const groupedByUser = this.groupByUser(expiringItems, today);
    this.logger.log(`Found ${expiringItems.length} expiring items across ${groupedByUser.length} users`);

    // For each user: build message, find recipe suggestion, queue push
    for (const group of groupedByUser) {
      await this.notifyUser(group);
    }
  }

  // ── Per-user notification ─────────────────────────────────────────────────

  private async notifyUser(group: UserExpiryGroup): Promise<void> {
    const { userId, items } = group;

    // Check this user has active device tokens — skip if not
    const hasToken = await this.tokenRepo.count({
      where: { userId, isActive: true },
    });
    if (hasToken === 0) {
      this.logger.debug(`User ${userId} has no active tokens — skipping`);
      return;
    }

    // Build a short item list (max 3 named, then "+N more")
    const named     = items.slice(0, 3).map((i) => i.name);
    const remaining = items.length - named.length;
    const itemNames = remaining > 0
      ? `${named.join(', ')} +${remaining} more`
      : named.join(', ');

    const minDays = Math.min(...items.map((i) => i.daysLeft));

    // Find a recipe that uses the expiring ingredients
    const ingredientIds = items.map((i) => i.ingredientId).filter(Boolean) as string[];
    const recipeSuggestion = await this.findRecipeSuggestion(ingredientIds);

    const { title, body } = renderTemplate('expiry_reminder', {
      item_names:  itemNames,
      days:        minDays,
      recipe_name: recipeSuggestion?.title ?? 'Check your favourite recipes',
    });

    const payload: PushToUsersPayload = {
      type:    'users',
      userIds: [userId],
      title,
      body,
      data: {
        type:         'expiry_reminder',
        ingredientIds: ingredientIds.join(','),
        ...(recipeSuggestion ? { recipeId: recipeSuggestion.id } : {}),
      },
    };

    await this.pushQueue.add('push', payload, {
      attempts:   3,
      backoff:    { type: 'exponential', delay: 5000 },
      removeOnComplete: true,
    });

    this.logger.debug(`Queued expiry reminder push for user ${userId} (${items.length} items)`);
  }

  // ── Recipe suggestion ─────────────────────────────────────────────────────

  /**
   * Find the approved recipe with the highest overlap with the expiring ingredient IDs.
   * Returns null if no suitable recipe is found.
   */
  private async findRecipeSuggestion(
    ingredientIds: string[],
  ): Promise<{ id: string; title: string } | null> {
    if (ingredientIds.length === 0) return null;

    // Query recipe_ingredients for records matching the expiring ingredients,
    // count overlaps per recipe, then pick the recipe with the most overlap
    // that is also approved.
    const rows = await this.recipeIngredientRepo
      .createQueryBuilder('ri')
      .innerJoin('ri.recipe', 'r')
      .select('r.id', 'recipeId')
      .addSelect('r.title', 'title')
      .addSelect('COUNT(ri.id)', 'overlap')
      .where('ri.ingredientId IN (:...ids)', { ids: ingredientIds })
      .andWhere('r.reviewStatus = :status', { status: RecipeReviewStatus.APPROVED })
      .groupBy('r.id, r.title')
      .orderBy('overlap', 'DESC')
      .limit(1)
      .getRawMany<{ recipeId: string; title: string; overlap: string }>();

    if (rows.length === 0) return null;
    return { id: rows[0].recipeId, title: rows[0].title };
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private groupByUser(items: FridgeItem[], today: Date): UserExpiryGroup[] {
    const map = new Map<string, UserExpiryGroup>();

    for (const item of items) {
      const daysLeft = Math.ceil(
        (new Date(item.expiryDate!).getTime() - today.getTime()) / 86_400_000,
      );
      const name = item.ingredient?.name ?? item.customName ?? 'Unknown item';

      const existing = map.get(item.userId);
      if (existing) {
        existing.items.push({ name, daysLeft, ingredientId: item.ingredientId });
      } else {
        map.set(item.userId, {
          userId: item.userId,
          items:  [{ name, daysLeft, ingredientId: item.ingredientId }],
        });
      }
    }

    return Array.from(map.values());
  }

  // ── Queue hooks ──────────────────────────────────────────────────────────

  @OnQueueFailed()
  onFailed(job: Job<ExpiryReminderJobData>, err: Error): void {
    this.logger.error(
      `fridge.expiry.reminder job ${job.id} failed: ${err.message}`,
    );
  }
}
