// Shared vocabulary for keyword search, external queries and custom fridge names.
const groups = [
 ['chicken', '鸡肉'], ['chicken breast', '鸡胸肉'], ['beef', '牛肉'], ['pork', '猪肉'],
 ['tomato', 'tomatoes', '番茄', '西红柿'], ['egg', 'eggs', '鸡蛋'], ['potato', 'potatoes', '土豆', '马铃薯'],
 ['garlic', '大蒜', '蒜'], ['spinach', '菠菜'], ['salmon', '三文鱼'], ['salmon fillet', '三文鱼柳'],
 ['pasta', '意面', '意大利面'], ['olive oil', '橄榄油'], ['butter', '黄油'], ['whole milk', '全脂牛奶', '牛奶', 'milk'],
 ['heavy cream', '淡奶油', '奶油'], ['parmesan', '帕尔马干酪', '帕尔玛奶酪'], ['sun-dried tomatoes', '油浸番茄干', '晒干番茄', '番茄干'], ['lemon', '柠檬'],
 ['rice', '大米'], ['cooked rice', '米饭'], ['onion', 'onions', '洋葱'], ['carrot', 'carrots', '胡萝卜'],
 ['breakfast', '早餐'], ['lunch', '午餐'], ['dinner', '晚餐'], ['snack', '加餐'],
 ['vegetarian', '素食'], ['vegan', '纯素'], ['seafood', '海鲜'], ['dessert', '甜点', '甜品'],
 ['soup', '汤'], ['salad', '沙拉'], ['italian', '意大利菜'], ['chinese', '中餐'], ['french', '法国菜'],
];
export const normalizedName = (name: string) => name.normalize('NFKC').toLowerCase().replace(/[\s_-]+/g, '').trim();
function groupFor(query: string) { return groups.find(group => group.some(word => normalizedName(word) === normalizedName(query))); }
export function searchKeywords(query: string): string[] { return [...new Set([query.trim(), ...(groupFor(query) ?? [])])]; }
export function externalKeyword(query: string): string { return groupFor(query)?.[0] ?? query.trim(); }
export function chineseIngredientName(name: string): string | null { return groupFor(name)?.find(word => /[\u3400-\u9fff]/.test(word)) ?? null; }
export function equivalentIngredientName(name: string): string { return normalizedName(groupFor(name)?.[0] ?? name); }
