import {
  ActivityIndicator, Alert, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Colors } from '@/constants/Colors';
import { SFIcon } from '@/components/ui/SFIcon';
import { EditIngredientModal } from '@/components/fridge/EditIngredientModal';
import { EmptyFridgeState } from '@/components/fridge/EmptyFridgeState';
import { FilterSheet } from '@/components/fridge/FilterSheet';
import { IngredientDetailSheet } from '@/components/fridge/IngredientDetailSheet';
import { IngredientGridItem } from '@/components/fridge/IngredientGridItem';
import { SwipeableIngredientCard } from '@/components/fridge/SwipeableIngredientCard';
import {
  DEFAULT_FILTERS, QUICK_CHIPS,
  type FridgeFilters, type UiItem, type ViewMode,
} from '@/components/fridge/types';
import {
  activeFilterCount, applyFilters, groupItems, toUiItem,
} from '@/components/fridge/fridgeUtils';
import { fridgeService } from '@/services/fridgeService';

const SCANNER_ROUTE = '/(tabs)/fridge/scanner' as const;

export default function FridgeScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [quickChip, setQuickChip] = useState('All');
  const [filters, setFilters] = useState<FridgeFilters>(DEFAULT_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);
  const [detailItem, setDetailItem] = useState<UiItem | null>(null);
  const [editItem, setEditItem] = useState<UiItem | null>(null);

  const { data: allItems = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['fridge'],
    queryFn: () => fridgeService.getItems(),
    retry: false,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => fridgeService.deleteItem(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fridge'] }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof fridgeService.updateItem>[1] }) =>
      fridgeService.updateItem(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fridge'] }),
  });

  const uiItems = useMemo(() => allItems.map(toUiItem), [allItems]);
  const filtered = useMemo(
    () => applyFilters(uiItems, filters, quickChip, searchQuery),
    [uiItems, filters, quickChip, searchQuery],
  );
  const groups = useMemo(() => groupItems(filtered), [filtered]);
  const filterCount = activeFilterCount(filters);

  const openScanner = () => router.push(SCANNER_ROUTE as any);

  const confirmDelete = useCallback((item: UiItem) => {
    Alert.alert(
      'Remove Ingredient',
      `Remove ${item.name} from your fridge?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => deleteMutation.mutate(item.id) },
      ]
    );
  }, [deleteMutation]);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.toggleBtn}
          onPress={() => setViewMode(mode => mode === 'list' ? 'grid' : 'list')}
          hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
        >
          <SFIcon
            name={viewMode === 'list' ? 'square.grid.2x2' : 'line.3.horizontal'}
            size={20}
            color={Colors.black}
          />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>My Fridge</Text>

        <TouchableOpacity style={styles.scanBtn} onPress={openScanner}>
          <SFIcon name="camera" size={19} color={Colors.white} weight="fill" />
        </TouchableOpacity>
      </View>

      <View style={styles.searchBar}>
        <SFIcon name="magnifyingglass" size={15} color={Colors.gray} />
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search ingredients..."
          placeholderTextColor={Colors.gray}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <SFIcon name="xmark.circle.fill" size={17} color={Colors.gray} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipScroll}
        contentContainerStyle={styles.chipRow}
      >
        {QUICK_CHIPS.map(chip => {
          const active = quickChip === chip;
          return (
            <TouchableOpacity
              key={chip}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setQuickChip(chip)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{chip}</Text>
            </TouchableOpacity>
          );
        })}

        <TouchableOpacity
          style={[styles.chip, styles.filterBtn, filterCount > 0 && styles.filterBtnActive]}
          onPress={() => setFilterOpen(true)}
        >
          <SFIcon name="slider.horizontal.3" size={14} color={filterCount > 0 ? Colors.white : Colors.gray} />
          {filterCount > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{filterCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </ScrollView>

      <View style={styles.countRow}>
        <Text style={styles.countText}>
          {filtered.length} ingredient{filtered.length !== 1 ? 's' : ''}
        </Text>
        <TouchableOpacity onPress={() => refetch()} disabled={isRefetching}>
          <SFIcon name="arrow.clockwise" size={15} color={Colors.gray} />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={Colors.gray} />
        </View>
      ) : viewMode === 'list' ? (
        <ScrollView
          style={styles.listScroll}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          keyboardDismissMode="on-drag"
        >
          {groups.length === 0 ? (
            <EmptyFridgeState query={searchQuery} onScan={openScanner} />
          ) : (
            groups.map(group => (
              <View key={group.key} style={styles.group}>
                <View style={styles.groupHeader}>
                  <Text style={styles.groupTitle}>{group.title}</Text>
                  <Text style={styles.groupCount}>{group.items.length}</Text>
                </View>
                <View style={styles.groupCard}>
                  {group.items.map((item, index) => (
                    <View key={item.id}>
                      {index > 0 && <View style={styles.divider} />}
                      <SwipeableIngredientCard
                        item={item}
                        onPress={() => setEditItem(item)}
                        onEdit={() => setEditItem(item)}
                        onDelete={() => confirmDelete(item)}
                      />
                    </View>
                  ))}
                </View>
              </View>
            ))
          )}
        </ScrollView>
      ) : (
        <ScrollView
          style={styles.listScroll}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.gridContent}
          keyboardDismissMode="on-drag"
        >
          {filtered.length === 0 ? (
            <EmptyFridgeState query={searchQuery} onScan={openScanner} />
          ) : (
            <View style={styles.grid}>
              {filtered.map(item => (
                <IngredientGridItem key={item.id} item={item} onPress={() => setEditItem(item)} />
              ))}
            </View>
          )}
        </ScrollView>
      )}

      <FilterSheet
        visible={filterOpen}
        filters={filters}
        onApply={setFilters}
        onClose={() => setFilterOpen(false)}
      />

      <IngredientDetailSheet
        item={detailItem}
        visible={detailItem !== null}
        onClose={() => setDetailItem(null)}
        onEdit={item => {
          setDetailItem(null);
          setEditItem(item);
        }}
        onDelete={confirmDelete}
      />

      <EditIngredientModal
        item={editItem}
        visible={editItem !== null}
        isSaving={updateMutation.isPending}
        onClose={() => setEditItem(null)}
        onSave={async (id, data) => {
          await updateMutation.mutateAsync({ id, data });
          setEditItem(null);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.cream },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 12, paddingTop: 6 },
  toggleBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontFamily: 'DMSans_700Bold', color: Colors.black },
  scanBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: Colors.black, alignItems: 'center', justifyContent: 'center' },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white, borderRadius: 50, marginHorizontal: 16, paddingHorizontal: 16, paddingVertical: 11, marginBottom: 10, gap: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 2 },
  searchInput: { flex: 1, fontSize: 14, fontFamily: 'DMSans_400Regular', color: Colors.black, padding: 0 },
  chipScroll: { flexGrow: 0, flexShrink: 0 },
  chipRow: { paddingHorizontal: 16, gap: 8, paddingBottom: 4, alignItems: 'center' },
  chip: { height: 34, paddingHorizontal: 14, borderRadius: 50, backgroundColor: Colors.white, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.borderGray },
  chipActive: { backgroundColor: Colors.black, borderColor: Colors.black },
  chipText: { fontSize: 13, fontFamily: 'DMSans_500Medium', color: Colors.gray, lineHeight: 18, includeFontPadding: false } as any,
  chipTextActive: { color: Colors.yellow },
  filterBtn: { width: 34, paddingHorizontal: 0, position: 'relative' },
  filterBtnActive: { backgroundColor: Colors.black, borderColor: Colors.black },
  filterBadge: { position: 'absolute', top: -4, right: -4, width: 16, height: 16, borderRadius: 8, backgroundColor: Colors.orange, alignItems: 'center', justifyContent: 'center' },
  filterBadgeText: { fontSize: 9, fontFamily: 'DMSans_700Bold', color: Colors.white },
  countRow: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  countText: { fontSize: 12, fontFamily: 'DMSans_500Medium', color: Colors.gray },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listScroll: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingBottom: 120, paddingTop: 4, gap: 16 },
  group: { gap: 8 },
  groupHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  groupTitle: { fontSize: 14, fontFamily: 'DMSans_700Bold', color: Colors.black },
  groupCount: { fontSize: 12, fontFamily: 'DMSans_500Medium', color: Colors.gray },
  groupCard: { backgroundColor: Colors.white, borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  divider: { height: 1, backgroundColor: Colors.borderGray, marginLeft: 68 },
  gridContent: { paddingHorizontal: 16, paddingBottom: 120, paddingTop: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 },
});
