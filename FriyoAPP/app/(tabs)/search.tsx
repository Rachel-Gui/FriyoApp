import { LocalizedText as Text, LocalizedTextInput as TextInput, LocalizedTouchableOpacity as TouchableOpacity } from '@/components/ui/LocalizedNative';
import { useLanguageStore } from '@/store/languageStore';
import { localizeRecipe, recipeText, hasRecipeTranslation } from '@/services/recipeLanguage';
import { recipeSource } from '@/services/recipeSource';
import { useEffect, useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { View, FlatList, Image, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { recipeService } from '@/services/recipeService';
import { localImageForRecipe } from '@/services/localRecipeImages';
import type { Recipe } from '@/services/types';


export default function RecipeSearch() {
  const language = useLanguageStore(state => state.language);
  const t = (text: string) => recipeText(text, language);
  const router = useRouter();
  const [suggestions, setSuggestions] = useState<string[]>([]);
  useFocusEffect(useCallback(() => { let active = true; recipeService.getSearchSuggestions().then(values => { if (active) setSuggestions(values); }).catch(() => {}); return () => { active = false; }; }, []));
  const [category, setCategory] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasMore, setHasMore] = useState(false);
  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    const timer = setTimeout(async () => {
      try {
        const result = (query.trim() || category)
          ? await recipeService.searchRecipes({ q: query.trim(), category: category || undefined, page, limit: 20 })
          : await recipeService.listRecipes(page, 20);
        if (!active) return;
        setRecipes(previous => page === 1 ? result.items : [...previous, ...result.items]);
        setHasMore(page < (result.pages ?? 1));
      } catch (e: any) { if (active) { setError(e?.message ?? 'Could not load recipes.'); setRecipes([]); } }
      finally { if (active) setLoading(false); }
    }, 300);
    return () => { active = false; clearTimeout(timer); };
  }, [query, category, page]);
  const search = (text: string) => { setQuery(text); setPage(1); setRecipes([]); };
  return <SafeAreaView style={s.root}>
    <View style={s.header}>
      <TouchableOpacity onPress={() => router.back()} accessibilityLabel={t('Go back')}><Text style={s.back}>←</Text></TouchableOpacity>
      <Text style={s.title}>{t('Find a Recipe')}</Text>
    </View>
    <TextInput style={s.input} value={query} onChangeText={search} maxLength={120} placeholder={t('Search titles, cuisines or ingredients')} returnKeyType="search" autoCapitalize="none" accessibilityLabel={t('Search recipes')} />
    <View style={s.suggestions}><Text style={s.hint}>{t('Categories')}</Text><View style={s.chips}>{['', 'Breakfast', 'Vegetarian', 'Pasta', 'Seafood', 'Dessert'].map(value => <TouchableOpacity key={value} style={[s.chip, { opacity: category === value ? 1 : 0.55 }]} onPress={() => { setCategory(value); setPage(1); setRecipes([]); }}><Text>{t(value || 'All')}</Text></TouchableOpacity>)}</View></View>
    {!query && suggestions.length > 0 && <View style={s.suggestions}>
      <Text style={s.hint}>{t('Try a keyword')}</Text>
      <View style={s.chips}>{suggestions.map(word => <TouchableOpacity key={word} style={s.chip} onPress={() => search(word)}><Text>{word}</Text></TouchableOpacity>)}</View>
    </View>}
    {error ? <Text accessibilityRole="alert" style={s.message}>{error}</Text> : null}
    <FlatList data={recipes} keyExtractor={recipe => recipe.id} contentContainerStyle={s.list} keyboardShouldPersistTaps="handled"
      renderItem={({ item, index }) => <TouchableOpacity style={s.card} onPress={() => router.push({ pathname: '/(tabs)/recipe/[id]', params: { id: item.id, from: 'search' } })}>
        <Image source={item.imageUrl ? { uri: item.imageUrl } : localImageForRecipe(item, index)} style={s.image} />
        <View style={s.detail}><Text style={s.name}>{localizeRecipe(item, language).title}</Text>{!hasRecipeTranslation(item, language) && <Text style={s.hint}>{t('Original text (translation unavailable)')}</Text>}<Text style={s.hint}>{item.prepTimeMin + item.cookTimeMin > 0 ? `${item.prepTimeMin + item.cookTimeMin} ${t('min')}` : '—'} · {t(item.cuisineType || 'Recipe')}</Text><Text style={s.hint}>{t('Source')}: {recipeSource(item.sourceUrl)}</Text></View>
      </TouchableOpacity>}
      ListEmptyComponent={!loading && !error ? <Text style={s.message}>{t('No recipes found. Try another keyword.')}</Text> : null}
      ListFooterComponent={loading ? <ActivityIndicator style={s.message} /> : hasMore ? <TouchableOpacity onPress={() => setPage(p => p + 1)}><Text style={s.message}>{t('Load more recipes')}</Text></TouchableOpacity> : null}
    />
  </SafeAreaView>;
}
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.cream }, header: { flexDirection: 'row', alignItems: 'center', gap: 18, padding: 20 },
  back: { fontSize: 28 }, title: { fontSize: 24, fontFamily: 'DMSans_700Bold' }, input: { marginHorizontal: 20, padding: 16, backgroundColor: 'white', borderRadius: 18, fontSize: 16 },
  suggestions: { padding: 20, gap: 12 }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, chip: { backgroundColor: Colors.yellow, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20 },
  list: { padding: 20, paddingBottom: 40, gap: 14 }, card: { flexDirection: 'row', backgroundColor: 'white', borderRadius: 18, overflow: 'hidden' },
  image: { width: 96, height: 96 }, detail: { flex: 1, padding: 14, justifyContent: 'center', gap: 8 }, name: { fontSize: 16, fontFamily: 'DMSans_700Bold' }, hint: { color: Colors.gray, fontSize: 13 }, message: { textAlign: 'center', padding: 20, color: Colors.gray },
});
