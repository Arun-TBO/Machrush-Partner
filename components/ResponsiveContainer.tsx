import React from 'react';
import { View, StyleSheet, Platform, Dimensions, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAvoidingView } from 'react-native';
import { rs, vs, fs } from '@/lib/responsive';
import { Spacing, Colors } from '@/lib/theme';

interface ResponsiveContainerProps {
  children: React.ReactNode;
  style?: any;
  contentContainerStyle?: any;
  backgroundColor?: string;
  withKeyboardAvoiding?: boolean;
  keyboardAvoidingBehavior?: 'padding' | 'height' | 'position';
  scrollable?: boolean;
  safeAreaTop?: boolean;
  safeAreaBottom?: boolean;
  maxWidth?: number; // For iPad/tablet
}

export const ResponsiveContainer: React.FC<ResponsiveContainerProps> = ({
  children,
  style,
  contentContainerStyle,
  backgroundColor = Colors.neutral200,
  withKeyboardAvoiding = false,
  keyboardAvoidingBehavior = 'padding',
  scrollable = false,
  safeAreaTop = true,
  safeAreaBottom = true,
  maxWidth = 720,
}) => {
  const insets = useSafeAreaInsets();
  const { width } = Dimensions.get('window');
  const isIOS = Platform.OS === 'ios';

  const Container = scrollable ? ScrollView : View;
  const containerProps = scrollable
    ? {
        contentContainerStyle: [
          styles.content,
          { paddingHorizontal: width > maxWidth ? rs(24) : rs(16) },
          contentContainerStyle,
        ],
        showsVerticalScrollIndicator: false,
      }
    : {
        style: [
          styles.content,
          { paddingHorizontal: width > maxWidth ? rs(24) : rs(16) },
          contentContainerStyle,
        ],
      };

  const content = (
    <View
      style={[
        styles.container,
        {
          backgroundColor,
          paddingTop: safeAreaTop ? Math.max(insets.top, vs(24)) : 0,
          paddingBottom: safeAreaBottom ? Math.max(insets.bottom, vs(16)) : 0,
        },
        style,
      ]}
    >
      <Container {...containerProps}>{children}</Container>
    </View>
  );

  if (withKeyboardAvoiding && isIOS) {
    return (
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={keyboardAvoidingBehavior}
        keyboardVerticalOffset={Platform.select({ ios: vs(64), android: 0 })}
      >
        {content}
      </KeyboardAvoidingView>
    );
  }

  return content;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
  },
  content: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
});