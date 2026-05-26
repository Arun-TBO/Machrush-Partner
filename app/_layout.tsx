import AsyncStorage from '@react-native-async-storage/async-storage';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import 'react-native-reanimated';

import { WalkthroughScreen } from '@/components/WalkthroughScreen';
import { useColorScheme } from '@/hooks/use-color-scheme';

// Initialize Firebase
import { auth } from '@/lib/firebase';

export const unstable_settings = {
  anchor: '(tabs)',
};

/**
 * Attempt to resolve a valid Firebase uid — checks currentUser,
 * refreshes token if needed, falls back to AsyncStorage.
 */
async function resolveAuthenticatedUid(): Promise<string | null> {
  // 1. Use the Firebase SDK currentUser
  if (auth.currentUser) {
    try {
      // Force token refresh to confirm the session is still valid
      await auth.currentUser.getIdToken(true);
      return auth.currentUser.uid;
    } catch {
      // Token refresh failed — user may have been disabled / session expired
      // Fall through to AsyncStorage fallback
    }
  }

  // 2. Fallback: check stored uid from a previous REST-based login
  try {
    const storedUid = await AsyncStorage.getItem('firebaseUid');
    if (storedUid) return storedUid;
  } catch {
    // Storage read error — not fatal, treat as unauthenticated
  }

  return null;
}

function LoadingScreen() {
  return (
    <View style={authStyles.loading}>
      <ActivityIndicator size="large" color="#0052cc" />
    </View>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const segments = useSegments();

  const [showWalkthrough, setShowWalkthrough] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  // ── Check walkthrough status (unchanged) ──
  useEffect(() => {
    checkWalkthroughStatus();
  }, []);

  const checkWalkthroughStatus = async () => {
    try {
      const TEST_MODE = true;
      if (TEST_MODE) {
        setShowWalkthrough(true);
      } else {
        const completed = await AsyncStorage.getItem('walkthroughCompleted');
        setShowWalkthrough(completed !== 'true');
      }
    } catch {
      setShowWalkthrough(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleWalkthroughComplete = async () => {
    try {
      await AsyncStorage.setItem('walkthroughCompleted', 'true');
      setShowWalkthrough(false);
    } catch {
      setShowWalkthrough(false);
    }
  };

  // ── Auth guard ──
  // After walkthrough is done, run auth check once
  useEffect(() => {
    if (showWalkthrough) {
      // Don't run auth check while walkthrough is shown
      return;
    }

    let cancelled = false;

    const checkAuth = async () => {
      const uid = await resolveAuthenticatedUid();
      if (cancelled) return;
      setIsAuthenticated(!!uid);
    };

    checkAuth();

    return () => {
      cancelled = true;
    };
  }, [showWalkthrough]);

  // ── Redirect based on auth state ──
  useEffect(() => {
    if (isAuthenticated === null) return; // still checking

    if (!isAuthenticated) {
      // Not authenticated → redirect to phone-number screen
      // Only redirect if we're not already there
      if (segments[0] !== 'phone-number') {
        router.replace('/phone-number');
      }
    } else {
      // Authenticated → if we're on the phone-number screen, go to tabs
      if (segments[0] === 'phone-number') {
        router.replace('/(tabs)');
      }
    }
  }, [isAuthenticated, segments]);

  // ── Loading state ──
  if (isLoading) {
    return <LoadingScreen />;
  }

  // ── Walkthrough ──
  if (showWalkthrough) {
    return (
      <>
        <WalkthroughScreen
          onComplete={handleWalkthroughComplete}
          onSkip={handleWalkthroughComplete}
        />
        <StatusBar style="auto" />
      </>
    );
  }

  // ── Auth loading ──
  if (isAuthenticated === null) {
    return <LoadingScreen />;
  }

  // ── App ──
  // NOTE: All Stack.Screen components must be unconditional.
  // Auth gating is done via the redirect effect above, not by removing screens.
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="profile" options={{ headerShown: false }} />
        <Stack.Screen name="documents" options={{ headerShown: false }} />
        <Stack.Screen name="bank-details" options={{ headerShown: false }} />
        <Stack.Screen name="vehicle-details" options={{ headerShown: false }} />
        <Stack.Screen name="delivery-details" options={{ headerShown: false }} />
        <Stack.Screen name="report-problem" options={{ headerShown: false }} />
        <Stack.Screen name="phone-number" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

const authStyles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
});
