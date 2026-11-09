// ─────────────────────────────────────────────────────────────────────────────
// services/recipeService.ts
// ─────────────────────────────────────────────────────────────────────────────

import { get, post, del } from './api';
import type { Recipe, RecipeForCooking, PaginatedResponse } from './types';

export function normalizeRecipe(value: Recipe | { recipe: Recipe }): Recipe {
  const recipe = 'recipe' in value ? value.recipe : value;
  const raw = recipe as Recipe & { coverImageUrl?: string };
  return {
    ...recipe,
    imageUrl: recipe.imageUrl || raw.coverImageUrl || '',
    ingredients: (recipe.ingredients ?? []).map(line => {
      const item = line as typeof line & { displayName?: string; displayNameZh?: string; displayNameEn?: string; ingredient?: { name?: string; nameZh?: string } };
      return { ...line, ingredientNameZh: line.ingredientNameZh || item.displayNameZh || item.ingredient?.nameZh, ingredientNameEn: line.ingredientNameEn || item.displayNameEn || item.ingredient?.name, ingredientName: line.ingredientName || item.displayName || item.ingredient?.name || item.ingredient?.nameZh || 'Ingredient' };
    }),
    steps: [...(recipe.steps ?? [])].sort((a, b) => a.stepNumber - b.stepNumber),
  };
}

interface SearchParams {
  q:               string;
  category?: string;
  usePreferences?: boolean;
  page?:           number;
  limit?:          number;
}

export const recipeService = {
  getSearchSuggestions: () => get<string[]>('/recipes/recommendations/search-suggestions'),
  async listRecipes(page = 1, limit = 30): Promise<PaginatedResponse<Recipe> & { items: Recipe[] }> {
    const result = await get<PaginatedResponse<Recipe>>(`/recipes?page=${page}&limit=${limit}`);
    return { ...result, items: (result.items ?? result.data ?? []).map(normalizeRecipe) };
  },
  async getProfileRecommendations(): Promise<Recipe[]> {
    return (await get<Recipe[]>('/recipes/recommendations/profile')).map(normalizeRecipe);
  },

  /** Recipes recommended based on what's currently in the user's fridge. */
  async getRecommendationsByFridge(): Promise<Recipe[]> {
    type Match = { recipe: Recipe; fridge_match_ratio?: number; missing_ingredients?: { name: string }[]; fridgeMatchRatio?: number; missingIngredients?: { name: string }[] };
    const matches = await get<Array<Recipe | Match>>('/recipes/recommendations/fridge');
    return matches.map(value => ({
      ...normalizeRecipe(value),
      ...('recipe' in value ? {
        fridgeMatchRatio: value.fridgeMatchRatio ?? value.fridge_match_ratio,
        missingIngredients: value.missingIngredients ?? value.missing_ingredients,
      } : {}),
    }));
  },

  /**
   * Recipes recommended based on available time.
   * Optional query param `max_minutes` can be appended by the caller.
   */
  async getRecommendationsByTime(maxMinutes?: number): Promise<Recipe[]> {
    const qs = maxMinutes !== undefined ? `?max_minutes=${maxMinutes}` : '';
    return (await get<Array<Recipe | { recipe: Recipe }>>(`/recipes/recommendations/time${qs}`)).map(normalizeRecipe);
  },

  /** Recipes recommended based on the user's health goals / diet preferences. */
  async getHealthRecommendations(): Promise<Recipe[]> {
    return (await get<Recipe[]>('/recipes/recommendations/health')).map(normalizeRecipe);
  },

  /** Globally trending recipes (popularity-ranked). */
  async getTrendingRecipes(): Promise<Recipe[]> {
    return (await get<Recipe[]>('/recipes/recommendations/trending')).map(normalizeRecipe);
  },

  /**
   * Full-text recipe search.
   * @param q               Search query string.
   * @param usePreferences  When true the server filters by the user's
   *                        saved diet/allergy preferences (default true).
   * @param page            1-based page number.
   * @param limit           Results per page.
   */
  async searchRecipes(params: SearchParams): Promise<PaginatedResponse<Recipe> & { items: Recipe[] }> {
    const qs = new URLSearchParams({ q: params.q });
    if (params.category) qs.set('category', params.category);
    if (params.usePreferences !== undefined)
      qs.set('use_preferences', String(params.usePreferences));
    if (params.page  !== undefined) qs.set('page',  String(params.page));
    if (params.limit !== undefined) qs.set('limit', String(params.limit));
    const result = await get<PaginatedResponse<Recipe>>(`/recipes/search?${qs.toString()}`);
    return { ...result, items: (result.items ?? result.data ?? []).map(normalizeRecipe) };
  },

  /** Full recipe detail including ingredients and steps. */
  async getRecipeDetail(id: string, language?: 'en' | 'zh'): Promise<Recipe> {
    return normalizeRecipe(await get<Recipe>(`/recipes/${id}${language ? `?language=${language}` : ''}`));
  },

  async translateRecipe(id: string, language: 'en' | 'zh'): Promise<Recipe> {
    return normalizeRecipe(await post<Recipe>(`/recipes/${id}/translate`, { language }));
  },

  /**
   * Recipe packaged for the cooking flow:
   *   - base recipe + optional AI adaptation
   *   - fridge ingredient match status
   *   - computed cooking timeline (hands-on / hands-off)
   *
   * @param id           Recipe ID.
   * @param adaptationId Optional AI adaptation ID to overlay.
   */
  async getRecipeForCooking(id: string, adaptationId?: string): Promise<RecipeForCooking> {
    const qs = adaptationId ? `?adaptation_id=${adaptationId}` : '';
    const data = await get<RecipeForCooking>(`/recipes/${id}/for-cooking${qs}`);
    return { ...data, recipe: normalizeRecipe(data.recipe), fridgeStatus: (data.fridgeStatus ?? []).map(status => {
      const raw = status as typeof status & { ingredient?: { name?: string; unit?: string } };
      return { ...status, ingredientName: status.ingredientName || raw.ingredient?.name || 'Ingredient', unit: status.unit || raw.ingredient?.unit || '' };
    }) };
  },

  /** All recipes the user has saved/bookmarked. */
  async getSavedRecipes(): Promise<Recipe[]> {
    return (await get<Recipe[]>('/meal-plans/saved-recipes')).map(normalizeRecipe);
  },

  /** Save (bookmark) a recipe. */
  async saveRecipe(recipeId: string): Promise<void> {
    return post<void>(`/meal-plans/save/${recipeId}`);
  },

  /** Remove a saved recipe. */
  async unsaveRecipe(recipeId: string): Promise<void> {
    return del<void>(`/meal-plans/save/${recipeId}`);
  },
};
