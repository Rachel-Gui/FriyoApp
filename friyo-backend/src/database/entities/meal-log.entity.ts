import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne,
  JoinColumn, CreateDateColumn, Index,
} from 'typeorm';
import { User } from './user.entity';
import { Recipe } from './recipe.entity';
import { RecipeAdaptation } from './recipe-adaptation.entity';

export enum MealType {
  BREAKFAST = 'breakfast',
  LUNCH     = 'lunch',
  DINNER    = 'dinner',
  SNACK     = 'snack',
}

@Entity('meal_logs')
@Index(['userId', 'loggedAt'])
export class MealLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'recipe_id', nullable: true, type: 'uuid' })
  recipeId: string | null;

  @Column({ name: 'adaptation_id', nullable: true, type: 'uuid' })
  adaptationId: string | null;

  @Column({
    name: 'meal_type',
    type: 'enum',
    enum: MealType,
    default: MealType.DINNER,
  })
  mealType: MealType;

  @Column({ name: 'servings_eaten', type: 'decimal', precision: 4, scale: 1, default: 1 })
  servingsEaten: number;

  @Column({ name: 'photo_url', nullable: true, type: 'varchar' })
  photoUrl: string | null;

  @Column({ name: 'use_original_photo', default: false })
  useOriginalPhoto: boolean;

  @Column({ name: 'calories_total', type: 'int', nullable: true })
  caloriesTotal: number | null;

  @Column({ nullable: true, type: 'text' })
  notes: string | null;

  @Column({ name: 'logged_at', type: 'timestamptz' })
  loggedAt: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Recipe, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'recipe_id' })
  recipe: Recipe | null;

  @ManyToOne(() => RecipeAdaptation, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'adaptation_id' })
  adaptation: RecipeAdaptation | null;
}
