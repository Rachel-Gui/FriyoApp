import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Dimensions, Animated, ActivityIndicator,
} from 'react-native';
import { useState, useRef, useEffect, useCallback } from 'react'; // useCallback used in animateStep
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { Colors }   from '@/constants/Colors';
import { SFIcon }   from '@/components/ui/SFIcon';
import { recipeService } from '@/services/recipeService';
import type { RecipeForCooking } from '@/services/types';

const { width } = Dimensions.get('window');

function stepsFromCooking(data: RecipeForCooking) {
  const recipeSteps = data.adaptation?.adaptedSteps?.length
    ? data.adaptation.adaptedSteps
    : data.recipe.steps;

  return recipeSteps.map((step, index) => ({
    id: index + 1,
    phase: step.stepType === 'hands_off' ? 'REST' : 'COOK',
    phaseColor: step.stepType === 'hands_off' ? Colors.blue : Colors.orange,
    title: `Step ${step.stepNumber ?? index + 1}`,
    instruction: step.description,
    tip: step.tips ?? '',
    duration: Math.max(0, step.durationMin ?? 0) * 60,
    stepIngredients: index === 0
      ? data.fridgeStatus.map(item => item.ingredientName).slice(0, 4)
      : [],
  }));
}

// ── Cooking Mode ──────────────────────────────────────────────────────────────
export default function CookingMode() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id, adaptationId } = useLocalSearchParams<{ id?: string; adaptationId?: string }>();

  const [stepIdx, setStepIdx]       = useState(0);
  const [steps, setSteps]           = useState<ReturnType<typeof stepsFromCooking>>([]);
  const [recipeTitle, setRecipeTitle] = useState('');
  const [isLoading, setIsLoading]   = useState(true);
  const [loadError, setLoadError]   = useState(false);
  const [timerSecs, setTimerSecs]   = useState(0);
  const [running, setRunning]        = useState(false);
  const [timerDone, setTimerDone]    = useState(false);
  const intervalRef                  = useRef<ReturnType<typeof setInterval> | null>(null);

  // Slide animation between steps
  const slideX  = useRef(new Animated.Value(0)).current;
  const cardOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!id) {
      setLoadError(true);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    recipeService.getRecipeForCooking(id, adaptationId)
      .then((data) => {
        const nextSteps = stepsFromCooking(data);
        if (nextSteps.length) {
          setSteps(nextSteps);
          setStepIdx(0);
        }
        setRecipeTitle(data.recipe.title);
        setLoadError(nextSteps.length === 0);
      })
      .catch(() => setLoadError(true))
      .finally(() => setIsLoading(false));
  }, [id, adaptationId]);

  const step = steps[stepIdx];
  const total = steps.length;

  // Reset timer when step changes
  useEffect(() => {
    setRunning(false);
    setTimerDone(false);
    setTimerSecs(step?.duration ?? 0);
  }, [stepIdx, step]);

  // Timer tick
  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setTimerSecs(s => {
          if (s <= 1) {
            setRunning(false);
            setTimerDone(true);
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running]);

  if (isLoading) {
    return (
      <View style={[s.root, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={Colors.gray} />
      </View>
    );
  }

  if (loadError || !step) {
    return (
      <View style={[s.root, { alignItems: 'center', justifyContent: 'center', padding: 28 }]}>
        <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: 20, color: Colors.black }}>Cooking steps unavailable</Text>
        <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 14, color: Colors.gray, textAlign: 'center', marginTop: 8 }}>
          Friyo could not load this recipe. Please check your connection.
        </Text>
        <TouchableOpacity style={{ marginTop: 20, backgroundColor: Colors.yellow, borderRadius: 24, paddingHorizontal: 22, paddingVertical: 12 }} onPress={() => router.back()}>
          <Text style={{ fontFamily: 'DMSans_700Bold', color: Colors.black }}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const mins = String(Math.floor(timerSecs / 60)).padStart(2, '0');
  const secs = String(timerSecs % 60).padStart(2, '0');

  const animateStep = useCallback((direction: 'next' | 'prev', newIdx: number) => {
    const outX  = direction === 'next' ? -width : width;
    const inX   = direction === 'next' ?  width : -width;

    Animated.parallel([
      Animated.timing(slideX,     { toValue: outX, duration: 220, useNativeDriver: true }),
      Animated.timing(cardOpacity, { toValue: 0,    duration: 180, useNativeDriver: true }),
    ]).start(() => {
      setStepIdx(newIdx);
      slideX.setValue(inX);
      cardOpacity.setValue(0);
      Animated.parallel([
        Animated.spring(slideX, { toValue: 0, useNativeDriver: true, stiffness: 280, damping: 26 }),
        Animated.timing(cardOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    });
  }, []);

  const goNext = () => { if (stepIdx < total - 1) animateStep('next', stepIdx + 1); };
  const goPrev = () => { if (stepIdx > 0)          animateStep('prev', stepIdx - 1); };
  const goFinish = () => router.push({ pathname: '/(tabs)/recipe/finish', params: { recipeId: id, servings: '1', title: recipeTitle } } as any);

  const isLast  = stepIdx === total - 1;
  const isFirst = stepIdx === 0;

  return (
    <View style={s.root}>
      {/* ── Top glass bar ─────────────────────────────────────────────────── */}
      <SafeAreaView edges={['top']} style={s.topSafe}>
        <View style={s.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={s.glassBtn}>
            <BlurView intensity={60} tint="light" style={s.glassBtnInner}>
              <SFIcon name="chevron.left" size={20} color="rgba(0,0,0,0.72)" />
            </BlurView>
          </TouchableOpacity>

          <View style={s.topCenter}>
            <Text style={s.topTitle} numberOfLines={1}>{recipeTitle}</Text>
            <Text style={s.topSub}>Step {stepIdx + 1} of {total}</Text>
          </View>

          <View style={s.glassBtn} />
        </View>
      </SafeAreaView>

      {/* ── Progress bar ──────────────────────────────────────────────────── */}
      <View style={s.progressBar}>
        <View style={[s.progressFill, { width: `${((stepIdx + 1) / total) * 100}%` as any }]} />
      </View>

      {/* ── Scrollable step content ───────────────────────────────────────── */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 160 }]}
      >
        {/* Phase badge */}
        <View style={s.phaseRow}>
          <View style={[s.phaseBadge, { backgroundColor: step.phaseColor + '22' }]}>
            <View style={[s.phaseDot, { backgroundColor: step.phaseColor }]} />
            <Text style={[s.phaseText, { color: step.phaseColor }]}>{step.phase}</Text>
          </View>
          {step.duration > 0 && (
            <View style={s.durationBadge}>
              <SFIcon name="timer" size={12} color={Colors.gray} />
              <Text style={s.durationText}>~{Math.ceil(step.duration / 60)} min</Text>
            </View>
          )}
        </View>

        {/* Animated step card */}
        <Animated.View style={[s.stepCard, { transform: [{ translateX: slideX }], opacity: cardOpacity }]}>
          <Text style={s.stepTitle}>{step.title}</Text>
          <Text style={s.stepInstruction}>{step.instruction}</Text>

          {step.tip ? (
            <View style={s.tipBox}>
              <SFIcon name="info.circle" size={16} color={Colors.orange} />
              <Text style={s.tipText}>{step.tip}</Text>
            </View>
          ) : null}
        </Animated.View>

        {/* Timer — only shown if step has duration */}
        {step.duration > 0 && (
          <View style={s.timerBlock}>
            <Text style={s.timerDisplay}>
              {mins}<Text style={s.timerColon}>:</Text>{secs}
            </Text>
            <View style={s.timerLabels}>
              <Text style={s.timerUnit}>MINS</Text>
              <Text style={s.timerUnit}>SECS</Text>
            </View>

            {timerDone ? (
              <View style={s.timerDoneBadge}>
                <SFIcon name="checkmark.circle.fill" size={16} color={Colors.green} weight="fill" />
                <Text style={s.timerDoneText}>Done! Continue to next step.</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={[s.timerBtn, running && s.timerBtnPause]}
                onPress={() => {
                  if (timerDone) return;
                  if (!running && timerSecs === 0) setTimerSecs(step.duration);
                  setRunning(r => !r);
                }}
              >
                <Text style={s.timerBtnText}>
                  {running ? 'Pause Timer' : 'Start Timer'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Ingredients for this step */}
        {step.stepIngredients.length > 0 && (
          <View style={s.ingBlock}>
            <Text style={s.ingBlockTitle}>Ingredients for this step</Text>
            {step.stepIngredients.map((item, i) => (
              <View key={i} style={s.ingRow}>
                <View style={s.ingBullet} />
                <Text style={s.ingText}>{item}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* ── Bottom nav: Prev / Next ───────────────────────────────────────── */}
      <View style={[s.bottomNav, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity
          style={[s.navBtn, isFirst && s.navBtnDisabled]}
          onPress={goPrev}
          disabled={isFirst}
        >
          <Text style={[s.navBtnText, isFirst && s.navBtnTextDisabled]}>
            ← Previous
          </Text>
        </TouchableOpacity>

        {isLast ? (
          <TouchableOpacity style={s.finishBtn} onPress={goFinish}>
            <Text style={s.finishBtnText}>🎉  Finish Cooking</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={s.nextBtn} onPress={goNext}>
            <Text style={s.nextBtnText}>Next Step →</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.cream },

  topSafe: { backgroundColor: Colors.white, zIndex: 10 },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: Colors.borderGray,
  },
  glassBtn:      { width: 38, height: 38, borderRadius: 19, overflow: 'hidden' },
  glassBtnInner: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)',
  },
  glassBtnIcon: { fontSize: 16, fontFamily: 'DMSans_700Bold', color: Colors.black },
  topCenter: { flex: 1, alignItems: 'center', paddingHorizontal: 8 },
  topTitle:  { fontSize: 15, fontFamily: 'DMSans_700Bold', color: Colors.black },
  topSub:    { fontSize: 12, fontFamily: 'DMSans_400Regular', color: Colors.gray, marginTop: 1 },

  progressBar: {
    height: 3,
    backgroundColor: Colors.borderGray,
    zIndex: 5,
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.yellow,
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
  },

  scroll: { paddingTop: 24, paddingHorizontal: 20 },

  phaseRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  phaseBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: 50, paddingHorizontal: 12, paddingVertical: 5,
  },
  phaseDot:  { width: 7, height: 7, borderRadius: 4 },
  phaseText: { fontSize: 11, fontFamily: 'DMSans_700Bold', letterSpacing: 0.8 },
  durationBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.lightGray, borderRadius: 50, paddingHorizontal: 10, paddingVertical: 5,
  },
  durationText: { fontSize: 11, fontFamily: 'DMSans_500Medium', color: Colors.gray },

  stepCard: {
    backgroundColor: Colors.white,
    borderRadius: 24,
    padding: 22,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 5,
    gap: 14,
  },
  stepTitle: {
    fontSize: 24,
    fontFamily: 'LibreBaskerville_700Bold',
    color: Colors.black,
    lineHeight: 32,
  },
  stepInstruction: {
    fontSize: 16,
    fontFamily: 'DMSans_400Regular',
    color: '#333',
    lineHeight: 26,
  },
  tipBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: Colors.yellowLight,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(245,216,75,0.4)',
  },
  tipText: { flex: 1, fontSize: 13, fontFamily: 'DMSans_400Regular', color: '#555', lineHeight: 19 },

  timerBlock: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    alignItems: 'center',
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  timerDisplay: { fontSize: 62, fontFamily: 'DMSans_700Bold', color: Colors.black, letterSpacing: 4 },
  timerColon:   { fontSize: 50, color: Colors.gray },
  timerLabels:  { flexDirection: 'row', gap: 80, marginBottom: 10 },
  timerUnit:    { fontSize: 11, fontFamily: 'DMSans_700Bold', color: Colors.gray, letterSpacing: 1 },
  timerBtn: {
    backgroundColor: Colors.yellow,
    borderRadius: 50,
    paddingVertical: 15,
    paddingHorizontal: 52,
    width: '100%',
    alignItems: 'center',
  },
  timerBtnPause: { backgroundColor: Colors.orange },
  timerBtnText:  { fontSize: 14, fontFamily: 'DMSans_700Bold', color: Colors.black },
  timerDoneBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.greenLight,
    borderRadius: 50,
    paddingVertical: 12,
    paddingHorizontal: 24,
    width: '100%',
    justifyContent: 'center',
  },
  timerDoneText: { fontSize: 14, fontFamily: 'DMSans_700Bold', color: Colors.green },

  ingBlock: {
    backgroundColor: Colors.white,
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  ingBlockTitle: { fontSize: 14, fontFamily: 'DMSans_700Bold', color: Colors.black, marginBottom: 4 },
  ingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  ingBullet: {
    width: 7, height: 7, borderRadius: 4,
    backgroundColor: Colors.yellow,
  },
  ingText: { fontSize: 14, fontFamily: 'DMSans_400Regular', color: Colors.black },

  bottomNav: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 14,
    gap: 10,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.borderGray,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 10,
  },
  navBtn: {
    flex: 0,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 50,
    backgroundColor: Colors.lightGray,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBtnDisabled: { opacity: 0.35 },
  navBtnText:        { fontSize: 14, fontFamily: 'DMSans_700Bold', color: Colors.black },
  navBtnTextDisabled: { color: Colors.gray },
  nextBtn: {
    flex: 1,
    backgroundColor: Colors.yellow,
    borderRadius: 50,
    paddingVertical: 16,
    alignItems: 'center',
  },
  nextBtnText: { fontSize: 16, fontFamily: 'DMSans_700Bold', color: Colors.black },
  finishBtn: {
    flex: 1,
    backgroundColor: Colors.black,
    borderRadius: 50,
    paddingVertical: 16,
    alignItems: 'center',
  },
  finishBtnText: { fontSize: 16, fontFamily: 'DMSans_700Bold', color: Colors.yellow },
});
