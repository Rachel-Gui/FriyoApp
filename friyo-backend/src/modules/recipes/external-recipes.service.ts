import { chineseIngredientName } from './recipe-keywords';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { createHash } from 'crypto';
import { Recipe, RecipeDifficulty, RecipeReviewStatus, RecipeStatus } from '../../database/entities/recipe.entity';
import { RecipeIngredient } from '../../database/entities/recipe-ingredient.entity';
import { RecipeStep, StepType } from '../../database/entities/recipe-step.entity';

@Injectable()
export class ExternalRecipesService {
  private readonly logger = new Logger(ExternalRecipesService.name);
  constructor(private readonly config: ConfigService, private readonly db: DataSource) {}

  async importByFirstLetter(letter: string): Promise<void> {
    if (!/^[a-z]$/i.test(letter)) throw new Error('Use a single alphabet letter');
    await this.search(letter.toLowerCase(), true);
  }

  async search(query: string, byFirstLetter = false): Promise<void> {
    const key = this.config.get<string>('THEMEALDB_API_KEY');
    if (!key) return;
    try {
      const response = await fetch(`https://www.themealdb.com/api/json/v1/${encodeURIComponent(key)}/search.php?${byFirstLetter ? 'f' : 's'}=${encodeURIComponent(query)}`, { signal: AbortSignal.timeout(4000) });
      if (!response.ok) return;
      const payload = await response.json() as { meals?: Record<string, string | null>[] };
      for (const meal of (payload.meals ?? []).slice(0, 20)) {
        if (!meal.idMeal || !meal.strMeal || !meal.strInstructions) continue;
        const hash = createHash('sha256').update(`themealdb:${meal.idMeal}`).digest('hex');
        const id = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
        await this.db.transaction(async manager => {
          const result = await manager.createQueryBuilder().insert().into(Recipe).values({
            id, title: meal.strMeal!, description: `TheMealDB · ${meal.strCategory ?? ''}`,
            cuisineType: meal.strArea, tags: [meal.strCategory, ...(meal.strTags?.split(',') ?? [])].filter(Boolean) as string[],
            coverImageUrl: meal.strMealThumb, sourceUrl: `https://www.themealdb.com/meal/${encodeURIComponent(meal.idMeal!)}`,
            difficulty: RecipeDifficulty.MEDIUM, isSystem: true, isPublished: true,
            reviewStatus: RecipeReviewStatus.APPROVED, status: RecipeStatus.PUBLISHED,
          }).orIgnore().returning('id').execute();
          if (!result.raw.length) return;
          for (let i = 1; i <= 20; i++) {
            const name = meal[`strIngredient${i}`]?.trim();
            if (!name) continue;
            // Keep original measures intact rather than inventing numeric quantities.
            await manager.save(RecipeIngredient, manager.create(RecipeIngredient, {
              recipeId: id, displayName: name, displayNameZh: chineseIngredientName(name), displayNameEn: name, unit: meal[`strMeasure${i}`]?.trim() || null,
              quantity: null, sortOrder: i,
            }));
          }
          const steps = meal.strInstructions!.split(/\r?\n+/).map(step => step.trim()).filter(Boolean);
          for (let i = 0; i < steps.length; i++) {
            await manager.save(RecipeStep, manager.create(RecipeStep, {
              recipeId: id, stepNumber: i + 1, description: steps[i], stepType: StepType.HANDS_ON,
            }));
          }
        });
      }
    } catch {
      this.logger.warn('External recipe search unavailable; serving local catalog.');
    }
  }
}
