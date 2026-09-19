# Friyo App

## Setup

```bash
cd /Users/kejiazhu/Desktop/FriyoApp
npm install
npx expo start
```

Press `i` to open in iOS Simulator or scan the QR code with Expo Go on your phone.

## App Flow

```
Splash (index) → Login → Onboarding (steps 1–9) → Loading → Main Tabs
```

### Screens Built

| Screen | File |
|--------|------|
| Splash / Login | `app/index.tsx`, `app/login.tsx` |
| Onboarding 1–9 | `app/onboarding/step1.tsx` … `step9.tsx` |
| Onboarding Loading | `app/onboarding/loading.tsx` |
| Recipe Home | `app/(tabs)/index.tsx` |
| Recipe Detail | `app/(tabs)/recipe/[id].tsx` |
| Cooking Mode | `app/(tabs)/recipe/cooking.tsx` |
| Finish Cooking | `app/(tabs)/recipe/finish.tsx` |
| My Fridge | `app/(tabs)/fridge/index.tsx` |
| AI Fridge Scanner | `app/(tabs)/fridge/scanner.tsx` |
| Community | `app/(tabs)/community.tsx` |
| Meals Plan | `app/(tabs)/meals/index.tsx` |
| AI Chat | `app/(tabs)/ai.tsx` |
