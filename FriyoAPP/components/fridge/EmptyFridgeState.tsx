import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '@/constants/Colors';
import { SFIcon } from '@/components/ui/SFIcon';

type Props = {
  query: string;
  onScan: () => void;
};

export function EmptyFridgeState({ query, onScan }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.icon}>{query ? '🔍' : '🧊'}</Text>
      <Text style={styles.title}>{query ? 'No matches' : 'Fridge is empty'}</Text>
      <Text style={styles.sub}>
        {query ? `Nothing matched "${query}". Try a different search.` : 'Scan ingredients to get started.'}
      </Text>
      {!query && (
        <TouchableOpacity style={styles.scanCta} onPress={onScan}>
          <SFIcon name="camera" size={16} color={Colors.white} weight="fill" />
          <Text style={styles.scanCtaText}>Scan Fridge</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 12 },
  icon: { fontSize: 48 },
  title: { fontSize: 18, fontFamily: 'DMSans_700Bold', color: Colors.black },
  sub: { fontSize: 14, fontFamily: 'DMSans_400Regular', color: Colors.gray, textAlign: 'center', maxWidth: 260, lineHeight: 20 },
  scanCta: { marginTop: 8, height: 46, paddingHorizontal: 22, borderRadius: 50, backgroundColor: Colors.black, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  scanCtaText: { fontSize: 14, fontFamily: 'DMSans_700Bold', color: Colors.white },
});
