// ─────────────────────────────────────────────────────────────────────────────
// components/ui/SFIcon.tsx
//
// Centralized SF Symbols–style icon system for Friyo.
//
// Uses Ionicons from @expo/vector-icons (already bundled with Expo).
// Ionicons are designed as direct SF Symbol equivalents for iOS,
// matching Apple's naming conventions, stroke weights, and optical balance.
//
// The SF Symbol name is the public API — swapping the underlying library
// only requires changing this one file.
//
// Usage:
//   <SFIcon name="fork.knife"  size={22} color="#1A1A1A" />
//   <SFIcon name="sparkles"    size={20} weight="fill" />
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// ── SF Symbol → Ionicons mapping ─────────────────────────────────────────────
// Keys are SF Symbol names used throughout the app.
// Values are [outline, filled] Ionicons names.

type IconWeight = 'regular' | 'fill';

const MAP: Record<string, [string, string]> = {
  // Tab bar
  'fork.knife':                   ['restaurant-outline',          'restaurant'],
  'refrigerator':                 ['cube-outline',                'cube'],
  'calendar':                     ['calendar-outline',            'calendar'],
  'person.2':                     ['people-outline',              'people'],
  'sparkles':                     ['sparkles-outline',            'sparkles'],

  // Search & media
  'magnifyingglass':              ['search-outline',              'search'],
  'camera':                       ['camera-outline',              'camera'],
  'arrow.triangle.2.circlepath.camera': ['camera-reverse-outline', 'camera-reverse'],
  'shippingbox':                  ['cube-outline',                'cube'],
  'viewfinder':                   ['scan-outline',                'scan'],
  'photo.on.rectangle':           ['image-outline',               'image'],
  'eye':                          ['eye-outline',                 'eye'],
  'eye.slash':                    ['eye-off-outline',             'eye-off'],

  // Navigation
  'chevron.left':                 ['chevron-back-outline',        'chevron-back'],
  'chevron.right':                ['chevron-forward-outline',     'chevron-forward'],
  'arrow.left':                   ['arrow-back-outline',          'arrow-back'],
  'arrow.right':                  ['arrow-forward-outline',       'arrow-forward'],
  'arrow.up.circle.fill':         ['arrow-up-circle-outline',     'arrow-up-circle'],

  // Actions
  'xmark':                        ['close-outline',               'close'],
  'xmark.circle.fill':            ['close-circle-outline',        'close-circle'],
  'plus':                         ['add-outline',                 'add'],
  'plus.circle':                  ['add-circle-outline',          'add-circle'],
  'minus.circle':                 ['remove-circle-outline',       'remove-circle'],
  'pencil':                       ['pencil-outline',              'pencil'],
  'trash':                        ['trash-outline',               'trash'],
  'ellipsis':                     ['ellipsis-horizontal-outline', 'ellipsis-horizontal'],
  'square.and.arrow.up':          ['share-outline',               'share'],
  'arrow.clockwise':              ['refresh-outline',             'refresh'],
  'clock.arrow.circlepath':       ['refresh-circle-outline',      'refresh-circle'],

  // Communication
  'mic':                          ['mic-outline',                 'mic'],
  'waveform':                     ['pulse-outline',               'pulse'],
  'bubble.left.and.bubble.right': ['chatbubbles-outline',         'chatbubbles'],

  // Settings / controls
  'slider.horizontal.3':          ['options-outline',             'options'],
  'line.3.horizontal':            ['menu-outline',                'menu'],
  'square.grid.2x2':              ['grid-outline',                'grid'],
  'list.bullet.rectangle':        ['list-outline',                'list'],
  'timeline.selection':           ['albums-outline',              'albums'],
  'gear':                         ['settings-outline',            'settings'],

  // Status / feedback
  'checkmark.circle.fill':        ['checkmark-circle-outline',    'checkmark-circle'],
  'checkmark':                    ['checkmark-outline',           'checkmark'],
  'star.fill':                    ['star-outline',                'star'],
  'heart':                        ['heart-outline',               'heart'],
  'heart.fill':                   ['heart-outline',               'heart'],
  'flame':                        ['flame-outline',               'flame'],
  'leaf':                         ['leaf-outline',                'leaf'],
  'trophy.fill':                  ['trophy-outline',              'trophy'],
  'exclamationmark.circle':       ['warning-outline',             'warning'],
  'info.circle':                  ['information-circle-outline',  'information-circle'],

  // Profile / account
  'house':                        ['home-outline',                'home'],
  'person.circle':                ['person-circle-outline',       'person-circle'],
  'bell':                         ['notifications-outline',       'notifications'],
  'bookmark':                     ['bookmark-outline',            'bookmark'],
  'bookmark.fill':                ['bookmark-outline',            'bookmark'],
  'lock.fill':                    ['lock-closed-outline',         'lock-closed'],
  'timer':                        ['timer-outline',               'timer'],
  'play.fill':                    ['play-outline',                'play'],
  'chart.bar':                    ['bar-chart-outline',           'bar-chart'],
  'cart':                         ['cart-outline',                'cart'],
  'cart.fill':                    ['cart-outline',                'cart'],
  'globe':                        ['globe-outline',               'globe'],
};

// ── Component ─────────────────────────────────────────────────────────────────
export type SFIconName = keyof typeof MAP;

interface SFIconProps {
  name:     SFIconName;
  size?:    number;
  color?:   string;
  weight?:  IconWeight;
  opacity?: number;
  style?:   StyleProp<ViewStyle>;
}

export function SFIcon({
  name,
  size    = 22,
  color   = '#1A1A1A',
  weight  = 'regular',
  opacity = 1,
  style,
}: SFIconProps) {
  const entry = MAP[name];
  if (!entry) {
    // Fallback: render nothing — prevents crashes on unknown names
    return null;
  }
  const ionName = weight === 'fill' ? entry[1] : entry[0];

  return (
    <Ionicons
      name={ionName as any}
      size={size}
      color={color}
      style={[{ opacity }, style] as any}
    />
  );
}

// ── Convenience exports for typed icon names ──────────────────────────────────
export const ICON_NAMES = Object.keys(MAP) as SFIconName[];
