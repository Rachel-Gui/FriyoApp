import { View, Text, Image, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Colors }             from '@/constants/Colors';
import { useAuthStore }       from '@/store/authStore';
import { useOnboardingStore } from '@/store/onboardingStore';
import { userService }        from '@/services/userService';

export default function OnboardingLoading() {
  const router                = useRouter();
  const setOnboardingComplete = useAuthStore(s => s.setOnboardingComplete);
  const dietType              = useOnboardingStore(s => s.dietType);
  const allergies             = useOnboardingStore(s => s.allergies);
  const cookingSkill          = useOnboardingStore(s => s.cookingSkill);
  const cookingTools          = useOnboardingStore(s => s.cookingTools);
  const healthGoals           = useOnboardingStore(s => s.healthGoals);
  const preferredCuisines     = useOnboardingStore(s => s.preferredCuisines);
  const resetOnboarding       = useOnboardingStore(s => s.reset);
  const [saving, setSaving]   = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const finish = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      await userService.updateProfile({
        diet_type:            dietType as any,
        allergies,
        cooking_skill:        cookingSkill as any,
        cooking_tools:        cookingTools,
        health_goals:         healthGoals,
        preferred_cuisines:   preferredCuisines,
        onboarding_completed: true,
      });
      setOnboardingComplete();
      resetOnboarding();
      router.replace('/(tabs)');
    } catch (err: any) {
      setError(err?.status === 401
        ? 'Your session expired. Please log in again.'
        : 'Could not save your profile. Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  }, [
    allergies,
    cookingSkill,
    cookingTools,
    dietType,
    healthGoals,
    preferredCuisines,
    resetOnboarding,
    router,
    setOnboardingComplete,
  ]);

  useEffect(() => {
    finish();
  }, [finish]);

  return (
    <View style={s.container}>
      <Image
        source={require('../../assets/images/login-mascot.png')}
        style={s.mascot}
        resizeMode="contain"
      />
      <Text style={s.text}>
        {error
          ? 'Almost there.'
          : 'No pressure.\nFriyo learns with you\nover time.'}
      </Text>
      {saving ? (
        <ActivityIndicator color={Colors.black} style={s.spinner} />
      ) : error ? (
        <>
          <Text style={s.errorText}>{error}</Text>
          <TouchableOpacity style={s.retryBtn} onPress={finish}>
            <Text style={s.retryText}>Try Again</Text>
          </TouchableOpacity>
          {error.includes('session') && (
            <TouchableOpacity style={s.loginBtn} onPress={() => router.replace('/login')}>
              <Text style={s.loginText}>Log in</Text>
            </TouchableOpacity>
          )}
        </>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: Colors.cream,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40,
  },
  mascot: { width: 142, height: 174, marginBottom: 24 },
  text: {
    fontSize: 22,
    fontFamily: 'DMSans_700Bold',
    color: Colors.black,
    textAlign: 'center',
    lineHeight: 32,
  },
  spinner: { marginTop: 24 },
  errorText: {
    marginTop: 14,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'DMSans_400Regular',
    color: Colors.gray,
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: 24,
    backgroundColor: Colors.black,
    borderRadius: 50,
    paddingHorizontal: 32,
    paddingVertical: 14,
  },
  retryText: { fontSize: 15, fontFamily: 'DMSans_700Bold', color: Colors.white },
  loginBtn: { marginTop: 14, paddingVertical: 8, paddingHorizontal: 16 },
  loginText: { fontSize: 14, fontFamily: 'DMSans_700Bold', color: Colors.black, textDecorationLine: 'underline' },
});
