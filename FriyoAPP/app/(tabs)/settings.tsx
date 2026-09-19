import { notificationService } from '@/services/notificationService';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { useAuthStore } from '@/store/authStore';
import { aiConsentService } from '@/services/aiConsentService';

export default function SettingsScreen() {
  const router = useRouter();
  const user = useAuthStore(state => state.user);
  const logout = useAuthStore(state => state.logout);
  const deleteAccount = useAuthStore(state => state.deleteAccount);

  const [showDelete, setShowDelete] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState<'logout' | 'delete' | null>(null);

  const handleLogout = async () => {
    setBusy('logout');
    try {
      await logout();
      router.replace('/login');
    } catch (error: any) {
      Alert.alert('Could not log out', error?.message || 'Please try again.');
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = () => {
    if (confirmation !== 'DELETE') {
      Alert.alert('Confirmation required', 'Type DELETE exactly to continue.');
      return;
    }

    Alert.alert(
      'Permanently delete account?',
      'Your profile, fridge inventory, meal history, scans, posts, and comments will be deleted. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete forever',
          style: 'destructive',
          onPress: async () => {
            setBusy('delete');
            try {
              await deleteAccount();
              router.replace('/login');
            } catch (error: any) {
              Alert.alert(
                'Could not delete account',
                error?.message ?? 'Please try again. Your account has not been deleted.',
              );
            } finally {
              setBusy(null);
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={styles.backButton}
          >
            <Text style={styles.backText}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Settings</Text>
          <View style={styles.backButton} />
        </View>

        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user?.name?.trim()?.[0]?.toUpperCase() ?? 'F'}</Text>
          </View>
          <View style={styles.profileText}>
            <Text style={styles.name}>{user?.name ?? 'Friyo user'}</Text>
            <Text style={styles.email}>{user?.email ?? ''}</Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>ACCOUNT</Text>
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.row}
            onPress={handleLogout}
            disabled={busy !== null}
          >
            <Text style={styles.rowText}>Log Out</Text>
            {busy === 'logout' ? <ActivityIndicator color={Colors.gray} /> : <Text style={styles.chevron}>›</Text>}
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionLabel}>NOTIFICATIONS</Text>
        <View style={styles.card}>
          <TouchableOpacity style={styles.row} onPress={async () => {
            try {
              const enabled = await notificationService.register(true);
              Alert.alert(enabled ? 'Notifications enabled' : 'Notifications unavailable', enabled ? 'You can receive food expiry reminders.' : 'Allow notifications in device Settings and use Friyo on a physical device.',
                enabled ? [{ text: 'OK' }] : [{ text: 'Cancel' }, { text: 'Open Settings', onPress: () => Linking.openSettings() }]);
            } catch { Alert.alert('Could not enable notifications', 'Please try again.'); }
          }}><Text style={styles.rowText}>Enable reminders</Text></TouchableOpacity>
          <TouchableOpacity style={styles.row} onPress={async () => {
            try { await notificationService.unregister(); Alert.alert('Reminders disabled'); }
            catch { Alert.alert('Could not disable reminders', 'Please check your connection and try again.'); }
          }}><Text style={styles.rowText}>Disable reminders</Text></TouchableOpacity>
        </View>

        <Text style={styles.sectionLabel}>PRIVACY & SUPPORT</Text>
        <View style={styles.card}>
          <TouchableOpacity style={styles.row} onPress={() => router.push('/(tabs)/privacy' as any)}>
            <Text style={styles.rowText}>Privacy Policy</Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.row} onPress={() => router.push('/(tabs)/terms' as any)}>
            <Text style={styles.rowText}>Terms of Service</Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity
            style={styles.row}
            onPress={() => {
              Alert.alert(
                'Withdraw AI consent?',
                'AI chat and fridge image recognition will ask for permission again the next time you use them.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Withdraw',
                    style: 'destructive',
                    onPress: () => aiConsentService.withdrawConsent(),
                  },
                ],
              );
            }}
          >
            <Text style={styles.rowText}>AI Data Consent</Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        </View>

        {process.env.EXPO_PUBLIC_SUPPORT_EMAIL && <View style={styles.card}>
          <TouchableOpacity style={styles.row} onPress={() => {
            Linking.openURL(`mailto:${process.env.EXPO_PUBLIC_SUPPORT_EMAIL}`).catch(() => Alert.alert('Contact support', process.env.EXPO_PUBLIC_SUPPORT_EMAIL));
          }}><Text style={styles.rowText}>Contact support</Text></TouchableOpacity>
        </View>}

        <Text style={styles.sectionLabel}>DANGER ZONE</Text>
        <View style={styles.card}>
          {!showDelete ? (
            <TouchableOpacity style={styles.row} onPress={() => setShowDelete(true)}>
              <Text style={styles.deleteText}>Delete Account</Text>
              <Text style={[styles.chevron, styles.deleteText]}>›</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.deletePanel}>
              <Text style={styles.warningTitle}>This permanently removes your account.</Text>
              <Text style={styles.warningBody}>
                Type DELETE to confirm. Your Friyo data cannot be recovered afterward.
              </Text>
              <TextInput
                value={confirmation}
                onChangeText={setConfirmation}
                autoCapitalize="characters"
                autoCorrect={false}
                placeholder="Type DELETE"
                placeholderTextColor={Colors.gray}
                style={styles.input}
              />
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => {
                    setShowDelete(false);
                    setConfirmation('');
                  }}
                  disabled={busy !== null}
                >
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.deleteButton, confirmation !== 'DELETE' && styles.disabled]}
                  onPress={handleDelete}
                  disabled={busy !== null || confirmation !== 'DELETE'}
                >
                  {busy === 'delete'
                    ? <ActivityIndicator color={Colors.white} />
                    : <Text style={styles.deleteButtonText}>Delete forever</Text>}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.cream },
  content: { paddingHorizontal: 20, paddingBottom: 48 },
  header: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 34, lineHeight: 38, color: Colors.black },
  title: { fontFamily: 'LibreBaskerville_700Bold', fontSize: 22, color: Colors.black },
  profileCard: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 28,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.yellow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: 'DMSans_700Bold', fontSize: 19, color: Colors.black },
  profileText: { marginLeft: 14, flex: 1 },
  name: { fontFamily: 'DMSans_700Bold', fontSize: 17, color: Colors.black },
  email: { fontFamily: 'DMSans_400Regular', fontSize: 13, color: Colors.gray, marginTop: 3 },
  sectionLabel: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 11,
    color: Colors.gray,
    letterSpacing: 1,
    marginLeft: 4,
    marginBottom: 8,
    marginTop: 6,
  },
  card: { backgroundColor: Colors.white, borderRadius: 18, overflow: 'hidden', marginBottom: 24 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.borderGray, marginLeft: 18 },
  row: {
    minHeight: 58,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowText: { fontFamily: 'DMSans_500Medium', fontSize: 16, color: Colors.black },
  chevron: { fontSize: 24, color: Colors.gray },
  deleteText: { fontFamily: 'DMSans_500Medium', fontSize: 16, color: Colors.red },
  deletePanel: { padding: 18 },
  warningTitle: { fontFamily: 'DMSans_700Bold', fontSize: 16, color: Colors.red },
  warningBody: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    lineHeight: 19,
    color: Colors.gray,
    marginTop: 6,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: Colors.borderGray,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontFamily: 'DMSans_500Medium',
    fontSize: 15,
    color: Colors.black,
    marginTop: 16,
  },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  cancelButton: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    backgroundColor: Colors.lightGray,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: { fontFamily: 'DMSans_700Bold', color: Colors.black },
  deleteButton: {
    flex: 1.4,
    height: 46,
    borderRadius: 12,
    backgroundColor: Colors.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.45 },
  deleteButtonText: { fontFamily: 'DMSans_700Bold', color: Colors.white },
});
