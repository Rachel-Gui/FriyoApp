import { matchingFridgeItems } from './ingredient-matching';
import { RecipeIngredient } from '../../database/entities/recipe-ingredient.entity';
import { FridgeItem } from '../../database/entities/fridge-item.entity';

describe('recipe ingredient matching', () => {
  const line = { ingredientId: 'tomato', displayName: 'Tomato', ingredient: { name: 'Tomato', nameZh: '番茄', aliases: ['西红柿'] } } as RecipeIngredient;
  const item = (customName: string, quantity = 1, expiryDate: string | null = null) => ({ customName, quantity, expiryDate, ingredientId: null }) as unknown as FridgeItem;
  it('matches custom Chinese names and aliases without catalog IDs', () => {
    expect(matchingFridgeItems(line, [item('番茄'), item('西红柿'), item(' TOMATO '), item('Potato')])).toHaveLength(3);
  });
  it('excludes expired and consumed items', () => {
    expect(matchingFridgeItems(line, [item('Tomato', 0), item('Tomato', 1, '2000-01-01')])).toHaveLength(0);
  });
  it('does not confuse partial ingredient names', () => {
    expect(matchingFridgeItems(line, [item('Tomato sauce')])).toHaveLength(0);
  });
});
