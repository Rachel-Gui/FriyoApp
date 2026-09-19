import { useState } from 'react';
import { Text } from 'react-native';
import { useRouter } from 'expo-router';
import OnboardingLayout from '@/components/onboarding/OnboardingLayout';
import OnboardingChip from '@/components/onboarding/OnboardingChip';
import { useOnboardingStore } from '@/store/onboardingStore';

const CUISINES = [
  'Chinese','Japanese','Korean','Southeast Asian','Mediterranean',
  'American','Mexican','Indian','Italian','Middle Eastern','Open to anything',
];

export default function Step2() {
  const router = useRouter();
  const setPreferredCuisines = useOnboardingStore(s => s.setPreferredCuisines);
  const [selected, setSelected] = useState<string[]>([]);
  const toggle = (l: string) =>
    setSelected((p) => p.includes(l) ? p.filter((x) => x !== l) : [...p, l]);

  const title = (
    <Text style={{ fontSize: 30, fontFamily: 'DMSans_700Bold', color: '#1A1A1A', lineHeight: 38 }}>
      What{' '}
      <Text style={{ fontFamily: 'LibreBaskerville_400Regular_Italic' }}>Cuisines</Text>
      {' '}do you usually enjoy?
    </Text>
  );

  return (
    <OnboardingLayout
      title={title}
      subtitle="Let us know your taste and cultural dietary preferences"
      onNext={() => { setPreferredCuisines(selected); router.push('/onboarding/step3'); }}
      canProceed={selected.length > 0}
    >
      {CUISINES.map((item) => (
        <OnboardingChip key={item} label={item} selected={selected.includes(item)} onPress={() => toggle(item)} />
      ))}
    </OnboardingLayout>
  );
}
