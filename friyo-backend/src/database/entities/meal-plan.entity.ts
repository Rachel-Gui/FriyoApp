import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne,
  JoinColumn, CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';
import { User } from './user.entity';

@Entity('meal_plans')
@Index(['userId', 'weekStartDate'], { unique: true })
export class MealPlan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'week_start_date', type: 'date' })
  weekStartDate: Date;

  // Structure: { mon: { breakfast: recipeId, lunch: recipeId, dinner: recipeId }, ... }
  @Column({ name: 'plan_data', type: 'jsonb', default: '{}' })
  planData: Record<string, unknown>;

  @Column({ name: 'is_ai_generated', default: false })
  isAiGenerated: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
