import { Recipe } from '../../../database/entities/recipe.entity';

export interface IngredientAvailability {
  ingredient_id: string | null;
  name: string;
  quantity_in_fridge: number;
  unit: string | null;
  freshness_score: number;
}

export interface MissingIngredient {
  ingredient_id: string | null;
  name: string;
  quantity_needed: number | null;
  unit: string | null;
}

export interface MatchedRecipe {
  recipe: Recipe;
  final_score: number;
  fridge_match_ratio: number;
  freshness_bonus: number;
  cuisine_bonus: number;
  health_bonus: number;
  available_ingredients: IngredientAvailability[];
  missing_ingredients: MissingIngredient[];
}
