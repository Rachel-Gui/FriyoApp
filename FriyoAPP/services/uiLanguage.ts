import translations from './uiTranslations.json';
import { recipeText, type RecipeLanguage } from './recipeLanguage';
const normalize = (value: string) => value.trim().replace(/\s+/g, ' ');
const chinese = new Map(Object.entries(translations).map(([key, value]) => [normalize(key).toLowerCase(), value]));
/** UI labels only. Never use this to translate user input, identifiers or API values. */
export function translateUI(value: string, language: RecipeLanguage): string {
  if (language === 'en' || value.trim() === 'DELETE') return value;
  const key = normalize(value);
  const text = chinese.get(key.toLowerCase()) || recipeText(key, language);
  if (text !== key) return (value.match(/^\s*/)?.[0] || '') + text + (value.match(/\s*$/)?.[0] || '');
  if (key.endsWith(':')) {
    const label = translateUI(key.slice(0, -1), language);
    if (label !== key.slice(0, -1)) return label + '：';
  }
  const days = key.match(/^(\d+)\s*(?:day|days)(?: left)?$/i);
  if (days) return `${days[1]} 天`;
  const step = key.match(/^Step (\d+)(?: of (\d+))?$/i);
  if (step) return `步骤 ${step[1]}${step[2] ? ` / ${step[2]}` : ''}`;
  const coverage = key.match(/^(\d+)% ingredients available(.*)$/);
  if (coverage) return `${coverage[1]}% 食材已备齐${coverage[2].replace('Missing:', '缺少：').replace('Ready to cook', '可以开始烹饪')}`;
  const remaining = key.match(/^(\d+)\s*(?:min|mins|minutes|kcal|items?|reviews|people)$/i);
  if (remaining) return `${remaining[1]} ${translateUI(key.slice(remaining[1].length).trim(), language)}`;
  return value;
}
