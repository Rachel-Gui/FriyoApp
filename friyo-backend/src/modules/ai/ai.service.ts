import { Injectable, Logger, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository }       from 'typeorm';
import { ConfigService }    from '@nestjs/config';
import OpenAI               from 'openai';
import Redis                from 'ioredis';

import { FridgeItem }   from '../../database/entities/fridge-item.entity';
import { UserProfile }  from '../../database/entities/user-profile.entity';
import { MealLog }      from '../../database/entities/meal-log.entity';

const INSIGHTS_TTL = 3600; // 1 h

export interface AIRecipeSuggestion {
  recipe_id: string;
  title: string;
  emoji: string;
  cooking_time: string;
  difficulty: string;
  calories: number;
  reason: string;
  used_ingredients: string[];
  missing_ingredients: string[];
  substitution?: string;
  steps_preview: string[];
  cuisine?: string;
}

export interface AIChatResponse {
  message: string;
  suggested_recipes: AIRecipeSuggestion[];
  quick_actions: string[];
}

interface GeminiGenerateContentResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
  error?: {
    message?: string;
  };
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly openai: OpenAI | null;
  private readonly hasOpenAI: boolean;
  private readonly geminiApiKey: string;
  private readonly geminiModel: string;

  constructor(
    @InjectRepository(FridgeItem)
    private readonly fridgeRepo: Repository<FridgeItem>,

    @InjectRepository(UserProfile)
    private readonly profileRepo: Repository<UserProfile>,

    @InjectRepository(MealLog)
    private readonly mealLogRepo: Repository<MealLog>,

    @Inject('REDIS_CLIENT')
    private readonly redis: Redis,

    private readonly config: ConfigService,
  ) {
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    this.hasOpenAI = !!apiKey && !apiKey.startsWith('sk-your');
    this.openai = this.hasOpenAI ? new OpenAI({ apiKey }) : null;
    this.geminiApiKey = this.config.get<string>('GEMINI_API_KEY') ?? '';
    this.geminiModel = this.config.get<string>('GEMINI_MODEL') ?? 'gemini-2.5-flash';
  }

  // ── POST /ai/chat ────────────────────────────────────────────────────────────

  async chat(userId: string, message: string, conversationId?: string): Promise<AIChatResponse> {
    const [fridgeItems, profile] = await Promise.all([
      this.fridgeRepo.find({ where: { userId }, relations: ['ingredient'], take: 20 }),
      this.profileRepo.findOne({ where: { userId } }),
    ]);

    const fridgeSummary = fridgeItems
      .map(fi => `${fi.customName ?? fi.ingredient?.name ?? 'Unknown'} (${fi.quantity} ${fi.unit ?? ''})`)
      .join(', ') || 'fridge is empty';

    const systemPrompt = this.buildSystemPrompt(fridgeSummary, profile);

    if (this.geminiApiKey) {
      try {
        return await this.callGeminiChef(message, fridgeItems, fridgeSummary, profile, conversationId);
      } catch (err) {
        this.logger.warn(`Gemini chat failed: ${(err as Error).message}`);
      }
    }

    if (this.openai) {
      try {
        const completion = await this.openai.chat.completions.create({
          model:    this.config.get<string>('OPENAI_MODEL') ?? 'gpt-4o',
          messages: [
            { role: 'system',  content: systemPrompt },
            { role: 'user',    content: message },
          ],
          max_tokens: 600,
          temperature: 0.7,
        });
        const reply = completion.choices[0]?.message?.content ?? 'I had trouble thinking of something. Try again!';
        return {
          message: reply,
          suggested_recipes: this.buildRecipeSuggestions(message, fridgeItems, profile),
          quick_actions: this.defaultActions(),
        };
      } catch (err) {
        this.logger.warn(`OpenAI chat failed: ${(err as Error).message}`);
      }
    }

    // Fallback: rule-based response
    return {
      message: this.buildFallbackReply(message, fridgeSummary, profile),
      suggested_recipes: this.buildRecipeSuggestions(message, fridgeItems, profile),
      quick_actions: this.defaultActions(),
    };
  }

  // ── POST /ai/suggest ─────────────────────────────────────────────────────────

  async quickSuggest(userId: string, context?: string) {
    const fridgeItems = await this.fridgeRepo.find({
      where: { userId }, relations: ['ingredient'], take: 10,
    });
    const names = fridgeItems
      .map(fi => fi.customName ?? fi.ingredient?.name ?? '')
      .filter(Boolean);

    const hint = context ? ` The user wants: ${context}.` : '';
    const msg  = names.length
      ? `I have ${names.slice(0, 5).join(', ')} in my fridge. What can I make?${hint}`
      : `Suggest a simple meal to cook tonight.${hint}`;

    return this.chat(userId, msg);
  }

  // ── GET /ai/insights ─────────────────────────────────────────────────────────

  async getInsights(userId: string, limit = 3) {
    const cacheKey = `ai:insights:${userId}`;
    const cached   = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const [fridgeItems, recentLogs] = await Promise.all([
      this.fridgeRepo.find({ where: { userId }, order: { expiryDate: 'ASC' }, take: 30 }),
      this.mealLogRepo.find({ where: { userId }, order: { loggedAt: 'DESC' }, take: 10 }),
    ]);

    const insights = this.generateInsights(fridgeItems, recentLogs, limit);

    await this.redis.setex(cacheKey, INSIGHTS_TTL, JSON.stringify(insights));
    return insights;
  }

  // ── POST /ai/analyze-nutrition ────────────────────────────────────────────────

  async analyzeNutrition(
    description: string,
    ingredients?: Array<{ name: string; quantity: number; unit: string }>,
  ) {
    if (this.openai) {
      try {
        const prompt = ingredients?.length
          ? `Analyze the nutrition for this meal with these ingredients: ${JSON.stringify(ingredients)}. Description: ${description}`
          : `Analyze the nutrition for: "${description}"`;

        const completion = await this.openai.chat.completions.create({
          model:    'gpt-4o',
          messages: [
            {
              role: 'system',
              content: 'You are a nutrition expert. Return ONLY a JSON object with: calories (number), protein (g), carbs (g), fat (g), fiber (g), health_score (0-100), suggestions (string[]).',
            },
            { role: 'user', content: prompt },
          ],
          max_tokens: 300,
          response_format: { type: 'json_object' },
        });

        const raw = completion.choices[0]?.message?.content ?? '{}';
        return JSON.parse(raw);
      } catch (err) {
        this.logger.warn(`OpenAI nutrition analysis failed: ${(err as Error).message}`);
      }
    }

    // Fallback estimate
    return this.estimateNutrition(description);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────

  private buildSystemPrompt(fridgeSummary: string, profile: UserProfile | null): string {
    const diet    = profile?.dietType ?? 'omnivore';
    const skill   = profile?.cookingSkill ?? 'beginner';
    const goals   = profile?.healthGoals?.join(', ') || 'none specified';
    const allergy = profile?.allergies?.join(', ')   || 'none';

    return [
      'You are Friyo, a friendly AI chef assistant.',
      `User fridge: ${fridgeSummary}.`,
      `Diet: ${diet}, skill: ${skill}, health goals: ${goals}, allergies: ${allergy}.`,
      'Give practical, concise recipe suggestions. Keep replies under 200 words.',
      'When the user asks what to cook, generate concrete recipes with short steps.',
      'Format ingredient lists clearly. Be warm and encouraging.',
    ].join(' ');
  }

  private async callGeminiChef(
    message: string,
    fridgeItems: FridgeItem[],
    fridgeSummary: string,
    profile: UserProfile | null,
    conversationId?: string,
  ): Promise<AIChatResponse> {
    const diet = profile?.dietType ?? 'omnivore';
    const skill = profile?.cookingSkill ?? 'beginner';
    const goals = profile?.healthGoals?.join(', ') || 'none specified';
    const allergies = profile?.allergies?.join(', ') || 'none';

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.geminiModel}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': this.geminiApiKey,
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [
              {
                text: [
                  'You are Friyo, a friendly AI chef and meal planning assistant.',
                  'Return ONLY valid JSON. No markdown, no code fences.',
                  'The JSON must match this shape:',
                  '{"message":"short helpful reply","suggested_recipes":[{"recipe_id":"ai-unique-id","title":"Recipe title","emoji":"🍳","cooking_time":"20 min","difficulty":"easy","calories":420,"reason":"why this fits","used_ingredients":["item"],"missing_ingredients":["item"],"substitution":"optional hint","steps_preview":["step 1","step 2","step 3"],"cuisine":"American"}],"quick_actions":["action 1","action 2"]}',
                  'If the user is only chatting, suggested_recipes can be [].',
                  'If the user asks what to cook, recipes, meal ideas, shopping, dinner, lunch, breakfast, healthy food, or quick meals, include 2 or 3 practical suggested_recipes.',
                  'Use the fridge items first. Missing ingredients should be common and optional when possible.',
                  'Keep message under 90 words and each recipe to 3 concise steps.',
                ].join(' '),
              },
            ],
          },
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: [
                    `Conversation ID: ${conversationId ?? 'new'}.`,
                    `User message: ${message}`,
                    `Fridge: ${fridgeSummary}.`,
                    `Diet: ${diet}. Cooking skill: ${skill}. Goals: ${goals}. Allergies: ${allergies}.`,
                  ].join('\n'),
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.65,
            maxOutputTokens: 1800,
            responseMimeType: 'application/json',
          },
        }),
      },
    );

    const data = await response.json() as GeminiGenerateContentResponse;
    if (!response.ok) {
      throw new Error(data.error?.message ?? `Gemini request failed with status ${response.status}`);
    }

    const raw = data.candidates?.[0]?.content?.parts
      ?.map(part => part.text ?? '')
      .join('')
      .trim() ?? '{}';

    const parsed = this.parseJsonObject(raw);
    return this.normalizeAiResponse(parsed, message, fridgeItems, profile);
  }

  private parseJsonObject(raw: string): Record<string, unknown> {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : {};
    } catch {
      this.logger.warn('AI provider returned non-JSON response, attempting extraction');
    }

    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return {};

    try {
      const parsed = JSON.parse(match[0]);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : {};
    } catch {
      return {};
    }
  }

  private normalizeAiResponse(
    parsed: Record<string, unknown>,
    userMessage: string,
    fridgeItems: FridgeItem[],
    profile: UserProfile | null,
  ): AIChatResponse {
    const fallbackRecipes = this.buildRecipeSuggestions(userMessage, fridgeItems, profile);
    const recipesRaw = Array.isArray(parsed.suggested_recipes)
      ? parsed.suggested_recipes
      : Array.isArray(parsed.suggestedRecipes)
        ? parsed.suggestedRecipes
        : [];

    const recipes = recipesRaw
      .map((item, index) => this.normalizeRecipeSuggestion(item, index))
      .filter((item): item is AIRecipeSuggestion => Boolean(item));

    const shouldSuggestRecipe = this.shouldSuggestRecipes(userMessage);
    const finalRecipes = recipes.length ? recipes : shouldSuggestRecipe ? fallbackRecipes : [];

    const actionsRaw = Array.isArray(parsed.quick_actions)
      ? parsed.quick_actions
      : Array.isArray(parsed.quickActions)
        ? parsed.quickActions
        : [];

    const quickActions = actionsRaw
      .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      .slice(0, 4);

    return {
      message: typeof parsed.message === 'string' && parsed.message.trim()
        ? parsed.message.trim()
        : this.buildFallbackReply(userMessage, this.summarizeFridge(fridgeItems), profile),
      suggested_recipes: finalRecipes,
      quick_actions: quickActions.length ? quickActions : this.defaultActions(),
    };
  }

  private normalizeRecipeSuggestion(raw: unknown, index: number): AIRecipeSuggestion | null {
    if (!raw || typeof raw !== 'object') return null;
    const item = raw as Record<string, unknown>;
    const getString = (snake: string, camel: string, fallback: string) => {
      const value = item[snake] ?? item[camel];
      return typeof value === 'string' && value.trim() ? value.trim() : fallback;
    };
    const getArray = (snake: string, camel: string) => {
      const value = item[snake] ?? item[camel];
      return Array.isArray(value)
        ? value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0).slice(0, 6)
        : [];
    };
    const calories = Number(item.calories);

    return {
      recipe_id: getString('recipe_id', 'recipeId', `ai-${Date.now()}-${index}`),
      title: getString('title', 'title', `Quick Meal ${index + 1}`),
      emoji: getString('emoji', 'emoji', ['🍳', '🥗', '🍲'][index % 3]),
      cooking_time: getString('cooking_time', 'cookingTime', '20 min'),
      difficulty: getString('difficulty', 'difficulty', 'easy').toLowerCase(),
      calories: Number.isFinite(calories) ? Math.round(calories) : 420,
      reason: getString('reason', 'reason', 'A practical option based on your current fridge.'),
      used_ingredients: getArray('used_ingredients', 'usedIngredients'),
      missing_ingredients: getArray('missing_ingredients', 'missingIngredients'),
      substitution: getString('substitution', 'substitution', ''),
      steps_preview: getArray('steps_preview', 'stepsPreview').length
        ? getArray('steps_preview', 'stepsPreview').slice(0, 4)
        : ['Prep the ingredients.', 'Cook everything until tender.', 'Season and serve warm.'],
      cuisine: getString('cuisine', 'cuisine', 'Home cooking'),
    };
  }

  private summarizeFridge(fridgeItems: FridgeItem[]): string {
    return fridgeItems
      .map(fi => `${fi.customName ?? fi.ingredient?.name ?? 'Unknown'} (${fi.quantity} ${fi.unit ?? ''})`)
      .join(', ') || 'fridge is empty';
  }

  private shouldSuggestRecipes(message: string): boolean {
    return /cook|recipe|meal|dinner|lunch|breakfast|eat|hungry|quick|healthy|plan|shopping|make|菜|饭|吃|食谱/i.test(message);
  }

  private buildRecipeSuggestions(
    message: string,
    fridgeItems: FridgeItem[],
    profile: UserProfile | null,
  ): AIRecipeSuggestion[] {
    if (!this.shouldSuggestRecipes(message)) return [];

    const names = fridgeItems
      .map(fi => fi.customName ?? fi.ingredient?.name ?? '')
      .filter(Boolean)
      .slice(0, 8);
    const pantry = names.length ? names : ['eggs', 'rice', 'mixed vegetables'];
    const [first, second, third] = pantry;
    const skill = profile?.cookingSkill ?? 'easy';

    return [
      {
        recipe_id: 'ai-fridge-bowl',
        title: `${this.titleCase(first)} Rice Bowl`,
        emoji: '🍚',
        cooking_time: '20 min',
        difficulty: skill === 'advanced' ? 'medium' : 'easy',
        calories: 480,
        reason: names.length
          ? `Uses ${pantry.slice(0, 3).join(', ')} from your fridge with a simple base.`
          : 'A reliable pantry meal when your fridge is empty.',
        used_ingredients: pantry.slice(0, 3),
        missing_ingredients: ['rice or noodles', 'soy sauce'],
        substitution: 'Use pasta, quinoa, or toast if you do not have rice.',
        steps_preview: [
          'Cook rice or warm a grain base.',
          `Saute ${pantry.slice(0, 2).join(' and ')} with oil, salt, and pepper.`,
          'Add sauce, top the bowl, and serve warm.',
        ],
        cuisine: 'Asian-inspired',
      },
      {
        recipe_id: 'ai-fast-scramble',
        title: `${this.titleCase(second ?? first)} Egg Scramble`,
        emoji: '🍳',
        cooking_time: '12 min',
        difficulty: 'easy',
        calories: 360,
        reason: 'Fast, flexible, and good for using small leftover ingredients.',
        used_ingredients: pantry.slice(0, 4),
        missing_ingredients: ['eggs'],
        substitution: 'Use tofu instead of eggs for a vegetarian protein option.',
        steps_preview: [
          'Chop the fridge ingredients into small pieces.',
          'Scramble eggs in a pan and fold in the ingredients.',
          'Season with salt, pepper, and any herbs you have.',
        ],
        cuisine: 'American',
      },
      {
        recipe_id: 'ai-soup-stew',
        title: `${this.titleCase(third ?? first)} Quick Soup`,
        emoji: '🍲',
        cooking_time: '25 min',
        difficulty: 'easy',
        calories: 410,
        reason: 'Good when you want something warm and forgiving with flexible ingredients.',
        used_ingredients: pantry.slice(0, 5),
        missing_ingredients: ['broth'],
        substitution: 'Use water plus salt, garlic, and a splash of soy sauce if you do not have broth.',
        steps_preview: [
          'Simmer broth with chopped ingredients.',
          'Add noodles, rice, or beans if you want it more filling.',
          'Taste, season, and finish with herbs or lemon.',
        ],
        cuisine: 'Comfort',
      },
    ];
  }

  private titleCase(value: string | undefined): string {
    const clean = value?.trim() || 'Simple';
    return clean
      .split(/\s+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  private buildFallbackReply(
    message: string,
    fridge: string,
    profile: UserProfile | null,
  ): string {
    const lower = message.toLowerCase();

    if (lower.includes('expir') || lower.includes('use up')) {
      return `Based on your fridge (${fridge}), use perishables first! Try a stir-fry or omelette with whatever's closest to expiry.`;
    }
    if (lower.includes('quick') || lower.includes('fast') || lower.includes('15 min')) {
      return `For a quick meal with what you have (${fridge}), I'd suggest a simple stir-fry, scrambled eggs, or a grain bowl — all under 15 minutes!`;
    }
    if (lower.includes('healthy') || lower.includes('diet') || lower.includes('low cal')) {
      return `For a healthy option with your fridge contents (${fridge}), try a veggie omelette or a simple salad with lean protein. Keep it colourful!`;
    }
    if (lower.includes('plan') || lower.includes('week')) {
      return `I can help plan your week! Based on your fridge (${fridge}), start with perishables early in the week and use pantry staples towards the end.`;
    }
    return `Great question! With your current fridge (${fridge}), there are lots of options. For a quick and easy meal, try combining your proteins and veggies in a simple stir-fry or scramble. What kind of cuisine are you in the mood for?`;
  }

  private generateInsights(fridgeItems: FridgeItem[], logs: MealLog[], limit: number) {
    const insights: { title: string; description: string; type: string }[] = [];

    // Expiry alerts
    const expiring = fridgeItems.filter(fi => {
      if (!fi.expiryDate) return false;
      const days = Math.ceil((new Date(fi.expiryDate).getTime() - Date.now()) / 86_400_000);
      return days <= 2 && days >= 0;
    });
    if (expiring.length) {
      const names = expiring.map(fi => fi.customName ?? 'an item').slice(0, 3).join(', ');
      insights.push({
        title:       '⚠️ Use soon',
        description: `${names} expire within 2 days — let's cook something delicious before it's too late!`,
        type:        'expiry_alert',
      });
    }

    // Cooking streak
    if (logs.length >= 3) {
      insights.push({
        title:       '🔥 On a roll!',
        description: `You've logged ${logs.length} meals recently. Keep up the great cooking habit!`,
        type:        'streak',
      });
    }

    // Fridge stocked
    if (fridgeItems.length >= 5) {
      insights.push({
        title:       '🧊 Well stocked',
        description: `You have ${fridgeItems.length} items in your fridge. I can suggest ${Math.min(fridgeItems.length * 2, 20)} different recipes!`,
        type:        'fridge_tip',
      });
    } else if (fridgeItems.length === 0) {
      insights.push({
        title:       '🛒 Time to restock',
        description: 'Your fridge is empty. Scan or add items to get personalised recipe recommendations.',
        type:        'restock',
      });
    }

    // Nutrition tip (generic)
    insights.push({
      title:       '💡 Nutrition tip',
      description: 'Aim for half your plate to be vegetables. Colourful veggies provide the widest range of nutrients.',
      type:        'nutrition_tip',
    });

    return insights.slice(0, limit);
  }

  private estimateNutrition(description: string) {
    // Very rough keyword-based estimate as fallback
    const lower = description.toLowerCase();
    const isHeavy  = lower.includes('fried') || lower.includes('cream') || lower.includes('burger');
    const isLight  = lower.includes('salad') || lower.includes('soup')  || lower.includes('smoothie');
    const base     = isHeavy ? 650 : isLight ? 280 : 450;

    return {
      calories:       base,
      protein:        Math.round(base * 0.15 / 4),
      carbs:          Math.round(base * 0.50 / 4),
      fat:            Math.round(base * 0.35 / 9),
      fiber:          Math.round(base * 0.03 / 4),
      health_score:   isLight ? 78 : isHeavy ? 42 : 62,
      suggestions:    [
        'Add more vegetables to boost fibre and vitamins.',
        'Choose lean proteins like chicken, fish, or legumes.',
        'Stay hydrated — drink water with your meal.',
      ],
    };
  }

  private defaultActions() {
    return [
      'What can I cook tonight?',
      'Use expiring items',
      'Plan my meals',
      'Give me a healthy idea',
    ];
  }
}
