import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useAuthStore } from '@/store/authStore';

export function SocialLoginButtons({ disabled = false }: { disabled?: boolean }) {
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { AppleAuthentication.isAvailableAsync().then(setAppleAvailable).catch(() => {}); }, []);
  async function signIn(provider: 'google' | 'apple') {
    if (busy || disabled) return;
    setBusy(true);
    try {
      const auth = useAuthStore.getState();
      await (provider === 'apple' ? auth.loginWithApple() : auth.loginWithGoogle());
    } catch (error: any) {
      if (error?.code !== 'ERR_REQUEST_CANCELED' && !/cancel/i.test(error?.message || '')) {
        Alert.alert('Sign-in failed', error?.message || 'Please try again.');
      }
    } finally { setBusy(false); }
  }
  return <View style={{ gap: 12 }}>
    <TouchableOpacity accessibilityRole="button" disabled={busy || disabled} onPress={() => signIn('google')}
      style={{ backgroundColor: 'white', borderRadius: 8, minHeight: 48, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#1f1f1f', fontWeight: '600' }}>Continue with Google</Text>
    </TouchableOpacity>
    {appleAvailable && <AppleAuthentication.AppleAuthenticationButton
      buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
      buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
      cornerRadius={8} style={{ height: 48, width: '100%', opacity: busy || disabled ? 0.5 : 1 }} onPress={() => signIn('apple')} />}
    {busy && <ActivityIndicator />}
  </View>;
}
