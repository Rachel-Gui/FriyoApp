import { useEffect } from 'react';
import { AppState } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { notificationService } from '@/services/notificationService';

export function PushLifecycle() {
  const router = useRouter();
  const userId = useAuthStore(s => s.user?.id);
  const ready = useAuthStore(s => s.isLoggedIn && s.onboardingComplete);
  useEffect(() => {
    if (!userId || !ready) return;
    const register = () => { void notificationService.register().catch(() => {}); };
    register();
    const app = AppState.addEventListener('change', state => { if (state === 'active') register(); });
    const token = Notifications.addPushTokenListener(register);
    const handle = (response: Notifications.NotificationResponse | null) => {
      if (!response) return;
      const data = response.notification.request.content.data;
      if (typeof data.recipeId === 'string' && /^[0-9a-f-]{36}$/i.test(data.recipeId)) {
        router.push(`/(tabs)/recipe/${data.recipeId}` as any);
      } else router.push('/(tabs)/fridge' as any);
      void Notifications.clearLastNotificationResponseAsync();
    };
    void Notifications.getLastNotificationResponseAsync().then(handle);
    const response = Notifications.addNotificationResponseReceivedListener(handle);
    return () => { app.remove(); token.remove(); response.remove(); };
  }, [userId, ready]);
  return null;
}
