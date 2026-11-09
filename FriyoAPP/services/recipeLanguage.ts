import type { Recipe, RecipeForCooking } from './types';
export type RecipeLanguage = 'en' | 'zh';
export function translatedText(original: string | null | undefined, en: string | null | undefined, zh: string | null | undefined, language: RecipeLanguage) {
  return (language === 'zh' ? zh : en)?.trim() || original || '';
}
export function localizeRecipe(recipe: Recipe, language: RecipeLanguage): Recipe {
  return { ...recipe,
    title: translatedText(recipe.title, recipe.titleEn, recipe.titleZh, language),
    description: translatedText(recipe.description, recipe.descriptionEn, recipe.descriptionZh, language),
    ingredients: recipe.ingredients.map(line => ({ ...line, ingredientName: translatedText(line.ingredientName, line.ingredientNameEn, line.ingredientNameZh, language) })),
    steps: recipe.steps.map(step => ({ ...step, description: translatedText(step.description, step.descriptionEn, step.descriptionZh, language), tips: translatedText(step.tips, step.tipsEn, step.tipsZh, language) })),
  };
}
export function localizeCooking(data: RecipeForCooking, language: RecipeLanguage): RecipeForCooking {
  const recipe = localizeRecipe(data.recipe, language);
  // Match status stays associated with the original ingredient, not its translated label.
  const names = new Map(data.recipe.ingredients.map((line, i) => [line.ingredientName.trim().toLowerCase(), recipe.ingredients[i].ingredientName]));
  return { ...data, recipe, adaptation: data.adaptation ? { ...data.adaptation, adaptedSteps: data.adaptation.adaptedSteps.map(step => ({ ...step, description: translatedText(step.description, step.descriptionEn, step.descriptionZh, language), tips: translatedText(step.tips, step.tipsEn, step.tipsZh, language) })) } : null, fridgeStatus: data.fridgeStatus.map(status => ({ ...status, ingredientName: names.get(status.ingredientName.trim().toLowerCase()) || status.ingredientName })) };
}
const zh: Record<string, string> = {
 'g':'克', 'ml':'毫升', 'pcs':'个', 'cloves':'瓣', 'tbsp':'汤匙', 'tsp':'茶匙', 'cup':'杯', 'Recipe unavailable':'食谱暂不可用', 'Friyo could not load this recipe. Check your connection and try again.':'无法加载食谱，请检查网络后重试。', 'Smart Inventory':'智能库存', 'Record New Ingredients':'记录新食材', 'Add your ingredients to discover recipes matched to your fridge.':'添加食材，发现与冰箱库存匹配的食谱。', 'Update Fridge':'更新冰箱', 'Missing':'缺少', 'Could not save recipe':'无法保存食谱', 'Please try again.':'请重试。', 'Could not log meal':'无法记录餐食', 'Nothing to add':'无需添加', 'You already have every ingredient for this recipe.':'冰箱里已有这道菜所需的全部食材。', 'Added to Shopping List':'已加入购物清单', 'Could not update list':'无法更新清单', 'Could not open source':'无法打开来源链接', 'Done':'完成',
 'Go back':'返回', 'Find a Recipe':'搜索食谱', 'Search recipes':'搜索食谱', 'Search titles, cuisines or ingredients':'搜索菜名、菜系或食材（中文 / English）', 'Categories':'分类', 'All':'全部', 'Breakfast':'早餐', 'Vegetarian':'素食', 'Pasta':'意面', 'Seafood':'海鲜', 'Dessert':'甜点', 'Try a keyword':'试试这些关键词', 'No recipes found. Try another keyword.':'没有找到食谱，请试试其他关键词。', 'Load more recipes':'加载更多食谱', 'Could not load recipes.':'无法加载食谱，请重试。', 'Source':'来源', 'Recipe':'食谱', 'min':'分钟',
 'Ingredients':'食材', 'How to Cook':'烹饪步骤', 'Reviews':'评价', 'Fridge match':'冰箱食材匹配', 'items':'种食材', 'Need to buy':'需要购买', 'View original':'查看原文', 'Servings':'份数', 'In Fridge':'冰箱已有', 'Buy':'购买', 'Add Missing Ingredients to List':'将缺少的食材加入购物清单', 'Hands-on':'动手操作', 'Hands-off (wait)':'等待', 'Start Cooking':'开始烹饪', 'Step':'步骤', 'Time':'用时', 'Calories':'热量', 'Difficulty':'难度', 'ppl':'人份', 'kcal':'千卡', 'easy':'简单', 'medium':'中等', 'hard':'困难', 'Cooking steps unavailable':'无法加载烹饪步骤', 'Friyo could not load this recipe. Please check your connection.':'无法加载食谱，请检查网络连接。', 'REST':'等待', 'COOK':'烹饪', 'MINS':'分', 'SECS':'秒', 'Done! Continue to next step.':'计时结束，可以继续下一步。', 'Pause Timer':'暂停计时', 'Start Timer':'开始计时', 'Ingredients for this step':'本步骤食材', '← Previous':'← 上一步', '🎉  Finish Cooking':'🎉  完成烹饪', 'Next Step →':'下一步 →',
 'Original text (translation unavailable)':'原文（暂无译文）', 'From Your Fridge':'根据冰箱食材推荐', 'Make the most of what you have':'用已有食材做好每一餐', 'For Your Taste':'猜你喜欢', 'Inspired by your cooking preferences':'根据你的烹饪偏好推荐', 'Saved Recipes':'收藏食谱', 'Your favorites, ready to cook':'喜欢的食谱，随时开做', 'Search recipes…':'搜索食谱…', 'No recipes available yet':'暂无食谱', 'Add ingredients to your fridge or try again when you are online.':'添加冰箱食材，或连接网络后重试。', 'See All':'查看全部', 'Search':'搜索', 'Fridge':'冰箱', 'Meals':'餐食',
 'Greek':'希腊菜', 'Spanish':'西班牙菜', 'Moroccan':'摩洛哥菜', 'Algerian':'阿尔及利亚菜', 'Japanese':'日本菜', 'Indian':'印度菜', 'Thai':'泰国菜', 'Mexican':'墨西哥菜', 'Turkish':'土耳其菜', 'Korean':'韩国菜', 'Vietnamese':'越南菜',
 'Italian':'意大利菜', 'French':'法国菜', 'American':'美式菜', 'British':'英式菜', 'Chinese':'中餐', 'breakfast':'早餐', 'lunch':'午餐', 'dinner':'晚餐', 'snack':'加餐',
};
export function recipeText(text: string, language: RecipeLanguage): string { return language === 'zh' ? zh[text] || text : text; }
export function hasRecipeTranslation(recipe: Recipe, language: RecipeLanguage) {
  const target = language === 'zh' ? /[\u3400-\u9fff]/ : /[a-zA-Z]/;
  return target.test(translatedText(recipe.title, recipe.titleEn, recipe.titleZh, language)) && recipe.steps.every(step => target.test(translatedText(step.description, step.descriptionEn, step.descriptionZh, language)));
}
