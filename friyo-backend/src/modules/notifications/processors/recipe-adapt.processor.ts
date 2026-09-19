import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Process, Processor, OnQueueFailed } from '@nestjs/bull';
import { Job } from 'bull';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

import { Recipe }            from '../../../database/entities/recipe.entity';
import { RecipeIngredient }  from '../../../database/entities/recipe-ingredient.entity';
import { RecipeStep }        from '../../../database/entities/recipe-step.entity';
import { RecipeAdaptation }  from '../../../database/entities/recipe-adaptation.entity';
import { FridgeItem }        from '../../../database/entities/fridge-item.entity';
import { Ingredient }        from '../../../database/entities/ingredient.entity';

// ── Job payload ─────────────────────────────────────────────────────────────

export interface RecipeAdaptJobData {
  /** Adaptation record that was pre-created with the synchronous ingredient list */
  adaptationId: string;
  recipeId:     string;
  userId:       string;
  /**
   * Pre-computed adapted ingredients from the sync pass.
   * The AI will refine/replace these when >30% required ingredients are missing.
   */
  adaptedIngredients: Record<string, unknown>[];
  /** Serialised fridge items (id, ingredientId, customName, quantity, unit, expiryDate) */
  fridgeSnapshot: Array<{
    id:           string;
    ingredientId: string | null;
    customName:   string | null;
    quantity:     number;
    unit:         string | null;
    expiryDate:   string | null;
  }>;
}

// ── Processor ──────────────────────────────────────────────────────────────

@Processor('recipe.adapt')
export class RecipeAdaptProcessor {
  private readonly logger = new Logger(RecipeAdaptProcessor.name);
  private readonly openai: OpenAI;

  constructor(
    @InjectRepository(Recipe)
    private readonly recipeRepo: Repository<Recipe>,

    @InjectRepository(RecipeIngredient)
    private readonly ingredientLineRepo: Repository<RecipeIngredient>,

    @InjectRepository(RecipeStep)
    private readonly stepRepo: Repository<RecipeStep>,

    @InjectRepository(RecipeAdaptation)
    private readonly adaptationRepo: Repository<RecipeAdaptation>,

    @InjectRepository(FridgeItem)
    private readonly fridgeItemRepo: Repository<FridgeItem>,

    @InjectRepository(Ingredient)
    private readonly ingredientRepo: Repository<Ingredient>,

    private readonly config: ConfigService,
  ) {
    this.openai = new OpenAI({
      apiKey: this.config.get<string>('OPENAI_API_KEY') ?? '',
    });
  }

  // ── Main handler ──────────────────────────────────────────────────────────

  @Process('adapt')
  async handleAdapt(job: Job<RecipeAdaptJobData>): Promise<void> {
    const { adaptationId, recipeId, userId, adaptedIngredients, fridgeSnapshot } = job.data;

    this.logger.log(`Adapting recipe ${recipeId} for user ${userId} (adaptation=${adaptationId})`);

    // Verify the adaptation record still exists (may have been deleted by user)
    const adaptation = await this.adaptationRepo.findOne({ where: { id: adaptationId } });
    if (!adaptation) {
      this.logger.warn(`Adaptation ${adaptationId} no longer exists — skipping`);
      return;
    }

    // Load full recipe with steps
    const recipe = await this.recipeRepo.findOne({
      where:     { id: recipeId },
      relations: ['ingredients', 'ingredients.ingredient', 'steps'],
    });
    if (!recipe) {
      this.logger.warn(`Recipe ${recipeId} not found — skipping`);
      return;
    }

    try {
      const aiResult = await this.callAiAdaptation(recipe, fridgeSnapshot, adaptedIngredients);

      // Prioritise steps that use expiring items
      const prioritisedSteps = this.prioritiseExpiringSteps(
        aiResult.adapted_steps ?? this.defaultSteps(recipe.steps),
        fridgeSnapshot,
      );

      await this.adaptationRepo.update(adaptationId, {
        adaptedIngredients: aiResult.adapted_ingredients ?? adaptedIngredients,
        adaptedSteps:       prioritisedSteps,
        adaptationReason:   aiResult.reason ?? 'AI-adapted based on available fridge ingredients.',
        aiGenerated:        true,
        notes:              aiResult.notes ?? null,
      } as any);

      this.logger.log(`Recipe ${recipeId} AI adaptation saved (adaptation=${adaptationId})`);
    } catch (err) {
      this.logger.error(`AI adaptation failed for recipe ${recipeId}: ${(err as Error).message}`);
      // Leave the synchronous (pre-AI) version in the adaptation record — don't fail the record
      await this.adaptationRepo.update(adaptationId, {
        adaptationReason: 'Partial adaptation — AI step failed. Missing ingredients marked as need_to_buy.',
        notes: (err as Error).message,
      } as any);
    }
  }

