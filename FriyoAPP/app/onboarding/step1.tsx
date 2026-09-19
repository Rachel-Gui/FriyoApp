import { useState } from 'react';
import { Text } from 'react-native';
import { useRouter } from 'expo-router';
import OnboardingLayout from '@/components/onboarding/OnboardingLayout';
import OnboardingChip from '@/components/onboarding/OnboardingChip';
import { useOnboardingStore } from '@/store/onboardingStore';

const MEAL_FORMATS = [
  { label: 'Rice-Based Meals',        emoji: '🍚' },
  { label: 'Roasted Meals',           emoji: '🍗' },
  { label: 'Noodles-Based Meals',     emoji: '🍜' },
  { label: 'Soup / Stew meals',       emoji: '🍲' },
  { label: 'Smoothie',                emoji: '🥑' },
  { label: 'Bowl Meals',              emoji: '🥣' },
  { label: 'Salad / Light Meals',     emoji: '🥗' },
  { label: 'One-pan meal',            emoji: '🍳' },
  { label: 'Stir-fry',               emoji: '🔍' },
  { label: 'Dumplings / Wrapped foods', emoji: '🥟' },
  { label: 'Bread-Based Meals',       emoji: '🍞' },
  { label: 'Sandwich',               emoji: '🥪' },
  { label: 'Breakfast-style meals',   emoji: '🍔' },
  { label: 'Cold Plate',             emoji: '🍅' },
  { label: 'Baked / roasted meals',  emoji: '🥩' },
  { label: 'Small bites / snacks',   emoji: '🍿' },
  { label: 'Sweet dessert',          emoji: '🍩' },
];

export default function Step1() {
  const router = useRouter();
  const setMealFormats = useOnboardingStore(s => s.setMealFormats);
  const [selected, setSelected] = useState<string[]>([]);

  const toggle = (label: string) =>
    setSelected((p) => p.includes(label) ? p.filter((x) => x !== label) : [...p, label]);

  const title = (
    <Text style={{ fontSize: 30, fontFamily: 'DMSans_700Bold', color: '#1A1A1A', lineHeight: 38 }}>
      What{' '}
      <Text style={{ fontFamily: 'LibreBaskerville_400Regular_Italic' }}>Meal Format</Text>
      {' '}do{'\n'}you prefer?
    </Text>
  );

  return (
    <OnboardingLayout
      title={title}
      subtitle="Choose what you like"
      onNext={() => { setMealFormats(selected); router.push('/onboarding/step2'); }}
      canProceed={selected.length > 0}
      nextLabel="Choose at least one to start"
    >
      {MEAL_FORMATS.map((item) => (
        <OnboardingChip
          key={item.label}
          label={item.label}
          emoji={item.emoji}
          selected={selected.includes(item.label)}
          onPress={() => toggle(item.label)}
        />
      ))}
    </OnboardingLayout>
  );
}
