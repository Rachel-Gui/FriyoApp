import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '@/constants/Colors';
import type { UiItem } from './types';
import { freshnessColor } from './fridgeUtils';

const { width } = Dimensions.get('window');
const GRID_PADDING = 16;
const GRID_GAP = 10;
const itemWidth = Math.floor((width - GRID_PADDING * 2 - GRID_GAP * 2) / 3);

type Props = {
  item: UiItem;
  onPress: () => void;
};

export function IngredientGridItem({ item, onPress }: Props) {
  const color = freshnessColor(item.freshnessLabel);

  return (
    <TouchableOpacity style={styles.wrap} onPress={onPress} activeOpacity={0.82}>
      <View style={styles.emojiWrap}>
        <Text style={styles.emoji}>{item.emoji}</Text>
        <View style={[styles.dot, { backgroundColor: color }]} />
      </View>
      <Text style={styles.name} numberOfLines={2}>{item.name}</Text>
      <Text style={styles.amount} numberOfLines={1}>{item.quantity} {item.unit}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: itemWidth,
    minHeight: 122,
    backgroundColor: Colors.white,
    borderRadius: 16,
    paddingHorizontal: 8,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  emojiWrap: { position: 'relative', width: 52, height: 52, borderRadius: 15, backgroundColor: Colors.lightGray, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 26 },
  dot: { position: 'absolute', bottom: 2, right: 2, width: 10, height: 10, borderRadius: 5, borderWidth: 1.5, borderColor: Colors.white },
  name: { fontSize: 12, lineHeight: 15, fontFamily: 'DMSans_700Bold', color: Colors.black, textAlign: 'center', minHeight: 30 },
  amount: { fontSize: 11, fontFamily: 'DMSans_400Regular', color: Colors.gray, textAlign: 'center' },
});
