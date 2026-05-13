import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  Dimensions,
  StatusBar,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, Radius } from '@/lib/theme';
import { OTPVerification } from './OTPVerification';
import { DriverDetailsScreen } from './DriverDetailsScreen';

const { width, height } = Dimensions.get('window');

interface MobileNumberVerificationProps {
  onVerify?: (mobileNumber: string) => void;
  onBack?: () => void;
}

export const MobileNumberVerification: React.FC<MobileNumberVerificationProps> = ({
  onVerify,
  onBack,
}) => {
  const [mobileNumber, setMobileNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showOTP, setShowOTP] = useState(false);
  const [showDriverDetails, setShowDriverDetails] = useState(false);
  const insets = useSafeAreaInsets();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Fade in animation on mount
  useEffect(() => {
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, []);

  const isValidMobileNumber = (number: string) => {
    // Valid Indian mobile number: 10 digits
    return /^[0-9]{10}$/.test(number);
  };

  const handleVerifyAndContinue = async () => {
    if (!isValidMobileNumber(mobileNumber)) {
      alert('Please enter a valid 10-digit mobile number');
      return;
    }

    setIsLoading(true);
    try {
      // Show OTP verification screen
      setShowOTP(true);
    } catch (error) {
      console.error('Error verifying mobile number:', error);
      alert('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOTPVerify = (otp: string) => {
    // OTP verified successfully, show driver details screen
    console.log('OTP verified:', otp);
    setShowDriverDetails(true);
  };

  const handleChangeNumber = () => {
    setShowOTP(false);
    setMobileNumber('');
  };

  const handleDriverDetailsSubmit = (data: any) => {
    // Driver details submitted, complete the onboarding
    console.log('Driver details submitted:', data);
    // Call onVerify with all data
    if (onVerify) {
      onVerify(`+91${mobileNumber}`);
    }
  };

  return (
    showDriverDetails ? (
      <DriverDetailsScreen
        onContinue={handleDriverDetailsSubmit}
        onBack={() => {
          setShowDriverDetails(false);
          setShowOTP(true);
        }}
      />
    ) : showOTP ? (
      <OTPVerification
        mobileNumber={`+91${mobileNumber}`}
        onVerify={handleOTPVerify}
        onChangeNumber={handleChangeNumber}
        onResendOTP={() => console.log('Resend OTP for', mobileNumber)}
      />
    ) : (
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
          <Text style={styles.title}>Enter Your Mobile Number</Text>
          <Text style={styles.description}>
            We'll send a one-time verification code to confirm your number.
          </Text>
        </View>

        {/* Mobile Number Input */}
        <View style={styles.inputContainer}>
          {/* Country Code Box */}
          <View style={styles.countryCodeBox}>
            <Text style={styles.countryCodeLabel}>IND</Text>
            <Text style={styles.countryCode}>+91</Text>
          </View>

          {/* Mobile Number Input */}
          <TextInput
            style={styles.mobileNumberInput}
            placeholder="Mobile Number"
            placeholderTextColor={Colors.neutral700}
            keyboardType="number-pad"
            maxLength={10}
            value={mobileNumber}
            onChangeText={setMobileNumber}
            editable={!isLoading}
          />
        </View>

        {/* Verify & Continue Button */}
        <Pressable
          style={[styles.verifyButton, isLoading && styles.verifyButtonDisabled]}
          onPress={handleVerifyAndContinue}
          disabled={isLoading}
        >
          <Text style={styles.verifyButtonText}>
            {isLoading ? 'Verifying...' : 'Verify & Continue'}
          </Text>
        </Pressable>
      </View>

      {/* Navigation Handle (Bottom) */}
      <View style={styles.navigationHandle}>
        <View style={styles.handleBar} />
      </View>
    </Animated.View>
    )
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
 
  // Content Container
  contentContainer: {
    flex: 1,
    paddingHorizontal: Spacing.sm,
    paddingTop: Spacing.lg,
    gap: Spacing.lg,
  },

  // Header (Title & Description)
  headerContainer: {
    gap: Spacing.md,
  },
  title: {
    fontSize: 40,
    fontWeight: '500',
    color: Colors.neutral900,
    fontFamily: 'Poppins',
    lineHeight: 48,
    letterSpacing: 0,
  },
  description: {
    fontSize: 18,
    fontWeight: '500',
    color: Colors.neutral700,
    fontFamily: 'Poppins',
    lineHeight: 24,
    letterSpacing: 0,
  },

  // Input Container
  inputContainer: {
    flexDirection: 'row',
    gap: Spacing.md,
    alignItems: 'center',
  },

  // Country Code Box
  countryCodeBox: {
    width: 52,
    height: 60,
    backgroundColor: 'white',
    borderRadius: Radius.md,
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: Spacing.sm,
  },
  countryCodeLabel: {
    fontSize: 12,
    fontWeight: '400',
    color: '#9d9d8a',
    fontFamily: 'DM Sans',
  },
  countryCode: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.neutral900,
    fontFamily: 'DM Sans',
    lineHeight: 21,
  },

  // Mobile Number Input
  mobileNumberInput: {
    flex: 1,
    height: 60,
    backgroundColor: 'white',
    borderRadius: Radius.md,
    paddingHorizontal: 16,
    paddingVertical: Spacing.sm,
    fontSize: 14,
    fontWeight: '500',
    color: Colors.neutral900,
    fontFamily: 'DM Sans',
    lineHeight: 21,
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
    opacity: 0.7,
  },
  verifyButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.neutral100,
    fontFamily: 'Poppins',
    letterSpacing: -0.5,
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
