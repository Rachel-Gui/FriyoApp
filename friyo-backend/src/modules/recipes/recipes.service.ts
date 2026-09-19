import {
  Injectable, NotFoundException, ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Client as ElasticsearchClient } from '@elastic/elasticsearch';
import { Inject } from '@nestjs/common';

import { Recipe, RecipeReviewStatus, RecipeStatus } from '../../database/entities/recipe.entity';
import { RecipeIngredient } from '../../database/entities/recipe-ingredient.entity';
import { RecipeStep } from '../../database/entities/recipe-step.entity';
import { RecipeAdaptation } from '../../database/entities/recipe-adaptation.entity';
import { UserProfile } from '../../database/entities/user-profile.entity';
import { FridgeItem } from '../../database/entities/fridge-item.entity';
import { Ingredient } from '../../database/entities/ingredient.entity';
import { AdminUser } from '../../database/entities/admin-user.entity';
import { StepType } from '../../database/entities/recipe-step.entity';

import { ListRecipesDto } from './dto/list-recipes.dto';
import { SearchRecipesDto } from './dto/search-recipes.dto';
import { CreateRecipeDto } from './dto/create-recipe.dto';
import { UpdateRecipeDto } from './dto/update-recipe.dto';

const ES_INDEX = 'recipes';

@Injectable()
export class RecipesService {
  constructor(
    @InjectRepository(Recipe)
    private readonly recipeRepo: Repository<Recipe>,

    @InjectRepository(RecipeIngredient)
    private readonly ingredientLineRepo: Repository<RecipeIngredient>,

    @InjectRepository(RecipeStep)
    private readonly stepRepo: Repository<RecipeStep>,

    @InjectRepository(RecipeAdaptation)
    private readonly adaptationRepo: Repository<RecipeAdaptation>,

    @InjectRepository(UserProfile)
    private readonly profileRepo: Repository<UserProfile>,

    @InjectRepository(FridgeItem)
    private readonly fridgeItemRepo: Repository<FridgeItem>,

    @InjectRepository(Ingredient)
    private readonly ingredientRepo: Repository<Ingredient>,

    @InjectRepository(AdminUser)
    private readonly adminUserRepo: Repository<AdminUser>,

    @Inject('ELASTICSEARCH_CLIENT')
    private readonly esClient: ElasticsearchClient,

    private readonly dataSource: DataSource,
  ) {}

  // ── GET /recipes ───────────────────────────────────────────────────────────

