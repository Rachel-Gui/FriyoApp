import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne,
  JoinColumn, CreateDateColumn, Index,
} from 'typeorm';
import { Party } from './party.entity';
import { CommunityPost } from './community-post.entity';

@Entity('party_posts')
@Index(['partyId', 'postId'], { unique: true })
export class PartyPost {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'party_id', type: 'uuid' })
  partyId: string;

  @Index()
  @Column({ name: 'post_id', type: 'uuid' })
  postId: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => Party, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'party_id' })
  party: Party;

  @ManyToOne(() => CommunityPost, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'post_id' })
  post: CommunityPost;
}
