import { RecipeTranslationService, validateRecipeTranslation } from './recipe-translation.service';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { Recipe } from '../../database/entities/recipe.entity';

const source = () => ({ id: 'recipe', title: '5 Minute Tomato', titleZh: null, titleEn: null, description: null,
  ingredients: [{ id: 'ingredient', displayName: 'Tomato', displayNameZh: null, displayNameEn: null, quantity: 2, unit: 'cups' }],
  steps: [{ id: 'step', stepNumber: 1, description: 'Cook at 180 C for 5 min.', descriptionZh: null, descriptionEn: null, durationMin: 5, tips: null }],
} as unknown as Recipe);
const translation = () => ({ title: '5 分钟番茄菜', description: null, ingredients: [{ id: 'ingredient', name: '番茄' }], steps: [{ id: 'step', description: '以 180 C 烹饪 5 分钟。', tips: null }] });
function setup(current = source()) {
  const manager = { findOneOrFail: jest.fn().mockResolvedValue(current), update: jest.fn().mockResolvedValue({}) };
  const db = { transaction: jest.fn(async (fn: (manager: unknown) => unknown) => fn(manager)) } as unknown as DataSource;
  const service = new RecipeTranslationService(new ConfigService({ OPENAI_API_KEY: 'sk-test-local' }), db);
  const create = jest.spyOn((service as any).client.chat.completions, 'create').mockResolvedValue({ choices: [{ message: { content: JSON.stringify(translation()) } }] });
  return { service, manager, create };
}
describe('recipe translations', () => {
  it('rejects changed quantities, temperatures, step IDs, omissions and invented tips', () => {
    expect(validateRecipeTranslation(source(), translation())).toEqual(translation());
    const changed = translation(); changed.steps[0].description = '以 200 C 烹饪 5 分钟。';
    expect(() => validateRecipeTranslation(source(), changed)).toThrow('numeric');
    const reordered = translation(); reordered.steps[0].id = 'another-step';
    expect(() => validateRecipeTranslation(source(), reordered)).toThrow('IDs');
    expect(() => validateRecipeTranslation(source(), { ...translation(), ingredients: [] })).toThrow('dropped');
    expect(() => validateRecipeTranslation(source(), { ...translation(), steps: [{ ...translation().steps[0], tips: 'Invented tip' }] })).toThrow('invented');
  });
  it('rejects absent/placeholder provider configuration without a request', async () => {
    const db = {} as DataSource;
    const service = new RecipeTranslationService(new ConfigService({ OPENAI_API_KEY: 'sk-your-placeholder', RECIPE_AUTO_TRANSLATE: 'true' }), db);
    expect(service.automaticEnabled).toBe(false);
    await expect(service.translate(source(), 'zh')).rejects.toThrow('not configured');
  });
  it('deduplicates simultaneous calls, caches translations, and never updates amounts or original instructions', async () => {
    const { service, manager, create } = setup();
    const [first, second] = await Promise.all([service.translate(source(), 'zh'), service.translate(source(), 'zh')]);
    expect(create).toHaveBeenCalledTimes(1); expect(second).toBe(first);
    expect(first.steps[0].description).toBe('Cook at 180 C for 5 min.');
    expect(first.steps[0].descriptionZh).toBe('以 180 C 烹饪 5 分钟。');
    expect(first.ingredients[0].quantity).toBe(2);
    for (const call of manager.update.mock.calls) expect(Object.keys(call[2])).not.toEqual(expect.arrayContaining(['quantity']));
    await service.translate(first, 'zh'); expect(create).toHaveBeenCalledTimes(1);
  });
  it('retains a supplied translation instead of replacing it with machine text', async () => {
    const current = source(); current.titleZh = '人工译名';
    const { service } = setup(current);
    expect((await service.translate(current, 'zh')).titleZh).toBe('人工译名');
  });
  it('does not save a translation after the source recipe changes', async () => {
    const current = source(); current.steps[0].description = 'Updated instructions';
    const { service, manager } = setup(current);
    await expect(service.translate(source(), 'zh')).rejects.toThrow('unavailable');
    expect(manager.update).not.toHaveBeenCalled();
  });
  it('does not save partial data when the provider fails', async () => {
    const { service, manager, create } = setup(); create.mockRejectedValue(new Error('offline'));
    await expect(service.translate(source(), 'zh')).rejects.toThrow('unavailable'); expect(manager.update).not.toHaveBeenCalled();
  });
});
