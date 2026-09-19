import {
  Entity, PrimaryGeneratedColumn, Column, OneToOne,
  JoinColumn, UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';

export enum DietType {
  OMNIVORE   = 'omnivore',
  VEGETARIAN = 'vegetarian',
  VEGAN      = 'vegan',
  PESCATARIAN = 'pescatarian',
  KETO       = 'keto',
  PALEO      = 'paleo',
  HALAL      = 'halal',
  KOSHER     = 'kosher',
}

export enum CookingSkill {
  BEGINNER     = 'beginner',
  INTERMEDIATE = 'intermediate',
  ADVANCED     = 'advanced',
  CHEF         = 'chef',
}

@Entity('user_profiles')
export class UserProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({
    name: 'diet_type',
    type: 'enum',
    enum: DietType,
    default: DietType.OMNIVORE,
  })
  dietType: DietType;

  @Column({ type: 'jsonb', default: '[]' })
  allergies: string[];

  @Column({
    name: 'cooking_skill',
    type: 'enum',
    enum: CookingSkill,
    default: CookingSkill.BEGINNER,
  })
  cookingSkill: CookingSkill;

  @Column({ name: 'cooking_tools', type: 'jsonb', default: '[]' })
  cookingTools: string[];

  @Column({ name: 'household_size', type: 'int', default: 1 })
  householdSize: number;

  @Column({ name: 'health_goals', type: 'jsonb', default: '[]' })
  healthGoals: string[];

  @Column({ name: 'preferred_cuisines', type: 'jsonb', default: '[]' })
  preferredCuisines: string[];

  @Column({ name: 'disliked_ingredients', type: 'jsonb', default: '[]' })
  dislikedIngredients: string[];

  @Column({ name: 'weekly_cooking_days', type: 'int', default: 3 })
  weeklyCookingDays: number;

  @Column({
    name: 'onboarding_completed_at',
    nullable: true,
    type: 'timestamptz',
  })
  onboardingCompletedAt: Date | null;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @OneToOne(() => User, (user) => user.profile)
  @JoinColumn({ name: 'user_id' })
  user: User;
}
