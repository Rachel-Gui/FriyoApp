import { everydayRecipes } from '../../database/catalog/everyday-recipes';
import { validateRecipeSteps } from './recipe-step-validation';
import { RecipesService } from './recipes.service';
import { RecipeStep, StepType } from '../../database/entities/recipe-step.entity';
describe('authored everyday catalog', () => {
  it('contains 20 unique, bilingual measured recipes across meals and cuisines', () => {
    expect(everydayRecipes).toHaveLength(20);
    expect(new Set(everydayRecipes.map(r => r.id)).size).toBe(20);
    expect(new Set(everydayRecipes.map(r => r.meal)).size).toBe(4);
    expect(new Set(everydayRecipes.map(r => r.cuisine)).size).toBeGreaterThanOrEqual(8);
    for (const recipe of everydayRecipes) {
      expect(recipe.titleZh).toBeTruthy();
      for (const [en, zh, quantity, unit] of recipe.ingredients) { expect(en && zh && unit).toBeTruthy(); expect(quantity).toBeGreaterThan(0); }
      const steps = recipe.steps.map(([en, zh, duration, type, parallel], i) => {
        expect(zh).toBeTruthy();
        return { step_number: i + 1, description: en, duration_min: duration, step_type: type === 'hands_off' ? StepType.HANDS_OFF : StepType.HANDS_ON, parallel_with_step_number: parallel };
      });
      expect(() => validateRecipeSteps(steps)).not.toThrow();
      const timeline = (RecipesService.prototype as any).buildCookingTimeline(steps.map(s => ({ stepNumber: s.step_number, description: s.description, durationMin: s.duration_min, stepType: s.step_type, parallelWithStepNumber: s.parallel_with_step_number })) as RecipeStep[]);
      const end = Math.max(...[...timeline.hands_on, ...timeline.hands_off].map((s: any) => s.start_min + s.duration_min));
      expect(end).toBe(recipe.steps.reduce((sum, s) => sum + (s[4] ? 0 : s[2]), 0));
    }
  });
});
