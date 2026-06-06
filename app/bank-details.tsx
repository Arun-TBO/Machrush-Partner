import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Image,
  ImageSourcePropType,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { auth } from '@/lib/firebase';
import { getDriverProfile, OnboardingData } from '@/lib/firestoreOnboardingService';

const backImage = require('@/assets/images/profile/back.png');
const supportCallImage = require('@/assets/images/profile/support-call.png');
const supportEmailImage = require('@/assets/images/profile/support-email.png');

type BankFieldProps = {
  label: string;
  value: string;
  helperText?: string;
};

function SupportOption({
  icon,
  label,
  value,
}: {
  icon: ImageSourcePropType;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.supportOption}>
      <Image source={icon} style={styles.supportOptionIcon} resizeMode="contain" />
      <View style={styles.supportOptionText}>
        <Text style={styles.supportOptionLabel}>{label}</Text>
        <Text style={styles.supportOptionValue}>{value}</Text>
      </View>
    </View>
  );
}

function SupportModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.supportSheet} onPress={(event) => event.stopPropagation()}>
          <View style={styles.sheetHeader}>
            <View style={styles.dragHandle} />
          </View>

          <View style={styles.supportIntro}>
            <Text style={styles.supportTitle}>Contact support</Text>
            <Text style={styles.supportSubtitle}>
              We are here to help you with any questions or issues
            </Text>
          </View>

          <View style={styles.supportOptions}>
            <SupportOption icon={supportCallImage} label="Call us (24x7)" value="022276110864" />
            <SupportOption icon={supportEmailImage} label="Email us" value="machrush@support.com" />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function TopNav() {
  const router = useRouter();

  return (
    <View style={styles.navShell}>
      <View style={styles.statusSpacer} />
      <View style={styles.topNav}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Image source={backImage} style={styles.backIcon} resizeMode="contain" />
        </Pressable>
        <Text style={styles.navTitle}>Bank details</Text>
      </View>
    </View>
  );
}

function BankField({ label, value, helperText }: BankFieldProps) {
  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.valueBox}>
        <Text style={styles.valueText} numberOfLines={1}>
          {value}
        </Text>
      </View>
      {helperText ? <Text style={styles.helperText}>{helperText}</Text> : null}
    </View>
  );
}

export default function BankDetailsProfileScreen() {
  const [driverProfile, setDriverProfile] = React.useState<OnboardingData | null>(null);
  const [isSupportVisible, setIsSupportVisible] = React.useState(false);

  useFocusEffect(
    React.useCallback(() => {
      let isActive = true;

      const loadDriverProfile = async () => {
        const [storedUid, storedIdToken] = await Promise.all([
          AsyncStorage.getItem('firebaseUid'),
          AsyncStorage.getItem('firebaseIdToken'),
        ]);
        const uid = auth.currentUser?.uid || storedUid;

        if (!uid) {
          if (isActive) {
            setDriverProfile(null);
          }
          return;
        }

        const profile = await getDriverProfile(uid, storedIdToken);

        if (isActive) {
          setDriverProfile(profile);
        }
      };

      loadDriverProfile();

      return () => {
        isActive = false;
      };
    }, [])
  );

  return (
    <SafeAreaView style={styles.container}>
      <TopNav />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Bank details</Text>
          <Text style={styles.description}>These details are verified and can’t be edited</Text>
        </View>

        <View style={styles.fields}>
          <BankField label="Bank name" value={driverProfile?.bankName || ''} />
          <BankField
            label="Account number"
            value={driverProfile?.accountNumber || ''}
          />
          <BankField
            label="IFSC code"
            value={driverProfile?.ifscCode || ''}
            helperText="Find IFSC code on the first page of your passbook or on a cheque leaf. It is an 11-character code."
          />
          <BankField label="UPI ID (optional)" value={driverProfile?.upiId || ''} />
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Contact support"
          style={styles.supportRow}
          onPress={() => setIsSupportVisible(true)}
        >
          <Text style={styles.supportText}>Need to change?</Text>
          <Text style={styles.supportLink}>Contact support</Text>
        </Pressable>
      </ScrollView>

      <SupportModal visible={isSupportVisible} onClose={() => setIsSupportVisible(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#eff2f6',
  },
  navShell: {
    backgroundColor: '#ffffff',
  },
  statusSpacer: {
    height: 52,
  },
  topNav: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  backButton: {
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
    fontFamily: 'Poppins',
    fontSize: 20,
    fontWeight: '500',
    lineHeight: 32,
    color: '#1c1c1c',
  },
  scroll: {
    flex: 1,
  },
  content: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
  },
  header: {
    width: '100%',
    gap: 8,
  },
  title: {
    fontFamily: 'Poppins',
    fontSize: 24,
    fontWeight: '500',
    letterSpacing: -1,
    color: '#1c1c1c',
  },
  description: {
    fontFamily: 'Poppins',
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 24,
    color: '#606060',
  },
  fields: {
    width: '100%',
    gap: 24,
    marginTop: 24,
  },
  fieldBlock: {
    width: '100%',
    gap: 16,
  },
  fieldLabel: {
    width: '100%',
    fontFamily: 'Poppins',
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 24,
    color: '#a4a4a4',
  },
  valueBox: {
    width: '100%',
    height: 56,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#a4a4a4',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    overflow: 'hidden',
  },
  valueText: {
    width: '100%',
    fontFamily: 'Poppins',
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 24,
    color: '#a4a4a4',
  },
  helperText: {
    width: '100%',
    fontFamily: 'Poppins',
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 18,
    color: '#a4a4a4',
  },
  supportRow: {
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 40,
    marginBottom : 20
  },
  supportText: {
    fontFamily: 'Poppins',
    fontSize: 18,
    fontWeight: '500',
    color: '#1c1c1c',
  },
  supportLink: {
    fontFamily: 'Poppins',
    fontSize: 18,
    fontWeight: '500',
    color: '#0055cc',
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.12)',
  },
  supportSheet: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    gap: 24,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
    overflow: 'hidden',
  },
  sheetHeader: {
    width: '100%',
    alignItems: 'center',
    padding: 16,
  },
  dragHandle: {
    width: 32,
    height: 4,
    borderRadius: 100,
    backgroundColor: '#79747e',
  },
  supportIntro: {
    width: '100%',
    alignItems: 'center',
    gap: 8,
  },
  supportTitle: {
    width: '100%',
    fontFamily: 'Poppins',
    fontSize: 24,
    fontWeight: '500',
    letterSpacing: -1,
    color: '#29292b',
    textAlign: 'center',
  },
  supportSubtitle: {
    width: '100%',
    fontFamily: 'Poppins',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 21,
    color: '#606060',
    textAlign: 'center',
  },
  supportOptions: {
    width: '100%',
    gap: 8,
  },
  supportOption: {
    width: '100%',
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(27, 124, 255, 0.1)',
    padding: 12,
    overflow: 'hidden',
  },
  supportOptionIcon: {
    width: 52,
    height: 52,
  },
  supportOptionText: {
    flex: 1,
    justifyContent: 'center',
    gap: 4,
    minHeight: 52,
    minWidth: 0,
  },
  supportOptionLabel: {
    fontFamily: 'Poppins',
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 24,
    color: '#606060',
  },
  supportOptionValue: {
    fontFamily: 'Poppins',
    fontSize: 16,
    fontWeight: '500',
    letterSpacing: -0.5,
    color: '#1c1c1c',
  },
});
