// Theme tokens from Figma design - Responsive
import { rs, vs, fs } from './responsive';

export const Colors = {
  primary: '#05C',
  neutral900: '#4A4A4A',
  neutral800: '#606060',
  neutral700: '#777',
  neutral600: '#9D9D9D',
  neutral300: '#E0E0E0',
  neutral200: '#F0F0F0',
  neutral100: '#FFF',
  overlay: 'rgba(0, 0, 0, 0.1)',
  shadow: 'rgba(0, 0, 0, 0.10)',
};

export const Spacing = {
  xs: rs(4),
  sm: rs(8),
  md: rs(12),
  lg: rs(16),
  xl: rs(24),
  xxl: rs(32),
};

export const Radius = {
  sm: rs(6),
  md: rs(8),
  lg: rs(12),
  xl: rs(16),
  full: 100,
};

export const Typography = {
  h1: {
    fontFamily: 'Poppins_700Bold',
    fontSize: fs(32, 28, 36),
    letterSpacing: -1.2,
    lineHeight: fs(40, 36, 44),
  },
  h2: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: fs(24, 20, 28),
    letterSpacing: -0.8,
    lineHeight: fs(32, 28, 36),
  },
  h3: {
    fontFamily: 'Poppins_500Medium',
    fontSize: fs(20, 18, 22),
    letterSpacing: -0.6,
    lineHeight: fs(28, 24, 32),
  },
  title: {
    fontFamily: 'Poppins_500Medium',
    fontSize: fs(24, 20, 28),
    letterSpacing: -1,
    lineHeight: fs(32, 28, 36),
  },
  subtitle: {
    fontFamily: 'Poppins_400Regular',
    fontSize: fs(18, 16, 20),
    lineHeight: fs(26, 22, 30),
  },
  body: {
    fontFamily: 'Poppins_400Regular',
    fontSize: fs(16, 14, 18),
    lineHeight: fs(24, 20, 28),
  },
  bodySmall: {
    fontFamily: 'Poppins_400Regular',
    fontSize: fs(14, 12, 16),
    lineHeight: fs(20, 18, 24),
  },
  caption: {
    fontFamily: 'Poppins_400Regular',
    fontSize: fs(12, 10, 14),
    lineHeight: fs(18, 16, 20),
  },
  button: {
    fontFamily: 'Poppins_500Medium',
    fontSize: fs(16, 14, 18),
    letterSpacing: -0.5,
    lineHeight: fs(24, 20, 28),
  },
  buttonSmall: {
    fontFamily: 'Poppins_500Medium',
    fontSize: fs(14, 12, 16),
    letterSpacing: -0.3,
    lineHeight: fs(20, 18, 24),
  },
};

export const Shadows = {
  default: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: vs(2) },
    shadowOpacity: 0.1,
    shadowRadius: vs(8),
    elevation: vs(4),
  },
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: vs(4) },
    shadowOpacity: 0.08,
    shadowRadius: vs(12),
    elevation: vs(4),
  },
};
