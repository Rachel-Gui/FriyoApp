import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne,
  JoinColumn, CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';
import { AdminUser } from './admin-user.entity';

export enum BannerStatus {
  ACTIVE   = 'active',
  INACTIVE = 'inactive',
}

@Entity('banners')
@Index(['status', 'startAt'])
export class Banner {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ name: 'image_url', type: 'varchar', length: 2048 })
  imageUrl: string;

  @Column({ name: 'link_url', nullable: true, type: 'varchar', length: 2048 })
  linkUrl: string | null;

  @Column({ type: 'enum', enum: BannerStatus, default: BannerStatus.ACTIVE })
  status: BannerStatus;

  @Column({ name: 'start_at', nullable: true, type: 'timestamptz' })
  startAt: Date | null;

  @Column({ name: 'end_at', nullable: true, type: 'timestamptz' })
  endAt: Date | null;

  @Column({ name: 'created_by', nullable: true, type: 'uuid' })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(() => AdminUser, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by' })
  creator: AdminUser | null;
}
