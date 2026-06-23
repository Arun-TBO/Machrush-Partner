import React , {useEffect , useState , useRef} from 'react';
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
  Animated,
  PanResponder
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { signOutUser } from '@/lib/firebaseAuthService';
import { auth } from '@/lib/firebase';
import { getDriverProfile } from '@/lib/firestoreOnboardingService';
import { useAppAlert } from '@/components/AppAlertModal';
import {
  getCachedDriverName,
  getCachedProfilePhotoUrl,
  setCachedDriverName,
  setCachedProfilePhotoUrl,
} from '@/lib/profileCache';

import { fs, hit, rs, vs } from '@/lib/responsive';

const profileAvatarImage = require('@/assets/images/profile/profile-avatar.jpg');
const backImage = require('@/assets/images/profile/back.png');
const verifiedBadgeImage = require('@/assets/images/profile/verified-badge.png');
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
const supportCallImage = require('@/assets/images/profile/support-call.png');
const supportEmailImage = require('@/assets/images/profile/support-email.png');
const Paymentpolicy = require('@/assets/images/profile/Paymentpolicy.png');
const menuRows = [
  { id: 'documents', label: 'Documents', icon: documentsImage, iconSize: 24 },
  { id: 'bank', label: 'Bank details', icon: bankImage, iconSize: 20 },
  { id: 'vehicle', label: 'Vehicle details', icon: vehicleImage, iconSize: 20 },
  { id: 'report', label: 'Report a problem', icon: reportImage, iconSize: 24 },
  { id: 'help', label: 'Get Help', icon: helpImage, iconSize: 24 },
  { id: 'terms', label: 'Terms & conditions', icon: termsImage, iconSize: 24 },
  { id: 'Payment policy', label: 'Payment policy', icon: Paymentpolicy, iconSize: 24 },
];

type DeliveryRecord = {
  status?: string;
  review?: {
    rating?: number | string | null;
    isSubmitted?: boolean;
  } | null;
};

