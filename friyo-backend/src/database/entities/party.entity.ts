import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany,
  JoinColumn, CreateDateColumn, UpdateDateColumn, BeforeInsert, Index,
} from 'typeorm';
import { User } from './user.entity';
import { PartyMember } from './party-member.entity';

function generateInviteCode(length = 8): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length }, () =>
    chars[Math.floor(Math.random() * chars.length)],
  ).join('');
}

@Entity('parties')
export class Party {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'host_id', type: 'uuid' })
  hostId: string;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ nullable: true, type: 'text' })
  description: string | null;

  @Column({ name: 'event_date', nullable: true, type: 'timestamptz' })
  eventDate: Date | null;

  @Index({ unique: true })
  @Column({ name: 'invite_code', length: 8, unique: true, type: 'varchar' })
  inviteCode: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @BeforeInsert()
  generateCode() {
    if (!this.inviteCode) {
      this.inviteCode = generateInviteCode();
    }
  }

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'host_id' })
  host: User;

  @OneToMany(() => PartyMember, (m) => m.party, { cascade: true })
  members: PartyMember[];
}
