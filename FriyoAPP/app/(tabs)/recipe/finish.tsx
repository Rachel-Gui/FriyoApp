import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, Image, StyleSheet,
  Dimensions, ScrollView, Animated, Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { Platform } from 'react-native';
import { Colors }   from '@/constants/Colors';
import { SFIcon }   from '@/components/ui/SFIcon';
import { GlassButton } from '@/components/ui/GlassButton';
import { mealPlanService } from '@/services/mealPlanService';

const { width } = Dimensions.get('window');
const PHOTO_W   = width - 48;
const PHOTO_H   = PHOTO_W * 0.68;

export default function FinishCooking() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { recipeId, servings, title } = useLocalSearchParams<{ recipeId?: string; servings?: string; title?: string }>();

  const [photoUri,   setPhotoUri]   = useState<string | null>(null);
  const [mealLogId,  setMealLogId]  = useState<string | null>(null);
  const [isSaving,   setIsSaving]   = useState(false);

  // ── Entrance animations ───────────────────────────────────────────────────
  const checkScale   = useRef(new Animated.Value(0)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const cardSlide    = useRef(new Animated.Value(36)).current;
  const cardOpacity  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.spring(checkScale, {
        toValue: 1, useNativeDriver: true, stiffness: 260, damping: 20,
      }),
      Animated.parallel([
        Animated.timing(titleOpacity, { toValue: 1, duration: 380, useNativeDriver: true }),
        Animated.spring(cardSlide,    { toValue: 0, useNativeDriver: true, stiffness: 240, damping: 26, delay: 120 }),
        Animated.timing(cardOpacity,  { toValue: 1, duration: 380, useNativeDriver: true, delay: 120 }),
      ]),
    ]).start();
  }, []);

  const pickPhoto = async (source: 'camera' | 'library') => {
    const permission = source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', `Please allow ${source === 'camera' ? 'camera' : 'photo library'} access in Settings.`);
      return;
    }
    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync({ quality: 0.8 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!result.canceled && result.assets[0]) setPhotoUri(result.assets[0].uri);
  };

  const saveHistory = async () => {
    if (!recipeId || isSaving || mealLogId) return;
    setIsSaving(true);
    try {
      const log = await mealPlanService.logMeal({
        recipeId,
        mealType:      'dinner',
        servingsEaten: Number(servings ?? 1),
      });
      if (photoUri) {
        await mealPlanService.uploadMealPhoto(log.id, photoUri);
      }
      setMealLogId(log.id);
    } catch (error: any) {
      Alert.alert('Could not save meal', error?.message ?? 'Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={s.root}>
      {/* Warm cream background — no dark box */}
      <View style={s.bgTop} />

      {/* ── Top bar ───────────────────────────────────────────────────── */}
      <View style={[s.topBar, { paddingTop: insets.top + 8 }]}>
        <GlassButton
          variant="circular"
          size={40}
          icon="xmark"
          iconSize={16}
          iconColor="rgba(0,0,0,0.65)"
          onPress={() => router.replace('/(tabs)' as any)}
        />
        <GlassButton
          variant="circular"
          size={40}
          icon="trophy.fill"
          iconSize={16}
          iconColor={Colors.black}
          iconWeight="fill"
        />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 48 }]}
      >
        {/* ── Completion header (glass card — replaces black box) ────── */}
        <Animated.View style={[s.completionCard, { transform: [{ scale: checkScale }], opacity: checkScale }]}>
          <BlurView
            intensity={Platform.OS === 'ios' ? 60 : 0}
            tint="light"
            style={[
              s.completionCardInner,
              Platform.OS === 'android' && { backgroundColor: 'rgba(255,255,255,0.88)' },
            ]}
          >
            <View style={s.completionCardBorder} />

            {/* Success icon */}
            <View style={s.successIconWrap}>
              <SFIcon name="checkmark.circle.fill" size={44} color={Colors.black} weight="fill" />
            </View>

            <Text style={s.mealCompleteTitle}>Meal Complete</Text>
            <Text style={s.mealCompleteSub}>
              Save your dish, update your inventory, or return home.
            </Text>
          </BlurView>
        </Animated.View>

        {/* ── XP / dish name ──────────────────────────────────────────── */}
        <Animated.View style={[s.heroSection, { opacity: titleOpacity }]}>
          <Text style={s.youCookedIt}>You cooked it!</Text>
          <Text style={s.dishName}>{title ?? 'Recipe Complete'}</Text>
          <View style={s.badgeRow}>
            <View style={s.xpBadge}>
              <SFIcon name="star.fill" size={12} color={Colors.black} weight="fill" />
              <Text style={s.xpText}>+150 XP</Text>
            </View>
            <View style={s.levelBadge}>
              <Text style={s.levelText}>Level 13 unlocked</Text>
            </View>
          </View>
        </Animated.View>

        {/* ── Photo card ──────────────────────────────────────────────── */}
        <Animated.View style={[s.photoCard, { opacity: cardOpacity, transform: [{ translateY: cardSlide }] }]}>
          {photoUri ? (
            <Image
              source={{ uri: photoUri }}
              style={s.photoFilled}
              resizeMode="cover"
            />
          ) : (
            <View style={s.photoEmpty}>
              <SFIcon name="camera" size={28} color="rgba(0,0,0,0.28)" />
              <Text style={s.photoEmptyTitle}>Capture your masterpiece</Text>
              <Text style={s.photoEmptySub}>Add a photo to complete the mission</Text>

              {/* Photo action buttons */}
              <View style={s.photoActions}>
                <TouchableOpacity style={s.photoBtn} onPress={() => pickPhoto('camera')} activeOpacity={0.8}>
                  <SFIcon name="camera" size={16} color={Colors.black} />
                  <Text style={s.photoBtnLabel}>Take Photo</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.photoBtn, s.photoBtnYellow]} onPress={() => pickPhoto('library')} activeOpacity={0.8}>
                  <SFIcon name="photo.on.rectangle" size={16} color={Colors.black} />
                  <Text style={s.photoBtnLabel}>Upload</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {photoUri && (
            <TouchableOpacity style={s.retakeBtn} onPress={() => setPhotoUri(null)}>
              <SFIcon name="arrow.clockwise" size={14} color={Colors.gray} />
              <Text style={s.retakeBtnText}>Retake</Text>
            </TouchableOpacity>
          )}
        </Animated.View>

        {/* ── Completion actions ───────────────────────────────────────── */}
        <Animated.View style={{ opacity: cardOpacity, transform: [{ translateY: cardSlide }] }}>
          {/* Action cards */}
          <View style={s.actionList}>
            {ACTION_ITEMS.map(action => (
              <TouchableOpacity
                key={action.label}
                style={s.actionCard}
                activeOpacity={0.8}
                onPress={
                  action.label === 'Save to Cooking History'
                    ? saveHistory
                    : action.label === 'Update Fridge Inventory'
                      ? () => router.push('/(tabs)/fridge/index' as any)
                      : () => router.replace('/(tabs)' as any)
                }
              >
                <View style={s.actionIconWrap}>
                  <SFIcon name={action.icon as any} size={18} color={Colors.black} />
                </View>
                <Text style={s.actionLabel}>
                  {action.label === 'Save to Cooking History' && mealLogId
                    ? 'Saved to Cooking History'
                    : action.label === 'Save to Cooking History' && isSaving
                      ? 'Saving...'
                      : action.label}
                </Text>
                <SFIcon name="chevron.right" size={16} color="rgba(0,0,0,0.25)" />
              </TouchableOpacity>
            ))}
          </View>

          {/* Home button */}
          <TouchableOpacity
            style={s.homeBtn}
            onPress={() => router.replace('/(tabs)' as any)}
            activeOpacity={0.85}
          >
            <SFIcon name="house" size={18} color={Colors.white} />
            <Text style={s.homeBtnText}>Back to Home</Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

