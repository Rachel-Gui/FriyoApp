import {
  View, Text, ScrollView, TouchableOpacity, Image,
  StyleSheet, Dimensions, Animated, LayoutAnimation,
  Platform, UIManager, ActivityIndicator,
} from 'react-native';
import { useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
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
  const scale = useRef(new Animated.Value(1)).current;

  const pressIn  = () => Animated.spring(scale, { toValue: 0.965, useNativeDriver: true, stiffness: 420, damping: 24, mass: 0.7 }).start();
  const pressOut = () => Animated.spring(scale, { toValue: 1,     useNativeDriver: true, stiffness: 260, damping: 26, mass: 0.8 }).start();

  const totalMin = (recipe.prepTimeMin ?? 0) + (recipe.cookTimeMin ?? 0);
  const timeLabel = totalMin > 0 ? `${totalMin} min` : '—';
  const imgSource = recipe.imageUrl ? { uri: recipe.imageUrl } : localImageForRecipe(recipe, imageIndex);
  const displayTitle = recipe.title?.trim() || 'Recipe idea';

  return (
    <Animated.View style={[s.card, { transform: [{ scale }] }]}>
      <TouchableOpacity activeOpacity={1} onPress={onPress} onPressIn={pressIn} onPressOut={pressOut}>
        <View style={s.cardImageWrap}>
          <Image source={imgSource} style={s.cardImage} resizeMode="cover" />
          <View style={s.cardImageShade} />
          <Text style={s.cardImageTitle} numberOfLines={2}>{displayTitle}</Text>
        </View>

        {recipe.difficulty ? (
          <View style={[s.badge, { backgroundColor: Colors.green }]}>
            <Text style={s.badgeText}>{recipe.difficulty.toUpperCase()}</Text>
          </View>
        ) : null}

        {showTimeBadge && totalMin > 0 ? (
          <View style={s.timeBadge}>
            <SFIcon name="timer" size={12} color={Colors.black} />
            <Text style={s.timeBadgeText}>{timeLabel}</Text>
          </View>
        ) : null}

        <View style={s.bookmarkBtn}>
          <SFIcon name="bookmark" size={14} color="rgba(0,0,0,0.65)" />
        </View>

        <View style={s.cardBody}>
          <Text style={s.cardName} numberOfLines={2}>{displayTitle}</Text>
          <View style={s.cardMeta}>
            <RecipeMetaChip icon="timer" label={timeLabel} iconColor="rgba(0,0,0,0.45)" />
            {recipe.mealType ? <RecipeMetaChip label={recipe.mealType} /> : null}
            {recipe.caloriesPerServing ? (
              <RecipeMetaChip icon="flame.fill" iconWeight="fill" label={`${recipe.caloriesPerServing} kcal`} iconColor="#F59E0B" />
            ) : null}
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ── Horizontal carousel ───────────────────────────────────────────────────────
function RecipeCarousel({ recipes, title, subtitle, loading, imageOffset = 0 }: {
  recipes: Recipe[]; title: string; subtitle?: string; loading?: boolean; imageOffset?: number;
}) {
  const router = useRouter();

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
          <Text style={{ fontFamily: 'DMSans_500Medium', color: Colors.black }}>No recipes available yet</Text>
          <Text style={{ fontFamily: 'DMSans_400Regular', color: Colors.gray, marginTop: 4 }}>
            Add ingredients to your fridge or try again when you are online.
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
        <TouchableOpacity onPress={() => router.push('/(tabs)/ai' as any)}>
          <Text style={s.seeAll}>See All</Text>
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

// ── Smart Inventory Banner (dismissable) ──────────────────────────────────────
function SmartInventoryBanner({ onDismiss }: { onDismiss: () => void }) {
  const router   = useRouter();
  const opacity  = useRef(new Animated.Value(1)).current;
  const scale    = useRef(new Animated.Value(1)).current;

  const xScale   = useRef(new Animated.Value(1)).current;
  const xPressIn  = () => Animated.spring(xScale, { toValue: 0.88, useNativeDriver: true, stiffness: 500, damping: 20 }).start();
  const xPressOut = () => Animated.spring(xScale, { toValue: 1,    useNativeDriver: true, stiffness: 300, damping: 22 }).start();

  const dismiss = () => {
    // Phase 1: fade + scale out
    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.spring(scale, {
        toValue: 0.93,
        useNativeDriver: true,
        stiffness: 380,
        damping: 24,
      }),
    ]).start(() => {
      // Phase 2: collapse height + reflow with LayoutAnimation
      LayoutAnimation.configureNext({
        duration: 260,
        create: { type: 'easeInEaseOut', property: 'opacity' },
        update: { type: 'spring', springDamping: 0.7 },
        delete: { type: 'easeInEaseOut', property: 'opacity' },
      });
      onDismiss();
    });
  };

  return (
    <Animated.View style={[s.banner, { opacity, transform: [{ scale }] }]}>
      {/* Dismiss X */}
      <Animated.View style={[s.bannerXWrap, { transform: [{ scale: xScale }] }]}>
        <TouchableOpacity
          onPressIn={xPressIn}
          onPressOut={xPressOut}
          onPress={dismiss}
          activeOpacity={1}
          hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
        >
          <View style={s.bannerX}>
            <Text style={s.bannerXIcon}>✕</Text>
          </View>
        </TouchableOpacity>
      </Animated.View>

      <View style={s.bannerTagRow}>
        <SFIcon name="shippingbox" size={14} color={Colors.black} />
        <Text style={s.bannerTag}>Smart Inventory</Text>
      </View>
      <Text style={s.bannerTitle}>Record New Ingredients</Text>
      <Text style={s.bannerSub}>
        Based on your last scan, you can make 8 new recipes right now.
      </Text>
      <TouchableOpacity
        style={s.updateBtn}
        onPress={() => router.push('/(tabs)/fridge/scanner' as any)}
      >
        <SFIcon name="camera" size={16} color={Colors.white} />
        <Text style={s.updateBtnText}>Update Fridge</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ── Greeting helpers ──────────────────────────────────────────────────────────
function timeGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Morning';
  if (h < 18) return 'Afternoon';
  return 'Evening';
}

const TODAY = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

// ── Main screen ───────────────────────────────────────────────────────────────
export default function RecipeHome() {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const user    = useAuthStore(s => s.user);
  const [showBanner, setShowBanner] = useState(true);

  const { data: fridgeRecs, isLoading: loadingFridge } = useQuery({
    queryKey: ['recipes', 'fridge'],
    queryFn:  recipeService.getRecommendationsByFridge,
    retry: false,
  });

  const { data: trending, isLoading: loadingTrending } = useQuery({
    queryKey: ['recipes', 'trending'],
    queryFn:  recipeService.getTrendingRecipes,
    retry: false,
  });

  const fridgeRecipes   = fridgeRecs ?? [];
  const trendingRecipes = trending ?? [];
  const topTrendRecipes = trendingRecipes;
  const recommendedRecipes = fridgeRecipes;
  const quickMealRecipes = fridgeRecipes
    .filter(recipe => ((recipe.prepTimeMin ?? 0) + (recipe.cookTimeMin ?? 0)) <= 25)
    .concat(fridgeRecipes)
    .filter((recipe, index, list) => list.findIndex(item => item.id === recipe.id) === index);

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
            <Text style={s.greeting}>{timeGreeting()} {firstName}</Text>
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

        {/* Search → AI */}
        <TouchableOpacity
          style={s.searchBar}
          activeOpacity={0.82}
          onPress={() => router.push('/(tabs)/ai' as any)}
        >
          <SFIcon name="magnifyingglass" size={15} color="rgba(0,0,0,0.38)" />
          <Text style={s.searchPlaceholder}>Ask AI for a recipe…</Text>
          <View style={s.searchAIBadge}>
            <Text style={s.searchAIText}>✦ AI</Text>
          </View>
        </TouchableOpacity>

        {/* Smart Inventory Banner — conditionally shown */}
        {showBanner && (
          <SmartInventoryBanner onDismiss={() => setShowBanner(false)} />
        )}

        {/* Recipe carousels */}
        <RecipeCarousel
          recipes={topTrendRecipes}
          title="Top Trend"
          subtitle="Popular right now"
          loading={loadingTrending}
          imageOffset={6}
        />
        <RecipeCarousel
          recipes={recommendedRecipes}
          title="Recommended for You"
          subtitle="Matches your taste profile"
          loading={loadingTrending}
          imageOffset={3}
        />
        <RecipeCarousel
          recipes={quickMealRecipes}
          title="For Quick Meal"
          subtitle="Fast recipes with estimated cook time"
          loading={loadingFridge}
          imageOffset={0}
        />
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
