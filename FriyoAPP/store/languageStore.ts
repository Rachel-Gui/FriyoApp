import { create } from 'zustand';
export type RecipeLanguage = 'en' | 'zh';
// English-only release: ignore language saved by previous bilingual versions.
export const useLanguageStore = create<{ language: RecipeLanguage; setLanguage: (language: RecipeLanguage) => void }>()(() => ({
  language: 'en',
  setLanguage: () => {},
}));
