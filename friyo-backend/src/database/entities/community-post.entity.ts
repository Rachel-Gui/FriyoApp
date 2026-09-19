import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany,
  JoinColumn, CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';
import { User } from './user.entity';
import { Recipe } from './recipe.entity';
import { PostComment } from './post-comment.entity';
import { PostLike } from './post-like.entity';

export enum ModerationStatus {
  PENDING  = 'pending',
  APPROVED = 'approved',
  FLAGGED  = 'flagged',
  REMOVED  = 'removed',
}

@Entity('community_posts')
@Index(['userId', 'createdAt'])
export class CommunityPost {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'recipe_id', nullable: true, type: 'uuid' })
  recipeId: string | null;

  @Column({ nullable: true, type: 'text' })
  caption: string | null;

  // jsonb for full flexibility (can store alt-text, dimensions, etc. per photo)
  @Column({ name: 'photo_urls', type: 'jsonb', default: '[]' })
  photoUrls: string[] | Array<{ url: string; [key: string]: unknown }>;

  @Column({ name: 'likes_count', type: 'int', default: 0 })
  likesCount: number;

  @Column({ name: 'comments_count', type: 'int', default: 0 })
  commentsCount: number;

  @Column({ name: 'is_hidden', default: false })
  isHidden: boolean;

  @Column({
    name: 'moderation_status',
    type: 'enum',
    enum: ModerationStatus,
    default: ModerationStatus.PENDING,
  })
  moderationStatus: ModerationStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Recipe, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'recipe_id' })
  recipe: Recipe | null;

  @OneToMany(() => PostComment, (c) => c.post)
  comments: PostComment[];

  @OneToMany(() => PostLike, (l) => l.post)
  likes: PostLike[];
}
