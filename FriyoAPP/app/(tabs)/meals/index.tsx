import {
  View, Text, ScrollView, TouchableOpacity, Image,
  StyleSheet, Dimensions, Animated, Modal, PanResponder,
  useColorScheme, TextInput, Alert,
} from 'react-native';
import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors }  from '@/constants/Colors';
import { SFIcon }  from '@/components/ui/SFIcon';
import { mealPlanService } from '@/services/mealPlanService';
import { recipeService }   from '@/services/recipeService';
import { localImageForText } from '@/services/localRecipeImages';
import type { Recipe, WeekPlan as ApiWeekPlan } from '@/services/types';
// ── Local types (previously imported from services/api) ───────────────────────
type RecipeSummary = { id: string; name: string; cal: number; time: string; imageUrl?: string; mealTypes?: string[]; source?: 'saved' | 'suggested' | 'friend' };
type WeekPlanSlot  = { dayIndex: number; slotType: string; recipe: RecipeSummary };

const { width, height } = Dimensions.get('window');
const DAY_LABELS  = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const MEAL_TYPES  = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];
const FILTER_TABS = ['All', 'Saved'];
const MAX_BAR_H   = 64;

const imgSrc = (url: string | undefined, name: string, idx = 0) =>
  url ? { uri: url } : localImageForText(name, idx);

// ── Types ──────────────────────────────────────────────────────────────────────
type MealSlot  = { type: string; recipe: RecipeSummary | null };
type WeekPlan  = Record<number, MealSlot[]>;

const buildEmptyPlan = (): WeekPlan => {
  const p: WeekPlan = {};
  DAY_LABELS.forEach((_, i) => {
    p[i] = MEAL_TYPES.map(t => ({ type: t, recipe: null }));
  });
  return p;
};

// Build WeekPlan from API slots
const slotsToWeekPlan = (slots: WeekPlanSlot[]): WeekPlan => {
  const plan = buildEmptyPlan();
  slots.forEach(slot => {
    const dayIdx  = slot.dayIndex;
    const slotIdx = MEAL_TYPES.findIndex(t => t.toLowerCase() === slot.slotType.toLowerCase());
    if (dayIdx >= 0 && dayIdx < 7 && slotIdx >= 0 && plan[dayIdx]) {
      plan[dayIdx][slotIdx].recipe = slot.recipe;
    }
  });
  return plan;
};

// ── Helpers ────────────────────────────────────────────────────────────────────
function getMonWeekStart() {
  const now = new Date();
  const d   = new Date(now);
  const day = d.getDay(); // 0=Sun
  const diff = (day === 0 ? -6 : 1 - day);
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getWeekDates(monday: Date): number[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d.getDate();
  });
}

function formatWeekLabel(monday: Date): string {
  const end = new Date(monday);
  end.setDate(monday.getDate() + 6);
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  return `${monday.toLocaleDateString('en-GB', opts)} – ${end.toLocaleDateString('en-GB', opts)}`;
}

function toIsoDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

function recipeToSummary(recipe: Recipe, idx = 0): RecipeSummary {
  return {
    id:       recipe.id,
    name:     recipe.title,
    cal:      recipe.caloriesPerServing ?? 0,
    time:     `${(recipe.prepTimeMin ?? 0) + (recipe.cookTimeMin ?? 0)} min`,
    imageUrl: recipe.imageUrl,
    mealTypes: recipe.mealType ? [recipe.mealType.charAt(0).toUpperCase() + recipe.mealType.slice(1)] : undefined,
    source: 'saved',
  };
}

function logToSummary(log: any): RecipeSummary | null {
  const recipe = log?.recipe;
  if (!recipe) return null;
  return recipeToSummary(recipe);
}

