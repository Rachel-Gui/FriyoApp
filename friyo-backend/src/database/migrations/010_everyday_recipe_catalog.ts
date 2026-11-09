import { MigrationInterface, QueryRunner } from 'typeorm';
import { everydayRecipes } from '../catalog/everyday-recipes';
import { Recipe, RecipeDifficulty, RecipeMealType, RecipeReviewStatus, RecipeStatus } from '../entities/recipe.entity';
import { RecipeIngredient } from '../entities/recipe-ingredient.entity';
import { RecipeStep, StepType } from '../entities/recipe-step.entity';
import { Ingredient } from '../entities/ingredient.entity';
import { equivalentIngredientName } from '../../modules/recipes/recipe-keywords';

export class EverydayRecipeCatalog1794100000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    const recipes = q.manager.getRepository(Recipe);
    const ingredients = await q.manager.getRepository(Ingredient).find();
    for (const item of everydayRecipes) {
      if (await recipes.findOneBy({ id: item.id })) continue;
      // Parallel hands-on work fits inside the referenced wait; all other steps serialize.
      const total = item.steps.reduce((sum, step) => sum + (step[4] ? 0 : step[2]), 0);
      await recipes.save(recipes.create({
        id: item.id, title: item.title, titleEn: item.title, titleZh: item.titleZh,
        description: `An everyday ${item.cuisine} recipe for two.`, descriptionEn: `An everyday ${item.cuisine} recipe for two.`, descriptionZh: `适合两人份的${item.titleZh}，包含用量和完整步骤。`,
        cuisineType: item.cuisine, cuisines: [item.cuisine], mealType: item.meal as RecipeMealType,
        difficulty: RecipeDifficulty.EASY, prepTimeMin: 0, cookTimeMin: total, servings: 2,
        caloriesPerServing: null, tags: item.tags, dietTypes: item.diet, requiredTools: item.tools,
        isSystem: true, isPublished: true, reviewStatus: RecipeReviewStatus.APPROVED, status: RecipeStatus.PUBLISHED,
      }));
      for (const [index, [en, zh, quantity, unit]] of item.ingredients.entries()) {
        const ingredient = ingredients.find(value => [value.name, value.nameZh, ...(value.aliases ?? [])].some(name => !!name && (equivalentIngredientName(name) === equivalentIngredientName(en) || name === zh)));
        await q.manager.getRepository(RecipeIngredient).save({ recipeId: item.id, ingredientId: ingredient?.id ?? null,
          displayName: en, displayNameEn: en, displayNameZh: zh, quantity, unit, sortOrder: index, isOptional: false });
      }
      for (const [index, [en, zh, duration, type, parallel]] of item.steps.entries()) {
        await q.manager.getRepository(RecipeStep).save({ recipeId: item.id, stepNumber: index + 1,
          description: en, descriptionEn: en, descriptionZh: zh, durationMin: duration,
          stepType: type === 'hands_off' ? StepType.HANDS_OFF : StepType.HANDS_ON, parallelWithStepNumber: parallel ?? null });
      }
    }
  }
  async down(q: QueryRunner): Promise<void> {
    for (const recipe of everydayRecipes) await q.manager.getRepository(Recipe).delete(recipe.id);
  }
}
