/**
 * WALKTHROUGH SCREEN INTEGRATION GUIDE
 * 
 * How to integrate the Figma-designed walkthrough into your Expo app
 */

// OPTION 1: Add to App Navigation (Recommended)
// ==============================================

// In app/(tabs)/_layout.tsx or your root navigation:

import { WalkthroughScreen } from '@/components/WalkthroughScreen';
import { Stack } from 'expo-router';

export default function RootLayout() {
  // Check if user has seen walkthrough
  const [hasSeenWalkthrough, setHasSeenWalkthrough] = useState(false);
  
  if (!hasSeenWalkthrough) {
    return (
      <WalkthroughScreen
        onComplete={() => {
          setHasSeenWalkthrough(true);
          // Save to AsyncStorage or Firebase
        }}
        onSkip={() => {
          setHasSeenWalkthrough(true);
        }}
      />
    );
  }

  return (
    <Stack>
      {/* Your app screens */}
    </Stack>
  );
}

// OPTION 2: Add as a Route
// ========================

// In your app routing (e.g., app/walkthrough.tsx):

import { WalkthroughScreen } from '@/components/WalkthroughScreen';
import { useRouter } from 'expo-router';

export default function WalkthroughRoute() {
  const router = useRouter();

  return (
    <WalkthroughScreen
      onComplete={() => router.push('/(tabs)')}
      onSkip={() => router.push('/(tabs)')}
    />
  );
}

// OPTION 3: Use as Modal
// ======================

import { WalkthroughScreen } from '@/components/WalkthroughScreen';
import { Modal } from 'react-native';

export default function App() {
  const [showWalkthrough, setShowWalkthrough] = useState(true);

  return (
    <>
      <Modal
        visible={showWalkthrough}
        animationType="slide"
        onRequestClose={() => setShowWalkthrough(false)}
      >
        <WalkthroughScreen
          onComplete={() => setShowWalkthrough(false)}
          onSkip={() => setShowWalkthrough(false)}
        />
      </Modal>
      {/* Your main app content */}
    </>
  );
}

// OPTION 4: Persistent State (Firebase/AsyncStorage)
// ===================================================

import AsyncStorage from '@react-native-async-storage/async-storage';

// Check if user has completed walkthrough
async function checkWalkthroughStatus() {
  try {
    const completed = await AsyncStorage.getItem('walkthroughCompleted');
    return completed === 'true';
  } catch (error) {
    console.error('Error reading walkthrough status:', error);
    return false;
  }
}

// Save completion status
async function markWalkthroughCompleted() {
  try {
    await AsyncStorage.setItem('walkthroughCompleted', 'true');
  } catch (error) {
    console.error('Error saving walkthrough status:', error);
  }
}

// In your component:
import { useEffect, useState } from 'react';

export default function App() {
  const [showWalkthrough, setShowWalkthrough] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkWalkthroughStatus().then(completed => {
      setShowWalkthrough(!completed);
      setIsLoading(false);
    });
  }, []);

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (showWalkthrough) {
    return (
      <WalkthroughScreen
        onComplete={() => {
          markWalkthroughCompleted();
          setShowWalkthrough(false);
        }}
        onSkip={() => {
          markWalkthroughCompleted();
          setShowWalkthrough(false);
        }}
      />
    );
  }

  return <YourMainApp />;
}

// CUSTOMIZING THE WALKTHROUGH
// ============================

// To modify screens, edit WALKTHROUGH_SCREENS in WalkthroughScreen.tsx:

const WALKTHROUGH_SCREENS = [
  {
    id: 1,
    title: 'Your Custom Title',
    description: 'Your custom description',
    image: require('@/assets/images/custom-image.png'),
  },
  // Add more screens here
];

// STYLING CUSTOMIZATION
// ======================

// Edit theme.ts to customize colors:
export const Colors = {
  primary: '#05C',        // Change primary color
  neutral900: '#4A4A4A',  // Change text colors
  // ... other colors
};

// TESTING THE COMPONENT
// ======================

// Create a test screen to preview walkthrough:

// app/preview/walkthrough.tsx
import { WalkthroughScreen } from '@/components/WalkthroughScreen';
import { useRouter } from 'expo-router';

export default function WalkthroughPreview() {
  const router = useRouter();

  return (
    <WalkthroughScreen
      onComplete={() => {
        console.log('Walkthrough completed');
        router.back();
      }}
      onSkip={() => {
        console.log('Walkthrough skipped');
        router.back();
      }}
    />
  );
}

// Then access: yourapp://preview/walkthrough
