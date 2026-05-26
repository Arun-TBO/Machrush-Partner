import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ActivityIndicator,
  Alert,
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
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { signOutUser } from '@/lib/firebaseAuthService';
import { auth } from '@/lib/firebase';
import { getDriverProfile, updateDriverProfilePhoto } from '@/lib/firestoreOnboardingService';
import {
  getCachedDriverName,
  getCachedProfilePhotoUrl,
  setCachedDriverName,
  setCachedProfilePhotoUrl,
} from '@/lib/profileCache';

const profileAvatarImage = require('@/assets/images/profile/profile-avatar.png');
const backImage = require('@/assets/images/profile/back.png');
const verifiedBadgeImage = require('@/assets/images/profile/verified-badge.png');
const editImage = require('@/assets/images/profile/edit.png');
const statArrowImage = require('@/assets/images/profile/stat-arrow.png');
const starImage = require('@/assets/images/profile/star.png');
const chevronImage = require('@/assets/images/profile/chevron.png');
const documentsImage = require('@/assets/images/profile/documents.png');
const bankImage = require('@/assets/images/profile/bank.png');
const vehicleImage = require('@/assets/images/profile/vehicle.png');
const reportImage = require('@/assets/images/profile/report.png');
const helpImage = require('@/assets/images/profile/help.png');
const termsImage = require('@/assets/images/profile/terms.png');
const logoutImage = require('@/assets/images/profile/logout.png');
const tabHomeImage = require('@/assets/images/profile/tab-home.png');
const tabEarningsImage = require('@/assets/images/profile/tab-earnings.png');
const tabProfileActiveImage = require('@/assets/images/profile/tab-profile-active.png');
const supportCallImage = require('@/assets/images/profile/support-call.png');
const supportEmailImage = require('@/assets/images/profile/support-email.png');

const menuRows = [
  { id: 'documents', label: 'Documents', icon: documentsImage, iconSize: 24 },
  { id: 'bank', label: 'Bank details', icon: bankImage, iconSize: 20 },
  { id: 'vehicle', label: 'Vehicle details', icon: vehicleImage, iconSize: 20 },
  { id: 'report', label: 'Report a problem', icon: reportImage, iconSize: 24 },
  { id: 'help', label: 'Get Help', icon: helpImage, iconSize: 24 },
  { id: 'terms', label: 'Terms & conditions', icon: termsImage, iconSize: 24 },
];

function TopNav() {
  const router = useRouter();

  return (
    <View style={styles.topNav}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go back"
        style={styles.backButton}
        onPress={() => router.back()}
      >
        <Image source={backImage} style={styles.backIcon} resizeMode="contain" />
      </Pressable>
      <Text style={styles.topNavTitle}>Profile</Text>
    </View>
  );
}

function StatCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Pressable style={styles.statCard} accessibilityRole="button">
      <View style={styles.statHeader}>
        <Text style={styles.statTitle}>{title}</Text>
        <View style={styles.statArrowCircle}>
          <Image source={statArrowImage} style={styles.statArrowIcon} resizeMode="contain" />
        </View>
      </View>
      {children}
    </Pressable>
  );
}

function MenuRow({
  label,
  icon,
  iconSize,
  onPress,
}: {
  label: string;
  icon: ImageSourcePropType;
  iconSize: number;
  onPress?: () => void;
}) {
  return (
    <Pressable style={styles.menuRow} accessibilityRole="button" onPress={onPress}>
      <Image source={icon} style={{ width: iconSize, height: iconSize }} resizeMode="contain" />
      <Text style={styles.menuLabel}>{label}</Text>
      <Image source={chevronImage} style={styles.chevronIcon} resizeMode="contain" />
    </Pressable>
  );
}

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

