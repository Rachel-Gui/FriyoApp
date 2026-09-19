import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Dimensions, Animated, Modal,
  useColorScheme, Alert,
} from 'react-native';
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors }  from '@/constants/Colors';
import { SFIcon }  from '@/components/ui/SFIcon';
import { mealPlanService } from '@/services/mealPlanService';
import { aiService }       from '@/services/aiService';
// ── Local types (previously imported from services/api) ───────────────────────
type MealLogEntry = { type: 'breakfast' | 'lunch' | 'dinner' | 'snack'; name: string; cal: number };
type AiInsight    = { icon: string; text: string };

const { width, height } = Dimensions.get('window');
const CELL_W = (width - 40 - 6 * 4) / 7;

// ── Dot colours per meal type ──────────────────────────────────────────────────
const MEAL_COLORS = {
  breakfast: Colors.orange,
  lunch:     Colors.green,
  dinner:    Colors.blue,
  snack:     Colors.yellow,
};

// ── Helpers ────────────────────────────────────────────────────────────────────
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAY_NAMES   = ['S','M','T','W','T','F','S'];

function getDaysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate(); }
function getFirstDay(y: number, m: number)    { return new Date(y, m, 1).getDay(); }
function monthKey(y: number, m: number)       { return `${y}-${String(m + 1).padStart(2, '0')}`; }

