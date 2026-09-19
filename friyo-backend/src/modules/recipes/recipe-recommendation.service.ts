import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, MoreThanOrEqual } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import Redis from 'ioredis';
import { Inject } from '@nestjs/common';

import { Recipe, RecipeReviewStatus, RecipeMealType } from '../../database/entities/recipe.entity';
import { RecipeAdaptation } from '../../database/entities/recipe-adaptation.entity';
import { RecipeIngredient } from '../../database/entities/recipe-ingredient.entity';
import { FridgeItem } from '../../database/entities/fridge-item.entity';
import { UserProfile } from '../../database/entities/user-profile.entity';
import { Ingredient } from '../../database/entities/ingredient.entity';

import { MatchedRecipe, IngredientAvailability, MissingIngredient } from './interfaces/matched-recipe.interface';

const TRENDING_CACHE_KEY = 'trending:recipes';
const TRENDING_TTL_SECONDS = 3600;

@Injectable()
export class RecipeRecommendationService {
  private readonly logger = new Logger(RecipeRecommendationService.name);
  private readonly openai: OpenAI;

  constructor(
    @InjectRepository(Recipe)
    private readonly recipeRepo: Repository<Recipe>,

    @InjectRepository(RecipeAdaptation)
    private readonly adaptationRepo: Repository<RecipeAdaptation>,

    @InjectRepository(RecipeIngredient)
    private readonly ingredientLineRepo: Repository<RecipeIngredient>,

    @InjectRepository(FridgeItem)
    private readonly fridgeItemRepo: Repository<FridgeItem>,

    @InjectRepository(UserProfile)
    private readonly profileRepo: Repository<UserProfile>,

    @InjectRepository(Ingredient)
    private readonly ingredientRepo: Repository<Ingredient>,

    @Inject('REDIS_CLIENT')
    private readonly redis: Redis,

    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
  ) {
    this.openai = new OpenAI({
      apiKey: this.configService.get<string>('OPENAI_API_KEY') ?? '',
    });
  }

  // ── 1. Match recipes to fridge ─────────────────────────────────────────────

  async matchRecipesToFridge(userId: string): Promise<MatchedRecipe[]> {
    const [profile, fridgeItems] = await Promise.all([
      this.profileRepo.findOne({ where: { userId } }),
      this.loadActiveFridgeItems(userId),
    ]);

    const fridgeMap = this.buildFridgeMap(fridgeItems);

    const candidates = await this.recipeRepo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.ingredients', 'ri')
      .leftJoinAndSelect('ri.ingredient', 'ing')
      .where("r.reviewStatus = :status", { status: RecipeReviewStatus.APPROVED })
      .orderBy('r.likesCount', 'DESC')
      .take(200)
      .getMany();

    const results: MatchedRecipe[] = [];

    for (const recipe of candidates) {
      if (!this.passesFilters(recipe, profile)) continue;

      const scored = this.computeMatchScore(recipe, fridgeMap, profile);
      results.push(scored);
    }

    results.sort((a, b) => b.final_score - a.final_score);
    return results.slice(0, 20);
  }

  // ── 2. Time-based recommendations ─────────────────────────────────────────

