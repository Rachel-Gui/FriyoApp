import { create } from 'zustand';

// Collects selections across all 9 onboarding steps.
// Saved to the backend in one call from onboarding/loading.tsx.

interface OnboardingState {
  mealFormats:       string[];   // step 1
  dietType:          string;     // step 2
  healthGoals:       string[];   // step 3
  preferredCuisines: string[];   // step 4
  allergies:         string[];   // step 5
  cookingSkill:      string;     // step 6
  householdSize:     number;     // step 7
  cookingTools:      string[];   // step 8
  initialCraving:    string;     // step 9 (free text)
}

interface OnboardingActions {
  setMealFormats:       (v: string[]) => void;
  setDietType:          (v: string)   => void;
  setHealthGoals:       (v: string[]) => void;
  setPreferredCuisines: (v: string[]) => void;
  setAllergies:         (v: string[]) => void;
  setCookingSkill:      (v: string)   => void;
  setHouseholdSize:     (v: number)   => void;
  setCookingTools:      (v: string[]) => void;
  setInitialCraving:    (v: string)   => void;
  reset:                ()            => void;
}

const defaults: OnboardingState = {
  mealFormats:       [],
  dietType:          'omnivore',
  healthGoals:       [],
  preferredCuisines: [],
  allergies:         [],
  cookingSkill:      'beginner',
  householdSize:     2,
  cookingTools:      [],
  initialCraving:    '',
};

export const useOnboardingStore = create<OnboardingState & OnboardingActions>()(
  (set) => ({
    ...defaults,
    setMealFormats:       (v) => set({ mealFormats: v }),
    setDietType:          (v) => set({ dietType: v }),
    setHealthGoals:       (v) => set({ healthGoals: v }),
    setPreferredCuisines: (v) => set({ preferredCuisines: v }),
    setAllergies:         (v) => set({ allergies: v }),
    setCookingSkill:      (v) => set({ cookingSkill: v }),
    setHouseholdSize:     (v) => set({ householdSize: v }),
    setCookingTools:      (v) => set({ cookingTools: v }),
    setInitialCraving:    (v) => set({ initialCraving: v }),
    reset:                ()  => set(defaults),
  }),
);
