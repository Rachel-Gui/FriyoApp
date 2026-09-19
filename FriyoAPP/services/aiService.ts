import { aiConsentService } from './aiConsentService';
// ─────────────────────────────────────────────────────────────────────────────
// services/aiService.ts
// ─────────────────────────────────────────────────────────────────────────────

import { get, post } from './api';
import type { AIMessage, AIInsight } from './types';

interface NutritionAnalysis {
  calories:      number;
  protein:       number;   // grams
  carbs:         number;   // grams
  fat:           number;   // grams
  fiber:         number;   // grams
  micronutrients: Record<string, number>;
  healthScore:   number;   // 0–100
  suggestions:   string[];
}

export const aiService = {

  /**
   * Send a free-form message to the Friyo AI chef assistant.
   * Returns the AI reply, optionally with suggested recipes and quick actions.
   *
   * @param message        The user's message text.
   * @param conversationId Existing conversation ID to continue a thread;
   *                       omit to start a new one.
   */
  async sendMessage(message: string, conversationId?: string): Promise<AIMessage> {
    if (!(await aiConsentService.requestConsent())) throw new Error('AI processing permission is required');
    return post<AIMessage>('/ai/chat', { message, conversationId });
  },

  /**
   * One-shot "what should I cook?" suggestion based on fridge contents,
   * time of day, and user preferences — no conversation thread needed.
   *
   * @param context  Optional free-text hint (e.g. "something light").
   */
  async getQuickSuggestion(context?: string): Promise<AIMessage> {
    if (!(await aiConsentService.requestConsent())) throw new Error('AI processing permission is required');
    return post<AIMessage>('/ai/suggest', { context });
  },

  /**
   * Fetch personalised AI insights for the dashboard (expiry alerts,
   * nutrition tips, streak encouragement, etc.).
   *
   * @param limit  Max number of insights to return (default decided by server).
   */
  async getInsights(limit?: number): Promise<AIInsight[]> {
    const qs = limit !== undefined ? `?limit=${limit}` : '';
    return get<AIInsight[]>(`/ai/insights${qs}`);
  },

  /**
   * Analyse the nutritional content of a meal described by the user.
   * Accepts either a plain description string or a structured ingredient list.
   *
   * @param description  Free-text meal description (e.g. "2 fried eggs with toast").
   * @param ingredients  Optional structured ingredient array for more precise analysis.
   */
  async analyzeNutrition(
    description: string,
    ingredients?: Array<{ name: string; quantity: number; unit: string }>,
  ): Promise<NutritionAnalysis> {
    if (!(await aiConsentService.requestConsent())) throw new Error('AI processing permission is required');
    return post<NutritionAnalysis>('/ai/analyze-nutrition', { description, ingredients });
  },
};
