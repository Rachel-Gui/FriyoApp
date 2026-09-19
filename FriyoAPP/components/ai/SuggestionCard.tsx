import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '@/constants/Colors';
import { SFIcon } from '@/components/ui/SFIcon';

interface Props {
  tips: string[];
}

export function SuggestionCard({ tips }: Props) {
  return (
    <View style={sg.wrap}>
      <View style={sg.header}>
        <View style={sg.iconCircle}>
          <SFIcon name="leaf" size={16} color={Colors.white} />
        </View>
        <Text style={sg.headerTitle}>Healthy Tips</Text>
      </View>
      {tips.map((tip, i) => (
        <View key={i} style={[sg.tipRow, i < tips.length - 1 && sg.tipBorder]}>
          <Text style={sg.tipText}>{tip}</Text>
        </View>
      ))}
    </View>
  );
}

const sg = StyleSheet.create({
  wrap: {
    backgroundColor: Colors.white,
    borderRadius:    16,
    overflow:        'hidden',
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: 2 },
    shadowOpacity:   0.08,
    shadowRadius:    10,
    elevation:       4,
  },
  header:     { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderBottomWidth: 1, borderBottomColor: Colors.borderGray },
  iconCircle: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.green, alignItems: 'center', justifyContent: 'center' },
  headerTitle:{ fontSize: 14, fontFamily: 'DMSans_700Bold', color: Colors.black },
  tipRow:     { paddingHorizontal: 14, paddingVertical: 11 },
  tipBorder:  { borderBottomWidth: 1, borderBottomColor: Colors.lightGray },
  tipText:    { fontSize: 13, fontFamily: 'DMSans_400Regular', color: Colors.black, lineHeight: 19 },
});
