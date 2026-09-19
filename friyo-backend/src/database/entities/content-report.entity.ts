import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne,
  JoinColumn, CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';
import { User } from './user.entity';
import { AdminUser } from './admin-user.entity';

export enum ContentType {
  POST    = 'post',
  COMMENT = 'comment',
  USER    = 'user',
}

export enum ReportStatus {
  PENDING   = 'pending',
  RESOLVED  = 'resolved',
  DISMISSED = 'dismissed',
}

@Entity('content_reports')
@Index(['status', 'createdAt'])
export class ContentReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'reporter_id', type: 'uuid' })
  reporterId: string;

  @Column({
    name: 'content_type',
    type: 'enum',
    enum: ContentType,
  })
  contentType: ContentType;

  @Column({ name: 'content_id', type: 'uuid' })
  contentId: string;

  @Column({ type: 'text' })
  reason: string;

  @Column({
    type: 'enum',
    enum: ReportStatus,
    default: ReportStatus.PENDING,
  })
  status: ReportStatus;

  @Column({ name: 'handled_by', nullable: true, type: 'uuid' })
  handledBy: string | null;

  @Column({ name: 'resolved_at', nullable: true, type: 'timestamptz' })
  resolvedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reporter_id' })
  reporter: User;

  @ManyToOne(() => AdminUser, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'handled_by' })
  handler: AdminUser | null;
}
