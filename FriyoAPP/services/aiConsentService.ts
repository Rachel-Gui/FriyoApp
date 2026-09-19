import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AI_CONSENT_KEY = 'friyo_ai_data_consent_v1';

export const aiConsentService = {
  async hasConsent(): Promise<boolean> {
    return (await AsyncStorage.getItem(AI_CONSENT_KEY)) === 'granted';
  },

  async requestConsent(): Promise<boolean> {
    if (await this.hasConsent()) return true;

    return new Promise(resolve => {
      Alert.alert(
        'AI data processing',
        'To provide AI chat and fridge scanning, Friyo sends the text, image, fridge items, and dietary preferences needed for your request to Google Gemini or OpenAI. Do not submit sensitive personal information. You can review the Privacy Policy in Settings.',
        [
          { text: 'Not now', style: 'cancel', onPress: () => resolve(false) },
          {
            text: 'Agree and continue',
            onPress: async () => {
              try { await AsyncStorage.setItem(AI_CONSENT_KEY, 'granted'); resolve(true); }
              catch { resolve(false); }
            },
          },
        ],
        { cancelable: true, onDismiss: () => resolve(false) },
      );
    });
  },

  async withdrawConsent(): Promise<void> {
    await AsyncStorage.removeItem(AI_CONSENT_KEY);
  },
};
