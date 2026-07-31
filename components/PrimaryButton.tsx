import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  GestureResponderEvent,
  Platform,
} from 'react-native';
import { Colors, Spacing, Radius, Typography } from '@/lib/theme';
import { hit, rs } from '@/lib/responsive';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

interface PrimaryButtonProps {
  label: string;
  onPress: (event: GestureResponderEvent) => void;
  variant?: ButtonVariant;
  style?: ViewStyle;
  textStyle?: TextStyle;
  disabled?: boolean;
  fullWidth?: boolean;
  size?: 'small' | 'medium' | 'large';
}

export const PrimaryButton: React.FC<PrimaryButtonProps> = ({
  label,
  onPress,
  variant = 'primary',
  style,
  textStyle,
  disabled = false,
  fullWidth = false,
  size = 'medium',
}) => {
  const isSecondary = variant === 'secondary';
  const isGhost = variant === 'ghost';
  const isSmall = size === 'small';
  const isLarge = size === 'large';

  const buttonStyles = [
    styles.container,
    isSecondary ? styles.secondary : styles.primary,
    isGhost ? styles.ghost : {},
    isSmall ? styles.small : {},
    isLarge ? styles.large : {},
    fullWidth ? styles.fullWidth : {},
    disabled ? styles.disabled : {},
    style,
  ];

  const textStyles = [
    styles.text,
    Typography.button,
    isSecondary ? styles.textSecondary : styles.textPrimary,
    isGhost ? styles.textGhost : {},
    isSmall ? Typography.buttonSmall : {},
    disabled ? styles.textDisabled : {},
    textStyle,
  ];

  return (
    <TouchableOpacity
      style={buttonStyles}
      onPress={onPress}
      activeOpacity={0.8}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      accessibilityLabel={label}
    >
      <Text style={textStyles} numberOfLines={1}>
        {label}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.xs,
    borderRadius: Radius.md,
    // iOS requires minimum 44pt touch target
    minHeight: hit(44),
    paddingHorizontal: rs(16),
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  small: {
    minHeight: hit(36),
    paddingHorizontal: rs(12),
    paddingVertical: rs(8),
  },
  medium: {
    minHeight: hit(48),
    paddingVertical: rs(12),
  },
  large: {
    minHeight: hit(56),
    paddingVertical: rs(16),
  },
  fullWidth: {
    width: '100%',
  },
  primary: {
    flex: 1,
    backgroundColor: Colors.primary,
  },
  secondary: {
    minWidth: rs(100),
    borderWidth: rs(1.5),
    borderColor: Colors.primary,
    backgroundColor: 'transparent',
  },
  ghost: {
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    flexShrink: 1,
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
  textGhost: {
    color: Colors.primary,
  },
  textDisabled: {
    color: Colors.neutral600,
  },
});
