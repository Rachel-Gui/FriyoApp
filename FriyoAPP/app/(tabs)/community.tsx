import { Redirect } from 'expo-router';

/**
 * Community is intentionally excluded from Friyo 1.0 while moderation,
 * blocking, and user-safety controls are completed.
 */
export default function CommunityUnavailable() {
  return <Redirect href="/(tabs)" />;
}