function apiWeekToPlan(apiPlan: ApiWeekPlan, monday: Date, recipes: RecipeSummary[]): WeekPlan {
  const plan = buildEmptyPlan();
  const byId = new Map(recipes.map(recipe => [recipe.id, recipe]));

  Object.entries(apiPlan).forEach(([dateKey, day]) => {
    const date = new Date(`${dateKey}T00:00:00`);
    const dayIdx = Math.round((date.getTime() - monday.getTime()) / 86_400_000);
    if (dayIdx < 0 || dayIdx > 6) return;

    MEAL_TYPES.forEach((mealType, slotIdx) => {
      const key = mealType.toLowerCase() as 'breakfast' | 'lunch' | 'dinner' | 'snack';
      const directLog = key === 'snack' ? day.snacks?.[0] : day[key];
      const plannedId = key === 'snack' ? day.planned?.snacks?.[0] : day.planned?.[key];
      plan[dayIdx][slotIdx].recipe = logToSummary(directLog) ?? (plannedId ? byId.get(plannedId) ?? null : null);
    });
  });

  return plan;
}

function planToApiPayload(plan: WeekPlan, monday: Date) {
  return Object.fromEntries(
    Array.from({ length: 7 }, (_, dayIdx) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + dayIdx);
      const slots = plan[dayIdx];
      return [
        toIsoDate(date),
        {
          breakfast: slots[0]?.recipe?.id,
          lunch:     slots[1]?.recipe?.id,
          dinner:    slots[2]?.recipe?.id,
          snacks:    slots[3]?.recipe ? [slots[3].recipe.id] : [],
        },
      ];
    }),
  );
}

// ── Skeleton ───────────────────────────────────────────────────────────────────
function Skel({ w, h, r = 8, dark }: { w: number | string; h: number; r?: number; dark: boolean }) {
  const a = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(a, { toValue: 0.85, duration: 750, useNativeDriver: true }),
      Animated.timing(a, { toValue: 0.3,  duration: 750, useNativeDriver: true }),
    ])).start();
  }, []);
  return <Animated.View style={{ width: w as any, height: h, borderRadius: r, backgroundColor: dark ? '#2a2a2a' : '#E0E0E0', opacity: a }} />;
}

