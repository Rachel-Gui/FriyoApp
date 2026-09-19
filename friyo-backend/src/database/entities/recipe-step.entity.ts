import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index,
} from 'typeorm';
import { Recipe } from './recipe.entity';

export enum StepType {
  HANDS_ON  = 'hands_on',
  HANDS_OFF = 'hands_off',
}

@Entity('recipe_steps')
export class RecipeStep {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'recipe_id', type: 'uuid' })
  recipeId: string;

  @Column({ name: 'step_number', type: 'int' })
  stepNumber: number;

  @Column({ type: 'text' })
  description: string;

  @Column({ name: 'duration_min', type: 'int', nullable: true })
  durationMin: number | null;

  @Column({
    name: 'step_type',
    type: 'enum',
    enum: StepType,
    default: StepType.HANDS_ON,
  })
  stepType: StepType;

  @Column({ name: 'image_url', nullable: true, type: 'varchar' })
  imageUrl: string | null;

  @Column({ nullable: true, type: 'text' })
  tips: string | null;

  @ManyToOne(() => Recipe, (r) => r.steps, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'recipe_id' })
  recipe: Recipe;
}
