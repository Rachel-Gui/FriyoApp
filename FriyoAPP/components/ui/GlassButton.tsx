// ─────────────────────────────────────────────────────────────────────────────
// components/ui/GlassButton.tsx
//
// Reusable iOS Liquid Glass capsule button with spring press feedback.
// Covers: text-only, icon-only (circular), and icon+text variants.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useRef } from 'react';
import {
  Animated, TouchableOpacity, Text, View,
  StyleSheet, StyleProp, ViewStyle, TextStyle,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Platform } from 'react-native';
import { SFIcon, SFIconName } from './SFIcon';

interface GlassButtonProps {
  /** Text label. If omitted, renders icon-only. */
  label?:       string;
  /** SF Symbol icon name. */
  icon?:        SFIconName;
  iconWeight?:  'regular' | 'fill';
  iconSize?:    number;
  iconColor?:   string;
  /** circular forces a square container with borderRadius = size/2 */
  variant?:     'capsule' | 'circular';
  /** 40–44 for tap targets */
  size?:        number;
  onPress?:     () => void;
  style?:       StyleProp<ViewStyle>;
  textStyle?:   StyleProp<TextStyle>;
  /** tint overlay colour (default white glass) */
  tint?:        string;
  /** accent highlight gradient — shown as a thin top highlight */
  accent?:      boolean;
  disabled?:    boolean;
}

export function GlassButton({
  label,
  icon,
  iconWeight = 'regular',
  iconSize   = 18,
  iconColor  = 'rgba(0,0,0,0.78)',
  variant    = 'capsule',
  size       = 44,
  onPress,
  style,
  textStyle,
  tint       = 'rgba(255,255,255,0.62)',
  accent     = false,
  disabled   = false,
}: GlassButtonProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const pressIn  = () => Animated.spring(scale, { toValue: 0.91, useNativeDriver: true, stiffness: 420, damping: 18 }).start();
  const pressOut = () => Animated.spring(scale, { toValue: 1,    useNativeDriver: true, stiffness: 300, damping: 22 }).start();

  const isCircular = variant === 'circular';
  const radius     = isCircular ? size / 2 : size / 2;   // always round for both

  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <TouchableOpacity
        activeOpacity={1}
        onPress={disabled ? undefined : onPress}
        onPressIn={pressIn}
        onPressOut={pressOut}
        style={[
          s.shadow,
          isCircular && { width: size, height: size, borderRadius: radius },
        ]}
      >
        <BlurView
          intensity={Platform.OS === 'ios' ? 60 : 0}
          tint="light"
          style={[
            s.glass,
            { borderRadius: radius },
            isCircular && { width: size, height: size },
            !isCircular && { paddingHorizontal: 18, height: size },
            Platform.OS === 'android' && { backgroundColor: 'rgba(255,255,255,0.88)' },
            disabled && { opacity: 0.45 },
          ]}
        >
          {/* Tint overlay */}
          <View style={[s.tintOverlay, { borderRadius: radius, backgroundColor: tint }]} />

          {/* Top highlight streak */}
          {accent && (
            <View style={[s.highlight, { borderTopLeftRadius: radius, borderTopRightRadius: radius }]} />
          )}

          {/* Border ring */}
          <View style={[s.border, { borderRadius: radius }]} />

          {/* Content */}
          <View style={s.content}>
            {icon && (
              <SFIcon
                name={icon}
                size={iconSize}
                color={iconColor}
                weight={iconWeight}
              />
            )}
            {label && (
              <Text style={[s.label, textStyle]}>
                {label}
              </Text>
            )}
          </View>
        </BlurView>
      </TouchableOpacity>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  shadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.13,
    shadowRadius: 18,
    elevation: 10,
    backgroundColor: 'transparent',
  },
  glass: {
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  tintOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  highlight: {
    position: 'absolute',
    top: 0, left: 8, right: 8,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  border: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    zIndex: 1,
  },
  label: {
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
    color: 'rgba(0,0,0,0.78)',
    letterSpacing: 0.1,
  },
});
