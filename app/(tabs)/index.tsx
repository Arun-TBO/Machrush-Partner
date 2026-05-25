import React, { useState, useCallback, useEffect } from 'react';
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
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { auth } from '@/lib/firebase';
import {
  getDriverProfile,
  getLatestDriverAvailability,
  updateDriverAvailability,
} from '@/lib/firestoreOnboardingService';
import {
  getCachedAvailabilityStatus,
  getCachedProfilePhotoUrl,
  setCachedAvailabilityStatus,
  setCachedProfilePhotoUrl,
} from '@/lib/profileCache';
import {
  getDriverActiveDeliveries,
  getDriverTodayEarnings,
  getTodayDeliveries,
  updateDeliveryStatus,
  type Delivery,
} from '@/lib/deliveryService';

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

type DriverStatus = 'online' | 'offline';

interface JobRequestFromDelivery {
  id: string;
  earnings: string;
  pickupDistance: string;
  age: string;
  pickupTitle: string;
  pickupTime: string;
  pickupAddress: string;
  dropTitle: string;
  dropTime: string;
  dropAddress: string;
  prioritySet: number;
  deliveryData: Delivery;
}

function StatusBarBlock() {
  return <View style={styles.statusBar} />;
}

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
  todayEarnings,
  isLoading,
}: {
  driverStatus: DriverStatus;
  onTogglePress: () => void;
  onProfilePress: () => void;
  profilePhotoUrl: string | null;
  todayEarnings: number;
  isLoading: boolean;
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
          {isLoading ? (
            <ActivityIndicator size="small" color="#05c" />
          ) : (
            <>
              <Text style={styles.totalEarning}>₹{todayEarnings.toLocaleString()}</Text>
              <Text style={styles.totalLabel}>Today total earning</Text>
            </>
          )}
        </View>
        <OnlineToggle status={driverStatus} onPress={onTogglePress} />
      </View>
    </View>
  );
}

