import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne,
  JoinColumn, CreateDateColumn, Index,
} from 'typeorm';
import { Recipe } from './recipe.entity';
import { User } from './user.entity';

@Entity('recipe_adaptations')
@Index(['originalRecipeId', 'userId'])
export class RecipeAdaptation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'original_recipe_id', type: 'uuid' })
  originalRecipeId: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'adapted_ingredients', type: 'jsonb', default: '[]' })
  adaptedIngredients: Record<string, unknown>[];

  @Column({ name: 'adapted_steps', type: 'jsonb', default: '[]' })
  adaptedSteps: Record<string, unknown>[];

  @Column({ name: 'adaptation_reason', nullable: true, type: 'text' })
  adaptationReason: string | null;

  @Column({ name: 'ai_generated', default: false })
  aiGenerated: boolean;

  @Column({ nullable: true, type: 'text' })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => Recipe, (r) => r.adaptations, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'original_recipe_id' })
  originalRecipe: Recipe;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
