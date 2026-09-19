import { del, get, patch } from './api';

export interface UserProfile {
  diet_type:            string;
  allergies:            string[];
  cooking_skill:        string;
  cooking_tools:        string[];
  household_size:       number;
  health_goals:         string[];
  preferred_cuisines:   string[];
  disliked_ingredients: string[];
  weekly_cooking_days:  number;
  onboarding_completed: boolean;
}

export interface UpdateProfilePayload extends Partial<Omit<UserProfile, 'onboarding_completed'>> {
  onboarding_completed?: boolean;
}

export const userService = {
  getProfile: () => get<UserProfile>('/users/profile'),
  updateProfile: (data: UpdateProfilePayload) => patch<UserProfile>('/users/profile', data),
  updateMe: (data: { name?: string; avatar_url?: string }) => patch('/users/me', data),
  deleteAccount: () => del<void>('/users/me', { confirmation: 'DELETE' }),
};
