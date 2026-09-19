import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '@/constants/Colors';
import { SFIcon, SFIconName } from '@/components/ui/SFIcon';

interface RecipeMetaChipProps {
  label:      string;
  icon?:      SFIconName;
  iconColor?: string;
  iconWeight?: 'regular' | 'fill';
  bg?:        string;
  textColor?: string;
}

export function RecipeMetaChip({
  label,
  icon,
  iconColor  = Colors.gray,
  iconWeight = 'regular',
  bg         = Colors.lightGray,
  textColor  = Colors.gray,
}: RecipeMetaChipProps) {
  return (
    <View style={[chip.wrap, { backgroundColor: bg }]}>
      {icon && (
        <SFIcon name={icon} size={11} color={iconColor} weight={iconWeight} />
      )}
      <Text style={[chip.label, { color: textColor }]}>{label}</Text>
    </View>
  );
}

const chip = StyleSheet.create({
  wrap: {
    height:          26,
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    borderRadius:    50,
    paddingHorizontal: 10,
    gap:             4,
  },
  label: {
    fontSize:           11,
    fontFamily:         'DMSans_500Medium',
    lineHeight:         14,      // tight: prevents vertical stretch
    includeFontPadding: false,   // Android: strip hidden ascender/descender gaps
  },
});
