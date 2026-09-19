import { Logger, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Between } from 'typeorm';
import { Process, Processor, OnQueueFailed } from '@nestjs/bull';
import { Job } from 'bull';
import Redis from 'ioredis';

import { User }              from '../../../database/entities/user.entity';
import { MealLog }           from '../../../database/entities/meal-log.entity';
import { ScanSession }       from '../../../database/entities/scan-session.entity';
import { CommunityPost }     from '../../../database/entities/community-post.entity';
import { RecipeAdaptation }  from '../../../database/entities/recipe-adaptation.entity';
import { AnalyticsSnapshot } from '../../../database/entities/analytics-snapshot.entity';

export interface AggregateJobData {
  /** ISO date to aggregate (defaults to yesterday if omitted) */
  date?: string;
  /** When true, overwrite an existing snapshot for the same date */
  force?: boolean;
}

@Processor('analytics.aggregate')
export class AnalyticsAggregateProcessor {
  private readonly logger = new Logger(AnalyticsAggregateProcessor.name);

  constructor(
    @InjectRepository(User)             private readonly userRepo:        Repository<User>,
    @InjectRepository(MealLog)          private readonly mealLogRepo:     Repository<MealLog>,
    @InjectRepository(ScanSession)      private readonly scanSessionRepo: Repository<ScanSession>,
    @InjectRepository(CommunityPost)    private readonly postRepo:        Repository<CommunityPost>,
    @InjectRepository(RecipeAdaptation) private readonly adaptationRepo:  Repository<RecipeAdaptation>,
    @InjectRepository(AnalyticsSnapshot) private readonly snapshotRepo:   Repository<AnalyticsSnapshot>,

    private readonly dataSource: DataSource,

    @Inject('REDIS_CLIENT')
    private readonly redis: Redis,
  ) {}

  // ── Main handler ──────────────────────────────────────────────────────────

