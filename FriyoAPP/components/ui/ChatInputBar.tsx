// ─────────────────────────────────────────────────────────────────────────────
// components/ui/ChatInputBar.tsx
//
// iOS Liquid Glass chat input bar.
// Floats above the bottom safe area with mic, text field, and send button.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useRef, useState } from 'react';
import {
  View, TextInput, TouchableOpacity, StyleSheet,
  Animated, Platform, Text, Keyboard,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SFIcon } from './SFIcon';
import { Colors } from '@/constants/Colors';

interface ChatInputBarProps {
  value:           string;
  onChangeText:    (t: string) => void;
  onSend:          () => void;
  onMicPress?:     () => void;
  isRecording?:    boolean;
  /** Extra bottom offset in addition to safe-area (e.g. when bottom nav is visible) */
  extraBottom?:    number;
  placeholder?:    string;
}

export function ChatInputBar({
  value,
  onChangeText,
  onSend,
  onMicPress,
  isRecording   = false,
  extraBottom   = 0,
  placeholder   = 'Ask Friyo anything...',
}: ChatInputBarProps) {
  const insets = useSafeAreaInsets();
  const restingBottom = insets.bottom + extraBottom + 12;
  const [bottom, setBottom] = useState(restingBottom);

  // Send button presence animation
  const sendScale = useRef(new Animated.Value(0)).current;
  const hasTxt    = value.trim().length > 0;

  React.useEffect(() => {
    Animated.spring(sendScale, {
      toValue:         hasTxt ? 1 : 0,
      useNativeDriver: true,
      stiffness:       380,
      damping:         22,
    }).start();
  }, [hasTxt]);

  // Mic pulse when recording
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseLoop = useRef<Animated.CompositeAnimation | null>(null);

  React.useEffect(() => {
    if (isRecording) {
      pulseLoop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.18, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1,    duration: 600, useNativeDriver: true }),
        ]),
      );
      pulseLoop.current.start();
    } else {
      pulseLoop.current?.stop();
      pulseAnim.setValue(1);
    }
    return () => pulseLoop.current?.stop();
  }, [isRecording]);

  React.useEffect(() => {
    setBottom(restingBottom);
  }, [restingBottom]);

  React.useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, event => {
      setBottom(event.endCoordinates.height + 12);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setBottom(restingBottom);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [restingBottom]);

  return (
    <View style={[s.wrapper, { bottom }]} pointerEvents="box-none">
      {/* Recording indicator */}
      {isRecording && (
        <View style={s.recordingBanner}>
          <SFIcon name="waveform" size={14} color={Colors.red} />
          <Text style={s.recordingText}>Listening...</Text>
        </View>
      )}

      {/* Glass capsule */}
      <View style={s.capsuleShadow}>
        <BlurView
          intensity={Platform.OS === 'ios' ? 72 : 0}
          tint="light"
          style={[
            s.capsule,
            Platform.OS === 'android' && { backgroundColor: 'rgba(255,255,255,0.92)' },
            isRecording && s.capsuleRecording,
          ]}
        >
          <View style={s.capsuleBorder} />

          {onMicPress ? (
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <TouchableOpacity
                style={[s.iconBtn, isRecording && s.iconBtnRecording]}
                onPress={onMicPress}
                activeOpacity={0.75}
              >
                <SFIcon
                  name={isRecording ? 'waveform' : 'mic'}
                  size={19}
                  color={isRecording ? Colors.red : 'rgba(0,0,0,0.55)'}
                />
              </TouchableOpacity>
            </Animated.View>
          ) : null}

          {/* Text input */}
          <TextInput
            style={s.input}
            placeholder={placeholder}
            placeholderTextColor="rgba(0,0,0,0.32)"
            value={value}
            onChangeText={onChangeText}
            multiline
            returnKeyType="send"
            onSubmitEditing={onSend}
            blurOnSubmit={false}
          />

          {/* Send button — springs in when text present */}
          <Animated.View style={{ transform: [{ scale: sendScale }], opacity: sendScale }}>
            <TouchableOpacity
              style={s.sendBtn}
              onPress={onSend}
              activeOpacity={0.8}
            >
              <SFIcon name="arrow.up.circle.fill" size={32} color={Colors.black} weight="fill" />
            </TouchableOpacity>
          </Animated.View>
        </BlurView>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 14,
    right: 14,
    zIndex: 50,
  },
  recordingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'center',
    backgroundColor: 'rgba(229,57,53,0.1)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginBottom: 8,
  },
  recordingText: {
    fontSize: 12,
    fontFamily: 'DMSans_500Medium',
    color: Colors.red,
  },
  capsuleShadow: {
    borderRadius: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.10,
    shadowRadius: 30,
    elevation: 16,
  },
  capsule: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderRadius: 28,
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 6,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.62)',
  },
  capsuleRecording: {
    backgroundColor: 'rgba(255,235,235,0.72)',
  },
  capsuleBorder: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
  },
  iconBtn: {
    width: 36, height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
  },
  iconBtnRecording: {
    backgroundColor: 'rgba(229,57,53,0.1)',
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'DMSans_400Regular',
    color: '#1A1A1A',
    maxHeight: 110,
    paddingTop: Platform.OS === 'ios' ? 8 : 6,
    paddingBottom: Platform.OS === 'ios' ? 8 : 6,
    lineHeight: 20,
  },
  sendBtn: {
    width: 36, height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
