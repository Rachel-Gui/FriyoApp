import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/Colors';

interface Props {
  children: React.ReactNode;
  title: React.ReactNode;
  subtitle?: string;
  onNext: () => void;
  nextLabel?: string;
  canProceed?: boolean;
}

export default function OnboardingLayout({
  children,
  title,
  subtitle,
  onNext,
  nextLabel = 'Choose at least one to next',
  canProceed = false,
}: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safeTop} edges={['top']}>
        {/* Back button */}
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
      </SafeAreaView>

      {/* Scrollable content */}
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          {typeof title === 'string' ? (
            <Text style={styles.title}>{title}</Text>
          ) : (
            title
          )}
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>

        <View style={styles.chips}>{children}</View>

        {/* Spacer so last chips aren't hidden behind button */}
        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Floating glass footer */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 18 }]}>
        <BlurView
          intensity={55}
          tint="light"
          style={[
            styles.blurWrap,
            Platform.OS === 'android' && { backgroundColor: 'rgba(245,240,232,0.96)' },
          ]}
        >
          <TouchableOpacity
            style={[styles.btn, canProceed && styles.btnActive]}
            onPress={canProceed ? onNext : undefined}
            activeOpacity={canProceed ? 0.8 : 1}
          >
            <Text style={[styles.btnText, canProceed && styles.btnTextActive]}>
              {nextLabel}
            </Text>
          </TouchableOpacity>
        </BlurView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.cream,
  },
  safeTop: {
    backgroundColor: Colors.cream,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 16,
    marginTop: 4,
  },
  backIcon: {
    fontSize: 24,
    color: Colors.black,
    fontFamily: 'DMSans_400Regular',
  },
  scroll: {
    paddingHorizontal: 24,
    paddingTop: 8,
    flexGrow: 1,
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 30,
    fontFamily: 'DMSans_700Bold',
    color: Colors.black,
    lineHeight: 38,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    color: Colors.gray,
    lineHeight: 20,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  // Floating footer
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  blurWrap: {
    borderRadius: 50,
    overflow: 'hidden',
  },
  btn: {
    borderRadius: 50,
    paddingVertical: 18,
    alignItems: 'center',
    backgroundColor: 'rgba(200,200,200,0.35)',
  },
  btnActive: {
    backgroundColor: Colors.yellow,
  },
  btnText: {
    fontSize: 16,
    fontFamily: 'DMSans_500Medium',
    color: Colors.gray,
  },
  btnTextActive: {
    fontFamily: 'DMSans_700Bold',
    color: Colors.black,
  },
});
