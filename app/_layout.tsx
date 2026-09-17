import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import 'react-native-reanimated';
import { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { WalkthroughScreen } from '@/components/WalkthroughScreen';
import { SuspendedScreen } from '@/components/SuspendedScreen';
import { MobileNumberVerification } from '@/components/MobileNumberVerification';
import { getDriverEntryScreen, OnboardingSession } from '@/lib/driverEntry';
import { refreshSession } from '@/lib/session';
import { getDriverProfile, getVerificationStatus } from '@/lib/firestoreOnboardingService';



// Initialize Firebase
import '@/lib/firebase';

const APP_BACKGROUND = '#eff2f6';
const DEFAULT_FONT_STYLE = { fontFamily: 'Poppins_400Regular', includeFontPadding: true };

SystemUI.setBackgroundColorAsync(APP_BACKGROUND);

(Text as any).defaultProps = (Text as any).defaultProps || {};
(Text as any).defaultProps.allowFontScaling = false;
(Text as any).defaultProps.maxFontSizeMultiplier = 1;
(Text as any).defaultProps.style = [DEFAULT_FONT_STYLE, (Text as any).defaultProps.style];
(TextInput as any).defaultProps = (TextInput as any).defaultProps || {};
(TextInput as any).defaultProps.allowFontScaling = false;
(TextInput as any).defaultProps.maxFontSizeMultiplier = 1;
(TextInput as any).defaultProps.style = [DEFAULT_FONT_STYLE, (TextInput as any).defaultProps.style];

const appLightTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: APP_BACKGROUND,
    card: APP_BACKGROUND,
  },
};
const appDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: APP_BACKGROUND,
    card: APP_BACKGROUND,
  },
};

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const pathname = usePathname();
  const [fontsLoaded] = useFonts({
    Poppins: require('../Poppins/Poppins-Regular.ttf'),
    Poppins_100Thin: require('../Poppins/Poppins-Thin.ttf'),
    Poppins_200ExtraLight: require('../Poppins/Poppins-ExtraLight.ttf'),
    Poppins_300Light: require('../Poppins/Poppins-Light.ttf'),
    Poppins_400Regular: require('../Poppins/Poppins-Regular.ttf'),
    Poppins_500Medium: require('../Poppins/Poppins-Medium.ttf'),
    Poppins_600SemiBold: require('../Poppins/Poppins-SemiBold.ttf'),
    Poppins_700Bold: require('../Poppins/Poppins-Bold.ttf'),
    Poppins_800ExtraBold: require('../Poppins/Poppins-ExtraBold.ttf'),
    Poppins_900Black: require('../Poppins/Poppins-Black.ttf'),
  });
  const [showWalkthrough, setShowWalkthrough] = useState(true);
  const [resumeSession, setResumeSession] = useState<OnboardingSession | null>(null);
  const [startupError, setStartupError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isAccountSuspended, setIsAccountSuspended] = useState(false);

  useEffect(() => {
    checkWalkthroughStatus();
  }, []);

  useEffect(() => {
    if (isLoading || showWalkthrough || pathname === '/phone-number') {
      return;
    }

    let isActive = true;

    const checkSuspendedStatus = async () => {
      const [storedUid, storedIdToken] = await Promise.all([
        AsyncStorage.getItem('firebaseUid'),
        AsyncStorage.getItem('firebaseIdToken'),
      ]);

      if (!storedUid) {
        if (isActive) {
          setIsAccountSuspended(false);
        }
        return;
      }

      const verificationStatus = await getVerificationStatus(storedUid, storedIdToken || undefined);

      if (isActive) {
        setIsAccountSuspended(verificationStatus?.status === 'suspended');
      }
    };

    checkSuspendedStatus();
    const interval = setInterval(checkSuspendedStatus, 5000);

    return () => {
      isActive = false;
      clearInterval(interval);
    };
  }, [isLoading, pathname, showWalkthrough]);

  const checkWalkthroughStatus = async () => {
    setIsLoading(true);
    setStartupError(false);
    setShowWalkthrough(true);
    setResumeSession(null);
    try {
      // Firebase proves phone ownership, not completion of driver onboarding.
      // Ignore legacy walkthroughCompleted values (Skip used to set this flag).
      const session = await refreshSession();
      if (!session.uid || session.sessionExpired) return;
      if (!session.idToken) throw new Error('Unable to restore driver session');
      const phoneNumber = await AsyncStorage.getItem('firebasePhoneNumber') || '';
      let profile = await getDriverProfile(session.uid, session.idToken, true);
      if (!profile && phoneNumber) {
        profile = await getDriverProfile(phoneNumber, session.idToken, true);
      }
      const screen = getDriverEntryScreen(profile);
      setIsAccountSuspended(screen === 'suspended');
      if (screen === 'home') {
        setShowWalkthrough(false);
      } else if (phoneNumber || profile?.phoneNumber) {
        setResumeSession({
          uid: session.uid,
          idToken: session.idToken,
          phoneNumber: profile?.phoneNumber || phoneNumber,
          screen,
        });
      }
    } catch (error) {
      console.error('Error checking driver onboarding:', error);
      setStartupError(true);
    } finally {
      setIsLoading(false);
    }
  };

  // Recheck the backend even when a child requests access to the app.
  const handleWalkthroughComplete = () => checkWalkthroughStatus();

  if (isLoading || !fontsLoaded) {
    return null; // Or show a loading screen
  }

  if (isAccountSuspended) {
    return (
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <SuspendedScreen />
      </SafeAreaProvider>
    );
  }

  if (startupError) {
    return (
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: APP_BACKGROUND }}>
          <Text>Unable to check your onboarding status. Please check your connection and try again.</Text>
          <Pressable accessibilityRole="button" onPress={checkWalkthroughStatus} style={{ paddingVertical: 20 }}>
            <Text style={{ color: '#0055cc' }}>Try again</Text>
          </Pressable>
        </View>
      </SafeAreaProvider>
    );
  }

  if (showWalkthrough) {
    return (
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        {resumeSession ? (
          <MobileNumberVerification
            initialSession={resumeSession}
            onVerify={handleWalkthroughComplete}
          />
        ) : (
          <WalkthroughScreen onComplete={handleWalkthroughComplete} />
        )}
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <ThemeProvider value={colorScheme === 'dark' ? appDarkTheme : appLightTheme}>
        <Stack screenOptions={{ contentStyle: { backgroundColor: APP_BACKGROUND } }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="profile" options={{ headerShown: false }} />
          <Stack.Screen name="documents" options={{ headerShown: false }} />
          <Stack.Screen name="bank-details" options={{ headerShown: false }} />
          <Stack.Screen name="vehicle-details" options={{ headerShown: false }} />
          <Stack.Screen name="my-deliveries" options={{ headerShown: false }} />
          <Stack.Screen name="accepted-trip" options={{ headerShown: false }} />
          <Stack.Screen name="payment-received" options={{ headerShown: false }} />
          <Stack.Screen name="payment-pending" options={{ headerShown: false }} />
          <Stack.Screen name="cancelled-delivery" options={{ headerShown: false }} />
          <Stack.Screen name="report-problem" options={{ headerShown: false }} />
          <Stack.Screen name="phone-number" options={{ headerShown: false }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
