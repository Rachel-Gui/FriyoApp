import { useState } from 'react';
import { useOnboardingStore } from '@/store/onboardingStore';
import { useRouter } from 'expo-router';
import OnboardingLayout from '@/components/onboarding/OnboardingLayout';
import OnboardingChip from '@/components/onboarding/OnboardingChip';

const FLAVORS = ['Spicy', 'Mild', 'Savory', 'Sweet', 'Balanced'];

export default function Step3() {
  const router = useRouter();
  const setFlavorPreferences = useOnboardingStore(s => s.setFlavorPreferences);
  const [selected, setSelected] = useState<string[]>(useOnboardingStore.getState().flavorPreferences);
  const toggle = (l: string) =>
    setSelected((p) => p.includes(l) ? p.filter((x) => x !== l) : [...p, l]);

  return (
    <OnboardingLayout
      title="What's your flavor vibe?"
      subtitle="Your go-to taste profile"
      onNext={() => { setFlavorPreferences(selected); router.push('/onboarding/step4'); }}
      canProceed={selected.length > 0}
    >
      {FLAVORS.map((item) => (
        <OnboardingChip
          key={item} label={item}
          selected={selected.includes(item)}
          onPress={() => toggle(item)}
        />
      ))}
    </OnboardingLayout>
  );
}
