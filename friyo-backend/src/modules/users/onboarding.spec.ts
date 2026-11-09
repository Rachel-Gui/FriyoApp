import { UsersController } from './users.controller';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

describe('onboarding profile persistence', () => {
  it('round trips every latest questionnaire answer', async () => {
    const repo = { findOne: jest.fn().mockResolvedValue(null), create: (v: unknown) => v, save: jest.fn(async v => v) };
    const controller = new UsersController({} as any, {} as any, repo as any, {} as any, {} as any);
    const dto = { meal_formats: ['Bowl Meals'], flavor_preferences: ['Spicy'], time_preference: 'Quick (<30 min)', grocery_frequency: 'Once a week', dietary_restrictions: ['Vegetarian'], initial_craving: 'Noodles', household_size: 1, onboarding_completed: true };
    const response = await controller.updateProfile({ id: 'user' } as any, dto);
    expect(response).toMatchObject(dto);
    expect(repo.save.mock.calls[0][0]).toMatchObject({ userId: 'user', initialCraving: 'Noodles', flavorPreferences: ['Spicy'] });
  });
  it('rejects string booleans and oversized free text', async () => {
    const errors = await validate(plainToInstance(UpdateProfileDto, { onboarding_completed: 'false', initial_craving: 'x'.repeat(1001) }));
    expect(errors.map(e => e.property)).toEqual(expect.arrayContaining(['onboarding_completed', 'initial_craving']));
  });
});
