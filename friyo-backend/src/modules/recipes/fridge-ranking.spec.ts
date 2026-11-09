import { RecipeRecommendationService } from './recipe-recommendation.service';

describe('main ingredient fridge ranking', () => {
  const service = Object.create(RecipeRecommendationService.prototype) as any;
  const line = (name: string, category = 'fresh') => ({ ingredientId: name, displayName: name, isOptional: false, ingredient: { name, category }, quantity: 1, unit: 'pcs' });
  const recipe = { ingredients: [line('Tomato'), line('Salt', 'condiment')], cuisineType: null };
  const stock = (name: string) => ({ ingredientId: name, quantity: 1, expiryDate: null });
  it('does not lower the main ingredient match when only seasoning is missing', () => {
    const result = service.computeMatchScore(recipe, new Map([['Tomato', [stock('Tomato')]]]), null);
    expect(result.fridge_match_ratio).toBe(100);
    expect(result.missing_ingredients.map((item: any) => item.name)).toEqual(['Salt']);
  });
  it('does not recommend a recipe on the strength of salt alone', () => {
    expect(service.computeMatchScore(recipe, new Map([['Salt', [stock('Salt')]]]), null).fridge_match_ratio).toBe(0);
  });
  it('returns no fridge matches when storage is empty', async () => {
    service.profileRepo = { findOne: jest.fn().mockResolvedValue(null) };
    service.loadActiveFridgeItems = jest.fn().mockResolvedValue([]);
    const qb: any = {};
    for (const method of ['leftJoinAndSelect', 'where', 'andWhere', 'orderBy', 'take']) qb[method] = () => qb;
    qb.getMany = jest.fn().mockResolvedValue([recipe]);
    service.recipeRepo = { createQueryBuilder: () => qb };
    expect(await service.matchRecipesToFridge('user')).toEqual([]);
  });
});
