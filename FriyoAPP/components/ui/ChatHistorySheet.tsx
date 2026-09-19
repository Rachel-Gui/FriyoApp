// ─────────────────────────────────────────────────────────────────────────────
// components/ui/ChatHistorySheet.tsx
//
// iOS-style modal sheet that shows previous AI chat sessions.
// Slides in from the left with a frosted glass background.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, Animated, Dimensions, Modal,
  Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SFIcon } from './SFIcon';
import { Colors } from '@/constants/Colors';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const SHEET_W = SCREEN_W * 0.82;

export interface ChatRecord {
  id:        string;
  preview:   string;   // first message excerpt
  timestamp: Date;
}

interface ChatHistorySheetProps {
  visible:   boolean;
  onClose:   () => void;
  records:   ChatRecord[];
  onSelect?: (record: ChatRecord) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatTimestamp(ts: Date): string {
  const now   = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tsDay = new Date(ts.getFullYear(), ts.getMonth(), ts.getDate());
  const diff  = Math.round((today.getTime() - tsDay.getTime()) / 86_400_000);

  const weekdays = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const weekday  = weekdays[ts.getDay()];

  const hours   = ts.getHours();
  const minutes = String(ts.getMinutes()).padStart(2, '0');
  const ampm    = hours >= 12 ? 'PM' : 'AM';
  const h12     = hours % 12 || 12;
  const timeStr = `${h12}:${minutes} ${ampm}`;

  if (diff === 0) return `Today · ${weekday} · ${timeStr}`;
  if (diff === 1) return `Yesterday · ${weekday} · ${timeStr}`;
  return `${diff} days ago · ${weekday} · ${timeStr}`;
}

// ── Component ─────────────────────────────────────────────────────────────────
export function ChatHistorySheet({
  visible,
  onClose,
  records,
  onSelect,
}: ChatHistorySheetProps) {
  const insets   = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(-SHEET_W)).current;
  const bgOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0, useNativeDriver: true,
          stiffness: 320, damping: 30, mass: 0.9,
        }),
        Animated.timing(bgOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: -SHEET_W, useNativeDriver: true,
          stiffness: 400, damping: 38,
        }),
        Animated.timing(bgOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      {/* Scrim */}
      <Animated.View style={[s.scrim, { opacity: bgOpacity }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
      </Animated.View>

      {/* Sheet */}
      <Animated.View style={[s.sheet, { transform: [{ translateX: slideAnim }] }]}>
        <BlurView
          intensity={Platform.OS === 'ios' ? 80 : 0}
          tint="light"
          style={[
            s.sheetInner,
            { paddingTop: insets.top + 16 },
            Platform.OS === 'android' && { backgroundColor: 'rgba(245,240,232,0.97)' },
          ]}
        >
          <View style={s.sheetBorder} />

          {/* Header */}
          <View style={s.header}>
            <Text style={s.headerTitle}>Chat History</Text>
            <TouchableOpacity style={s.closeBtn} onPress={onClose} activeOpacity={0.7}>
              <SFIcon name="xmark" size={16} color="rgba(0,0,0,0.6)" />
            </TouchableOpacity>
          </View>

          {/* Records */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={s.list}
          >
            {records.length === 0 ? (
              <View style={s.emptyState}>
                <View style={s.emptyIcon}>
                  <SFIcon name="bubble.left.and.bubble.right" size={32} color="rgba(0,0,0,0.22)" />
                </View>
                <Text style={s.emptyTitle}>No chat history yet</Text>
                <Text style={s.emptySub}>
                  Your conversations with Friyo will appear here.
                </Text>
              </View>
            ) : (
              records.map((rec, idx) => (
                <TouchableOpacity
                  key={rec.id}
                  style={[s.record, idx === 0 && s.recordFirst]}
                  onPress={() => { onSelect?.(rec); onClose(); }}
                  activeOpacity={0.7}
                >
                  <View style={s.recordIcon}>
                    <SFIcon name="bubble.left.and.bubble.right" size={16} color="rgba(0,0,0,0.45)" />
                  </View>
                  <View style={s.recordBody}>
                    <Text style={s.recordPreview} numberOfLines={2}>
                      {rec.preview}
                    </Text>
                    <Text style={s.recordTime}>
                      {formatTimestamp(rec.timestamp)}
                    </Text>
                  </View>
                  <SFIcon name="chevron.right" size={14} color="rgba(0,0,0,0.25)" />
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </BlurView>
      </Animated.View>
    </Modal>
  );
}

const s = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  sheet: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: SHEET_W,
    height: SCREEN_H,
    shadowColor: '#000',
    shadowOffset: { width: 6, height: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 32,
    elevation: 30,
  },
  sheetInner: {
    flex: 1,
    paddingHorizontal: 0,
    backgroundColor: 'rgba(245,240,232,0.72)',
    overflow: 'hidden',
  },
  sheetBorder: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    borderRightWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.07)',
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: 'DMSans_700Bold',
    color: '#1A1A1A',
  },
  closeBtn: {
    width: 32, height: 32,
    backgroundColor: 'rgba(0,0,0,0.07)',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },

  list: { paddingHorizontal: 14, paddingBottom: 40 },

  record: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  recordFirst: { borderTopWidth: 0 },
  recordIcon: {
    width: 36, height: 36,
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.8)',
  },
  recordBody: { flex: 1, gap: 3 },
  recordPreview: {
    fontSize: 13,
    fontFamily: 'DMSans_500Medium',
    color: '#1A1A1A',
    lineHeight: 18,
  },
  recordTime: {
    fontSize: 11,
    fontFamily: 'DMSans_400Regular',
    color: 'rgba(0,0,0,0.40)',
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 24,
    gap: 10,
  },
  emptyIcon: {
    width: 72, height: 72,
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.7)',
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: 'DMSans_700Bold',
    color: 'rgba(0,0,0,0.55)',
  },
  emptySub: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    color: 'rgba(0,0,0,0.38)',
    textAlign: 'center',
    lineHeight: 18,
  },
});
