import { fridgeService } from '@/services/fridgeService';
import { isSeasoning } from '@/services/seasonings';
import { LocalizedText as Text, LocalizedTouchableOpacity as TouchableOpacity } from '@/components/ui/LocalizedNative';
import { useLanguageStore } from '@/store/languageStore';
import { localizeRecipe, recipeText, hasRecipeTranslation } from '@/services/recipeLanguage';
import { View, ScrollView, Image, StyleSheet, Dimensions, Animated, LayoutAnimation, Platform, UIManager, ActivityIndicator, Alert } from 'react-native';
import { useRef, useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Colors }           from '@/constants/Colors';
import { SFIcon }           from '@/components/ui/SFIcon';
import { RecipeMetaChip }   from '@/components/ui/RecipeMetaChip';
import { useAuthStore }     from '@/store/authStore';
import { recipeService }    from '@/services/recipeService';
import { localImageForRecipe } from '@/services/localRecipeImages';
import type { Recipe }      from '@/services/types';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

const { width } = Dimensions.get('window');

// Card dimensions
const CARD_W      = width * 0.74;
const CARD_GAP    = 14;
const CARD_RADIUS = 22;

// Nav geometry (must match _layout.tsx)
const PILL_H    = 64;
const BAR_ABOVE = 6; // gap above safe area

const AVATAR_COLORS = ['#F6C453', '#8EC5FC', '#A8E6A3', '#F7A8A8', '#C7B9FF', '#7DD3C7'];
const avatarColor = (seed: string) => {
  const total = seed.split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return AVATAR_COLORS[total % AVATAR_COLORS.length];
};
const initialsFor = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('') || 'C';

