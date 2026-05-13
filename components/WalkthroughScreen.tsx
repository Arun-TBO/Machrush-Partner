import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Image,
  ScrollView,
  SafeAreaView,
  PanResponder,
  GestureResponderEvent,
  PanResponderGestureState,
  Animated,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, Radius, Shadows } from '@/lib/theme';
import { ProgressIndicator } from './ProgressIndicator';
import { PrimaryButton } from './PrimaryButton';
import { MobileNumberVerification } from './MobileNumberVerification';

const { width, height } = Dimensions.get('window');

// Logo asset
const LOGO = require('@/assets/images/Logo.png');

// Arrow Icon Component
const ArrowIcon = () => (
  <Text style={{ fontSize: 20, color: Colors.neutral100 }}>→</Text>
);

interface WalkthroughContent {
  id: number;
  title: string;
  description: string;
  image?: any;
  isLogoScreen?: boolean;
}

const WALKTHROUGH_SCREENS: WalkthroughContent[] = [
  {
    id: 1,
    title: 'Find delivery jobs near you',
    description:
      'Get material pickup requests from verified manufacturers in your area. Work when you want, earn every trip',
    image: require('@/assets/images/walkthrough1.png'),
  },
  {
    id: 2,
    title: 'Earn money every trip',
    description: 'Get paid instantly for every successful delivery. No hidden charges or delays.',
    image: require('@/assets/images/walkthrough2.png'),
  },
  {
    id: 3,
    title: 'The fastest way to move manufacturing jobs',
    description: 'Connect with manufacturers. Deliver materials. Earn more every day.',
    image: undefined,
    isLogoScreen: true,
  },
];

interface WalkthroughScreenProps {
  onComplete?: () => void;
  onSkip?: () => void;
}

