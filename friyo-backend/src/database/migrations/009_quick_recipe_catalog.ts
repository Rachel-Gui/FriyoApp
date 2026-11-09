import { MigrationInterface, QueryRunner } from 'typeorm';
import { Recipe, RecipeDifficulty, RecipeMealType, RecipeReviewStatus, RecipeStatus } from '../entities/recipe.entity';
import { RecipeIngredient } from '../entities/recipe-ingredient.entity';
import { RecipeStep } from '../entities/recipe-step.entity';
import { Ingredient } from '../entities/ingredient.entity';

// Authored quick recipes. Nutrition remains unknown until validated.
export const quickRecipes = [
  {
    "id": "26102500-0000-4000-8000-000000000001",
    "title": "Tomato Egg Stir Fry",
    "titleZh": "番茄炒蛋",
    "cuisine": "Chinese",
    "meal": "dinner",
    "tags": [
      "savory",
      "quick",
      "vegetarian"
    ],
    "ingredients": [
      [
        "Tomatoes",
        "番茄",
        300,
        "g"
      ],
      [
        "Eggs",
        "鸡蛋",
        3,
        "pcs"
      ],
      [
        "Olive Oil",
        "橄榄油",
        10,
        "g"
      ]
    ],
    "steps": [
      "Cut tomatoes into wedges and beat the eggs.",
      "Heat oil over medium heat. Scramble eggs until set, then transfer to a plate.",
      "Cook tomatoes in the same pan for 5 minutes until softened. Return eggs, stir and heat through."
    ],
    "stepsZh": [
      "番茄切块，鸡蛋打散。",
      "中火热油，鸡蛋炒至凝固后盛出。",
      "原锅炒番茄约5分钟至软，放回鸡蛋拌匀并热透。"
    ],
    "cook": 15
  },
  {
    "id": "26102500-0000-4000-8000-000000000002",
    "title": "Garlic Broccoli",
    "titleZh": "蒜香西兰花",
    "cuisine": "Chinese",
    "meal": "dinner",
    "tags": [
      "savory",
      "vegan",
      "quick"
    ],
    "ingredients": [
      [
        "Broccoli",
        "西兰花",
        400,
        "g"
      ],
      [
        "Garlic",
        "大蒜",
        2,
        "cloves"
      ],
      [
        "Olive Oil",
        "橄榄油",
        10,
        "g"
      ]
    ],
    "steps": [
      "Cut broccoli into small florets and mince garlic.",
      "Heat oil over medium heat; stir garlic for 30 seconds.",
      "Add broccoli and 60 ml water. Cover for 4 minutes, then uncover and stir until tender."
    ],
    "stepsZh": [
      "西兰花切小朵，大蒜切末。",
      "中火热油，炒蒜末30秒。",
      "加西兰花和60毫升水，盖锅4分钟，开盖翻炒至熟软。"
    ],
    "cook": 15
  },
  {
    "id": "26102500-0000-4000-8000-000000000003",
    "title": "Spinach Egg Soup",
    "titleZh": "菠菜蛋花汤",
    "cuisine": "Chinese",
    "meal": "lunch",
    "tags": [
      "mild",
      "vegetarian",
      "quick"
    ],
    "ingredients": [
      [
        "Spinach",
        "菠菜",
        200,
        "g"
      ],
      [
        "Eggs",
        "鸡蛋",
        2,
        "pcs"
      ],
      [
        "Whole Milk",
        "全脂牛奶",
        100,
        "ml"
      ]
    ],
    "steps": [
      "Wash spinach and beat eggs.",
      "Bring 500 ml water to a boil. Add spinach and simmer for 2 minutes.",
      "Slowly stream eggs into the simmering soup. Cook until fully set, then stir in milk and heat through."
    ],
    "stepsZh": [
      "菠菜洗净，鸡蛋打散。",
      "500毫升水煮沸，加入菠菜煮2分钟。",
      "缓缓倒入蛋液，小火煮至完全凝固，加入牛奶并热透。"
    ],
    "cook": 15
  },
  {
    "id": "26102500-0000-4000-8000-000000000004",
    "title": "Chicken Pepper Skillet",
    "titleZh": "彩椒鸡肉",
    "cuisine": "Chinese",
    "meal": "dinner",
    "tags": [
      "savory",
      "high-protein",
      "quick"
    ],
    "ingredients": [
      [
        "Chicken Breast",
        "鸡胸肉",
        300,
        "g"
      ],
      [
        "Bell Pepper",
        "彩椒",
        250,
        "g"
      ],
      [
        "Olive Oil",
        "橄榄油",
        10,
        "g"
      ],
      [
        "Soy Sauce",
        "酱油",
        10,
        "ml"
      ]
    ],
    "steps": [
      "Slice chicken and pepper on separate boards.",
      "Heat oil over medium-high heat; stir fry chicken for 5 minutes.",
      "Add pepper and soy sauce. Cook until pepper is tender and chicken reaches 74°C in the thickest piece."
    ],
    "stepsZh": [
      "鸡胸肉和彩椒分开砧板切条。",
      "中大火热油，炒鸡肉约5分钟。",
      "加入彩椒和酱油，炒至彩椒熟软，最厚鸡肉中心达到74°C。"
    ],
    "cook": 15
  },
  {
    "id": "26102500-0000-4000-8000-000000000005",
    "title": "Lemon Broccoli Pasta",
    "titleZh": "柠檬西兰花意面",
    "cuisine": "Italian",
    "meal": "lunch",
    "tags": [
      "mild",
      "vegetarian"
    ],
    "ingredients": [
      [
        "Pasta",
        "意大利面",
        160,
        "g"
      ],
      [
        "Broccoli",
        "西兰花",
        200,
        "g"
      ],
      [
        "Lemon",
        "柠檬",
        1,
        "pcs"
      ],
      [
        "Olive Oil",
        "橄榄油",
        10,
        "g"
      ]
    ],
    "steps": [
      "Boil pasta according to its packet; add broccoli for the final 4 minutes.",
      "Reserve 60 ml pasta water, then drain.",
      "Toss pasta and broccoli with oil, lemon juice to taste and enough pasta water to coat."
    ],
    "stepsZh": [
      "按包装说明煮意面，最后4分钟加入西兰花。",
      "留60毫升煮面水后沥干。",
      "意面和西兰花拌入橄榄油、适量柠檬汁和煮面水即可。"
    ],
    "cook": 15
  },
  {
    "id": "26102500-0000-4000-8000-000000000006",
    "title": "Tomato Spinach Pasta",
    "titleZh": "番茄菠菜意面",
    "cuisine": "Italian",
    "meal": "dinner",
    "tags": [
      "savory",
      "vegan"
    ],
    "ingredients": [
      [
        "Pasta",
        "意大利面",
        160,
        "g"
      ],
      [
        "Tomatoes",
        "番茄",
        300,
        "g"
      ],
      [
        "Spinach",
        "菠菜",
        150,
        "g"
      ],
      [
        "Olive Oil",
        "橄榄油",
        10,
        "g"
      ]
    ],
    "steps": [
      "Cook pasta following the packet instructions and drain.",
      "Dice tomatoes. Heat oil and simmer tomatoes over medium heat for 8 minutes.",
      "Stir in spinach until wilted, then add pasta and heat through."
    ],
    "stepsZh": [
      "按包装说明煮熟意面并沥干。",
      "番茄切丁，热油后中火煮番茄8分钟。",
      "加入菠菜炒软，拌入意面并热透。"
    ],
    "cook": 20
  },
  {
    "id": "26102500-0000-4000-8000-000000000007",
    "title": "Broccoli Cheese Omelette",
    "titleZh": "西兰花芝士蛋饼",
    "cuisine": "American",
    "meal": "breakfast",
    "tags": [
      "savory",
      "vegetarian",
      "quick"
    ],
    "ingredients": [
      [
        "Eggs",
        "鸡蛋",
        3,
        "pcs"
      ],
      [
        "Broccoli",
        "西兰花",
        150,
        "g"
      ],
      [
        "Parmesan",
        "帕尔玛奶酪",
        20,
        "g"
      ],
      [
        "Olive Oil",
        "橄榄油",
        10,
        "g"
      ]
    ],
    "steps": [
      "Finely chop broccoli and beat eggs with grated cheese.",
      "Heat oil over medium heat. Add broccoli and 30 ml water; cover for 3 minutes until tender.",
      "Pour in eggs, reduce heat and cover until fully set, about 5 minutes."
    ],
    "stepsZh": [
      "西兰花切碎，鸡蛋打散拌入芝士碎。",
      "中火热油，加西兰花和30毫升水，盖锅3分钟至熟软。",
      "倒入蛋液，转小火盖锅约5分钟至完全凝固。"
    ],
    "cook": 15
  },
  {
    "id": "26102500-0000-4000-8000-000000000008",
    "title": "Avocado Tomato Salad",
    "titleZh": "牛油果番茄沙拉",
    "cuisine": "American",
    "meal": "lunch",
    "tags": [
      "mild",
      "vegan",
      "quick"
    ],
    "ingredients": [
      [
        "Avocado",
        "牛油果",
        1,
        "pcs"
      ],
      [
        "Tomatoes",
        "番茄",
        250,
        "g"
      ],
      [
        "Lemon",
        "柠檬",
        1,
        "pcs"
      ],
      [
        "Olive Oil",
        "橄榄油",
        10,
        "g"
      ]
    ],
    "steps": [
      "Wash tomatoes and cut into bite-sized pieces.",
      "Halve avocado, remove pit and scoop flesh into cubes.",
      "Toss with tomatoes, olive oil and lemon juice to taste. Serve immediately."
    ],
    "stepsZh": [
      "番茄洗净切块。",
      "牛油果去核，将果肉切块。",
      "与番茄、橄榄油和适量柠檬汁拌匀，立即食用。"
    ],
    "cook": 15
  },
  {
    "id": "26102500-0000-4000-8000-000000000009",
    "title": "Salmon Broccoli Tray Bake",
    "titleZh": "三文鱼西兰花烤盘",
    "cuisine": "American",
    "meal": "dinner",
    "tags": [
      "savory",
      "high-protein",
      "low-carb"
    ],
    "ingredients": [
      [
        "Salmon Fillet",
        "三文鱼",
        300,
        "g"
      ],
      [
        "Broccoli",
        "西兰花",
        300,
        "g"
      ],
      [
        "Lemon",
        "柠檬",
        1,
        "pcs"
      ],
      [
        "Olive Oil",
        "橄榄油",
        10,
        "g"
      ]
    ],
    "steps": [
      "Preheat oven to 200°C. Cut broccoli into small florets.",
      "Place salmon and broccoli on a tray. Coat with oil and squeeze lemon over them.",
      "Roast for 15–20 minutes until broccoli is tender and salmon reaches 63°C in the thickest part."
    ],
    "stepsZh": [
      "烤箱预热200°C，西兰花切小朵。",
      "三文鱼和西兰花放入烤盘，淋油和柠檬汁。",
      "烤15至20分钟，至西兰花熟软，三文鱼最厚处中心达到63°C。"
    ],
    "cook": 20
  },
  {
    "id": "26102500-0000-4000-8000-000000000010",
    "title": "Garlic Mushroom Skillet",
    "titleZh": "蒜香蘑菇",
    "cuisine": "Chinese",
    "meal": "dinner",
    "tags": [
      "savory",
      "vegan",
      "quick"
    ],
    "ingredients": [
      [
        "Mushrooms",
        "蘑菇",
        400,
        "g"
      ],
      [
        "Garlic",
        "大蒜",
        2,
        "cloves"
      ],
      [
        "Olive Oil",
        "橄榄油",
        10,
        "g"
      ],
      [
        "Soy Sauce",
        "酱油",
        10,
        "ml"
      ]
    ],
    "steps": [
      "Clean and slice mushrooms. Mince garlic.",
      "Heat oil over medium-high heat. Cook mushrooms for 6–8 minutes until softened and moisture evaporates.",
      "Add garlic and stir for 30 seconds, then add soy sauce and cook for 1 minute."
    ],
    "stepsZh": [
      "蘑菇清洁后切片，大蒜切末。",
      "中大火热油，炒蘑菇6至8分钟至软并收干水分。",
      "加蒜末炒30秒，加酱油再炒1分钟。"
    ],
    "cook": 15
  }
];

