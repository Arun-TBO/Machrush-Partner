import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  Animated,
  Dimensions,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Radius } from '@/lib/theme';
import { useAppAlert } from './AppAlertModal';

import { verifyOTP, resendOTP } from '@/lib/firebaseAuthService'; // Real Firebase

const BASE_WIDTH = 390;
const MAX_TABLET_WIDTH = 480;
const RESEND_OTP_SECONDS = 30;

const rf = (size: number) => {
  const { width } = Dimensions.get('window');
  const scale = Math.min(width, MAX_TABLET_WIDTH) / BASE_WIDTH;
  return Math.round(size * scale);
};
const fs = rf;

interface OTPVerificationProps {
  mobileNumber: string;
  onVerify?: (result: { uid: string; phoneNumber: string; idToken: string; otp: string }) => void;
  onChangeNumber?: () => void;
  onResendOTP?: () => void;
}

export const OTPVerification: React.FC<OTPVerificationProps> = ({
  mobileNumber,
  onVerify,
  onChangeNumber,
  onResendOTP,
}) => {
  const { height, width } = useWindowDimensions();
  const [otp, setOtp] = useState(['', '', '', '', '', '']); // 6-digit OTP
  const [isLoading, setIsLoading] = useState(false);
  const [resendCount, setResendCount] = useState(0);
  const [canResend, setCanResend] = useState(false);
  const [resendTimer, setResendTimer] = useState(RESEND_OTP_SECONDS);
  const insets = useSafeAreaInsets();
  const { alertModal, showAlert } = useAppAlert();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const inputRefs = useRef<(TextInput | null)[]>([null, null, null, null, null, null]);
  const horizontalPadding = 32;
  const otpGap = 8;
  const otpInputSize = Math.floor(
    Math.min(52, Math.max(40, (width - horizontalPadding - otpGap * (otp.length - 1)) / otp.length))
  );
  const isCompactHeight = height < 760;

  // Fade in animation on mount
  useEffect(() => {
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  // Resend timer with countdown
  useEffect(() => {
    if (!canResend) {
      setResendTimer(RESEND_OTP_SECONDS);
      const interval = setInterval(() => {
        setResendTimer((prev) => {
          if (prev <= 1) {
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [canResend]);

  const formattedResendTimer = `00:${String(resendTimer).padStart(2, '0')}`;

  const handleOtpInput = (index: number, value: string) => {
    // Only allow numbers
    if (!/^[0-9]*$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value.slice(-1); // Keep only last character
    setOtp(newOtp);

    // Move to next field
    if (value && index < 5) { // 6 fields total (0-5)
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpBackspace = (index: number, value: string) => {
    if (!value && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const otpString = otp.join('');
  const isOtpComplete = otpString.length === 6; // 6-digit OTP

  const handleVerifyAndContinue = async () => {
    if (!isOtpComplete) {
      showAlert('Invalid OTP', 'Please enter the complete 6-digit verification code');
      return;
    }

    setIsLoading(true);
    try {
      console.log('🔐 Verifying OTP with Firebase:', otpString);
      
      // Verify OTP with Firebase
      const result = await verifyOTP(otpString);
      
      console.log('✅ OTP verified successfully');
      console.log('User UID:', result.uid);
      console.log('Phone Number:', result.phoneNumber);
      
      // Call the parent's onVerify callback with complete result
      if (onVerify) {
        onVerify({
          uid: result.uid,
          phoneNumber: result.phoneNumber,
          idToken: result.idToken,
          otp: otpString,
        });
      }
    } catch (error: any) {
      console.error('❌ Error verifying OTP:', error);
      showAlert(
        'Verification Failed',
        error.message || 'Invalid OTP. Please check and try again.'
      );
      // Clear OTP input on error
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setCanResend(false);
    setResendCount(resendCount + 1);
    
    try {
      console.log('📱 Resending OTP...');
      
      // Call resendOTP function from Firebase service
      await resendOTP();
      
      console.log('✅ OTP resent successfully');
      
      // Reset OTP input
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
      
      if (onResendOTP) {
        onResendOTP();
      }
    } catch (error: any) {
      console.error('❌ Error resending OTP:', error);
      showAlert(
        'Resend Failed',
        error.message || 'Failed to resend OTP. Please try again.'
      );
      // Allow user to try again
      setCanResend(true);
      setResendTimer(0);
    }
  };

  return (
    <Animated.View
      style={[
        styles.container,
        { opacity: fadeAnim },
      ]}
    >
      {/* Main Content */}
      <View style={[styles.contentContainer, isCompactHeight && styles.compactContent]}>
        <View style={styles.otpContainer}>
          {/* Title and Description */}
          <View style={styles.headerContainer}>
            <Text style={styles.title}>Verify Your Number</Text>
            <View style={styles.descriptionContainer}>
              <Text style={styles.description}>6-digit code sent to</Text>
              <Pressable onPress={onChangeNumber}>
                <Text style={styles.phoneNumberLink}>{mobileNumber}</Text>
              </Pressable>
            </View>
          </View>

          {/* OTP Input Fields */}
          <View style={styles.otpInputContainer}>
            {otp.map((digit, index) => (
              <TextInput
                key={index}
                ref={(ref) => {
                  inputRefs.current[index] = ref;
                }}
                style={[
                  styles.otpInput,
                  { width: otpInputSize },
                  digit && styles.otpInputFilled,
                  
                ]}
                value={digit}
                onChangeText={(value) => handleOtpInput(index, value)}
                onKeyPress={({ nativeEvent }) => {
                  if (nativeEvent.key === 'Backspace') {
                    handleOtpBackspace(index, digit);
                  }
                }}
                keyboardType="number-pad"
                maxLength={1}
                editable={!isLoading}
                
                placeholderTextColor={Colors.neutral700}
                 textAlign = 'center'
                 textAlignVertical = 'center' // Android
               

              />
            ))}
          </View>
        </View>

        <View style={styles.actionContainer}>
          {/* Verify & Continue Button */}
          <Pressable
            style={[
              styles.verifyButton,
              isOtpComplete && styles.verifyButtonActive,
              (!isOtpComplete || isLoading) && styles.verifyButtonDisabled,
            ]}
            onPress={handleVerifyAndContinue}
            disabled={!isOtpComplete || isLoading}
          >
            <Text style={styles.verifyButtonText}>
              {isLoading ? 'Verifying...' : 'Verify & Continue'}
            </Text>
          </Pressable>

          {/* Footer Actions */}
          <View style={styles.footerContainer}>
            <Text style={styles.timerText}>{canResend ? '' : formattedResendTimer}</Text>
            <Pressable
              onPress={handleResendOTP}
              disabled={!canResend || isLoading}
              style={styles.resendButton}
            >
              <Text style={[
                styles.resendOtpText,
                canResend && !isLoading && styles.resendOtpTextActive,
              ]}>
                Resend OTP
              </Text>
            </Pressable>
          </View>
        </View>
      </View>

     
      {alertModal}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#eff2f6', // neutral bg-color from design
   
  },

  // Content Container
  contentContainer: {
    flex: 1,
    width: '100%',
    maxWidth: 430,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingTop: 94,
    gap: 40,
    marginTop : 52
  },
  compactContent: {
    gap: 32,
   
  },

  // Header Container
  otpContainer: {
    width: '100%',
    gap: 16,
  },
  headerContainer: {
    gap: 10,
  },
  title: {
    color: '#1c1c1c',
    fontFamily: 'Poppins_500Medium',
    fontSize: fs(40),
    fontWeight: '500',
    lineHeight: 48,
    letterSpacing: 0,
  },
  descriptionContainer: {
    width : '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    
  },
  description: {
    flexShrink: 1,
    color: '#606060',
    fontFamily: 'Poppins_500Medium',
    fontSize: fs(17),
    fontWeight: '500',
    letterSpacing: 0,
  },
  phoneNumberLink: {
    flexShrink: 1,
    color: '#0055cc',
    fontFamily: 'Poppins_500Medium',
    fontSize: fs(17),
    fontWeight: '500',
    lineHeight: 18,
    textDecorationLine: 'underline',
    letterSpacing: 0,
  },

  // OTP Input Container
  otpInputContainer: {
    width: '100%',
    minHeight: 60,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'flex-start',
    alignItems: 'center',
    
  },

  // OTP Input Fields
  otpInput: {
    flexShrink: 0,
    maxWidth: 52,
    minHeight: 60,
    margin: 0,
    backgroundColor: 'white',
    borderRadius: Radius.md,
    color: '#1c1c1c',
    fontFamily: 'Poppins_500Medium',
    fontSize: 24,
    fontWeight: '500',
    lineHeight: 28,
    textAlign: 'center',
    textAlignVertical: 'center',
    paddingTop: 0,
    paddingBottom: 0,
    paddingHorizontal: 0,
    borderWidth: 0,
    // flexDirection : 'column',
    // justifyContent : 'center',
    // alignItems : 'center'
  },
  otpInputFilled: {
    borderColor: Colors.primary,
  },

  // Verify & Continue Button
  actionContainer: {
    width: '100%',
    minHeight: 148,
    gap: 24,
  },
  verifyButton: {
    minHeight: 56,
    backgroundColor: '#a4a4a4',
    borderRadius: Radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  verifyButtonDisabled: {
    backgroundColor: '#A4A4A4',
  },
  verifyButtonActive: {
    backgroundColor: Colors.primary,
  },
  verifyButtonText: {
    flexShrink: 1,
    color: '#ffffff',
    fontFamily: 'Poppins_500Medium',
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 20,
    letterSpacing: -0.5,
  },

  // Footer Container
  footerContainer: {
    width: '100%',
    minHeight: 40,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  resendButton: {
    minHeight: 40,
    justifyContent: 'center',
  },

  // Resend OTP Link
  resendOtpText: {
    flexShrink: 1,
    color: '#a4a4a4',
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 20,
    textAlign: 'center',
  },
  resendOtpTextDisabled: {
    color: '#a4a4a4',
  },
  resendOtpTextActive: {
    color: '#0055cc',
  },

  // Timer Text
  timerText: {
    flexShrink: 1,
    color: '#0055cc',
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 20,
  },
  homeIndicator: {
    position: 'absolute',
    left: '50%',
    width: 139,
    height: 5,
    marginLeft: -69.5,
    borderRadius: 100,
    backgroundColor: '#212121',
  },
});
