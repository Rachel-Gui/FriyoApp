import {
  View, Text, ScrollView, TouchableOpacity, Image,
  StyleSheet, Dimensions, Animated, Modal, useColorScheme, Platform, Share, Alert,
} from 'react-native';
import { useRef, useState, useEffect, useCallback } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors }  from '@/constants/Colors';
import { SFIcon }  from '@/components/ui/SFIcon';
import { recipeService } from '@/services/recipeService';
import { mealPlanService } from '@/services/mealPlanService';
import { localImageForText } from '@/services/localRecipeImages';
import type { Recipe } from '@/services/types';
// ── Local types (previously imported from services/api) ───────────────────────
type RecipeDetail    = { id: string; title: string; badge?: string; time: string; baseServings: number; calories: number; difficulty: string; rating: number; reviewCount: number; description: string; ingredients: Ingredient[]; steps: Step[]; imageUrl?: string };
type Ingredient      = { id: string; name: string; baseAmt: number; unit: string; icon: string; inFridge: boolean };
type FridgeMatchItem = { name: string; have: boolean };
type Step            = { id: string; num: number; title: string; dur: string; type: string; timerSec: number; info: string };
type Review          = { id: string; user: string; avatar: string; stars: number; text: string; date: string; tries: number };

const { width } = Dimensions.get('window');
const HERO_H    = 280;
const TAB_W     = (width - 40) / 3;

const EMPTY_RECIPE: RecipeDetail = {
  id: '',
  title: '',
  time: '—',
  baseServings: 1,
  calories: 0,
  difficulty: '—',
  rating: 0,
  reviewCount: 0,
  description: '',
  ingredients: [],
  steps: [],
};

// ── Image helper ──────────────────────────────────────────────────────────────
const imgSrc = (url: string | undefined, title: string) => url ? { uri: url } : localImageForText(title);

function recipeToDetail(apiRecipe: Recipe): RecipeDetail {
  return {
    id:           apiRecipe.id,
    title:        apiRecipe.title,
    badge:        apiRecipe.cuisineType?.toUpperCase(),
    time:         `${(apiRecipe.prepTimeMin ?? 0) + (apiRecipe.cookTimeMin ?? 0)} min`,
    baseServings: apiRecipe.servings ?? 2,
    calories:     apiRecipe.caloriesPerServing ?? 0,
    difficulty:   apiRecipe.difficulty ?? 'Medium',
    rating:       0,
    reviewCount:  0,
    description:  apiRecipe.description ?? '',
    imageUrl:     apiRecipe.imageUrl,
    ingredients:  [],
    steps:        [],
  };
}

function ingredientsFromRecipe(apiRecipe: Recipe): Ingredient[] {
  return (apiRecipe.ingredients ?? []).map((ing, index) => ({
    id:       ing.id ?? String(index),
    name:     ing.ingredientName,
    baseAmt:  Number(ing.quantity ?? 0),
    unit:     ing.unit ?? '',
    icon:     '•',
    inFridge: false,
  }));
}

function stepsFromRecipe(apiRecipe: Recipe): Step[] {
  return (apiRecipe.steps ?? []).map((step, index) => ({
    id:       step.id ?? String(index + 1),
    num:      step.stepNumber ?? index + 1,
    title:    `Step ${step.stepNumber ?? index + 1}`,
    dur:      `${step.durationMin ?? 0} min`,
    type:     step.stepType === 'hands_off' ? 'hands-off' : 'hands-on',
    timerSec: Math.max(0, step.durationMin ?? 0) * 60,
    info:     step.description,
  }));
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function SkeletonBox({ w, h, r = 8, dark }: { w: number | string; h: number; r?: number; dark: boolean }) {
  const anim = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 0.85, duration: 750, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.3,  duration: 750, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return <Animated.View style={{ width: w as any, height: h, borderRadius: r, backgroundColor: dark ? '#2a2a2a' : '#E0E0E0', opacity: anim }} />;
}

function Stars({ n, size = 13 }: { n: number; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 1 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <Text key={i} style={{ fontSize: size, color: i <= Math.round(n) ? Colors.yellow : Colors.borderGray }}>★</Text>
      ))}
    </View>
  );
}

