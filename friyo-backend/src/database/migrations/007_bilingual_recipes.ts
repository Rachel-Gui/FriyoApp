import { MigrationInterface, QueryRunner } from 'typeorm';

export const bilingualSeedRecipes = [
  { title: 'Creamy Tuscan Garlic Chicken', description: '鲜嫩鸡肉搭配丝滑蒜香奶油酱、油浸番茄干和菠菜，30 分钟内即可完成。', steps: [
    '给鸡肉调味：用厨房纸吸干鸡肉，两面均匀撒上盐、胡椒和干牛至。',
    '煎鸡肉：大煎锅中加入油，以中大火加热。鸡肉每面煎 4 分钟至金黄，取出放在盘中。',
    '静置鸡肉：用锡纸松松地盖住盘中的鸡肉，静置休息。',
    '制作奶油酱：在同一口锅中炒香大蒜 30 秒，加入番茄干炒 1 分钟。倒入奶油，煮 3 分钟，再拌入帕尔马干酪。',
    '完成并装盘：将菠菜加入酱汁，煮至变软。放回鸡肉，把酱汁淋在鸡肉上，立即享用。',
  ] },
  { title: 'Zesty Lemon Garlic Salmon', description: '香煎三文鱼搭配清爽的柠檬蒜香黄油酱，15 分钟即可完成。', steps: [
    '准备三文鱼：用厨房纸吸干鱼肉，撒上盐和胡椒，再挤少许柠檬汁调味。',
    '煎三文鱼：不粘锅中加入油，以中大火加热。鱼皮朝上煎 3 分钟，翻面再煎 3 分钟。',
    '制作黄油酱：调小火，加入黄油和大蒜。不断把锅中的酱汁淋在鱼肉上，再挤上柠檬汁。',
    '装盘：将三文鱼放在炒软的菠菜上，淋上锅中的酱汁。',
  ] },
  { title: 'Classic Scrambled Eggs', description: '口感丝滑的经典炒蛋，只需约 5 分钟。诀窍是使用小火并不断搅拌。', steps: [
    '打散鸡蛋：将 3 个鸡蛋、1 汤匙牛奶、盐和胡椒充分搅拌均匀。',
    '小火慢炒：不粘锅用小火融化黄油，倒入蛋液。用锅铲不断搅拌并轻轻翻拌，在鸡蛋尚未完全凝固时离火。',
  ] },
  { title: 'Quick Garlic Pasta', description: '经典意大利蒜香橄榄油意面，用意面、大蒜、橄榄油和帕尔马干酪，20 分钟即可完成。', steps: [
    '煮意面：在加足盐的沸水中将意面煮至有嚼劲。沥干前留出 1 杯煮面水。',
    '炒香大蒜：大煎锅中用中火加热油，加入蒜片，炒约 2 至 3 分钟至金黄且香味散出。',
    '拌匀：把沥干的意面加入锅中，与蒜香油、少量煮面水、柠檬皮屑和帕尔马干酪拌匀。',
  ] },
  { title: 'Tomato & Spinach Omelette', description: '蓬松的煎蛋卷搭配新鲜蔬菜，富含蛋白质，适合作为早餐或清爽午餐。', steps: [
    '打散鸡蛋：将 3 个鸡蛋与少许盐和胡椒搅拌均匀。',
    '炒蔬菜：不粘锅中融化黄油，加入菠菜和番茄丁，炒约 1 至 2 分钟至变软，取出备用。',
    '煎蛋卷：锅中再加入少许黄油，倒入蛋液，倾斜锅身让蛋液均匀铺开。边缘凝固后，在一半蛋饼上放入蔬菜和帕尔马干酪。',
    '折叠装盘：将蛋饼对折包住馅料，滑入盘中，立即享用。',
  ] },
];
export class BilingualRecipes1700000007000 implements MigrationInterface {
  async up(qr: QueryRunner): Promise<void> {
    for (const [table, columns] of Object.entries({ recipes: ['title_en', 'description_zh', 'description_en'], recipe_ingredients: ['display_name_zh', 'display_name_en'], recipe_steps: ['description_zh', 'description_en', 'tips_zh', 'tips_en'] })) {
      for (const column of columns) await qr.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${column} TEXT`);
    }
    // Catalog names already contain authoritative Chinese translations.
    await qr.query(`UPDATE recipe_ingredients ri SET display_name_zh = i.name_zh FROM ingredients i WHERE ri.ingredient_id = i.id AND ri.display_name_zh IS NULL AND (ri.display_name IS NULL OR lower(ri.display_name) = lower(i.name))`);
    for (const item of bilingualSeedRecipes) {
      await qr.query(`UPDATE recipes SET description_zh = $2 WHERE title = $1 AND source_url IS NULL AND author_id IS NULL AND description_zh IS NULL`, [item.title, item.description]);
      for (let i = 0; i < item.steps.length; i++) await qr.query(`UPDATE recipe_steps s SET description_zh = $3 FROM recipes r WHERE s.recipe_id = r.id AND r.title = $1 AND r.source_url IS NULL AND r.author_id IS NULL AND s.step_number = $2 AND s.description_zh IS NULL`, [item.title, i + 1, item.steps[i]]);
    }
  }
  async down(qr: QueryRunner): Promise<void> {
    for (const [table, columns] of Object.entries({ recipes: ['title_en', 'description_zh', 'description_en'], recipe_ingredients: ['display_name_zh', 'display_name_en'], recipe_steps: ['description_zh', 'description_en', 'tips_zh', 'tips_en'] })) {
      for (const column of columns) await qr.query(`ALTER TABLE ${table} DROP COLUMN IF EXISTS ${column}`);
    }
  }
}
