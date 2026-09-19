// ── Shared ────────────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

// ── Admin ─────────────────────────────────────────────────────────────────────

export type AdminRole = 'super_admin' | 'ops' | 'content_reviewer';

export interface AdminUser {
  id: string;
  username: string;
  email: string;
  role: AdminRole;
  isActive: boolean;
  permissions: Record<string, boolean>;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface AdminLog {
  id: string;
  adminId: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  beforeData: Record<string, unknown> | null;
  afterData: Record<string, unknown> | null;
  ip: string | null;
  createdAt: string;
}

// ── Users ─────────────────────────────────────────────────────────────────────

export interface UserProfile {
  dietType: string | null;
  allergies: string[];
  healthGoals: string[];
  avatarUrl: string | null;
  bio: string | null;
}

export interface AppUser {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;
  isBanned: boolean;
  isActive: boolean;
  authProvider: string;
  lastActiveAt: string | null;
  createdAt: string;
  profile?: UserProfile;
  stats?: {
    mealCount: number;
    postCount: number;
    fridgeCount: number;
    scanCount: number;
  };
}

// ── Ingredients ───────────────────────────────────────────────────────────────

export type IngredientCategory = 'fresh' | 'freeze' | 'pantry' | 'condiment';

export interface Ingredient {
  id: string;
  name: string;
  nameZh: string | null;
  category: IngredientCategory;
  unit: string | null;
  caloriesPer100g: number | null;
  defaultShelfDays: number | null;
  aliases: string[] | null;
  tags: string[] | null;
  imageUrl: string | null;
  createdByAdmin: boolean;
  createdAt: string;
  updatedAt: string;
}

// ── Recipes ───────────────────────────────────────────────────────────────────

export type RecipeStatus       = 'draft' | 'published' | 'archived';
export type RecipeReviewStatus = 'pending' | 'approved' | 'rejected';
export type RecipeDifficulty   = 'easy' | 'medium' | 'hard';
export type RecipeMealType     = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface RecipeIngredient {
  id: string;
  ingredientId: string;
  name: string;
  quantity: number;
  unit: string;
  isOptional: boolean;
}

export interface RecipeStep {
  id: string;
  stepNumber: number;
  instruction: string;
  durationMin: number | null;
  stepType: 'hands_on' | 'hands_off';
  imageUrl: string | null;
}

export interface Recipe {
  id: string;
  title: string;
  titleZh: string | null;
  description: string | null;
  cuisineType: string | null;
  mealType: RecipeMealType | null;
  difficulty: RecipeDifficulty;
  status: RecipeStatus;
  reviewStatus: RecipeReviewStatus;
  prepTimeMin: number | null;
  cookTimeMin: number | null;
  servings: number;
  caloriesPerServing: number | null;
  coverImageUrl: string | null;
  dietTypes: string[];
  authorId: string | null;
  approverId: string | null;
  createdAt: string;
  updatedAt: string;
  author?: { id: string; name: string; email: string };
  ingredients?: RecipeIngredient[];
  steps?: RecipeStep[];
}

// ── Community ─────────────────────────────────────────────────────────────────

export type ModerationStatus = 'pending' | 'approved' | 'flagged' | 'removed';
export type ReportStatus     = 'pending' | 'resolved' | 'dismissed';
export type ContentType      = 'post' | 'comment' | 'user';

export interface CommunityPost {
  id: string;
  userId: string;
  recipeId: string | null;
  caption: string | null;
  photoUrls: string[];
  moderationStatus: ModerationStatus;
  isHidden: boolean;
  likesCount: number;
  commentsCount: number;
  createdAt: string;
  user?: { id: string; name: string; avatarUrl: string | null };
}

export interface ContentReport {
  id: string;
  reporterId: string;
  contentType: ContentType;
  contentId: string;
  reason: string;
  status: ReportStatus;
  handledBy: string | null;
  resolvedAt: string | null;
  createdAt: string;
  reporter?: { id: string; name: string; email: string };
}

// ── Ops ───────────────────────────────────────────────────────────────────────

export type BannerStatus   = 'active' | 'inactive';
export type AgreementType  = 'terms_of_service' | 'privacy_policy' | 'community_rules';

export interface Banner {
  id: string;
  title: string;
  imageUrl: string;
  linkUrl: string | null;
  status: BannerStatus;
  startAt: string | null;
  endAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Agreement {
  id: string;
  type: AgreementType;
  version: string;
  content: string;
  isCurrent: boolean;
  publishedAt: string | null;
  createdAt: string;
}

// ── Analytics ─────────────────────────────────────────────────────────────────

export interface TimeBucket {
  bucket: string;
  count: string;
}

export interface AnalyticsData {
  period: string;
  range: { from: string; to: string };
  userGrowth: TimeBucket[];
  mealActivity: TimeBucket[];
  topRecipes: Array<{ recipeId: string; count: string }>;
  scanActivity: TimeBucket[];
  postActivity: TimeBucket[];
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export interface DashboardStats {
  users:     { total: number; newLast7Days: number };
  recipes:   { total: number; pendingReview: number };
  community: { flaggedPosts: number; pendingReports: number };
  activity:  { totalAiScans: number; mealLogsThisMonth: number };
}

// ── NextAuth session extension ────────────────────────────────────────────────

declare module 'next-auth' {
  interface Session {
    accessToken: string;
    admin: AdminUser;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    accessToken: string;
    admin: AdminUser;
  }
}
