import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  Image,
  ScrollView,
  Modal,
  FlatList,
} from 'react-native';
import { Colors, Spacing, Radius } from '@/lib/theme';

const backImage = require('@/assets/images/profile/back.png');

interface BankDetailsScreenProps {
  onContinue?: (bankData: BankDetailsData) => void;
  onBack?: () => void;
}

interface BankDetailsData {
  bankName: string;
  accountNumber: string;
  ifscCode: string;
  upiId: string;
}

const BANK_LIST = [
  'HDFC Bank',
  'ICICI Bank',
  'Axis Bank',
  'State Bank of India',
  'Kotak Mahindra Bank',
  'IndusInd Bank',
  'IDBI Bank',
  'Punjab National Bank',
  'Bank of Baroda',
  'Canara Bank',
];

export const BankDetailsScreen: React.FC<BankDetailsScreenProps> = ({
  onContinue,
  onBack,
}) => {
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [upiId, setUpiId] = useState('');
  const [showBankModal, setShowBankModal] = useState(false);

  const handleBankSelect = (bank: string) => {
    setBankName(bank);
    setShowBankModal(false);
  };

  const isFormValid = bankName && accountNumber && ifscCode;

  const handleContinue = () => {
    if (!isFormValid) {
      alert('Please fill in all required fields');
      return;
    }

    // Validate IFSC code format (11 characters)
    if (ifscCode.length !== 11) {
      alert('IFSC code must be 11 characters long');
      return;
    }

    // Validate account number (should be numeric)
    if (!/^\d+$/.test(accountNumber)) {
      alert('Account number must contain only digits');
      return;
    }

    if (onContinue) {
      onContinue({
        bankName,
        accountNumber,
        ifscCode: ifscCode.toUpperCase(),
        upiId,
      });
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.statusSpacer} />

      {/* Top Navigation */}
      <View style={styles.topNav}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={styles.backButton}
          onPress={onBack}
        >
          <Image source={backImage} style={styles.backIcon} resizeMode="contain" />
        </Pressable>
        <Text style={styles.navTitle}>Onboarding</Text>
      </View>

      {/* Main Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Section */}
        <View style={styles.headerSection}>
          <Text style={styles.title}>Bank details</Text>
          <Text style={styles.subtitle}>Add your bank details to get paid</Text>
        </View>

        {/* Bank Name Dropdown */}
        <View style={styles.inputSection}>
          <Text style={styles.inputLabel}>Bank name</Text>
          <Pressable
            style={styles.dropdownButton}
            onPress={() => setShowBankModal(true)}
          >
            <Text
              style={[
                styles.dropdownText,
                { color: bankName ? Colors.neutral900 : Colors.neutral800 },
              ]}
            >
              {bankName || 'Select Bank'}
            </Text>
            <Text style={styles.dropdownIcon}>▼</Text>
          </Pressable>
        </View>

        {/* Account Number */}
        <View style={styles.inputSection}>
          <Text style={styles.inputLabel}>Account number</Text>
          <TextInput
            style={styles.textInput}
            placeholder="Enter account number"
            placeholderTextColor={Colors.neutral800}
            value={accountNumber}
            onChangeText={setAccountNumber}
            keyboardType="number-pad"
          />
        </View>

        {/* IFSC Code */}
        <View style={styles.inputSection}>
          <Text style={styles.inputLabel}>IFSC code</Text>
          <TextInput
            style={styles.textInput}
            placeholder="e.g. HDFC0001234"
            placeholderTextColor={Colors.neutral800}
            value={ifscCode}
            onChangeText={setIfscCode}
            maxLength={11}
          />
          <Text style={styles.helperText}>
            Find IFSC code on the first page of your passbook or on a cheque leaf. It is an
            11-character code.
          </Text>
        </View>

        {/* UPI ID (Optional) */}
        <View style={styles.inputSection}>
          <Text style={styles.inputLabel}>UPI ID (optional)</Text>
          <TextInput
            style={styles.textInput}
            placeholder="name2465@okhdfcbank"
            placeholderTextColor={Colors.neutral800}
            value={upiId}
            onChangeText={setUpiId}
          />
        </View>

        {/* Continue Button */}
        <Pressable
          style={[styles.continueButton, !isFormValid && styles.buttonDisabled]}
          onPress={handleContinue}
          disabled={!isFormValid}
        >
          <Text style={styles.buttonText}>Continue</Text>
        </Pressable>

        <View style={{ height: 40 }} />
      </ScrollView>

      <View style={styles.navigation}>
        <View style={styles.homeIndicator} />
      </View>

      {/* Bank Selection Modal */}
      <Modal
        visible={showBankModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowBankModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowBankModal(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Bank</Text>
              <Pressable onPress={() => setShowBankModal(false)}>
                <Text style={styles.closeIcon}>✕</Text>
              </Pressable>
            </View>

            <FlatList
              data={BANK_LIST}
              keyExtractor={(item) => item}
              scrollEnabled={false}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.modalOption}
                  onPress={() => handleBankSelect(item)}
                >
                  <Text style={styles.modalOptionText}>{item}</Text>
                </Pressable>
              )}
            />
          </View>
        </Pressable>
      </Modal>
    </View>
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

  // Top Navigation
  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 8,
    height: 64,
    backgroundColor: '#ffffff',
  },
  backButton: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backIcon: {
    width: 24,
    height: 24,
  },
  navTitle: {
    color: '#1c1c1c',
    fontFamily: 'Poppins_500Medium',
    fontSize: 20,
    fontWeight: '500',
    lineHeight: 32,
  },

  // Scroll View
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 24,
    gap: 40,
  },

  // Header Section
  headerSection: {
    gap: 12,
  },
  title: {
    color: '#1c1c1c',
    fontFamily: 'Poppins_500Medium',
    fontSize: 40,
    fontWeight: '500',
    lineHeight: 48,
  },
  subtitle: {
    color: '#1c1c1c',
    fontFamily: 'Poppins_400Regular',
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 24,
  },

  // Input Section
  inputSection: {
    gap: 16,
  },
  inputLabel: {
    color: '#606060',
    fontFamily: 'Poppins_400Regular',
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 24,
  },
  textInput: {
    backgroundColor: Colors.neutral100,
    borderWidth: 1,
    borderColor: Colors.neutral600,
    borderRadius: Radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
    color: '#1c1c1c',
    fontFamily: 'Poppins_400Regular',
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 24,
    height: 56,
  },

  // Dropdown
  dropdownButton: {
    backgroundColor: Colors.neutral100,
    borderWidth: 1,
    borderColor: Colors.neutral600,
    borderRadius: Radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
    height: 56,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dropdownText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 24,
    flex: 1,
  },
  dropdownIcon: {
    fontSize: 12,
    color: Colors.neutral800,
  },

  // Helper Text
  helperText: {
    color: '#8e8e8e',
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 18,
    marginTop: 12,
  },

  // Continue Button
  continueButton: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    height: 56,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#ffffff',
    fontFamily: 'Poppins_500Medium',
    fontSize: 16,
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

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    backgroundColor: Colors.neutral100,
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.lg,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral300,
  },
  modalTitle: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 18,
    fontWeight: '500',
    color: Colors.neutral900,
  },
  closeIcon: {
    fontSize: 24,
    color: Colors.neutral800,
  },
  modalOption: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral200,
  },
  modalOptionText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 16,
    fontWeight: '400',
    color: Colors.neutral900,
  },
});

export default BankDetailsScreen;