// ── Animated recipe card ──────────────────────────────────────────────────────
function RecipeCard({
  recipe,
  index,
  imageIndex,
  showTimeBadge = false,
  onPress,
}: {
  recipe: Recipe;
  index: number;
  imageIndex: number;
  showTimeBadge?: boolean;
  onPress: () => void;
}) {
  const queryClient = useQueryClient();
  const { data: saved = [] } = useQuery({ queryKey: ['recipes', 'saved'], queryFn: recipeService.getSavedRecipes });
  const isSaved = saved.some(item => item.id === recipe.id);
  const [savePending, setSavePending] = useState(false);
  const toggleSave = async () => {
    if (savePending) return;
    setSavePending(true);
    try {
      if (isSaved) await recipeService.unsaveRecipe(recipe.id);
      else await recipeService.saveRecipe(recipe.id);
      await queryClient.invalidateQueries({ queryKey: ['recipes', 'saved'] });
    } catch { Alert.alert('Could not save recipe', 'Please try again.'); }
    finally { setSavePending(false); }
  };
  const scale = useRef(new Animated.Value(1)).current;

  const pressIn  = () => Animated.spring(scale, { toValue: 0.965, useNativeDriver: true, stiffness: 420, damping: 24, mass: 0.7 }).start();
  const pressOut = () => Animated.spring(scale, { toValue: 1,     useNativeDriver: true, stiffness: 260, damping: 26, mass: 0.8 }).start();

  const totalMin = (recipe.prepTimeMin ?? 0) + (recipe.cookTimeMin ?? 0);
  const timeLabel = totalMin > 0 ? `${totalMin} min` : '—';
  const imgSource = recipe.imageUrl ? { uri: recipe.imageUrl } : localImageForRecipe(recipe, imageIndex);
  const language = useLanguageStore(state => state.language);
  const t = (text: string) => recipeText(text, language);
  const TODAY = new Date().toLocaleDateString(language === 'zh' ? 'zh-CN' : 'en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const displayTitle = localizeRecipe(recipe, language).title?.trim() || recipeText('Recipe', language);

  return (
    <Animated.View style={[s.card, { transform: [{ scale }] }]}>
      <TouchableOpacity activeOpacity={1} onPress={onPress} onPressIn={pressIn} onPressOut={pressOut}>
        <View style={s.cardImageWrap}>
          <Image source={imgSource} style={s.cardImage} resizeMode="cover" />
          <View style={s.cardImageShade} />
          <Text style={s.cardImageTitle} numberOfLines={2}>{displayTitle}</Text>
        </View>

        {recipe.fridgeMatchRatio !== undefined && <View style={{ padding: 10, gap: 4 }}>
          <Text style={{ color: Colors.black }}>{recipe.fridgeMatchRatio}% main ingredients available</Text>
          {!!recipe.missingIngredients?.filter(item => !isSeasoning(item.name)).length && <Text style={{ color: Colors.gray }}>Missing: {recipe.missingIngredients.filter(item => !isSeasoning(item.name)).map(item => item.name).join(', ')}</Text>}
          <Text style={{ color: Colors.gray }}>Confirm seasonings in recipe</Text>
        </View>}
        {recipe.difficulty ? (
          <View style={[s.badge, { backgroundColor: Colors.green }]}>
            <Text style={s.badgeText}>{t(recipe.difficulty).toUpperCase()}</Text>
          </View>
        ) : null}

        {showTimeBadge && totalMin > 0 ? (
          <View style={s.timeBadge}>
            <SFIcon name="timer" size={12} color={Colors.black} />
            <Text style={s.timeBadgeText}>{timeLabel.replace('min', t('min'))}</Text>
          </View>
        ) : null}


        <View style={s.cardBody}>
          <Text style={s.cardName} numberOfLines={2}>{displayTitle}</Text>
          {!hasRecipeTranslation(recipe, language) && <Text style={{ fontSize: 11, color: Colors.gray }}>{t('Original text (translation unavailable)')}</Text>}
          <View style={s.cardMeta}>
            <RecipeMetaChip icon="timer" label={timeLabel.replace('min', t('min'))} iconColor="rgba(0,0,0,0.45)" />
            {recipe.mealType ? <RecipeMetaChip label={t(recipe.mealType)} /> : null}
            {recipe.caloriesPerServing ? (
              <RecipeMetaChip icon="flame.fill" iconWeight="fill" label={`${recipe.caloriesPerServing} kcal`} iconColor="#F59E0B" />
            ) : null}
          </View>
        </View>
      </TouchableOpacity>
      <TouchableOpacity style={s.bookmarkBtn} onPress={toggleSave} disabled={savePending}
        accessibilityRole="button" accessibilityLabel={isSaved ? 'Unsave recipe' : 'Save recipe'} accessibilityState={{ busy: savePending, selected: isSaved }}>
        <SFIcon name="bookmark" size={18} weight={isSaved ? 'fill' : 'regular'} color={Colors.black} />
      </TouchableOpacity>
    </Animated.View>
  );
}

// ── Horizontal carousel ───────────────────────────────────────────────────────
function RecipeCarousel({ recipes, title, subtitle, loading, imageOffset = 0 }: {
  recipes: Recipe[]; title: string; subtitle?: string; loading?: boolean; imageOffset?: number;
}) {
  const router = useRouter();
  const language = useLanguageStore(state => state.language);
  const t = (text: string) => recipeText(text, language);
  const TODAY = new Date().toLocaleDateString(language === 'zh' ? 'zh-CN' : 'en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  if (loading) {
    return (
      <View style={[s.carouselBlock, { alignItems: 'center', paddingVertical: 24 }]}>
        <ActivityIndicator color={Colors.gray} />
      </View>
    );
  }

  if (recipes.length === 0) {
    return (
      <View style={s.carouselBlock}>
        <View style={s.sectionHeader}>
          <View>
            <Text style={s.sectionTitle}>{title}</Text>
            {subtitle && <Text style={s.sectionSubtitle}>{subtitle}</Text>}
          </View>
        </View>
        <View style={{ marginHorizontal: 20, padding: 18, borderRadius: 16, backgroundColor: Colors.white }}>
          <Text style={{ fontFamily: 'DMSans_500Medium', color: Colors.black }}>{t('No recipes available yet')}</Text>
          <Text style={{ fontFamily: 'DMSans_400Regular', color: Colors.gray, marginTop: 4 }}>
            {t('Add ingredients to your fridge or try again when you are online.')}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={s.carouselBlock}>
      <View style={s.sectionHeader}>
        <View>
          <Text style={s.sectionTitle}>{title}</Text>
          {subtitle && <Text style={s.sectionSubtitle}>{subtitle}</Text>}
        </View>
        <TouchableOpacity onPress={() => router.push('/(tabs)/search' as any)}>
          <Text style={s.seeAll}>{t('See All')}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={CARD_W + CARD_GAP}
        snapToAlignment="start"
        contentContainerStyle={s.cardRow}
      >
        {recipes.map((r, i) => (
          <RecipeCard
            key={r.id}
            recipe={r}
            index={i}
            imageIndex={imageOffset + i}
            showTimeBadge={title === 'For Quick Meal'}
            onPress={() => router.push(`/(tabs)/recipe/${r.id}` as any)}
          />
        ))}
        <View style={{ width: 8 }} />
      </ScrollView>
    </View>
  );
}

// ── Greeting helpers ──────────────────────────────────────────────────────────
function timeGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Morning';
  if (h < 18) return 'Afternoon';
  return 'Evening';
}



// ── Main screen ───────────────────────────────────────────────────────────────
export default function RecipeHome() {
  const language = useLanguageStore(state => state.language);
  const t = (text: string) => recipeText(text, language);
  const TODAY = new Date().toLocaleDateString(language === 'zh' ? 'zh-CN' : 'en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const user    = useAuthStore(s => s.user);


  const { data: inventory, isError: inventoryError } = useQuery({ queryKey: ['fridge'], queryFn: () => fridgeService.getItems(), retry: false });
  const { data: fridgeRecs, isLoading: loadingFridge, refetch: refreshFridge } = useQuery({
    queryKey: ['recipes', 'fridge', user?.id],
    queryFn:  recipeService.getRecommendationsByFridge,
    retry: false,
  });

  const { data: preferences, isLoading: loadingProfile, refetch: refreshProfile } = useQuery({
    queryKey: ['recipes', 'profile', user?.id], queryFn: recipeService.getProfileRecommendations, retry: false,
  });
  const { data: saved, isLoading: loadingSaved, refetch: refreshSaved } = useQuery({
    queryKey: ['recipes', 'saved'], queryFn: recipeService.getSavedRecipes, retry: false,
  });
  useFocusEffect(useCallback(() => { void refreshSaved(); void refreshFridge(); void refreshProfile(); }, [refreshSaved, refreshFridge, refreshProfile]));
  const fridgeRecipes = fridgeRecs ?? [];

  const firstName = user?.name?.split(' ')[0] ?? 'Chef';
  const displayName = user?.name?.trim() || 'Chef';
  const avatarInitials = initialsFor(displayName);

  const bottomPad = PILL_H + BAR_ABOVE + insets.bottom + 60;

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomPad }}
        scrollEventThrottle={16}
      >
        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.greeting}>{language === 'zh' ? ({ Morning: '早上好', Afternoon: '下午好', Evening: '晚上好' }[timeGreeting()] || '你好') : timeGreeting()} <Text translate={false}>{firstName}</Text></Text>
            <Text style={s.date}>{TODAY}</Text>
          </View>
          <TouchableOpacity
            style={[s.avatarWrap, { backgroundColor: avatarColor(displayName) }]}
            onPress={() => router.push('/(tabs)/settings' as any)}
            accessibilityRole="button"
            accessibilityLabel="Open settings"
          >
            <Text style={s.avatarText}>{avatarInitials}</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={() => router.push('/(tabs)/shopping-list' as any)}
          accessibilityRole="button" accessibilityLabel="Open shopping list"
          style={{ marginHorizontal: 20, marginBottom: 14, padding: 16, borderRadius: 18, backgroundColor: Colors.yellowLight, flexDirection: 'row', gap: 10 }}>
          <SFIcon name="cart" size={20} color={Colors.black} /><Text>Shopping List</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push('/recipe-workbench' as any)} accessibilityRole="button" style={{ marginHorizontal: 20, marginBottom: 14, padding: 16, borderRadius: 18, backgroundColor: '#E8EFCF' }}>
          <Text style={{ fontWeight: '700' }}>Recipe Workbench →</Text>
          <Text>Import · Edit tables · Preview cooking graph</Text>
        </TouchableOpacity>

        {/* Search → AI */}
        <TouchableOpacity
          style={s.searchBar}
          activeOpacity={0.82}
          onPress={() => router.push('/(tabs)/search' as any)}
        >
          <SFIcon name="magnifyingglass" size={15} color="rgba(0,0,0,0.38)" />
          <Text style={s.searchPlaceholder}>{t('Search recipes…')}</Text>
          <View style={s.searchAIBadge}>
            <Text style={s.searchAIText}>{t('Search')}</Text>
          </View>
        </TouchableOpacity>

        {!inventoryError && inventory?.length === 0 ? (
          <View style={{ marginHorizontal: 20, marginBottom: 24, padding: 20, borderRadius: 20, backgroundColor: Colors.white }}>
            <Text style={s.sectionTitle}>0 ingredients in your fridge</Text>
            <Text style={s.sectionSubtitle}>Explore recipes for your taste below. Add ingredients in the Fridge tab to unlock fridge matches.</Text>

          </View>
        ) : <RecipeCarousel recipes={fridgeRecipes} title={t('From Your Fridge')} subtitle={t('Matched to your main ingredients · check seasonings separately')} loading={loadingFridge} imageOffset={0} />}
        <RecipeCarousel recipes={preferences ?? []} title={t('For Your Taste')} subtitle={t('Inspired by your cooking preferences')} loading={loadingProfile} imageOffset={3} />
        <RecipeCarousel recipes={saved ?? []} title={t('Saved Recipes')} subtitle={t('Your favorites, ready to cook')} loading={loadingSaved} imageOffset={6} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.cream },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 16,
  },
  greeting: { fontSize: 22, fontFamily: 'LibreBaskerville_700Bold', color: Colors.black },
  date:     { fontSize: 13, fontFamily: 'DMSans_400Regular', color: Colors.gray, marginTop: 2 },
  avatarWrap: {
    width: 46, height: 46, borderRadius: 23,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2.5, borderColor: Colors.yellow,
  },
  avatarText: { fontSize: 15, fontFamily: 'DMSans_700Bold', color: Colors.black },

  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.white, borderRadius: 50,
    marginHorizontal: 20, paddingHorizontal: 18, paddingVertical: 13,
    marginBottom: 18, gap: 9,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08, shadowRadius: 10, elevation: 4,
  },
  searchPlaceholder: { flex: 1, fontSize: 14, fontFamily: 'DMSans_400Regular', color: Colors.gray },
  searchAIBadge: {
    backgroundColor: Colors.black, borderRadius: 50, paddingHorizontal: 10, paddingVertical: 4,
  },
  searchAIText: { fontSize: 11, fontFamily: 'DMSans_700Bold', color: Colors.yellow },

  // Banner
  banner: {
    backgroundColor: Colors.yellowLight,
    borderRadius: 20,
    marginHorizontal: 20,
    padding: 18,
    marginBottom: 28,
    borderWidth: 1.5,
    borderColor: 'rgba(245,216,75,0.55)',
    shadowColor: Colors.yellow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 14,
    elevation: 3,
    position: 'relative',
  },
  bannerXWrap: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 10,
  },
  bannerX: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  bannerXIcon: {
    fontSize: 12,
    fontFamily: 'DMSans_700Bold',
    color: 'rgba(0,0,0,0.45)',
  },
  bannerTagRow: {
    flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 5, marginRight: 36,
  },
  bannerTag: { fontSize: 11, fontFamily: 'DMSans_700Bold', color: Colors.orange, letterSpacing: 0.4 },
  bannerTitle: { fontSize: 16, fontFamily: 'DMSans_700Bold', color: Colors.black, marginBottom: 4 },
  bannerSub: {
    fontSize: 13, fontFamily: 'DMSans_400Regular', color: Colors.gray,
    lineHeight: 18, marginBottom: 14,
  },
  updateBtn: { backgroundColor: Colors.black, borderRadius: 50, paddingVertical: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  updateBtnText: { fontFamily: 'DMSans_700Bold', color: Colors.white, fontSize: 14 },

  // Section
  carouselBlock: { marginBottom: 30 },
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end',
    paddingHorizontal: 20, marginBottom: 14,
  },
  sectionTitle:    { fontSize: 17, fontFamily: 'DMSans_700Bold', color: Colors.black },
  sectionSubtitle: { fontSize: 12, fontFamily: 'DMSans_400Regular', color: Colors.gray, marginTop: 2 },
  seeAll:          { fontSize: 13, fontFamily: 'DMSans_500Medium', color: Colors.gray },

  cardRow: { paddingLeft: 20, gap: CARD_GAP },

  card: {
    width: CARD_W,
    backgroundColor: Colors.white,
    borderRadius: CARD_RADIUS,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.11,
    shadowRadius: 18,
    elevation: 7,
  },
  cardImageWrap: { width: '100%', height: 192 },
  cardImage: { width: '100%', height: '100%' },
  cardImageShade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 86,
    backgroundColor: 'rgba(0,0,0,0.36)',
  },
  cardImageTitle: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 12,
    fontSize: 18,
    lineHeight: 22,
    fontFamily: 'DMSans_700Bold',
    color: Colors.white,
    textShadowColor: 'rgba(0,0,0,0.28)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  badge: {
    position: 'absolute', top: 12, left: 12,
    borderRadius: 50, paddingHorizontal: 10, paddingVertical: 4,
  },
  badgeText: { fontSize: 10, fontFamily: 'DMSans_700Bold', color: Colors.white, letterSpacing: 0.5 },
  timeBadge: {
    position: 'absolute',
    top: 12,
    right: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 50,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: Colors.yellow,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  timeBadgeText: { fontSize: 11, fontFamily: 'DMSans_700Bold', color: Colors.black },
  bookmarkBtn: {
    position: 'absolute', top: 10, right: 10,
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 4, elevation: 2,
  },
  cardBody: { padding: 14, gap: 8, minHeight: 86 },
  cardName: { fontSize: 15, fontFamily: 'DMSans_700Bold', color: Colors.black, lineHeight: 20 },
  cardMeta: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', alignItems: 'center' },
});
