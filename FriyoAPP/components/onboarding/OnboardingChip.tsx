import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Colors } from '@/constants/Colors';

interface Props {
  label: string;
  selected: boolean;
  onPress: () => void;
  emoji?: string;
}

export default function OnboardingChip({ label, selected, onPress, emoji }: Props) {
  return (
    <TouchableOpacity
      style={[styles.chip, selected && styles.chipSelected]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.label, selected && styles.labelSelected]}>
        {emoji ? `${emoji}  ${label}` : label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 50,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.borderGray,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  chipSelected: { backgroundColor: Colors.yellow, borderColor: Colors.yellow },
  label: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    color: Colors.black,
  },
  labelSelected: { fontFamily: 'DMSans_700Bold' },
});
