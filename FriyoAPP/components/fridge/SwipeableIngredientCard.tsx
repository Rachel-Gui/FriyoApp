import { useRef } from 'react';
import {
  Animated, PanResponder, StyleSheet, Text,
  TouchableOpacity, View,
} from 'react-native';
import { Colors } from '@/constants/Colors';
import { SFIcon } from '@/components/ui/SFIcon';
import type { UiItem } from './types';
import { freshnessColor, freshnessText, storageLabel } from './fridgeUtils';

type Props = {
  item: UiItem;
  onPress: () => void;
  onEdit: () => void;
  onDelete: () => void;
};

export function SwipeableIngredientCard({ item, onPress, onEdit, onDelete }: Props) {
  const translateX = useRef(new Animated.Value(0)).current;
  const revealWidth = 140;
  const color = freshnessColor(item.freshnessLabel);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) =>
        Math.abs(gesture.dx) > 8 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.5,
      onPanResponderMove: (_, gesture) => {
        translateX.setValue(Math.min(0, Math.max(-revealWidth, gesture.dx)));
      },
      onPanResponderRelease: (_, gesture) => {
        Animated.spring(translateX, {
          toValue: gesture.dx < -revealWidth / 2 ? -revealWidth : 0,
          useNativeDriver: true,
          bounciness: 0,
        }).start();
      },
    })
  ).current;

  const collapse = () =>
    Animated.spring(translateX, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start();

  return (
    <View style={styles.wrap}>
      <View style={styles.actions}>
        <TouchableOpacity style={[styles.actionBtn, styles.editBtn]} onPress={() => { collapse(); onEdit(); }}>
          <SFIcon name="pencil" size={18} color={Colors.white} />
          <Text style={styles.actionLabel}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, styles.deleteBtn]} onPress={() => { collapse(); onDelete(); }}>
          <SFIcon name="trash" size={18} color={Colors.white} />
          <Text style={styles.actionLabel}>Delete</Text>
        </TouchableOpacity>
      </View>

      <Animated.View style={[styles.card, { transform: [{ translateX }] }]} {...panResponder.panHandlers}>
        <TouchableOpacity style={styles.cardPress} onPress={onPress} activeOpacity={0.82}>
          <View style={styles.iconWrap}>
            <Text style={styles.emoji}>{item.emoji}</Text>
          </View>
          <View style={styles.info}>
            <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
            <Text style={[styles.freshText, { color }]}>{freshnessText(item)}</Text>
          </View>
          <View style={styles.right}>
            <Text style={styles.amount}>{item.quantity}</Text>
            <Text style={styles.unit}>{item.unit || storageLabel(item.storageType)}</Text>
          </View>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'relative' },
  actions: { position: 'absolute', right: 0, top: 0, bottom: 0, flexDirection: 'row' },
  actionBtn: { width: 70, alignItems: 'center', justifyContent: 'center', gap: 4 },
  editBtn: { backgroundColor: Colors.blue },
  deleteBtn: { backgroundColor: Colors.red },
  actionLabel: { fontSize: 11, fontFamily: 'DMSans_700Bold', color: Colors.white },
  card: { backgroundColor: Colors.white },
  cardPress: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  iconWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.lightGray, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 22 },
  info: { flex: 1, gap: 3 },
  name: { fontSize: 15, fontFamily: 'DMSans_700Bold', color: Colors.black },
  freshText: { fontSize: 12, fontFamily: 'DMSans_500Medium' },
  right: { alignItems: 'flex-end' },
  amount: { fontSize: 14, fontFamily: 'DMSans_700Bold', color: Colors.black },
  unit: { fontSize: 12, fontFamily: 'DMSans_400Regular', color: Colors.gray },
});