  @Process('aggregate')
  async handleAggregate(job: Job<AggregateJobData>): Promise<void> {
    const targetDate = job.data.date
      ? new Date(job.data.date)
      : this.yesterday();

    const dateStr  = targetDate.toISOString().split('T')[0]; // "2024-11-14"
    const dayStart = new Date(`${dateStr}T00:00:00.000Z`);
    const dayEnd   = new Date(`${dateStr}T23:59:59.999Z`);

    this.logger.log(`Aggregating analytics for ${dateStr}`);

    // Skip if snapshot already exists (unless forced)
    if (!job.data.force) {
      const existing = await this.snapshotRepo.findOne({ where: { date: dateStr } });
      if (existing) {
        this.logger.debug(`Snapshot for ${dateStr} already exists — skipping`);
        return;
      }
    }

    const [
      dailyActiveUsers,
      newUsers,
      totalMealLogs,
      totalScans,
      totalCommunityPosts,
      totalRecipeAdaptations,
      recipeUsageRows,
      cuisineRows,
    ] = await Promise.all([
      // Users active during the day (last_active_at within the day)
      this.userRepo
        .createQueryBuilder('u')
        .where('u.lastActiveAt BETWEEN :start AND :end', { start: dayStart, end: dayEnd })
        .getCount(),

      // New registrations
      this.userRepo
        .createQueryBuilder('u')
        .where('u.createdAt BETWEEN :start AND :end', { start: dayStart, end: dayEnd })
        .getCount(),

      // Meals logged
      this.mealLogRepo
        .createQueryBuilder('ml')
        .where('ml.loggedAt BETWEEN :start AND :end', { start: dayStart, end: dayEnd })
        .getCount(),

      // AI fridge scans
      this.scanSessionRepo
        .createQueryBuilder('ss')
        .where('ss.createdAt BETWEEN :start AND :end', { start: dayStart, end: dayEnd })
        .getCount(),

      // Community posts created
      this.postRepo
        .createQueryBuilder('cp')
        .where('cp.createdAt BETWEEN :start AND :end', { start: dayStart, end: dayEnd })
        .getCount(),

      // Recipe adaptations
      this.adaptationRepo
        .createQueryBuilder('ra')
        .where('ra.createdAt BETWEEN :start AND :end', { start: dayStart, end: dayEnd })
        .getCount(),

      // Top recipes by meal log count for the day
      this.mealLogRepo
        .createQueryBuilder('ml')
        .select('ml.recipeId', 'recipeId')
        .addSelect('COUNT(*)', 'count')
        .where('ml.loggedAt BETWEEN :start AND :end', { start: dayStart, end: dayEnd })
        .andWhere('ml.recipeId IS NOT NULL')
        .groupBy('ml.recipeId')
        .orderBy('count', 'DESC')
        .limit(50)
        .getRawMany<{ recipeId: string; count: string }>(),

      // Cuisine distribution
      this.mealLogRepo
        .createQueryBuilder('ml')
        .innerJoin('ml.recipe', 'r')
        .select('r.cuisineType', 'cuisine')
        .addSelect('COUNT(*)', 'count')
        .where('ml.loggedAt BETWEEN :start AND :end', { start: dayStart, end: dayEnd })
        .andWhere('r.cuisineType IS NOT NULL')
        .groupBy('r.cuisineType')
        .getRawMany<{ cuisine: string; count: string }>(),
    ]);

    const recipeUsage: Record<string, number> = {};
    for (const row of recipeUsageRows) {
      recipeUsage[row.recipeId] = parseInt(row.count, 10);
    }

    const cuisineDistribution: Record<string, number> = {};
    for (const row of cuisineRows) {
      if (row.cuisine) cuisineDistribution[row.cuisine] = parseInt(row.count, 10);
    }

    // Upsert the snapshot
    await this.dataSource
      .createQueryBuilder()
      .insert()
      .into(AnalyticsSnapshot)
      .values({
        date:                   dateStr,
        dailyActiveUsers,
        newUsers,
        totalMealLogs,
        totalScans,
        totalCommunityPosts,
        totalRecipeAdaptations,
        recipeUsage,
        cuisineDistribution,
      })
      .orUpdate(
        [
          'daily_active_users', 'new_users', 'total_meal_logs',
          'total_scans', 'total_community_posts', 'total_recipe_adaptations',
          'recipe_usage', 'cuisine_distribution',
        ],
        ['date'],
      )
      .execute();

    this.logger.log(
      `Analytics snapshot saved for ${dateStr}: ` +
      `DAU=${dailyActiveUsers}, meals=${totalMealLogs}, scans=${totalScans}`,
    );

    // Clear Redis caches that contain stale aggregate data
    await this.clearExpiredCacheKeys();
  }

  // ── Redis cache cleanup ───────────────────────────────────────────────────

  @Process('clear-cache')
  async handleClearCache(_job: Job): Promise<void> {
    await this.clearExpiredCacheKeys();
  }

  private async clearExpiredCacheKeys(): Promise<void> {
    const PATTERNS = [
      'trending:recipes',
      'analysis:*',
    ];

    let totalDeleted = 0;

    for (const pattern of PATTERNS) {
      if (pattern.includes('*')) {
        // Scan for wildcard keys
        let cursor = '0';
        do {
          const [nextCursor, keys] = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
          cursor = nextCursor;
          if (keys.length > 0) {
            await this.redis.del(...keys);
            totalDeleted += keys.length;
          }
        } while (cursor !== '0');
      } else {
        const deleted = await this.redis.del(pattern);
        totalDeleted += deleted;
      }
    }

    this.logger.log(`Redis cache cleanup: deleted ${totalDeleted} key(s)`);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private yesterday(): Date {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - 1);
    d.setUTCHours(0, 0, 0, 0);
    return d;
  }

  // ── Queue hooks ──────────────────────────────────────────────────────────

  @OnQueueFailed()
  onFailed(job: Job<AggregateJobData>, err: Error): void {
    this.logger.error(
      `analytics.aggregate job ${job.id} failed: ${err.message}`,
    );
  }
}
