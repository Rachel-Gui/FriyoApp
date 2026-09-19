import { useState } from 'react';
import { useOnboardingStore } from '@/store/onboardingStore';
import { Text } from 'react-native';
import { useRouter } from 'expo-router';
import OnboardingLayout from '@/components/onboarding/OnboardingLayout';
import OnboardingChip from '@/components/onboarding/OnboardingChip';

const EQUIPMENT = [
  'Stove','Oven','Microwave','Air Fryer','Rice cooker',
  'Blender','Toaster','Instant Pot','Basic pan and pot only',
  'I rarely cook with equipment',
];

export default function Step5() {
  const setCookingTools = useOnboardingStore(s => s.setCookingTools);
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const toggle = (l: string) =>
    setSelected((p) => p.includes(l) ? p.filter((x) => x !== l) : [...p, l]);

  const title = (
    <Text style={{ fontSize: 30, fontFamily: 'DMSans_700Bold', color: '#1A1A1A', lineHeight: 38 }}>
      What{' '}
      <Text style={{ fontFamily: 'LibreBaskerville_400Regular_Italic' }}>Kitchen{'\n'}Equipment</Text>
      {' '}do you have?
    </Text>
  );

  return (
    <OnboardingLayout
      title={title}
      subtitle="Choose what you have in kitchen"
      onNext={() => { setCookingTools(selected); router.push('/onboarding/step6'); }}
      canProceed={selected.length > 0}
    >
      {EQUIPMENT.map((item) => (
        <OnboardingChip key={item} label={item} selected={selected.includes(item)} onPress={() => toggle(item)} />
      ))}
    </OnboardingLayout>
  );
}
