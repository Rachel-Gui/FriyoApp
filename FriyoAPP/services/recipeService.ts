// ─────────────────────────────────────────────────────────────────────────────
// services/recipeService.ts
// ─────────────────────────────────────────────────────────────────────────────

import { get, post, del } from './api';
import type { Recipe, RecipeForCooking, PaginatedResponse } from './types';

interface SearchParams {
  q:               string;
  usePreferences?: boolean;
  page?:           number;
  limit?:          number;
}

export const recipeService = {

  /** Recipes recommended based on what's currently in the user's fridge. */
  async getRecommendationsByFridge(): Promise<Recipe[]> {
    return get<Recipe[]>('/recipes/recommendations/fridge');
  },

  /**
   * Recipes recommended based on available time.
   * Optional query param `max_minutes` can be appended by the caller.
   */
  async getRecommendationsByTime(maxMinutes?: number): Promise<Recipe[]> {
    const qs = maxMinutes !== undefined ? `?max_minutes=${maxMinutes}` : '';
    return get<Recipe[]>(`/recipes/recommendations/time${qs}`);
  },

  /** Recipes recommended based on the user's health goals / diet preferences. */
  async getHealthRecommendations(): Promise<Recipe[]> {
    return get<Recipe[]>('/recipes/recommendations/health');
  },

  /** Globally trending recipes (popularity-ranked). */
  async getTrendingRecipes(): Promise<Recipe[]> {
    return get<Recipe[]>('/recipes/recommendations/trending');
  },

  /**
   * Full-text recipe search.
   * @param q               Search query string.
   * @param usePreferences  When true the server filters by the user's
   *                        saved diet/allergy preferences (default true).
   * @param page            1-based page number.
   * @param limit           Results per page.
   */
  async searchRecipes(params: SearchParams): Promise<PaginatedResponse<Recipe>> {
    const qs = new URLSearchParams({ q: params.q });
    if (params.usePreferences !== undefined)
      qs.set('use_preferences', String(params.usePreferences));
    if (params.page  !== undefined) qs.set('page',  String(params.page));
    if (params.limit !== undefined) qs.set('limit', String(params.limit));
    return get<PaginatedResponse<Recipe>>(`/recipes/search?${qs.toString()}`);
  },

  /** Full recipe detail including ingredients and steps. */
  async getRecipeDetail(id: string): Promise<Recipe> {
    return get<Recipe>(`/recipes/${id}`);
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
    return get<RecipeForCooking>(`/recipes/${id}/for-cooking${qs}`);
  },

  /** All recipes the user has saved/bookmarked. */
  async getSavedRecipes(): Promise<Recipe[]> {
    return get<Recipe[]>('/meal-plans/saved-recipes');
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
