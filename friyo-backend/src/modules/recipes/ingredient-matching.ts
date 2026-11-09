import { equivalentIngredientName as normalize } from './recipe-keywords';
import { FridgeItem } from '../../database/entities/fridge-item.entity';
import { RecipeIngredient } from '../../database/entities/recipe-ingredient.entity';

export function matchingFridgeItems(line: RecipeIngredient, items: FridgeItem[]): FridgeItem[] {
  const names = new Set([line.displayName, line.displayNameZh, line.displayNameEn, line.ingredient?.name, line.ingredient?.nameZh, ...(line.ingredient?.aliases ?? [])].filter(Boolean).map(name => normalize(name!)));
  return items.filter(item => {
    if (Number(item.quantity) <= 0) return false;
    if (item.expiryDate && new Date(item.expiryDate).toISOString().slice(0, 10) < new Date().toISOString().slice(0, 10)) return false;
    if (line.ingredientId && line.ingredientId === item.ingredientId) return true;
    return [item.customName, item.ingredient?.name, item.ingredient?.nameZh, ...(item.ingredient?.aliases ?? [])].some(name => !!name && names.has(normalize(name)));
  });
}
