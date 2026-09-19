import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne,
  JoinColumn, CreateDateColumn, Index,
} from 'typeorm';
import { AdminUser } from './admin-user.entity';

@Entity('admin_logs')
@Index(['adminId', 'createdAt'])
@Index(['targetType', 'targetId'])
export class AdminLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'admin_id', type: 'uuid' })
  adminId: string;

  @Column({ type: 'varchar' })
  action: string;

  @Column({ name: 'target_type', nullable: true, type: 'varchar' })
  targetType: string | null;

  @Column({ name: 'target_id', nullable: true, type: 'uuid' })
  targetId: string | null;

  @Column({ name: 'before_data', type: 'jsonb', nullable: true })
  beforeData: Record<string, unknown> | null;

  @Column({ name: 'after_data', type: 'jsonb', nullable: true })
  afterData: Record<string, unknown> | null;

  @Column({ name: 'ip', nullable: true, type: 'varchar', length: 45 })
  ip: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => AdminUser, (a) => a.logs, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'admin_id' })
  admin: AdminUser;
}