export class QuickRecipeCatalog1792900000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    const recipes = q.manager.getRepository(Recipe);
    const ingredients = await q.manager.getRepository(Ingredient).find();
    for (const item of quickRecipes) {
      if (await recipes.findOne({ where: { id: item.id } })) continue;
      await recipes.save(recipes.create({
        id: item.id, title: item.title, titleEn: item.title, titleZh: item.titleZh,
        description: item.title, descriptionEn: item.title, descriptionZh: item.titleZh,
        cuisineType: item.cuisine, cuisines: [item.cuisine], mealType: item.meal as RecipeMealType,
        difficulty: RecipeDifficulty.EASY, prepTimeMin: 5, cookTimeMin: item.cook, servings: 2,
        caloriesPerServing: null, tags: item.tags,
        dietTypes: item.tags.includes('vegan') ? ['vegan', 'vegetarian'] : item.tags.includes('vegetarian') ? ['vegetarian'] : [],
        requiredTools: [], isSystem: true, isPublished: true,
        reviewStatus: RecipeReviewStatus.APPROVED, status: RecipeStatus.PUBLISHED,
      }));
      for (const [index, line] of item.ingredients.entries()) {
        const [en, zh, quantity, unit] = line;
        const ingredient = ingredients.find(ing => ing.name.toLowerCase() === String(en).toLowerCase() || ing.nameZh === zh);
        await q.manager.getRepository(RecipeIngredient).save({ recipeId: item.id,
          ingredientId: ingredient?.id ?? null, displayName: String(en), displayNameEn: String(en),
          displayNameZh: String(zh), quantity: Number(quantity), unit: String(unit), sortOrder: index, isOptional: false });
      }
      for (const [index, description] of item.steps.entries()) {
        await q.manager.getRepository(RecipeStep).save({ recipeId: item.id, stepNumber: index + 1,
          description, descriptionEn: description, descriptionZh: item.stepsZh[index], durationMin: null });
      }
    }
  }
  async down(q: QueryRunner): Promise<void> {
    for (const item of quickRecipes) await q.manager.getRepository(Recipe).delete(item.id);
  }
}