const getApiBaseUrl = () => {
  return (process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:5000').replace(/\/$/, '');
};

const isCompletedDelivery = (status?: string) => {
  const normalizedStatus = String(status || '').toLowerCase();
  return normalizedStatus === 'delivered' || normalizedStatus === 'completed' || normalizedStatus === 'paid';
};

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
  onPress,
}: {
  title: string;
  children: React.ReactNode;
  onPress?: () => void;
}) {
  return (
    <Pressable style={styles.statCard} accessibilityRole="button" onPress={onPress}>
      <View style={styles.statHeader}>
        <Text style={styles.statTitle}>{title}</Text>
         {
          title === "Delivery's" && (
               <View style={styles.statArrowCircle}>
          <Image source={statArrowImage} style={styles.statArrowIcon} resizeMode="contain" />
        </View>
          )
         }
         
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
      <Text style={styles.menuLabel} numberOfLines={1}>{label}</Text>
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
        <Text style={styles.supportOptionLabel} numberOfLines={1}>{label}</Text>
        <Text style={styles.supportOptionValue} numberOfLines={1}>{value}</Text>
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
  const insets = useSafeAreaInsets();
   // Drag Modal 
  
      const translateY = useRef(
      new Animated.Value(500)
    ).current;
  
    useEffect(() => {
      if (visible) {
        translateY.setValue(500);
  
        Animated.timing(translateY, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start();
      }
    }, [visible]);
  
    const handleClose = () => {
      Animated.timing(translateY, {
        toValue: 500,
        duration: 250,
        useNativeDriver: true,
      }).start(() => {
       onClose()
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
    <Modal visible={visible} transparent onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={handleClose}>
        
          <Animated.View
                  {...panResponder.panHandlers}
                  style={[
                    styles.supportSheet,
                    {
                      transform: [
                        { translateY },
                      ],
                    },
                  ]}
                >
        


        {/* <Pressable
          style={[styles.supportSheet, { paddingBottom: insets.bottom + 16 }]}
          onPress={(event) => event.stopPropagation()}
        > */}
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
        </Animated.View>
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
  const insets = useSafeAreaInsets();
   // Drag Modal 
  
      const translateY = useRef(
      new Animated.Value(500)
    ).current;
  
    useEffect(() => {
      if (visible) {
        translateY.setValue(500);
  
        Animated.timing(translateY, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start();
      }
    }, [visible]);
  
    const handleClose = () => {
      Animated.timing(translateY, {
        toValue: 500,
        duration: 250,
        useNativeDriver: true,
      }).start(() => {
        onClose()
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
    <Modal visible={visible} transparent   onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={handleClose}>

         <Animated.View
                  {...panResponder.panHandlers}
                  style={[
                    styles.logoutSheet,
                    {
                      transform: [
                        { translateY },
                      ],
                    },
                  ]}
                >

{/* 
        <Pressable
          style={[styles.logoutSheet, { paddingBottom: insets.bottom + 16 }]}
          onPress={(event) => event.stopPropagation()}
        > */}
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
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

export default function ProfileScreen() {
  const [isSupportVisible, setIsSupportVisible] = React.useState(false);
  const [isLogoutVisible, setIsLogoutVisible] = React.useState(false);
  const [profilePhotoUrl, setProfilePhotoUrl] = React.useState<string | null>(null);
  const [driverName, setDriverName] = React.useState('Driver');
  const [averageRating, setAverageRating] = React.useState('0.0');
  const [completedDeliveryCount, setCompletedDeliveryCount] = React.useState(0);
  const router = useRouter();
  const { alertModal } = useAppAlert();

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
    const interval = setInterval(loadProfilePhoto, 5000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [getCurrentProfileSession]);

  useFocusEffect(
    React.useCallback(() => {
      let isActive = true;

      const loadProfileStats = async () => {
        const { uid } = await getCurrentProfileSession();

        if (!uid) {
          if (isActive) {
            setAverageRating('0.0');
            setCompletedDeliveryCount(0);
          }
          return;
        }

        try {
          const response = await fetch(
            `${getApiBaseUrl()}/api/deliveries/driver/${encodeURIComponent(uid)}?type=all`
          );
          const body = (await response.json().catch(() => null)) as {
            success?: boolean;
            data?: DeliveryRecord[];
            error?: string;
          } | null;

          if (!response.ok || body?.success === false) {
            throw new Error(body?.error || 'Unable to load profile stats');
          }

          const deliveries = Array.isArray(body?.data) ? body.data : [];
          const completedCount = deliveries.filter((delivery) =>
            isCompletedDelivery(delivery.status)
          ).length;
          const ratings = deliveries
            .map((delivery) => Number(delivery.review?.rating))
            .filter((rating) => Number.isFinite(rating) && rating > 0);
          const rating = ratings.length
            ? ratings.reduce((sum, value) => sum + value, 0) / ratings.length
            : 0;

          if (isActive) {
            setCompletedDeliveryCount(completedCount);
            setAverageRating(rating.toFixed(1));
          }
        } catch (error) {
          console.error('Error loading profile stats:', error);
        }
      };

      loadProfileStats();
      const interval = setInterval(loadProfileStats, 5000);

      return () => {
        isActive = false;
        clearInterval(interval);
      };
    }, [getCurrentProfileSession])
  );

  const handleConfirmLogout = async () => {
    await Promise.allSettled([
      signOutUser(),
      AsyncStorage.clear(),
    ]);

    setIsLogoutVisible(false);
    router.replace('/phone-number');
  };
 
 

  return (
    <SafeAreaView style={styles.container} >
         
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
        
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.statusSpacer} />
          <TopNav />

          <View style={styles.profileBlock}>
            <View style={styles.profileRow}>
              <View style={styles.identity}>
                 <Text style={styles.driverName} numberOfLines={1} ellipsizeMode="tail">{driverName}</Text>
                <View style={styles.nameRow}>
                 
                  <Image source={verifiedBadgeImage} style={styles.verifiedBadge} resizeMode="contain" />
                  <Text style={styles.verified} numberOfLines={1}>Verified</Text>
                </View>
         
              </View>

              <View style={styles.avatarWrap}>
                <Image
                  source={profilePhotoUrl ? { uri: profilePhotoUrl } : profileAvatarImage}
                  style={styles.avatar}
                  resizeMode="cover"
                />
              </View>
            </View>

            <View style={styles.statsRow}>
              <StatCard title="Review">
                <View style={styles.reviewValueRow}>
                  <Text style={styles.statValue} numberOfLines={1}>{averageRating}</Text>
                  <Image source={starImage} style={styles.starIcon} resizeMode="contain" />
                </View>
              </StatCard>

              <StatCard title="Delivery's" onPress={() => router.push('/my-deliveries')}>
               
                <View style={styles.deliveryValueRow}>
                  <Text style={styles.statValue} numberOfLines={1}>{completedDeliveryCount}</Text>
                  <Text style={styles.completedText} numberOfLines={1}>Completed</Text>
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
            <Text style={styles.logoutText} numberOfLines={1}>Logout</Text>
          </Pressable>
        </View>
         
         
        <Text style={styles.poweredText}>Powered by thebrandopedia</Text>
      </ScrollView>
 
      <SupportModal visible={isSupportVisible} onClose={() => setIsSupportVisible(false)} />
      <LogoutModal
        visible={isLogoutVisible}
        onClose={() => setIsLogoutVisible(false)} 
        onLogout={handleConfirmLogout}
      />
      {alertModal}
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
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    paddingBottom: vs(30),
  },
  header: {
    backgroundColor: '#dbe6f7',
    borderBottomLeftRadius: rs(24),
    borderBottomRightRadius: rs(24),
    overflow: 'hidden',
  },
  statusSpacer: {
    height: vs(40),
  },
  topNav: {
    minHeight: vs(64),
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: rs(4),
    paddingVertical: vs(8),
  },
  backButton: {
    width: hit(48),
    height: hit(48),
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    width: rs(24),
    height: rs(24),
  },
  topNavTitle: {
    flex: 1,
    minWidth: 0,
    color: '#1c1c1c',
    fontFamily: 'Poppins_500Medium',
    fontSize: fs(20),
    fontWeight: '500',
    lineHeight: fs(32),
  },
  profileBlock: {
    gap: vs(16),
    paddingTop: vs(16),
    paddingBottom: vs(22),
  },
  profileRow: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: rs(16),
    gap: rs(16),
  },
  identity: {
    flex: 1,
    gap: vs(4),
    minWidth: 0,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(4),
  },
  driverName: {
    color: '#000000',
    fontFamily: 'Poppins_500Medium',
    fontSize: fs(24),
    fontWeight: '500',
    lineHeight: fs(32),
    letterSpacing: -1,
    flexShrink: 1,
  },
  verified :{
    minWidth: 0,
    flexShrink: 1,
    fontFamily: 'Poppins',
    fontSize: fs(16),
    fontWeight: '500',
    color: '#1FC16B',

  },
  verifiedBadge: {
    width: rs(24),
    height: rs(24),
  },
  viewProfile: {
    color: '#0055cc',
    fontFamily: 'Poppins_400Regular',
    fontSize: fs(16),
    fontWeight: '400',
    lineHeight: fs(24),
  },
  avatarWrap: {
    width: rs(72),
    height: rs(72),
    borderRadius: rs(36),
    overflow: 'hidden',
    backgroundColor: '#ffffff',
  },
  avatar: {
    width: rs(72),
    height: rs(72),
    borderRadius: rs(36),
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: rs(16),
    gap: rs(4),
  },
  statCard: {
    flex: 1,
    minHeight: vs(104),
    borderRadius: rs(16),
    backgroundColor: '#ffffff',
    padding: rs(12),
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minWidth: 0,
  },
  statTitle: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
    color: '#1c1c1c',
    fontFamily: 'Poppins_500Medium',
    fontSize: fs(14),
    fontWeight: '500',
    lineHeight: fs(21),
  },
  statArrowCircle: {
    width: rs(23),
    height: rs(23),
    borderRadius: rs(11.5),
    borderWidth: 0.5,
    borderColor: '#c6c6c6',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  statArrowIcon: {
    width: rs(14),
    height: rs(14),
  },
  reviewValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(4),
    minWidth: 0,
  },
  deliveryValueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: rs(1),
    minWidth: 0,
  },
  statValue: {
    minWidth: 0,
    flexShrink: 1,
    color: '#1c1c1c',
    fontFamily: 'Poppins_500Medium',
    fontSize: fs(32),
    fontWeight: '500',
    lineHeight: fs(32),
  },
  starIcon: {
    width: rs(24),
    height: rs(24),
  },
  completedText: {
    minWidth: 0,
    flexShrink: 1,
    color: '#8e8e8e',
    fontFamily: 'Poppins_400Regular',
    fontSize: fs(12),
    fontWeight: '400',
    lineHeight: fs(18),
    marginBottom: vs(1),
  },
  menuSection: {
    gap: vs(8),
    paddingHorizontal: rs(16),
    paddingTop: vs(16),
    paddingBottom: vs(24),
   
  },
  menuRow: {
    minHeight: vs(67),
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(16),
    borderRadius: rs(12),
    backgroundColor: '#ffffff',
    paddingHorizontal: rs(16),
    paddingVertical: vs(21),
    overflow: 'hidden',
  
  },
  menuLabel: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
    color: '#1c1c1c',
    fontFamily: 'Poppins_500Medium',
    fontSize: fs(16),
    fontWeight: '500',
    lineHeight: fs(20),
    letterSpacing: -0.5,
  },
  chevronIcon: {
    width: rs(24),
    height: rs(24),
  
  },
  logoutRow: {
    minHeight: vs(67),
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(10),
    borderRadius: rs(12),
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#e8e8e8',
    backgroundColor: '#ffffff',
    paddingHorizontal: rs(16),
    paddingVertical: vs(21),
    overflow: 'hidden',
  },
  logoutIcon: {
    width: rs(24),
    height: rs(24),
  },
  logoutText: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
    color: '#d00416',
    fontFamily: 'Poppins_400Regular',
    fontSize: fs(16),
    fontWeight: '400',
    lineHeight: fs(24),
  },
  poweredText: {
    marginTop: vs(0),
    color: '#8e8e8e',
    fontFamily: 'Poppins_400Regular',
    fontSize: fs(16),
    fontWeight: '400',

    textAlign: 'center',
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
  },
  supportSheet: {
    width: '100%',
    alignSelf: 'center',
    gap: vs(24),
    borderTopLeftRadius: rs(28),
    borderTopRightRadius: rs(28),
    backgroundColor: '#ffffff',
    paddingHorizontal: rs(16),
    paddingTop: vs(16),
    paddingBottom: vs(16),
    overflow: 'hidden',
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
  supportIntro: {
    width: '100%',
    alignItems: 'center',
    gap: vs(8),
  },
  supportTitle: {
    width: '100%',
    color: '#29292b',
    fontFamily: 'Poppins_500Medium',
    fontSize: fs(24),
    fontWeight: '500',
    lineHeight: fs(24),
    letterSpacing: -1,
    textAlign: 'center',
  },
  supportSubtitle: {
    width: '100%',
    color: '#606060',
    fontFamily: 'Poppins_400Regular',
    fontSize: fs(14),
    fontWeight: '400',
    lineHeight: fs(21),
    textAlign: 'center',
  },
  supportOptions: {
    width: '100%',
    gap: vs(8),
  },
  supportOption: {
    width: '100%',
    minHeight: vs(76),
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: rs(10),
    borderRadius: rs(8),
    backgroundColor: 'rgba(27, 124, 255, 0.1)',
    padding: rs(12),
    overflow: 'hidden',
  },
  supportOptionIcon: {
    width: rs(52),
    height: rs(52),
  },
  supportOptionText: {
    flex: 1,
    flexShrink: 1,
    justifyContent: 'center',
    gap: vs(4),
    minHeight: vs(52),
    minWidth: 0,
  },
  supportOptionLabel: {
    minWidth: 0,
    flexShrink: 1,
    color: '#606060',
    fontFamily: 'Poppins_400Regular',
    fontSize: fs(16),
    fontWeight: '400',
    lineHeight: fs(24),
  },
  supportOptionValue: {
    minWidth: 0,
    flexShrink: 1,
    color: '#1c1c1c',
    fontFamily: 'Poppins_500Medium',
    fontSize: fs(16),
    fontWeight: '500',
    lineHeight: fs(20),
    letterSpacing: -0.5,
  },
  logoutSheet: {
    width: '100%',
    alignSelf: 'center',
    gap: vs(32),
    borderTopLeftRadius: rs(28),
    borderTopRightRadius: rs(28),
    backgroundColor: '#ffffff',
    paddingHorizontal: rs(16),
    paddingTop: vs(16),
    paddingBottom: vs(16),
    overflow: 'hidden',
  },
  logoutDialog: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e8e8e8',
    borderRadius: rs(16),
    paddingHorizontal: rs(8),
    paddingTop: vs(4),
    paddingBottom: vs(8),
  },
  logoutHeader: {
    width: '100%',
    alignItems: 'center',
    gap: vs(4),
  },
  logoutTitle: {
    color: '#1c1c1c',
    fontFamily: 'Poppins_500Medium',
    fontSize: fs(24),
    letterSpacing: -1,
    textAlign: 'center',
  },
  logoutMessage: {
    width: '100%',
    color: 'rgba(0, 0, 0, 0.75)',
    fontFamily: 'Poppins_400Regular',
    fontSize: fs(16),
    lineHeight: fs(24),
    textAlign: 'center',
  },
  logoutActions: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-around',
    gap: rs(2),
  },
  goBackButton: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#0055cc',
    borderRadius: rs(8),
    minHeight: hit(48)
  },
  goBackButtonText: {
    flexShrink: 1,
    color: '#606060',
    fontFamily: 'Poppins_500Medium',
    fontSize: fs(16),
    lineHeight: fs(19),
    letterSpacing: -0.5,
  },
  confirmLogoutButton: {
    flex: 1.8,
    minHeight: hit(48),
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: rs(8),
    backgroundColor: '#d00416',

  },
  confirmLogoutButtonText: {
    flexShrink: 1,
    color: '#ffffff',
    fontFamily: 'Poppins_500Medium',
    fontSize: fs(16),
    textAlign: 'center',
  },
});
