import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  GestureResponderEvent,
} from 'react-native';
import { Colors, Spacing, Radius, Typography } from '@/lib/theme';

export type ButtonVariant = 'primary' | 'secondary';

interface PrimaryButtonProps {
  label: string;
  onPress: (event: GestureResponderEvent) => void;
  variant?: ButtonVariant;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export const PrimaryButton: React.FC<PrimaryButtonProps> = ({
  label,
  onPress,
  variant = 'primary',
  style,
  textStyle,
}) => {
  const isSecondary = variant === 'secondary';

  return (
    <TouchableOpacity
      style={[
        styles.container,
        isSecondary ? styles.secondary : styles.primary,
        style,
      ]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text
        style={[
          styles.text,
          isSecondary ? styles.textSecondary : styles.textPrimary,
          textStyle,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    display: 'flex',
    padding: Spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.xs,
    borderRadius: Radius.md,
    minHeight: 48,
  },
  primary: {
    flex: 1,
    backgroundColor: Colors.primary,
  },
  secondary: {
    width: 120,
    borderWidth: 1,
    borderColor: Colors.primary,
    backgroundColor: 'transparent',
  },
  text: {
    fontSize: 16,
    fontWeight: '500',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  textPrimary: {
    color: Colors.neutral100,
  },
  textSecondary: {
    color: Colors.neutral800,
  },
});
