import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { WalkthroughScreen } from '@/components/WalkthroughScreen';

// Initialize Firebase
import '@/lib/firebase';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [showWalkthrough, setShowWalkthrough] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkWalkthroughStatus();
  }, []);

  const checkWalkthroughStatus = async () => {
    try {
      // FOR TESTING: Set to true to always show walkthrough
      const TEST_MODE = true;
      
      if (TEST_MODE) {
        setShowWalkthrough(true);
      } else {
        const completed = await AsyncStorage.getItem('walkthroughCompleted');
        if (completed === 'true') {
          setShowWalkthrough(false);
        } else {
          setShowWalkthrough(true);
        }
      }
    } catch (error) {
      console.error('Error checking walkthrough status:', error);
      setShowWalkthrough(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleWalkthroughComplete = async () => {
    try {
      await AsyncStorage.setItem('walkthroughCompleted', 'true');
      setShowWalkthrough(false);
    } catch (error) {
      console.error('Error saving walkthrough status:', error);
      setShowWalkthrough(false);
    }
  };

  if (isLoading) {
    return null; // Or show a loading screen
  }

  if (showWalkthrough) {
    return (
      <WalkthroughScreen
        onComplete={handleWalkthroughComplete}
        onSkip={handleWalkthroughComplete}
      />
    );
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="profile" options={{ headerShown: false }} />
        <Stack.Screen name="documents" options={{ headerShown: false }} />
        <Stack.Screen name="bank-details" options={{ headerShown: false }} />
        <Stack.Screen name="vehicle-details" options={{ headerShown: false }} />
        <Stack.Screen name="report-problem" options={{ headerShown: false }} />
        <Stack.Screen name="phone-number" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
