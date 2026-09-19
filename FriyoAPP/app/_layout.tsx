export { ErrorBoundary } from 'expo-router';
import { PushLifecycle } from '@/components/PushLifecycle';
// ─────────────────────────────────────────────────────────────────────────────
// app/_layout.tsx  —  Root layout with auth routing + React Query provider
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect } from 'react';
import { Stack, useRouter, useSegments, useRootNavigationState } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_700Bold,
} from '@expo-google-fonts/dm-sans';
import {
  LibreBaskerville_400Regular,
  LibreBaskerville_700Bold,
  LibreBaskerville_400Regular_Italic,
} from '@expo-google-fonts/libre-baskerville';

import { useAuthStore } from '@/store/authStore';

// ── React Query client ────────────────────────────────────────────────────────
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime:          60_000,   // 1 min before refetch on focus
      retry:              1,
      refetchOnWindowFocus: false,
    },
  },
});

SplashScreen.preventAutoHideAsync();

// ── Auth routing guard ────────────────────────────────────────────────────────
function AuthGuard() {
  const router    = useRouter();
  const segments  = useSegments();
  // Wait until the navigator tree is mounted before any navigation
  const navState  = useRootNavigationState();

  const userId = useAuthStore(s => s.user?.id);
  useEffect(() => { queryClient.clear(); }, [userId]);

  const isReady            = useAuthStore(s => s.isReady);
  const isLoggedIn         = useAuthStore(s => s.isLoggedIn);
  const onboardingComplete = useAuthStore(s => s.onboardingComplete);

  useEffect(() => {
    // Wait until the navigator tree is fully mounted
    if (!navState?.key) return;
    if (!isReady) return;

    const seg0         = segments[0] as string | undefined;
    const onWelcome    = seg0 === undefined || seg0 === 'index';
    const onLogin      = seg0 === 'login';
    const onSignup     = seg0 === 'signup';
    const onOnboarding = seg0 === 'onboarding';
    const inTabs       = seg0 === '(tabs)';

    // Welcome / auth screens are always accessible when not logged in — don't redirect
    if (!isLoggedIn) {
      // Only kick the user out if they somehow landed inside the tabs
      if (inTabs || onOnboarding) router.replace('/login');
      return;
    }

    // Logged in but onboarding not done — redirect to onboarding
    if (!onboardingComplete) {
      if (!onOnboarding) router.replace('/onboarding/step1');
      return;
    }

    // Fully authenticated — skip past auth screens into the app
    if (onWelcome || onLogin || onSignup || onOnboarding) {
      router.replace('/(tabs)');
    }
  }, [navState?.key, isReady, isLoggedIn, onboardingComplete, segments]);

  return null;
}

// ── Root layout ───────────────────────────────────────────────────────────────
export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
    LibreBaskerville_400Regular,
    LibreBaskerville_700Bold,
    LibreBaskerville_400Regular_Italic,
  });

  const checkAuthState = useAuthStore(s => s.checkAuthState);
  const isReady        = useAuthStore(s => s.isReady);

  // Run auth check once on mount
  useEffect(() => {
    checkAuthState();
  }, []);

  // Hide splash only when both fonts and auth are ready
  useEffect(() => {
    if ((fontsLoaded || fontError) && isReady) SplashScreen.hideAsync();
  }, [fontsLoaded, fontError, isReady]);

  if ((!fontsLoaded && !fontError) || !isReady) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <StatusBar style="dark" />
          <AuthGuard />
          <PushLifecycle />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="login" />
            <Stack.Screen name="signup" />
            <Stack.Screen name="onboarding" />
            <Stack.Screen name="(tabs)" />
          </Stack>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