function mealName(log: any): string {
  return log?.recipe?.title ?? log?.recipeTitle ?? 'Logged meal';
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

// ── Insight card ───────────────────────────────────────────────────────────────
function InsightCard({ text, icon, isDark }: { text: string; icon: string; isDark: boolean }) {
  return (
    <View style={[ins.card, { backgroundColor: isDark ? '#1E1E1E' : Colors.white }]}>
      <Text style={ins.icon}>{icon}</Text>
      <Text style={[ins.txt, { color: isDark ? '#FFF' : Colors.black }]}>{text}</Text>
    </View>
  );
}
const ins = StyleSheet.create({
  card: { borderRadius: 16, padding: 14, gap: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2, minWidth: 160, marginRight: 12 },
  icon: { fontSize: 24 },
  txt:  { fontSize: 13, fontFamily: 'DMSans_500Medium', lineHeight: 18 },
});

// ── Main component ─────────────────────────────────────────────────────────────
export default function MealsMonth() {
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
  const cellSel = isDark ? '#2A2400' : Colors.yellowLight;

  const now = new Date();
  const [year,      setYear]      = useState(now.getFullYear());
  const [month,     setMonth]     = useState(now.getMonth());
  const [selDay,    setSelDay]    = useState<number | null>(now.getDate());
  const [dayDrawer, setDayDrawer] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showAI,    setShowAI]    = useState(true);
  const drawerAnim  = useRef(new Animated.Value(0)).current;

  // ── API-backed state ───────────────────────────────────────────────────────
  const [logged,    setLogged]    = useState<Record<number, MealLogEntry[]>>({});
  const [insights,  setInsights]  = useState<AiInsight[]>([]);
  const [stats, setStats] = useState({
    mealsCooked: 0,
    avgCal:      0,
    topCuisine:  '—',
    activeDays:  0,
  });

  // ── Fetch month plan ───────────────────────────────────────────────────────
  useEffect(() => {
    setIsLoading(true);

    mealPlanService.getMonth(monthKey(year, month))
      .then((result) => {
        const grouped: Record<number, MealLogEntry[]> = {};
        result.logs.forEach((log: any) => {
          const day = new Date(log.loggedAt).getDate();
          grouped[day] = grouped[day] ?? [];
          grouped[day].push({
            type: (log.mealType ?? 'snack') as MealLogEntry['type'],
            name: mealName(log),
            cal:  log.caloriesTotal ?? log.recipe?.caloriesPerServing ?? 0,
          });
        });

        setLogged(grouped);
        setStats({
          mealsCooked: result.stats.totalMeals,
          avgCal:      result.stats.avgCaloriesPerDay,
          topCuisine:  'Mixed',
          activeDays:  Object.keys(grouped).length,
        });
      })
      .catch((error: any) => {
        setLogged({});
        setStats({
          mealsCooked: 0,
          avgCal:      0,
          topCuisine:  '—',
          activeDays:  0,
        });
        Alert.alert('Could not load meal history', error?.message ?? 'Please try again later.');
      })
      .finally(() => setIsLoading(false));
  }, [year, month]);

  // ── Fetch AI insights ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!showAI) return;
    aiService.getInsights(3)
      .then(items => {
        if (!items.length) return;
        setInsights(items.map(item => ({
          icon: item.type === 'expiry_alert' ? '⚠️' : item.type === 'streak' ? '🔥' : '✦',
          text: item.description,
        })));
      })
      .catch(() => setInsights([]));
  }, [showAI]);

  // ── Drawer helpers ─────────────────────────────────────────────────────────
  const openDrawer = (day: number) => {
    setSelDay(day);
    setDayDrawer(true);
    Animated.spring(drawerAnim, { toValue: 1, useNativeDriver: true, stiffness: 300, damping: 28 }).start();
  };
  const closeDrawer = () => {
    Animated.spring(drawerAnim, { toValue: 0, useNativeDriver: true, stiffness: 400, damping: 30 }).start(() => setDayDrawer(false));
  };

  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else              { setMonth(m => m - 1); }
    setSelDay(null);
  };
  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else               { setMonth(m => m + 1); }
    setSelDay(null);
  };

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay    = getFirstDay(year, month);
  const totalCells  = Math.ceil((daysInMonth + firstDay) / 7) * 7;

  const dayEntries  = selDay ? (logged[selDay] ?? []) : [];

  const drawerY = drawerAnim.interpolate({
    inputRange: [0, 1], outputRange: [300, 0],
  });

  return (
    <SafeAreaView style={[mo.container, { backgroundColor: bg }]} edges={['top']}>
      {/* ── Header ────────────────────────────────────────────────────────────── */}
      <View style={mo.header}>
        <TouchableOpacity
          onPress={() => router.push('/(tabs)/meals' as any)}
          style={[mo.backBtn, { backgroundColor: cardAlt }]}
        >
          <Text style={{ fontSize: 16 }}>←</Text>
        </TouchableOpacity>
        <View style={mo.monthNav}>
          <TouchableOpacity onPress={prevMonth} style={mo.navArrow}>
            <Text style={[mo.navArrowTxt, { color: sub }]}>‹</Text>
          </TouchableOpacity>
          <Text style={[mo.monthTitle, { color: txt }]}>{MONTH_NAMES[month]} {year}</Text>
          <TouchableOpacity onPress={nextMonth} style={mo.navArrow}>
            <Text style={[mo.navArrowTxt, { color: sub }]}>›</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={[mo.todayBtn, { backgroundColor: Colors.yellow }]}
          onPress={() => { setYear(now.getFullYear()); setMonth(now.getMonth()); setSelDay(now.getDate()); }}
        >
          <Text style={mo.todayBtnTxt}>Today</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}>

        {/* ── Stats card ──────────────────────────────────────────────────────── */}
        {isLoading ? (
          <Skel w={width - 40} h={90} r={18} dark={isDark} />
        ) : (
          <View style={[mo.statsCard, { backgroundColor: card }]}>
            {([
              { sfIcon: 'fork.knife' as const, label: 'Meals cooked', value: String(stats.mealsCooked) },
              { sfIcon: 'flame'      as const, label: 'Avg calories', value: `${stats.avgCal} kcal`    },
              { sfIcon: 'globe'      as const, label: 'Top cuisine',  value: stats.topCuisine          },
              { sfIcon: 'calendar'   as const, label: 'Active days',  value: String(stats.activeDays)  },
            ]).map((stat, i) => (
              <View key={i} style={[mo.statItem, i > 0 && { borderLeftWidth: 1, borderLeftColor: border }]}>
                <SFIcon name={stat.sfIcon} size={18} color={Colors.orange} />
                <Text style={[mo.statVal, { color: txt }]}>{stat.value}</Text>
                <Text style={[mo.statLabel, { color: sub }]}>{stat.label}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ── AI Analysis banner ──────────────────────────────────────────────── */}
        {showAI && (
          <View style={[mo.aiBanner, { backgroundColor: isDark ? '#1A1800' : Colors.yellowLight, borderColor: isDark ? '#3A3500' : 'rgba(245,216,75,0.5)' }]}>
            <TouchableOpacity
              style={mo.aiClose}
              onPress={() => setShowAI(false)}
              hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
            >
              <Text style={{ fontSize: 12, color: sub }}>✕</Text>
            </TouchableOpacity>
            <View style={mo.aiBannerTop}>
              <Text style={{ fontSize: 20 }}>✦</Text>
              <Text style={[mo.aiBannerTitle, { color: txt }]}>AI Nutrition Insights</Text>
            </View>
            <Text style={[mo.aiBannerSub, { color: sub }]}>
              You're meeting your protein goal most days. Here's what we found:
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
              {insights.map((ins, i) => (
                <InsightCard key={i} text={ins.text} icon={ins.icon} isDark={isDark} />
              ))}
            </ScrollView>
          </View>
        )}

        {/* ── Calendar grid ───────────────────────────────────────────────────── */}
        <View style={[mo.calendarCard, { backgroundColor: card }]}>
          {/* Day name headers */}
          <View style={mo.dayHeaders}>
            {DAY_NAMES.map((d, i) => (
              <View key={i} style={mo.dayHeaderCell}>
                <Text style={[mo.dayHeaderTxt, { color: sub }]}>{d}</Text>
              </View>
            ))}
          </View>

          {/* Calendar cells */}
          <View style={mo.calGrid}>
            {Array.from({ length: totalCells }).map((_, cellIdx) => {
              const dayNum   = cellIdx - firstDay + 1;
              const isValid  = dayNum >= 1 && dayNum <= daysInMonth;
              const isToday  = isValid && dayNum === now.getDate() && month === now.getMonth() && year === now.getFullYear();
              const isSel    = isValid && dayNum === selDay;
              const entries  = isValid ? (logged[dayNum] ?? []) : [];
              const hasBreak = entries.some(e => e.type === 'breakfast');
              const hasLunch = entries.some(e => e.type === 'lunch');
              const hasDin   = entries.some(e => e.type === 'dinner');
              const hasSnack = entries.some(e => e.type === 'snack');

              return (
                <TouchableOpacity
                  key={cellIdx}
                  disabled={!isValid}
                  onPress={() => isValid && openDrawer(dayNum)}
                  style={[
                    mo.calCell,
                    isSel   && { backgroundColor: cellSel, borderRadius: 10 },
                    isToday && { borderWidth: 1.5, borderColor: Colors.yellow, borderRadius: 10 },
                  ]}
                >
                  <Text style={[
                    mo.calDate,
                    { color: isValid ? txt : 'transparent' },
                    isToday && { color: Colors.yellow, fontFamily: 'DMSans_700Bold' },
                    isSel   && { fontFamily: 'DMSans_700Bold' },
                  ]}>
                    {isValid ? dayNum : ''}
                  </Text>
                  <View style={mo.dotRow}>
                    {hasBreak && <View style={[mo.dot, { backgroundColor: MEAL_COLORS.breakfast }]} />}
                    {hasLunch && <View style={[mo.dot, { backgroundColor: MEAL_COLORS.lunch     }]} />}
                    {hasDin   && <View style={[mo.dot, { backgroundColor: MEAL_COLORS.dinner    }]} />}
                    {hasSnack && <View style={[mo.dot, { backgroundColor: MEAL_COLORS.snack     }]} />}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Legend */}
          <View style={[mo.legend, { borderTopColor: border }]}>
            {Object.entries(MEAL_COLORS).map(([type, color]) => (
              <View key={type} style={mo.legendItem}>
                <View style={[mo.legendDot, { backgroundColor: color }]} />
                <Text style={[mo.legendTxt, { color: sub }]}>{type.charAt(0).toUpperCase() + type.slice(1)}</Text>
              </View>
            ))}
          </View>
        </View>

      </ScrollView>

      {/* ── Day detail drawer ─────────────────────────────────────────────────── */}
      <Modal
        visible={dayDrawer}
        transparent
        animationType="none"
        onRequestClose={closeDrawer}
      >
        <TouchableOpacity style={mo.drawerBack} activeOpacity={1} onPress={closeDrawer} />
        <Animated.View style={[mo.drawerSheet, { backgroundColor: card, transform: [{ translateY: drawerY }] }]}>
          <View style={mo.sheetHandle} />

          <View style={[mo.drawerHeader, { borderBottomColor: border }]}>
            <View>
              <Text style={[mo.drawerTitle, { color: txt }]}>
                {selDay ? `${MONTH_NAMES[month]} ${selDay}` : ''}
              </Text>
              <Text style={[mo.drawerSub, { color: sub }]}>
                {dayEntries.length} meal{dayEntries.length !== 1 ? 's' : ''} logged
              </Text>
            </View>
            <TouchableOpacity onPress={closeDrawer}>
              <Text style={{ fontSize: 18, color: sub }}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 16, gap: 10, paddingBottom: 30 }}>
            {dayEntries.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 32, gap: 10 }}>
                <Text style={{ fontSize: 40 }}>🍽️</Text>
                <Text style={[mo.drawerTitle, { color: sub, fontSize: 15 }]}>No meals logged this day</Text>
              </View>
            ) : (
              dayEntries.map((entry, i) => {
                const dotColor = MEAL_COLORS[entry.type] ?? Colors.gray;
                return (
                  <View key={i} style={[mo.drawerEntry, { backgroundColor: cardAlt }]}>
                    <View style={[mo.drawerEntryDot, { backgroundColor: dotColor }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={[mo.drawerEntryName, { color: txt }]}>{entry.name}</Text>
                      <Text style={[mo.drawerEntryType, { color: sub }]}>
                        {entry.type.charAt(0).toUpperCase() + entry.type.slice(1)} · {entry.cal} kcal
                      </Text>
                    </View>
                  </View>
                );
              })
            )}

            {dayEntries.length > 0 && (
              <View style={[mo.dayCalTotal, { backgroundColor: isDark ? '#2A2400' : Colors.yellowLight }]}>
                <SFIcon name="flame" size={16} color={Colors.orange} />
                <Text style={[mo.dayCalTxt, { color: Colors.black }]}>
                  Total: <Text style={{ fontFamily: 'DMSans_700Bold' }}>
                    {dayEntries.reduce((s, e) => s + e.cal, 0)} kcal
                  </Text>
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={mo.addMealBtn}
              onPress={() => { closeDrawer(); router.push('/(tabs)/meals' as any); }}
            >
              <Text style={mo.addMealTxt}>+ Add Meal</Text>
            </TouchableOpacity>
          </ScrollView>
        </Animated.View>
      </Modal>
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const mo = StyleSheet.create({
  container: { flex: 1 },

  header:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16, gap: 10 },
  backBtn:     { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  monthNav:    { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16 },
  navArrow:    { padding: 6 },
  navArrowTxt: { fontSize: 26, fontFamily: 'DMSans_400Regular' },
  monthTitle:  { fontSize: 18, fontFamily: 'DMSans_700Bold', minWidth: 160, textAlign: 'center' },
  todayBtn:    { borderRadius: 50, paddingHorizontal: 14, paddingVertical: 8 },
  todayBtnTxt: { fontSize: 13, fontFamily: 'DMSans_700Bold', color: Colors.black },

  statsCard: { flexDirection: 'row', marginHorizontal: 20, borderRadius: 18, paddingVertical: 14, marginBottom: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 4 },
  statItem:  { flex: 1, alignItems: 'center', gap: 3 },
  statIcon:  { fontSize: 18 },
  statVal:   { fontSize: 13, fontFamily: 'DMSans_700Bold' },
  statLabel: { fontSize: 9,  fontFamily: 'DMSans_400Regular', textAlign: 'center' },

  aiBanner:     { marginHorizontal: 20, borderRadius: 18, padding: 16, marginBottom: 14, borderWidth: 1.5, shadowColor: Colors.yellow, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.14, shadowRadius: 12, elevation: 3, position: 'relative' },
  aiClose:      { position: 'absolute', top: 12, right: 12, zIndex: 5 },
  aiBannerTop:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6, marginRight: 28 },
  aiBannerTitle:{ fontSize: 15, fontFamily: 'DMSans_700Bold' },
  aiBannerSub:  { fontSize: 13, fontFamily: 'DMSans_400Regular', lineHeight: 18 },

  calendarCard: { marginHorizontal: 20, borderRadius: 18, paddingTop: 14, paddingHorizontal: 10, marginBottom: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 4 },
  dayHeaders:   { flexDirection: 'row', marginBottom: 8 },
  dayHeaderCell:{ width: CELL_W, alignItems: 'center', paddingHorizontal: 2 },
  dayHeaderTxt: { fontSize: 11, fontFamily: 'DMSans_700Bold' },
  calGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  calCell:      { width: CELL_W, height: CELL_W + 6, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 4 },
  calDate:      { fontSize: 13, fontFamily: 'DMSans_500Medium', marginBottom: 2 },
  dotRow:       { flexDirection: 'row', gap: 2, flexWrap: 'wrap', justifyContent: 'center', maxWidth: CELL_W },
  dot:          { width: 5, height: 5, borderRadius: 3 },
  legend:       { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingTop: 12, paddingBottom: 14, borderTopWidth: 1, marginTop: 8, paddingHorizontal: 4 },
  legendItem:   { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot:    { width: 8, height: 8, borderRadius: 4 },
  legendTxt:    { fontSize: 11, fontFamily: 'DMSans_400Regular' },

  drawerBack:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' },
  drawerSheet:  { borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: height * 0.6, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.12, shadowRadius: 20, elevation: 24 },
  sheetHandle:  { width: 44, height: 5, backgroundColor: Colors.borderGray, borderRadius: 3, alignSelf: 'center', marginVertical: 12 },
  drawerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1 },
  drawerTitle:  { fontSize: 18, fontFamily: 'DMSans_700Bold' },
  drawerSub:    { fontSize: 13, fontFamily: 'DMSans_400Regular', marginTop: 2 },
  drawerEntry:  { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, padding: 14 },
  drawerEntryDot: { width: 10, height: 10, borderRadius: 5, marginTop: 2 },
  drawerEntryName:{ fontSize: 14, fontFamily: 'DMSans_700Bold' },
  drawerEntryType:{ fontSize: 12, fontFamily: 'DMSans_400Regular', marginTop: 2 },
  dayCalTotal:  { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, padding: 14 },
  dayCalTxt:    { fontSize: 14, fontFamily: 'DMSans_400Regular' },
  addMealBtn:   { backgroundColor: Colors.yellow, borderRadius: 50, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  addMealTxt:   { fontSize: 15, fontFamily: 'DMSans_700Bold', color: Colors.black },
});
