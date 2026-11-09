import { LocalizedAlert as Alert, LocalizedText as Text, LocalizedTouchableOpacity as TouchableOpacity } from '@/components/ui/LocalizedNative';
import { useCallback, useState } from 'react';
import { StyleSheet, useColorScheme, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/Colors';
import { SFIcon } from '@/components/ui/SFIcon';
import { shoppingListService, type ShoppingListItem } from '@/services/shoppingListService';

export default function ShoppingListScreen() {
  const router = useRouter();
  const dark = useColorScheme() === 'dark';
  const [items, setItems] = useState<ShoppingListItem[]>([]);
  const bg = dark ? '#111111' : '#F7F7F5';
  const card = dark ? '#1E1E1E' : Colors.white;
  const text = dark ? Colors.white : Colors.black;
  const sub = dark ? '#A3A3A3' : Colors.gray;

  const refresh = useCallback(() => {
    void shoppingListService.getItems().then(setItems);
  }, []);

  useFocusEffect(refresh);

  const toggle = async (id: string) => setItems(await shoppingListService.toggle(id));
  const remove = async (id: string) => setItems(await shoppingListService.remove(id));
  const clearChecked = async () => setItems(await shoppingListService.clearChecked());

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: bg }]}>
      <View style={styles.header}>
        <TouchableOpacity style={[styles.iconButton, { backgroundColor: card }]} onPress={() => router.back()} accessibilityLabel="Go back">
          <SFIcon name="chevron.left" size={20} color={text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: text }]}>Shopping List</Text>
          <Text style={[styles.subtitle, { color: sub }]}>{items.filter(item => !item.checked).length} item(s) left</Text>
        </View>
        {items.some(item => item.checked) && (
          <TouchableOpacity onPress={() => Alert.alert('Clear purchased items?', undefined, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Clear', style: 'destructive', onPress: clearChecked },
          ])}>
            <Text style={styles.clear}>Clear bought</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.list}>
        {items.length === 0 ? (
          <View style={styles.empty}>
            <SFIcon name="cart" size={42} color={sub} />
            <Text style={[styles.emptyTitle, { color: text }]}>Your list is empty</Text>
            <Text style={[styles.emptyBody, { color: sub }]}>Open a recipe and add its missing ingredients.</Text>
          </View>
        ) : items.map(item => (
          <View key={item.id} style={[styles.row, { backgroundColor: card }]}>
            <TouchableOpacity style={[styles.check, item.checked && styles.checked]} onPress={() => toggle(item.id)} accessibilityLabel={`Mark ${item.name} as ${item.checked ? 'not bought' : 'bought'}`}>
              {item.checked && <SFIcon name="checkmark" size={15} color={Colors.black} />}
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text translate={false} style={[styles.itemName, { color: text }, item.checked && styles.strike]}>{item.name}</Text>
              <Text style={[styles.meta, { color: sub }]}>{item.quantity} {item.unit}{item.recipeTitle ? ` · ${item.recipeTitle}` : ''}</Text>
            </View>
            <TouchableOpacity onPress={() => remove(item.id)} accessibilityLabel={`Remove ${item.name}`}>
              <SFIcon name="trash" size={19} color={Colors.red} />
            </TouchableOpacity>
          </View>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingVertical: 14 },
  iconButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: 'LibreBaskerville_700Bold', fontSize: 23 },
  subtitle: { fontFamily: 'DMSans_400Regular', fontSize: 12, marginTop: 2 },
  clear: { color: Colors.red, fontFamily: 'DMSans_700Bold', fontSize: 12 },
  list: { padding: 18, gap: 10 },
  row: { minHeight: 66, borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  check: { width: 25, height: 25, borderRadius: 13, borderWidth: 2, borderColor: Colors.yellow, alignItems: 'center', justifyContent: 'center' },
  checked: { backgroundColor: Colors.yellow },
  itemName: { fontFamily: 'DMSans_700Bold', fontSize: 15 },
  strike: { textDecorationLine: 'line-through', opacity: 0.55 },
  meta: { fontFamily: 'DMSans_400Regular', fontSize: 12, marginTop: 3 },
  empty: { alignItems: 'center', paddingTop: 110, paddingHorizontal: 30 },
  emptyTitle: { fontFamily: 'DMSans_700Bold', fontSize: 18, marginTop: 16 },
  emptyBody: { fontFamily: 'DMSans_400Regular', fontSize: 14, textAlign: 'center', lineHeight: 20, marginTop: 7 },
});
