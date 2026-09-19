import type { ImageSourcePropType } from 'react-native';
import type { Recipe } from './types';

export const LOCAL_RECIPE_IMAGES = {
  potatoBroccoliGratin: require('../menu/recipe-1778821987752.png'),
  charredBroccoli: require('../menu/recipe-1778822076617.png'),
  sesameBroccoli: require('../menu/recipe-1778822112399.png'),
  blueberryYogurtJars: require('../menu/recipe-1778822177301.png'),
  matchaMochiDessert: require('../menu/recipe-1778822373100.png'),
  berryDessertBowl: require('../menu/recipe-1778822409983.png'),
  snowFungusPorridge: require('../menu/recipe-1778822454734.png'),
  spicyPotatoWedges: require('../menu/recipe-1778822527885.png'),
  koreanGlazedPotatoes: require('../menu/recipe-1778822566718.png'),
  crispyChickenPotatoes: require('../menu/recipe-1778822617466.png'),
  loadedPotatoSkins: require('../menu/recipe-1778822677883.png'),
} as const;

const FALLBACK_IMAGE_SEQUENCE: ImageSourcePropType[] = [
  LOCAL_RECIPE_IMAGES.charredBroccoli,
  LOCAL_RECIPE_IMAGES.sesameBroccoli,
  LOCAL_RECIPE_IMAGES.blueberryYogurtJars,
  LOCAL_RECIPE_IMAGES.matchaMochiDessert,
  LOCAL_RECIPE_IMAGES.berryDessertBowl,
  LOCAL_RECIPE_IMAGES.snowFungusPorridge,
  LOCAL_RECIPE_IMAGES.spicyPotatoWedges,
  LOCAL_RECIPE_IMAGES.koreanGlazedPotatoes,
  LOCAL_RECIPE_IMAGES.crispyChickenPotatoes,
  LOCAL_RECIPE_IMAGES.loadedPotatoSkins,
  LOCAL_RECIPE_IMAGES.potatoBroccoliGratin,
];

export function localImageForText(text: string, fallbackIndex = 0): ImageSourcePropType {
  const source = text.toLowerCase();

  if (/loaded|potato skin|skins|jalapeno|cheddar|bacon/.test(source)) {
    return LOCAL_RECIPE_IMAGES.loadedPotatoSkins;
  }
  if (/chicken|poultry|roasted bird|crispy.*potato/.test(source)) {
    return LOCAL_RECIPE_IMAGES.crispyChickenPotatoes;
  }
  if (/korean|gochujang|kimchi|gamja|glazed potato|sesame potato/.test(source)) {
    return LOCAL_RECIPE_IMAGES.koreanGlazedPotatoes;
  }
  if (/wedge|spicy potato|chili potato|paprika potato|roasted wedge/.test(source)) {
    return LOCAL_RECIPE_IMAGES.spicyPotatoWedges;
  }
  if (/snow fungus|tremella|white fungus|sweet soup|porridge|congee|goji|red date/.test(source)) {
    return LOCAL_RECIPE_IMAGES.snowFungusPorridge;
  }
  if (/matcha|mochi|rice cake|green tea|strawberry.*mochi/.test(source)) {
    return LOCAL_RECIPE_IMAGES.matchaMochiDessert;
  }
  if (/rice pudding|dessert bowl|berry bowl|blueberry dessert|warm berry/.test(source)) {
    return LOCAL_RECIPE_IMAGES.berryDessertBowl;
  }
  if (/blueberry|yogurt jar|breakfast jar|parfait|jam|strawberry|banana/.test(source)) {
    return LOCAL_RECIPE_IMAGES.blueberryYogurtJars;
  }
  if (/sesame broccoli|broccoli.*sesame|grain bowl.*broccoli|broccoli bowl/.test(source)) {
    return LOCAL_RECIPE_IMAGES.sesameBroccoli;
  }
  if (/charred broccoli|lime feta|roasted broccoli|broccoli.*lime|broccoli.*feta/.test(source)) {
    return LOCAL_RECIPE_IMAGES.charredBroccoli;
  }
  if (/potato gratin|broccoli potato|fritter|gratin|potato/.test(source)) {
    return LOCAL_RECIPE_IMAGES.potatoBroccoliGratin;
  }
  if (/broccoli/.test(source)) {
    return LOCAL_RECIPE_IMAGES.charredBroccoli;
  }

  return FALLBACK_IMAGE_SEQUENCE[fallbackIndex % FALLBACK_IMAGE_SEQUENCE.length];
}

export function localImageForRecipe(recipe: Recipe, fallbackIndex = 0): ImageSourcePropType {
  return localImageForText([
    recipe.title,
    recipe.description,
    recipe.cuisineType,
    recipe.mealType,
    ...(recipe.tags ?? []),
    ...(recipe.ingredients ?? []).map(item => item.ingredientName),
  ].join(' '), fallbackIndex);
}
