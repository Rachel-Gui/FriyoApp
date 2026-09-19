import { Tabs, usePathname } from 'expo-router';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Platform, Animated, Dimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRef, useEffect, useCallback } from 'react';
import { Colors } from '@/constants/Colors';
import { SFIcon }        from '@/components/ui/SFIcon';
import { ChatInputBar }  from '@/components/ui/ChatInputBar';
import { useAiChatStore } from '@/store/aiChatStore';

const { width: SCREEN_W } = Dimensions.get('window');

// ── Layout constants ──────────────────────────────────────────────────────────
const H_MARGIN    = 16;
const AI_SIZE     = 62;
const PILL_GAP    = 10;
const PILL_H      = 64;
const PILL_RADIUS = PILL_H / 2;
const PILL_W      = SCREEN_W - H_MARGIN * 2 - AI_SIZE - PILL_GAP;
const TAB_W       = PILL_W / 3;
const IND_INSET   = 5;
const IND_W       = TAB_W - IND_INSET * 2;
const IND_H       = PILL_H - IND_INSET * 2;
const IND_RADIUS  = IND_H / 2;

// ── Routes where the floating nav is visible ──────────────────────────────────
// Sub-screens (recipe detail, cooking, scanner, etc.) hide the nav.
const SHOW_NAV_ON = ['/', '/fridge', '/meals', '/ai'];

// ── Tab definitions (SF Symbols-style via SFIcon) ─────────────────────────────
const MAIN_TABS = [
  { name: 'index',        label: 'Recipe', sfIcon: 'fork.knife'  as const },
  { name: 'fridge/index', label: 'Fridge', sfIcon: 'refrigerator' as const },
  { name: 'meals/index',  label: 'Meals',  sfIcon: 'calendar'    as const },
];

// ── AI chat input — rendered at tab-bar level so it floats above the nav pill ─
// extraBottom = PILL_H(64) + bottomGap(6) + aboveGap(8) - ChatInputBar's own 12
//             = 66  →  wrapper bottom = insets.bottom + 66 + 12 = insets.bottom + 78
const AI_INPUT_EXTRA = PILL_H + 6 + 8 - 12; // = 66

function AiChatInput() {
  const input          = useAiChatStore(s => s.input);
  const setInput       = useAiChatStore(s => s.setInput);
  const bumpSend       = useAiChatStore(s => s.bumpSend);

  const handleSend = useCallback(() => {
    if (input.trim()) bumpSend();
  }, [input]);

  return (
    <ChatInputBar
      value={input}
      onChangeText={setInput}
      onSend={handleSend}
      extraBottom={AI_INPUT_EXTRA}
    />
  );
}

// ── Glass Tab Bar ─────────────────────────────────────────────────────────────
function GlassTabBar({ state, navigation }: any) {
  const insets   = useSafeAreaInsets();
  const pathname = usePathname();

  const focusedName = state.routes[state.index]?.name ?? '';
  const mainTabIdx  = MAIN_TABS.findIndex(t => t.name === focusedName);
  const isAIActive  = focusedName === 'ai';

  // Sliding indicator (layout prop → useNativeDriver: false)
  const indicatorAnim = useRef(new Animated.Value(mainTabIdx >= 0 ? mainTabIdx : 0)).current;

  useEffect(() => {
    if (mainTabIdx >= 0) {
      Animated.spring(indicatorAnim, {
        toValue: mainTabIdx,
        useNativeDriver: false,
        stiffness: 300,
        damping: 28,
        mass: 0.75,
      }).start();
    }
  }, [mainTabIdx]);

  const indicatorLeft = indicatorAnim.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [
      IND_INSET,
      TAB_W + IND_INSET,
      TAB_W * 2 + IND_INSET,
    ],
  });

  // AI button spring scale
  const aiScale    = useRef(new Animated.Value(1)).current;
  const aiPressIn  = () => Animated.spring(aiScale, { toValue: 0.91, useNativeDriver: true, stiffness: 420, damping: 20 }).start();
  const aiPressOut = () => Animated.spring(aiScale, { toValue: 1,    useNativeDriver: true, stiffness: 280, damping: 22 }).start();

  const pressTab = (routeName: string, routeKey: string, focused: boolean) => {
    const event = navigation.emit({ type: 'tabPress', target: routeKey, canPreventDefault: true });
    if (!focused && !event.defaultPrevented) navigation.navigate(routeName);
  };

  const aiRoute = state.routes.find((r: any) => r.name === 'ai');

  // Sit right above the safe-area edge (6 px breathing room)
  const bottomPos = insets.bottom + 6;

  // Route-based visibility — all hooks must be above this line
  if (!SHOW_NAV_ON.includes(pathname)) return null;

  return (
    <>
      {/* AI chat input — only visible on the AI tab, floats above the nav pill */}
      {isAIActive && <AiChatInput />}

    <View style={[s.outerRow, { bottom: bottomPos }]} pointerEvents="box-none">

      {/* ── Main 4-tab pill ─────────────────────────────────────────────── */}
      <View style={s.pillShadow}>
        <BlurView
          intensity={90}
          tint="light"
          style={[s.pill, Platform.OS === 'android' && { backgroundColor: 'rgba(255,255,255,0.95)' }]}
        >
          <View pointerEvents="none" style={s.pillBorder} />

          {mainTabIdx >= 0 && (
            <Animated.View
              pointerEvents="none"
              style={[s.selectionCapsule, { left: indicatorLeft, width: IND_W }]}
            />
          )}

          {MAIN_TABS.map((tab) => {
            const route   = state.routes.find((r: any) => r.name === tab.name);
            if (!route) return null;
            const focused = focusedName === tab.name;
            return (
              <TouchableOpacity
                key={tab.name}
                style={s.pillTab}
                activeOpacity={0.8}
                onPress={() => pressTab(tab.name, route.key, focused)}
              >
                <SFIcon
                  name={tab.sfIcon}
                  size={20}
                  color={focused ? Colors.black : 'rgba(0,0,0,0.35)'}
                  weight={focused ? 'fill' : 'regular'}
                />
                <Text style={[s.tabLabel, focused && s.tabLabelOn]}>{tab.label}</Text>
              </TouchableOpacity>
            );
          })}
        </BlurView>
      </View>

      {/* ── AI floating circle ───────────────────────────────────────────── */}
      {aiRoute && (
        <Animated.View style={[s.aiShadow, { transform: [{ scale: aiScale }] }]}>
          <TouchableOpacity
            activeOpacity={1}
            onPressIn={aiPressIn}
            onPressOut={aiPressOut}
            onPress={() => pressTab('ai', aiRoute.key, isAIActive)}
          >
            <BlurView
              intensity={90}
              tint="light"
              style={[
                s.aiCircle,
                Platform.OS === 'android' && { backgroundColor: 'rgba(255,255,255,0.95)' },
              ]}
            >
              <View pointerEvents="none" style={s.aiCircleBorder} />
              {isAIActive && <View pointerEvents="none" style={s.aiGlow} />}
              <SFIcon
                name="sparkles"
                size={22}
                color={isAIActive ? Colors.black : 'rgba(0,0,0,0.38)'}
                weight={isAIActive ? 'fill' : 'regular'}
              />
              <Text style={[s.aiLabel, isAIActive && s.aiLabelOn]}>AI</Text>
            </BlurView>
          </TouchableOpacity>
        </Animated.View>
      )}
    </View>
    </>
  );
}

