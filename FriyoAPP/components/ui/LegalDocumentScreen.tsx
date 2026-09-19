import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/Colors';

export interface LegalSection {
  title: string;
  body: string;
}

export function LegalDocumentScreen({
  title,
  updated,
  intro,
  sections,
}: {
  title: string;
  updated: string;
  intro: string;
  sections: LegalSection[];
}) {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.backButton} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.updated}>Last updated: {updated}</Text>
        <Text style={styles.intro}>{intro}</Text>
        {sections.map(section => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.body}>{section.body}</Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.cream },
  header: {
    minHeight: 56,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 34, lineHeight: 38, color: Colors.black },
  title: {
    flex: 1,
    textAlign: 'center',
    fontFamily: 'LibreBaskerville_700Bold',
    fontSize: 19,
    color: Colors.black,
  },
  content: { paddingHorizontal: 22, paddingTop: 8, paddingBottom: 48 },
  updated: { fontFamily: 'DMSans_400Regular', color: Colors.gray, fontSize: 12 },
  intro: {
    fontFamily: 'DMSans_400Regular',
    color: Colors.black,
    fontSize: 15,
    lineHeight: 23,
    marginTop: 14,
  },
  section: { marginTop: 24 },
  sectionTitle: {
    fontFamily: 'DMSans_700Bold',
    color: Colors.black,
    fontSize: 17,
    marginBottom: 7,
  },
  body: {
    fontFamily: 'DMSans_400Regular',
    color: '#4B4B4B',
    fontSize: 14,
    lineHeight: 22,
  },
});
