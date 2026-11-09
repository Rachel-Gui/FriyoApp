import { Recipe } from '../../database/entities/recipe.entity';
export function searchSuggestionTags(recipes: Recipe[]): string[] {
  const tags = new Map<string, string>();
  for (const recipe of recipes) {
    for (const raw of [recipe.cuisineType, recipe.mealType, ...(recipe.tags ?? [])]) {
      const tag = raw?.trim();
      if (tag && !tags.has(tag.toLowerCase())) tags.set(tag.toLowerCase(), tag);
    }
  }
  return [...tags.values()].slice(0, 8);
}
