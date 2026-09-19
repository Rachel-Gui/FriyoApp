import { create } from 'zustand';

interface AiChatState {
  input:       string;
  isRecording: boolean;
  sendFlag:    number;
  lastSent:    string;
}

interface AiChatActions {
  setInput:       (v: string) => void;
  setIsRecording: (v: boolean) => void;
  /** Atomically captures input as lastSent, clears input, bumps sendFlag. */
  bumpSend:       () => void;
  /** Bypasses the input field — sends `text` directly (used by quick-action chips). */
  sendDirect:     (text: string) => void;
}

export const useAiChatStore = create<AiChatState & AiChatActions>((set) => ({
  input:       '',
  isRecording: false,
  sendFlag:    0,
  lastSent:    '',

  setInput:       (v)  => set({ input: v }),
  setIsRecording: (v)  => set({ isRecording: v }),
  bumpSend:            () => set((s) => ({
    sendFlag: s.sendFlag + 1,
    lastSent: s.input,
    input:    '',
  })),
  sendDirect:     (text) => set((s) => ({
    sendFlag: s.sendFlag + 1,
    lastSent: text,
    input:    '',
  })),
}));
