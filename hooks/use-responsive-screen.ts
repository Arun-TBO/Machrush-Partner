import { useEffect, useMemo, useState } from 'react';
import { Dimensions, Platform, NativeModules, KeyboardEvent } from 'react-native';

export const useResponsiveScreen = () => {
  const [dimensions, setDimensions] = useState(() => Dimensions.get('window'));
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  // Track dimension changes (rotation, split-screen)
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setDimensions(window);
    });

    return () => subscription?.remove?.();
  }, []);

  // Get iOS status bar height
  const statusBarHeight = useMemo(() => {
    if (Platform.OS !== 'ios') return 0;
    const { StatusBarManager } = NativeModules;
    return StatusBarManager?.HEIGHT ?? 44;
  }, []);

  // Track keyboard on iOS
  useEffect(() => {
    if (Platform.OS !== 'ios') return;

    const keyboardWillShow = Keyboard.addListener(
      'keyboardWillShow',
      (event: KeyboardEvent) => {
        setKeyboardHeight(event.endCoordinates.height);
        setIsKeyboardVisible(true);
      }
    );

    const keyboardWillHide = Keyboard.addListener(
      'keyboardWillHide',
      () => {
        setKeyboardHeight(0);
        setIsKeyboardVisible(false);
      }
    );

    return () => {
      keyboardWillShow.remove();
      keyboardWillHide.remove();
    };
  }, []);

  return {
    width: dimensions.width,
    height: dimensions.height,
    statusBarHeight,
    keyboardHeight,
    isKeyboardVisible,
    isIOS: Platform.OS === 'ios',
    isAndroid: Platform.OS === 'android',
    // Safe area with keyboard consideration
    bottomInset: Platform.select({
      ios: keyboardHeight > 0 ? keyboardHeight - 34 : 0, // 34 is home indicator
      android: keyboardHeight,
    }),
  };
};