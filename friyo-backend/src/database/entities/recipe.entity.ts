import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany,
  JoinColumn, CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';
import { User } from './user.entity';
import { AdminUser } from './admin-user.entity';
import { RecipeIngredient } from './recipe-ingredient.entity';
import { RecipeStep } from './recipe-step.entity';
import { RecipeAdaptation } from './recipe-adaptation.entity';

export enum RecipeDifficulty {
  EASY   = 'easy',
  MEDIUM = 'medium',
  HARD   = 'hard',
}

export enum RecipeStatus {
  DRAFT     = 'draft',
  PUBLISHED = 'published',
  ARCHIVED  = 'archived',
}

export enum RecipeMealType {
  BREAKFAST = 'breakfast',
  LUNCH     = 'lunch',
  DINNER    = 'dinner',
  SNACK     = 'snack',
}

export enum RecipeReviewStatus {
  PENDING  = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

@Entity('recipes')
@Index(['authorId'])
@Index(['status', 'createdAt'])
export class Recipe {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  title: string;

  @Column({ name: 'title_zh', nullable: true, type: 'varchar' })
  titleZh: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'cuisine_type', nullable: true, type: 'varchar' })
  cuisineType: string | null;

  @Column({
    name: 'meal_type',
    type: 'enum',
    enum: RecipeMealType,
    nullable: true,
  })
  mealType: RecipeMealType | null;

  @Column({
    type: 'enum',
    enum: RecipeDifficulty,
    default: RecipeDifficulty.MEDIUM,
  })
  difficulty: RecipeDifficulty;

  @Column({
    type: 'enum',
    enum: RecipeStatus,
    default: RecipeStatus.DRAFT,
  })
  status: RecipeStatus;

  @Column({
    name: 'review_status',
    type: 'enum',
    enum: RecipeReviewStatus,
    default: RecipeReviewStatus.PENDING,
  })
  reviewStatus: RecipeReviewStatus;

  @Column({ name: 'prep_time_min', type: 'int', default: 0 })
  prepTimeMin: number;

  @Column({ name: 'cook_time_min', type: 'int', default: 0 })
  cookTimeMin: number;

  @Column({ type: 'int', default: 2 })
  servings: number;

  @Column({ name: 'calories_per_serving', type: 'int', nullable: true })
  caloriesPerServing: number | null;

  @Column({ type: 'jsonb', default: '[]' })
  cuisines: string[];

  @Column({ type: 'jsonb', default: '[]' })
  tags: string[];

  @Column({ name: 'diet_types', type: 'jsonb', default: '[]' })
  dietTypes: string[];

  @Column({ name: 'required_tools', type: 'jsonb', default: '[]' })
  requiredTools: string[];

  @Column({ name: 'cover_image_url', nullable: true, type: 'varchar' })
  coverImageUrl: string | null;

  // true = official system recipe, false = user-submitted
  @Column({ name: 'is_system', default: false })
  isSystem: boolean;

  @Column({ name: 'is_published', default: false })
  isPublished: boolean;

  @Column({ name: 'xp_reward', type: 'int', default: 50 })
  xpReward: number;

  @Column({ name: 'likes_count', type: 'int', default: 0 })
  likesCount: number;

  @Column({ name: 'saves_count', type: 'int', default: 0 })
  savesCount: number;

  @Column({ name: 'cook_count', type: 'int', default: 0 })
  cookCount: number;

  @Column({ name: 'average_rating', type: 'decimal', precision: 3, scale: 2, default: 0 })
  averageRating: number;

  @Column({ name: 'rating_count', type: 'int', default: 0 })
  ratingCount: number;

  @Index()
  @Column({ name: 'author_id', nullable: true, type: 'uuid' })
  authorId: string | null;

  @Column({ name: 'approved_by', nullable: true, type: 'uuid' })
  approvedBy: string | null;

  @Column({ name: 'is_ai_generated', default: false })
  isAiGenerated: boolean;

  @Column({ name: 'source_url', nullable: true, type: 'varchar' })
  sourceUrl: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'author_id' })
  author: User | null;

  @ManyToOne(() => AdminUser, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'approved_by' })
  approver: AdminUser | null;

  @OneToMany(() => RecipeIngredient, (ri) => ri.recipe, { cascade: true })
  ingredients: RecipeIngredient[];

  @OneToMany(() => RecipeStep, (rs) => rs.recipe, { cascade: true })
  steps: RecipeStep[];

  @OneToMany(() => RecipeAdaptation, (ra) => ra.originalRecipe)
  adaptations: RecipeAdaptation[];
}
