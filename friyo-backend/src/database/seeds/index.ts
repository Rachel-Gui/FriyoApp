/**
 * Seed script — run with:
 *   npm run seed:run
 *
 * Creates: 1 super-admin, 20 common ingredients, 5 sample recipes with steps.
 * Safe to re-run: skips existing records by name/username.
 */

import 'reflect-metadata';
import * as dotenv from 'dotenv';
dotenv.config();

import { DataSource } from 'typeorm';
import * as bcrypt    from 'bcrypt';

import { AppDataSource }    from '../data-source';
import { AdminUser, AdminRole } from '../entities/admin-user.entity';
import { Ingredient, IngredientCategory } from '../entities/ingredient.entity';
import { Recipe, RecipeDifficulty, RecipeMealType, RecipeReviewStatus, RecipeStatus } from '../entities/recipe.entity';
import { RecipeIngredient }  from '../entities/recipe-ingredient.entity';
import { RecipeStep, StepType } from '../entities/recipe-step.entity';

// ── Admin ─────────────────────────────────────────────────────────────────────

const ADMIN = {
  username:  process.env.SEED_ADMIN_USERNAME || 'admin',
  email:     process.env.SEED_ADMIN_EMAIL || '',
  password:  process.env.SEED_ADMIN_PASSWORD || '',
  role:      AdminRole.SUPER_ADMIN,
};

// ── Ingredients ───────────────────────────────────────────────────────────────

const INGREDIENTS: Array<{
  name: string; nameZh: string; category: IngredientCategory;
  cal: number; unit: string; tags: string[];
}> = [
  { name: 'Chicken Breast',  nameZh: '鸡胸肉',  category: IngredientCategory.FRESH,     cal: 165, unit: 'g',    tags: ['protein', 'meat'] },
  { name: 'Eggs',            nameZh: '鸡蛋',    category: IngredientCategory.FRESH,     cal: 155, unit: 'pcs',  tags: ['protein', 'dairy'] },
  { name: 'Spinach',         nameZh: '菠菜',    category: IngredientCategory.FRESH,     cal: 23,  unit: 'g',    tags: ['vegetable', 'greens'] },
  { name: 'Garlic',          nameZh: '大蒜',    category: IngredientCategory.FRESH,     cal: 149, unit: 'cloves', tags: ['condiment', 'aromatic'] },
  { name: 'Onion',           nameZh: '洋葱',    category: IngredientCategory.FRESH,     cal: 40,  unit: 'g',    tags: ['vegetable', 'aromatic'] },
  { name: 'Tomatoes',        nameZh: '番茄',    category: IngredientCategory.FRESH,     cal: 18,  unit: 'g',    tags: ['vegetable', 'fruit'] },
  { name: 'Bell Pepper',     nameZh: '彩椒',    category: IngredientCategory.FRESH,     cal: 31,  unit: 'g',    tags: ['vegetable', 'colorful'] },
  { name: 'Broccoli',        nameZh: '西兰花',  category: IngredientCategory.FRESH,     cal: 34,  unit: 'g',    tags: ['vegetable', 'greens'] },
  { name: 'Salmon Fillet',   nameZh: '三文鱼',  category: IngredientCategory.FRESH,     cal: 208, unit: 'g',    tags: ['protein', 'fish', 'omega3'] },
  { name: 'Avocado',         nameZh: '牛油果',  category: IngredientCategory.FRESH,     cal: 160, unit: 'pcs',  tags: ['fruit', 'healthy-fat'] },
  { name: 'Heavy Cream',     nameZh: '鲜奶油',  category: IngredientCategory.FRESH,     cal: 340, unit: 'ml',   tags: ['dairy', 'sauce'] },
  { name: 'Parmesan',        nameZh: '帕尔玛奶酪', category: IngredientCategory.FRESH,  cal: 431, unit: 'g',    tags: ['dairy', 'cheese'] },
  { name: 'Pasta',           nameZh: '意大利面', category: IngredientCategory.PANTRY,   cal: 371, unit: 'g',    tags: ['carb', 'grain'] },
  { name: 'Rice',            nameZh: '米饭',    category: IngredientCategory.PANTRY,   cal: 360, unit: 'g',    tags: ['carb', 'grain'] },
  { name: 'Olive Oil',       nameZh: '橄榄油',  category: IngredientCategory.PANTRY,   cal: 884, unit: 'tbsp', tags: ['oil', 'condiment'] },
  { name: 'Soy Sauce',       nameZh: '酱油',    category: IngredientCategory.CONDIMENT, cal: 53,  unit: 'ml',   tags: ['condiment', 'asian'] },
  { name: 'Butter',          nameZh: '黄油',    category: IngredientCategory.FRESH,     cal: 717, unit: 'g',    tags: ['dairy', 'fat'] },
  { name: 'Sun-dried Tomatoes', nameZh: '日晒番茄', category: IngredientCategory.PANTRY, cal: 258, unit: 'g',  tags: ['condiment', 'italian'] },
  { name: 'Whole Milk',      nameZh: '全脂牛奶', category: IngredientCategory.FRESH,    cal: 61,  unit: 'ml',   tags: ['dairy', 'drink'] },
  { name: 'Lemon',           nameZh: '柠檬',    category: IngredientCategory.FRESH,     cal: 29,  unit: 'pcs',  tags: ['fruit', 'citrus', 'condiment'] },
];

