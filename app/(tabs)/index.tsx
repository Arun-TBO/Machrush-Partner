import React, { useState } from 'react';
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
import { getDriverProfile } from '@/lib/firestoreOnboardingService';
import { getCachedProfilePhotoUrl, setCachedProfilePhotoUrl } from '@/lib/profilePhotoCache';

const profileImage = require('@/assets/images/home-profile.png');
const mapPinImage = require('@/assets/images/home-map-pin.png');
const filterImage = require('@/assets/images/home-filter.png');
const pickupImage = require('@/assets/images/home-pickup.png');
const dropImage = require('@/assets/images/home-drop.png');
const homeTabImage = require('@/assets/images/home-tab-home.png');
const deliveriesTabImage = require('@/assets/images/home-tab-deliveries.png');
const profileTabImage = require('@/assets/images/home-tab-profile.png');
const onlineImportantImage = require('@/assets/images/driver-online-important.png');
const offlineImportantImage = require('@/assets/images/driver-offline-important.png');

const jobRequests = [
  {
    id: 'job-1',
    earnings: '₹2,200',
    pickupDistance: '5km pickup',
    age: '16min ago',
    pickupTitle: 'To Pickup',
    pickupTime: 'Approx. 10 mins',
    pickupAddress: 'Sobi Engineering, Porur',
    dropTitle: 'Drop 35 km',
    dropTime: 'Approx. 60 mins',
    dropAddress: 'Ram CNC Works, Gandhipuram',
  },
  {
    id: 'job-2',
    earnings: '₹2,200',
    pickupDistance: '5km pickup',
    age: '16min ago',
    pickupTitle: 'To Pickup',
    pickupTime: 'Approx. 10 mins',
    pickupAddress: 'Sobi Engineering, Porur',
    dropTitle: 'Drop 35 km',
    dropTime: 'Approx. 60 mins',
    dropAddress: 'Ram CNC Works, Gandhipuram',
  },
];

function StatusBarBlock() {
  return (
    <View style={styles.statusBar}>
     
    </View>
  );
}

type DriverStatus = 'online' | 'offline';

function OnlineToggle({
  status,
  onPress,
}: {
  status: DriverStatus;
  onPress: () => void;
}) {
  const isOnline = status === 'online';

  return (
    <Pressable
      style={[
        styles.statusToggle,
        isOnline ? styles.onlineToggle : styles.offlineToggle,
      ]}
      onPress={onPress}
    >
      {!isOnline && <View style={styles.statusKnob} />}
      <Text style={styles.statusToggleText}>{isOnline ? 'Online' : 'Offline'}</Text>
      {isOnline && <View style={styles.statusKnob} />}
    </Pressable>
  );
}

function Header({
  driverStatus,
  onTogglePress,
  onProfilePress,
  profilePhotoUrl,
}: {
  driverStatus: DriverStatus;
  onTogglePress: () => void;
  onProfilePress: () => void;
  profilePhotoUrl: string | null;
}) {
  return (
    <View style={styles.header}>
      <StatusBarBlock />
      <View style={styles.locationRow}>
        <View style={styles.locationTextWrap}>
          <View style={styles.locationTitleRow}>
            <Image source={mapPinImage} style={styles.locationIcon} resizeMode="contain" />
            <Text style={styles.locationTitle}>Porur, Chennai</Text>
          </View>
          <Text style={styles.locationSubtitle}>Papanthangal, Chennai, Tamil Nadu, India</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open profile"
          onPress={onProfilePress}
        >
          <Image
            source={profilePhotoUrl ? { uri: profilePhotoUrl } : profileImage}
            style={styles.profileImage}
            resizeMode="cover"
          />
        </Pressable>
      </View>

      <View style={styles.earningRow}>
        <View>
          <Text style={styles.totalEarning}>₹2,200</Text>
          <Text style={styles.totalLabel}>Today total earning</Text>
        </View>
        <OnlineToggle status={driverStatus} onPress={onTogglePress} />
      </View>
    </View>
  );
}

function Chip({ label, active }: { label: string; active?: boolean }) {
  return (
    <Pressable style={[styles.chip, active ? styles.chipActive : styles.chipInactive]}>
      <Text style={[styles.chipText, active ? styles.chipTextActive : styles.chipTextInactive]}>
        {label}
      </Text>
    </Pressable>
  );
}

function RoutePoint({
  icon,
  title,
  time,
  address,
}: {
  icon: ImageSourcePropType;
  title: string;
  time: string;
  address: string;
}) {
  return (
    <View style={styles.routePoint}>
      <Image source={icon} style={styles.routeIcon} resizeMode="contain" />
      <View style={styles.routeTextWrap}>
        <View style={styles.routeMetaRow}>
          <Text style={styles.routeTitle}>{title}</Text>
          <Text style={styles.routeTime}>{time}</Text>
        </View>
        <Text style={styles.routeAddress} numberOfLines={1}>
          {address}
        </Text>
      </View>
    </View>
  );
}

