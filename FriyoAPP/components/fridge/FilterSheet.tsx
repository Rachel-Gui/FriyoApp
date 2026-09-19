import { useEffect, useState } from 'react';
import {
  Modal, ScrollView, StyleSheet, Text,
  TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/Colors';
import { SFIcon } from '@/components/ui/SFIcon';
import {
  CATEGORY_OPTIONS, DEFAULT_FILTERS,
  type FreshnessFilter, type FridgeFilters, type SortBy, type StorageFilter,
} from './types';
import { activeFilterCount } from './fridgeUtils';

type Props = {
  visible: boolean;
  filters: FridgeFilters;
  onApply: (filters: FridgeFilters) => void;
  onClose: () => void;
};

export function FilterSheet({ visible, filters, onApply, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [local, setLocal] = useState<FridgeFilters>(filters);

  useEffect(() => {
    if (visible) setLocal(filters);
  }, [filters, visible]);

  const patch = <K extends keyof FridgeFilters>(key: K, value: FridgeFilters[K]) =>
    setLocal(current => ({ ...current, [key]: value }));

  const count = activeFilterCount(local);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.root, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Filter & Sort</Text>
            {count > 0 && <Text style={styles.subtitle}>{count} filter{count > 1 ? 's' : ''} active</Text>}
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
            <SFIcon name="xmark" size={16} color={Colors.gray} />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          <Section title="Storage Location">
            <View style={styles.pillRow}>
              {[
                { value: 'all', label: 'All', emoji: '🗂️' },
                { value: 'fridge', label: 'Fridge', emoji: '🌿' },
                { value: 'freezer', label: 'Freezer', emoji: '❄️' },
                { value: 'pantry', label: 'Pantry', emoji: '🗄️' },
              ].map(option => {
                const active = local.storageType === option.value;
                return (
                  <TouchableOpacity
                    key={option.value}
                    style={[styles.pill, active && styles.pillActive]}
                    onPress={() => patch('storageType', option.value as StorageFilter)}
                  >
                    <Text style={styles.pillEmoji}>{option.emoji}</Text>
                    <Text style={[styles.pillText, active && styles.pillTextActive]}>{option.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Section>

          <Section title="Ingredient Category">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {['All', ...CATEGORY_OPTIONS].map(category => {
                const active = category === 'All' ? local.category === null : local.category === category;
                return (
                  <TouchableOpacity
                    key={category}
                    style={[styles.categoryChip, active && styles.categoryChipActive]}
                    onPress={() => patch('category', category === 'All' ? null : category)}
                  >
                    <Text style={[styles.categoryChipText, active && styles.categoryChipTextActive]}>{category}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Section>

          <Section title="Freshness Status">
            <View style={styles.optionCol}>
              {[
                { value: 'all', label: 'All', color: Colors.gray },
                { value: 'expiring_today', label: 'Expiring Today', color: Colors.red },
                { value: 'expiring_soon', label: 'Expiring Soon', color: Colors.orange },
                { value: 'fresh', label: 'Fresh', color: '#F59E0B' },
                { value: 'long_shelf', label: 'Long Shelf Life', color: Colors.green },
              ].map(option => {
                const active = local.freshness === option.value;
                return (
                  <TouchableOpacity
                    key={option.value}
                    style={[styles.optionRow, active && styles.optionRowActive]}
                    onPress={() => patch('freshness', option.value as FreshnessFilter)}
                  >
                    <View style={[styles.dot, { backgroundColor: option.color }]} />
                    <Text style={[styles.optionLabel, active && styles.optionLabelActive]}>{option.label}</Text>
                    {active && <SFIcon name="checkmark" size={14} color={Colors.black} style={{ marginLeft: 'auto' } as any} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </Section>

          <Section title="Sort By">
            <View style={styles.optionCol}>
              {[
                { value: 'expiry', label: 'Expiry Date', icon: 'clock.arrow.circlepath' },
                { value: 'name', label: 'Name A-Z', icon: 'list.bullet.rectangle' },
                { value: 'category', label: 'Category', icon: 'slider.horizontal.3' },
                { value: 'quantity', label: 'Quantity', icon: 'chart.bar' },
                { value: 'recent', label: 'Recently Added', icon: 'calendar' },
              ].map(option => {
                const active = local.sortBy === option.value;
                return (
                  <TouchableOpacity
                    key={option.value}
                    style={[styles.optionRow, active && styles.optionRowActive]}
                    onPress={() => patch('sortBy', option.value as SortBy)}
                  >
                    <SFIcon name={option.icon as any} size={17} color={active ? Colors.black : Colors.gray} />
                    <Text style={[styles.optionLabel, active && styles.optionLabelActive]}>{option.label}</Text>
                    {active && <SFIcon name="checkmark" size={14} color={Colors.black} style={{ marginLeft: 'auto' } as any} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </Section>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.resetBtn} onPress={() => setLocal(DEFAULT_FILTERS)}>
            <Text style={styles.resetBtnText}>Reset</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.applyBtn} onPress={() => { onApply(local); onClose(); }}>
            <Text style={styles.applyBtnText}>Apply Filters</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.cream },
  handle: { width: 40, height: 4, backgroundColor: Colors.borderGray, borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 4 },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16 },
  title: { fontSize: 22, fontFamily: 'DMSans_700Bold', color: Colors.black },
  subtitle: { fontSize: 13, fontFamily: 'DMSans_400Regular', color: Colors.orange, marginTop: 2 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.lightGray, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: 20, paddingBottom: 16, gap: 24 },
  section: { gap: 12 },
  sectionTitle: { fontSize: 12, fontFamily: 'DMSans_700Bold', color: Colors.gray, letterSpacing: 0.5, textTransform: 'uppercase' },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 44, paddingHorizontal: 16, borderRadius: 12, backgroundColor: Colors.white, borderWidth: 1.5, borderColor: Colors.borderGray },
  pillActive: { backgroundColor: Colors.black, borderColor: Colors.black },
  pillEmoji: { fontSize: 16 },
  pillText: { fontSize: 14, fontFamily: 'DMSans_500Medium', color: Colors.gray },
  pillTextActive: { color: Colors.yellow },
  chipRow: { gap: 8, paddingRight: 4 },
  categoryChip: { height: 34, paddingHorizontal: 14, borderRadius: 50, backgroundColor: Colors.white, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.borderGray },
  categoryChipActive: { backgroundColor: Colors.black, borderColor: Colors.black },
  categoryChipText: { fontSize: 13, fontFamily: 'DMSans_500Medium', color: Colors.gray, lineHeight: 18, includeFontPadding: false } as any,
  categoryChipTextActive: { color: Colors.yellow },
  optionCol: { gap: 6 },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 12, backgroundColor: Colors.white, borderWidth: 1.5, borderColor: 'transparent' },
  optionRowActive: { borderColor: Colors.black },
  dot: { width: 10, height: 10, borderRadius: 5 },
  optionLabel: { fontSize: 14, fontFamily: 'DMSans_500Medium', color: Colors.gray },
  optionLabelActive: { color: Colors.black, fontFamily: 'DMSans_700Bold' },
  footer: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingTop: 12 },
  resetBtn: { flex: 1, height: 52, borderRadius: 50, borderWidth: 1.5, borderColor: Colors.borderGray, alignItems: 'center', justifyContent: 'center' },
  resetBtnText: { fontSize: 15, fontFamily: 'DMSans_700Bold', color: Colors.gray },
  applyBtn: { flex: 2, height: 52, borderRadius: 50, backgroundColor: Colors.yellow, alignItems: 'center', justifyContent: 'center' },
  applyBtnText: { fontSize: 15, fontFamily: 'DMSans_700Bold', color: Colors.black },
});
