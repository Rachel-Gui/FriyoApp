import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/Colors';

const TIMES = ['Quick (<30 min)', 'Moderate (30-60 min)', 'Leisurely (60+ min)'];

export default function Step7() {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <SafeAreaView style={s.container}>
      <View style={s.content}>
        <Text style={s.title}>How much time do you usually have in busy day?</Text>
        <Text style={s.subtitle}>We'll match recipe to your schedule</Text>
        <View style={s.options}>
          {TIMES.map((item) => (
            <TouchableOpacity
              key={item}
              style={[s.option, selected === item && s.optionSelected]}
              onPress={() => setSelected(item)}
              activeOpacity={0.7}
            >
              <Text style={[s.optionText, selected === item && s.optionTextSelected]}>{item}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      <View style={s.footer}>
        <TouchableOpacity
          style={[s.btn, !!selected && s.btnActive]}
          onPress={selected ? () => router.push('/onboarding/step8') : undefined}
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
