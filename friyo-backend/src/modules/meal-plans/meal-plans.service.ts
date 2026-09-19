import { normalizeImage } from '../../common/image-upload';
import {
  Injectable, NotFoundException, ConflictException, Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { Inject } from '@nestjs/common';
import Redis from 'ioredis';

import { MealLog, MealType } from '../../database/entities/meal-log.entity';
import { MealPlan } from '../../database/entities/meal-plan.entity';
import { Recipe } from '../../database/entities/recipe.entity';
import { FridgeItem } from '../../database/entities/fridge-item.entity';
import { UserSavedRecipe } from '../../database/entities/user-saved-recipe.entity';
import { FridgeService } from '../fridge/fridge.service';

import { LogMealDto } from './dto/log-meal.dto';
import { SaveWeeklyPlanDto } from './dto/save-weekly-plan.dto';

const ANALYSIS_TTL_SECONDS = 86_400; // 24 h

@Injectable()
export class MealPlansService {
  private readonly logger = new Logger(MealPlansService.name);
  private readonly s3: S3Client;
  private readonly s3Bucket: string;
  private readonly s3Region: string;

  constructor(
    @InjectRepository(MealLog)
    private readonly mealLogRepo: Repository<MealLog>,

    @InjectRepository(MealPlan)
    private readonly mealPlanRepo: Repository<MealPlan>,

    @InjectRepository(Recipe)
    private readonly recipeRepo: Repository<Recipe>,

    @InjectRepository(FridgeItem)
    private readonly fridgeItemRepo: Repository<FridgeItem>,

    @InjectRepository(UserSavedRecipe)
    private readonly savedRecipeRepo: Repository<UserSavedRecipe>,

    private readonly fridgeService: FridgeService,

    @Inject('REDIS_CLIENT')
    private readonly redis: Redis,

    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
  ) {
    this.s3Bucket = this.configService.get<string>('aws.s3Bucket') ?? 'friyo-uploads';
    this.s3Region = this.configService.get<string>('aws.region') ?? 'us-east-1';
    this.s3 = new S3Client({
      region: this.s3Region,
      credentials: {
        accessKeyId: this.configService.get<string>('aws.accessKeyId') ?? '',
        secretAccessKey: this.configService.get<string>('aws.secretAccessKey') ?? '',
      },
    });
  }

  // ── 1. GET /meal-plans/today ───────────────────────────────────────────────

  async getToday(userId: string) {
    const { start, end } = this.todayRange();
    const logs = await this.mealLogRepo.find({
      where: { userId, loggedAt: Between(start, end) },
      relations: ['recipe', 'adaptation'],
      order: { loggedAt: 'ASC' },
    });
    return this.groupByMealType(logs);
  }

  // ── 2. GET /meal-plans/week ────────────────────────────────────────────────

  async getWeek(userId: string, startDateStr?: string) {
    const weekStart = startDateStr ? new Date(startDateStr) : this.currentWeekMonday();
    weekStart.setHours(0, 0, 0, 0);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    const [logs, savedPlan] = await Promise.all([
      this.mealLogRepo.find({
        where: { userId, loggedAt: Between(weekStart, weekEnd) },
        relations: ['recipe', 'adaptation'],
        order: { loggedAt: 'ASC' },
      }),
      this.mealPlanRepo.findOne({
        where: { userId, weekStartDate: weekStart as unknown as Date },
      }),
    ]);

    const planData = (savedPlan?.planData ?? {}) as Record<
      string,
      { breakfast?: string; lunch?: string; dinner?: string }
    >;

    const result: Record<
      string,
      {
        breakfast: MealLog | null;
        lunch: MealLog | null;
        dinner: MealLog | null;
        snacks: MealLog[];
        planned: { breakfast?: string; lunch?: string; dinner?: string } | null;
      }
    > = {};

    for (let d = 0; d < 7; d++) {
      const day = new Date(weekStart);
      day.setDate(weekStart.getDate() + d);
      const key = this.dateKey(day);

      const dayLogs = logs.filter(
        (l) => this.dateKey(new Date(l.loggedAt)) === key,
      );

      result[key] = {
        breakfast: dayLogs.find((l) => l.mealType === MealType.BREAKFAST) ?? null,
        lunch: dayLogs.find((l) => l.mealType === MealType.LUNCH) ?? null,
        dinner: dayLogs.find((l) => l.mealType === MealType.DINNER) ?? null,
        snacks: dayLogs.filter((l) => l.mealType === MealType.SNACK),
        planned: planData[key] ?? null,
      };
    }

    return result;
  }

  // ── 3. POST /meal-plans/week ───────────────────────────────────────────────

  async saveWeeklyPlan(userId: string, dto: SaveWeeklyPlanDto) {
    const weekStartDate = new Date(dto.week_start_date);

    const existing = await this.mealPlanRepo.findOne({
      where: { userId, weekStartDate: weekStartDate as unknown as Date },
    });

    if (existing) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await this.mealPlanRepo.update(existing.id, { planData: dto.plan_data as any });
      return this.mealPlanRepo.findOne({ where: { id: existing.id } });
    }

    const plan = this.mealPlanRepo.create({
      userId,
      weekStartDate,
      planData: dto.plan_data as Record<string, unknown>,
    });
    return this.mealPlanRepo.save(plan);
  }

  // ── 4. GET /meal-plans/month ───────────────────────────────────────────────

  async getMonth(userId: string, year: number, month: number) {
    const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const end = new Date(year, month, 0, 23, 59, 59, 999);

    const logs = await this.mealLogRepo.find({
      where: { userId, loggedAt: Between(start, end) },
      relations: ['recipe'],
      order: { loggedAt: 'ASC' },
    });

    const totalCalories = logs.reduce((s, l) => s + (l.caloriesTotal ?? 0), 0);
    const daysInMonth = end.getDate();

    const byMealType = {
      [MealType.BREAKFAST]: 0,
      [MealType.LUNCH]: 0,
      [MealType.DINNER]: 0,
      [MealType.SNACK]: 0,
    };
    for (const l of logs) byMealType[l.mealType]++;

    return {
      year,
      month,
      logs,
      stats: {
        total_meals: logs.length,
        total_calories: totalCalories,
        avg_calories_per_day: daysInMonth > 0 ? Math.round(totalCalories / daysInMonth) : 0,
        by_meal_type: byMealType,
      },
    };
  }

  // ── 5. POST /meal-plans/log ────────────────────────────────────────────────

  async logMeal(userId: string, dto: LogMealDto) {
    const recipe = await this.recipeRepo.findOne({ where: { id: dto.recipe_id } });
    if (!recipe) throw new NotFoundException('Recipe not found');

    const caloriesTotal =
      recipe.caloriesPerServing !== null
        ? Math.round(Number(recipe.caloriesPerServing) * dto.servings_eaten)
        : null;

    const photoUrl =
      dto.use_original_photo && recipe.coverImageUrl ? recipe.coverImageUrl : null;

    const log = this.mealLogRepo.create({
      userId,
      recipeId: dto.recipe_id,
      adaptationId: dto.adaptation_id ?? null,
      mealType: dto.meal_type,
      servingsEaten: dto.servings_eaten,
      loggedAt: new Date(dto.logged_at),
      useOriginalPhoto: dto.use_original_photo ?? false,
      photoUrl,
      caloriesTotal,
      notes: dto.notes ?? null,
    });

    const saved = await this.mealLogRepo.save(log);

    // Best-effort fridge deduction — failure does not roll back the log
    try {
      await this.fridgeService.deductIngredients(userId, {
        recipe_id: dto.recipe_id,
        servings_used: dto.servings_eaten,
      });
    } catch (err) {
      this.logger.warn(
        `Fridge deduction failed for meal log ${saved.id}: ${(err as Error).message}`,
      );
    }

    // Invalidate analysis cache for this user
    await this.redis.del(`analysis:${userId}`).catch(() => void 0);

    return this.mealLogRepo.findOne({
      where: { id: saved.id },
      relations: ['recipe', 'adaptation'],
    });
  }

  // ── 6. POST /meal-plans/log/:id/photo ─────────────────────────────────────

  async uploadMealPhoto(userId: string, logId: string, file: Express.Multer.File) {
    const log = await this.mealLogRepo.findOne({ where: { id: logId, userId } });
    if (!log) throw new NotFoundException('Meal log not found');

    file = await normalizeImage(file);
    const ext = file.originalname.split('.').pop() ?? 'jpg';
    const imageKey = `meal-photos/${userId}/${Date.now()}.${ext}`;

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.s3Bucket,
        Key: imageKey,
        Body: file.buffer,
        ContentType: file.mimetype,
      }),
    );

    const photoUrl = `https://${this.s3Bucket}.s3.${this.s3Region}.amazonaws.com/${imageKey}`;
    await this.mealLogRepo.update(logId, { photoUrl, useOriginalPhoto: false });

    return this.mealLogRepo.findOne({
      where: { id: logId },
      relations: ['recipe', 'adaptation'],
    });
  }

  // ── 7. GET /meal-plans/analysis ───────────────────────────────────────────

  async getAnalysis(userId: string) {
    const cacheKey = `analysis:${userId}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch { /* fall through */ }
    }

    const analysis = await this.computeAnalysis(userId);
    await this.redis.setex(cacheKey, ANALYSIS_TTL_SECONDS, JSON.stringify(analysis));
    return analysis;
  }

  private async computeAnalysis(userId: string) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);
    const now = new Date();

    const logs = await this.mealLogRepo.find({
      where: { userId, loggedAt: Between(thirtyDaysAgo, now) },
      relations: ['recipe'],
      order: { loggedAt: 'DESC' },
    });

    // ── total meals & calories ─────────────────────────────────────────────
    const totalMeals = logs.length;
    const totalCalories = logs.reduce((s, l) => s + (l.caloriesTotal ?? 0), 0);
    const avgCaloriesPerDay = Math.round(totalCalories / 30);

    // ── most cooked cuisine ────────────────────────────────────────────────
    const cuisineCounts = new Map<string, number>();
    for (const l of logs) {
      const c = l.recipe?.cuisineType;
      if (c) cuisineCounts.set(c, (cuisineCounts.get(c) ?? 0) + 1);
    }
    const mostCookedCuisine = [...cuisineCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    // ── ingredient waste (expired items still in fridge) ──────────────────
    const wasteItems = await this.fridgeItemRepo
      .createQueryBuilder('fi')
      .where('fi.userId = :userId', { userId })
      .andWhere('fi.expiryDate IS NOT NULL')
      .andWhere('fi.expiryDate < :now', { now })
      .andWhere('fi.expiryDate >= :start', { start: thirtyDaysAgo })
      .getCount();

    // ── fridge utilisation ─────────────────────────────────────────────────
    const [totalFridge, expiredFridge] = await Promise.all([
      this.fridgeItemRepo.count({ where: { userId } }),
      this.fridgeItemRepo
        .createQueryBuilder('fi')
        .where('fi.userId = :userId', { userId })
        .andWhere('fi.expiryDate IS NOT NULL')
        .andWhere('fi.expiryDate < :now', { now })
        .getCount(),
    ]);

    const fridgeUtilizationRate =
      totalFridge > 0
        ? Math.round(((totalFridge - expiredFridge) / totalFridge) * 100)
        : 100;

    // ── nutrition breakdown (estimate from calorie split) ─────────────────
    // In absence of macro DB, estimate typical macro ratios per meal type
    const breakfastCals = logs
      .filter((l) => l.mealType === MealType.BREAKFAST)
      .reduce((s, l) => s + (l.caloriesTotal ?? 0), 0);
    const lunchDinnerCals = logs
      .filter((l) => l.mealType === MealType.LUNCH || l.mealType === MealType.DINNER)
      .reduce((s, l) => s + (l.caloriesTotal ?? 0), 0);

    // Rough macro distribution: breakfast skews carb-heavy, lunch/dinner more balanced
    const estimatedCarbs = totalCalories > 0
      ? Math.round(((breakfastCals * 0.55 + lunchDinnerCals * 0.45) / totalCalories) * 100)
      : 50;
    const estimatedProtein = totalCalories > 0
      ? Math.round(((breakfastCals * 0.2 + lunchDinnerCals * 0.3) / totalCalories) * 100)
      : 25;
    const estimatedFat = 100 - estimatedCarbs - estimatedProtein;

    // ── streak ─────────────────────────────────────────────────────────────
    const streak = await this.computeStreak(userId);

    return {
      period: { start: thirtyDaysAgo.toISOString().slice(0, 10), end: now.toISOString().slice(0, 10) },
      total_meals_cooked: totalMeals,
      avg_calories_per_day: avgCaloriesPerDay,
      most_cooked_cuisine: mostCookedCuisine,
      ingredient_waste_estimate: wasteItems,
      nutrition_breakdown: {
        carbs_pct: estimatedCarbs,
        protein_pct: estimatedProtein,
        fat_pct: estimatedFat,
        note: 'Estimated from meal type distribution. Exact macros require per-ingredient data.',
      },
      streak,
      fridge_utilization_rate: fridgeUtilizationRate,
    };
  }

  private async computeStreak(userId: string): Promise<number> {
    const rows = await this.mealLogRepo
      .createQueryBuilder('ml')
      .select("DATE(ml.loggedAt AT TIME ZONE 'UTC')", 'date')
      .where('ml.userId = :userId', { userId })
      .groupBy("DATE(ml.loggedAt AT TIME ZONE 'UTC')")
      .orderBy('date', 'DESC')
      .limit(60)
      .getRawMany<{ date: string }>();

    if (!rows.length) return 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let streak = 0;
    let checkDate = today;

    for (const { date } of rows) {
      const logDate = new Date(date);
      logDate.setHours(0, 0, 0, 0);

      if (streak === 0) {
        const diff = Math.round(
          (checkDate.getTime() - logDate.getTime()) / 86_400_000,
        );
        if (diff > 1) break; // No log today or yesterday
        checkDate = logDate;
        streak = 1;
      } else {
        const expected = new Date(checkDate);
        expected.setDate(checkDate.getDate() - 1);
        if (logDate.getTime() === expected.getTime()) {
          streak++;
          checkDate = logDate;
        } else {
          break;
        }
      }
    }

    return streak;
  }

  // ── 8-10. Saved recipes ────────────────────────────────────────────────────

  async getSavedRecipes(userId: string) {
    return this.savedRecipeRepo.find({
      where: { userId },
      relations: ['recipe'],
      order: { createdAt: 'DESC' },
    });
  }

  async saveRecipe(userId: string, recipeId: string) {
    const recipe = await this.recipeRepo.findOne({ where: { id: recipeId } });
    if (!recipe) throw new NotFoundException('Recipe not found');

    const existing = await this.savedRecipeRepo.findOne({
      where: { userId, recipeId },
    });
    if (existing) throw new ConflictException('Recipe already saved');

    const saved = this.savedRecipeRepo.create({ userId, recipeId });
    return this.savedRecipeRepo.save(saved);
  }

  async unsaveRecipe(userId: string, recipeId: string): Promise<void> {
    const entry = await this.savedRecipeRepo.findOne({
      where: { userId, recipeId },
    });
    if (!entry) throw new NotFoundException('Saved recipe not found');
    await this.savedRecipeRepo.remove(entry);
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private todayRange(): { start: Date; end: Date } {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  private currentWeekMonday(): Date {
    const now = new Date();
    const day = now.getDay(); // 0 = Sunday
    const diff = day === 0 ? -6 : 1 - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diff);
    monday.setHours(0, 0, 0, 0);
    return monday;
  }

  private dateKey(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  private groupByMealType(logs: MealLog[]) {
    return {
      breakfast: logs.filter((l) => l.mealType === MealType.BREAKFAST),
      lunch: logs.filter((l) => l.mealType === MealType.LUNCH),
      dinner: logs.filter((l) => l.mealType === MealType.DINNER),
      snacks: logs.filter((l) => l.mealType === MealType.SNACK),
    };
  }
}
