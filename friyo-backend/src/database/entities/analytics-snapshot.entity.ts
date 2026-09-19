import {
  Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn,
} from 'typeorm';

/**
 * Daily pre-computed analytics stored by the analytics.aggregate cron job (2am UTC).
 * Avoids expensive real-time aggregations on the analytics admin dashboard.
 */
@Entity('analytics_snapshots')
@Index(['date'], { unique: true })
export class AnalyticsSnapshot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** ISO date string, e.g. "2024-11-15" */
  @Column({ type: 'date' })
  date: string;

  @Column({ name: 'daily_active_users', type: 'int', default: 0 })
  dailyActiveUsers: number;

  @Column({ name: 'new_users', type: 'int', default: 0 })
  newUsers: number;

  @Column({ name: 'total_meal_logs', type: 'int', default: 0 })
  totalMealLogs: number;

  @Column({ name: 'total_scans', type: 'int', default: 0 })
  totalScans: number;

  @Column({ name: 'total_community_posts', type: 'int', default: 0 })
  totalCommunityPosts: number;

  @Column({ name: 'total_recipe_adaptations', type: 'int', default: 0 })
  totalRecipeAdaptations: number;

  /** Top recipe IDs and their meal-log counts for the day */
  @Column({ name: 'recipe_usage', type: 'jsonb', default: '{}' })
  recipeUsage: Record<string, number>;

  /** Cuisine distribution for the day */
  @Column({ name: 'cuisine_distribution', type: 'jsonb', default: '{}' })
  cuisineDistribution: Record<string, number>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
