import { AiService } from './ai.service';
import { RecipeRecommendationService } from '../recipes/recipe-recommendation.service';
import { ConfigService } from '@nestjs/config';

const recipe = { id: '26110800-0000-4000-8000-000000000001', title: 'Tomato eggs', titleZh: '番茄炒蛋', prepTimeMin: 5, cookTimeMin: 10, difficulty: 'easy', caloriesPerServing: null, tags: [], ingredients: [
  { displayName: 'Tomatoes', displayNameZh: '番茄', isOptional: false }, { displayName: 'Eggs', displayNameZh: '鸡蛋', isOptional: false },
] };
function setup(items: any[] = [], config: Record<string, string> = {}) {
  const qb: any = { getMany: async () => [recipe] };
  for (const key of ['leftJoinAndSelect', 'where', 'andWhere', 'orderBy']) qb[key] = () => qb;
  const profileRepo = { findOne: async () => null };
  const recommendations = Object.create(RecipeRecommendationService.prototype) as any;
  recommendations.profileRepo = profileRepo;
  recommendations.recipeRepo = { createQueryBuilder: () => qb };
  recommendations.loadActiveFridgeItems = async () => items;
  return new AiService({ find: async () => items } as any, profileRepo as any, {} as any, {} as any, new ConfigService(config), recommendations);
}
describe('AI catalog matching acceptance', () => {
  it('matches bilingual fridge names against real ranking code without an AI key', async () => {
    const reply = await setup([{ customName: '番茄', quantity: 2 }]).chat('user', 'What can I cook in 20 minutes?');
    expect(reply.response_source).toBe('local'); expect(reply.matching_source).toBe('fridge');
    expect(reply.suggested_recipes[0]).toMatchObject({ recipe_id: recipe.id, calories: null, missing_ingredients: ['Eggs'] });
    expect(reply.suggested_recipes[0].reason).toContain('50%');
  });
  it('uses profile alternatives for an empty fridge without inventing available food', async () => {
    const reply = await setup().chat('user', 'Dinner?');
    expect(reply.matching_source).toBe('profile');
    expect(reply.suggested_recipes[0].used_ingredients).toEqual([]);
    expect(reply.suggested_recipes[0].missing_ingredients).toEqual(['Tomatoes', 'Eggs']);
  });
  it('does not include expired/consumed stock and honors requested total cooking time', async () => {
    const ai = setup([{ customName: 'Tomato', quantity: 0 }, { customName: 'Eggs', quantity: 1, expiryDate: '2000-01-01' }]);
    const reply = await ai.chat('user', '10 min dinner');
    expect(reply.suggested_recipes).toEqual([]);
    expect(reply.message).toContain('longer cooking time');
    const normal = await ai.chat('user', 'Dinner'); expect(normal.suggested_recipes[0].used_ingredients).toEqual([]);
  });
  it('exposes successful provider provenance while keeping cards grounded in database IDs', async () => {
    const ai = setup();
    (ai as any).openai = { chat: { completions: { create: jest.fn().mockResolvedValue({ choices: [{ message: { content: 'Try this catalog recipe.' } }] }) } } };
    const reply = await ai.chat('user', 'Dinner');
    expect(reply.response_source).toBe('openai'); expect(reply.suggested_recipes[0].recipe_id).toBe(recipe.id);
  });
  it('reports provider failure distinctly and returns usable local matches', async () => {
    const ai = setup();
    (ai as any).openai = { chat: { completions: { create: jest.fn().mockRejectedValue(new Error('test provider offline')) } } };
    const reply = await ai.chat('user', 'Dinner');
    expect(reply.fallback_reason).toBe('provider_unavailable'); expect(reply.suggested_recipes).toHaveLength(1);
  });
  it('reports configuration without revealing API keys or contacting a provider', () => {
    expect(setup().getStatus()).toEqual({ configured_providers: [], local_matching_available: true });
    expect(JSON.stringify(setup([], { GEMINI_API_KEY: 'private-value' }).getStatus())).not.toContain('private-value');
  });
});