// ── Sample recipes ────────────────────────────────────────────────────────────

interface RecipeSeed {
  title: string; titleZh: string; description: string;
  cuisine: string; mealType: RecipeMealType;
  difficulty: RecipeDifficulty; prepMin: number; cookMin: number;
  servings: number; calories: number;
  steps: Array<{ num: number; title: string; dur: number; type: StepType; info: string }>;
  ingredientNames: string[];
}

const RECIPES: RecipeSeed[] = [
  {
    title: 'Creamy Tuscan Garlic Chicken',
    titleZh: '奶油托斯卡纳大蒜鸡',
    description: 'Juicy chicken smothered in a velvety garlic cream sauce with sun-dried tomatoes and spinach. Ready in under 30 minutes.',
    cuisine: 'Italian', mealType: RecipeMealType.DINNER,
    difficulty: RecipeDifficulty.MEDIUM, prepMin: 5, cookMin: 20,
    servings: 2, calories: 480,
    ingredientNames: ['Chicken Breast', 'Heavy Cream', 'Spinach', 'Garlic', 'Sun-dried Tomatoes', 'Parmesan', 'Olive Oil'],
    steps: [
      { num: 1, title: 'Season the chicken',    dur: 2,  type: StepType.HANDS_ON,  info: 'Pat chicken dry. Season both sides generously with salt, pepper, and dried oregano.' },
      { num: 2, title: 'Sear the chicken',      dur: 8,  type: StepType.HANDS_ON,  info: 'Heat oil in a large skillet over medium-high. Sear chicken 4 min per side until golden brown. Remove to a plate.' },
      { num: 3, title: 'Rest the chicken',      dur: 5,  type: StepType.HANDS_OFF, info: 'Cover chicken loosely with foil and rest on the plate.' },
      { num: 4, title: 'Make the cream sauce',  dur: 5,  type: StepType.HANDS_ON,  info: 'In the same pan, sauté garlic 30 s. Add sun-dried tomatoes 1 min. Pour in cream, simmer 3 min, then stir in parmesan.' },
      { num: 5, title: 'Finish and plate',      dur: 2,  type: StepType.HANDS_ON,  info: 'Wilt spinach into sauce. Return chicken, spoon sauce over. Serve immediately.' },
    ],
  },
  {
    title: 'Zesty Lemon Garlic Salmon',
    titleZh: '柠檬大蒜三文鱼',
    description: 'Pan-seared salmon with a bright lemon-garlic butter glaze. Healthy, elegant, and ready in 15 minutes.',
    cuisine: 'American', mealType: RecipeMealType.DINNER,
    difficulty: RecipeDifficulty.EASY, prepMin: 5, cookMin: 10,
    servings: 2, calories: 390,
    ingredientNames: ['Salmon Fillet', 'Lemon', 'Garlic', 'Butter', 'Olive Oil', 'Spinach'],
    steps: [
      { num: 1, title: 'Prep salmon',           dur: 3,  type: StepType.HANDS_ON,  info: 'Pat salmon dry. Season with salt, pepper, and a squeeze of lemon.' },
      { num: 2, title: 'Sear salmon',           dur: 6,  type: StepType.HANDS_ON,  info: 'Heat oil in a non-stick pan over medium-high. Place salmon skin-side up. Cook 3 min, flip, cook 3 min more.' },
      { num: 3, title: 'Make butter sauce',     dur: 2,  type: StepType.HANDS_ON,  info: 'Reduce heat. Add butter and garlic to pan. Baste salmon. Squeeze lemon over top.' },
      { num: 4, title: 'Serve',                 dur: 1,  type: StepType.HANDS_ON,  info: 'Plate salmon over wilted spinach and drizzle with pan sauce.' },
    ],
  },
  {
    title: 'Classic Scrambled Eggs',
    titleZh: '经典炒蛋',
    description: 'Silky, restaurant-quality scrambled eggs that take just 5 minutes. The secret is low heat and constant stirring.',
    cuisine: 'British', mealType: RecipeMealType.BREAKFAST,
    difficulty: RecipeDifficulty.EASY, prepMin: 2, cookMin: 5,
    servings: 1, calories: 220,
    ingredientNames: ['Eggs', 'Butter', 'Whole Milk'],
    steps: [
      { num: 1, title: 'Beat eggs',             dur: 1,  type: StepType.HANDS_ON,  info: 'Whisk 3 eggs with 1 tbsp milk, salt, and pepper until well combined.' },
      { num: 2, title: 'Cook low and slow',     dur: 4,  type: StepType.HANDS_ON,  info: 'Melt butter in a non-stick pan over LOW heat. Add eggs. Stir constantly with a spatula, folding curds together. Remove from heat while still slightly underdone.' },
    ],
  },
  {
    title: 'Quick Garlic Pasta',
    titleZh: '快手蒜香意面',
    description: 'Aglio e olio — the Italian pantry classic. Just pasta, garlic, olive oil, and parmesan. Ready in 20 minutes.',
    cuisine: 'Italian', mealType: RecipeMealType.LUNCH,
    difficulty: RecipeDifficulty.EASY, prepMin: 5, cookMin: 15,
    servings: 2, calories: 420,
    ingredientNames: ['Pasta', 'Garlic', 'Olive Oil', 'Parmesan', 'Lemon'],
    steps: [
      { num: 1, title: 'Boil pasta',            dur: 10, type: StepType.HANDS_OFF, info: 'Cook pasta in well-salted boiling water until al dente. Reserve 1 cup pasta water before draining.' },
      { num: 2, title: 'Toast garlic',          dur: 3,  type: StepType.HANDS_ON,  info: 'Warm oil in a large pan over medium. Add sliced garlic and cook until golden and fragrant, about 2-3 min.' },
      { num: 3, title: 'Combine',               dur: 2,  type: StepType.HANDS_ON,  info: 'Add drained pasta to pan. Toss with garlic oil, splash of pasta water, lemon zest, and parmesan.' },
    ],
  },
  {
    title: 'Tomato & Spinach Omelette',
    titleZh: '番茄菠菜煎蛋卷',
    description: 'A fluffy, protein-packed omelette loaded with fresh vegetables. A perfect healthy breakfast or light lunch.',
    cuisine: 'French', mealType: RecipeMealType.BREAKFAST,
    difficulty: RecipeDifficulty.EASY, prepMin: 5, cookMin: 8,
    servings: 1, calories: 260,
    ingredientNames: ['Eggs', 'Spinach', 'Tomatoes', 'Butter', 'Parmesan'],
    steps: [
      { num: 1, title: 'Beat eggs',             dur: 1,  type: StepType.HANDS_ON,  info: 'Whisk 3 eggs with a pinch of salt and pepper until uniform.' },
      { num: 2, title: 'Sauté vegetables',      dur: 2,  type: StepType.HANDS_ON,  info: 'Melt butter in a non-stick pan. Add spinach and diced tomatoes. Cook until wilted, about 1-2 min. Remove and set aside.' },
      { num: 3, title: 'Cook omelette',         dur: 3,  type: StepType.HANDS_ON,  info: 'Add a little more butter. Pour in eggs. Tilt pan to spread evenly. When edges set, add filling and parmesan to one half.' },
      { num: 4, title: 'Fold and plate',        dur: 1,  type: StepType.HANDS_ON,  info: 'Fold omelette in half over the filling. Slide onto a plate and serve immediately.' },
    ],
  },
];

