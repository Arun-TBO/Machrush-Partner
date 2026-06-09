
import React, { useState, useRef, useEffect } from 'react';
import { Image, type ImageSource } from 'expo-image';
import { StatusBar } from 'expo-status-bar';

import { Animated, Dimensions, PanResponder, Pressable, StyleSheet, Text, View ,SafeAreaView } from 'react-native';


import IMAGES from '../constants/walkthroughImg/images';

import { fs, hit, rs, vs } from '@/lib/responsive';


const { height: screenHeight  , width} = Dimensions.get('window');

const SHEET_HEIGHT = 374;
const imageHeight = Math.max(screenHeight - SHEET_HEIGHT + 24, 543);

import { MobileNumberVerification } from './MobileNumberVerification';


const steps: WalkthroughContent[] = [
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


interface WalkthroughContent {
  id: number;
  title: string;
  description: string;
  image?: any;
  isLogoScreen?: boolean;
}



interface WalkthroughScreenProps {
  onComplete?: () => void;
  onSkip?: () => void;
}

export const WalkthroughScreen: React.FC<WalkthroughScreenProps> = ({
  onComplete,
  onSkip,
}) => {
  // const router = useRouter();
  const [activeIndex, setActiveIndex] = useState(0);
  const activeStep = steps[activeIndex];
  const isFinalStep = Boolean(activeStep.isLogoScreen);
  
 const scaleAnim = useRef(new Animated.Value(0.95)).current;
 const fadeAnim = useRef(new Animated.Value(0)).current;
 const logoTranslateX = useRef(new Animated.Value(-150)).current;
 const logoTranslateY = useRef(new Animated.Value(-250)).current;
 const textTranslateY = useRef(new Animated.Value(120)).current;
 const logoPositionAnim = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;

  const [showVerification, setShowVerification] = useState(false); 

  useEffect(() => {
    // Fade in + Zoom in parallel
    fadeAnim.setValue(5);
    scaleAnim.setValue(1.20);
    logoTranslateX.setValue(-200);
    logoTranslateY.setValue(-250);
    textTranslateY.setValue(150);
    const isLogoScreen = isFinalStep;
    
    if (isLogoScreen) {
      // Screen 3: Logo moves from top-left to center
      // Initial position: top-left corner (16, 30) - where logo appears on screens 1-2
      // Target position: center (0, 0)
      const initialX = 16 - width / 2;  // From left edge to center
      const initialY = 30 - screenHeight / 2; // From top edge to center
      
      logoPositionAnim.setValue({ x: initialX, y: initialY });
      Animated.parallel([
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1200,
      useNativeDriver: true,
    }),

    // Logo top -> center
     Animated.timing(logoTranslateX, {
      toValue: 0,
      duration: 1500,
      useNativeDriver: true,
    }),

    Animated.timing(logoTranslateY, {
      toValue: 0,
      duration: 1500,
      useNativeDriver: true,
    }),

    // Text bottom -> center
    Animated.timing(textTranslateY, {
      toValue: 0,
      duration: 1600,
      useNativeDriver: true,
    }),
    
  ]).start();

      
    } else {
      // Screens 1-2: Normal animation
      logoPositionAnim.setValue({ x: 0, y: 0 });
     scaleAnim.setValue(1.2);

Animated.parallel([
  Animated.timing(fadeAnim, {
    toValue: 1,
    duration: 400,
    useNativeDriver: true,
  }),

  Animated.sequence([
  

    Animated.timing(scaleAnim, {
      toValue: 1.3,
      duration: 3000, // slow zoom in
      useNativeDriver: true,
    }),
  ]),
]).start();
    }
  }, [activeIndex, scaleAnim, fadeAnim, logoPositionAnim, isFinalStep]);
  
  const panResponder = useRef(
  PanResponder.create({
    onMoveShouldSetPanResponder: (_, gestureState) => {
      return Math.abs(gestureState.dx) > 20;
    },

    onPanResponderRelease: (_, gestureState) => {
      // LEFT SWIPE
      if (gestureState.dx < -50) {
        setActiveIndex((prev) =>
          Math.min(prev + 1, steps.length - 1)
        );
      }

      // RIGHT SWIPE
      if (gestureState.dx > 50) {
        setActiveIndex((prev) =>
          Math.max(prev - 1, 0)
        );
      }
    },
  })
).current;
 

  const goNext = () => {
    console.log(isFinalStep)
    if (isFinalStep) {
      setShowVerification(true);
    

    }

    setActiveIndex((currentIndex) => Math.min(currentIndex + 1, steps.length - 1));
  };

  const skip = () => {
      console.log('got to mobile-number screen')
      setShowVerification(true);
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
          <>
           <StatusBar  translucent
  backgroundColor="transparent"
 /> 

 <MobileNumberVerification
        onVerify={handleVerificationComplete}
        onBack={() => setShowVerification(false)}
      />
          </>
      
    ) : (
      
        <View style={styles.screen}   {...panResponder.panHandlers}>
         <StatusBar  translucent
  backgroundColor="transparent"
 />
       
      

      <View style={[styles.visualArea, isFinalStep && styles.finalVisualArea]}>
        {
          activeIndex <= 1 &&  <Image source={IMAGES.machrushMark} style={styles.appLogo}/>
        }
       
        {activeStep.image ? (
           <Animated.View style={[
            { 
              transform: [{ scale: scaleAnim }],
              opacity: fadeAnim,
            }
          ]}>
          <Image source={activeStep.image} style={styles.heroImage} contentFit="cover" />
          </Animated.View>
          
        ) : (
          <View style={styles.finalLogoWrap}>
            <Animated.Image source={IMAGES.appLogo} style={[styles.finalLogo , {
                    opacity: fadeAnim,
                    transform: [
                      { translateX: logoTranslateX },
                      { translateY: logoTranslateY },
                    ],
                  },]} />
            <Animated.Text style={[styles.machrushText, {
                  opacity: fadeAnim,
                  transform: [{ translateY: textTranslateY }],
                },]}> MACHRUSH</Animated.Text>
          </View>
        )}
      </View>

      <View style={styles.sheet}>
        <View style={styles.sheetHandleWrap}>
          <View style={styles.sheetHandle} />
        </View>
       
            
            <View style={styles.dotsContainer}> 
           
            <View style={styles.dots}>
            {steps.map((step, index) => (
              <View
                key={step.title}
                style={[styles.dot, index === activeIndex && styles.activeDot]}
              />
            ))}
          </View>

            </View>
          

        <View style={styles.copyBlock}>
          <Text style={styles.title}>{activeStep.title}</Text>
          <Text style={styles.description}>{activeStep.description}</Text>
        </View>
          
       
        <View style={styles.footer}>
        

          <View style={styles.actions}>
            {!isFinalStep ? (
              <Pressable onPress={skip} style={({ pressed }) => [styles.textButton, pressed && styles.pressed]}>
                <Text style={styles.skipText}>Skip</Text>
              </Pressable>
            ) : null}

            <Pressable onPress={goNext} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
              <Text style={styles.primaryText}>{isFinalStep ? 'Get Started' : 'Continue'}</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.navigation}>
       
        </View>
      </View>

     
    </View>
    )

        
  );
}

