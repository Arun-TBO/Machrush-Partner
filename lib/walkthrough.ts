import { View, Text, StyleSheet, Dimensions, ScrollView } from 'react-native';
import { Colors, Spacing, Radius } from './theme';

const { width, height } = Dimensions.get('window');

// Design tokens from Figma
export const DESIGN_TOKENS = {
  colors: {
    primary: Colors.primary,
    neutral900: Colors.neutral900,
    neutral800: Colors.neutral800,
    neutral700: Colors.neutral700,
    neutral100: Colors.neutral100,
  },
  spacing: {
    xs: Spacing.xs,
    sm: Spacing.sm,
    md: Spacing.md,
    lg: Spacing.lg,
    xl: Spacing.xl,
  },
  radius: {
    md: Radius.md,
    lg: Radius.lg,
  },
};

// Walkthrough Screen 1 - Delivery Jobs
const WalkthroughScreen1 = {
  title: 'Find delivery jobs near you',
  description: 'Get material pickup requests from verified manufacturers in your area. Work when you want, earn every trip',
  image: require('@/assets/images/walkthrough-1.png'),
  step: 0,
};

// Export for use
export default DESIGN_TOKENS;
export { WalkthroughScreen1 };