export const WalkthroughScreen: React.FC<WalkthroughScreenProps> = ({
  onComplete,
  onSkip,
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [showVerification, setShowVerification] = useState(false);
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const logoPositionAnim = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const insets = useSafeAreaInsets();
  const screen = WALKTHROUGH_SCREENS[currentStep];
  
  // Combined animation: Zoom + Fade + Logo position
  useEffect(() => {
    // Fade in + Zoom in parallel
    fadeAnim.setValue(0);
    scaleAnim.setValue(0.95);
    
    const isLogoScreen = screen.isLogoScreen;
    
    if (isLogoScreen) {
      // Screen 3: Logo moves from top-left to center
      // Initial position: top-left corner (16, 30) - where logo appears on screens 1-2
      // Target position: center (0, 0)
      const initialX = 16 - width / 2;  // From left edge to center
      const initialY = 30 - height / 2; // From top edge to center
      
      logoPositionAnim.setValue({ x: initialX, y: initialY });
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(logoPositionAnim, {
          toValue: { x: 0, y: 0 },
          duration: 1000,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Screens 1-2: Normal animation
      logoPositionAnim.setValue({ x: 0, y: 0 });
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [currentStep, scaleAnim, fadeAnim, logoPositionAnim, screen.isLogoScreen]);
  
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderRelease: (evt: GestureResponderEvent, gestureState: PanResponderGestureState) => {
        const { dx } = gestureState;
        const swipeThreshold = 50;

        // Swipe left: go to previous screen
        if (dx < -swipeThreshold && currentStep > 0) {
          setCurrentStep(currentStep - 1);
        }
        // Swipe right: go to next screen
        else if (dx > swipeThreshold && currentStep < WALKTHROUGH_SCREENS.length - 1) {
          setCurrentStep(currentStep + 1);
        }
      },
    })
  ).current;

  const handleNext = () => {
    if (currentStep < WALKTHROUGH_SCREENS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      // On screen 3, show the verification screen instead of completing
      setShowVerification(true);
    }
  };

  const handleSkip = () => {
    onSkip?.();
  };

  const handleVerificationComplete = (mobileNumber: string) => {
    // Mobile number verification done
    console.log('Mobile number verified:', mobileNumber);
    // Call onComplete to dismiss walkthrough and proceed to main app
    onComplete?.();
  };

  return (
    showVerification ? (
      <MobileNumberVerification
        onVerify={handleVerificationComplete}
        onBack={() => setShowVerification(false)}
      />
    ) : (
      <SafeAreaView style={[styles.container, { paddingTop: insets.top }]} {...panResponder.panHandlers}>
      <ScrollView
        scrollEnabled={false}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Hero Image Section - Only for screens 1-2 */}
        {!screen.isLogoScreen && (
          <Animated.View style={[
            styles.heroSection, 
            { 
              transform: [{ scale: scaleAnim }],
              opacity: fadeAnim,
            }
          ]}>
            {screen.image ? (
              <Image
                source={screen.image}
                style={styles.heroImage}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.heroPlaceholder} />
            )}
            
            {/* Logo Overlay - Top Left for screens 1-2 */}
            <Image
              source={LOGO}
              style={styles.logoOverlay}
              resizeMode="contain"
            />
          </Animated.View>
        )}
        
        {/* Logo Center Section - Only for screen 3 */}
        {screen.isLogoScreen && (
          <Animated.View style={[
            styles.logoCenterContainer,
            {
              opacity: fadeAnim,
              transform: [
                { translateX: logoPositionAnim.x },
                { translateY: logoPositionAnim.y },
              ],
            },
          ]}>
            <Image
              source={LOGO}
              style={[styles.logoCenterImage, { tintColor: Colors.primary }]}
              resizeMode="contain"
            />
            <Text style={styles.machrushText}>MACHRUSH</Text>
          </Animated.View>
        )}

        {/* Bottom Sheet Section */}
        <View style={[styles.bottomSheet, Shadows.default]}>
          {/* Handle */}
          <View style={styles.handleContainer}>
            <View style={styles.handle} />
          </View>

          {/* Progress Indicator */}
          <View style={styles.indicatorContainer}>
            <ProgressIndicator total={WALKTHROUGH_SCREENS.length} current={currentStep} />
          </View>

          {/* Content */}
          <View style={styles.contentContainer}>
            <View style={styles.textContainer}>
              <Text style={styles.title}>{screen.title}</Text>
              <Text style={styles.description}>{screen.description}</Text>
            </View>
          </View>
          {/* Buttons */}
          <View style={styles.buttonsContainer}>
            {currentStep === WALKTHROUGH_SCREENS.length - 1 ? (
              <Pressable style={styles.getStartedButtonContainer} onPress={handleNext}>
                <View style={styles.getStartedButton}>
                  <Text style={styles.getStartedButtonText}>Get Started</Text>
                  <ArrowIcon />
                </View>
              </Pressable>
            ) : (
              <>
                <PrimaryButton label="Skip" onPress={handleSkip} variant="secondary" />
                <PrimaryButton
                  label="Continue"
                  onPress={handleNext}
                  variant="primary"
                />
              </>
            )}
          </View>

          {/* Navigation Handle */}
        </View>
      </ScrollView>
    </SafeAreaView>
    )
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.neutral100,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flex: 1,
    position: 'relative',
  },

  // Hero Section
  heroSection: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    top: 0,
    left: 0,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.neutral100,
    overflow: 'hidden',
  },
  heroImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  heroPlaceholder: {
    width: '100%',
    height: '100%',
    position: 'absolute',
    backgroundColor: '#D9D9D9',
  },
  logoOverlay: {
    position: 'absolute',
    top: Spacing.md + 4,
    left: Spacing.sm,
    width: 65,
    height: 55,
    opacity: 0.8,
    zIndex: 5,
  },
  statusBar: {
    position: 'absolute',
    top: Spacing.md,
    left: Spacing.sm,
    zIndex: 10,
  },
  timeText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.neutral100,
    letterSpacing: 0.01,
  },

  // Bottom Sheet
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.neutral100,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.sm,
    paddingBottom: Spacing.md,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: Spacing.xs,
    maxHeight: '50%',
    zIndex: 20,
  },

  // Handle
  handleContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: 18,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(41, 41, 43, 0.05)',
  },

  // Progress Indicator
  indicatorContainer: {
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },

  // Content
  contentContainer: {
    display: 'flex',
    paddingVertical: Spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.md,
    width: '100%',
  },
  textContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    width: '100%',
    paddingHorizontal: Spacing.sm,
  },
  title: {
    fontSize: 24,
    fontWeight: '500',
    color: Colors.neutral900,
    letterSpacing: -1,
    textAlign: 'center',
  },
  description: {
    fontSize: 18,
    fontWeight: '400',
    color: Colors.neutral700,
    textAlign: 'center',
    lineHeight: 24,
  },

  // Buttons
  buttonsContainer: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.xs,
    alignSelf: 'stretch',
    paddingHorizontal: Spacing.xs,
    marginBottom: Spacing.md,
  },
  getStartedButtonContainer: {
    flex: 1,
  },
 getStartedButton: {
  backgroundColor: Colors.primary,
  borderRadius: 10, // increase this
  paddingHorizontal: Spacing.lg,
  paddingVertical: Spacing.md,
  flexDirection: 'row',
  justifyContent: 'center',
  alignItems: 'center',
  gap: Spacing.xs,
},
  getStartedButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.neutral100,
    letterSpacing: -0.5,
  },

  // Logo Center (Screen 3)
  logoCenterContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -120,
    marginTop: -230,
    zIndex: 10,
    width: 240,
  },
  logoCenterImage: {
    width: 100,
    height: 100,
    marginBottom: Spacing.lg,
    resizeMode: 'contain',
  },
  machrushText: {
    fontSize: 40,
    fontWeight: '600',
    color: Colors.primary,
    letterSpacing: 1,
    textAlign: 'center',
    flexWrap: 'nowrap',
  },

  // Navigation
  navigationHandle: {
    width: 108,
    height: 4,
    borderRadius: Radius.full,
    backgroundColor: '#29292B',
  },
});