  async getTimeBasedRecommendations(userId: string, currentHour: number): Promise<MatchedRecipe[]> {
    let mealType: RecipeMealType | null = null;
    let maxPrepMin: number | null = null;

    if (currentHour >= 6 && currentHour < 10) {
      mealType = RecipeMealType.BREAKFAST;
      maxPrepMin = 20;
    } else if (currentHour >= 11 && currentHour < 14) {
      mealType = RecipeMealType.LUNCH;
      maxPrepMin = 35;
    } else if (currentHour >= 17 && currentHour < 21) {
      mealType = RecipeMealType.DINNER;
      maxPrepMin = null;
    }

    const [profile, fridgeItems] = await Promise.all([
      this.profileRepo.findOne({ where: { userId } }),
      this.loadActiveFridgeItems(userId),
    ]);

    const fridgeMap = this.buildFridgeMap(fridgeItems);

    const qb = this.recipeRepo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.ingredients', 'ri')
      .leftJoinAndSelect('ri.ingredient', 'ing')
      .where("r.reviewStatus = :status", { status: RecipeReviewStatus.APPROVED });

    if (mealType) {
      qb.andWhere('r.mealType = :mealType', { mealType });
    }
    if (maxPrepMin !== null) {
      qb.andWhere('r.prepTimeMin <= :maxPrep', { maxPrep: maxPrepMin });
    }

    const candidates = await qb.orderBy('r.likesCount', 'DESC').take(50).getMany();

    const scored = candidates
      .filter((r) => this.passesFilters(r, profile))
      .map((r) => this.computeMatchScore(r, fridgeMap, profile));

    scored.sort((a, b) => b.final_score - a.final_score);
    return scored.slice(0, 4);
  }

  // ── 3. Health recommendations ──────────────────────────────────────────────

  async getHealthRecommendations(userId: string): Promise<Recipe[]> {
    const profile = await this.profileRepo.findOne({ where: { userId } });
    const healthGoals: string[] = profile?.healthGoals ?? [];

    const qb = this.recipeRepo
      .createQueryBuilder('r')
      .where("r.reviewStatus = :status", { status: RecipeReviewStatus.APPROVED })
      .andWhere('r.isPublished = true');

    if (healthGoals.includes('weight_loss')) {
      qb.andWhere('r.caloriesPerServing < 400');
      qb.orderBy('r.caloriesPerServing', 'ASC');
    } else if (healthGoals.includes('muscle_gain')) {
      qb.andWhere(`r.tags @> '["high-protein"]'::jsonb`);
      qb.orderBy('r.likesCount', 'DESC');
    } else if (healthGoals.includes('low_carb')) {
      qb.andWhere(`r.tags @> '["low-carb"]'::jsonb`);
      qb.orderBy('r.likesCount', 'DESC');
    } else {
      qb.orderBy('r.likesCount', 'DESC');
    }

    return qb.take(4).getMany();
  }

  // ── 4. Trending recipes ────────────────────────────────────────────────────

  async getTrendingRecipes(): Promise<Recipe[]> {
    const cached = await this.redis.get(TRENDING_CACHE_KEY);
    if (cached) {
      try {
        return JSON.parse(cached) as Recipe[];
      } catch {
        // stale / corrupt cache, fall through
      }
    }

    const recipes = await this.recipeRepo
      .createQueryBuilder('r')
      .where("r.reviewStatus = :status", { status: RecipeReviewStatus.APPROVED })
      .andWhere('r.isPublished = true')
      .orderBy('(r.likesCount + r.cookCount)', 'DESC')
      .take(8)
      .getMany();

    await this.redis.setex(TRENDING_CACHE_KEY, TRENDING_TTL_SECONDS, JSON.stringify(recipes));
    return recipes;
  }

  // ── 5. Generate adapted recipe ─────────────────────────────────────────────

