import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  Dimensions,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, Radius } from '@/lib/theme';

const { width } = Dimensions.get('window');

interface OTPVerificationProps {
  mobileNumber: string;
  onVerify?: (otp: string) => void;
  onChangeNumber?: () => void;
  onResendOTP?: () => void;
}

export const OTPVerification: React.FC<OTPVerificationProps> = ({
  mobileNumber,
  onVerify,
  onChangeNumber,
  onResendOTP,
}) => {
  const [otp, setOtp] = useState(['', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [resendCount, setResendCount] = useState(0);
  const [canResend, setCanResend] = useState(true);
  const [resendTimer, setResendTimer] = useState(0);
  const insets = useSafeAreaInsets();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const inputRefs = useRef<(TextInput | null)[]>([null, null, null, null]);

  // Fade in animation on mount
  useEffect(() => {
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, []);

  // Resend timer with countdown
  useEffect(() => {
    if (!canResend) {
      setResendTimer(30);
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

  const handleOtpInput = (index: number, value: string) => {
    // Only allow numbers
    if (!/^[0-9]*$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value.slice(-1); // Keep only last character
    setOtp(newOtp);

    // Move to next field
    if (value && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpBackspace = (index: number, value: string) => {
    if (!value && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const otpString = otp.join('');
  const isOtpComplete = otpString.length === 4;

  const handleVerifyAndContinue = async () => {
    if (!isOtpComplete) {
      alert('Please enter a valid 4-digit OTP');
      return;
    }

    setIsLoading(true);
    try {
      if (onVerify) {
        onVerify(otpString);
      }
    } catch (error) {
      console.error('Error verifying OTP:', error);
      alert('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setCanResend(false);
    setResendCount(resendCount + 1);
    // Reset OTP
    setOtp(['', '', '', '']);
    inputRefs.current[0]?.focus();

    if (onResendOTP) {
      onResendOTP();
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
        {/* Title and Description */}
        <View style={styles.headerContainer}>
          <Text style={styles.title}>Verify Your
            {'\n'}Number</Text>
          <View style={styles.descriptionContainer}>
            <Text style={styles.description}>4-digit code sent to </Text>
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
          <View style={styles.resendContainer}>
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
            {resendTimer > 0 && (
              <Text style={styles.timerText}>{resendTimer}s</Text>
            )}
          </View>
        </View>
      </View>

      {/* Navigation Handle (Bottom) */}
      <View style={styles.navigationHandle}>
        <View style={styles.handleBar} />
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
    fontFamily: 'Roboto',
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
    paddingHorizontal: Spacing.sm,
    paddingTop: Spacing.lg,
    gap: Spacing.lg,
  },

  // Header Container
  headerContainer: {
    gap: Spacing.md,
  },
  title: {
    fontSize: 40,
    fontWeight: '600',
    color: Colors.neutral900,
    fontFamily: 'Poppins',
    lineHeight: 48,
    letterSpacing: 0,
  },
  descriptionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  description: {
    fontSize: 18,
    fontWeight: '500',
    color: Colors.neutral700,
    fontFamily: 'Poppins',
    lineHeight: 18,
    letterSpacing: 0,
  },
  phoneNumberLink: {
    fontSize: 18,
    fontWeight: '600',
    color: '#316aff', // Blue link color
    fontFamily: 'Poppins',
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
    fontSize: 24,
    fontWeight: '600',
    color: Colors.neutral900,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  otpInputFilled: {
    borderColor: Colors.primary,
  },

  // Verify & Continue Button
  verifyButton: {
    height: 56,
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  verifyButtonDisabled: {
    backgroundColor: '#A4A4A4',
  },
  verifyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.neutral100,
    fontFamily: 'Poppins',
    letterSpacing: -0.5,
  },

  // Footer Container
  footerContainer: {
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    width: '100%',
  },

  // Resend Container with Timer
  resendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  resendButton: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },

  // Resend OTP Link
  resendOtpText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#316aff', // Blue color from design
    fontFamily: 'DM Sans',
    textAlign: 'center',
  },
  resendOtpTextDisabled: {
    opacity: 0.5,
  },

  // Timer Text
  timerText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.neutral700,
    fontFamily: 'DM Sans',
  },

  // Navigation Handle
  navigationHandle: {
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: Spacing.sm,
  },
  handleBar: {
    width: 108,
    height: 4,
    backgroundColor: '#1d1b20',
    borderRadius: 12,
  },
});
