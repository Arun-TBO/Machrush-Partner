import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  Animated,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, Radius } from '@/lib/theme';

import { verifyOTP, resendOTP } from '@/lib/firebaseAuthService'; // Real Firebase

const RESEND_OTP_SECONDS = 40;

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
  const [otp, setOtp] = useState(['', '', '', '', '', '']); // 6-digit OTP
  const [isLoading, setIsLoading] = useState(false);
  const [resendCount, setResendCount] = useState(0);
  const [canResend, setCanResend] = useState(false);
  const [resendTimer, setResendTimer] = useState(RESEND_OTP_SECONDS);
  const insets = useSafeAreaInsets();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const inputRefs = useRef<(TextInput | null)[]>([null, null, null, null, null, null]);

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
      Alert.alert('Invalid OTP', 'Please enter the complete 6-digit verification code');
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
      Alert.alert(
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
      Alert.alert(
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
        { opacity: fadeAnim, paddingTop: insets.top },
      ]}
    >
      {/* Status Bar */}
      <View style={styles.statusBar}>
      
      </View>

      {/* Main Content */}
      <View style={styles.contentContainer}>
        <View style={styles.otpContainer}>
          {/* Title and Description */}
          <View style={styles.headerContainer}>
            <Text style={styles.title}>Verify Your Number</Text>
            <View style={styles.descriptionContainer}>
              <Text style={styles.description}>6-digit code sent to </Text>
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
                textAlign="center"
              />
            ))}
          </View>
        </View>

        <View style={styles.actionContainer}>
          {/* Verify & Continue Button */}
          <Pressable
            style={[
              styles.verifyButton,
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
            <Text style={styles.timerText}>{canResend ? '00:00' : formattedResendTimer}</Text>
            <Pressable
              onPress={handleResendOTP}
              disabled={!canResend || isLoading}
              style={styles.resendButton}
            >
              <Text style={[
                styles.resendOtpText,
                (!canResend || isLoading) && styles.resendOtpTextDisabled,
              ]}>
                Resend OTP
              </Text>
            </Pressable>
          </View>
        </View>
      </View>

      <View style={styles.navigation}>
        <View style={styles.homeIndicator} />
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#eff2f6', // neutral bg-color from design
    justifyContent: 'space-between',
    paddingBottom: 0,
  },

  // Status Bar
  statusBar: {
    height: 52,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 10,
    justifyContent: 'space-between',
    alignItems: 'center',
    flexDirection: 'row',
  },
  statusTime: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.neutral900,
    fontFamily: 'Poppins',
  },
  statusIcons: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  statusIcon: {
    fontSize: 16,
    color: Colors.neutral900,
  },

  // Content Container
  contentContainer: {
    flex: 1,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingTop: 40,
    gap: 40,
  },

  // Header Container
  otpContainer: {
    width: '100%',
    gap: 16,
  },
  headerContainer: {
    gap: 12,
  },
  title: {
    color: '#1c1c1c',
    fontFamily: 'Poppins_500Medium',
    fontSize: 40,
    fontWeight: '500',
    lineHeight: 48,
    letterSpacing: 0,
  },
  descriptionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  description: {
    color: '#606060',
    fontFamily: 'Poppins_500Medium',
    fontSize: 18,
    fontWeight: '500',
    lineHeight: 18,
    letterSpacing: 0,
  },
  phoneNumberLink: {
    color: '#0055cc',
    fontFamily: 'Poppins_500Medium',
    fontSize: 18,
    fontWeight: '500',
    lineHeight: 18,
    textDecorationLine: 'underline',
  },

  // OTP Input Container
  otpInputContainer: {
    flexDirection: 'row',
    gap: 8, // mini-2 from design
    justifyContent: 'flex-start',
    alignItems: 'center',
  },

  // OTP Input Fields
  otpInput: {
    width: 52,
    height: 60,
    backgroundColor: 'white',
    borderRadius: Radius.md,
    color: '#1c1c1c',
    fontFamily: 'Poppins_500Medium',
    fontSize: 24,
    fontWeight: '500',
    textAlign: 'center',
    borderWidth: 0,
  },
  otpInputFilled: {
    borderColor: Colors.primary,
  },

  // Verify & Continue Button
  actionContainer: {
    width: '100%',
    height: 148,
    gap: 24,
  },
  verifyButton: {
    height: 56,
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  verifyButtonDisabled: {
    backgroundColor: '#A4A4A4',
  },
  verifyButtonText: {
    color: '#ffffff',
    fontFamily: 'Poppins_500Medium',
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 16,
    letterSpacing: -0.5,
  },

  // Footer Container
  footerContainer: {
    width: '100%',
    height: 40,
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
    color: '#0055cc',
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 16,
    textAlign: 'center',
  },
  resendOtpTextDisabled: {
    color: '#a4a4a4',
  },

  // Timer Text
  timerText: {
    color: '#0055cc',
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 16,
  },
  navigation: {
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeIndicator: {
    width: 108,
    height: 4,
    borderRadius: 12,
    backgroundColor: '#1d1b20',
  },
});
