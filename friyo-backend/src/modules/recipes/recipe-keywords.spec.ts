import { searchKeywords, externalKeyword, equivalentIngredientName } from './recipe-keywords';
import { matchingFridgeItems } from './ingredient-matching';
import { RecipeIngredient } from '../../database/entities/recipe-ingredient.entity';
import { FridgeItem } from '../../database/entities/fridge-item.entity';

describe('bilingual recipe vocabulary', () => {
  it('searches Chinese and English in both directions including case and aliases', () => {
    expect(searchKeywords(' TOMATOES ')).toEqual(expect.arrayContaining(['番茄', '西红柿', 'tomato']));
    expect(searchKeywords('西红柿')).toContain('tomatoes');
    expect(externalKeyword('早餐')).toBe('breakfast');
    expect(externalKeyword(' 鸡肉 ')).toBe('chicken');
    expect(externalKeyword('Arrabiata')).toBe('Arrabiata');
  });
  it('matches imported English-only ingredients to custom Chinese fridge items', () => {
    const line = { displayName: 'Tomatoes' } as RecipeIngredient;
    const item = { customName: '西红柿', quantity: 2 } as FridgeItem;
    expect(matchingFridgeItems(line, [item])).toEqual([item]);
    expect(matchingFridgeItems({ displayName: '番茄' } as RecipeIngredient, [{ customName: 'Tomato', quantity: 1 } as FridgeItem])).toHaveLength(1);
    expect(equivalentIngredientName('Chicken')).not.toBe(equivalentIngredientName('Chicken stock'));
  });
  it('preserves explicit bilingual ingredient labels without catalog links', () => {
    expect(matchingFridgeItems({ displayName: 'A special herb', displayNameZh: '香草' } as RecipeIngredient, [{ customName: '香草', quantity: 1 } as FridgeItem])).toHaveLength(1);
  });
});
