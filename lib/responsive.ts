import { Dimensions, PixelRatio, Platform, NativeModules } from 'react-native';
import { useWindowDimensions } from 'react-native';

// Base guideline (iPhone 14 Pro / 14 Pro Max portrait)
const guidelineWidth = 393;
const guidelineHeight = 852;

// Detect initial screen dimensions
const initialWindow = Dimensions.get('window');
const initialWidth = initialWindow.width;
const initialHeight = initialWindow.height;
const isTablet = initialWidth >= 768 || initialHeight >= 768;
const isSmallScreen = Math.min(initialWidth, initialHeight) < 340;

// iOS-specific adjustments
const isIOS = Platform.OS === 'ios';
const { StatusBarManager } = NativeModules;
const STATUS_BAR_HEIGHT = isIOS ? (StatusBarManager?.HEIGHT ?? 44) : 0;

export const useResponsive = () => {
  const { width, height } = useWindowDimensions();
  const shortestSide = Math.min(width, height);
  const longestSide = Math.max(width, height);
  const isLandscape = width > height;

  return {
    width,
    height,
    shortestSide,
    longestSide,
    isLandscape,
    isTablet: isTablet || width >= 768,
    isSmallScreen: isSmallScreen || shortestSide < 340,
    isIOS,
    statusBarHeight: STATUS_BAR_HEIGHT,
  };
};

export const isCompactDevice = isSmallScreen;

export const clamp = (value: number, min: number, max: number) => {
  return Math.min(Math.max(value, min), max);
};

// Responsive scaling based on window width
export const rs = (
  size: number,
  min?: number,
  max?: number
): number => {
  const defaultMin = size * 0.82;
  const defaultMax = size * 1.18;
  return PixelRatio.roundToNearestPixel(
    clamp(
      (Dimensions.get('window').width / guidelineWidth) * size,
      min ?? defaultMin,
      max ?? defaultMax
    )
  );
};

// Responsive scaling based on window height
export const vs = (
  size: number,
  min?: number,
  max?: number
): number => {
  const defaultMin = size * 0.82;
  const defaultMax = size * 1.18;
  return PixelRatio.roundToNearestPixel(
    clamp(
      (Dimensions.get('window').height / guidelineHeight) * size,
      min ?? defaultMin,
      max ?? defaultMax
    )
  );
};

// Responsive font scaling
export const fs = (
  size: number,
  min?: number,
  max?: number
): number => {
  const defaultMin = size * 0.86;
  const defaultMax = size * 1.12;
  return PixelRatio.roundToNearestPixel(
    clamp(
      (Dimensions.get('window').width / guidelineWidth) * size,
      min ?? defaultMin,
      max ?? defaultMax
    )
  );
};

// Minimum touch target for iOS
export const hit = (size: number): number => {
  return Math.max(44, rs(size));
};