function JobCard({ job }: { job: (typeof jobRequests)[number] }) {
  return (
    <View style={styles.jobCard}>
      <View style={styles.jobTopRow}>
        <View>
          <Text style={styles.estimateLabel}>Estimated earnings</Text>
          <Text style={styles.cardEarning}>{job.earnings}</Text>
        </View>
        <View style={styles.jobMeta}>
          <View style={styles.pickupBadge}>
            <Text style={styles.pickupBadgeText}>{job.pickupDistance}</Text>
          </View>
          <Text style={styles.jobAge}>{job.age}</Text>
        </View>
      </View>

      <View style={styles.routeBox}>
        <RoutePoint
          icon={pickupImage}
          title={job.pickupTitle}
          time={job.pickupTime}
          address={job.pickupAddress}
        />
        <View style={styles.routeSeparator} />
        <RoutePoint
          icon={dropImage}
          title={job.dropTitle}
          time={job.dropTime}
          address={job.dropAddress}
        />
        <View style={styles.routeConnector}>
          <View style={styles.routeDash} />
        </View>
      </View>

      <View style={styles.cardActions}>
        <Pressable style={styles.rejectButton}>
          <Text style={styles.rejectText}>Reject</Text>
        </Pressable>
        <Pressable style={styles.acceptButton}>
          <Text style={styles.acceptText}>Accept</Text>
        </Pressable>
      </View>
    </View>
  );
}

function DriverTabBar({ onProfilePress }: { onProfilePress: () => void }) {
  return (
    <View style={styles.driverTabBar}>
      <View style={styles.tabItem}>
        <Image source={homeTabImage} style={styles.tabIcon} resizeMode="contain" />
        <Text style={styles.tabLabelActive}>Home</Text>
      </View>
      <View style={styles.tabItem}>
        <Image source={deliveriesTabImage} style={styles.tabIcon} resizeMode="contain" />
        <Text style={styles.tabLabel}>My Deliveries</Text>
      </View>
      <Pressable
        style={styles.tabItem}
        accessibilityRole="button"
        accessibilityLabel="Open profile"
        onPress={onProfilePress}
      >
        <Image source={profileTabImage} style={styles.tabIcon} resizeMode="contain" />
        <Text style={styles.tabLabel}>Profile</Text>
      </Pressable>
    </View>
  );
}

