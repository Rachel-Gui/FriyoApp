import { MealPlansService } from './meal-plans.service';

describe('cooking completion retries', () => {
  it('returns the already saved meal without deducting stock again', async () => {
    const service: any = Object.create(MealPlansService.prototype);
    service.mealLogRepo = { findOne: jest.fn(async () => ({ id: 'existing' })) };
    service.fridgeService = { deductIngredients: jest.fn() };
    const result = await service.logMeal('user', { client_request_id: 'completion' } as any);
    expect(result.id).toBe('existing');
    expect(service.mealLogRepo.findOne).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'user', clientRequestId: 'completion' } }));
    expect(service.fridgeService.deductIngredients).not.toHaveBeenCalled();
  });
  it('handles a simultaneous insert losing the unique-key race without double deduction', async () => {
    const service: any = Object.create(MealPlansService.prototype);
    service.mealLogRepo = { findOne: jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'winner' }), create: (v: unknown) => v, save: jest.fn().mockRejectedValue({ code: '23505' }) };
    service.recipeRepo = { findOne: async () => ({ caloriesPerServing: 100 }) };
    service.fridgeService = { deductIngredients: jest.fn() };
    expect(await service.logMeal('user', { client_request_id: 'completion', recipe_id: 'recipe', servings_eaten: 1 } as any)).toEqual({ id: 'winner' });
    expect(service.fridgeService.deductIngredients).not.toHaveBeenCalled();
  });
});