// ── Main ──────────────────────────────────────────────────────────────────────

async function seed(ds: DataSource) {
  console.log('\n🌱  Friyo seed script starting...\n');

  // ── 1. Admin user ──────────────────────────────────────────────────────────
  const adminRepo = ds.getRepository(AdminUser);
  const existingAdmin = await adminRepo.findOne({ where: { username: ADMIN.username } });
  if (existingAdmin) {
    console.log('  ⏭  Admin already exists — skipping.');
  } else {
    if (!ADMIN.email || ADMIN.password.length < 16) throw new Error('Set SEED_ADMIN_EMAIL and a unique SEED_ADMIN_PASSWORD of at least 16 characters');
    const admin = adminRepo.create({
      username:     ADMIN.username,
      email:        ADMIN.email,
      passwordHash: ADMIN.password, // AdminUser @BeforeInsert hashes exactly once
      role:         ADMIN.role,
      permissions:  { all: true },
      isActive:     true,
    });
    await adminRepo.save(admin);
    console.log('  Admin created. Credentials are not logged.');
  }

  // ── 2. Ingredients ─────────────────────────────────────────────────────────
  const ingRepo = ds.getRepository(Ingredient);
  const ingMap  = new Map<string, Ingredient>();
  let ingCreated = 0;

  for (const ing of INGREDIENTS) {
    const existing = await ingRepo.findOne({ where: { name: ing.name } });
    if (existing) {
      ingMap.set(ing.name, existing);
    } else {
      const saved = await ingRepo.save(
        ingRepo.create({
          name:             ing.name,
          nameZh:           ing.nameZh,
          category:         ing.category,
          caloriesPer100g:  ing.cal,
          unit:             ing.unit,
          tags:             ing.tags,
        }),
      );
      ingMap.set(ing.name, saved);
      ingCreated++;
    }
  }
  console.log(`  ✅  Ingredients: ${ingCreated} created, ${INGREDIENTS.length - ingCreated} already existed.`);

  // ── 3. Recipes ─────────────────────────────────────────────────────────────
  const recipeRepo = ds.getRepository(Recipe);
  const riRepo     = ds.getRepository(RecipeIngredient);
  const stepRepo   = ds.getRepository(RecipeStep);
  let recipeCreated = 0;

  for (const r of RECIPES) {
    const existing = await recipeRepo.findOne({ where: { title: r.title } });
    if (existing) continue;

    const recipe = await recipeRepo.save(
      recipeRepo.create({
        title:             r.title,
        titleZh:           r.titleZh,
        description:       r.description,
        cuisineType:       r.cuisine,
        mealType:          r.mealType,
        difficulty:        r.difficulty,
        prepTimeMin:       r.prepMin,
        cookTimeMin:       r.cookMin,
        servings:          r.servings,
        caloriesPerServing: r.calories,
        tags:              [],
        dietTypes:         [],
        requiredTools:     [],
        cuisines:          [r.cuisine],
        isAiGenerated:     false,
        reviewStatus:      RecipeReviewStatus.APPROVED,
        isPublished:       true,
        status:            RecipeStatus.PUBLISHED,
      }),
    );

    // Ingredients
    for (let i = 0; i < r.ingredientNames.length; i++) {
      const ing = ingMap.get(r.ingredientNames[i]);
      if (!ing) continue;
      await riRepo.save(riRepo.create({
        recipeId:     recipe.id,
        ingredientId: ing.id,
        displayName:  ing.name,
        quantity:     100,
        unit:         ing.unit,
        isOptional:   false,
        sortOrder:    i,
      }));
    }

    // Steps
    for (const step of r.steps) {
      await stepRepo.save(stepRepo.create({
        recipeId:    recipe.id,
        stepNumber:  step.num,
        description: `${step.title}: ${step.info}`,
        durationMin: step.dur,
        stepType:    step.type,
      }));
    }

    recipeCreated++;
  }
  console.log(`  ✅  Recipes: ${recipeCreated} created, ${RECIPES.length - recipeCreated} already existed.`);

  console.log('\n✨  Seed complete!\n');
}

// ── Run ───────────────────────────────────────────────────────────────────────

AppDataSource.initialize()
  .then(ds => seed(ds).finally(() => ds.destroy()))
  .catch(err => { console.error('Seed failed:', err); process.exit(1); });
