import React, { useEffect, useState  , useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  Image,
  ScrollView,
  Modal,
  Animated, 
  PanResponder
} from 'react-native';
import { Colors, Spacing, Radius } from '@/lib/theme';
import { fs, rs, vs } from '@/lib/responsive';

const backImage = require('@/assets/images/profile/back.png');
const chevrondown = require('@/assets/images/chevron-down.png');
interface BankDetailsScreenProps {
  onContinue?: (bankData: BankDetailsData) => void;
  onBack?: () => void;
  initialData?: Partial<BankDetailsData> | null;
  onDraftChange?: (bankData: Partial<BankDetailsData>) => void;
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
  initialData,
  onDraftChange,
}) => {
  const [bankName, setBankName] = useState(initialData?.bankName || '');
  const [accountNumber, setAccountNumber] = useState(initialData?.accountNumber || '');
  const [ifscCode, setIfscCode] = useState(initialData?.ifscCode || '');
  const [upiId, setUpiId] = useState(initialData?.upiId || '');
  const [showBankModal, setShowBankModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    onDraftChange?.({
      bankName,
      accountNumber,
      ifscCode,
      upiId,
    });
  }, [bankName, accountNumber, ifscCode, upiId, onDraftChange]);

  const handleBankSelect = (bank: string) => {
    setBankName(bank);
    setShowBankModal(false);
  };

  const isFormValid = bankName && accountNumber && ifscCode;

  const handleContinue = async () => {
    if (isSubmitting) {
      return;
    }

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
      setIsSubmitting(true);
      try {
        await onContinue({
          bankName,
          accountNumber,
          ifscCode: ifscCode.toUpperCase(),
          upiId,
        });
      } catch (error) {
        setIsSubmitting(false);
        throw error;
      }
    }
  };
  

  // Drag Modal 

    const translateY = useRef(
    new Animated.Value(500)
  ).current;

  useEffect(() => {
    if (showBankModal) {
      translateY.setValue(500);

      Animated.timing(translateY, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [showBankModal]);

  const handleClose = () => {
    Animated.timing(translateY, {
      toValue: 500,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      setShowBankModal(false)
    });
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,

      onMoveShouldSetPanResponder: (
        _,
        gestureState
      ) => Math.abs(gestureState.dy) > 5,

      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          translateY.setValue(
            gestureState.dy
          );
        }
      },

      onPanResponderRelease: (
        _,
        gestureState
      ) => {
        if (gestureState.dy > 120) {
          handleClose();
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

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
             <Image source={chevrondown} style={styles.dropdownChevronIcon}/>
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
          style={[styles.continueButton, (!isFormValid || isSubmitting) && styles.buttonDisabled]}
          onPress={handleContinue}
          disabled={!isFormValid || isSubmitting}
        >
          <Text style={styles.buttonText}>{isSubmitting ? 'Processing...' : 'Continue'}</Text>
        </Pressable>

      </ScrollView>

      


      {/* Bank Selection Modal */}
      <Modal
        visible={showBankModal}
        statusBarTranslucent
        transparent
        onRequestClose={() => setShowBankModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={handleClose}
        >


           <Animated.View
          {...panResponder.panHandlers}
          style={[
            styles.modalContent,
            {
              transform: [
                { translateY },
              ],
            },
          ]}
        >


          {/* <Pressable
            style={[styles.modalContent, { paddingBottom: Math.max(insets.bottom + 16, 32) }]}
            onPress={(event) => event.stopPropagation()}
          > */}
            <View style={styles.sheetHeader}>
              <View style={styles.dragHandle} />
            </View>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Bank</Text>
            
            </View>

            <ScrollView
              style={styles.bankOptionsScroll}
              contentContainerStyle={styles.bankOptionsContent}
              showsVerticalScrollIndicator={false}
            >
              {BANK_LIST.map((item) => (
                <Pressable
                  key={item}
                  style={styles.modalOption}
                  onPress={() => handleBankSelect(item)}
                >
                  <Text style={styles.modalOptionText}>{item}</Text>
                </Pressable>
              ))}
            </ScrollView>
         </Animated.View>
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
    height: vs(52),
    backgroundColor: '#ffffff',
  },

  // Top Navigation
  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: rs(4),
    paddingVertical: vs(8),
    minHeight: vs(64),
    backgroundColor: '#ffffff',
  },
  backButton: {
    width: rs(48),
    height: rs(48),
    justifyContent: 'center',
    alignItems: 'center',
  },
  backIcon: {
    width: rs(24),
    height: rs(24),
  },
  navTitle: {
    flex: 1,
    minWidth: 0,
    color: '#1c1c1c',
    fontFamily: 'Poppins_500Medium',
    fontSize: fs(20, 17, 22),
    fontWeight: '500',
    lineHeight: fs(32, 26, 34),
  },

  // Scroll View
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    width: '100%',
    maxWidth: rs(412, 320, 430),
    alignSelf: 'center',
    paddingHorizontal: rs(16),
    paddingTop: vs(24),
    paddingBottom: vs(24),
    gap: vs(40),
  },

  // Header Section
  headerSection: {
    gap: vs(12),
  },
  title: {
    color: '#1c1c1c',
    fontFamily: 'Poppins_500Medium',
    fontSize: fs(40, 30, 42),
    fontWeight: '500',
    lineHeight: fs(48, 36, 50),
  },
  subtitle: {
    color: '#1c1c1c',
    fontFamily: 'Poppins_400Regular',
    fontSize: fs(16),
    fontWeight: '400',
    lineHeight: fs(24),
  },

  // Input Section
  inputSection: {
    gap: vs(16),
  },
  inputLabel: {
    color: '#606060',
    fontFamily: 'Poppins_400Regular',
    fontSize: fs(16),
    fontWeight: '400',
    lineHeight: fs(24),
  },
  textInput: {
    backgroundColor: Colors.neutral100,
    borderWidth: 1,
    borderColor: Colors.neutral600,
    borderRadius: Radius.sm,
    paddingHorizontal: rs(8),
    paddingVertical: vs(4),
    color: '#1c1c1c',
    fontFamily: 'Poppins_400Regular',
    fontSize: fs(16),
    fontWeight: '400',
    lineHeight: fs(24),
    minHeight: vs(56),
  },

  // Dropdown
  dropdownButton: {
    backgroundColor: Colors.neutral100,
    borderWidth: 1,
    borderColor: Colors.neutral600,
    borderRadius: Radius.sm,
    paddingHorizontal: rs(8),
    paddingVertical: vs(4),
    minHeight: vs(56),
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dropdownText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: fs(16),
    fontWeight: '400',
    lineHeight: fs(24),
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
  },
  dropdownIcon: {
    fontSize: fs(12),
    color: Colors.neutral800,
  },
  dropdownChevronIcon: {
    width: rs(15),
    height: rs(15),
  },

  // Helper Text
  helperText: {
    color: '#8e8e8e',
    fontFamily: 'Poppins_400Regular',
    fontSize: fs(12),
    fontWeight: '400',
    lineHeight: fs(18),
    marginTop: vs(12),
  },

  // Continue Button
  continueButton: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    minHeight: vs(56),
    paddingVertical: vs(16),
    paddingHorizontal: rs(24),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom : vs(15)
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    flexShrink: 1,
    color: '#ffffff',
    fontFamily: 'Poppins_500Medium',
    fontSize: fs(16),
    fontWeight: '500',
    lineHeight: fs(20),
    letterSpacing: -0.5,
  },
  navigation: {
    height: vs(24),
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeIndicator: {
    width: rs(108),
    height: vs(4),
    borderRadius: rs(12),
    backgroundColor: '#1d1b20',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    width: '100%',
    maxWidth: rs(720, 320, 720),
    alignSelf: 'center',
    backgroundColor: Colors.neutral100,
    borderTopLeftRadius: rs(28),
    borderTopRightRadius: rs(28),
    paddingHorizontal: rs(16),
    paddingTop: vs(16),
    maxHeight: '72%',
  },
  sheetHeader: {
    width: '100%',
    alignItems: 'center',
    padding: rs(16),
  },
  dragHandle: {
    width: rs(32),
    height: vs(4),
    borderRadius: rs(100),
    backgroundColor: '#79747e',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: vs(16),
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral300,
  },
  modalTitle: {
    fontFamily: 'Poppins_500Medium',
    fontSize: fs(18),
    fontWeight: '500',
    color: Colors.neutral900,
  },
  closeIcon: {
    fontSize: fs(24),
    color: Colors.neutral800,
  },
  bankOptionsScroll: {
    width: '100%',
  },
  bankOptionsContent: {
    paddingTop: vs(8),
  },
  modalOption: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral200,
  },
  modalOptionText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: fs(16),
    fontWeight: '400',
    color: Colors.neutral900,
  },
});

export default BankDetailsScreen;

