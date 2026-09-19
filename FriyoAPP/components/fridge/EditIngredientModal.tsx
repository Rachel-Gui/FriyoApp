import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform,
  ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/Colors';
import { SFIcon } from '@/components/ui/SFIcon';
import { fridgeService } from '@/services/fridgeService';
import type { FridgeItem } from '@/services/types';
import type { UiItem } from './types';
import { UNIT_OPTIONS } from './types';
import { dateFromDays, daysFromExpiry } from './fridgeUtils';

type UpdateItemData = Parameters<typeof fridgeService.updateItem>[1];

type Props = {
  item: UiItem | null;
  visible: boolean;
  isSaving: boolean;
  onClose: () => void;
  onSave: (id: string, data: UpdateItemData) => Promise<void>;
};

const CATEGORY_CHIPS = ['Vegetable', 'Fruit', 'Meat', 'Seafood', 'Dairy', 'Grain', 'Condiment'];

function categoryToChip(category: string): string {
  if (category === 'Produce') return 'Vegetable';
  if (category === 'Protein') return 'Meat';
  if (category === 'Grains') return 'Grain';
  if (category === 'Condiments') return 'Condiment';
  return CATEGORY_CHIPS.includes(category) ? category : 'Vegetable';
}

export function EditIngredientModal({ item, visible, isSaving, onClose, onSave }: Props) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [unit, setUnit] = useState('');
  const [storage, setStorage] = useState<FridgeItem['storageType']>('fridge');
  const [daysLeft, setDaysLeft] = useState(7);
  const [category, setCategory] = useState('Vegetable');

  useEffect(() => {
    if (!item) return;
    setName(item.name);
    setAmount(String(item.quantity));
    setUnit(item.unit || '');
    setStorage(item.storageType);
    setDaysLeft(item.daysLeft ?? daysFromExpiry(item.expiryDate));
    setCategory(categoryToChip(item.category));
  }, [item]);

  if (!item) return null;

  const handleSave = async () => {
    const parsedAmount = Number(amount);
    if (!name.trim()) {
      Alert.alert('Required', 'Ingredient name cannot be empty.');
      return;
    }
    if (!Number.isFinite(parsedAmount) || parsedAmount < 0) {
      Alert.alert('Invalid', 'Amount must be a positive number.');
      return;
    }
    if (!unit.trim()) {
      Alert.alert('Required', 'Unit cannot be empty.');
      return;
    }

    try {
      await onSave(item.id, {
        customName: name.trim(),
        quantity: parsedAmount,
        unit: unit.trim(),
        storageType: storage,
        expiryDate: dateFromDays(daysLeft),
      });
    } catch {
      Alert.alert('Error', 'Failed to save changes. Please try again.');
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={[styles.root, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Edit Asset</Text>
              <Text style={styles.subtitle}>Manual Refinement</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
              <SFIcon name="xmark" size={16} color={Colors.gray} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            <View style={styles.emojiPreview}>
              <Text style={styles.emojiLarge}>{item.emoji}</Text>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Ingredient Name</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="e.g. Baby Spinach"
                placeholderTextColor={Colors.gray}
                autoCorrect={false}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
                {CATEGORY_CHIPS.map(option => {
                  const active = category === option;
                  return (
                    <TouchableOpacity
                      key={option}
                      style={[styles.categoryChip, active && styles.categoryChipActive]}
                      onPress={() => setCategory(option)}
                      activeOpacity={0.76}
                    >
                      <Text style={[styles.categoryChipText, active && styles.categoryChipTextActive]}>{option}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            <View style={styles.row}>
              <View style={[styles.field, { flex: 1.1 }]}>
                <Text style={styles.label}>Amount</Text>
                <TextInput
                  style={styles.input}
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={Colors.gray}
                />
              </View>
              <View style={{ width: 12 }} />
              <View style={[styles.field, { flex: 1 }]}>
                <Text style={styles.label}>Unit</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.unitRow}>
                  {UNIT_OPTIONS.map(option => (
                    <TouchableOpacity
                      key={option}
                      style={[styles.unitChip, unit === option && styles.unitChipActive]}
                      onPress={() => setUnit(option)}
                    >
                      <Text style={[styles.unitChipText, unit === option && styles.unitChipTextActive]}>{option}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Storage Location</Text>
              <View style={styles.storageRow}>
                {[
                  { value: 'fridge', label: 'Fresh', emoji: '🌿' },
                  { value: 'freezer', label: 'Freeze', emoji: '❄️' },
                  { value: 'pantry', label: 'Pantry', emoji: '🗄️' },
                ].map(option => {
                  const active = storage === option.value;
                  return (
                    <TouchableOpacity
                      key={option.value}
                      style={[styles.storageBtn, active && styles.storageBtnActive]}
                      onPress={() => setStorage(option.value as FridgeItem['storageType'])}
                    >
                      <Text style={styles.storageEmoji}>{option.emoji}</Text>
                      <Text style={[styles.storageBtnText, active && styles.storageBtnTextActive]}>{option.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Freshness · Days Left</Text>
              <View style={styles.stepperWrap}>
                <TouchableOpacity
                  style={styles.stepperBtn}
                  onPress={() => setDaysLeft(value => Math.max(0, value - 1))}
                  hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                >
                  <SFIcon name="minus.circle" size={28} color={daysLeft === 0 ? Colors.borderGray : Colors.black} />
                </TouchableOpacity>
                <View style={styles.stepperCenter}>
                  <Text style={styles.stepperValue}>{daysLeft}</Text>
                  <Text style={styles.stepperSub}>
                    {daysLeft === 0 ? 'Expires Today' : daysLeft === 1 ? 'day left' : 'days left'}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.stepperBtn}
                  onPress={() => setDaysLeft(value => value + 1)}
                  hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                >
                  <SFIcon name="plus.circle" size={28} color={Colors.black} />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity style={[styles.saveBtn, isSaving && styles.saveBtnDisabled]} onPress={handleSave} disabled={isSaving} activeOpacity={0.85}>
              {isSaving ? <ActivityIndicator color={Colors.black} /> : <Text style={styles.saveBtnText}>Update Asset</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.cream },
  handle: { width: 40, height: 4, backgroundColor: Colors.borderGray, borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 4 },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16 },
  title: { fontSize: 28, fontFamily: 'DMSans_700Bold', color: Colors.black },
  subtitle: { fontSize: 16, fontFamily: 'DMSans_400Regular', color: Colors.gray, marginTop: 4 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.lightGray, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40, gap: 18 },
  emojiPreview: { width: 86, height: 86, borderRadius: 24, backgroundColor: Colors.white, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 },
  emojiLarge: { fontSize: 42 },
  field: { gap: 8 },
  row: { flexDirection: 'row' },
  label: { fontSize: 12, fontFamily: 'DMSans_700Bold', color: Colors.gray, letterSpacing: 0.4, textTransform: 'uppercase' },
  input: { height: 58, backgroundColor: Colors.white, borderRadius: 16, paddingHorizontal: 18, fontSize: 19, fontFamily: 'DMSans_500Medium', color: Colors.black, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  categoryRow: { gap: 10, paddingRight: 18 },
  categoryChip: { height: 48, paddingHorizontal: 20, borderRadius: 24, backgroundColor: Colors.white, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.borderGray },
  categoryChipActive: { backgroundColor: Colors.black, borderColor: Colors.black },
  categoryChipText: { fontSize: 16, fontFamily: 'DMSans_500Medium', color: Colors.gray, includeFontPadding: false } as any,
  categoryChipTextActive: { color: Colors.yellow },
  unitRow: { gap: 8, paddingRight: 4 },
  unitChip: { height: 48, minWidth: 56, paddingHorizontal: 16, borderRadius: 24, backgroundColor: Colors.white, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.borderGray },
  unitChipActive: { backgroundColor: Colors.black, borderColor: Colors.black },
  unitChipText: { fontSize: 16, fontFamily: 'DMSans_500Medium', color: Colors.gray, lineHeight: 20, includeFontPadding: false } as any,
  unitChipTextActive: { color: Colors.yellow },
  storageRow: { flexDirection: 'row', gap: 10 },
  storageBtn: { flex: 1, height: 76, borderRadius: 18, backgroundColor: Colors.white, alignItems: 'center', justifyContent: 'center', gap: 5, borderWidth: 1.5, borderColor: Colors.borderGray },
  storageBtnActive: { backgroundColor: Colors.black, borderColor: Colors.black },
  storageEmoji: { fontSize: 24 },
  storageBtnText: { fontSize: 16, fontFamily: 'DMSans_700Bold', color: Colors.gray, includeFontPadding: false } as any,
  storageBtnTextActive: { color: Colors.yellow },
  stepperWrap: { backgroundColor: Colors.white, borderRadius: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 28, paddingVertical: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  stepperBtn: { padding: 4 },
  stepperCenter: { alignItems: 'center', gap: 2 },
  stepperValue: { fontSize: 44, fontFamily: 'DMSans_700Bold', color: Colors.black },
  stepperSub: { fontSize: 15, fontFamily: 'DMSans_400Regular', color: Colors.gray },
  saveBtn: { height: 60, backgroundColor: Colors.yellow, borderRadius: 50, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { fontSize: 16, fontFamily: 'DMSans_700Bold', color: Colors.black },
});