  // ── OpenAI call ───────────────────────────────────────────────────────────

  private async callAiAdaptation(
    recipe: Recipe,
    fridgeSnapshot: RecipeAdaptJobData['fridgeSnapshot'],
    currentIngredients: Record<string, unknown>[],
  ): Promise<{
    adapted_ingredients?: Record<string, unknown>[];
    adapted_steps?:       Record<string, unknown>[];
    reason?:              string;
    notes?:               string;
  }> {
    const fridgeList = fridgeSnapshot
      .map((fi) => `- ${fi.customName ?? fi.ingredientId ?? 'Unknown'} × ${fi.quantity} ${fi.unit ?? ''}${fi.expiryDate ? ` (expires ${fi.expiryDate})` : ''}`)
      .join('\n');

    const missingIngredients = currentIngredients
      .filter((i) => i['status'] === 'need_to_buy')
      .map((i) => i['display_name'])
      .join(', ');

    const prompt = `You are a culinary expert. Adapt the recipe "${recipe.title}" for a user who is missing: ${missingIngredients}.

User's fridge contents:
${fridgeList || 'Empty'}

Current ingredient list (with statuses):
${JSON.stringify(currentIngredients, null, 2)}

Recipe steps:
${(recipe.steps ?? []).map((s) => `${s.stepNumber}. ${s.description}`).join('\n')}

Provide a JSON response with:
- adapted_ingredients: updated ingredient list (same structure as input, update statuses to "substituted" where you found alternatives)
- adapted_steps: rewritten steps that work with available ingredients
- reason: one sentence explaining the main adaptations made
- notes: any important cooking tips for this specific adaptation

Return ONLY valid JSON.`;

    const response = await this.openai.chat.completions.create({
      model:           'gpt-4o',
      messages:        [{ role: 'user', content: prompt }],
      max_tokens:      2000,
      response_format: { type: 'json_object' },
    });

    const raw = response.choices[0]?.message?.content ?? '{}';

    try {
      return JSON.parse(raw) as {
        adapted_ingredients?: Record<string, unknown>[];
        adapted_steps?:       Record<string, unknown>[];
        reason?:              string;
        notes?:               string;
      };
    } catch {
      // Try to extract JSON object from wrapped output
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('OpenAI returned invalid JSON for recipe adaptation');
      return JSON.parse(match[0]);
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  /**
   * Bubble steps that use expiring ingredients toward the top
   * so users consume about-to-expire items first.
   */
  private prioritiseExpiringSteps(
    steps: Record<string, unknown>[],
    fridge: RecipeAdaptJobData['fridgeSnapshot'],
  ): Record<string, unknown>[] {
    const expiringIds = new Set(
      fridge
        .filter((fi) => {
          if (!fi.expiryDate) return false;
          const daysLeft = Math.ceil(
            (new Date(fi.expiryDate).getTime() - Date.now()) / 86_400_000,
          );
          return daysLeft <= 2;
        })
        .map((fi) => fi.ingredientId)
        .filter(Boolean),
    );

    if (expiringIds.size === 0) return steps;

    return [...steps].sort((a, b) => {
      const usesExpiring = (s: Record<string, unknown>) => {
        const desc = String(s['description'] ?? s['instruction'] ?? '').toLowerCase();
        for (const id of expiringIds) {
          if (id && desc.includes(String(id))) return true;
        }
        return false;
      };
      return (usesExpiring(b) ? 1 : 0) - (usesExpiring(a) ? 1 : 0);
    });
  }

  private defaultSteps(steps: RecipeStep[]): Record<string, unknown>[] {
    return steps.map((s) => ({
      step_number:  s.stepNumber,
      description:  s.description,
      duration_min: s.durationMin,
      step_type:    s.stepType,
      tips:         s.tips,
    }));
  }

  // ── Queue hooks ──────────────────────────────────────────────────────────

  @OnQueueFailed()
  onFailed(job: Job<RecipeAdaptJobData>, err: Error): void {
    this.logger.error(
      `recipe.adapt job ${job.id} (recipe=${job.data.recipeId}) ` +
      `failed after all retries: ${err.message}`,
    );
  }
}
