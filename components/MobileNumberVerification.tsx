import React, { useState, useRef, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, Radius } from '@/lib/theme';
import { useAppAlert } from './AppAlertModal';
import { OTPVerification } from './OTPVerification';
import { DriverDetailsScreen } from './DriverDetailsScreen';
import { VehicleDetailsScreen } from './VehicleDetailsScreen';
import { BankDetailsScreen } from './BankDetailsScreen';
import { DocumentsVerificationScreen } from './DocumentsVerificationScreen';
import { SuspendedScreen } from './SuspendedScreen';
import {
  storeOnboardingData,
  getVerificationStatus,
  OnboardingData,
} from '@/lib/firestoreOnboardingService'; // Real Firebase Firestore

import { sendOTP } from '@/lib/firebaseAuthService'; // Real Firebase Auth

import { fs, hit, rs, vs } from '@/lib/responsive';

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
  const [showVehicleDetails, setShowVehicleDetails] = useState(false);
  const [showBankDetails, setShowBankDetails] = useState(false);
  const [showVerification, setShowVerification] = useState(false);
  const [showSuspended, setShowSuspended] = useState(false);

  // Collect data from all screens
  const [driverData, setDriverData] = useState<any>(null);
  const [vehicleData, setVehicleData] = useState<any>(null);
  
  // Firebase UID after OTP verification
  const [firebaseUid, setFirebaseUid] = useState<string | null>(null);
  const [firebaseIdToken, setFirebaseIdToken] = useState<string | null>(null);

  const insets = useSafeAreaInsets();
  const { alertModal, showAlert } = useAppAlert();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Fade in animation on mount
  useEffect(() => {
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  const isValidMobileNumber = (number: string) => {
    // Valid Indian mobile number: 10 digits
    return /^[0-9]{10}$/.test(number);
  };

  const handleVerifyAndContinue = async () => {
    if (!isValidMobileNumber(mobileNumber)) {
      showAlert('Invalid Mobile Number', 'Please enter a valid 10-digit mobile number');
      return;
    }

    setIsLoading(true);
    try {
      // Send OTP via Firebase
      const phoneNumberWithCode = `+91${mobileNumber}`;
      console.log('🔄 Sending OTP to:', phoneNumberWithCode);
      
      await sendOTP(phoneNumberWithCode);
      
      console.log('✅ OTP sent successfully, showing verification screen');
      // Show OTP verification screen
      setShowOTP(true);
    } catch (error: any) {
      console.error('❌ Error sending OTP:', error);
      
      // Show user-friendly error message
      let errorMessage = 'Failed to send verification code. Please try again.';
      
      if (error.message) {
        errorMessage = error.message;
      }
      
      showAlert(
        'Verification Failed',
        errorMessage,
        [
          {
            text: 'Retry',
            onPress: () => {
              // User can retry by tapping the button again
            },
          },
          {
            text: 'Check Number',
            onPress: () => {
              // Focus on the input field for user to check
              setMobileNumber('');
            },
          },
        ]
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleOTPVerify = async (result: { uid: string; phoneNumber: string; idToken: string; otp: string }) => {
    // OTP verified successfully with Firebase
    console.log('✅ OTP verified with Firebase');
    console.log('User UID:', result.uid);
    console.log('Phone Number:', result.phoneNumber);
    console.log('ID Token:', result.idToken.substring(0, 20) + '...');

    try {
      setIsLoading(false);
      
      // Store Firebase UID for later use
      setFirebaseUid(result.uid);
      setFirebaseIdToken(result.idToken);
      await AsyncStorage.multiSet([
        ['firebaseUid', result.uid],
        ['firebasePhoneNumber', result.phoneNumber || `+91${mobileNumber}`],
        ['firebaseIdToken', result.idToken],
      ]);
      
      console.log('✅ Firebase UID stored in state');

      const lookupIds = Array.from(
        new Set(
          [
            result.uid,
            result.phoneNumber,
            `+91${mobileNumber}`,
            mobileNumber,
            result.phoneNumber?.replace(/^\+91/, ''),
          ].filter(Boolean)
        )
      ) as string[];

      console.log('Checking existing driver with:', lookupIds);

      let verificationStatus = null;
      for (const lookupId of lookupIds) {
        verificationStatus = await getVerificationStatus(lookupId, result.idToken);
        if (verificationStatus) {
          console.log(`Existing driver found using: ${lookupId}`);
          break;
        }
      }

      if (verificationStatus?.status === 'verified') {
        console.log('✅ Existing driver already verified, going to app');
        onVerify?.(result.phoneNumber);
        return;
      }

      if (verificationStatus?.status === 'suspended') {
        console.log('Blocked driver account detected; showing suspended screen');
        setShowSuspended(true);
        setShowOTP(false);
        setShowVerification(false);
        setShowDriverDetails(false);
        setShowVehicleDetails(false);
        setShowBankDetails(false);
        return;
      }

      if (verificationStatus?.status === 'pending') {
        console.log('⏳ Existing driver verification pending, showing review screen');
        setShowVerification(true);
        setShowOTP(false);
        return;
      }

      console.log(
        verificationStatus?.status === 'rejected'
          ? 'Existing driver rejected, starting re-upload onboarding'
          : 'New driver, starting onboarding'
      );

      setShowOTP(false);
      setShowDriverDetails(true);
    } catch (error) {
      console.error('Error processing OTP verification:', error);
      showAlert('Error', 'Failed to process verification. Please try again.');
    }
  };

  const handleChangeNumber = () => {
    setShowOTP(false);
    setMobileNumber('');
  };

  const handleDriverDetailsSubmit = (data: any) => {
    // Store driver details and move to vehicle details
    console.log('Driver details submitted:', data);
    setDriverData(data);
    setShowVehicleDetails(true);
  };

  const handleVehicleDetailsSubmit = (vehicleData: any) => {
    // Store vehicle details and move to bank details
    console.log('Vehicle details submitted:', vehicleData);
    setVehicleData(vehicleData);
    setShowBankDetails(true);
  };

  const handleBankDetailsSubmit = async (bankData: any) => {
    // All data collected - store to Firestore
    console.log('Bank details submitted:', bankData);

    setIsLoading(true);
    try {
      if (!firebaseUid) {
        showAlert('Error', 'Firebase UID not found. Please try again from the beginning.');
        setIsLoading(false);
        return;
      }

      // Prepare complete onboarding data
      const onboardingData: Omit<
        OnboardingData,
        'createdAt' | 'updatedAt' | 'submittedAt'
      > = {
        phoneNumber: `+91${mobileNumber}`,
        
        // Driver details
        fullName: driverData?.fullName || '',
        photoUri: driverData?.photoUri || '',
        drivingLicenseUri: driverData?.drivingLicenseUri || '',
        identityProofUri: driverData?.identityProofUri || '',

        // Vehicle details
        vehicleNumber: vehicleData?.vehicleNumber || '',
        vehicleType: vehicleData?.vehicleType || '',
        vehicleCapacity: vehicleData?.vehicleCapacity || '',
        bodyType: vehicleData?.bodyType || '',
        rcBookUri: vehicleData?.rcBook || '',
        insuranceUri: vehicleData?.insurance || '',
        vehiclePhotoUris: vehicleData?.vehiclePhotos || [],

        // Bank details
        bankName: bankData?.bankName || '',
        accountNumber: bankData?.accountNumber || '',
        ifscCode: bankData?.ifscCode || '',
        upiId: bankData?.upiId || '',

        // Initial verification status
        verificationStatus: 'pending',
      };

      console.log(`📝 Storing onboarding data to Firestore using UID: ${firebaseUid}`);

      // Store to Firestore using Firebase UID
      const result = await storeOnboardingData(
        firebaseUid,
        `+91${mobileNumber}`,
        onboardingData,
        firebaseIdToken || undefined
      );

      if (!result.success) {
        showAlert('Error', result.error || 'Failed to store onboarding data');
        setIsLoading(false);
        return;
      }

      console.log('✅ Onboarding data stored successfully to Firestore');

      // Show verification screen
      setShowVerification(true);
      setShowBankDetails(false);
    } catch (error) {
      console.error('❌ Error storing onboarding data:', error);
      showAlert(
        'Error',
        'Failed to complete onboarding. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerificationComplete = () => {
    // All verified and user can access the app
    console.log('✅ User verified, accessing app');
    if (onVerify) {
      onVerify(`+91${mobileNumber}`);
    }
  };

  const handleRetryUpload = () => {
    // User wants to re-upload documents (go back to driver details)
    setShowVerification(false);
    setShowBankDetails(false);
    setShowVehicleDetails(false);
    setShowDriverDetails(true);
  };

  const content = showSuspended ? (
      <SuspendedScreen />
    ) : showVerification ? (
      <DocumentsVerificationScreen
        uid={firebaseUid || undefined}
        phoneNumber={`+91${mobileNumber}`}
        idToken={firebaseIdToken || undefined}
        onVerificationComplete={handleVerificationComplete}
        onRetryUpload={handleRetryUpload}
        onSuspended={() => {
          setShowVerification(false);
          setShowSuspended(true);
        }}
      />
    ) : showBankDetails ? (
      <BankDetailsScreen
        onContinue={handleBankDetailsSubmit}
        onBack={() => {
          setShowBankDetails(false);
          setShowVehicleDetails(true);
        }}
      />
    ) : showVehicleDetails ? (
      <VehicleDetailsScreen
        onContinue={handleVehicleDetailsSubmit}
        onBack={() => {
          setShowVehicleDetails(false);
          setShowDriverDetails(true);
        }}
      />
    ) : showDriverDetails ? (
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
              We&apos;ll send a one-time verification code to confirm your number.
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
            <View style={styles.mobileNumberBox}>
              <Text style={styles.mobileNumberLabel}>Mobile Number</Text>
              <TextInput
                style={styles.mobileNumberInput}
                keyboardType="number-pad"
                maxLength={10}
                value={mobileNumber}
                onChangeText={setMobileNumber}
                editable={!isLoading}
              />
            </View>
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

        <View style={styles.navigation}>
         
        </View>
      </Animated.View>
    );

  return (
    <>
      {content}
      {alertModal}
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#eff2f6', // neutral bg-color from design
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
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingTop: 40,
    gap: 40,
  },

  // Header (Title & Description)
  headerContainer: {
    gap: 16,
  },
  title: {
    color: '#1c1c1c',
    fontFamily: 'Poppins_500Medium',
    fontSize: fs(40),
    fontWeight: '500',
    lineHeight: 48,
    letterSpacing: 0,
  },
  description: {
    color: '#606060',
    fontFamily: 'Poppins_500Medium',
    fontSize: fs(18),
    fontWeight: '500',
    letterSpacing: 0,
  },

  // Input Container
  inputContainer: {
    flexDirection: 'row',
    justifyContent : 'space-around',
    gap: 8,
    alignItems: 'center',
  },

  // Country Code Box
  countryCodeBox: {
    width: rs(52),
    height: rs(60),
    backgroundColor: 'white',
    borderRadius: Radius.md,
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 9,
  },
  countryCodeLabel: {
    color: '#9d9d8a',
    fontFamily: 'Poppins_400Regular',
    fontSize: fs(12),
    fontWeight: '400',
    lineHeight: 12,
  },
  countryCode: {
    color: '#1c1c1a',
    fontFamily: 'Poppins_500Medium',
    fontSize: fs(14),
    fontWeight: '500',
    lineHeight: 21,
    letterSpacing : 0
  },

  // Mobile Number Input
  mobileNumberBox: {
    flex: 1,
    height: rs(60),
    backgroundColor: 'white',
    borderRadius: Radius.md,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 7,
    justifyContent: 'space-between',
  },
  mobileNumberLabel: {
    color: '#9d9d8a',
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 12,
  },
  mobileNumberInput: {
    height: 24,
    padding: 0,
    margin: 0,
    color: '#1c1c1a',
    fontFamily: 'Poppins_500Medium',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 21,
  },

  // Verify & Continue Button
  verifyButton: {
    height: 56,
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  verifyButtonDisabled: {
    opacity: 0.7,
  },
  verifyButtonText: {
    color: '#ffffff',
    fontFamily: 'Poppins_500Medium',
    fontSize: fs(16),
    fontWeight: '500',
    lineHeight: 16,
    letterSpacing: -0.5,
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