// ── Main screen ────────────────────────────────────────────────────────────────
export default function MealsWeek() {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const scheme  = useColorScheme() ?? 'light';
  const isDark  = scheme === 'dark';

  const bg      = isDark ? '#111111' : Colors.cream;
  const card    = isDark ? '#1E1E1E' : Colors.white;
  const cardAlt = isDark ? '#252525' : Colors.lightGray;
  const txt     = isDark ? '#FFFFFF' : Colors.black;
  const sub     = isDark ? '#9A9A9A' : Colors.gray;
  const border  = isDark ? '#2E2E2E' : Colors.borderGray;

  const today      = new Date();
  const dayOfWeek  = (today.getDay() + 6) % 7; // 0=Mon, 6=Sun
  const weekStart  = getMonWeekStart();
  const weekDates  = getWeekDates(weekStart);
  const weekLabel  = formatWeekLabel(weekStart);

  // ── API-backed state ───────────────────────────────────────────────────────
  const [weekPlan,    setWeekPlan]    = useState<WeekPlan>(buildEmptyPlan());
  const [dailyCals,   setDailyCals]   = useState<number[]>(Array(7).fill(0));
  const [pickerRecipes, setPickerRecipes] = useState<RecipeSummary[]>([]);
  const [isLoading,   setIsLoading]   = useState(true);

  // ── UI state ───────────────────────────────────────────────────────────────
  const [selectedDay,  setSelectedDay]  = useState(dayOfWeek);
  const [showPicker,   setShowPicker]   = useState(false);
  const [pickingFor,   setPickingFor]   = useState<{ day: number; slotIdx: number } | null>(null);
  const [filter,       setFilter]       = useState('All');
  const [search,       setSearch]       = useState('');
  const isExpandedRef  = useRef(false);

  const HALF_H = height * 0.52;
  const FULL_H = height * 0.88;
  const sheetAnim = useRef(new Animated.Value(HALF_H)).current;

  // ── Fetch week plan ────────────────────────────────────────────────────────
  useEffect(() => {
    const start = weekStart.toISOString().split('T')[0];
    setIsLoading(true);

    Promise.all([
      mealPlanService.getWeekPlan(start),
      recipeService.getSavedRecipes().catch(() => []),
    ])
      .then(([apiPlan, savedRecipes]) => {
        const recipeSummaries = savedRecipes.map(recipeToSummary);
        setWeekPlan(apiWeekToPlan(apiPlan, weekStart, recipeSummaries));
        setPickerRecipes(recipeSummaries);
        setDailyCals(
          Array.from({ length: 7 }, (_, dayIdx) =>
            (apiWeekToPlan(apiPlan, weekStart, recipeSummaries)[dayIdx] ?? [])
              .reduce((sum, slot) => sum + (slot.recipe?.cal ?? 0), 0),
          ),
        );
      })
      .catch((error: any) => {
        setWeekPlan(buildEmptyPlan());
        setDailyCals(Array(7).fill(0));
        Alert.alert('Could not load meal plan', error?.message ?? 'Please try again later.');
      })
      .finally(() => setIsLoading(false));
  }, []);

  // ── Fetch saved recipes for picker ────────────────────────────────────────
  useEffect(() => {
    if (!showPicker) return;
    recipeService.getSavedRecipes()
      .then(recipes => {
        const saved = recipes.map(recipeToSummary);
        setPickerRecipes(saved);
      })
      .catch((error: any) => {
        setPickerRecipes([]);
        Alert.alert('Could not load saved recipes', error?.message ?? 'Please try again.');
      });
  }, [showPicker, search]);

  // ── PanResponder for bottom sheet ─────────────────────────────────────────
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dy) > 8,
      onPanResponderMove: (_, gs) => {
        const base = isExpandedRef.current ? FULL_H : HALF_H;
        sheetAnim.setValue(Math.min(FULL_H, Math.max(HALF_H, base - gs.dy)));
      },
      onPanResponderRelease: (_, gs) => {
        const expand   = () => { isExpandedRef.current = true;  Animated.spring(sheetAnim, { toValue: FULL_H, useNativeDriver: false }).start(); };
        const collapse = () => { isExpandedRef.current = false; Animated.spring(sheetAnim, { toValue: HALF_H, useNativeDriver: false }).start(); };
        if (gs.dy < -40) expand();
        else if (gs.dy > 40) collapse();
        else isExpandedRef.current ? expand() : collapse();
      },
    })
  ).current;

  // ── Open / close picker ───────────────────────────────────────────────────
  const openPicker = (day: number, slotIdx: number) => {
    setPickingFor({ day, slotIdx });
    isExpandedRef.current = false;
    sheetAnim.setValue(HALF_H);
    setShowPicker(true);
  };

  // ── Assign recipe to slot ─────────────────────────────────────────────────
  const selectRecipe = useCallback(async (recipe: RecipeSummary) => {
    if (!pickingFor) return;
    const { day, slotIdx } = pickingFor;
    // Optimistic UI
    setWeekPlan(prev => {
      const next = { ...prev };
      next[day] = prev[day].map((slot, i) => i === slotIdx ? { ...slot, recipe } : slot);
      return next;
    });
    setDailyCals(prev => prev.map((cal, i) => i === day
      ? (weekPlan[day] ?? []).reduce((sum, slot, currentIdx) =>
          sum + (currentIdx === slotIdx ? recipe.cal : slot.recipe?.cal ?? 0), 0)
      : cal
    ));
    setShowPicker(false);
    // Persist to API
    try {
      const nextPlan = {
        ...weekPlan,
        [day]: weekPlan[day].map((slot, i) => i === slotIdx ? { ...slot, recipe } : slot),
      };
      await mealPlanService.saveWeekPlan({
        weekStartDate: toIsoDate(weekStart),
        plan:          planToApiPayload(nextPlan, weekStart),
      });
    } catch (error: any) {
      setWeekPlan(weekPlan);
      Alert.alert('Could not save meal plan', error?.message ?? 'Your change was not saved.');
    }
  }, [pickingFor, weekPlan, weekStart]);

  // ── Remove slot ───────────────────────────────────────────────────────────
  const removeSlot = useCallback(async (day: number, slotIdx: number) => {
    // Optimistic UI
    setWeekPlan(prev => {
      const next = { ...prev };
      next[day] = prev[day].map((slot, i) => i === slotIdx ? { ...slot, recipe: null } : slot);
      return next;
    });
    setDailyCals(prev => prev.map((cal, i) => i === day
      ? (weekPlan[day] ?? []).reduce((sum, slot, currentIdx) =>
          sum + (currentIdx === slotIdx ? 0 : slot.recipe?.cal ?? 0), 0)
      : cal
    ));
    // Persist
    try {
      const nextPlan = {
        ...weekPlan,
        [day]: weekPlan[day].map((slot, i) => i === slotIdx ? { ...slot, recipe: null } : slot),
      };
      await mealPlanService.saveWeekPlan({
        weekStartDate: toIsoDate(weekStart),
        plan:          planToApiPayload(nextPlan, weekStart),
      });
    } catch (error: any) {
      setWeekPlan(weekPlan);
      Alert.alert('Could not save meal plan', error?.message ?? 'Your change was not saved.');
    }
  }, [weekPlan, weekStart]);

  const todaySlots = weekPlan[selectedDay] ?? MEAL_TYPES.map(t => ({ type: t, recipe: null }));
  const dayCals    = todaySlots.reduce((sum, slot) => sum + (slot.recipe?.cal ?? 0), 0);
  const computedDailyCals = Array.from({ length: 7 }, (_, dayIdx) =>
    (weekPlan[dayIdx] ?? []).reduce((sum, slot) => sum + (slot.recipe?.cal ?? 0), 0)
  );
  const chartCals = computedDailyCals.some(Boolean) ? computedDailyCals : dailyCals;
  const maxCal     = Math.max(...chartCals, 1, 2000);

  const targetMealType = pickingFor ? todaySlots[pickingFor.slotIdx]?.type : null;
  const filteredRecipes = pickerRecipes
    .filter((recipe, index, list) => list.findIndex(item => item.id === recipe.id) === index)
    .filter(recipe => {
      if (filter === 'Saved') return recipe.source === 'saved';
      return true;
    })
    .filter(recipe => !targetMealType || !recipe.mealTypes?.length || recipe.mealTypes.includes(targetMealType))
    .filter(r => r.name.toLowerCase().includes(search.toLowerCase()));

  const BOTTOM_PAD = 70 + insets.bottom;

  return (
    <SafeAreaView style={[st.container, { backgroundColor: bg }]} edges={['top']}>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <View style={st.header}>
        <View>
          <Text style={[st.title, { color: txt }]}>Meal Plan</Text>
          <Text style={[st.subtitle, { color: sub }]}>{weekLabel}</Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push('/(tabs)/meals/month' as any)}
          style={[st.monthBtn, { backgroundColor: cardAlt }]}
        >
          <SFIcon name="calendar" size={17} color={txt} />
          <Text style={[st.monthBtnTxt, { color: txt }]}>Month</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: BOTTOM_PAD }}>

        {/* ── Day selector ─────────────────────────────────────────────────── */}
        <View style={[st.daySelectorWrap, { backgroundColor: card }]}>
          {DAY_LABELS.map((day, i) => {
            const hasMeal = weekPlan[i]?.some(s => s.recipe !== null);
            const isSel   = selectedDay === i;
            const isToday = i === dayOfWeek;
            return (
              <TouchableOpacity
                key={i}
                style={[st.dayBtn, isSel && { backgroundColor: Colors.yellow }]}
                onPress={() => setSelectedDay(i)}
              >
                <Text style={[st.dayLetter, { color: isSel ? Colors.black : sub }]}>{day}</Text>
                <Text style={[st.dayDate, { color: isSel ? Colors.black : txt, fontFamily: isToday ? 'DMSans_700Bold' : 'DMSans_400Regular' }]}>
                  {weekDates[i]}
                </Text>
                {hasMeal && !isSel && <View style={[st.dayDot, { backgroundColor: Colors.orange }]} />}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Day summary ──────────────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 20, marginTop: 18, marginBottom: 8 }}>
          <View style={st.daySummaryRow}>
            <Text style={[st.daySummaryTitle, { color: txt }]}>
              {['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'][selectedDay]}
            </Text>
            {dayCals > 0 && (
              <View style={[st.calBadge, { backgroundColor: isDark ? '#2A2A00' : Colors.yellowLight }]}>
                <SFIcon name="flame" size={13} color={Colors.orange} /><Text style={[st.calBadgeTxt, { color: Colors.black }]}> {dayCals} kcal</Text>
              </View>
            )}
          </View>
        </View>

        {/* ── Meal slots ───────────────────────────────────────────────────── */}
        {isLoading ? (
          <View style={{ paddingHorizontal: 20, gap: 14 }}>
            {[1, 2, 3, 4].map(i => <Skel key={i} w="100%" h={80} r={16} dark={isDark} />)}
          </View>
        ) : (
          <View style={{ paddingHorizontal: 20, gap: 14 }}>
            {todaySlots.map((slot, slotIdx) => (
              <View key={slot.type}>
                <Text style={[st.slotLabel, { color: sub }]}>{slot.type}</Text>
                {slot.recipe ? (
                  <View style={[st.filledSlot, { backgroundColor: card }]}>
                    <Image source={imgSrc(slot.recipe.imageUrl, slot.recipe.name, slotIdx)} style={st.filledImg} resizeMode="cover" />
                    <View style={st.filledOverlay} />
                    <View style={st.filledContent}>
                      <Text style={st.filledName} numberOfLines={1}>{slot.recipe.name}</Text>
                      <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                        <View style={[st.metaPill, { flexDirection: 'row', alignItems: 'center', gap: 4 }]}><SFIcon name="flame" size={11} color={Colors.orange} /><Text style={st.metaTxt}>{slot.recipe.cal} kcal</Text></View>
                        <View style={[st.metaPill, { flexDirection: 'row', alignItems: 'center', gap: 4 }]}><SFIcon name="timer" size={11} color="rgba(0,0,0,0.5)" /><Text style={st.metaTxt}>{slot.recipe.time}</Text></View>
                      </View>
                    </View>
                    <TouchableOpacity
                      style={st.removeBtn}
                      onPress={() => removeSlot(selectedDay, slotIdx)}
                      hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                    >
                      <Text style={{ fontSize: 13, color: Colors.white }}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[st.emptySlot, { borderColor: border }]}
                    onPress={() => openPicker(selectedDay, slotIdx)}
                  >
                    <View style={[st.plusCircle, { backgroundColor: cardAlt }]}>
                      <Text style={[st.plusTxt, { color: sub }]}>+</Text>
                    </View>
                    <Text style={[st.addTxt, { color: sub }]}>Add {slot.type}</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        )}

        {/* ── Weekly calorie chart ──────────────────────────────────────────── */}
        <View style={[st.chartCard, { backgroundColor: card }]}>
          <View style={st.chartHeader}>
            <Text style={[st.chartTitle, { color: txt }]}>Weekly Calories</Text>
            <Text style={[st.chartSub, { color: sub }]}>Goal: 2000 kcal/day</Text>
          </View>
          <View style={st.chartBars}>
            {chartCals.map((cal, i) => {
              const barH     = cal > 0 ? Math.max(8, (cal / maxCal) * MAX_BAR_H) : 0;
              const isSel    = selectedDay === i;
              const overGoal = cal > 2000;
              return (
                <TouchableOpacity key={i} style={st.barCol} onPress={() => setSelectedDay(i)}>
                  <Text style={[st.barCalLabel, { color: sub }]}>
                    {cal > 0 ? `${Math.round(cal / 100) / 10}k` : ''}
                  </Text>
                  <View style={st.barTrack}>
                    <View style={[
                      st.bar,
                      { height: barH, backgroundColor: isSel ? Colors.yellow : overGoal ? Colors.orange : (isDark ? '#444' : Colors.borderGray) },
                    ]} />
                  </View>
                  <Text style={[st.barDayLabel, { color: isSel ? txt : sub, fontFamily: isSel ? 'DMSans_700Bold' : 'DMSans_400Regular' }]}>
                    {DAY_LABELS[i]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={[st.goalLine, { bottom: 28 + (2000 / maxCal) * MAX_BAR_H, borderColor: isDark ? '#444' : Colors.borderGray }]}>
            <Text style={[st.goalLineTxt, { color: sub }]}>2000</Text>
          </View>
        </View>

      </ScrollView>

      {/* ── Recipe Picker Modal ───────────────────────────────────────────────── */}
      <Modal visible={showPicker} transparent animationType="slide" onRequestClose={() => setShowPicker(false)}>
        <TouchableOpacity style={st.modalBack} activeOpacity={1} onPress={() => setShowPicker(false)} />
        <Animated.View style={[st.sheet, { height: sheetAnim, backgroundColor: card }]}>
          <View {...panResponder.panHandlers} style={st.handleArea}>
            <View style={[st.handle, { backgroundColor: border }]} />
          </View>
          <View style={st.sheetHeader}>
            <Text style={[st.sheetTitle, { color: txt }]}>
              {pickingFor ? `Add ${todaySlots[pickingFor.slotIdx]?.type ?? 'Meal'}` : 'Choose a Recipe'}
            </Text>
            <Text style={[st.sheetSub, { color: sub }]}>
              {filteredRecipes.length} option{filteredRecipes.length === 1 ? '' : 's'} available
            </Text>
          </View>
          {/* Filter chips */}
          <View style={st.sheetFilters}>
            {FILTER_TABS.map(t => (
              <TouchableOpacity
                key={t}
                style={[st.filterChip, filter === t && { backgroundColor: Colors.yellow }]}
                onPress={() => setFilter(t)}
              >
                <Text style={[st.filterTxt, { color: filter === t ? Colors.black : sub }]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {/* Search */}
          <View style={[st.sheetSearch, { backgroundColor: cardAlt }]}>
            <SFIcon name="magnifyingglass" size={15} color={sub} />
            <TextInput
              style={[st.sheetInput, { color: txt }]}
              placeholder="Search recipes"
              placeholderTextColor={sub}
              value={search}
              onChangeText={setSearch}
            />
          </View>
          {/* Grid */}
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={st.recipeGrid}>
            {filteredRecipes.length === 0 ? (
              <View style={st.emptyPicker}>
                <Text style={[st.emptyPickerTitle, { color: txt }]}>No recipes here yet</Text>
                <Text style={[st.emptyPickerSub, { color: sub }]}>Try All, clear search, or save recipes from Home first.</Text>
              </View>
            ) : filteredRecipes.map((r, idx) => (
              <TouchableOpacity
                key={r.id}
                style={st.recipeItem}
                onPress={() => selectRecipe(r)}
                activeOpacity={0.85}
              >
                <Image source={imgSrc(r.imageUrl, r.name, idx)} style={st.recipeItemImg} resizeMode="cover" />
                <View style={st.recipeItemOverlay}>
                  <Text style={st.recipeItemName} numberOfLines={2}>{r.name}</Text>
                  <SFIcon name="flame" size={11} color={Colors.orange} /><Text style={st.recipeItemCal}> {r.cal} kcal</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity style={[st.cancelBtn, { backgroundColor: cardAlt }]} onPress={() => setShowPicker(false)}>
            <Text style={[st.cancelTxt, { color: txt }]}>Cancel</Text>
          </TouchableOpacity>
        </Animated.View>
      </Modal>
    </SafeAreaView>
  );
}

const ITEM_W = (width - 60) / 2;

const st = StyleSheet.create({
  container: { flex: 1 },
  header:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 14 },
  title:     { fontSize: 26, fontFamily: 'LibreBaskerville_700Bold' },
  subtitle:  { fontSize: 13, fontFamily: 'DMSans_400Regular', marginTop: 2 },
  monthBtn:  { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 50, paddingHorizontal: 14, paddingVertical: 8 },
  monthBtnTxt: { fontSize: 13, fontFamily: 'DMSans_500Medium' },

  daySelectorWrap: { flexDirection: 'row', marginHorizontal: 20, borderRadius: 20, paddingVertical: 8, paddingHorizontal: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 4 },
  dayBtn:   { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 14, gap: 2 },
  dayLetter:{ fontSize: 11, fontFamily: 'DMSans_500Medium' },
  dayDate:  { fontSize: 15 },
  dayDot:   { width: 5, height: 5, borderRadius: 3, marginTop: 2 },

  daySummaryRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  daySummaryTitle:{ fontSize: 18, fontFamily: 'DMSans_700Bold' },
  calBadge:       { borderRadius: 50, paddingHorizontal: 12, paddingVertical: 5 },
  calBadgeTxt:    { fontSize: 12, fontFamily: 'DMSans_700Bold' },

  slotLabel: { fontSize: 13, fontFamily: 'DMSans_700Bold', marginBottom: 6 },
  filledSlot:{ borderRadius: 16, height: 88, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 3 },
  filledImg: { position: 'absolute', width: '100%', height: '100%' },
  filledOverlay:{ position: 'absolute', width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.42)' },
  filledContent:{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 12 },
  filledName:   { fontSize: 14, fontFamily: 'DMSans_700Bold', color: Colors.white },
  metaPill:     { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 50, paddingHorizontal: 8, paddingVertical: 3 },
  metaTxt:      { fontSize: 11, fontFamily: 'DMSans_500Medium', color: Colors.white },
  removeBtn:    { position: 'absolute', top: 10, right: 10, width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  emptySlot:    { borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 50, paddingVertical: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  plusCircle:   { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  plusTxt:      { fontSize: 22, fontFamily: 'DMSans_400Regular' },
  addTxt:       { fontSize: 14, fontFamily: 'DMSans_500Medium' },

  chartCard:   { margin: 20, borderRadius: 20, padding: 18, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 4, position: 'relative' },
  chartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  chartTitle:  { fontSize: 15, fontFamily: 'DMSans_700Bold' },
  chartSub:    { fontSize: 12, fontFamily: 'DMSans_400Regular' },
  chartBars:   { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: MAX_BAR_H + 40 },
  barCol:      { flex: 1, alignItems: 'center', gap: 4 },
  barCalLabel: { fontSize: 9, fontFamily: 'DMSans_400Regular' },
  barTrack:    { width: '60%', height: MAX_BAR_H, justifyContent: 'flex-end' },
  bar:         { width: '100%', borderRadius: 6 },
  barDayLabel: { fontSize: 12 },
  goalLine:    { position: 'absolute', left: 18, right: 18, borderTopWidth: 1, borderStyle: 'dashed', flexDirection: 'row', alignItems: 'center' },
  goalLineTxt: { fontSize: 9, fontFamily: 'DMSans_400Regular', position: 'absolute', right: 0, top: -10 },

  modalBack:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.28)' },
  sheet:       { position: 'absolute', bottom: 0, left: 0, right: 0, borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 20, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 24 },
  handleArea:  { alignItems: 'center', paddingVertical: 12 },
  handle:      { width: 44, height: 5, borderRadius: 3 },
  sheetHeader: { marginBottom: 14 },
  sheetTitle:  { fontSize: 20, fontFamily: 'DMSans_700Bold' },
  sheetSub:    { fontSize: 12, fontFamily: 'DMSans_400Regular', marginTop: 3 },
  sheetFilters:{ flexDirection: 'row', gap: 8, marginBottom: 12 },
  filterChip:  { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 50, backgroundColor: Colors.lightGray },
  filterTxt:   { fontSize: 13, fontFamily: 'DMSans_500Medium' },
  sheetSearch: { flexDirection: 'row', alignItems: 'center', borderRadius: 50, paddingHorizontal: 16, paddingVertical: 10, marginBottom: 14, gap: 8 },
  sheetInput:  { flex: 1, fontSize: 14, fontFamily: 'DMSans_400Regular' },
  recipeGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingBottom: 8 },
  emptyPicker: { width: '100%', alignItems: 'center', justifyContent: 'center', paddingVertical: 42, paddingHorizontal: 20 },
  emptyPickerTitle: { fontSize: 16, fontFamily: 'DMSans_700Bold', marginBottom: 6 },
  emptyPickerSub: { fontSize: 13, fontFamily: 'DMSans_400Regular', textAlign: 'center', lineHeight: 18 },
  recipeItem:  { width: ITEM_W, height: 148, borderRadius: 16, overflow: 'hidden' },
  recipeItemImg: { width: '100%', height: '100%' },
  recipeItemOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 10, backgroundColor: 'rgba(0,0,0,0.44)' },
  recipeItemName:{ fontFamily: 'DMSans_700Bold', color: Colors.white, fontSize: 12 },
  recipeItemCal: { fontFamily: 'DMSans_400Regular', color: 'rgba(255,255,255,0.85)', fontSize: 10, marginTop: 3 },
  cancelBtn:   { paddingVertical: 15, alignItems: 'center', borderRadius: 50, marginVertical: 12 },
  cancelTxt:   { fontSize: 15, fontFamily: 'DMSans_500Medium' },
});
