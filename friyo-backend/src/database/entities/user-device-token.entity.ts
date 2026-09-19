import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne,
  JoinColumn, CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';
import { User } from './user.entity';

export enum DevicePlatform {
  EXPO = 'expo',
  FCM  = 'fcm',   // Android + web
  APNS = 'apns',  // iOS (routed through FCM Admin SDK with APNS config)
}

@Entity('user_device_tokens')
@Index(['userId', 'token'], { unique: true })
@Index('idx_device_token_unique', ['token'], { unique: true })
export class UserDeviceToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  /** FCM registration token (256 chars max in practice) */
  @Column({ type: 'varchar', length: 512 })
  token: string;

  @Column({
    type:    'enum',
    enum:    DevicePlatform,
    default: DevicePlatform.FCM,
  })
  platform: DevicePlatform;

  /** Set to false when FCM returns InvalidRegistration / NotRegistered */
  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
