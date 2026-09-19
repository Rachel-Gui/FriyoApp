// ─────────────────────────────────────────────────────────────────────────────
// services/types.ts  —  All TypeScript interfaces for Friyo API responses
// Backend returns snake_case; api.ts converts to camelCase automatically.
// ─────────────────────────────────────────────────────────────────────────────

// ── Shared ────────────────────────────────────────────────────────────────────
export interface PaginatedResponse<T> {
  data:    T[];
  items?:  T[];
  total:   number;
  page:    number;
  limit:   number;
  hasMore: boolean;
  pages?:  number;
}

// ── Auth ──────────────────────────────────────────────────────────────────────
export interface AuthResponse {
  accessToken:  string;
  refreshToken: string;
  user:         AuthUser;
}

export interface AuthUser {
  id:                   string;
  name:                 string;
  email:                string;
  avatarUrl:            string;
  onboardingCompleted:  boolean;
}

// ── User / Profile ────────────────────────────────────────────────────────────
export interface UserProfile {
  dietType:             string;
  allergies:            string[];
  cookingSkill:         string;
  cookingTools:         string[];
  householdSize:        number;
  healthGoals:          string[];
  preferredCuisines:    string[];
  weeklyCookingDays:    number;
  onboardingCompletedAt: string | null;
}

// ── Fridge ────────────────────────────────────────────────────────────────────
export interface FridgeItem {
  id:             string;
  customName:     string;
  quantity:       number;
  unit:           string;
  storageType:    'fridge' | 'freezer' | 'pantry';
  expiryDate:     string | null;
  freshnessScore: number;
  daysUntilExpiry: number | null;
  freshnessLabel: 'fresh' | 'good' | 'expiring_soon' | 'expired';
  ingredient:     Ingredient | null;
}

export interface Ingredient {
  id:             string;
  name:           string;
  category:       string;
  caloriesPer100g: number;
  unit:           string;
  tags:           string[];
}

export interface ScanSession {
  sessionId: string;
  status:    'processing' | 'completed' | 'failed';
  items?:    ScannedItem[];
}

export interface ScannedItem {
  ingredientId: string | null;
  customName:   string;
  quantity:     number;
  unit:         string;
  storageType:  'fridge' | 'freezer' | 'pantry';
  expiryDate:   string | null;
}

// ── Recipe ────────────────────────────────────────────────────────────────────
export interface Recipe {
  id:                 string;
  title:              string;
  description:        string;
  cuisineType:        string;
  mealType:           string;
  difficulty:         string;
  prepTimeMin:        number;
  cookTimeMin:        number;
  servings:           number;
  caloriesPerServing: number;
  tags:               string[];
  dietTypes:          string[];
  requiredTools:      string[];
  imageUrl:           string;
  ingredients:        RecipeIngredient[];
  steps:              RecipeStep[];
}

export interface RecipeIngredient {
  id:             string;
  ingredientName: string;
  quantity:       number;
  unit:           string;
  isOptional:     boolean;
  substitutes:    string[];
}

export interface RecipeStep {
  id:          string;
  stepNumber:  number;
  description: string;
  durationMin: number;
  stepType:    'hands_on' | 'hands_off';
  tips:        string | null;
}

export interface RecipeForCooking {
  recipe:          Recipe;
  adaptation:      RecipeAdaptation | null;
  fridgeStatus:    FridgeIngredientStatus[];
  cookingTimeline: CookingTimeline;
}

export interface FridgeIngredientStatus {
  ingredientName:    string;
  inFridge:          boolean;
  quantityAvailable: number;
  quantityNeeded:    number;
  unit:              string;
}

export interface CookingTimeline {
  handsOn:  TimelineStep[];
  handsOff: TimelineStep[];
}

export interface TimelineStep {
  step:               RecipeStep;
  startMin:           number;
  durationMin:        number;
  whatToDoMeanwhile:  string | null;
}

export interface RecipeAdaptation {
  id:                string;
  originalRecipeId:  string;
  adaptedIngredients: RecipeIngredient[];
  adaptedSteps:      RecipeStep[];
}

// ── Meal Plan ─────────────────────────────────────────────────────────────────
export interface MealLog {
  id:            string;
  recipeId:      string;
  mealType:      string;
  servingsEaten: number;
  photoUrl:      string | null;
  loggedAt:      string;
  caloriesTotal: number;
  recipe?:       Recipe | null;
}

export interface DayPlan {
  breakfast: MealLog | null;
  lunch:     MealLog | null;
  dinner:    MealLog | null;
  snacks:    MealLog[];
  planned?: {
    breakfast?: string;
    lunch?:     string;
    dinner?:    string;
    snacks?:    string[];
  } | null;
}

export type WeekPlan = Record<string, DayPlan>;

export interface MealPlanAnalysis {
  totalMealsCooked:    number;
  avgCaloriesPerDay:   number;
  mostCookedCuisine:   string;
  streak:              number;
  fridgeUtilizationRate: number;
  nutritionBreakdown: {
    protein: number;
    carbs:   number;
    fat:     number;
  };
}

// ── Community ─────────────────────────────────────────────────────────────────
export interface CommunityPost {
  id:               string;
  user:             PublicUser;
  recipe:           Recipe | null;
  caption:          string;
  photoUrls:        string[];
  likesCount:       number;
  commentsCount:    number;
  hasLiked:         boolean;
  createdAt:        string;
  moderationStatus: string;
}

export interface CommunityFeedResponse {
  items: CommunityPost[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface MonthMealHistory {
  year: number;
  month: number;
  logs: MealLog[];
  stats: {
    totalMeals: number;
    totalCalories: number;
    avgCaloriesPerDay: number;
    byMealType: Record<string, number>;
  };
}

export interface PublicUser {
  id:        string;
  name:      string;
  avatarUrl: string;
}

export interface PostComment {
  id:              string;
  userId:          string;
  user:            PublicUser;
  content:         string;
  createdAt:       string;
  parentCommentId: string | null;
}

export interface Party {
  id:          string;
  name:        string;
  description: string;
  eventDate:   string;
  inviteCode:  string;
  memberCount: number;
  hostId:      string;
  isActive:    boolean;
}

// ── AI ────────────────────────────────────────────────────────────────────────
export interface AIRecipeSuggestion {
  recipeId:           string;
  title:              string;
  emoji:              string;
  cookingTime:        string;
  difficulty:         string;
  calories:           number;
  reason:             string;
  usedIngredients:    string[];
  missingIngredients: string[];
  substitution?:      string;
  stepsPreview:       string[];
  cuisine?:           string;
}

export interface AIMessage {
  message:          string;
  suggestedRecipes?: AIRecipeSuggestion[];
  quickActions?:    string[];
}

export interface AIInsight {
  title:       string;
  description: string;
  type:        string;
}
