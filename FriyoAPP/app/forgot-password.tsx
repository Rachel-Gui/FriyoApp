import { useState } from 'react';
import { SafeAreaView, ScrollView, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { authService } from '@/services/authService';
import { Colors } from '@/constants/Colors';

export default function ForgotPassword() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  async function submit() {
    if (busy) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { Alert.alert('Enter a valid email'); return; }
    if (sent && (!/^[a-f0-9]{32}$/.test(code.trim()) || password.length < 8 || password.length > 72)) {
      Alert.alert('Check your details', 'Paste the code from your email and use a password with 8–72 characters.'); return;
    }
    setBusy(true);
    try {
      if (!sent) { await authService.forgotPassword(email); setSent(true); }
      else {
        await authService.resetPassword(email, code, password);
        Alert.alert('Password updated', 'You can now sign in with your new password.', [{ text: 'Sign in', onPress: () => router.replace('/login') }]);
      }
    } catch (error: any) { Alert.alert('Could not continue', error?.message || 'Please try again.'); }
    finally { setBusy(false); }
  }
  const input = { backgroundColor: 'white', padding: 16, borderRadius: 12, fontSize: 16 };
  return <SafeAreaView style={{ flex: 1, backgroundColor: Colors.cream }}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 24, gap: 18 }}>
      <TouchableOpacity onPress={() => router.back()}><Text>‹ Back</Text></TouchableOpacity>
      <Text style={{ fontSize: 28, fontWeight: '600' }}>Reset password</Text>
      <Text>{sent ? 'If an eligible email account exists, we sent a code. Check your inbox and spam folder. The code expires in 15 minutes.' : 'Enter the email you used to create your Friyo account.'}</Text>
      <TextInput accessibilityLabel="Email" style={input} placeholder="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} editable={!sent && !busy} />
      {sent && <>
        <TextInput accessibilityLabel="Reset code" style={input} placeholder="Paste reset code" value={code} onChangeText={setCode} autoCapitalize="none" autoCorrect={false} />
        <TextInput accessibilityLabel="New password" style={input} placeholder="New password (8–72 characters)" value={password} onChangeText={setPassword} secureTextEntry />
      </>}
      <TouchableOpacity disabled={busy} onPress={submit} style={{ padding: 18, backgroundColor: Colors.yellow, borderRadius: 24, alignItems: 'center' }}>
        {busy ? <ActivityIndicator /> : <Text>{sent ? 'Update password' : 'Send reset code'}</Text>}
      </TouchableOpacity>
      {sent && <TouchableOpacity disabled={busy} onPress={() => setSent(false)}><Text>Use another email or request a new code</Text></TouchableOpacity>}
    </ScrollView>
  </SafeAreaView>;
}
