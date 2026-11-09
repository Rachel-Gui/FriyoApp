import React, { forwardRef } from 'react';
import { Text as NativeText, TextInput as NativeTextInput, TouchableOpacity as NativeTouchableOpacity, Alert as NativeAlert, type TextProps, type TextInputProps, type TouchableOpacityProps } from 'react-native';
import { useLanguageStore } from '@/store/languageStore';
import { translateUI } from '@/services/uiLanguage';

// Only the supplied UI label is translated. Input values and handlers stay intact.
export const LocalizedText = forwardRef<React.ComponentRef<typeof NativeText>, TextProps & { translate?: boolean }>(function LocalizedText({ children, translate = true, ...props }, ref) {
  const language = useLanguageStore(state => state.language);
  return <NativeText {...props} ref={ref} accessibilityLabel={props.accessibilityLabel && translateUI(props.accessibilityLabel, language)}>{translate ? React.Children.map(children, child => typeof child === 'string' ? translateUI(child, language) : child) : children}</NativeText>;
});
export const LocalizedTextInput = forwardRef<React.ComponentRef<typeof NativeTextInput>, TextInputProps>(function LocalizedTextInput(props, ref) {
  const language = useLanguageStore(state => state.language);
  return <NativeTextInput {...props} ref={ref} placeholder={props.placeholder && translateUI(props.placeholder, language)} accessibilityLabel={props.accessibilityLabel && translateUI(props.accessibilityLabel, language)} />;
});
export const LocalizedTouchableOpacity = forwardRef<React.ComponentRef<typeof NativeTouchableOpacity>, TouchableOpacityProps>(function LocalizedTouchableOpacity(props, ref) {
  const language = useLanguageStore(state => state.language);
  return <NativeTouchableOpacity {...props} ref={ref} accessibilityLabel={props.accessibilityLabel && translateUI(props.accessibilityLabel, language)} />;
});
export const LocalizedAlert: typeof NativeAlert = {
  ...NativeAlert,
  alert(title, message, buttons, options) {
    const language = useLanguageStore.getState().language;
    NativeAlert.alert(translateUI(title, language), message && translateUI(message, language), buttons?.map(button => ({ ...button, text: button.text && translateUI(button.text, language) })), options);
  },
};
