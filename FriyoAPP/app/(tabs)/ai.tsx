import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Platform, Image, KeyboardAvoidingView,
  Alert, Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SFIcon }           from '@/components/ui/SFIcon';
import { GlassButton }      from '@/components/ui/GlassButton';
import { ChatHistorySheet, ChatRecord } from '@/components/ui/ChatHistorySheet';
import { Colors }           from '@/constants/Colors';
import { useAiChatStore }   from '@/store/aiChatStore';
import { aiService }        from '@/services/aiService';
import { aiConsentService } from '@/services/aiConsentService';
import { RecipeRecommendationCard } from '@/components/ai/RecipeRecommendationCard';
import type { AIRecipeSuggestion } from '@/services/types';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Message {
  id:               string;
  role:             'user' | 'ai';
  text:             string;
  suggestedRecipes?: AIRecipeSuggestion[];
  quickActions?:     string[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const INITIAL_MESSAGE: Message = {
  id:   '0',
  role: 'ai',
  text: "Hi! I'm Friyo. Tell me what you're craving, what you have in your fridge, or how much time you have — and I'll suggest the perfect meal for you! 😊",
};

const QUICK_ACTIONS = [
  { label: '🍳 What can I cook?',      query: 'What can I cook tonight?' },
  { label: '⚠️ Use expiring items',    query: 'What should I use before it expires?' },
  { label: '📅 Plan my meals',         query: 'Plan my meals for 3 days' },
  { label: '🔍 Search recipes',        query: 'Search recipes for me' },
  { label: '🥗 Healthy comfort meal',  query: 'Give me a healthy comfort meal idea' },
  { label: '🛒 Shopping list',         query: 'What do I need to buy?' },
];

let msgCounter = 1;
const uid = () => String(++msgCounter);

// ── Helpers ───────────────────────────────────────────────────────────────────

// Renders **bold** markdown inside a <Text>
function RichText({ text, style }: { text: string; style?: object }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <Text style={style}>
      {parts.map((part, i) =>
        part.startsWith('**') && part.endsWith('**')
          ? <Text key={i} style={{ fontFamily: 'DMSans_700Bold' }}>{part.slice(2, -2)}</Text>
          : <Text key={i}>{part}</Text>
      )}
    </Text>
  );
}

// Three-dot typing indicator
function TypingIndicator() {
  const dot = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(dot, { toValue: 3, duration: 600, useNativeDriver: false }),
        Animated.timing(dot, { toValue: 0, duration: 0,   useNativeDriver: false }),
      ])
    ).start();
  }, []);

  return (
    <View style={[s.bubbleRow, s.bubbleRowAI]}>
      <Image source={require('../../assets/images/mascot-chat.png')} style={s.avatar} resizeMode="contain" />
      <View style={[s.bubble, s.bubbleAI]}>
        <View style={s.typingRow}>
          {[0, 1, 2].map(i => (
            <Animated.View
              key={i}
              style={[
                s.typingDot,
                { opacity: dot.interpolate({ inputRange: [i, i + 0.5, i + 1], outputRange: [0.25, 1, 0.25], extrapolate: 'clamp' }) },
              ]}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

// ── Message bubble ─────────────────────────────────────────────────────────────

function MessageBubble({
  msg,
  onStartCooking,
  onQuickAction,
}: {
  msg: Message;
  onStartCooking?: (recipe: AIRecipeSuggestion) => void;
  onQuickAction?: (query: string) => void;
}) {
  const isUser = msg.role === 'user';

  if (isUser) {
    return (
      <View style={[s.bubbleRow, s.bubbleRowUser]}>
        <View style={[s.bubble, s.bubbleUser]}>
          <Text style={[s.bubbleText, s.bubbleTextUser]}>{msg.text}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[s.bubbleRow, s.bubbleRowAI]}>
      <Image source={require('../../assets/images/mascot-chat.png')} style={s.avatar} resizeMode="contain" />

      <View style={s.aiContent}>
        {!!msg.text && (
          <View style={[s.bubble, s.bubbleAI]}>
            <RichText text={msg.text} style={s.bubbleText} />
          </View>
        )}
        {!!msg.suggestedRecipes?.length && (
          <RecipeRecommendationCard
            recipes={msg.suggestedRecipes}
            onStartCooking={onStartCooking}
          />
        )}
        {!!msg.quickActions?.length && (
          <View style={s.inlineActions}>
            {msg.quickActions.slice(0, 4).map(action => (
              <TouchableOpacity
                key={action}
                style={s.inlineActionChip}
                onPress={() => onQuickAction?.(action)}
                activeOpacity={0.72}
              >
                <Text style={s.inlineActionText}>{action}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

// ── Quick action chips ─────────────────────────────────────────────────────────

function QuickActionChips({ onSend }: { onSend: (query: string) => void }) {
  return (
    <View style={s.suggestions}>
      <Text style={s.suggestionsLabel}>Try asking</Text>
      <View style={s.suggestionsRow}>
        {QUICK_ACTIONS.map(action => (
          <TouchableOpacity
            key={action.query}
            style={ss.chip}
            onPress={() => onSend(action.query)}
            activeOpacity={0.72}
          >
            <Text style={ss.chipText}>{action.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function AITab() {
  const insets = useSafeAreaInsets();

  const [messages,     setMessages]    = useState<Message[]>([INITIAL_MESSAGE]);
  const [historyOpen,  setHistoryOpen] = useState(false);
  const [isTyping,     setIsTyping]    = useState(false);

  const sendFlag  = useAiChatStore(s => s.sendFlag);
  const lastSent  = useAiChatStore(s => s.lastSent);
  const setInput  = useAiChatStore(s => s.setInput);
  const sendDirect = useAiChatStore(s => s.sendDirect);

  const scrollRef = useRef<ScrollView>(null);

  // Auto-scroll whenever messages list or typing state changes
  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages, isTyping]);

  // ── Core send handler ──────────────────────────────────────────────────────
  const processMessage = useCallback(async (text: string) => {
    if (!text.trim()) return;
    if (!(await aiConsentService.requestConsent())) return;

    const userMsg: Message = { id: uid(), role: 'user', text };
    setMessages(prev => [...prev, userMsg]);
    setIsTyping(true);

    aiService.sendMessage(text)
      .then((response) => {
        const aiMsg: Message = {
          id:               uid(),
          role:             'ai',
          text:             response.message,
          suggestedRecipes: response.suggestedRecipes ?? [],
          quickActions:     response.quickActions ?? [],
        };

        setMessages(prev => [...prev, aiMsg]);
      })
      .catch(() => {
        const aiMsg: Message = {
          id:   uid(),
          role: 'ai',
          text: 'I could not reach Friyo AI right now. Please check your connection and try again.',
        };
        setMessages(prev => [...prev, aiMsg]);
      })
      .finally(() => setIsTyping(false));
  }, []);

  // ── Listen to sends from the shared input bar (in _layout.tsx) ────────────
  useEffect(() => {
    if (sendFlag === 0 || !lastSent.trim()) return;
    processMessage(lastSent);
  }, [sendFlag]);

  // ── Quick action handler ──────────────────────────────────────────────────
  const handleQuickAction = useCallback((query: string) => {
    processMessage(query);
  }, [processMessage]);

  // ── Start cooking navigation ──────────────────────────────────────────────
  const handleStartCooking = useCallback((recipe: AIRecipeSuggestion) => {
    Alert.alert(
      recipe.title,
      [
        `Time: ${recipe.cookingTime}`,
        `Difficulty: ${recipe.difficulty}`,
        '',
        ...recipe.stepsPreview.map((step, index) => `${index + 1}. ${step}`),
      ].join('\n'),
    );
  }, []);

  const SCROLL_BOTTOM_PAD = insets.bottom + 150;

  return (
    <View style={s.root}>
      {/* Soft yellow glow behind header */}
      <View style={s.bgGlow} />

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <View style={[s.header, { paddingTop: insets.top + 10 }]}>
        <GlassButton
          variant="circular"
          size={42}
          icon="bubble.left.and.bubble.right"
          iconSize={17}
          iconColor="rgba(0,0,0,0.72)"
          onPress={() => setHistoryOpen(true)}
          accent
        />

        <GlassButton
          label="Get Pro"
          icon="sparkles"
          iconSize={14}
          iconColor="rgba(0,0,0,0.72)"
          iconWeight="fill"
          size={36}
          onPress={() => Alert.alert('Friyo Pro', 'Unlimited AI chats, advanced nutrition analysis, and more.\n\nComing soon!')}
          accent
          style={s.proBtn}
          textStyle={s.proBtnText}
        />

        <View style={s.headerRight}>
          <Image
            source={require('../../assets/images/mascot-chat.png')}
            style={s.mascot}
            resizeMode="contain"
          />
        </View>
      </View>

      {/* ── Chat area ───────────────────────────────────────────────────── */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          ref={scrollRef}
          style={s.chatArea}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[s.chatContent, { paddingBottom: SCROLL_BOTTOM_PAD }]}
          keyboardDismissMode="on-drag"
        >
          {messages.map(msg => (
            <MessageBubble
              key={msg.id}
              msg={msg}
              onStartCooking={handleStartCooking}
              onQuickAction={processMessage}
            />
          ))}

          {/* Typing indicator */}
          {isTyping && <TypingIndicator />}

          {/* Quick action chips — only on fresh conversation (no user messages yet) */}
          {messages.length === 1 && !isTyping && (
            <QuickActionChips onSend={handleQuickAction} />
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Chat history sheet ────────────────────────────────────────── */}
      <ChatHistorySheet
        visible={historyOpen}
        onClose={() => setHistoryOpen(false)}
        records={[]}
        onSelect={rec => {
          setHistoryOpen(false);
          sendDirect(rec.preview);
        }}
      />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.cream },

  bgGlow: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 200,
    backgroundColor: 'rgba(245,216,75,0.12)',
  },

  // Header
  header:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 10, gap: 10 },
  proBtn:      { flex: 1, maxWidth: 120, alignSelf: 'center' },
  proBtnText:  { fontSize: 13, fontFamily: 'DMSans_700Bold', letterSpacing: 0.2 },
  headerRight: { width: 42, alignItems: 'center', justifyContent: 'center' },
  mascot:      { width: 34, height: 34 },

  // Chat
  chatArea:    { flex: 1 },
  chatContent: { paddingHorizontal: 16, paddingTop: 8, gap: 12 },

  // Message layout
  bubbleRow:     { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  bubbleRowUser: { justifyContent: 'flex-end' },
  bubbleRowAI:   { justifyContent: 'flex-start', alignItems: 'flex-start' },
  avatar:        { width: 28, height: 28, marginBottom: 2, flexShrink: 0 },
  aiContent:     { flex: 1, gap: 8, maxWidth: '88%' },

  bubble: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleUser: {
    backgroundColor:       Colors.yellow,
    borderBottomRightRadius: 4,
    alignSelf:             'flex-end',
    maxWidth:              '82%',
  },
  bubbleAI: {
    backgroundColor:     Colors.white,
    borderBottomLeftRadius: 4,
    shadowColor:         '#000',
    shadowOffset:        { width: 0, height: 2 },
    shadowOpacity:       0.07,
    shadowRadius:        8,
    elevation:           3,
  },
  bubbleText:     { fontSize: 14, fontFamily: 'DMSans_400Regular', color: Colors.black, lineHeight: 21 },
  bubbleTextUser: { fontFamily: 'DMSans_500Medium' },

  inlineActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  inlineActionChip: {
    backgroundColor: Colors.white,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: Colors.borderGray,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  inlineActionText: { fontSize: 12, fontFamily: 'DMSans_500Medium', color: Colors.black },

  // Typing indicator
  typingRow: { flexDirection: 'row', gap: 4, alignItems: 'center', paddingVertical: 2 },
  typingDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: Colors.gray },

  // Suggestions
  suggestions:      { marginTop: 4, gap: 10 },
  suggestionsLabel: { fontSize: 11, fontFamily: 'DMSans_500Medium', color: 'rgba(0,0,0,0.38)', letterSpacing: 0.5, textTransform: 'uppercase' },
  suggestionsRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});

const ss = StyleSheet.create({
  chip: {
    backgroundColor: Colors.white,
    borderRadius:    50,
    paddingHorizontal: 14,
    paddingVertical:   9,
    borderWidth:     1,
    borderColor:     Colors.borderGray,
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: 1 },
    shadowOpacity:   0.05,
    shadowRadius:    4,
    elevation:       2,
  },
  chipText: { fontSize: 13, fontFamily: 'DMSans_500Medium', color: Colors.black },
});
