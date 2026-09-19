import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index,
} from 'typeorm';
import { Recipe } from './recipe.entity';
import { Ingredient } from './ingredient.entity';

@Entity('recipe_ingredients')
@Index(['recipeId', 'ingredientId'])
export class RecipeIngredient {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'recipe_id', type: 'uuid' })
  recipeId: string;

  @Column({ name: 'ingredient_id', nullable: true, type: 'uuid' })
  ingredientId: string | null;

  @Column({ name: 'display_name', nullable: true, type: 'varchar' })
  displayName: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  quantity: number | null;

  @Column({ nullable: true, type: 'varchar' })
  unit: string | null;

  @Column({ name: 'is_optional', default: false })
  isOptional: boolean;

  @Column({ type: 'jsonb', nullable: true })
  substitutes: string[] | null;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @ManyToOne(() => Recipe, (r) => r.ingredients, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'recipe_id' })
  recipe: Recipe;

  @ManyToOne(() => Ingredient, (i) => i.recipeIngredients, {
    nullable: true,
    eager: false,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'ingredient_id' })
  ingredient: Ingredient | null;
}
