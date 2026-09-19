import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne,
  JoinColumn, CreateDateColumn, Index,
} from 'typeorm';
import { AdminUser } from './admin-user.entity';

export enum AgreementType {
  TERMS_OF_SERVICE = 'terms_of_service',
  PRIVACY_POLICY   = 'privacy_policy',
  COMMUNITY_RULES  = 'community_rules',
}

@Entity('agreements')
@Index(['type', 'version'])
export class Agreement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: AgreementType })
  type: AgreementType;

  @Column({ type: 'varchar', length: 50 })
  version: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ name: 'is_current', default: false })
  isCurrent: boolean;

  @Column({ name: 'published_at', nullable: true, type: 'timestamptz' })
  publishedAt: Date | null;

  @Column({ name: 'created_by', nullable: true, type: 'uuid' })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => AdminUser, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by' })
  creator: AdminUser | null;
}
