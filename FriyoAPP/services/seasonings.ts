/** Conservative names: avoid treating foods such as bell peppers as seasonings. */
export function isSeasoning(name: string): boolean {
  return /^(salt and pepper|salt & pepper|pepper|ground pepper|oil|rapeseed oil|sunflower oil|canola oil|chili powder|chilli powder|paprika|cumin|ground cumin|cinnamon|dried oregano|dried basil|salt|sea salt|kosher salt|table salt|black pepper|ground black pepper|white pepper|soy sauce|light soy sauce|dark soy sauce|olive oil|extra virgin olive oil|vegetable oil|cooking oil|sesame oil|vinegar|rice vinegar|sugar|盐和胡椒|辣椒粉|孜然|孜然粉|肉桂粉|菜籽油|葵花籽油|盐|食盐|海盐|黑胡椒|黑胡椒粉|白胡椒粉|酱油|生抽|老抽|橄榄油|食用油|植物油|香油|醋|米醋|白糖)$/i.test(name.trim());
}
