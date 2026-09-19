import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, OneToOne, BeforeInsert, Index,
} from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Exclude } from 'class-transformer';
import { UserProfile } from './user-profile.entity';

export enum AuthProvider {
  LOCAL    = 'local',
  GOOGLE   = 'google',
  APPLE    = 'apple',
  FACEBOOK = 'facebook',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ unique: true, nullable: true, type: 'varchar' })
  email: string | null;

  @Index({ unique: true })
  @Column({ unique: true, nullable: true, type: 'varchar' })
  phone: string | null;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ name: 'avatar_url', nullable: true, type: 'varchar' })
  avatarUrl: string | null;

  @Exclude()
  @Column({ name: 'password_hash', nullable: true, type: 'varchar' })
  passwordHash: string | null;

  @Column({
    name: 'auth_provider',
    type: 'enum',
    enum: AuthProvider,
    default: AuthProvider.LOCAL,
  })
  authProvider: AuthProvider;

  @Column({ name: 'password_changed_at', type: 'timestamptz', nullable: true })
  passwordChangedAt: Date | null;

  @Exclude()
  @Column({ name: 'apple_refresh_token', type: 'text', nullable: true })
  appleRefreshToken: string | null;

  @Column({ name: 'provider_id', nullable: true, type: 'varchar' })
  providerId: string | null;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'is_banned', default: false })
  isBanned: boolean;

  @Column({ name: 'last_active_at', nullable: true, type: 'timestamptz' })
  lastActiveAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @OneToOne(() => UserProfile, (profile) => profile.user, {
    cascade: true,
    eager: false,
  })
  profile: UserProfile;

  @BeforeInsert()
  async hashPassword() {
    if (this.passwordHash) {
      this.passwordHash = await bcrypt.hash(this.passwordHash, 12);
    }
  }

  async validatePassword(plain: string): Promise<boolean> {
    if (!this.passwordHash) return false;
    return bcrypt.compare(plain, this.passwordHash);
  }
}
