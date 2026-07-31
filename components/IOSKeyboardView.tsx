import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Platform, KeyboardAvoidingView, Keyboard, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { vs, rs } from '@/lib/responsive';

interface IOSKeyboardViewProps {
  children: React.ReactNode;
  style?: any;
  contentContainerStyle?: any;
  behavior?: 'padding' | 'height' | 'position';
  enabled?: boolean;
}

export const IOSKeyboardView: React.FC<IOSKeyboardViewProps> = ({
  children,
  style,
  contentContainerStyle,
  behavior = 'padding',
  enabled = true,
}) => {
  const insets = useSafeAreaInsets();
  const isIOS = Platform.OS === 'ios';

  if (!isIOS || !enabled) {
    return (
      <View style={[styles.container, style]}>
        <View style={[styles.content, contentContainerStyle]}>{children}</View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, style]}
      behavior={behavior}
      keyboardVerticalOffset={vs(64)}
    >
      <View style={[styles.content, contentContainerStyle]}>{children}</View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
});