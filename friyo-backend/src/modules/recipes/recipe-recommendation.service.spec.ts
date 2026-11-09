import { RecipeRecommendationService } from './recipe-recommendation.service';

// Scoring is pure; no database, Redis or AI calls are involved.
const service = Object.create(RecipeRecommendationService.prototype) as any;
const recipe = { id: 'test', ingredients: [
  { displayNameEn: 'Tomatoes', displayNameZh: '番茄', isOptional: false },
  { displayNameEn: 'Eggs', displayNameZh: '鸡蛋', isOptional: false },
  { displayNameEn: 'Olive Oil', isOptional: false },
], tags: [], cuisines: [], prepTimeMin: 5, cookTimeMin: 15 };
const fridge = (customName: string, expiryDate: Date | null = null, quantity = 1) =>
  new Map([['item', [{ customName, quantity, expiryDate }]]]);

describe('fridge recommendation scoring', () => {
  it('matches Chinese custom names and excludes pantry seasonings from coverage', () => {
    const score = service.computeMatchScore(recipe, fridge('番茄'), null);
    expect(score.fridge_match_ratio).toBe(50);
    expect(score.available_ingredients).toHaveLength(1);
  });
  it('never recommends a dish on seasoning matches alone', () => {
    expect(service.computeMatchScore(recipe, fridge('Olive Oil'), null).fridge_match_ratio).toBe(0);
  });
  it('does not count expired or consumed ingredients', () => {
    expect(service.computeMatchScore(recipe, fridge('番茄', new Date(Date.now() - 3 * 86400000)), null).fridge_match_ratio).toBe(0);
    expect(service.computeMatchScore(recipe, fridge('番茄', null, 0), null).fridge_match_ratio).toBe(0);
  });
  it('breaks equal-coverage ties in favor of using ingredients expiring soon', () => {
    const near = service.computeMatchScore(recipe, fridge('番茄', new Date(Date.now() + 86400000)), null);
    const far = service.computeMatchScore(recipe, fridge('番茄', new Date(Date.now() + 20 * 86400000)), null);
    expect(near.final_score).toBeGreaterThan(far.final_score);
  });
});