function TimerButton({ seconds, isDark }: { seconds: number; isDark: boolean }) {
  const [remaining, setRemaining] = useState(seconds);
  const [running,   setRunning]   = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const toggle = () => {
    if (running) {
      clearInterval(intervalRef.current!);
      setRunning(false);
    } else {
      setRunning(true);
      intervalRef.current = setInterval(() => {
        setRemaining(r => {
          if (r <= 1) { clearInterval(intervalRef.current!); setRunning(false); return 0; }
          return r - 1;
        });
      }, 1000);
    }
  };

  const mm = String(Math.floor(remaining / 60)).padStart(2, '0');
  const ss = String(remaining % 60).padStart(2, '0');

  return (
    <TouchableOpacity
      onPress={toggle}
      style={[s.timerBtn, running && { backgroundColor: Colors.orange }]}
    >
      <SFIcon name="timer" size={14} color={Colors.black} />
      <Text style={[s.timerText, { color: Colors.black }]}>{`${mm}:${ss}`}</Text>
    </TouchableOpacity>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function RecipeDetail() {
  const router   = useRouter();
  const insets   = useSafeAreaInsets();
  const scheme   = useColorScheme() ?? 'light';
  const isDark   = scheme === 'dark';
  const { id }   = useLocalSearchParams<{ id: string }>();

  // Theme
  const bg       = isDark ? '#111111' : Colors.white;
  const card     = isDark ? '#1E1E1E' : Colors.white;
  const cardAlt  = isDark ? '#252525' : Colors.lightGray;
  const txt      = isDark ? '#FFFFFF' : Colors.black;
  const sub      = isDark ? '#9A9A9A' : Colors.gray;
  const border   = isDark ? '#2E2E2E' : Colors.borderGray;

  const [recipe,      setRecipe]      = useState<RecipeDetail>(EMPTY_RECIPE);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [fridgeMatch, setFridgeMatch] = useState<FridgeMatchItem[]>([]);
  const [steps,       setSteps]       = useState<Step[]>([]);
  const [reviews,     setReviews]     = useState<Review[]>([]);
  const [apiError,    setApiError]    = useState(false);

  // UI state
  const [activeTab,     setActiveTab]     = useState(0);
  const [servings,      setServings]      = useState(1);
  const [expandedStep,  setExpandedStep]  = useState<string | null>('1');
  const [isSaved,       setIsSaved]       = useState(false);
  const [savePending,   setSavePending]   = useState(false);
  const [showCookModal, setShowCookModal] = useState(false);
  const [cookDone,      setCookDone]      = useState(false);
  const [cookLogging,   setCookLogging]   = useState(false);
  const [isLoading,     setIsLoading]     = useState(true);

  // Animations
  const scrollY   = useRef(new Animated.Value(0)).current;
  const tabAnim   = useRef(new Animated.Value(0)).current;
  const saveScale = useRef(new Animated.Value(1)).current;
  const ctaScale  = useRef(new Animated.Value(1)).current;

  // ── Fetch recipe data from API ─────────────────────────────────────────────
  useEffect(() => {
    if (!id) { setIsLoading(false); return; }

    (async () => {
      try {
        const data = await recipeService.getRecipeDetail(id);
        const detail = recipeToDetail(data);
        const apiIngredients = ingredientsFromRecipe(data);
        const apiSteps = stepsFromRecipe(data);

        setRecipe(detail);
        setIngredients(apiIngredients);
        setFridgeMatch(apiIngredients.map(ing => ({ name: ing.name, have: ing.inFridge })));
        setSteps(apiSteps);
        setServings(detail.baseServings);
        setApiError(false);
      } catch (err: any) {
        if (err?.name !== 'AbortError') setApiError(true);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [id]);

  const switchTab = (i: number) => {
    setActiveTab(i);
    Animated.spring(tabAnim, { toValue: i, useNativeDriver: false, stiffness: 300, damping: 28 }).start();
  };

  // Parallax
  const heroImgY = scrollY.interpolate({
    inputRange:  [-HERO_H, 0, HERO_H],
    outputRange: [-HERO_H * 0.4, 0, HERO_H * 0.4],
    extrapolate: 'clamp',
  });
  const heroDimOpacity = scrollY.interpolate({
    inputRange: [-60, 0], outputRange: [0.1, 0.45], extrapolate: 'clamp',
  });
  const stickyOpacity = scrollY.interpolate({
    inputRange: [HERO_H - 80, HERO_H - 20], outputRange: [0, 1], extrapolate: 'clamp',
  });
  const tabUnderlineX = tabAnim.interpolate({
    inputRange: [0, 1, 2], outputRange: [0, TAB_W, TAB_W * 2],
  });

  const spring = (anim: Animated.Value, to: number) =>
    Animated.spring(anim, { toValue: to, useNativeDriver: true, stiffness: 420, damping: 22 });

  const ratio         = recipe.baseServings > 0 ? servings / recipe.baseServings : 1;
  const inFridgeCount = ingredients.filter(i => i.inFridge).length;

  // ── Save / unsave ──────────────────────────────────────────────────────────
  const toggleSave = async () => {
    if (savePending || !id) { setIsSaved(v => !v); return; }
    const next = !isSaved;
    setIsSaved(next);
    setSavePending(true);
    try {
      if (next) await recipeService.saveRecipe(id);
      else await recipeService.unsaveRecipe(id);
    } catch {
      setIsSaved(!next); // revert on error
    } finally {
      setSavePending(false);
    }
  };

  // ── Share ──────────────────────────────────────────────────────────────────
  const handleShare = async () => {
    try {
      await Share.share({
        title: recipe.title,
        message: `Check out "${recipe.title}" on Friyo — ${recipe.time}, ${recipe.difficulty}. ${recipe.description.slice(0, 100)}...`,
      });
    } catch {}
  };

  // ── Log meal ───────────────────────────────────────────────────────────────
  const logMeal = async () => {
    setCookLogging(true);
    try {
      await mealPlanService.logMeal({
        recipeId:      recipe.id,
        mealType:      'dinner',
        servingsEaten: servings,
      });
      setCookDone(true);
    } catch (error: any) {
      Alert.alert('Could not log meal', error?.message ?? 'Please try again.');
    } finally {
      setCookLogging(false);
    }
  };

  // ── Render: loading skeleton ───────────────────────────────────────────────
  if (isLoading) {
    return (
      <View style={[s.root, { backgroundColor: bg }]}>
        <SkeletonBox w="100%" h={HERO_H} r={0} dark={isDark} />
        <View style={{ padding: 20, gap: 14 }}>
          <SkeletonBox w={200} h={26} dark={isDark} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {[80, 90, 70, 80].map((w, i) => <SkeletonBox key={i} w={w} h={32} r={50} dark={isDark} />)}
          </View>
          <SkeletonBox w="100%" h={18} dark={isDark} />
          <SkeletonBox w="80%"  h={18} dark={isDark} />
          <View style={{ gap: 10, marginTop: 8 }}>
            {[1, 2, 3].map(i => <SkeletonBox key={i} w="100%" h={64} r={14} dark={isDark} />)}
          </View>
        </View>
      </View>
    );
  }

  if (apiError || !recipe.id) {
    return (
      <View style={[s.root, { backgroundColor: bg, alignItems: 'center', justifyContent: 'center', padding: 28 }]}>
        <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: 20, color: txt, textAlign: 'center' }}>
          Recipe unavailable
        </Text>
        <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 14, color: sub, textAlign: 'center', marginTop: 8 }}>
          Friyo could not load this recipe. Check your connection and try again.
        </Text>
        <TouchableOpacity style={{ marginTop: 20, paddingHorizontal: 22, paddingVertical: 12, borderRadius: 24, backgroundColor: Colors.yellow }} onPress={() => router.back()}>
          <Text style={{ fontFamily: 'DMSans_700Bold', color: Colors.black }}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Render: loaded ─────────────────────────────────────────────────────────
  return (
    <View style={[s.root, { backgroundColor: bg }]}>

      {/* ── Sticky compact header ──────────────────────────────────────────── */}
      <Animated.View
        style={[s.stickyHeader, { opacity: stickyOpacity, backgroundColor: bg, paddingTop: insets.top }]}
        pointerEvents="none"
      >
        <Text style={[s.stickyTitle, { color: txt }]} numberOfLines={1}>{recipe.title}</Text>
      </Animated.View>

      {/* ── Scrollable body ───────────────────────────────────────────────── */}
      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: insets.bottom + 130 }}
      >
        {/* ── Hero with parallax ─────────────────────────────────────────── */}
        <View style={[s.heroWrap, { height: HERO_H }]}>
          <Animated.Image
            source={imgSrc(recipe.imageUrl, recipe.title)}
            style={[s.heroImg, { transform: [{ translateY: heroImgY }] }]}
            resizeMode="cover"
          />
          <Animated.View style={[s.heroDim, { opacity: heroDimOpacity }]} />
          <LinearGradient colors={['transparent', 'rgba(0,0,0,0.7)']} style={s.heroGrad} />

          {/* Nav row */}
          <SafeAreaView style={s.navRow} edges={['top']}>
            <TouchableOpacity onPress={() => router.back()} style={s.glassBtn}>
              <BlurView intensity={60} tint="light" style={s.glassBtnInner}>
                <SFIcon name="chevron.left" size={18} color={Colors.white} weight="regular" />
              </BlurView>
            </TouchableOpacity>
            <View style={{ flex: 1 }} />
            <TouchableOpacity style={s.glassBtn} onPress={handleShare}>
              <BlurView intensity={60} tint="light" style={s.glassBtnInner}>
                <SFIcon name="square.and.arrow.up" size={18} color={Colors.white} weight="regular" />
              </BlurView>
            </TouchableOpacity>
            <View style={{ width: 8 }} />
            <Animated.View style={{ transform: [{ scale: saveScale }] }}>
              <TouchableOpacity
                onPressIn={() => spring(saveScale, 0.88).start()}
                onPressOut={() => spring(saveScale, 1).start()}
                onPress={toggleSave}
                style={s.glassBtn}
              >
                <BlurView intensity={60} tint="light" style={[s.glassBtnInner, isSaved && s.glassBtnYellow]}>
                  <SFIcon name="bookmark" size={18} color={Colors.white} weight={isSaved ? 'fill' : 'regular'} />
                </BlurView>
              </TouchableOpacity>
            </Animated.View>
          </SafeAreaView>

          {/* Hero overlay text */}
          <View style={s.heroOverlay}>
            <View style={s.heroBadge}>
              <Text style={s.heroBadgeText}>
                {recipe.badge ?? "CHEF'S CHOICE"}  ⭐ {recipe.rating} ({(recipe.reviewCount / 1000).toFixed(1)}k)
              </Text>
            </View>
            <Text style={s.heroTitle}>{recipe.title}</Text>
          </View>
        </View>

        {/* ── Stats bar ─────────────────────────────────────────────────────── */}
        <View style={[s.statsBar, { backgroundColor: bg, borderBottomColor: border }]}>
          {([
            { sfIcon: 'timer',      label: 'Time',       value: recipe.time },
            { sfIcon: 'person.2',   label: 'Servings',   value: `${servings} ppl` },
            { sfIcon: 'flame',      label: 'Calories',   value: `${Math.round(recipe.calories * ratio)} kcal` },
            { sfIcon: 'chart.bar',  label: 'Difficulty', value: recipe.difficulty },
          ] as const).map((stat, i) => (
            <View key={i} style={[s.statItem, i > 0 && { borderLeftWidth: 1, borderLeftColor: border }]}>
              <SFIcon name={stat.sfIcon} size={18} color={isDark ? '#CCC' : 'rgba(0,0,0,0.55)'} />
              <Text style={[s.statVal, { color: txt }]}>{stat.value}</Text>
              <Text style={[s.statLabel, { color: sub }]}>{stat.label}</Text>
            </View>
          ))}
        </View>

        <View style={{ paddingHorizontal: 20 }}>

          {/* ── Fridge match banner ──────────────────────────────────────────── */}
          <View style={[s.matchCard, { backgroundColor: isDark ? '#1A2A1A' : Colors.greenLight }]}>
            <View style={s.matchHeader}>
              <Text style={s.matchTitle}>🧊 Fridge match</Text>
              <View style={[s.matchBadge, { backgroundColor: Colors.green }]}>
                <Text style={s.matchBadgeText}>{inFridgeCount}/{ingredients.length} items</Text>
              </View>
            </View>
            {fridgeMatch.map((item, i) => (
              <View key={i} style={s.matchRow}>
                <Text style={{ fontSize: 14, color: item.have ? Colors.green : Colors.red, fontFamily: 'DMSans_700Bold' }}>
                  {item.have ? '✓' : '✗'}
                </Text>
                <Text style={[s.matchItemName, { color: txt }]}>{item.name}</Text>
                {!item.have && (
                  <View style={s.needBadge}>
                    <Text style={s.needText}>Need to buy</Text>
                  </View>
                )}
              </View>
            ))}
          </View>

          {/* ── Description ──────────────────────────────────────────────────── */}
          <Text style={[s.description, { color: sub }]}>{recipe.description}</Text>

          {/* ── Tab bar ──────────────────────────────────────────────────────── */}
          <View style={[s.tabBarWrap, { borderBottomColor: border }]}>
            {['Ingredients', 'How to Cook', 'Reviews'].map((name, i) => (
              <TouchableOpacity key={i} style={s.tabItem} onPress={() => switchTab(i)}>
                <Text style={[s.tabLabel, { color: activeTab === i ? txt : sub }]}>{name}</Text>
              </TouchableOpacity>
            ))}
            <Animated.View style={[s.tabUnderline, { left: tabUnderlineX, width: TAB_W }]} />
          </View>

          {/* ── TAB 0: Ingredients ───────────────────────────────────────────── */}
          {activeTab === 0 && (
            <View style={{ marginTop: 18 }}>
              {/* Servings adjuster */}
              <View style={[s.servingsRow, { backgroundColor: cardAlt }]}>
                <Text style={[s.servingsLabel, { color: sub }]}>Servings</Text>
                <View style={s.servingsCtrl}>
                  <TouchableOpacity
                    onPress={() => setServings(v => Math.max(1, v - 1))}
                    style={[s.servingsBtn, { backgroundColor: card }]}
                  >
                    <Text style={[s.servingsBtnTxt, { color: txt }]}>−</Text>
                  </TouchableOpacity>
                  <Text style={[s.servingsNum, { color: txt }]}>{servings}</Text>
                  <TouchableOpacity
                    onPress={() => setServings(v => Math.min(12, v + 1))}
                    style={[s.servingsBtn, { backgroundColor: card }]}
                  >
                    <Text style={[s.servingsBtnTxt, { color: txt }]}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Ingredient list */}
              <View style={[s.ingCard, { backgroundColor: card }]}>
                {ingredients.map((item, i) => {
                  const scaledAmt = (item.baseAmt * ratio).toFixed(item.baseAmt >= 10 ? 0 : 1);
                  return (
                    <View key={item.id} style={[s.ingRow, i < ingredients.length - 1 && { borderBottomWidth: 1, borderBottomColor: border }]}>
                      <View style={[s.ingIconWrap, { backgroundColor: cardAlt }]}>
                        <Text style={{ fontSize: 20 }}>{item.icon}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[s.ingName, { color: txt }]}>{item.name}</Text>
                        <Text style={[s.ingAmt, { color: sub }]}>{scaledAmt} {item.unit}</Text>
                      </View>
                      {item.inFridge ? (
                        <View style={s.inFridgeTag}>
                          <Text style={s.inFridgeText}>✓ In Fridge</Text>
                        </View>
                      ) : (
                        <View style={s.needTag}>
                          <SFIcon name="cart" size={11} color={Colors.blue} />
                          <Text style={s.needTagText}> Buy</Text>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>

              <TouchableOpacity
                style={s.cartBtn}
                onPress={() => Alert.alert(
                  '🛒 Shopping List',
                  `${ingredients.filter(i => !i.inFridge).length} missing ingredient(s) noted.\n\nShopping list sync coming in the next update.`,
                  [{ text: 'OK' }],
                )}
              >
                <SFIcon name="cart" size={16} color={Colors.white} />
                <Text style={s.cartBtnText}>Add Missing Ingredients to List</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── TAB 1: How to Cook ────────────────────────────────────────────── */}
          {activeTab === 1 && (
            <View style={{ marginTop: 18 }}>
              <View style={s.legendRow}>
                <View style={s.legendItem}>
                  <View style={[s.legendDot, { backgroundColor: Colors.orange }]} />
                  <Text style={[s.legendTxt, { color: sub }]}>Hands-on</Text>
                </View>
                <View style={s.legendItem}>
                  <View style={[s.legendDot, { backgroundColor: '#14B8A6' }]} />
                  <Text style={[s.legendTxt, { color: sub }]}>Hands-off (wait)</Text>
                </View>
              </View>

              {steps.map((step) => {
                const isExpanded = expandedStep === step.id;
                const isHandsOn  = step.type === 'hands-on';
                const accent     = isHandsOn ? Colors.orange : '#14B8A6';
                const accentBg   = isHandsOn
                  ? (isDark ? '#2A1800' : '#FFF7F0')
                  : (isDark ? '#001F1F' : '#F0FDFB');

                return (
                  <TouchableOpacity
                    key={step.id}
                    onPress={() => setExpandedStep(isExpanded ? null : step.id)}
                    activeOpacity={0.85}
                    style={[s.stepCard, { backgroundColor: card, borderLeftWidth: 4, borderLeftColor: accent }]}
                  >
                    <View style={s.stepHeader}>
                      <View style={[s.stepNumWrap, { backgroundColor: accent }]}>
                        <Text style={s.stepNum}>{step.num}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[s.stepTitle, { color: txt }]}>{step.title}</Text>
                        <Text style={[s.stepDur, { color: sub }]}>{step.dur}</Text>
                      </View>
                      <Text style={[s.stepChevron, { color: sub }]}>{isExpanded ? '▲' : '▼'}</Text>
                    </View>

                    {isExpanded && (
                      <View style={[s.stepBody, { backgroundColor: accentBg, borderRadius: 10 }]}>
                        <Text style={[s.stepInfo, { color: txt }]}>{step.info}</Text>
                        {step.timerSec > 0 && (
                          <TimerButton seconds={step.timerSec} isDark={isDark} />
                        )}
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* ── TAB 2: Reviews ───────────────────────────────────────────────── */}
          {activeTab === 2 && (
            <View style={{ marginTop: 18 }}>
              <View style={[s.ratingCard, { backgroundColor: card }]}>
                <View style={s.ratingLeft}>
                  <Text style={[s.ratingBig, { color: txt }]}>{recipe.rating}</Text>
                  <Stars n={recipe.rating} size={18} />
                  <Text style={[s.ratingCount, { color: sub }]}>{recipe.reviewCount.toLocaleString()} reviews</Text>
                </View>
                <View style={s.ratingBars}>
                  {[5, 4, 3, 2, 1].map(star => {
                    const pct = star === 5 ? 0.75 : star === 4 ? 0.18 : star === 3 ? 0.05 : 0.01;
                    return (
                      <View key={star} style={s.ratingBarRow}>
                        <Text style={[s.ratingBarLabel, { color: sub }]}>{star}</Text>
                        <View style={[s.ratingBarTrack, { backgroundColor: border }]}>
                          <View style={[s.ratingBarFill, { width: `${pct * 100}%` }]} />
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>

              <View style={[s.triedBanner, { backgroundColor: isDark ? '#1E1800' : Colors.yellowLight }]}>
                <Text style={s.triedText}>🍳  <Text style={{ fontFamily: 'DMSans_700Bold' }}>{recipe.reviewCount.toLocaleString()} people</Text> have cooked this recipe</Text>
              </View>

              {reviews.map(r => (
                <View key={r.id} style={[s.reviewCard, { backgroundColor: card }]}>
                  <View style={s.reviewTop}>
                    <View style={[s.reviewAvatar, { backgroundColor: cardAlt }]}>
                      <Text style={{ fontSize: 20 }}>{r.avatar}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.reviewUser, { color: txt }]}>{r.user}</Text>
                      <Stars n={r.stars} size={11} />
                    </View>
                    <Text style={[s.reviewDate, { color: sub }]}>{r.date}</Text>
                  </View>
                  <Text style={[s.reviewText, { color: sub }]}>{r.text}</Text>
                  <Text style={[s.reviewTries, { color: sub }]}>Cooked {r.tries}× ·</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </Animated.ScrollView>

      {/* ── CTA bar ──────────────────────────────────────────────────────────── */}
      <View style={[s.ctaBar, { backgroundColor: bg, borderTopColor: border, paddingBottom: insets.bottom + 12 }]}>
        <Animated.View style={{ transform: [{ scale: ctaScale }], flex: 1 }}>
          <TouchableOpacity
            style={s.startBtn}
            activeOpacity={1}
            onPressIn={() => spring(ctaScale, 0.96).start()}
            onPressOut={() => spring(ctaScale, 1).start()}
            onPress={() => router.push({ pathname: '/(tabs)/recipe/cooking', params: { id: recipe.id } } as any)}
          >
            <SFIcon name="play.fill" size={16} color={Colors.black} weight="fill" />
            <Text style={s.startBtnText}>Start Cooking</Text>
          </TouchableOpacity>
        </Animated.View>
        <TouchableOpacity
          style={[s.cookedBtn, { backgroundColor: cardAlt }]}
          onPress={() => setShowCookModal(true)}
        >
          <SFIcon name="fork.knife" size={22} color={isDark ? '#CCC' : 'rgba(0,0,0,0.6)'} />
        </TouchableOpacity>
      </View>

      {/* ── "I cooked this!" modal ─────────────────────────────────────────── */}
      <Modal visible={showCookModal} transparent animationType="slide" onRequestClose={() => setShowCookModal(false)}>
        <TouchableOpacity style={s.modalBack} activeOpacity={1} onPress={() => { setShowCookModal(false); setCookDone(false); }} />
        <View style={[s.modalSheet, { backgroundColor: bg }]}>
          <View style={s.sheetHandle} />
          {cookDone ? (
            <View style={s.cookDone}>
              <Text style={{ fontSize: 64 }}>🎉</Text>
              <Text style={[s.cookDoneTitle, { color: txt }]}>Logged to Meal Plan!</Text>
              <Text style={[s.cookDoneSub, { color: sub }]}>Great cook! The meal has been saved to today's plan.</Text>
              <TouchableOpacity style={s.startBtn} onPress={() => { setShowCookModal(false); setCookDone(false); }}>
                <Text style={s.startBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text style={[s.modalTitle, { color: txt }]}>I cooked this! 🍽️</Text>
              <Text style={[s.modalSub, { color: sub }]}>Share your result and log to today's meal plan.</Text>
              <View style={s.photoRow}>
                <TouchableOpacity
                  style={[s.photoBtn, { backgroundColor: cardAlt }]}
                  onPress={async () => {
                    const { status } = await ImagePicker.requestCameraPermissionsAsync();
                    if (status !== 'granted') {
                      Alert.alert('Permission needed', 'Please allow camera access in Settings.'); return;
                    }
                    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
                    if (!result.canceled) {
                      Alert.alert('📸 Photo saved!', 'Your meal photo has been captured.');
                    }
                  }}
                >
                  <SFIcon name="camera" size={32} color={isDark ? '#CCC' : 'rgba(0,0,0,0.6)'} />
                  <Text style={[s.photoBtnText, { color: txt }]}>Camera</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.photoBtn, { backgroundColor: cardAlt }]}
                  onPress={async () => {
                    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                    if (status !== 'granted') {
                      Alert.alert('Permission needed', 'Please allow photo library access in Settings.'); return;
                    }
                    const result = await ImagePicker.launchImageLibraryAsync({
                      mediaTypes: ['images'], quality: 0.7,
                    });
                    if (!result.canceled) {
                      Alert.alert('📸 Photo selected!', 'Your meal photo has been selected.');
                    }
                  }}
                >
                  <SFIcon name="photo.on.rectangle" size={32} color={isDark ? '#CCC' : 'rgba(0,0,0,0.6)'} />
                  <Text style={[s.photoBtnText, { color: txt }]}>Library</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={[s.startBtn, { marginTop: 8, opacity: cookLogging ? 0.7 : 1 }]}
                onPress={logMeal}
                disabled={cookLogging}
              >
                <Text style={s.startBtnText}>{cookLogging ? '...' : '✓  Log to Meal Plan'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.skipBtn, { backgroundColor: cardAlt }]} onPress={() => setShowCookModal(false)}>
                <Text style={[s.skipBtnText, { color: txt }]}>Skip photo</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </Modal>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1 },

  stickyHeader: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 50,
    paddingHorizontal: 20, paddingBottom: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 8,
  },
  stickyTitle: { fontSize: 16, fontFamily: 'DMSans_700Bold', textAlign: 'center' },

  heroWrap:  { overflow: 'hidden', position: 'relative' },
  heroImg:   { width: '100%', height: HERO_H + 80, marginTop: -40 },
  heroDim:   { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#000' },
  heroGrad:  { position: 'absolute', bottom: 0, left: 0, right: 0, height: 160 },
  heroOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, paddingBottom: 18 },
  heroBadge: {
    backgroundColor: Colors.yellow, borderRadius: 50, paddingHorizontal: 10, paddingVertical: 4,
    alignSelf: 'flex-start', marginBottom: 8,
  },
  heroBadgeText: { fontSize: 10, fontFamily: 'DMSans_700Bold', color: Colors.black },
  heroTitle:     { fontSize: 22, fontFamily: 'LibreBaskerville_700Bold', color: Colors.white, lineHeight: 30 },

  navRow: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 },
  glassBtn:      { width: 38, height: 38, borderRadius: 19, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.18, shadowRadius: 6, elevation: 6 },
  glassBtnInner: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)' },
  glassBtnYellow:{ backgroundColor: 'rgba(245,216,75,0.55)' },
  glassIcon:     { fontSize: 17, fontFamily: 'DMSans_700Bold', color: Colors.white },

  statsBar: { flexDirection: 'row', borderBottomWidth: 1, paddingVertical: 14 },
  statItem:  { flex: 1, alignItems: 'center', gap: 2 },
  statIcon:  { fontSize: 16 },
  statVal:   { fontSize: 13, fontFamily: 'DMSans_700Bold' },
  statLabel: { fontSize: 10, fontFamily: 'DMSans_400Regular' },

  matchCard:   { borderRadius: 16, padding: 14, marginTop: 18, marginBottom: 14 },
  matchHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  matchTitle:  { fontSize: 14, fontFamily: 'DMSans_700Bold', color: Colors.green },
  matchBadge:  { borderRadius: 50, paddingHorizontal: 10, paddingVertical: 3 },
  matchBadgeText: { fontSize: 11, fontFamily: 'DMSans_700Bold', color: Colors.white },
  matchRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  matchItemName:  { flex: 1, fontSize: 13, fontFamily: 'DMSans_500Medium' },
  needBadge:   { backgroundColor: Colors.redLight, borderRadius: 50, paddingHorizontal: 8, paddingVertical: 3 },
  needText:    { fontSize: 10, fontFamily: 'DMSans_700Bold', color: Colors.red },

  description: { fontSize: 14, fontFamily: 'DMSans_400Regular', lineHeight: 22, marginBottom: 18 },

  tabBarWrap: { flexDirection: 'row', borderBottomWidth: 1, marginBottom: 2, position: 'relative' },
  tabItem:    { width: TAB_W, paddingVertical: 12, alignItems: 'center' },
  tabLabel:   { fontSize: 13, fontFamily: 'DMSans_700Bold' },
  tabUnderline: { position: 'absolute', bottom: 0, height: 2.5, backgroundColor: Colors.yellow, borderRadius: 2 },

  servingsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 12 },
  servingsLabel: { fontSize: 14, fontFamily: 'DMSans_500Medium' },
  servingsCtrl:  { flexDirection: 'row', alignItems: 'center', gap: 14 },
  servingsBtn:   { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 2 },
  servingsBtnTxt:{ fontSize: 20, fontFamily: 'DMSans_400Regular', lineHeight: 28 },
  servingsNum:   { fontSize: 18, fontFamily: 'DMSans_700Bold', minWidth: 24, textAlign: 'center' },
  ingCard:   { borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3, marginBottom: 14 },
  ingRow:    { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  ingIconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  ingName:   { fontSize: 14, fontFamily: 'DMSans_700Bold' },
  ingAmt:    { fontSize: 12, fontFamily: 'DMSans_400Regular', marginTop: 2 },
  inFridgeTag: { backgroundColor: Colors.greenLight, borderRadius: 50, paddingHorizontal: 9, paddingVertical: 4 },
  inFridgeText:{ fontSize: 11, fontFamily: 'DMSans_700Bold', color: Colors.green },
  needTag:     { backgroundColor: Colors.blueLight, borderRadius: 50, paddingHorizontal: 9, paddingVertical: 4, flexDirection: 'row', alignItems: 'center' },
  needTagText: { fontSize: 11, fontFamily: 'DMSans_700Bold', color: Colors.blue },
  cartBtn:   { backgroundColor: Colors.black, borderRadius: 50, paddingVertical: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 8 },
  cartBtnText: { fontSize: 14, fontFamily: 'DMSans_700Bold', color: Colors.white },

  legendRow:  { flexDirection: 'row', gap: 18, marginBottom: 14 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot:  { width: 10, height: 10, borderRadius: 5 },
  legendTxt:  { fontSize: 12, fontFamily: 'DMSans_400Regular' },
  stepCard:   { borderRadius: 14, marginBottom: 10, padding: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  stepHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepNumWrap: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  stepNum:    { fontSize: 13, fontFamily: 'DMSans_700Bold', color: Colors.white },
  stepTitle:  { fontSize: 14, fontFamily: 'DMSans_700Bold' },
  stepDur:    { fontSize: 11, fontFamily: 'DMSans_400Regular', marginTop: 2 },
  stepChevron:{ fontSize: 10 },
  stepBody:   { marginTop: 10, padding: 12 },
  stepInfo:   { fontSize: 13, fontFamily: 'DMSans_400Regular', lineHeight: 20, marginBottom: 10 },
  timerBtn:   { backgroundColor: Colors.yellow, borderRadius: 50, paddingVertical: 8, paddingHorizontal: 16, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6 },
  timerText:  { fontSize: 13, fontFamily: 'DMSans_700Bold', color: Colors.black },

  ratingCard:  { borderRadius: 16, padding: 18, flexDirection: 'row', gap: 18, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  ratingLeft:  { alignItems: 'center', gap: 4 },
  ratingBig:   { fontSize: 40, fontFamily: 'LibreBaskerville_700Bold' },
  ratingCount: { fontSize: 11, fontFamily: 'DMSans_400Regular', marginTop: 2 },
  ratingBars:  { flex: 1, gap: 4, justifyContent: 'center' },
  ratingBarRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ratingBarLabel: { fontSize: 11, fontFamily: 'DMSans_500Medium', width: 10 },
  ratingBarTrack: { flex: 1, height: 6, borderRadius: 3 },
  ratingBarFill:  { height: 6, borderRadius: 3, backgroundColor: Colors.yellow },
  triedBanner: { borderRadius: 12, padding: 12, marginBottom: 12 },
  triedText:   { fontSize: 13, fontFamily: 'DMSans_400Regular', color: Colors.black },
  reviewCard:  { borderRadius: 14, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  reviewTop:   { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  reviewAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  reviewUser:  { fontSize: 13, fontFamily: 'DMSans_700Bold' },
  reviewDate:  { fontSize: 11, fontFamily: 'DMSans_400Regular' },
  reviewText:  { fontSize: 13, fontFamily: 'DMSans_400Regular', lineHeight: 20, marginBottom: 6 },
  reviewTries: { fontSize: 11, fontFamily: 'DMSans_400Regular' },

  ctaBar:  { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', paddingHorizontal: 16, paddingTop: 12, gap: 10, borderTopWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: -3 }, shadowOpacity: 0.07, shadowRadius: 10, elevation: 12 },
  startBtn: { flex: 1, backgroundColor: Colors.yellow, borderRadius: 50, paddingVertical: 17, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  startBtnText: { fontSize: 16, fontFamily: 'DMSans_700Bold', color: Colors.black },
  cookedBtn: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  cookedBtnText: { fontSize: 24 },

  modalBack:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  modalSheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 36, shadowColor: '#000', shadowOffset: { width: 0, height: -6 }, shadowOpacity: 0.12, shadowRadius: 20, elevation: 24 },
  sheetHandle:{ width: 44, height: 5, backgroundColor: Colors.borderGray, borderRadius: 3, alignSelf: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 22, fontFamily: 'DMSans_700Bold', marginBottom: 6 },
  modalSub:   { fontSize: 14, fontFamily: 'DMSans_400Regular', lineHeight: 20, marginBottom: 20 },
  photoRow:   { flexDirection: 'row', gap: 12, marginBottom: 16 },
  photoBtn:   { flex: 1, borderRadius: 16, padding: 20, alignItems: 'center', gap: 8 },
  photoBtnText: { fontSize: 14, fontFamily: 'DMSans_500Medium' },
  skipBtn:    { borderRadius: 50, paddingVertical: 15, alignItems: 'center', marginTop: 10 },
  skipBtnText:{ fontSize: 15, fontFamily: 'DMSans_500Medium' },
  cookDone:   { alignItems: 'center', gap: 12, paddingVertical: 20 },
  cookDoneTitle: { fontSize: 22, fontFamily: 'DMSans_700Bold' },
  cookDoneSub:   { fontSize: 14, fontFamily: 'DMSans_400Regular', textAlign: 'center', lineHeight: 20, marginBottom: 8 },
});