  async generateAdaptedRecipe(recipeId: string, userId: string): Promise<RecipeAdaptation> {
    const recipe = await this.recipeRepo.findOne({
      where: { id: recipeId },
      relations: ['ingredients', 'ingredients.ingredient', 'steps'],
    });
    if (!recipe) throw new NotFoundException('Recipe not found');

    recipe.steps.sort((a, b) => a.stepNumber - b.stepNumber);
    recipe.ingredients.sort((a, b) => a.sortOrder - b.sortOrder);

    const fridgeItems = await this.loadActiveFridgeItems(userId);
    const fridgeMap = this.buildFridgeMap(fridgeItems);

    const adaptedIngredients: Record<string, unknown>[] = [];
    let missingCount = 0;
    const requiredCount = recipe.ingredients.filter((ri) => !ri.isOptional).length;

    for (const ri of recipe.ingredients) {
      const inFridge = ri.ingredientId
        ? (fridgeMap.get(ri.ingredientId) ?? []).length > 0
        : false;

      if (inFridge) {
        const items = fridgeMap.get(ri.ingredientId!)!;
        const totalQty = items.reduce((s, f) => s + Number(f.quantity), 0);
        adaptedIngredients.push({
          ingredient_id: ri.ingredientId,
          display_name: ri.displayName ?? ri.ingredient?.name,
          quantity: ri.quantity,
          unit: ri.unit,
          status: 'available',
          quantity_in_fridge: totalQty,
          is_optional: ri.isOptional,
        });
      } else {
        // Try substitutes in fridge
        const sub = await this.findSubstituteInFridge(ri.substitutes ?? [], fridgeMap);

        if (sub) {
          adaptedIngredients.push({
            ingredient_id: ri.ingredientId,
            display_name: ri.displayName ?? ri.ingredient?.name,
            quantity: ri.quantity,
            unit: ri.unit,
            status: 'substituted',
            substitute: sub,
            is_optional: ri.isOptional,
          });
        } else if (ri.isOptional) {
          adaptedIngredients.push({
            ingredient_id: ri.ingredientId,
            display_name: ri.displayName ?? ri.ingredient?.name,
            quantity: ri.quantity,
            unit: ri.unit,
            status: 'optional_skip',
            is_optional: true,
          });
        } else {
          missingCount++;
          adaptedIngredients.push({
            ingredient_id: ri.ingredientId,
            display_name: ri.displayName ?? ri.ingredient?.name,
            quantity: ri.quantity,
            unit: ri.unit,
            status: 'need_to_buy',
            is_optional: false,
          });
        }
      }
    }

    const missingRatio = requiredCount > 0 ? missingCount / requiredCount : 0;
    let adaptedSteps: Record<string, unknown>[] = recipe.steps.map((s) => ({
      step_number: s.stepNumber,
      description: s.description,
      duration_min: s.durationMin,
      step_type: s.stepType,
      tips: s.tips,
    }));
    let aiGenerated = false;
    let adaptationReason: string;

    if (missingRatio > 0.3) {
      this.logger.log(
        `Recipe ${recipeId}: ${Math.round(missingRatio * 100)}% ingredients missing — calling AI adaptation`,
      );
      try {
        const aiResult = await this.callAiAdaptation(recipe, fridgeItems, adaptedIngredients);
        if (aiResult.adapted_ingredients?.length) {
          adaptedIngredients.splice(0, adaptedIngredients.length, ...aiResult.adapted_ingredients);
        }
        if (aiResult.adapted_steps?.length) {
          adaptedSteps = aiResult.adapted_steps;
        }
        aiGenerated = true;
        adaptationReason = `AI-adapted: ${missingCount} required ingredient(s) missing from fridge.`;
      } catch (err) {
        this.logger.error(`AI adaptation failed for recipe ${recipeId}: ${(err as Error).message}`);
        adaptationReason = `Manual adaptation: ${missingCount} required ingredient(s) need to be purchased.`;
      }
    } else {
      adaptationReason =
        missingCount === 0
          ? 'All required ingredients are available in your fridge.'
          : `${missingCount} optional ingredient(s) skipped or substituted.`;
    }

    // Reorder adapted steps to use expiring items first (bubble high-freshness first steps forward)
    // We prioritise steps that use ingredients with low freshness scores (expiring soon)
    adaptedSteps = this.prioritiseExpiringSteps(adaptedSteps, fridgeItems);

    const adaptation = this.adaptationRepo.create({
      originalRecipeId: recipeId,
      userId,
      adaptedIngredients,
      adaptedSteps,
      adaptationReason,
      aiGenerated,
    });

    return this.adaptationRepo.save(adaptation);
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private async loadActiveFridgeItems(userId: string): Promise<FridgeItem[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return this.fridgeItemRepo
      .createQueryBuilder('fi')
      .leftJoinAndSelect('fi.ingredient', 'ing')
      .where('fi.userId = :userId', { userId })
      .andWhere('(fi.expiryDate IS NULL OR fi.expiryDate >= :today)', { today })
      .getMany();
  }

  private buildFridgeMap(items: FridgeItem[]): Map<string, FridgeItem[]> {
    const map = new Map<string, FridgeItem[]>();
    for (const item of items) {
      if (!item.ingredientId) continue;
      const existing = map.get(item.ingredientId) ?? [];
      existing.push(item);
      map.set(item.ingredientId, existing);
    }
    return map;
  }

  private passesFilters(recipe: Recipe, profile: UserProfile | null): boolean {
    if (!profile) return true;

    // Diet type compatibility
    if (
      profile.dietType &&
      recipe.dietTypes.length > 0 &&
      !recipe.dietTypes.includes(profile.dietType)
    ) {
      return false;
    }

    // No allergies or disliked ingredients
    const excluded = new Set([
      ...(profile.allergies ?? []),
      ...(profile.dislikedIngredients ?? []),
    ].map((s) => s.toLowerCase()));

    if (excluded.size > 0) {
      for (const ri of recipe.ingredients) {
        const name = (ri.displayName ?? ri.ingredient?.name ?? '').toLowerCase();
        if (name && excluded.has(name)) return false;
      }
    }

    // Tool availability (only if profile has tools listed)
    if (profile.cookingTools.length > 0 && recipe.requiredTools.length > 0) {
      const userTools = new Set(profile.cookingTools.map((t) => t.toLowerCase()));
      for (const tool of recipe.requiredTools) {
        if (!userTools.has(tool.toLowerCase())) return false;
      }
    }

    return true;
  }

  private computeMatchScore(
    recipe: Recipe,
    fridgeMap: Map<string, FridgeItem[]>,
    profile: UserProfile | null,
  ): MatchedRecipe {
    const requiredIngredients = recipe.ingredients.filter((ri) => !ri.isOptional);
    const available: IngredientAvailability[] = [];
    const missing: MissingIngredient[] = [];
    let freshnessSum = 0;

    for (const ri of requiredIngredients) {
      const items = ri.ingredientId ? (fridgeMap.get(ri.ingredientId) ?? []) : [];
      const name = ri.displayName ?? ri.ingredient?.name ?? 'Unknown';

      if (items.length > 0) {
        const totalQty = items.reduce((s, f) => s + Number(f.quantity), 0);
        // Use earliest-expiring item for freshness
        const earliestExpiry = items.reduce((a, b) =>
          (a.expiryDate?.getTime() ?? Infinity) < (b.expiryDate?.getTime() ?? Infinity) ? a : b,
        );
        const fs = this.computeFreshnessScore(earliestExpiry.expiryDate);
        freshnessSum += fs;
        available.push({
          ingredient_id: ri.ingredientId,
          name,
          quantity_in_fridge: totalQty,
          unit: ri.unit,
          freshness_score: fs,
        });
      } else {
        missing.push({
          ingredient_id: ri.ingredientId,
          name,
          quantity_needed: ri.quantity !== null ? Number(ri.quantity) : null,
          unit: ri.unit,
        });
      }
    }

    const total = requiredIngredients.length;
    const fridgeMatchRatio = total > 0 ? (available.length / total) * 100 : 100;
    const freshnessBonus = available.length > 0 ? freshnessSum / available.length : 0;

    const cuisineBonus =
      profile?.preferredCuisines?.some(
        (c) => c.toLowerCase() === (recipe.cuisineType ?? '').toLowerCase(),
      )
        ? 15
        : 0;

    const healthBonus = this.computeHealthBonus(recipe, profile?.healthGoals ?? []);

    const finalScore =
      fridgeMatchRatio * 0.6 + freshnessBonus * 0.3 + cuisineBonus + healthBonus;

    return {
      recipe,
      final_score: Math.round(finalScore * 10) / 10,
      fridge_match_ratio: Math.round(fridgeMatchRatio * 10) / 10,
      freshness_bonus: Math.round(freshnessBonus * 10) / 10,
      cuisine_bonus: cuisineBonus,
      health_bonus: healthBonus,
      available_ingredients: available,
      missing_ingredients: missing,
    };
  }

  private computeFreshnessScore(expiryDate: Date | null): number {
    if (!expiryDate) return 80;
    const daysLeft = Math.ceil((expiryDate.getTime() - Date.now()) / 86_400_000);
    if (daysLeft <= 0) return 0;
    if (daysLeft <= 2) return 20;
    if (daysLeft <= 7) return 60;
    return 100;
  }

  private computeHealthBonus(recipe: Recipe, healthGoals: string[]): number {
    if (!healthGoals.length) return 0;
    if (healthGoals.includes('weight_loss') && recipe.caloriesPerServing && recipe.caloriesPerServing < 400) return 10;
    if (healthGoals.includes('muscle_gain') && recipe.tags.includes('high-protein')) return 10;
    if (healthGoals.includes('low_carb') && recipe.tags.includes('low-carb')) return 10;
    return 0;
  }

  private async findSubstituteInFridge(
    substitutes: string[],
    fridgeMap: Map<string, FridgeItem[]>,
  ): Promise<string | null> {
    for (const sub of substitutes) {
      const match = await this.ingredientRepo
        .createQueryBuilder('i')
        .where('LOWER(i.name) = LOWER(:name)', { name: sub })
        .getOne();

      if (match && fridgeMap.has(match.id)) return sub;
    }
    return null;
  }

  private prioritiseExpiringSteps(
    steps: Record<string, unknown>[],
    fridgeItems: FridgeItem[],
  ): Record<string, unknown>[] {
    // Simple heuristic: steps referencing expiring ingredients (within 2 days) move earlier
    const expiringNames = new Set(
      fridgeItems
        .filter((fi) => {
          if (!fi.expiryDate) return false;
          return Math.ceil((fi.expiryDate.getTime() - Date.now()) / 86_400_000) <= 2;
        })
        .map((fi) => (fi.ingredient?.name ?? fi.customName ?? '').toLowerCase()),
    );

    if (!expiringNames.size) return steps;

    const priority = steps.filter((s) => {
      const desc = ((s['description'] as string) ?? '').toLowerCase();
      return [...expiringNames].some((name) => desc.includes(name));
    });
    const rest = steps.filter((s) => !priority.includes(s));

    // Re-assign step numbers after reorder
    return [...priority, ...rest].map((s, idx) => ({ ...s, step_number: idx + 1 }));
  }

  private async callAiAdaptation(
    recipe: Recipe,
    fridgeItems: FridgeItem[],
    currentAdapted: Record<string, unknown>[],
  ): Promise<{ adapted_ingredients: Record<string, unknown>[]; adapted_steps: Record<string, unknown>[] }> {
    const fridgeSummary = fridgeItems.map((fi) => ({
      name: fi.ingredient?.name ?? fi.customName,
      quantity: Number(fi.quantity),
      unit: fi.unit,
      expiry_date: fi.expiryDate,
    }));

    const recipeJson = {
      title: recipe.title,
      servings: recipe.servings,
      current_adaptation: currentAdapted,
      steps: recipe.steps.map((s) => ({
        step_number: s.stepNumber,
        description: s.description,
        duration_min: s.durationMin,
        step_type: s.stepType,
      })),
    };

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content:
            'You are a professional chef adapting recipes to available ingredients. ' +
            'Maintain cooking quality and flavour balance. Return ONLY valid JSON.',
        },
        {
          role: 'user',
          content:
            `Given this recipe: ${JSON.stringify(recipeJson)}, ` +
            `and available ingredients: ${JSON.stringify(fridgeSummary)}, ` +
            'suggest the closest possible adaptation. Return JSON with ' +
            '"adapted_ingredients" (array) and "adapted_steps" (array). ' +
            'Keep the same structure as the original.',
        },
      ],
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    });

    const raw = response.choices[0]?.message?.content ?? '{}';
    return JSON.parse(raw) as {
      adapted_ingredients: Record<string, unknown>[];
      adapted_steps: Record<string, unknown>[];
    };
  }
}
