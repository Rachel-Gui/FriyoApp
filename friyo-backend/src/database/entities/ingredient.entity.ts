import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, OneToMany, Index,
} from 'typeorm';
import { FridgeItem } from './fridge-item.entity';
import { RecipeIngredient } from './recipe-ingredient.entity';

export enum IngredientCategory {
  FRESH     = 'fresh',
  FREEZE    = 'freeze',
  PANTRY    = 'pantry',
  CONDIMENT = 'condiment',
}

@Entity('ingredients')
export class Ingredient {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar' })
  name: string;

  @Column({ name: 'name_zh', nullable: true, type: 'varchar' })
  nameZh: string | null;

  @Column({
    type: 'enum',
    enum: IngredientCategory,
    default: IngredientCategory.FRESH,
  })
  category: IngredientCategory;

  @Column({
    name: 'calories_per_100g',
    type: 'decimal',
    precision: 7,
    scale: 2,
    nullable: true,
  })
  caloriesPer100g: number | null;

  @Column({ name: 'default_shelf_days', type: 'int', nullable: true })
  defaultShelfDays: number | null;

  @Column({ nullable: true, type: 'varchar' })
  unit: string | null;

  @Column({ type: 'simple-json', nullable: true })
  tags: string[] | null;

  @Column({ type: 'simple-json', nullable: true })
  aliases: string[] | null;

  @Column({ name: 'image_url', nullable: true, type: 'varchar' })
  imageUrl: string | null;

  // true = seeded by admin; false/null = user-contributed
  @Column({ name: 'created_by_admin', default: false })
  createdByAdmin: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany(() => FridgeItem, (item) => item.ingredient)
  fridgeItems: FridgeItem[];

  @OneToMany(() => RecipeIngredient, (ri) => ri.ingredient)
  recipeIngredients: RecipeIngredient[];
}
