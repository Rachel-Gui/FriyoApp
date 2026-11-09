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
  const setRestrictions = useOnboardingStore(s => s.setDietaryRestrictions);
  const setHealthGoals = useOnboardingStore(s => s.setHealthGoals);
  const setAllergies  = useOnboardingStore(s => s.setAllergies);
  const setDietType    = useOnboardingStore(s => s.setDietType);
  const [selected, setSelected] = useState<string[]>(useOnboardingStore.getState().dietaryRestrictions);
  const toggle = (l: string) =>
    setSelected((p) => l === 'No restrictions' ? ['No restrictions'] : p.includes(l) ? p.filter(x => x !== l) : [...p.filter(x => x !== 'No restrictions'), l]);

  return (
    <OnboardingLayout
      title="Do you have any dietary restrictions or food allergies?"
      subtitle="Select all that apply"
      onNext={() => { const diet = Object.entries(DIET_MAP).find(([k]) => selected.includes(k)); setDietType(diet ? diet[1] : 'omnivore'); setRestrictions(selected); setAllergies(selected.filter(s => ['Gluten-free', 'Dairy-free', 'Nut-free', 'Lactose-free', 'Shellfish-free', 'Egg-free', 'Soy-free'].includes(s))); setHealthGoals(selected.filter(s => ['Low-carb', 'Low-sugar', 'Low-sodium'].includes(s)).map(s => s.toLowerCase().replace('-', '_'))); router.push('/onboarding/step5'); }}
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
