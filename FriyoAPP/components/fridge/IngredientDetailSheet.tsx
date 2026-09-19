import {
  Modal, ScrollView, StyleSheet, Text,
  TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/Colors';
import { SFIcon } from '@/components/ui/SFIcon';
import type { UiItem } from './types';
import { freshnessColor, freshnessText, storageLabel } from './fridgeUtils';

type Props = {
  item: UiItem | null;
  visible: boolean;
  onClose: () => void;
  onEdit: (item: UiItem) => void;
  onDelete: (item: UiItem) => void;
};

export function IngredientDetailSheet({ item, visible, onClose, onEdit, onDelete }: Props) {
  const insets = useSafeAreaInsets();
  if (!item) return null;

  const color = freshnessColor(item.freshnessLabel);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.root, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <Text style={styles.title}>Ingredient Details</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
            <SFIcon name="xmark" size={16} color={Colors.gray} />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          <View style={styles.hero}>
            <View style={styles.emojiWrap}>
              <Text style={styles.emoji}>{item.emoji}</Text>
            </View>
            <Text style={styles.name} numberOfLines={2}>{item.name}</Text>
            <Text style={styles.category}>{item.category}</Text>
          </View>

          <View style={[styles.freshnessBanner, { backgroundColor: `${color}18` }]}>
            <View style={[styles.freshnessIndicator, { backgroundColor: color }]} />
            <Text style={[styles.freshnessText, { color }]}>{freshnessText(item)}</Text>
            {item.daysLeft != null && (
              <View style={[styles.freshnessBadge, { backgroundColor: color }]}>
                <Text style={styles.freshnessBadgeText}>{item.daysLeft}d</Text>
              </View>
            )}
          </View>

          <View style={styles.grid}>
            <InfoCell label="Amount" value={`${item.quantity} ${item.unit || ''}`.trim()} icon="chart.bar" />
            <InfoCell label="Storage" value={storageLabel(item.storageType)} icon="refrigerator" />
            <InfoCell label="Category" value={item.category} icon="list.bullet.rectangle" />
            <InfoCell label="Expiry" value={item.expiryDate ?? 'Not set'} icon="calendar" />
          </View>

          {item.tags.length > 0 && (
            <View style={styles.tagsSection}>
              <Text style={styles.sectionLabel}>Tags</Text>
              <View style={styles.tagsRow}>
                {item.tags.map(tag => (
                  <View key={tag} style={styles.tag}>
                    <Text style={styles.tagText}>{tag}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {item.calories !== undefined && (
            <View style={styles.calorieRow}>
              <SFIcon name="flame" size={16} color={Colors.orange} />
              <Text style={styles.calorieText}>{item.calories} kcal per 100g</Text>
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.deleteBtn} onPress={() => { onClose(); onDelete(item); }}>
            <SFIcon name="trash" size={18} color={Colors.red} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.editBtn} onPress={() => onEdit(item)}>
            <SFIcon name="pencil" size={17} color={Colors.black} />
            <Text style={styles.editBtnText}>Edit</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function InfoCell({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <View style={styles.cell}>
      <SFIcon name={icon as any} size={16} color={Colors.gray} />
      <Text style={styles.cellLabel}>{label}</Text>
      <Text style={styles.cellValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.cream },
  handle: { width: 40, height: 4, backgroundColor: Colors.borderGray, borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 4 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16 },
  title: { fontSize: 20, fontFamily: 'DMSans_700Bold', color: Colors.black },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.lightGray, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: 20, paddingBottom: 24, gap: 20 },
  hero: { alignItems: 'center', gap: 8, paddingTop: 8 },
  emojiWrap: { width: 88, height: 88, borderRadius: 24, backgroundColor: Colors.white, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 6 },
  emoji: { fontSize: 44 },
  name: { fontSize: 24, fontFamily: 'DMSans_700Bold', color: Colors.black, textAlign: 'center' },
  category: { fontSize: 14, fontFamily: 'DMSans_400Regular', color: Colors.gray },
  freshnessBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, padding: 14 },
  freshnessIndicator: { width: 8, height: 8, borderRadius: 4 },
  freshnessText: { flex: 1, fontSize: 14, fontFamily: 'DMSans_700Bold' },
  freshnessBadge: { borderRadius: 50, paddingHorizontal: 10, paddingVertical: 4 },
  freshnessBadgeText: { fontSize: 12, fontFamily: 'DMSans_700Bold', color: Colors.white },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  cell: { width: '47%', backgroundColor: Colors.white, borderRadius: 14, padding: 14, gap: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  cellLabel: { fontSize: 11, fontFamily: 'DMSans_500Medium', color: Colors.gray, textTransform: 'uppercase', letterSpacing: 0.3 },
  cellValue: { fontSize: 15, fontFamily: 'DMSans_700Bold', color: Colors.black },
  tagsSection: { gap: 8 },
  sectionLabel: { fontSize: 12, fontFamily: 'DMSans_700Bold', color: Colors.gray, textTransform: 'uppercase', letterSpacing: 0.4 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { backgroundColor: Colors.yellowMedium, borderRadius: 50, paddingHorizontal: 12, paddingVertical: 6 },
  tagText: { fontSize: 12, fontFamily: 'DMSans_500Medium', color: Colors.black },
  calorieRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  calorieText: { fontSize: 14, fontFamily: 'DMSans_500Medium', color: Colors.gray },
  footer: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingTop: 8 },
  deleteBtn: { width: 52, height: 52, borderRadius: 16, backgroundColor: Colors.redLight, alignItems: 'center', justifyContent: 'center' },
  editBtn: { flex: 1, height: 52, borderRadius: 50, backgroundColor: Colors.yellow, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  editBtnText: { fontSize: 15, fontFamily: 'DMSans_700Bold', color: Colors.black },
});
