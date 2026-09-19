import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/Colors';
import { useOnboardingStore } from '@/store/onboardingStore';

export default function Step9() {
  const router = useRouter();
  const setInitialCraving = useOnboardingStore(s => s.setInitialCraving);
  const [text, setText] = useState('');

  return (
    <SafeAreaView style={s.container}>
      {/* Back button */}
      <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
        <Text style={s.backIcon}>←</Text>
      </TouchableOpacity>

      <View style={s.content}>
        <Text style={s.title}>What do you wanna eat now?</Text>
        <Text style={s.subtitle}>
          Tell Friyo what you're craving, what you have, or how much effort you want to spend.
        </Text>

        <View style={s.textAreaWrap}>
          <TextInput
            style={s.textArea}
            placeholder="Craving, ingredients, mood, or time limit…"
            placeholderTextColor={Colors.gray}
            multiline
            value={text}
            onChangeText={setText}
            textAlignVertical="top"
          />
        </View>
      </View>

      <View style={s.footer}>
        <TouchableOpacity style={s.btn} onPress={() => { setInitialCraving(text); router.push('/onboarding/loading'); }}>
          <Text style={s.btnText}>Next</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.cream },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginLeft: 16, marginTop: 4 },
  backIcon: { fontSize: 24, color: Colors.black, fontFamily: 'DMSans_400Regular' },
  content: { flex: 1, paddingHorizontal: 24, paddingTop: 48 },
  title: { fontSize: 30, fontFamily: 'DMSans_700Bold', color: Colors.black, lineHeight: 38, marginBottom: 12 },
  subtitle: { fontSize: 14, fontFamily: 'DMSans_400Regular', color: Colors.gray, lineHeight: 20, marginBottom: 24 },
  textAreaWrap: {
    backgroundColor: Colors.white, borderRadius: 16, padding: 16, minHeight: 180,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  textArea: { fontSize: 15, fontFamily: 'DMSans_400Regular', color: Colors.black, lineHeight: 22, minHeight: 148 },
  footer: { paddingHorizontal: 24, paddingBottom: 32, paddingTop: 12 },
  btn: { backgroundColor: Colors.lightGray, borderRadius: 50, paddingVertical: 18, alignItems: 'center' },
  btnText: { fontSize: 16, fontFamily: 'DMSans_700Bold', color: Colors.black },
});
