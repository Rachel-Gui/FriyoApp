import { useState } from 'react';
import { useOnboardingStore } from '@/store/onboardingStore';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/Colors';

const LEVELS = [
  "I'm new to cooking",
  'I can make simple meals',
  'I cook regularly and can follow recipes',
  'I love experimenting with cooking.',
];

const SKILL_MAP: Record<string,string> = { "I'm new to cooking": 'beginner', 'I can make simple meals': 'beginner', 'I cook regularly and can follow recipes': 'intermediate', 'I love experimenting with cooking.': 'advanced' };

export default function Step6() {
  const router = useRouter();
  const setCookingSkill = useOnboardingStore(s => s.setCookingSkill);
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <SafeAreaView style={s.container}>
      <View style={s.content}>
        <Text style={s.title}>What is your current cooking skill level?</Text>
        <Text style={s.subtitle}>This helps us adjust recipe complexity</Text>
        <View style={s.options}>
          {LEVELS.map((level) => (
            <TouchableOpacity
              key={level}
              style={[s.option, selected === level && s.optionSelected]}
              onPress={() => setSelected(level)}
              activeOpacity={0.7}
            >
              <Text style={[s.optionText, selected === level && s.optionTextSelected]}>{level}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      <View style={s.footer}>
        <TouchableOpacity
          style={[s.btn, !!selected && s.btnActive]}
          onPress={selected ? () => { setCookingSkill(SKILL_MAP[selected] ?? 'beginner'); router.push('/onboarding/step7'); } : undefined}
        >
          <Text style={[s.btnText, !!selected && s.btnTextActive]}>Choose at least one to next</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.cream, paddingHorizontal: 24 },
  content: { flex: 1, paddingTop: 24 },
  title: { fontSize: 30, fontFamily: 'DMSans_700Bold', color: Colors.black, lineHeight: 38, marginBottom: 8 },
  subtitle: { fontSize: 14, fontFamily: 'DMSans_400Regular', color: Colors.gray, marginBottom: 32 },
  options: { gap: 12 },
  option: {
    backgroundColor: Colors.white, borderRadius: 16,
    paddingVertical: 20, paddingHorizontal: 20,
    borderWidth: 1.5, borderColor: Colors.borderGray,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1,
  },
  optionSelected: { borderColor: Colors.yellow, backgroundColor: Colors.yellowMedium },
  optionText: { fontSize: 15, fontFamily: 'DMSans_400Regular', color: Colors.black, textAlign: 'center' },
  optionTextSelected: { fontFamily: 'DMSans_700Bold' },
  footer: { paddingBottom: 32, paddingTop: 12 },
  btn: { backgroundColor: Colors.lightGray, borderRadius: 50, paddingVertical: 18, alignItems: 'center' },
  btnActive: { backgroundColor: Colors.yellow },
  btnText: { fontSize: 16, fontFamily: 'DMSans_500Medium', color: Colors.gray },
  btnTextActive: { fontFamily: 'DMSans_700Bold', color: Colors.black },
});
