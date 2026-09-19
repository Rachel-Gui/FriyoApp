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

export default function SignUpScreen() {
  const router   = useRouter();
  const register = useAuthStore(s => s.register);
  const [name,         setName]         = useState('');
  const [email,        setEmail]        = useState('');
  const [password,     setPassword]     = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading,      setLoading]      = useState(false);

  const handleSignUp = async () => {
    if (!name.trim() || !email.trim() || !password) {
      Alert.alert('Missing fields', 'Please fill in all fields.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || password.length < 8 || password.length > 72) {
      Alert.alert('Check your details', 'Enter a valid email and a password with 8–72 characters.');
      return;
    }
    setLoading(true);
    try {
      await register(email.trim(), password, name.trim());
      router.replace('/onboarding/step1');
    } catch (err: any) {
      if (err?.status === 409) {
        Alert.alert('Already registered', 'An account with this email already exists. Please log in.');
      } else if (err?.status === 400) {
        Alert.alert('Sign up failed', err?.message ?? 'Please check your account details and try again.');
      } else {
        Alert.alert('Connection error', 'Could not reach the server. Please check your internet connection and try again.');
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
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>←</Text>
          </TouchableOpacity>

          <View style={styles.mascotWrap}>
            <Image source={require('../assets/images/login-mascot.png')} style={styles.mascot} resizeMode="contain" />
            <Text style={styles.welcomeText}>Create your account</Text>
          </View>

          <ScrollView contentContainerStyle={styles.formArea} keyboardShouldPersistTaps="handled">
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                placeholder="Full name"
                placeholderTextColor="rgba(255,255,255,0.55)"
                value={name}
                onChangeText={setName}
              />
            </View>

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

            <View style={styles.inputWrapper}>
              <TextInput
                style={{ flex: 1, fontFamily: 'DMSans_400Regular', color: Colors.white, fontSize: 15 }}
                placeholder="Password"
                placeholderTextColor="rgba(255,255,255,0.55)"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <SFIcon name={showPassword ? 'eye.slash' : 'eye'} size={18} color="rgba(255,255,255,0.78)" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.signUpBtn, loading && { opacity: 0.7 }]}
              onPress={handleSignUp}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color={Colors.black} />
                : <Text style={styles.signUpBtnText}>Create Account</Text>
              }
            </TouchableOpacity>

            <SocialLoginButtons disabled={loading} />
            <Text style={{ color: 'white', textAlign: 'center', lineHeight: 22 }}>
              By creating an account, you agree to our{' '}
              <Text style={{ textDecorationLine: 'underline' }} onPress={() => router.push('/terms')}>Terms</Text> and{' '}
              <Text style={{ textDecorationLine: 'underline' }} onPress={() => router.push('/privacy')}>Privacy Policy</Text>.
            </Text>
            <TouchableOpacity onPress={() => router.replace('/login')}>
              <Text style={styles.loginText}>
                Already have an account? <Text style={styles.loginLink}>Log in</Text>
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
  mascotWrap: { alignItems: 'center', paddingTop: 0, paddingBottom: 10 },
  mascot: { width: 104, height: 126, marginBottom: 4 },
  welcomeText: {
    fontFamily: 'LibreBaskerville_700Bold',
    color: Colors.white,
    fontSize: 22,
  },
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
  signUpBtn: {
    backgroundColor: Colors.yellow,
    borderRadius: 50,
    paddingVertical: 17,
    alignItems: 'center',
    marginTop: 6,
  },
  signUpBtnText: { fontSize: 16, fontFamily: 'DMSans_700Bold', color: Colors.black },
  loginText: { textAlign: 'center', fontFamily: 'DMSans_400Regular', color: 'rgba(255,255,255,0.85)', fontSize: 14 },
  loginLink: { fontFamily: 'DMSans_700Bold', color: Colors.white, textDecorationLine: 'underline' },
});