function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress?: () => void }) {
  return (
    <Pressable style={[styles.chip, active ? styles.chipActive : styles.chipInactive]} onPress={onPress}>
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

// Helper function to get color based on priority set
function getPrioritySetColor(set: number): string {
  switch(set) {
    case 1: return '#ff4444'; // Red - Highest priority (0-20 min)
    case 2: return '#ff8800'; // Orange (20-40 min)
    case 3: return '#ffcc00'; // Yellow (40-60 min)
    case 4: return '#44aa44'; // Green - Lowest priority (60-90 min)
    default: return '#999999';
  }
}

// Helper function to get priority set label
function getPrioritySetLabel(set: number): string {
  switch(set) {
    case 1: return 'URGENT';
    case 2: return 'HIGH';
    case 3: return 'MEDIUM';
    case 4: return 'LOW';
    default: return 'UNKNOWN';
  }
}

function JobCard({ job, onAccept, onReject, isAccepting }: { 
  job: JobRequestFromDelivery; 
  onAccept: (delivery: Delivery) => void;
  onReject: (deliveryId: string) => void;
  isAccepting: boolean;
}) {
  return (
    <View style={[
      styles.jobCard, 
      { borderLeftWidth: 4, borderLeftColor: getPrioritySetColor(job.prioritySet) }
    ]}>
      {/* Priority Set Badge */}
      <View style={[styles.priorityBadge, { backgroundColor: getPrioritySetColor(job.prioritySet) }]}>
        <Text style={styles.priorityBadgeText}>{getPrioritySetLabel(job.prioritySet)}</Text>
      </View>
      
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
        <Pressable style={styles.rejectButton} onPress={() => onReject(job.id)}>
          <Text style={styles.rejectText}>Reject</Text>
        </Pressable>
        <Pressable style={styles.acceptButton} onPress={() => onAccept(job.deliveryData)} disabled={isAccepting}>
          <Text style={styles.acceptText}>{isAccepting ? 'Accepting...' : 'Accept'}</Text>
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

// Helper function to calculate time ago
function getTimeAgo(timestamp: any): string {
  if (!timestamp) return 'Just now';
  
  let date: Date;
  if (timestamp.toDate) {
    date = timestamp.toDate();
  } else if (timestamp instanceof Date) {
    date = timestamp;
  } else if (timestamp.seconds) {
    date = new Date(timestamp.seconds * 1000);
  } else {
    date = new Date(timestamp);
  }

  const now = new Date();
  const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
  
  if (diffInMinutes < 1) return 'Just now';
  if (diffInMinutes === 1) return '1min ago';
  if (diffInMinutes < 60) return `${diffInMinutes}min ago`;
  if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}hr ago`;
  return `${Math.floor(diffInMinutes / 1440)}d ago`;
}

// Helper function to get priority set based on timestamp
function getPrioritySet(timestamp: any): number {
  if (!timestamp) return 4;
  
  let date: Date;
  if (timestamp.toDate) {
    date = timestamp.toDate();
  } else if (timestamp.seconds) {
    date = new Date(timestamp.seconds * 1000);
  } else if (timestamp instanceof Date) {
    date = timestamp;
  } else {
    date = new Date(timestamp);
  }
  
  const now = new Date();
  const ageInMinutes = (now.getTime() - date.getTime()) / (1000 * 60);
  
  if (ageInMinutes <= 20) return 1;
  if (ageInMinutes <= 40) return 2;
  if (ageInMinutes <= 60) return 3;
  return 4;
}

// Helper function to format earnings
function formatEarnings(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`;
}

// Helper function to get pickup distance
function getPickupDistance(delivery: Delivery): string {
  if (delivery.distance?.pickup) {
    return `${Math.round(delivery.distance.pickup)}km pickup`;
  }
  return '2km pickup';
}

// Helper function to get estimated times
function getEstimatedTime(delivery: Delivery, type: 'pickup' | 'drop'): string {
  if (type === 'pickup' && delivery.estimatedTime?.pickup) {
    return `Approx. ${Math.round(delivery.estimatedTime.pickup)} mins`;
  }
  if (type === 'drop' && delivery.estimatedTime?.dropoff) {
    return `Approx. ${Math.round(delivery.estimatedTime.dropoff)} mins`;
  }
  return type === 'pickup' ? 'Approx. 10 mins' : 'Approx. 60 mins';
}

// Convert Delivery to JobRequestFromDelivery
function deliveryToJobRequest(delivery: Delivery): JobRequestFromDelivery {
  const earnings = formatEarnings(delivery.pricing?.total || 0);
  const pickupDistance = getPickupDistance(delivery);
  const age = getTimeAgo(delivery.timestamps?.createdAt);
  const pickupAddress = delivery.locations?.pickup?.address || 'Pickup location';
  const dropAddress = delivery.locations?.dropoff?.address || 'Dropoff location';
  const pickupTime = getEstimatedTime(delivery, 'pickup');
  const dropTime = getEstimatedTime(delivery, 'drop');
  const prioritySet = getPrioritySet(delivery.timestamps?.createdAt);
  
  const isUrgent = delivery.priority === 'urgent';
  const dropTitle = isUrgent ? 'Drop (Urgent)' : `Drop ${delivery.distance?.total ? Math.round(delivery.distance.total) + 'km' : '35 km'}`;
  
  return {
    id: delivery.id,
    earnings,
    pickupDistance,
    age,
    pickupTitle: 'To Pickup',
    pickupTime,
    pickupAddress,
    dropTitle,
    dropTime,
    dropAddress,
    prioritySet,
    deliveryData: delivery,
  };
}

export default function HomeScreen() {
  const router = useRouter();
  const [driverStatus, setDriverStatus] = useState<DriverStatus>('offline');
  const [pendingStatus, setPendingStatus] = useState<DriverStatus | null>(null);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null);
  const [jobRequests, setJobRequests] = useState<JobRequestFromDelivery[]>([]);
  const [todayEarnings, setTodayEarnings] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'nearest' | 'urgent'>('all');
  const [acceptingDeliveryId, setAcceptingDeliveryId] = useState<string | null>(null);

  const loadDriverData = async (showRefresh = false) => {
    if (showRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      const [storedUid, storedIdToken] = await Promise.all([
        AsyncStorage.getItem('firebaseUid'),
        AsyncStorage.getItem('firebaseIdToken'),
      ]);
      const uid = auth.currentUser?.uid || storedUid;
      const idToken = auth.currentUser
        ? await auth.currentUser.getIdToken().catch(() => storedIdToken)
        : storedIdToken;

      if (!uid) {
        setProfilePhotoUrl(null);
        setJobRequests([]);
        setTodayEarnings(0);
        setIsLoading(false);
        setIsRefreshing(false);
        return;
      }

      // Load profile data
      const [cachedPhotoUrl, cachedStatus] = await Promise.all([
        getCachedProfilePhotoUrl(uid),
        getCachedAvailabilityStatus(uid),
      ]);

      if (cachedPhotoUrl) setProfilePhotoUrl(cachedPhotoUrl);
      if (cachedStatus) setDriverStatus(cachedStatus);

      // Load driver profile for photo URL
      const driverProfile = await getDriverProfile(uid, idToken).catch((error) => {
        console.error('Error loading driver profile:', error);
        return null;
      });

      const savedPhotoUrl = driverProfile?.profilePhotoUrl ||
        (driverProfile?.photoUri?.startsWith('http') ? driverProfile.photoUri : null);

      if (savedPhotoUrl) {
        await setCachedProfilePhotoUrl(uid, savedPhotoUrl);
        setProfilePhotoUrl(savedPhotoUrl);
      }

      const earnings = await getDriverTodayEarnings(uid, idToken);
      setTodayEarnings(earnings);

      const todayDeliveries = await getTodayDeliveries(uid, idToken);
      console.log('========== TODAY DELIVERIES ==========');
      console.log(`Total deliveries created today: ${todayDeliveries.length}`);
      console.log('Today deliveries data:', JSON.stringify(todayDeliveries, null, 2));
      console.log('======================================');

      const activeDeliveries = await getDriverActiveDeliveries(uid, idToken);
      
      console.log(`Found ${activeDeliveries.length} active deliveries`);
      
      // Apply additional filters based on selection
      let filteredDeliveries = [...activeDeliveries];
      if (selectedFilter === 'urgent') {
        filteredDeliveries = filteredDeliveries.filter(d => d.priority === 'urgent');
      } else if (selectedFilter === 'nearest') {
        filteredDeliveries.sort((a, b) => {
          const distA = a.distance?.pickup || Infinity;
          const distB = b.distance?.pickup || Infinity;
          return distA - distB;
        });
      }
      
      const jobRequestsData = filteredDeliveries.map(deliveryToJobRequest);
      setJobRequests(jobRequestsData);

      console.log('========== MY DELIVERIES DATA ==========');
      console.log(`Total deliveries: ${activeDeliveries.length}`);
      console.log('Full data:', JSON.stringify(activeDeliveries, null, 2));
      console.log('========================================');

      // Load latest availability status
      const latestStatus = await getLatestDriverAvailability(uid, idToken).catch((error) => {
        console.error('Error loading availability:', error);
        return null;
      });
      
      if (latestStatus) {
        await setCachedAvailabilityStatus(uid, latestStatus);
        setDriverStatus(latestStatus);
      }
    } catch (error) {
      console.error('Error loading driver data:', error);
      Alert.alert('Error', 'Failed to load data. Please try again.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadDriverData(false);
    }, [selectedFilter])
  );

  // Auto-refresh when driver is online
  useEffect(() => {
    let interval: number | null = null;
    
    if (driverStatus === 'online') {
      interval = setInterval(() => {
        loadDriverData(true);
      }, 30000); // Refresh every 30 seconds
    }
    
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [driverStatus, selectedFilter]);

  const handleRefresh = useCallback(() => {
    loadDriverData(true);
  }, [selectedFilter]);

  const handleTogglePress = () => {
    setPendingStatus(driverStatus === 'online' ? 'offline' : 'online');
  };

  const handleConfirmStatus = async () => {
    if (pendingStatus) {
      const nextStatus = pendingStatus;
      setDriverStatus(pendingStatus);
      setPendingStatus(null);

      const [storedUid, storedIdToken] = await Promise.all([
        AsyncStorage.getItem('firebaseUid'),
        AsyncStorage.getItem('firebaseIdToken'),
      ]);
      const uid = auth.currentUser?.uid || storedUid;

      if (uid) {
        await setCachedAvailabilityStatus(uid, nextStatus);
        updateDriverAvailability(uid, nextStatus, storedIdToken);
      }
    }
  };

  const handleProfilePress = () => {
    router.push('/profile');
  };

  const handleAcceptDelivery = async (delivery: Delivery) => {
    setAcceptingDeliveryId(delivery.id);
    
    try {
      await updateDeliveryStatus(delivery.id, 'assigned');
      Alert.alert('Success', 'Delivery accepted successfully!');
      await loadDriverData(true);
    } catch (error) {
      console.error('Error accepting delivery:', error);
      Alert.alert('Error', 'Failed to accept delivery. Please try again.');
    } finally {
      setAcceptingDeliveryId(null);
    }
  };

  const handleRejectDelivery = async (deliveryId: string) => {
    Alert.alert(
      'Reject Delivery',
      'Are you sure you want to reject this delivery?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            try {
              setJobRequests(prev => prev.filter(job => job.id !== deliveryId));
              Alert.alert('Success', 'Delivery rejected');
            } catch (error) {
              console.error('Error rejecting delivery:', error);
              Alert.alert('Error', 'Failed to reject delivery');
              await loadDriverData(true);
            }
          }
        }
      ]
    );
  };

  const handleFilterChange = (filter: 'all' | 'nearest' | 'urgent') => {
    setSelectedFilter(filter);
  };

  if (isLoading && !isRefreshing) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#05c" />
          <Text style={styles.loadingText}>Loading deliveries...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Header
        driverStatus={driverStatus}
        onTogglePress={handleTogglePress}
        onProfilePress={handleProfilePress}
        profilePhotoUrl={profilePhotoUrl}
        todayEarnings={todayEarnings}
        isLoading={isLoading}
      />

      <ScrollView
        style={styles.contentScroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={['#05c']}
          />
        }
      >
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Job Request</Text>
          <Image source={filterImage} style={styles.filterIcon} resizeMode="contain" />
        </View>

        <View style={styles.chipRow}>
          <Chip label="All" active={selectedFilter === 'all'} onPress={() => handleFilterChange('all')} />
          <Chip label="Nearest" active={selectedFilter === 'nearest'} onPress={() => handleFilterChange('nearest')} />
          <Chip label="Urgent" active={selectedFilter === 'urgent'} onPress={() => handleFilterChange('urgent')} />
        </View>

        {jobRequests.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>No active deliveries</Text>
            <Text style={styles.emptyText}>
              {driverStatus === 'online' 
                ? 'You are online. New delivery requests will appear here.' 
                : 'Go online to start receiving delivery requests.'}
            </Text>
          </View>
        ) : (
          jobRequests.map((job) => (
            <JobCard 
              key={job.id} 
              job={job} 
              onAccept={handleAcceptDelivery}
              onReject={handleRejectDelivery}
              isAccepting={acceptingDeliveryId === job.id}
            />
          ))
        )}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#606060',
    fontFamily: 'Poppins',
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    marginTop: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '500',
    color: '#1c1c1c',
    fontFamily: 'Poppins',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#606060',
    fontFamily: 'Poppins',
    textAlign: 'center',
    lineHeight: 20,
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
    position: 'relative',
    overflow: 'hidden',
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
  priorityBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderTopRightRadius: 16,
    borderBottomLeftRadius: 8,
    zIndex: 10,
  },
  priorityBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#ffffff',
    fontFamily: 'Poppins',
  },
});