// ── Root layout ───────────────────────────────────────────────────────────────
export default function TabLayout() {
  return (
    <Tabs tabBar={(props) => <GlassTabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="fridge/index" />
      <Tabs.Screen name="meals/index" />
      <Tabs.Screen name="community" options={{ href: null }} />
      <Tabs.Screen name="ai" />
      <Tabs.Screen name="recipe/[id]"    options={{ href: null }} />
      <Tabs.Screen name="recipe/cooking" options={{ href: null }} />
      <Tabs.Screen name="recipe/finish"  options={{ href: null }} />
      <Tabs.Screen name="fridge/scanner" options={{ href: null }} />
      <Tabs.Screen name="meals/month"    options={{ href: null }} />
      <Tabs.Screen name="settings"       options={{ href: null }} />
      <Tabs.Screen name="privacy"        options={{ href: null }} />
      <Tabs.Screen name="terms"          options={{ href: null }} />
    </Tabs>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  outerRow: {
    position: 'absolute',
    left: H_MARGIN,
    right: H_MARGIN,
    flexDirection: 'row',
    alignItems: 'center',
    gap: PILL_GAP,
    zIndex: 100,
  },
  pillShadow: {
    flex: 1,
    height: PILL_H,
    borderRadius: PILL_RADIUS,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 24,
    elevation: 20,
    backgroundColor: 'transparent',
  },
  pill: {
    flex: 1,
    height: PILL_H,
    borderRadius: PILL_RADIUS,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  pillBorder: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: PILL_RADIUS,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.75)',
    zIndex: 10,
  },
  selectionCapsule: {
    position: 'absolute',
    top: IND_INSET,
    height: IND_H,
    borderRadius: IND_RADIUS,
    backgroundColor: 'rgba(245,216,75,0.34)',
    borderWidth: 1,
    borderColor: 'rgba(245,216,75,0.55)',
    shadowColor: Colors.yellow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    zIndex: 1,
  },
  pillTab: {
    width: TAB_W,
    height: PILL_H,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    zIndex: 2,
  },
  tabLabel:   { fontSize: 9.5, fontFamily: 'DMSans_500Medium', color: 'rgba(0,0,0,0.35)', letterSpacing: 0.1 },
  tabLabelOn: { fontFamily: 'DMSans_700Bold', color: Colors.black },

  aiShadow: {
    width: AI_SIZE, height: AI_SIZE,
    borderRadius: AI_SIZE / 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 20,
    elevation: 20,
    backgroundColor: 'transparent',
  },
  aiCircle: {
    width: AI_SIZE, height: AI_SIZE,
    borderRadius: AI_SIZE / 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  aiCircleBorder: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: AI_SIZE / 2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.75)',
    zIndex: 10,
  },
  aiGlow: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: AI_SIZE / 2,
    backgroundColor: 'rgba(245,216,75,0.25)',
    zIndex: 1,
  },
  aiLabel:   { fontSize: 9.5, fontFamily: 'DMSans_500Medium', color: 'rgba(0,0,0,0.38)', zIndex: 2 },
  aiLabelOn: { fontFamily: 'DMSans_700Bold', color: Colors.black },
});
