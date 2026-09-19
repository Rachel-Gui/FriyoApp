import {
  Entity, PrimaryGeneratedColumn, Column, OneToMany,
  CreateDateColumn, UpdateDateColumn, BeforeInsert, Index,
} from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Exclude } from 'class-transformer';
import { AdminLog } from './admin-log.entity';

export enum AdminRole {
  SUPER_ADMIN      = 'super_admin',
  OPS              = 'ops',
  CONTENT_REVIEWER = 'content_reviewer',
}

@Entity('admin_users')
export class AdminUser {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ unique: true, type: 'varchar' })
  username: string;

  @Index({ unique: true })
  @Column({ unique: true, type: 'varchar' })
  email: string;

  @Exclude()
  @Column({ name: 'password_hash', type: 'varchar' })
  passwordHash: string;

  @Column({
    type: 'enum',
    enum: AdminRole,
    default: AdminRole.CONTENT_REVIEWER,
  })
  role: AdminRole;

  @Column({ type: 'jsonb', default: '{}' })
  permissions: Record<string, boolean>;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'last_login_at', nullable: true, type: 'timestamptz' })
  lastLoginAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @BeforeInsert()
  async hashPassword() {
    if (this.passwordHash) {
      this.passwordHash = await bcrypt.hash(this.passwordHash, 12);
    }
  }

  async validatePassword(plain: string): Promise<boolean> {
    return bcrypt.compare(plain, this.passwordHash);
  }

  @OneToMany(() => AdminLog, (log) => log.admin)
  logs: AdminLog[];
}
