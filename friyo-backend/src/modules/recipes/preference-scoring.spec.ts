import { expiryPriority, preferenceScore } from './preference-scoring';
import { Recipe } from '../../database/entities/recipe.entity';
import { UserProfile } from '../../database/entities/user-profile.entity';

const recipe = (fields: Partial<Recipe> = {}) => ({ cuisineType: 'Chinese', cuisines: ['Chinese'], tags: ['savory'], prepTimeMin: 5, cookTimeMin: 15, difficulty: 'easy', mealType: 'dinner', ...fields } as Recipe);
const profile = (fields: Partial<UserProfile> = {}) => ({ preferredCuisines: [], flavorPreferences: [], healthGoals: [], mealFormats: [], ...fields } as UserProfile);

describe('preference ranking', () => {
  it('ranks the selected cuisine and flavor ahead of an unrelated recipe', () => {
    const user = profile({ preferredCuisines: ['Chinese'], flavorPreferences: ['Savory'] });
    expect(preferenceScore(recipe(), user)).toBeGreaterThan(preferenceScore(recipe({ cuisineType: 'Italian', cuisines: ['Italian'], tags: ['sweet'] }), user));
  });
  it('uses total time and handles all three onboarding time preferences', () => {
    expect(preferenceScore(recipe(), profile({ timePreference: 'Quick (<30 min)' }))).toBe(15);
    expect(preferenceScore(recipe({ cookTimeMin: 40 }), profile({ timePreference: 'Moderate (30-60 min)' }))).toBe(15);
    expect(preferenceScore(recipe({ cookTimeMin: 70 }), profile({ timePreference: 'Leisurely (60+ min)' }))).toBe(15);
  });
  it('does not give unknown or zero calories a low-calorie bonus', () => {
    const user = profile({ healthGoals: ['weight_loss'] });
    expect(preferenceScore(recipe({ caloriesPerServing: null }), user)).toBe(0);
    expect(preferenceScore(recipe({ caloriesPerServing: 0 }), user)).toBe(0);
    expect(preferenceScore(recipe({ caloriesPerServing: 350 }), user)).toBe(10);
  });
  it('prioritizes expiring usable food over long-lived inventory', () => {
    const afterDays = (n: number) => new Date(Date.now() + n * 86400000);
    expect(expiryPriority(afterDays(1))).toBeGreaterThan(expiryPriority(afterDays(15)));
    expect(expiryPriority(afterDays(-2))).toBe(0);
    expect(expiryPriority(null)).toBe(0);
  });
  it('handles profiles without preferences', () => {
    expect(preferenceScore(recipe(), null)).toBe(0);
    expect(preferenceScore(recipe(), profile())).toBe(0);
  });
});