export default  WalkthroughScreen
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#eff2f6',
  },
  appLogo : {
    position: 'absolute',
    top:  68,
    left: 16,
    width: 63.48,
    height: 54.56,
    opacity: 0.92,
    zIndex: 5,
  },
  visualArea: {
    height: imageHeight,
    overflow: 'hidden',
    backgroundColor: '#dce5f1',
  },
  finalVisualArea: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  finalLogoWrap: {  
    height : '100%',
    width : '100%',
    flexDirection : 'column',
    justifyContent : 'center',
    alignItems : 'center',
    backgroundColor : '#EFF2F6',
  },
  finalLogo: {
   height : 103,
   width : 120
  },
  machrushText: {
    fontSize: 40,
    fontWeight: '600',
    color: '#0055CC',
    letterSpacing: 1,
    textAlign: 'center',
    flexWrap: 'nowrap',
  },
  sheet: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    left: 0,
    height: SHEET_HEIGHT,
    paddingHorizontal: 16,
    paddingBottom: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: '#ffffff',
    gap: 16,
    zIndex: 10,
    elevation: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
  },
  sheetHandleWrap: {
    height: 18,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 10,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 100,
    backgroundColor: 'rgba(41,41,43,0.05)',
  },
  brandMark: {
    width: 76,
    height: 36,
  },
  copyBlock: {
    minHeight: 121,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 40,
  },
  title: {
    color: '#4a4a4a',
    fontFamily: 'Poppins_500Medium',
    fontSize: fs(24),
    textAlign : 'center',
    letterSpacing : -1
  },
  description: {
    color: '#777777',
    fontFamily: 'Poppins_400Regular',
    fontSize: fs(18),
    textAlign : 'center',
  },
  footer: {
    marginTop: 'auto',
    gap: 24,
  },
  dotsContainer : {
    flexDirection : 'column',
    alignItems : 'center',
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 12,
    backgroundColor: '#d9d9d9',
  },
  activeDot: {
    width: 80,
    backgroundColor: '#0055cc',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    position : 'absolute',
    bottom : 0,

  },
  textButton: {
    width: 120,
    minHeight: 56,
    flexDirection : 'column',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderColor: '#0055cc',
    borderWidth : 1,
  
  },
  skipText: {
    color: '#606060',
    fontFamily: 'Poppins_500Medium',
    fontSize: fs(16),
    lineHeight : 16,
    letterSpacing: -0.5,
    width : '100%',
    textAlign : 'center'
  },
  primaryButton: {
    flex: 1,
    minHeight: 56,
    flexDirection : 'column',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: '#0055cc',
  },
  primaryText: {
    color: '#ffffff',
    fontFamily: 'Poppins_500Medium',
    fontSize: fs(16),
    lineHeight: 16,
    letterSpacing: -0.5,
    width : '100%',
    textAlign : 'center'
  },
  pressed: {
    opacity: 0.82,
  },
  homeIndicator: {
    width: 108,
    height: 4,
    borderRadius: 12,
    backgroundColor: '#29292b',
  },
  navigation: {
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
