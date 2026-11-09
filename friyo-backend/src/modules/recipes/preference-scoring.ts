import { Recipe } from '../../database/entities/recipe.entity';
import { UserProfile } from '../../database/entities/user-profile.entity';

const key = (value: string) => value.trim().toLowerCase().replace(/[ _]+/g, '-');

/** Stable, explainable ranking using the preferences collected in onboarding. */
export function preferenceScore(recipe: Recipe, profile: UserProfile | null): number {
  if (!profile) return 0;
  const cuisines = [recipe.cuisineType ?? '', ...(recipe.cuisines ?? [])].map(key);
  const tags = (recipe.tags ?? []).map(key);
  let score = (profile.preferredCuisines ?? []).some(c => cuisines.includes(key(c))) ? 20 : 0;
  score += (profile.flavorPreferences ?? []).filter(f => tags.includes(key(f))).length * 5;
  score += (profile.mealFormats ?? []).filter(f => tags.includes(key(f)) || key(f) === key(recipe.mealType ?? '')).length * 5;
  const minutes = recipe.prepTimeMin + recipe.cookTimeMin;
  const time = (profile.timePreference ?? '').toLowerCase();
  if ((time.startsWith('quick') && minutes < 30) || (time.startsWith('moderate') && minutes >= 30 && minutes <= 60) || (time.startsWith('leisurely') && minutes > 60)) score += 15;
  if (profile.cookingSkill === 'beginner' && recipe.difficulty === 'easy') score += 5;
  for (const goal of profile.healthGoals ?? []) {
    const normalized = key(goal);
    if (normalized === 'weight-loss' && Number(recipe.caloriesPerServing) > 0 && Number(recipe.caloriesPerServing) < 400) score += 10;
    if (normalized === 'muscle-gain' && tags.includes('high-protein')) score += 10;
    if (normalized === 'low-carb' && tags.includes('low-carb')) score += 10;
  }
  return score;
}

/** Higher priority for usable ingredients approaching expiry. */
export function expiryPriority(expiry: Date | null): number {
  if (!expiry) return 0;
  const days = Math.ceil((new Date(expiry).getTime() - Date.now()) / 86_400_000);
  return days < 0 ? 0 : days <= 2 ? 100 : days <= 7 ? 50 : 0;
}
