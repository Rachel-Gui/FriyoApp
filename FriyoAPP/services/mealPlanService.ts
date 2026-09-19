// ─────────────────────────────────────────────────────────────────────────────
// services/mealPlanService.ts
// ─────────────────────────────────────────────────────────────────────────────

import { get, post, postForm } from './api';
import type { DayPlan, WeekPlan, MealLog, MealPlanAnalysis, MonthMealHistory } from './types';

interface LogMealData {
  recipeId:      string;
  mealType:      'breakfast' | 'lunch' | 'dinner' | 'snack';
  servingsEaten: number;
  loggedAt?:     string;   // ISO date string — defaults to now on the server
}

interface SaveWeekPlanData {
  weekStartDate: string;
  /** Keys are ISO date strings (YYYY-MM-DD); values are planned meal IDs. */
  plan: Record<string, {
    breakfast?: string;
    lunch?:     string;
    dinner?:    string;
    snacks?:    string[];
  }>;
}

export const mealPlanService = {

  /** Today's logged meals (breakfast / lunch / dinner / snacks). */
  async getTodayMeals(): Promise<DayPlan> {
    return get<DayPlan>('/meal-plans/today');
  },

  /**
   * Week plan for a given Monday date.
   * @param weekStart ISO date string of the week's Monday (e.g. "2025-01-20").
   *                  Defaults to the current week on the server when omitted.
   */
  async getWeekPlan(weekStart?: string): Promise<WeekPlan> {
    const qs = weekStart ? `?start_date=${weekStart}` : '';
    return get<WeekPlan>(`/meal-plans/week${qs}`);
  },

  /**
   * Full cooking history for a given month.
   * @param month ISO year-month string (e.g. "2025-01").
   */
  async getMonthHistory(month: string): Promise<MealLog[]> {
    const [year, monthNum] = month.split('-');
    const result = await get<MonthMealHistory>(`/meal-plans/month?year=${year}&month=${Number(monthNum)}`);
    return result.logs ?? [];
  },

  async getMonth(month: string): Promise<MonthMealHistory> {
    const [year, monthNum] = month.split('-');
    return get<MonthMealHistory>(`/meal-plans/month?year=${year}&month=${Number(monthNum)}`);
  },

  /**
   * Persist the user's planned meals for an entire week.
   * Overwrites any existing plan for days included in the payload.
   */
  async saveWeekPlan(data: SaveWeekPlanData): Promise<void> {
    return post<void>('/meal-plans/week', {
      week_start_date: data.weekStartDate,
      plan_data:       data.plan,
    });
  },

  /**
   * Log a meal that was actually eaten.
   * Returns the newly created MealLog record.
   */
  async logMeal(data: LogMealData): Promise<MealLog> {
    return post<MealLog>('/meal-plans/log', {
      recipe_id:       data.recipeId,
      meal_type:       data.mealType,
      servings_eaten:  data.servingsEaten,
      logged_at:       data.loggedAt ?? new Date().toISOString(),
    });
  },

  /**
   * Upload a photo for an existing meal log.
   * Converts imageUri to multipart FormData.
   *
   * @param mealLogId  ID of the MealLog to attach the photo to.
   * @param imageUri   Local file URI from the camera / image picker.
   * @returns          Updated MealLog with photoUrl filled in.
   */
  async uploadMealPhoto(mealLogId: string, imageUri: string): Promise<MealLog> {
    const form = new FormData();
    form.append('photo', {
      uri:  imageUri,
      name: 'meal_photo.jpg',
      type: 'image/jpeg',
    } as any);

    return postForm<MealLog>(`/meal-plans/log/${mealLogId}/photo`, form);
  },

  /**
   * Cooking/nutrition analytics for a time window.
   * @param period  'week' | 'month' | 'all'  (defaults to 'month' on server)
   */
  async getAnalysis(period?: 'week' | 'month' | 'all'): Promise<MealPlanAnalysis> {
    const qs = period ? `?period=${period}` : '';
    return get<MealPlanAnalysis>(`/meal-plans/analysis${qs}`);
  },
};
