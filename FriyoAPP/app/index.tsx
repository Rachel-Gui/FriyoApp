import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/Colors';

const { width, height } = Dimensions.get('window');

export default function SplashScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Image
        source={require('../assets/images/fridge-bg.jpg')}
        style={styles.bg}
        resizeMode="cover"
      />
      {/* Slight dark overlay for readability */}
      <View style={styles.overlay} />

      <SafeAreaView style={styles.safeArea}>
        <Text style={styles.supportedBy}>Supported by Friyo AI</Text>

        <View style={styles.centerContent}>
          <Image
            source={require('../assets/images/login-mascot.png')}
            style={styles.mascot}
            resizeMode="contain"
          />
          <Text style={styles.title}>Friyo</Text>
          <Text style={styles.subtitle}>
            Helps you figure out what to eat, your way
          </Text>
        </View>

        <View style={styles.bottomContent}>
          <TouchableOpacity
            style={styles.loginBtn}
            onPress={() => router.push('/login')}
          >
            <Text style={styles.loginBtnText}>Log in</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.push('/signup')}>
            <Text style={styles.signUpText}>
              Don't have an account?{' '}
              <Text style={styles.signUpLink}>Sign Up</Text>
            </Text>
          </TouchableOpacity>

        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  bg: { position: 'absolute', width, height },
  overlay: {
    position: 'absolute',
    width,
    height,
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  safeArea: { flex: 1, paddingHorizontal: 28 },
  supportedBy: {
    textAlign: 'center',
    color: '#555',
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    marginTop: 10,
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mascot: { width: 132, height: 160, marginBottom: 14 },
  title: {
    fontSize: 52,
    fontFamily: 'LibreBaskerville_700Bold',
    color: Colors.black,
    letterSpacing: -1,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: 'DMSans_400Regular',
    color: '#444',
    textAlign: 'center',
    lineHeight: 22,
  },
  bottomContent: { paddingBottom: 36, gap: 16 },
  loginBtn: {
    backgroundColor: 'rgba(255,255,255,0.82)',
    borderRadius: 50,
    paddingVertical: 17,
    alignItems: 'center',
  },
  loginBtnText: { fontSize: 16, fontFamily: 'DMSans_700Bold', color: Colors.black },
  signUpText: { textAlign: 'center', color: '#444', fontSize: 14, fontFamily: 'DMSans_400Regular' },
  signUpLink: { fontFamily: 'DMSans_700Bold', color: Colors.black, textDecorationLine: 'underline' },
});
