import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  SafeAreaView,
  ScrollView,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, Radius } from '@/lib/theme';
import { getVerificationStatus } from '@/lib/firestoreOnboardingService';

interface DocumentsVerificationScreenProps {
  phoneNumber?: string;
  uid?: string; // Firebase UID (preferred)
  idToken?: string;
  onVerificationComplete?: () => void;
  onRetryUpload?: () => void;
}

interface VerificationData {
  status: 'pending' | 'verified' | 'rejected';
  rejectionReason?: string;
  rejectedDocuments?: string[];
  reviewedAt?: string;
}

export const DocumentsVerificationScreen: React.FC<
  DocumentsVerificationScreenProps
> = ({ phoneNumber, uid, idToken, onVerificationComplete, onRetryUpload }) => {
  const [verificationData, setVerificationData] = useState<VerificationData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const insets = useSafeAreaInsets();

  // Fetch verification status from backend/Firestore
  useEffect(() => {
    fetchVerificationStatus();
    // Poll for verification updates every 5 seconds
    const interval = setInterval(fetchVerificationStatus, 5000);
    return () => clearInterval(interval);
  }, [uid, phoneNumber]);

  const fetchVerificationStatus = async () => {
    try {
      // Use UID if available (preferred), fall back to phone number
      const identifier = uid || phoneNumber;
      
      if (!identifier) {
        console.error('❌ No UID or phone number provided for verification check');
        setIsLoading(false);
        return;
      }

      console.log(`🔍 Checking verification status for: ${identifier}`);
      
      // Fetch from Firestore
      const data = await getVerificationStatus(identifier, idToken);
      
      if (!data) {
        console.warn('⚠️ No verification data found');
        setIsLoading(false);
        return;
      }

      setVerificationData({
        status: data.status,
        rejectionReason: data.rejectionReason,
        rejectedDocuments: data.rejectedDocuments,
      });
      
      console.log(`📊 Verification status: ${data.status}`);
      setIsLoading(false);

      // If verified, auto-navigate to app after 2 seconds
      if (data.status === 'verified' && onVerificationComplete) {
        console.log('✅ Verified! Routing to app in 2 seconds...');
        setTimeout(() => {
          onVerificationComplete();
        }, 2000);
      }
    } catch (error) {
      console.error('Error fetching verification status:', error);
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.topNav}>
          <Text style={styles.navTitle}>Onboarding</Text>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading verification status...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // If verified, show success state (though this should auto-navigate)
  if (verificationData?.status === 'verified') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.topNav}>
          <Text style={styles.navTitle}>Onboarding</Text>
        </View>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.contentContainer}>
            <View style={styles.iconContainer}>
              <Text style={styles.verifiedIcon}>✓</Text>
            </View>
            <Text style={styles.mainTitle}>Documents Verified</Text>
            <Text style={styles.mainDescription}>
              Your documents have been verified successfully. Welcome!
            </Text>
          </View>

          <Pressable
            style={[styles.continueButton, styles.continueButtonActive]}
            onPress={onVerificationComplete}
          >
            <Text style={styles.continueButtonText}>Go to app</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Pending or Rejected status
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topNav}>
        <Text style={styles.navTitle}>Onboarding</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.contentContainer}>
          {/* Icon Card */}
          <View style={styles.statusCard}>
            <View style={styles.iconBox}>
              <Text style={styles.pendingIcon}>?</Text>
            </View>
            <Text style={styles.mainTitle}>Documents under review</Text>
            <Text style={styles.mainDescription}>
              Our team will verify your documents within 24 hours. We will notify you once the
              review is complete.
            </Text>
          </View>

          {/* Rejection/Action Required Message */}
          {verificationData?.status === 'rejected' && verificationData?.rejectionReason && (
            <View style={styles.actionRequiredBox}>
              <View style={styles.actionHeaderContainer}>
                <Text style={styles.alertIcon}>⚠</Text>
                <Text style={styles.actionTitle}>Action required</Text>
              </View>
              <Text style={styles.actionMessage}>{verificationData.rejectionReason}</Text>
            </View>
          )}

          {/* Info Message */}
          <Text style={styles.infoText}>Complete all document uploads to access the app</Text>
        </View>

        {/* Continue Button */}
        <Pressable
          style={[
            styles.continueButton,
            verificationData?.status === 'pending' && styles.continueButtonDisabled,
          ]}
          onPress={() => {
            if (verificationData?.status === 'rejected' && onRetryUpload) {
              onRetryUpload();
            } else {
              Alert.alert('Info', 'Your documents are under review. Please check back soon.');
            }
          }}
          disabled={verificationData?.status === 'pending'}
        >
          <Text style={styles.continueButtonText}>
            {verificationData?.status === 'rejected' ? 'Re-upload Documents' : 'Go to app'}
          </Text>
        </Pressable>
      </ScrollView>

      {/* Navigation Handle */}
      <View style={styles.navigationHandle}>
        <View style={styles.handleBar} />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#eff2f6',
  },

  // Top Navigation
  topNav: {
    height: 64,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    paddingHorizontal: 24,
    paddingVertical: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1c1c1c',
    fontFamily: 'Poppins',
    lineHeight: 32,
  },

  // Scroll View
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 24,
    gap: 24,
  },

  // Content Container
  contentContainer: {
    gap: 24,
    marginBottom: 24,
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '400',
    color: '#606060',
    fontFamily: 'Poppins',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#e7f0ff',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 10,
  },

  // Status Card
  statusCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    gap: 10,
    alignItems: 'center',
  },
  iconBox: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#fff3cd',
    borderWidth: 3,
    borderColor: '#ffc107',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  pendingIcon: {
    fontSize: 40,
    fontWeight: '600',
    color: '#ffc107',
  },
  verifiedIcon: {
    fontSize: 40,
    fontWeight: '600',
    color: '#05c',
  },

  // Main Title & Description
  mainTitle: {
    fontSize: 40,
    fontWeight: '500',
    color: '#1c1c1c',
    fontFamily: 'Poppins',
    lineHeight: 48,
    textAlign: 'center',
  },
  mainDescription: {
    fontSize: 18,
    fontWeight: '400',
    color: '#606060',
    fontFamily: 'Poppins',
    lineHeight: 24,
    textAlign: 'center',
    letterSpacing: -0.5,
  },

  // Action Required Box
  actionRequiredBox: {
    backgroundColor: 'white',
    borderWidth: 1.5,
    borderColor: '#d00416',
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  actionHeaderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  alertIcon: {
    fontSize: 16,
    color: '#d00416',
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    fontFamily: 'Poppins',
    letterSpacing: -0.5,
  },
  actionMessage: {
    fontSize: 16,
    fontWeight: '400',
    color: '#606060',
    fontFamily: 'Poppins',
    lineHeight: 24,
  },

  // Info Text
  infoText: {
    fontSize: 14,
    fontWeight: '400',
    color: '#606060',
    fontFamily: 'Poppins',
    lineHeight: 21,
  },

  // Continue Button
  continueButton: {
    backgroundColor: '#a4a4a4',
    borderRadius: 8,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    marginBottom: 24,
  },
  continueButtonActive: {
    backgroundColor: '#05c',
  },
  continueButtonDisabled: {
    opacity: 0.6,
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#606060',
    fontFamily: 'Poppins',
    lineHeight: 20,
    letterSpacing: -0.5,
  },

  // Navigation Handle
  navigationHandle: {
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 8,
  },
  handleBar: {
    width: 108,
    height: 4,
    backgroundColor: '#1d1b20',
    borderRadius: 12,
  },
});

export default DocumentsVerificationScreen;
