import { searchSuggestionTags } from './search-suggestion-tags';
import { Recipe } from '../../database/entities/recipe.entity';
describe('recommendation-driven search tags', () => {
  it('changes with recommendation results and removes empty/case-duplicate labels', () => {
    const tags = searchSuggestionTags([{ cuisineType: 'Italian', mealType: 'dinner', tags: ['Pasta', ' pasta ', ''] }] as Recipe[]);
    expect(tags).toEqual(['Italian', 'dinner', 'Pasta']);
    expect(searchSuggestionTags([{ cuisineType: 'Thai', tags: ['Soup'] }] as Recipe[])).toEqual(['Thai', 'Soup']);
    expect(searchSuggestionTags([])).toEqual([]);
  });
  it('bounds rendered suggestions for a broad catalog', () => {
    expect(searchSuggestionTags([{ tags: Array.from({ length: 20 }, (_, i) => `tag${i}`) }] as Recipe[])).toHaveLength(8);
  });
});
