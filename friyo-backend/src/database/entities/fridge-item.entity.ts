import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne,
  JoinColumn, CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';
import { User } from './user.entity';
import { Ingredient } from './ingredient.entity';
import { ScanSession } from './scan-session.entity';

export enum StorageType {
  FRIDGE  = 'fridge',
  FREEZER = 'freezer',
  PANTRY  = 'pantry',
}

@Entity('fridge_items')
@Index(['userId', 'expiryDate'])
export class FridgeItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'ingredient_id', nullable: true, type: 'uuid' })
  ingredientId: string | null;

  @Column({ name: 'custom_name', nullable: true, type: 'varchar' })
  customName: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 1 })
  quantity: number;

  @Column({ nullable: true, type: 'varchar' })
  unit: string | null;

  @Column({
    name: 'storage_type',
    type: 'enum',
    enum: StorageType,
    default: StorageType.FRIDGE,
  })
  storageType: StorageType;

  @Column({ name: 'expiry_date', nullable: true, type: 'date' })
  expiryDate: Date | null;

  @Column({
    name: 'calories_override',
    type: 'decimal',
    precision: 7,
    scale: 2,
    nullable: true,
  })
  caloriesOverride: number | null;

  @Column({ name: 'scan_session_id', nullable: true, type: 'uuid' })
  scanSessionId: string | null;

  @CreateDateColumn({ name: 'added_at', type: 'timestamptz' })
  addedAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  // ── Computed: 0-100 freshness score based on expiry_date ─────────────────
  get freshnessScore(): number {
    if (!this.expiryDate) return 100;
    const now       = Date.now();
    const expiry    = new Date(this.expiryDate).getTime();
    const added     = this.addedAt?.getTime() ?? now - 7 * 86_400_000;
    const total     = expiry - added;
    const remaining = expiry - now;
    if (remaining <= 0) return 0;
    if (total <= 0) return 100;
    return Math.min(100, Math.max(0, Math.round((remaining / total) * 100)));
  }

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Ingredient, (i) => i.fridgeItems, {
    nullable: true,
    eager: false,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'ingredient_id' })
  ingredient: Ingredient | null;

  @ManyToOne(() => ScanSession, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'scan_session_id' })
  scanSession: ScanSession | null;
}