// ── Data ──────────────────────────────────────────────────────────────────────
const ACTION_ITEMS = [
  { icon: 'calendar',     label: 'Save to Cooking History' },
  { icon: 'refrigerator', label: 'Update Fridge Inventory' },
  { icon: 'fork.knife',   label: 'Cook This Again' },
];

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.cream },

  // Warm soft gradient — replaces the harsh black box
  bgTop: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 220,
    backgroundColor: 'rgba(245,216,75,0.14)',
  },

  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 8,
  },

  scroll: { paddingHorizontal: 20, paddingTop: 12, gap: 20 },

  // Completion glass card (replaces black box)
  completionCard: {
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.10,
    shadowRadius: 24,
    elevation: 10,
  },
  completionCardInner: {
    borderRadius: 24,
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
    gap: 8,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.60)',
  },
  completionCardBorder: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.70)',
  },
  successIconWrap: {
    width: 72, height: 72,
    backgroundColor: Colors.yellow,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    shadowColor: Colors.yellow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 8,
  },
  mealCompleteTitle: {
    fontSize: 24,
    fontFamily: 'LibreBaskerville_700Bold',
    color: Colors.black,
    letterSpacing: -0.3,
  },
  mealCompleteSub: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    color: Colors.gray,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 12,
  },

  // Hero
  heroSection: { alignItems: 'center', gap: 8 },
  youCookedIt: {
    fontSize: 28,
    fontFamily: 'LibreBaskerville_700Bold',
    color: Colors.black,
    letterSpacing: -0.4,
  },
  dishName: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    color: Colors.gray,
    textAlign: 'center',
  },
  badgeRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  xpBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.yellow,
    borderRadius: 50, paddingHorizontal: 12, paddingVertical: 5,
  },
  xpText: { fontSize: 12, fontFamily: 'DMSans_700Bold', color: Colors.black },
  levelBadge: {
    backgroundColor: Colors.black,
    borderRadius: 50, paddingHorizontal: 12, paddingVertical: 5,
  },
  levelText: { fontSize: 12, fontFamily: 'DMSans_700Bold', color: Colors.yellow },

  // Photo card — clean rounded card, NOT a black box
  photoCard: {
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: Colors.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.09,
    shadowRadius: 20,
    elevation: 6,
  },
  photoFilled: { width: '100%', height: PHOTO_H },
  photoEmpty: {
    height: PHOTO_H,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Colors.borderGray,
    borderRadius: 24,
    margin: 2,
    paddingHorizontal: 24,
  },
  photoEmptyTitle: { fontSize: 15, fontFamily: 'DMSans_700Bold', color: 'rgba(0,0,0,0.45)' },
  photoEmptySub:   { fontSize: 12, fontFamily: 'DMSans_400Regular', color: Colors.gray, textAlign: 'center' },
  photoActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  photoBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: Colors.lightGray,
    borderRadius: 50, paddingHorizontal: 16, paddingVertical: 10,
  },
  photoBtnYellow: { backgroundColor: Colors.yellow },
  photoBtnLabel: { fontSize: 13, fontFamily: 'DMSans_700Bold', color: Colors.black },

  retakeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'center',
    paddingVertical: 12, paddingHorizontal: 20,
  },
  retakeBtnText: { fontSize: 13, fontFamily: 'DMSans_500Medium', color: Colors.gray },

  // Share
  sectionLabel: {
    fontSize: 11,
    fontFamily: 'DMSans_700Bold',
    color: Colors.gray,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    textAlign: 'center',
    marginBottom: 12,
  },
  shareRow: { flexDirection: 'row', justifyContent: 'center', gap: 22, marginBottom: 4 },
  shareBtn: { alignItems: 'center', gap: 6 },
  shareBtnCircle: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: Colors.white,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  shareBtnLabel: { fontSize: 11, fontFamily: 'DMSans_500Medium', color: Colors.gray },

  // Actions
  actionList: { gap: 10, marginTop: 8 },
  actionCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: Colors.white, borderRadius: 18,
    paddingVertical: 15, paddingHorizontal: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  actionIconWrap: {
    width: 36, height: 36,
    backgroundColor: Colors.lightGray,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: { flex: 1, fontSize: 14, fontFamily: 'DMSans_500Medium', color: Colors.black },

  homeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.black,
    borderRadius: 50,
    paddingVertical: 17,
    marginTop: 6,
  },
  homeBtnText: { fontSize: 15, fontFamily: 'DMSans_700Bold', color: Colors.white },
});
