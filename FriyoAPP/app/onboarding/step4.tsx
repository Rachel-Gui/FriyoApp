import { useState } from 'react';
import { useOnboardingStore } from '@/store/onboardingStore';
import { useRouter } from 'expo-router';
import OnboardingLayout from '@/components/onboarding/OnboardingLayout';
import OnboardingChip from '@/components/onboarding/OnboardingChip';

const RESTRICTIONS = [
  'No restrictions','Vegetarian','Vegan','Pescatarian','Halal','Kosher',
  'Gluten-free','Dairy-free','Nut-free','Lactose-free','Shellfish-free',
  'Egg-free','Soy-free','Low-carb','Low-sugar','Low-sodium','Other',
];

const DIET_MAP: Record<string, string> = { Vegetarian: 'vegetarian', Vegan: 'vegan', Pescatarian: 'pescatarian', Halal: 'halal', Kosher: 'kosher' };

export default function Step4() {
  const router = useRouter();
  const setAllergies  = useOnboardingStore(s => s.setAllergies);
  const setDietType    = useOnboardingStore(s => s.setDietType);
  const [selected, setSelected] = useState<string[]>([]);
  const toggle = (l: string) =>
    setSelected((p) => p.includes(l) ? p.filter((x) => x !== l) : [...p, l]);

  return (
    <OnboardingLayout
      title="Do you have any dietary restrictions or food allergies?"
      subtitle="Select all that apply"
      onNext={() => { const diet = Object.entries(DIET_MAP).find(([k]) => selected.includes(k)); setDietType(diet ? diet[1] : 'omnivore'); setAllergies(selected.filter(s => !DIET_MAP[s])); router.push('/onboarding/step5'); }}
      canProceed={selected.length > 0}
    >
      {RESTRICTIONS.map((item) => (
        <OnboardingChip
          key={item} label={item}
          selected={selected.includes(item)}
          onPress={() => toggle(item)}
        />
      ))}
    </OnboardingLayout>
  );
}
