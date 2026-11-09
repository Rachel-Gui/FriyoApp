import { create } from 'zustand';

// Collects selections across all 9 onboarding steps.
// Saved to the backend in one call from onboarding/loading.tsx.

interface OnboardingState {
  mealFormats:       string[];
  flavorPreferences: string[];
  timePreference: string;
  groceryFrequency: string;
  dietaryRestrictions: string[];
  dietType:          string;
  healthGoals:       string[];
  preferredCuisines: string[];
  allergies:         string[];
  cookingSkill:      string;
  householdSize:     number;
  cookingTools:      string[];
  initialCraving:    string;     // step 9 (free text)
}

interface OnboardingActions {
  setFlavorPreferences: (v: string[]) => void;
  setTimePreference: (v: string) => void;
  setGroceryFrequency: (v: string) => void;
  setDietaryRestrictions: (v: string[]) => void;
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
  flavorPreferences: [],
  timePreference: "",
  groceryFrequency: "",
  dietaryRestrictions: [],
  dietType:          'omnivore',
  healthGoals:       [],
  preferredCuisines: [],
  allergies:         [],
  cookingSkill:      'beginner',
  householdSize:     1,
  cookingTools:      [],
  initialCraving:    '',
};

export const useOnboardingStore = create<OnboardingState & OnboardingActions>()(
  (set) => ({
    ...defaults,
    setFlavorPreferences: (v) => set({ flavorPreferences: v }),
    setTimePreference: (v) => set({ timePreference: v }),
    setGroceryFrequency: (v) => set({ groceryFrequency: v }),
    setDietaryRestrictions: (v) => set({ dietaryRestrictions: v }),
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
