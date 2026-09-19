import {
  View,
  Text,
  Image,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/Colors';
import { SFIcon } from '@/components/ui/SFIcon';
import { SocialLoginButtons } from '@/components/auth/SocialLoginButtons';
import { useAuthStore } from '@/store/authStore';

const { width, height } = Dimensions.get('window');

export default function LoginScreen() {
  const router   = useRouter();
  const login    = useAuthStore(s => s.login);
  const canGoBack = router.canGoBack();
  const [email,       setEmail]       = useState('');
  const [password,    setPassword]    = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading,     setLoading]     = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Missing fields', 'Please enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      await login(email.trim(), password);
      router.replace('/(tabs)' as any);
    } catch (err: any) {
      if (err?.status === 401 || err?.status === 400) {
        Alert.alert('Login failed', 'Incorrect email or password.');
      } else {
        Alert.alert('Connection error', 'Could not reach the server. Please check your internet connection.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.container}>
        <Image source={require('../assets/images/fridge-bg.jpg')} style={styles.bg} resizeMode="cover" />
        <View style={styles.overlay} />

        <SafeAreaView style={styles.safeArea}>
          {canGoBack && (
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
              <Text style={styles.backBtnText}>←</Text>
            </TouchableOpacity>
          )}

          <View style={styles.mascotWrap}>
            <Image source={require('../assets/images/login-mascot.png')} style={styles.mascot} resizeMode="contain" />
          </View>

          <ScrollView contentContainerStyle={styles.formArea} keyboardShouldPersistTaps="handled">
            {/* Email */}
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                placeholder="Email"
                keyboardType="email-address"
                autoCorrect={false}
                placeholderTextColor="rgba(255,255,255,0.55)"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
              />
            </View>

            {/* Password */}
            <View style={styles.inputWrapper}>
              <TextInput
                style={{ flex: 1, fontFamily: 'DMSans_400Regular', color: Colors.white, fontSize: 15 }}
                placeholder="••••••••••"
                placeholderTextColor="rgba(255,255,255,0.55)"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                <SFIcon name={showPassword ? 'eye.slash' : 'eye'} size={18} color="rgba(255,255,255,0.78)" />
              </TouchableOpacity>
            </View>

            {/* Remember me / Forgot */}
            <View style={styles.rememberRow}>
              <TouchableOpacity onPress={() => router.push('/forgot-password')}>
                <Text style={styles.forgotText}>Forgot Password?</Text>
              </TouchableOpacity>
            </View>

            {/* Log in */}
            <TouchableOpacity style={styles.loginBtn} onPress={handleLogin} disabled={loading}>
              {loading
                ? <ActivityIndicator color={Colors.black} />
                : <Text style={styles.loginBtnText}>Log in</Text>
              }
            </TouchableOpacity>

            <SocialLoginButtons disabled={loading} />

            <TouchableOpacity onPress={() => router.replace('/signup')}>
              <Text style={styles.signUpText}>
                Don't have an account? <Text style={styles.signUpLink}>Sign Up</Text>
              </Text>
            </TouchableOpacity>

          </ScrollView>
        </SafeAreaView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  bg: { position: 'absolute', width, height },
  overlay: { position: 'absolute', width, height, backgroundColor: 'rgba(0,0,0,0.1)' },
  safeArea: { flex: 1, paddingHorizontal: 28 },
  backBtn: { marginTop: 8, width: 36, height: 36, justifyContent: 'center' },
  backBtnText: { fontSize: 22, fontFamily: 'DMSans_500Medium', color: Colors.white },
  mascotWrap: { alignItems: 'center', paddingTop: 4, paddingBottom: 10 },
  mascot: { width: 136, height: 166 },
  formArea: { gap: 14, paddingBottom: 40 },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(180,180,180,0.32)',
    borderRadius: 50,
    paddingHorizontal: 22,
    height: 54,
  },
  input: { flex: 1, fontFamily: 'DMSans_400Regular', color: Colors.white, fontSize: 15 },
  eyeBtn: { padding: 4 },
  rememberRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkbox: {
    width: 20, height: 20, borderRadius: 5,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.6)',
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: Colors.yellow, borderColor: Colors.yellow },
  checkmark: { fontFamily: 'DMSans_700Bold', color: Colors.black, fontSize: 12 },
  rememberText: { fontFamily: 'DMSans_400Regular', color: 'rgba(255,255,255,0.85)', fontSize: 14 },
  forgotText: { fontFamily: 'DMSans_400Regular', color: 'rgba(255,255,255,0.85)', fontSize: 14 },
  loginBtn: {
    backgroundColor: 'rgba(255,255,255,0.82)',
    borderRadius: 50,
    paddingVertical: 17,
    alignItems: 'center',
    marginTop: 6,
  },
  loginBtnText: { fontSize: 16, fontFamily: 'DMSans_700Bold', color: Colors.black },
  signUpText: { textAlign: 'center', fontFamily: 'DMSans_400Regular', color: 'rgba(255,255,255,0.85)', fontSize: 14 },
  signUpLink: { fontFamily: 'DMSans_700Bold', color: Colors.white, textDecorationLine: 'underline' },
});