function StatusConfirmModal({
  targetStatus,
  visible,
  onCancel,
  onConfirm,
}: {
  targetStatus: DriverStatus;
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const goingOnline = targetStatus === 'online';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.confirmOverlay}>
        <View style={styles.confirmCard}>
          <View style={styles.confirmContent}>
            <View
              style={[
                styles.confirmIconCircle,
                goingOnline ? styles.confirmIconOnline : styles.confirmIconOffline,
              ]}
            >
              <Image
                source={goingOnline ? onlineImportantImage : offlineImportantImage}
                style={styles.confirmIcon}
                resizeMode="contain"
              />
            </View>
            <View style={styles.confirmTextGroup}>
              <Text style={styles.confirmTitle}>
                {goingOnline ? 'Go online again?' : 'Go offline?'}
              </Text>
              <Text style={styles.confirmDescription}>
                {goingOnline
                  ? 'After going online you will start receiving\nnew ride requests.'
                  : 'You will stop receiving new\ndelivery requests'}
              </Text>
            </View>
          </View>

          <View style={styles.confirmActions}>
            <Pressable style={styles.confirmNoButton} onPress={onCancel}>
              <Text style={styles.confirmNoText}>No</Text>
            </Pressable>
            <Pressable
              style={[
                styles.confirmYesButton,
                goingOnline ? styles.confirmYesOnline : styles.confirmYesOffline,
              ]}
              onPress={onConfirm}
            >
              <Text style={styles.confirmYesText}>{goingOnline ? 'Yes' : 'Yes, Cancel'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const [driverStatus, setDriverStatus] = useState<DriverStatus>('online');
  const [pendingStatus, setPendingStatus] = useState<DriverStatus | null>(null);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null);

  useFocusEffect(
    React.useCallback(() => {
      let isActive = true;

      const loadProfilePhoto = async () => {
        const [storedUid, storedIdToken] = await Promise.all([
          AsyncStorage.getItem('firebaseUid'),
          AsyncStorage.getItem('firebaseIdToken'),
        ]);
        const uid = auth.currentUser?.uid || storedUid;

        if (!uid) {
          if (isActive) {
            setProfilePhotoUrl(null);
          }
          return;
        }

        const cachedPhotoUrl = await getCachedProfilePhotoUrl(uid);
        if (isActive && cachedPhotoUrl) {
          setProfilePhotoUrl(cachedPhotoUrl);
        }

        const driverProfile = await getDriverProfile(uid, storedIdToken);
        const savedPhotoUrl =
          driverProfile?.profilePhotoUrl ||
          (driverProfile?.photoUri?.startsWith('http') ? driverProfile.photoUri : null);

        if (savedPhotoUrl) {
          await setCachedProfilePhotoUrl(uid, savedPhotoUrl);
        }

        if (isActive) {
          setProfilePhotoUrl(savedPhotoUrl || cachedPhotoUrl || null);
        }
      };

      loadProfilePhoto();

      return () => {
        isActive = false;
      };
    }, [])
  );

  const handleTogglePress = () => {
    setPendingStatus(driverStatus === 'online' ? 'offline' : 'online');
  };

  const handleConfirmStatus = () => {
    if (pendingStatus) {
      setDriverStatus(pendingStatus);
      setPendingStatus(null);
    }
  };

  const handleProfilePress = () => {
    router.push('/profile');
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header
        driverStatus={driverStatus}
        onTogglePress={handleTogglePress}
        onProfilePress={handleProfilePress}
        profilePhotoUrl={profilePhotoUrl}
      />

      <ScrollView
        style={styles.contentScroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Job Request</Text>
          <Image source={filterImage} style={styles.filterIcon} resizeMode="contain" />
        </View>

        <View style={styles.chipRow}>
          <Chip label="All" active />
          <Chip label="Nearest" />
          <Chip label="Urgent" />
        </View>

        {jobRequests.map((job) => (
          <JobCard key={job.id} job={job} />
        ))}
      </ScrollView>

      <DriverTabBar onProfilePress={handleProfilePress} />
      <StatusConfirmModal
        targetStatus={pendingStatus || 'online'}
        visible={pendingStatus !== null}
        onCancel={() => setPendingStatus(null)}
        onConfirm={handleConfirmStatus}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#eff2f6',
  },
  header: {
    backgroundColor: '#dbe6f7',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    paddingBottom: 24,
  },
  statusBar: {
    height: 52,
    paddingHorizontal: 24,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  statusTime: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1d1b20',
    fontFamily: 'Roboto',
    lineHeight: 20,
    letterSpacing: 0.14,
  },
  statusIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    gap: 16,
  },
  locationTextWrap: {
    flex: 1,
  },
  locationTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationIcon: {
    width: 24,
    height: 24,
  },
  locationTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1c1c1a',
    fontFamily: 'Lato',
    lineHeight: 19.2,
  },
  locationSubtitle: {
    marginTop: 1,
    fontSize: 12,
    fontWeight: '400',
    color: '#5e5e58',
    fontFamily: 'Lato',
  },
  profileImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ffffff',
  },
  earningRow: {
    marginTop: 20,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  totalEarning: {
    fontSize: 40,
    fontWeight: '500',
    color: '#1c1c1c',
    fontFamily: 'Poppins',
    lineHeight: 48,
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '400',
    color: '#606060',
    fontFamily: 'Poppins',
    lineHeight: 21,
  },
  statusToggle: {
    width: 98,
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 100,
    paddingVertical: 2,
  },
  onlineToggle: {
    backgroundColor: '#05c',
    paddingLeft: 8,
    paddingRight: 4,
  },
  offlineToggle: {
    backgroundColor: '#8e8e8e',
    paddingLeft: 4,
    paddingRight: 8,
  },
  statusToggleText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: '#ffffff',
    fontFamily: 'Poppins',
    lineHeight: 21,
    textAlign: 'center',
  },
  statusKnob: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    shadowColor: '#000000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  contentScroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 24,
    gap: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '500',
    color: '#1c1c1c',
    fontFamily: 'Poppins',
    letterSpacing: -1,
  },
  filterIcon: {
    width: 24,
    height: 24,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  chip: {
    flex: 1,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  chipActive: {
    backgroundColor: '#1c1c1c',
  },
  chipInactive: {
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.15)',
    backgroundColor: 'transparent',
  },
  chipText: {
    fontSize: 14,
    textAlign: 'center',
  },
  chipTextActive: {
    fontSize: 12,
    fontWeight: '500',
    color: '#ffffff',
    fontFamily: 'Poppins',
    lineHeight: 18,
  },
  chipTextInactive: {
    fontWeight: '400',
    color: '#5e5e58',
    fontFamily: 'DM Sans',
  },
  jobCard: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    gap: 16,
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  jobTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  estimateLabel: {
    fontSize: 12,
    fontWeight: '400',
    color: '#5e5e58',
    fontFamily: 'Poppins',
    lineHeight: 18,
  },
  cardEarning: {
    fontSize: 32,
    fontWeight: '500',
    color: '#1c1c1c',
    fontFamily: 'Poppins',
    lineHeight: 32,
  },
  jobMeta: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    minHeight: 50,
  },
  pickupBadge: {
    backgroundColor: '#ffdb43',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  pickupBadgeText: {
    fontSize: 14,
    fontWeight: '400',
    color: '#000000',
    fontFamily: 'Poppins',
    lineHeight: 21,
  },
  jobAge: {
    fontSize: 12,
    fontWeight: '400',
    color: '#606060',
    fontFamily: 'Poppins',
    lineHeight: 18,
  },
  routeBox: {
    position: 'relative',
    width: '100%',
    borderWidth: 1,
    borderColor: '#bbbbbb',
    borderRadius: 12,
    backgroundColor: '#ffffff',
    padding: 8,
    gap: 8,
    overflow: 'hidden',
  },
  routePoint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    minHeight: 42,
  },
  routeIcon: {
    width: 20,
    height: 20,
    zIndex: 2,
  },
  routeTextWrap: {
    flex: 1,
    justifyContent: 'center',
  },
  routeMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  routeTitle: {
    fontSize: 12,
    fontWeight: '500',
    color: '#1c1c1c',
    fontFamily: 'Poppins',
    lineHeight: 18,
  },
  routeTime: {
    flex: 1,
    fontSize: 12,
    fontWeight: '500',
    color: '#05c',
    fontFamily: 'Satoshi',
  },
  routeAddress: {
    fontSize: 16,
    fontWeight: '400',
    color: '#616161',
    fontFamily: 'Poppins',
    lineHeight: 24,
  },
  routeSeparator: {
    height: 1,
    marginLeft: 44,
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#d6d6d6',
  },
  routeConnector: {
    position: 'absolute',
    left: 17,
    top: 29,
    height: 58,
    width: 1,
    alignItems: 'center',
  },
  routeDash: {
    width: 1,
    height: 58,
    borderLeftWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#2f8dff',
  },
  cardActions: {
    flexDirection: 'row',
    gap: 12,
  },
  rejectButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#05c',
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#606060',
    fontFamily: 'Poppins',
    letterSpacing: -0.5,
  },
  acceptButton: {
    flex: 1,
    backgroundColor: '#1fc16b',
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#ffffff',
    fontFamily: 'Poppins',
    letterSpacing: -0.5,
  },
  driverTabBar: {
    borderTopWidth: 1,
    borderTopColor: '#a4cbff',
    backgroundColor: '#eff2f6',
    flexDirection: 'row',
    gap: 10,
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
  tabLabelActive: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1c1c1c',
    fontFamily: 'Poppins',
    lineHeight: 21,
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: '400',
    color: '#606060',
    fontFamily: 'Poppins',
    lineHeight: 21,
  },
  confirmOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.24)',
  },
  confirmCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 12,
    gap: 24,
    alignItems: 'center',
    overflow: 'hidden',
  },
  confirmContent: {
    width: '100%',
    gap: 16,
    alignItems: 'center',
  },
  confirmIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  confirmIconOnline: {
    backgroundColor: '#05c',
  },
  confirmIconOffline: {
    backgroundColor: '#d00416',
  },
  confirmIcon: {
    width: 60,
    height: 60,
  },
  confirmTextGroup: {
    width: '100%',
    gap: 4,
    alignItems: 'center',
  },
  confirmTitle: {
    width: '100%',
    fontSize: 24,
    fontWeight: '500',
    color: '#1c1c1c',
    fontFamily: 'Poppins',
    textAlign: 'center',
    letterSpacing: -1,
  },
  confirmDescription: {
    width: '100%',
    fontSize: 16,
    fontWeight: '400',
    color: '#606060',
    fontFamily: 'Poppins',
    lineHeight: 24,
    textAlign: 'center',
  },
  confirmActions: {
    width: '100%',
    flexDirection: 'row',
    gap: 10,
  },
  confirmNoButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#05c',
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmNoText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#606060',
    fontFamily: 'Poppins',
    letterSpacing: -0.5,
  },
  confirmYesButton: {
    flex: 1,
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmYesOnline: {
    backgroundColor: '#05c',
  },
  confirmYesOffline: {
    backgroundColor: '#d00416',
  },
  confirmYesText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#ffffff',
    fontFamily: 'Poppins',
    letterSpacing: -0.5,
  },
});
