import React, { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons, MaterialIcons, Octicons } from '@expo/vector-icons';
import { getVerificationStatus } from '@/lib/firestoreOnboardingService';

const verifiedImage = require('@/assets/images/verified.png');
const backImage = require('@/assets/images/profile/back.png');

interface DocumentsVerificationScreenProps {
  phoneNumber?: string;
  uid?: string;
  idToken?: string;
  onBack?: () => void;
  onVerificationComplete?: () => void;
  onRetryUpload?: () => void;
}

interface VerificationData {
  status: 'pending' | 'verified' | 'rejected';
  rejectionReason?: string;
  rejectedDocuments?: string[];
  reviewedAt?: string;
}

export const DocumentsVerificationScreen: React.FC<DocumentsVerificationScreenProps> = ({
  phoneNumber,
  uid,
  idToken,
  onBack,
  onVerificationComplete,
  onRetryUpload,
}) => {
  const [verificationData, setVerificationData] = useState<VerificationData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showSupportModal, setShowSupportModal] = useState(false);

  const fetchVerificationStatus = async () => {
    try {
      const identifier = uid || phoneNumber;

      if (!identifier) {
        console.error('No UID or phone number provided for verification check');
        setIsLoading(false);
        return;
      }

      console.log(`Checking verification status for: ${identifier}`);

      const data = await getVerificationStatus(identifier, idToken);

      if (!data) {
        console.warn('No verification data found');
        setIsLoading(false);
        return;
      }

      setVerificationData({
        status: data.status,
        rejectionReason: data.rejectionReason,
        rejectedDocuments: data.rejectedDocuments,
      });

      console.log(`Verification status: ${data.status}`);
      setIsLoading(false);
    } catch (error) {
      console.error('Error fetching verification status:', error);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchVerificationStatus();
    const interval = setInterval(fetchVerificationStatus, 5000);
    return () => clearInterval(interval);
  }, [uid, phoneNumber, idToken]);

  const status = verificationData?.status || 'pending';
  const isVerified = status === 'verified';
  const isRejected = status === 'rejected';
  const canUseButton = isVerified || isRejected;
  const title = isVerified ? 'Documents verified' : 'Documents under review';
  const description = isVerified
    ? 'All your documents have been approved. You can now access the app.'
    : 'Our team will verify your documents within 24 hours.  We will notify you once the review is complete.';
  const actionMessage =
    verificationData?.rejectionReason ||
    'Your driving license photo is blurry. Please upload a clear photo showing all details.';
  const buttonLabel = isRejected ? 'Re-upload Documents' : 'Go to app';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.statusSpacer} />

      <View style={styles.topNav}>
        <Pressable
          style={styles.navIconButton}
          onPress={onBack}
          disabled={!onBack}
          hitSlop={8}
        >
          <Image source={backImage} style={styles.backIcon} resizeMode="contain" />
        </Pressable>
        <Text style={styles.navTitle}>Onboarding</Text>
        <Pressable
          style={styles.navIconButton}
          onPress={() => setShowSupportModal(true)}
          hitSlop={8}
        >
          <MaterialIcons name="support-agent" size={24} color="#1d1b20" />
        </Pressable>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading verification status...</Text>
        </View>
      ) : (
        <View style={styles.screenBody}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.reviewCard}>
              {isVerified ? (
                <Image source={verifiedImage} style={styles.verifiedImage} resizeMode="contain" />
              ) : (
                <Octicons name="unverified" size={80} color="#e0ad00" />
              )}
              <Text style={styles.mainTitle}>{title}</Text>
              <Text style={styles.mainDescription}>{description}</Text>
            </View>

            {isRejected && (
              <View style={styles.actionRequiredBox}>
                <View style={styles.actionHeaderContainer}>
                  <MaterialIcons name="message" size={16} color="#1d1b20" />
                  <Text style={styles.actionTitle}>Action required</Text>
                </View>
                <Text style={styles.actionMessage}>{actionMessage}</Text>
              </View>
            )}

            <Text style={styles.infoText}>Complete all document uploads to access the app</Text>
          </ScrollView>

          <View style={styles.bottomArea}>
            <Pressable
              style={[
                styles.continueButton,
                isVerified && styles.continueButtonActive,
                !canUseButton && styles.continueButtonDisabled,
              ]}
              onPress={() => {
                if (isVerified) {
                  onVerificationComplete?.();
                } else if (isRejected && onRetryUpload) {
                  onRetryUpload();
                } else {
                  Alert.alert('Info', 'Your documents are under review. Please check back soon.');
                }
              }}
              disabled={!canUseButton}
            >
              <Text
                style={[
                  styles.continueButtonText,
                  isVerified && styles.continueButtonTextActive,
                ]}
              >
                {buttonLabel}
              </Text>
            </Pressable>
          </View>
        </View>
      )}

      <Modal
        visible={showSupportModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSupportModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowSupportModal(false)}>
          <Pressable style={styles.supportSheet} onPress={(event) => event.stopPropagation()}>
            <View style={styles.supportIntro}>
              <Text style={styles.supportTitle}>Contact support</Text>
              <Text style={styles.supportSubtitle}>
                We are here to help you with any questions or issues
              </Text>
            </View>

            <View style={styles.supportOptions}>
              <View style={styles.supportRow}>
                <View style={styles.supportIconCircle}>
                  <Ionicons name="call" size={22} color="#05c" />
                </View>
                <View style={styles.supportTextGroup}>
                  <Text style={styles.supportLabel}>Call us (24x7)</Text>
                  <Text style={styles.supportValue}>022276110864</Text>
                </View>
              </View>

              <View style={styles.supportRow}>
                <View style={styles.supportIconCircle}>
                  <MaterialIcons name="email" size={22} color="#05c" />
                </View>
                <View style={styles.supportTextGroup}>
                  <Text style={styles.supportLabel}>Email us</Text>
                  <Text style={styles.supportValue}>machrush@support.com</Text>
                </View>
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#eff2f6',
  },
  statusSpacer: {
    height: 52,
    backgroundColor: '#ffffff',
  },
  topNav: {
    height: 64,
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  navIconButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    width: 24,
    height: 24,
  },
  navTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '500',
    color: '#1c1c1c',
    fontFamily: 'Poppins',
    lineHeight: 32,
  },
  screenBody: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '400',
    color: '#606060',
    fontFamily: 'Poppins',
  },
  reviewCard: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 40,
    gap: 16,
    alignItems: 'center',
    overflow: 'hidden',
  },
  verifiedImage: {
    width: 80,
    height: 80,
  },
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
    textAlign: 'center',
    letterSpacing: -0.5,
    lineHeight: 27,
  },
  actionRequiredBox: {
    height: 140,
    width: '100%',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d00416',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 10,
    marginTop: 40,
    overflow: 'hidden',
  },
  actionHeaderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
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
  infoText: {
    marginTop: 40,
    fontSize: 14,
    fontWeight: '400',
    color: '#606060',
    fontFamily: 'Poppins',
    lineHeight: 21,
  },
  bottomArea: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  continueButton: {
    width: '100%',
    height: 56,
    backgroundColor: '#a4a4a4',
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  continueButtonActive: {
    backgroundColor: '#05c',
  },
  continueButtonDisabled: {
    opacity: 1,
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#606060',
    fontFamily: 'Poppins',
    letterSpacing: -0.5,
  },
  continueButtonTextActive: {
    color: '#ffffff',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.24)',
  },
  supportSheet: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
    gap: 24,
    overflow: 'hidden',
  },
  supportIntro: {
    width: '100%',
    alignItems: 'center',
    gap: 8,
  },
  supportTitle: {
    width: '100%',
    fontSize: 24,
    fontWeight: '500',
    color: '#29292b',
    fontFamily: 'Poppins',
    textAlign: 'center',
    letterSpacing: -1,
  },
  supportSubtitle: {
    width: '100%',
    fontSize: 14,
    fontWeight: '400',
    color: '#606060',
    fontFamily: 'Poppins',
    lineHeight: 21,
    textAlign: 'center',
  },
  supportOptions: {
    width: '100%',
    gap: 8,
  },
  supportRow: {
    width: '100%',
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(27, 124, 255, 0.1)',
    overflow: 'hidden',
  },
  supportIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 40,
    backgroundColor: 'rgba(27, 124, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  supportTextGroup: {
    flex: 1,
    justifyContent: 'center',
    gap: 4,
  },
  supportLabel: {
    fontSize: 16,
    fontWeight: '400',
    color: '#606060',
    fontFamily: 'Poppins',
    lineHeight: 24,
  },
  supportValue: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1c1c1c',
    fontFamily: 'Poppins',
    letterSpacing: -0.5,
  },
});

export default DocumentsVerificationScreen;