function LogoutModal({
  visible,
  onClose,
  onLogout,
}: {
  visible: boolean;
  onClose: () => void;
  onLogout: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.logoutSheet} onPress={(event) => event.stopPropagation()}>
          <View style={styles.logoutDialog}>
            <View style={styles.sheetHeader}>
              <View style={styles.dragHandle} />
            </View>

            <View style={styles.logoutHeader}>
              <Text style={styles.logoutTitle}>Logout</Text>
              <Text style={styles.logoutMessage}>Are you sure you want to Logout?</Text>
            </View>
          </View>

          <View style={styles.logoutActions}>
            <Pressable
              style={styles.goBackButton}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              onPress={onClose}
            >
              <Text style={styles.goBackButtonText}>Go back</Text>
            </Pressable>

            <Pressable
              style={styles.confirmLogoutButton}
              accessibilityRole="button"
              accessibilityLabel="Confirm logout"
              onPress={onLogout}
            >
              <Text style={styles.confirmLogoutButtonText}>Logout</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function BottomTabBar() {
  const router = useRouter();

  return (
    <View style={styles.tabBar}>
      <Pressable
        style={styles.tabItem}
        accessibilityRole="button"
        accessibilityLabel="Open home"
        onPress={() => router.push('/(tabs)')}
      >
        <Image source={tabHomeImage} style={styles.tabIcon} resizeMode="contain" />
        <Text style={styles.tabLabel}>Home</Text>
      </Pressable>
      <View style={styles.tabItem}>
        <Image source={tabEarningsImage} style={styles.tabIcon} resizeMode="contain" />
        <Text style={styles.tabLabel}>Earnings</Text>
      </View>
      <View style={styles.tabItem}>
        <Image source={tabProfileActiveImage} style={styles.tabIcon} resizeMode="contain" />
        <Text style={styles.tabLabelActive}>Profile</Text>
      </View>
    </View>
  );
}

export default function ProfileScreen() {
  const [isSupportVisible, setIsSupportVisible] = React.useState(false);
  const [isLogoutVisible, setIsLogoutVisible] = React.useState(false);
  const [profilePhotoUrl, setProfilePhotoUrl] = React.useState<string | null>(null);
  const [driverName, setDriverName] = React.useState('Driver');
  const [isPhotoUploading, setIsPhotoUploading] = React.useState(false);
  const router = useRouter();

  const handleMenuPress = (rowId: string) => {
    if (rowId === 'documents') {
      router.push('/documents');
      return;
    }

    if (rowId === 'bank') {
      router.push('/bank-details');
      return;
    }

    if (rowId === 'vehicle') {
      router.push('/vehicle-details');
      return;
    }

    if (rowId === 'report') {
      router.push('/report-problem');
      return;
    }

    if (rowId === 'help') {
      setIsSupportVisible(true);
    }
  };

  const getCurrentProfileSession = React.useCallback(async () => {
    const [storedUid, storedIdToken] = await Promise.all([
      AsyncStorage.getItem('firebaseUid'),
      AsyncStorage.getItem('firebaseIdToken'),
    ]);

    return {
      uid: auth.currentUser?.uid || storedUid,
      idToken: storedIdToken,
    };
  }, []);

  React.useEffect(() => {
    let isMounted = true;

    const loadProfilePhoto = async () => {
      const { uid, idToken } = await getCurrentProfileSession();

      if (!uid) {
        return;
      }

      const [cachedPhotoUrl, cachedDriverName] = await Promise.all([
        getCachedProfilePhotoUrl(uid),
        getCachedDriverName(uid),
      ]);

      if (isMounted && cachedPhotoUrl) {
        setProfilePhotoUrl(cachedPhotoUrl);
      }
      if (isMounted && cachedDriverName) {
        setDriverName(cachedDriverName);
      }

      const driverProfile = await getDriverProfile(uid, idToken);
      const savedPhotoUrl =
        driverProfile?.profilePhotoUrl ||
        (driverProfile?.photoUri?.startsWith('http') ? driverProfile.photoUri : null);
      const savedDriverName = driverProfile?.fullName?.trim();

      if (savedPhotoUrl) {
        await setCachedProfilePhotoUrl(uid, savedPhotoUrl);
      }
      if (savedDriverName) {
        await setCachedDriverName(uid, savedDriverName);
      }

      if (isMounted) {
        setProfilePhotoUrl(savedPhotoUrl || cachedPhotoUrl || null);
        setDriverName(savedDriverName || cachedDriverName || 'Driver');
      }
    };

    loadProfilePhoto();

    return () => {
      isMounted = false;
    };
  }, [getCurrentProfileSession]);

  const handleEditProfilePhoto = async () => {
    try {
      let { uid, idToken } = await getCurrentProfileSession();

      if (!uid) {
        Alert.alert('Login required', 'Please login again before updating your profile picture.');
        router.replace('/phone-number');
        return;
      }

      // Refresh the ID token to ensure it's not expired
      if (auth.currentUser) {
        try {
          idToken = await auth.currentUser.getIdToken(true);
          await AsyncStorage.setItem('firebaseIdToken', idToken);
        } catch {
          // Use whatever we have from session
        }
      }

      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert('Permission needed', 'Please allow gallery access to choose a profile photo.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        base64: true,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.6,
      });

      if (result.canceled) {
        return;
      }

      const selectedAsset = result.assets[0];

      // Use the file URI directly on native (not the base64 data URL)
      // This ensures reliable blob conversion in the SDK storage upload path
      let selectedUri = selectedAsset?.uri;

      // Only fall back to base64 data URL if we need the backend path
      // (i.e. auth.currentUser is not set, requiring the REST path with idToken)
      if (!auth.currentUser && selectedAsset?.base64) {
        selectedUri = `data:${selectedAsset.mimeType || 'image/jpeg'};base64,${selectedAsset.base64}`;
      }

      if (!selectedUri) {
        return;
      }

      setProfilePhotoUrl(selectedUri);
      setIsPhotoUploading(true);

      const uploadedPhotoUrl = await updateDriverProfilePhoto(uid, selectedUri, idToken);
      await setCachedProfilePhotoUrl(uid, uploadedPhotoUrl);
      setProfilePhotoUrl(uploadedPhotoUrl);
    } catch (error) {
      console.error('Error updating profile photo:', error);
      Alert.alert('Upload failed', 'Could not update your profile photo. Please try again.');
    } finally {
      setIsPhotoUploading(false);
    }
  };

  const handleConfirmLogout = async () => {
    await Promise.allSettled([
      signOutUser(),
      AsyncStorage.clear(),
    ]);

    setIsLogoutVisible(false);
    router.replace('/phone-number');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.statusSpacer} />
          <TopNav />

          <View style={styles.profileBlock}>
            <View style={styles.profileRow}>
              <View style={styles.identity}>
                <View style={styles.nameRow}>
                  <Text style={styles.driverName}>{driverName}</Text>
                  <Image source={verifiedBadgeImage} style={styles.verifiedBadge} resizeMode="contain" />
                </View>
                <Text style={styles.viewProfile}>View Profile</Text>
              </View>

              <View style={styles.avatarWrap}>
                <Image
                  source={profilePhotoUrl ? { uri: profilePhotoUrl } : profileAvatarImage}
                  style={styles.avatar}
                  resizeMode="cover"
                />
                {isPhotoUploading ? (
                  <View style={styles.avatarLoading}>
                    <ActivityIndicator color="#0055cc" size="small" />
                  </View>
                ) : null}
              </View>
              <Pressable
                style={styles.editButton}
                accessibilityRole="button"
                accessibilityLabel="Edit profile picture"
                disabled={isPhotoUploading}
                onPress={handleEditProfilePhoto}
              >
                <Image source={editImage} style={styles.editIcon} resizeMode="contain" />
              </Pressable>
            </View>

            <View style={styles.statsRow}>
              <StatCard title="Review">
                <View style={styles.reviewValueRow}>
                  <Text style={styles.statValue}>4.8</Text>
                  <Image source={starImage} style={styles.starIcon} resizeMode="contain" />
                </View>
              </StatCard>

              <StatCard title="Delivery's">
                <View style={styles.deliveryValueRow}>
                  <Text style={styles.statValue}>12</Text>
                  <Text style={styles.completedText}>Completed</Text>
                </View>
              </StatCard>
            </View>
          </View>
        </View>

        <View style={styles.menuSection}>
          {menuRows.map((row) => (
            <MenuRow
              key={row.id}
              label={row.label}
              icon={row.icon}
              iconSize={row.iconSize}
              onPress={() => handleMenuPress(row.id)}
            />
          ))}

          <Pressable
            style={styles.logoutRow}
            accessibilityRole="button"
            accessibilityLabel="Open logout confirmation"
            onPress={() => setIsLogoutVisible(true)}
          >
            <Image source={logoutImage} style={styles.logoutIcon} resizeMode="contain" />
            <Text style={styles.logoutText}>Logout</Text>
          </Pressable>
        </View>

        <Text style={styles.poweredText}>Powered by thebrandopedia</Text>
      </ScrollView>

      <BottomTabBar />
      <SupportModal visible={isSupportVisible} onClose={() => setIsSupportVisible(false)} />
      <LogoutModal
        visible={isLogoutVisible}
        onClose={() => setIsLogoutVisible(false)}
        onLogout={handleConfirmLogout}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#eff2f6',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 108,
  },
  header: {
    backgroundColor: '#dbe6f7',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    overflow: 'hidden',
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
  topNavTitle: {
    fontFamily: 'Poppins',
    fontSize: 20,
    fontWeight: '500',
    lineHeight: 32,
    color: '#1c1c1c',
  },
  profileBlock: {
    gap: 16,
    paddingTop: 16,
    paddingBottom: 22,
  },
  profileRow: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    gap: 16,
  },
  identity: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  driverName: {
    fontFamily: 'Poppins',
    fontSize: 24,
    fontWeight: '500',
    letterSpacing: -1,
    color: '#000000',
  },
  verifiedBadge: {
    width: 24,
    height: 24,
  },
  viewProfile: {
    fontFamily: 'Poppins',
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 24,
    color: '#0055cc',
  },
  avatarWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    overflow: 'hidden',
    backgroundColor: '#ffffff',
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  avatarLoading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.64)',
  },
  editButton: {
    position: 'absolute',
    right: 16,
    top: 40,
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: '#0055cc',
    backgroundColor: '#dbe6f7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editIcon: {
    width: 16,
    height: 16,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    gap: 4,
  },
  statCard: {
    flex: 1,
    height: 104,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    padding: 12,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statTitle: {
    fontFamily: 'Poppins',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 21,
    color: '#1c1c1c',
  },
  statArrowCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: '#bbbbbb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statArrowIcon: {
    width: 20,
    height: 20,
    transform: [{ rotate: '45deg' }],
  },
  reviewValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  deliveryValueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  statValue: {
    fontFamily: 'Poppins',
    fontSize: 32,
    fontWeight: '500',
    lineHeight: 32,
    color: '#1c1c1c',
  },
  starIcon: {
    width: 24,
    height: 24,
  },
  completedText: {
    fontFamily: 'Poppins',
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 18,
    color: '#8e8e8e',
    marginBottom: 1,
  },
  menuSection: {
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 34,
  },
  menuRow: {
    minHeight: 67,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 21,
    overflow: 'hidden',
  },
  menuLabel: {
    flex: 1,
    fontFamily: 'Poppins',
    fontSize: 16,
    fontWeight: '500',
    letterSpacing: -0.5,
    color: '#1c1c1c',
  },
  chevronIcon: {
    width: 24,
    height: 24,
    transform: [{ rotate: '-90deg' }],
  },
  logoutRow: {
    minHeight: 67,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#e8e8e8',
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 21,
    overflow: 'hidden',
  },
  logoutIcon: {
    width: 24,
    height: 24,
  },
  logoutText: {
    fontFamily: 'Poppins',
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 24,
    color: '#d00416',
  },
  poweredText: {
    marginTop: 18,
    fontFamily: 'Poppins',
    fontSize: 16,
    fontWeight: '400',
    letterSpacing: -0.5,
    color: '#8e8e8e',
    textAlign: 'center',
  },
  tabBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: '#a4cbff',
    backgroundColor: '#eff2f6',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  tabIcon: {
    width: 28,
    height: 28,
  },
  tabLabel: {
    fontFamily: 'Poppins',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 21,
    color: '#606060',
    textAlign: 'center',
  },
  tabLabelActive: {
    fontFamily: 'Poppins',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 21,
    color: '#1c1c1c',
    textAlign: 'center',
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
  },
  supportSheet: {
    width: '100%',
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
  logoutSheet: {
    width: '100%',
    gap: 32,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: '#ffffff',
    padding: 16,
    overflow: 'hidden',
  },
  logoutDialog: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e8e8e8',
    borderRadius: 16,
    paddingHorizontal: 8,
    paddingTop: 4,
    paddingBottom: 8,
  },
  logoutHeader: {
    width: '100%',
    alignItems: 'center',
    gap: 4,
  },
  logoutTitle: {
    fontFamily: 'Poppins',
    fontSize: 24,
    fontWeight: '500',
    letterSpacing: -1,
    color: '#1c1c1c',
    textAlign: 'center',
  },
  logoutMessage: {
    width: '100%',
    fontFamily: 'Lato',
    fontSize: 16,
    fontWeight: '400',
    color: 'rgba(0, 0, 0, 0.75)',
    textAlign: 'center',
  },
  logoutActions: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  goBackButton: {
    width: 120,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#0055cc',
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    overflow: 'hidden',
  },
  goBackButtonText: {
    fontFamily: 'Poppins',
    fontSize: 16,
    fontWeight: '500',
    letterSpacing: -0.5,
    color: '#606060',
    textAlign: 'center',
  },
  confirmLogoutButton: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: '#d00416',
    paddingHorizontal: 24,
    paddingVertical: 12,
    overflow: 'hidden',
  },
  confirmLogoutButtonText: {
    fontFamily: 'Poppins',
    fontSize: 16,
    fontWeight: '500',
    letterSpacing: -0.5,
    color: '#ffffff',
    textAlign: 'center',
  },
});
