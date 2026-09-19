import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { del, post } from './api';

const TOKEN_KEY = 'friyo_push_token';
const OPT_IN_KEY = 'friyo_push_opt_in';
let generation = 0;
Notifications.setNotificationHandler({ handleNotification: async () => ({
  shouldPlaySound: true, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true,
}) });

export const notificationService = {
  async register(askPermission = false): Promise<boolean> {
    const current = ++generation;
    if (!Device.isDevice || Platform.OS === 'web' || Constants.appOwnership === 'expo') return false;
    if (!askPermission && await AsyncStorage.getItem(OPT_IN_KEY) !== 'true') return false;
    if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('default', {
      name: 'Friyo reminders', importance: Notifications.AndroidImportance.DEFAULT,
    });
    let permission = await Notifications.getPermissionsAsync();
    if (!permission.granted && askPermission && permission.canAskAgain) permission = await Notifications.requestPermissionsAsync();
    if (!permission.granted) return false;
    const projectId = Constants.easConfig?.projectId || Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) throw new Error('Notification project is not configured');
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    if (generation !== current) return false;
    await post('/notifications/device-token', { token, platform: 'expo' });
    await AsyncStorage.multiSet([[TOKEN_KEY, token], [OPT_IN_KEY, 'true']]);
    return true;
  },
  async unregister() {
    ++generation;
    const token = await AsyncStorage.getItem(TOKEN_KEY);
    if (token) await del(`/notifications/device-token/${encodeURIComponent(token)}`);
    await AsyncStorage.multiRemove([TOKEN_KEY, OPT_IN_KEY]);
    await Notifications.dismissAllNotificationsAsync();
  },
};
