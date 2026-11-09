import { useLanguageStore } from '@/store/languageStore';
import { LocalizedText as Text } from '@/components/ui/LocalizedNative';
import { useState } from 'react';

import { useRouter } from 'expo-router';
import OnboardingLayout from '@/components/onboarding/OnboardingLayout';
import OnboardingChip from '@/components/onboarding/OnboardingChip';
import { useOnboardingStore } from '@/store/onboardingStore';

const CUISINES = [
  'Chinese','Japanese','Korean','Southeast Asian','Mediterranean',
  'American','Mexican','Indian','Italian','Middle Eastern','Open to anything',
];

export default function Step2() {
  const language = useLanguageStore(state => state.language);
  const router = useRouter();
  const setPreferredCuisines = useOnboardingStore(s => s.setPreferredCuisines);
  const [selected, setSelected] = useState<string[]>(useOnboardingStore.getState().preferredCuisines);
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
      title={language === 'zh' ? <Text style={{ fontSize: 30, fontFamily: 'DMSans_700Bold', lineHeight: 38 }}>你平时喜欢哪些菜系？</Text> : title}
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