  async listRecipes(query: ListRecipesDto) {
    const { page = 1, limit = 20 } = query;

    const qb = this.recipeRepo
      .createQueryBuilder('r')
      .where("r.reviewStatus = 'approved'")
      .andWhere('r.isPublished = true');

    if (query.cuisine) {
      qb.andWhere('r.cuisineType ILIKE :cuisine', { cuisine: `%${query.cuisine}%` });
    }
    if (query.meal_type) {
      qb.andWhere('r.mealType = :mealType', { mealType: query.meal_type });
    }
    if (query.difficulty) {
      qb.andWhere('r.difficulty = :difficulty', { difficulty: query.difficulty });
    }
    if (query.diet_type) {
      qb.andWhere(`r.dietTypes @> :dietType::jsonb`, {
        dietType: JSON.stringify([query.diet_type]),
      });
    }
    if (query.max_time) {
      qb.andWhere('(r.prepTimeMin + r.cookTimeMin) <= :maxTime', {
        maxTime: query.max_time,
      });
    }

    const [items, total] = await qb
      .orderBy('r.likesCount', 'DESC')
      .addOrderBy('r.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      items,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    };
  }

  // ── GET /recipes/search ────────────────────────────────────────────────────

  async searchRecipes(query: SearchRecipesDto, userId?: string) {
    try {
      return await this.elasticsearchSearch(query, userId);
    } catch {
      return this.postgresSearch(query);
    }
  }

  private async elasticsearchSearch(query: SearchRecipesDto, userId?: string) {
    let profile: UserProfile | null = null;
    if (query.use_preferences && userId) {
      profile = await this.profileRepo.findOne({ where: { userId } });
    }

    const mustClause = {
      multi_match: {
        query: query.q,
        fields: ['title^3', 'title_zh^2', 'description', 'tags', 'cuisines', 'cuisine_type'],
        fuzziness: 'AUTO',
        minimum_should_match: '70%',
      },
    };

    const shouldClauses: unknown[] = [];
    if (profile?.preferredCuisines?.length) {
      for (const cuisine of profile.preferredCuisines) {
        shouldClauses.push({ term: { cuisine_type: cuisine.toLowerCase() } });
      }
    }

    const esQuery =
      shouldClauses.length > 0
        ? {
            bool: {
              must: mustClause,
              should: shouldClauses,
              boost_mode: 'sum',
            },
          }
        : mustClause;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await this.esClient.search({
      index: ES_INDEX,
      // Cast needed: ES v8 QueryDslQueryContainer doesn't accept unknown[] for `should`
      query: esQuery as any,
      size: 20,
      _source: ['id'],
    } as any);

    const ids = result.hits.hits
      .map((hit) => (hit._source as { id?: string })?.id ?? hit._id)
      .filter(Boolean) as string[];

    if (!ids.length) return { items: [], total: 0 };

    const recipes = await this.recipeRepo
      .createQueryBuilder('r')
      .whereInIds(ids)
      .andWhere("r.reviewStatus = 'approved'")
      .getMany();

    // Preserve ES relevance order
    const recipeMap = new Map(recipes.map((r) => [r.id, r]));
    const ordered = ids.map((id) => recipeMap.get(id)).filter(Boolean) as Recipe[];

    return { items: ordered, total: result.hits.total };
  }

  private async postgresSearch(query: SearchRecipesDto) {
    const pattern = `%${query.q}%`;
    const items = await this.recipeRepo
      .createQueryBuilder('r')
      .where("r.reviewStatus = 'approved'")
      .andWhere('r.isPublished = true')
      .andWhere(
        '(r.title ILIKE :pattern OR r.description ILIKE :pattern)',
        { pattern },
      )
      .orderBy('r.likesCount', 'DESC')
      .limit(20)
      .getMany();

    return { items, total: items.length };
  }

  // ── GET /recipes/:id ───────────────────────────────────────────────────────

  async getRecipe(recipeId: string) {
    const recipe = await this.recipeRepo.findOne({
      where: { id: recipeId },
      relations: ['ingredients', 'ingredients.ingredient', 'steps', 'author'],
    });
    if (!recipe) throw new NotFoundException('Recipe not found');

    recipe.steps.sort((a, b) => a.stepNumber - b.stepNumber);
    recipe.ingredients.sort((a, b) => a.sortOrder - b.sortOrder);
    return recipe;
  }

  // ── POST /recipes ──────────────────────────────────────────────────────────

  async createRecipe(userId: string, dto: CreateRecipeDto) {
    return this.dataSource.transaction(async (manager) => {
      const isAdmin = !!(await this.adminUserRepo.findOne({ where: { id: userId } }));

      const recipe = manager.create(Recipe, {
        title: dto.title,
        titleZh: dto.title_zh ?? null,
        description: dto.description ?? null,
        cuisineType: dto.cuisine_type ?? null,
        mealType: dto.meal_type ?? null,
        difficulty: dto.difficulty,
        prepTimeMin: dto.prep_time_min ?? 0,
        cookTimeMin: dto.cook_time_min ?? 0,
        servings: dto.servings ?? 2,
        caloriesPerServing: dto.calories_per_serving ?? null,
        coverImageUrl: dto.cover_image_url ?? null,
        tags: dto.tags ?? [],
        dietTypes: dto.diet_types ?? [],
        requiredTools: dto.required_tools ?? [],
        cuisines: dto.cuisines ?? [],
        authorId: userId,
        isAiGenerated: false,
        reviewStatus: isAdmin ? RecipeReviewStatus.APPROVED : RecipeReviewStatus.PENDING,
        isPublished: isAdmin,
        status: isAdmin ? RecipeStatus.PUBLISHED : RecipeStatus.DRAFT,
      });
      const savedRecipe = await manager.save(Recipe, recipe);

      for (const ri of dto.ingredients) {
        await manager.save(
          RecipeIngredient,
          manager.create(RecipeIngredient, {
            recipeId: savedRecipe.id,
            ingredientId: ri.ingredient_id ?? null,
            displayName: ri.display_name ?? null,
            quantity: ri.quantity ?? null,
            unit: ri.unit ?? null,
            isOptional: ri.is_optional ?? false,
            substitutes: ri.substitutes ?? null,
            sortOrder: ri.sort_order ?? 0,
          }),
        );
      }

      for (const step of dto.steps) {
        await manager.save(
          RecipeStep,
          manager.create(RecipeStep, {
            recipeId: savedRecipe.id,
            stepNumber: step.step_number,
            description: step.description,
            durationMin: step.duration_min ?? null,
            stepType: step.step_type ?? StepType.HANDS_ON,
            imageUrl: step.image_url ?? null,
            tips: step.tips ?? null,
          }),
        );
      }

      return savedRecipe;
    });
  }

  // ── PATCH /recipes/:id ─────────────────────────────────────────────────────

  async updateRecipe(recipeId: string, userId: string, dto: UpdateRecipeDto) {
    const recipe = await this.recipeRepo.findOne({ where: { id: recipeId } });
    if (!recipe) throw new NotFoundException('Recipe not found');

    const isAdmin = !!(await this.adminUserRepo.findOne({ where: { id: userId } }));
    if (!isAdmin && recipe.authorId !== userId) {
      throw new ForbiddenException('You can only update your own recipes');
    }

    // Build plain object of column-level updates only (no relation properties)
    // to satisfy TypeORM's _QueryDeepPartialEntity constraint
    const updates: Record<string, unknown> = {};
    if (dto.title !== undefined) updates['title'] = dto.title;
    if (dto.title_zh !== undefined) updates['titleZh'] = dto.title_zh ?? null;
    if (dto.description !== undefined) updates['description'] = dto.description ?? null;
    if (dto.cuisine_type !== undefined) updates['cuisineType'] = dto.cuisine_type ?? null;
    if (dto.meal_type !== undefined) updates['mealType'] = dto.meal_type ?? null;
    if (dto.difficulty !== undefined) updates['difficulty'] = dto.difficulty;
    if (dto.prep_time_min !== undefined) updates['prepTimeMin'] = dto.prep_time_min;
    if (dto.cook_time_min !== undefined) updates['cookTimeMin'] = dto.cook_time_min;
    if (dto.servings !== undefined) updates['servings'] = dto.servings;
    if (dto.calories_per_serving !== undefined) updates['caloriesPerServing'] = dto.calories_per_serving ?? null;
    if (dto.cover_image_url !== undefined) updates['coverImageUrl'] = dto.cover_image_url ?? null;
    if (dto.tags !== undefined) updates['tags'] = dto.tags ?? [];
    if (dto.diet_types !== undefined) updates['dietTypes'] = dto.diet_types ?? [];
    if (dto.required_tools !== undefined) updates['requiredTools'] = dto.required_tools ?? [];
    if (dto.cuisines !== undefined) updates['cuisines'] = dto.cuisines ?? [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await this.recipeRepo.update(recipeId, updates as any);
    return this.getRecipe(recipeId);
  }

  // ── DELETE /recipes/:id ────────────────────────────────────────────────────

  async deleteRecipe(recipeId: string): Promise<void> {
    const recipe = await this.recipeRepo.findOne({ where: { id: recipeId } });
    if (!recipe) throw new NotFoundException('Recipe not found');
    await this.recipeRepo.remove(recipe);
  }

  // ── GET /recipes/:id/for-cooking ───────────────────────────────────────────

  async getRecipeForCooking(recipeId: string, userId: string, adaptationId?: string) {
    const recipe = await this.recipeRepo.findOne({
      where: { id: recipeId },
      relations: ['ingredients', 'ingredients.ingredient', 'steps'],
    });
    if (!recipe) throw new NotFoundException('Recipe not found');

    recipe.steps.sort((a, b) => a.stepNumber - b.stepNumber);
    recipe.ingredients.sort((a, b) => a.sortOrder - b.sortOrder);

    let adaptation: RecipeAdaptation | null = null;
    if (adaptationId) {
      adaptation = await this.adaptationRepo.findOne({
        where: { id: adaptationId, userId },
      });
    }

    const fridgeItems = await this.fridgeItemRepo.find({
      where: { userId },
      relations: ['ingredient'],
    });

    const fridgeMap = new Map<string, FridgeItem[]>();
    for (const fi of fridgeItems) {
      if (fi.ingredientId) {
        const existing = fridgeMap.get(fi.ingredientId) ?? [];
        existing.push(fi);
        fridgeMap.set(fi.ingredientId, existing);
      }
    }

    const fridgeStatus = recipe.ingredients.map((ri) => {
      const name = ri.displayName ?? ri.ingredient?.name ?? 'Unknown';
      const matches = ri.ingredientId ? (fridgeMap.get(ri.ingredientId) ?? []) : [];
      const quantityAvailable = matches.reduce((sum, fi) => sum + Number(fi.quantity), 0);

      return {
        ingredient: {
          id: ri.ingredientId,
          name,
          unit: ri.unit ?? ri.ingredient?.unit ?? null,
          is_optional: ri.isOptional,
        },
        in_fridge: matches.length > 0,
        quantity_available: matches.length > 0 ? quantityAvailable : null,
        quantity_needed: ri.quantity !== null ? Number(ri.quantity) : null,
      };
    });

    const cookingTimeline = this.buildCookingTimeline(recipe.steps);

    return {
      recipe,
      adaptation,
      fridge_status: fridgeStatus,
      cooking_timeline: cookingTimeline,
    };
  }

  // ── Timeline builder ───────────────────────────────────────────────────────

  private buildCookingTimeline(steps: RecipeStep[]) {
    const DEFAULT_STEP_DURATION = 5;
    let cursor = 0;

    const annotated = steps.map((step) => {
      const startMin = cursor;
      const durationMin = step.durationMin ?? DEFAULT_STEP_DURATION;
      cursor += durationMin;
      return { step, startMin, durationMin, endMin: startMin + durationMin };
    });

    const handsOn: object[] = [];
    const handsOff: object[] = [];

    for (let i = 0; i < annotated.length; i++) {
      const { step, startMin, durationMin } = annotated[i];

      if (step.stepType === StepType.HANDS_ON) {
        handsOn.push({
          step: step.stepNumber,
          start_min: startMin,
          duration_min: durationMin,
          description: step.description,
          tips: step.tips ?? null,
        });
      } else {
        // Look ahead for hands_on tasks that fit within this hands_off period
        const meanwhile: string[] = [];
        let budgetLeft = durationMin;

        for (let j = i + 1; j < annotated.length && budgetLeft > 0; j++) {
          const next = annotated[j];
          if (next.step.stepType === StepType.HANDS_ON) {
            const d = next.durationMin;
            if (d <= budgetLeft) {
              meanwhile.push(
                `Step ${next.step.stepNumber}: ${next.step.description} (${d} min)`,
              );
              budgetLeft -= d;
            }
          }
        }

        handsOff.push({
          step: step.stepNumber,
          start_min: startMin,
          duration_min: durationMin,
          description: step.description,
          tips: step.tips ?? null,
          what_to_do_meanwhile:
            meanwhile.length > 0
              ? `While waiting, you can: ${meanwhile.join('; ')}`
              : 'Rest or prepare your serving dishes.',
        });
      }
    }

    return { hands_on: handsOn, hands_off: handsOff };
  }
}
