import React, { useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { auth } from '@/lib/firebase';
import { useAppAlert } from '@/components/AppAlertModal';
import { fs, hit, rs, vs } from '@/lib/responsive';
import {
  getDriverProfile,
  getLatestDriverAvailability,
  updateDriverAvailability,
} from '@/lib/firestoreOnboardingService';
import {
  getCachedAvailabilityChangedAtMs,
  getCachedAvailabilityStatus,
  getCachedProfilePhotoUrl,
  setCachedAvailabilityChangedAtMs,
  setCachedAvailabilityStatus,
  setCachedProfilePhotoUrl,
} from '@/lib/profileCache';

const pickAndDropIcon = require('@/assets/images/pickAndDropIcon.png');
const profileImage = require('@/assets/images/home-profile.jpg');
const mapPinImage = require('@/assets/images/home-map-pin.png');
const pickupImage = require('@/assets/images/home-pickup.png');
const dropImage = require('@/assets/images/home-drop.png');
const onlineImportantImage = require('@/assets/images/driver-online-important.png');
const offlineImportantImage = require('@/assets/images/driver-offline-important.png');

type CurrentLocationLabel = {
  area: string;
  district: string;
};

const DRIVER_ONLINE_MAX_DURATION_MS = 12 * 60 * 60 * 1000;

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

type DeliveryTimestamp =
  | string
  | number
  | Date
  | {
      seconds?: number;
      _seconds?: number;
      toDate?: () => Date;
    };

type OpenDelivery = {
  id?: string;
  driverId?: string | null;
  status?: string;
  sender?: {
    name?: string;
    phone?: string;
  };
  receiver?: {
    name?: string;
    phone?: string;
  };
  vehicle?: {
    id?: string;
    name?: string;
    imageKey?: string;
    type?: string;
    vehicleType?: string;
  };
  locations?: {
    pickup?: {
      address?: string;
      coords?: {
        lat?: number;
        lng?: number;
      } | null;
    };
    dropoff?: {
      address?: string;
      coords?: {
        lat?: number;
        lng?: number;
      } | null;
    };
  };
  pickupTime?: string | null;
  dropoffTime?: string | null;
  pricing?: {
    tripFare?: number | string;
    total?: number | string;
    distanceKm?: number | string;
    distance?: number | string;
  };
  timestamps?: {
    createdAt?: DeliveryTimestamp;
    deliveredAt?: DeliveryTimestamp;
  };
};

type DeliveryLocation = NonNullable<OpenDelivery['locations']>;
type DeliveryPoint = DeliveryLocation['pickup'];

type JobRequest = {
  id: string;
  deliveryId: string;
  isResumeTrip: boolean;
  earnings: string;
  pickupDistance: string;
  age: string;
  pickupTitle: string;
  pickupTime: string;
  pickupAddress: string;
  dropTitle: string;
  dropTime: string;
  dropAddress: string;
};

const getApiBaseUrl = () => {
  return (process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:5000').replace(/\/$/, '');
};

const formatCurrency = (value: unknown) => {
  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return '\u20b90';
  }

  return `\u20b9${amount.toLocaleString('en-IN', {
    maximumFractionDigits: 0,
  })}`;
};

const readTimestampMs = (value: DeliveryTimestamp | undefined) => {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return new Date(value).getTime() || 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  if (typeof value._seconds === 'number') return value._seconds * 1000;
  if (typeof value.seconds === 'number') return value.seconds * 1000;
  return 0;
};

const isSameLocalDay = (leftMs: number, rightMs: number) => {
  if (!leftMs || !rightMs) {
    return false;
  }

  const leftDate = new Date(leftMs);
  const rightDate = new Date(rightMs);

  return (
    leftDate.getFullYear() === rightDate.getFullYear() &&
    leftDate.getMonth() === rightDate.getMonth() &&
    leftDate.getDate() === rightDate.getDate()
  );
};

const formatAge = (createdAt: DeliveryTimestamp | undefined) => {
  const createdMs = readTimestampMs(createdAt);

  if (!createdMs) {
    return 'Just now';
  }

  const diffMinutes = Math.max(0, Math.floor((Date.now() - createdMs) / 60000));

  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}min ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}hr ago`;

  return `${Math.floor(diffHours / 24)}d ago`;
};

const getDistanceKm = (
  pickup?: DeliveryPoint,
  dropoff?: DeliveryPoint
) => {
  const pickupLat = pickup?.coords?.lat;
  const pickupLng = pickup?.coords?.lng;
  const dropLat = dropoff?.coords?.lat;
  const dropLng = dropoff?.coords?.lng;

  if (
    typeof pickupLat !== 'number' ||
    typeof pickupLng !== 'number' ||
    typeof dropLat !== 'number' ||
    typeof dropLng !== 'number'
  ) {
    return null;
  }

  const earthRadiusKm = 6371;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const latDistance = toRadians(dropLat - pickupLat);
  const lngDistance = toRadians(dropLng - pickupLng);
  const startLat = toRadians(pickupLat);
  const endLat = toRadians(dropLat);
  const a =
    Math.sin(latDistance / 2) * Math.sin(latDistance / 2) +
    Math.cos(startLat) *
      Math.cos(endLat) *
      Math.sin(lngDistance / 2) *
      Math.sin(lngDistance / 2);

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const mapDeliveryToJobRequest = (delivery: OpenDelivery, index: number): JobRequest => {
  const pickup = delivery.locations?.pickup;
  const dropoff = delivery.locations?.dropoff;
  const dbDistance = Number(delivery.pricing?.distanceKm ?? delivery.pricing?.distance);
  const calculatedDistance = getDistanceKm(pickup, dropoff);
  const distance = Number.isFinite(dbDistance) && dbDistance > 0 ? dbDistance : calculatedDistance;
  const distanceLabel = distance ? `Drop ${Math.round(distance)} km` : 'Drop';
  const isResumeTrip =
    delivery.status === 'assigned' ||
    delivery.status === 'arrived' ||
    delivery.status === 'in_transit';

  return {
    id: delivery.id || `delivery-${index}`,
    deliveryId: delivery.id || '',
    isResumeTrip,
    earnings: formatCurrency(delivery.pricing?.tripFare ?? delivery.pricing?.total),
    pickupDistance: distance ? `${Math.round(distance)}km pickup` : 'Open job',
    age: isResumeTrip ? 'Resume trip' : formatAge(delivery.timestamps?.createdAt),
    pickupTitle: 'To Pickup',
    pickupTime: delivery.pickupTime || 'Pickup time not set',
    pickupAddress: pickup?.address || 'Pickup address unavailable',
    dropTitle: distanceLabel,
    dropTime: delivery.dropoffTime || 'Drop time not set',
    dropAddress: dropoff?.address || 'Drop address unavailable',
  };
};

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
  currentLocation,
  todayEarnings,
}: {
  driverStatus: DriverStatus;
  onTogglePress: () => void;
  onProfilePress: () => void;
  profilePhotoUrl: string | null;
  currentLocation: CurrentLocationLabel;
  todayEarnings: string;
}) {
  return (
    <View style={styles.header}>
      <StatusBarBlock />
      <View style={styles.locationRow}>
        <View style={styles.locationTextWrap}>
          <View style={styles.locationTitleRow}>
            <Image source={mapPinImage} style={styles.locationIcon} resizeMode="contain" />
          <Text style={styles.locationTitle} numberOfLines={1}>{currentLocation.area}</Text>
          </View>
          <Text style={styles.locationSubtitle}>{currentLocation.district}</Text>
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
        <View style={styles.earningCopy}>
          <Text style={styles.totalEarning} numberOfLines={1}>{todayEarnings}</Text>
          <Text style={styles.totalLabel} numberOfLines={1}>Today total earning</Text>
        </View>
        <OnlineToggle status={driverStatus} onPress={onTogglePress} />
      </View>
    </View>
  );
}

function RoutePoint({

  title,
  time,
  address,
}: {

  title: string;
  time: string;
  address: string;
}) {
  return (
    <View style={styles.routePoint}>
    
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

function JobCard({
  job,
  onAccept,
  canAcceptNewJobs,
}: {
  job: JobRequest;
  onAccept: (job: JobRequest) => void;
  canAcceptNewJobs: boolean;
}) {
  const cardContent = (
    <>
      <View style={styles.jobTopRow}>
        <View style={styles.jobEarningBlock}>
          <Text style={styles.estimateLabel} numberOfLines={1}>Estimated earnings</Text>
          <Text style={styles.cardEarning} numberOfLines={1}>{job.earnings}</Text>
        </View>
        <View style={styles.jobMeta}>
          <View style={styles.pickupBadge}>
            <Text style={styles.pickupBadgeText} numberOfLines={1}>{job.pickupDistance}</Text>
          </View>
          <Text style={styles.jobAge} numberOfLines={1}>{job.age}</Text>
        </View>
      </View>

      <View style={styles.routeBox}>
        
        <Image source={ pickAndDropIcon } style={styles.routeIcon}  />
       
       <View style={styles.routeLineGroup}>
          <RoutePoint
          title={job.pickupTitle}
          time={job.pickupTime}
          address={job.pickupAddress}
        />
        <View style={styles.routeSeparator} />
        <RoutePoint
          title={job.dropTitle}
          time={job.dropTime}
          address={job.dropAddress}
        />

       </View>
  
      </View>

      {!job.isResumeTrip ? (
        <View style={styles.cardActions}>
          <Pressable style={styles.rejectButton}>
            <Text style={styles.rejectText}>Reject</Text>
          </Pressable>
          <Pressable
            style={[styles.acceptButton, !canAcceptNewJobs ? styles.acceptButtonDisabled : null]}
            disabled={!canAcceptNewJobs}
            onPress={() => onAccept(job)}
          >
            <Text style={styles.acceptText}>View Details</Text>
          </Pressable>
        </View>
      ) : null}
    </>
  );

  if (job.isResumeTrip) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Resume accepted trip"
        style={({ pressed }) => [styles.jobCard, pressed ? styles.jobCardPressed : null]}
        onPress={() => onAccept(job)}
      >
        {cardContent}
      </Pressable>
    );
  }

  return (
    <View style={styles.jobCard}>
      {cardContent}
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
  const insets = useSafeAreaInsets();
  const [driverStatus, setDriverStatus] = useState<DriverStatus>('offline');
  const [driverStatusChangedAtMs, setDriverStatusChangedAtMs] = useState(0);
  const [pendingStatus, setPendingStatus] = useState<DriverStatus | null>(null);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null);
  const [currentLocation, setCurrentLocation] = useState<CurrentLocationLabel>({
    area: 'Fetching location...',
    district: '',
  });
  const [jobRequestList, setJobRequestList] = useState<JobRequest[]>(
    () => jobRequests.slice(0, 0) as JobRequest[]
  );
  const [isLoadingJobs, setIsLoadingJobs] = useState(true);
  const [todayTotalEarnings, setTodayTotalEarnings] = useState(formatCurrency(0));
  const [hasTripInProgress, setHasTripInProgress] = useState(false);
  const hasLoadedJobsRef = React.useRef(false);
  const { alertModal, showAlert } = useAppAlert();

  React.useEffect(() => {
    let isActive = true;

    const loadCurrentLocation = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();

        if (status !== Location.PermissionStatus.GRANTED) {
          if (isActive) {
            setCurrentLocation({
              area: 'Location unavailable',
              district: 'Permission required',
            });
          }
          return;
        }

        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const [address] = await Location.reverseGeocodeAsync(position.coords);

        const area =
          address?.district ||
          address?.name ||
          address?.street ||
          address?.city ||
          'Current location';
        const district =
          address?.city ||
          address?.subregion ||
          address?.region ||
          'District unavailable';

        if (isActive) {
          setCurrentLocation({
            area,
            district,
          });
        }
      } catch (error) {
        console.error('Error loading current location:', error);
        if (isActive) {
          setCurrentLocation({
            area: 'Location unavailable',
            district: 'Try again later',
          });
        }
      }
    };

    loadCurrentLocation();

    return () => {
      isActive = false;
    };
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      let isActive = true;

      const loadOpenJobRequests = async () => {
        try {
          if (!hasLoadedJobsRef.current) {
            setIsLoadingJobs(true);
          }
          const [storedUid, storedIdToken] = await Promise.all([
            AsyncStorage.getItem('firebaseUid'),
            AsyncStorage.getItem('firebaseIdToken'),
          ]);
          const uid = auth.currentUser?.uid || storedUid;
          let driverVehicleType = '';
          let openDeliveries: OpenDelivery[] = [];
          let driverDeliveries: OpenDelivery[] = [];

          if (uid) {
            const driverProfile = await getDriverProfile(uid, storedIdToken).catch((error) => {
              console.error('Error loading driver vehicle type:', error);
              return null;
            });
            driverVehicleType = driverProfile?.vehicleType || '';
          }

          if (uid) {
            const driverResponse = await fetch(
              `${getApiBaseUrl()}/api/deliveries/driver/${encodeURIComponent(uid)}?type=all`
            );
            const driverBody = (await driverResponse.json().catch(() => null)) as {
              success?: boolean;
              data?: OpenDelivery[];
              error?: string;
            } | null;

            if (!driverResponse.ok || driverBody?.success === false) {
              throw new Error(driverBody?.error || 'Unable to load driver deliveries');
            }

            driverDeliveries = Array.isArray(driverBody?.data) ? driverBody.data : [];
          }

          if (driverVehicleType) {
            const openResponse = await fetch(
              `${getApiBaseUrl()}/api/deliveries/open?vehicleType=${encodeURIComponent(driverVehicleType)}`
            );
            const openBody = (await openResponse.json().catch(() => null)) as {
              success?: boolean;
              data?: OpenDelivery[];
              error?: string;
            } | null;

            if (!openResponse.ok || openBody?.success === false) {
              throw new Error(openBody?.error || 'Unable to load job requests');
            }

            openDeliveries = Array.isArray(openBody?.data) ? openBody.data : [];
          }

          const activeDriverDeliveries = driverDeliveries.filter((delivery) =>
            ['assigned', 'arrived', 'in_transit'].includes(delivery.status || '')
          );
          const today = Date.now();
          const todayEarningsAmount = driverDeliveries
            .filter((delivery) => ['delivered', 'completed'].includes(delivery.status || ''))
            .filter((delivery) =>
              isSameLocalDay(readTimestampMs(delivery.timestamps?.deliveredAt), today)
            )
            .reduce((sum, delivery) => {
              const amount = Number(delivery.pricing?.tripFare ?? delivery.pricing?.total);
              return sum + (Number.isFinite(amount) ? amount : 0);
            }, 0);

          const deliveryMap = new Map<string, OpenDelivery>();
          [...activeDriverDeliveries, ...openDeliveries].forEach((delivery, index) => {
            const id = delivery.id || `delivery-${index}`;
            if (!deliveryMap.has(id)) {
              deliveryMap.set(id, delivery);
            }
          });

          const deliveries = Array.from(deliveryMap.values()).sort((a, b) => {
            const aTime = readTimestampMs(a.timestamps?.createdAt);
            const bTime = readTimestampMs(b.timestamps?.createdAt);
            return bTime - aTime;
          });

          if (isActive) {
            setJobRequestList(deliveries.map(mapDeliveryToJobRequest));
            setTodayTotalEarnings(formatCurrency(todayEarningsAmount));
            setHasTripInProgress(activeDriverDeliveries.length > 0);
          }
        } catch (error) {
          console.error('Error loading job requests:', error);
        } finally {
          if (isActive) {
            hasLoadedJobsRef.current = true;
            setIsLoadingJobs(false);
          }
        }
      };

      loadOpenJobRequests();
      const interval = setInterval(loadOpenJobRequests, 5000);

      return () => {
        isActive = false;
        clearInterval(interval);
      };
    }, [])
  );

  useFocusEffect(
    React.useCallback(() => {
      let isActive = true;

      const loadDriverHomeState = async () => {
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

        const [cachedPhotoUrl, cachedStatus] = await Promise.all([
          getCachedProfilePhotoUrl(uid),
          getCachedAvailabilityStatus(uid),
        ]);
        const cachedChangedAtMs = await getCachedAvailabilityChangedAtMs(uid);
        const cachedStatusExpired =
          cachedStatus === 'online' &&
          cachedChangedAtMs > 0 &&
          Date.now() - cachedChangedAtMs >= DRIVER_ONLINE_MAX_DURATION_MS;
        const resolvedCachedStatus = cachedStatusExpired ? 'offline' : cachedStatus;

        if (isActive && cachedPhotoUrl) {
          setProfilePhotoUrl(cachedPhotoUrl);
        }
        if (cachedStatusExpired) {
          await setCachedAvailabilityStatus(uid, 'offline');
          await setCachedAvailabilityChangedAtMs(uid, null);
          updateDriverAvailability(uid, 'offline', storedIdToken);
        }
        if (isActive && resolvedCachedStatus) {
          setDriverStatus(resolvedCachedStatus);
          setDriverStatusChangedAtMs(resolvedCachedStatus === 'online' ? cachedChangedAtMs : 0);
        }

        const [driverProfile, latestAvailability] = await Promise.all([
          getDriverProfile(uid, storedIdToken).catch((error) => {
            console.error('Error loading driver profile on home:', error);
            return null;
          }),
          getLatestDriverAvailability(uid, storedIdToken).catch((error) => {
            console.error('Error loading driver availability on home:', error);
            return null;
          }),
        ]);
        const savedPhotoUrl =
          driverProfile?.profilePhotoUrl ||
          (driverProfile?.photoUri?.startsWith('http') ? driverProfile.photoUri : null);

        if (savedPhotoUrl) {
          await setCachedProfilePhotoUrl(uid, savedPhotoUrl);
        }

        let resolvedStatus = latestAvailability?.status || resolvedCachedStatus || 'offline';
        const changedAtMs =
          readTimestampMs(latestAvailability?.changedAt || undefined) ||
          (resolvedCachedStatus === 'online' ? cachedChangedAtMs : 0);
        const isOnlineExpired =
          resolvedStatus === 'online' &&
          changedAtMs > 0 &&
          Date.now() - changedAtMs >= DRIVER_ONLINE_MAX_DURATION_MS;

        if (isOnlineExpired) {
          resolvedStatus = 'offline';
          await setCachedAvailabilityStatus(uid, 'offline');
          await setCachedAvailabilityChangedAtMs(uid, null);
          updateDriverAvailability(uid, 'offline', storedIdToken);
        } else if (latestAvailability?.status) {
          await setCachedAvailabilityStatus(uid, latestAvailability.status);
          await setCachedAvailabilityChangedAtMs(
            uid,
            latestAvailability.status === 'online' ? changedAtMs : null
          );
        }

        if (isActive) {
          setProfilePhotoUrl(savedPhotoUrl || cachedPhotoUrl || null);
          setDriverStatus(resolvedStatus);
          setDriverStatusChangedAtMs(resolvedStatus === 'online' ? changedAtMs : 0);
        }
      };

      loadDriverHomeState();
      const interval = setInterval(loadDriverHomeState, 5000);

      return () => {
        isActive = false;
        clearInterval(interval);
      };
    }, [])
  );

  const handleTogglePress = () => {
    if (driverStatus === 'online' && hasTripInProgress) {
      showAlert(
        'Trip in progress',
        'You cannot go offline while a delivery is in progress. Complete the trip first.'
      );
      return;
    }

    setPendingStatus(driverStatus === 'online' ? 'offline' : 'online');
  };

  const handleConfirmStatus = async () => {
    if (pendingStatus) {
      if (pendingStatus === 'offline' && hasTripInProgress) {
        setPendingStatus(null);
        showAlert(
          'Trip in progress',
          'You cannot go offline while a delivery is in progress. Complete the trip first.'
        );
        return;
      }

      const nextStatus = pendingStatus;
      const changedAtMs = Date.now();
      setDriverStatus(pendingStatus);
      setDriverStatusChangedAtMs(nextStatus === 'online' ? changedAtMs : 0);
      setPendingStatus(null);

      const [storedUid, storedIdToken] = await Promise.all([
        AsyncStorage.getItem('firebaseUid'),
        AsyncStorage.getItem('firebaseIdToken'),
      ]);
      const uid = auth.currentUser?.uid || storedUid;

      if (uid) {
        await setCachedAvailabilityStatus(uid, nextStatus);
        await setCachedAvailabilityChangedAtMs(uid, nextStatus === 'online' ? changedAtMs : null);
        updateDriverAvailability(uid, nextStatus, storedIdToken);
      }
    }
  };

  const handleProfilePress = () => {
    router.push('/(tabs)/profile');
  };

  const handleAcceptJob = async (job: JobRequest) => {
    if (!job.deliveryId) {
      return;
    }

    if (!job.isResumeTrip && driverStatus !== 'online') {
      showAlert('You are offline', 'Go online before accepting a new trip.');
      return;
    }

    router.push({
      pathname: '/accepted-trip',
      params: { deliveryId: job.deliveryId },
    });
  };

  React.useEffect(() => {
    if (driverStatus !== 'online' || driverStatusChangedAtMs <= 0) {
      return;
    }

    const remainingMs = DRIVER_ONLINE_MAX_DURATION_MS - (Date.now() - driverStatusChangedAtMs);

    if (remainingMs <= 0) {
      setDriverStatus('offline');
      setDriverStatusChangedAtMs(0);
      Promise.all([
        AsyncStorage.getItem('firebaseUid'),
        AsyncStorage.getItem('firebaseIdToken'),
      ]).then(([storedUid, storedIdToken]) => {
        const uid = auth.currentUser?.uid || storedUid;
        if (uid) {
          setCachedAvailabilityStatus(uid, 'offline');
          setCachedAvailabilityChangedAtMs(uid, null);
          updateDriverAvailability(uid, 'offline', storedIdToken);
        }
      });
      return;
    }

    const timeout = setTimeout(() => {
      setDriverStatus('offline');
      setDriverStatusChangedAtMs(0);
      Promise.all([
        AsyncStorage.getItem('firebaseUid'),
        AsyncStorage.getItem('firebaseIdToken'),
      ]).then(([storedUid, storedIdToken]) => {
        const uid = auth.currentUser?.uid || storedUid;
        if (uid) {
          setCachedAvailabilityStatus(uid, 'offline');
          setCachedAvailabilityChangedAtMs(uid, null);
          updateDriverAvailability(uid, 'offline', storedIdToken);
        }
      });
    }, remainingMs);

    return () => clearTimeout(timeout);
  }, [driverStatus, driverStatusChangedAtMs]);

  const inProgressJobs = jobRequestList.filter((job) => job.isResumeTrip);
  const openJobRequests = jobRequestList.filter((job) => !job.isResumeTrip);

  return (
    <SafeAreaView style={styles.container}>
      <Header
        driverStatus={driverStatus}
        onTogglePress={handleTogglePress}
        onProfilePress={handleProfilePress}
        profilePhotoUrl={profilePhotoUrl}
        currentLocation={currentLocation}
        todayEarnings={todayTotalEarnings}
      />

      <ScrollView
        style={styles.contentScroll}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: 85 + insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {isLoadingJobs ? (
          <View style={styles.emptyJobsCard}>
            <Text style={styles.emptyJobsText}>Loading jobs...</Text>
          </View>
        ) : (
          <>
            {inProgressJobs.length > 0 ? (
              <View style={styles.homeSection}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>In progress</Text>
                </View>

                {inProgressJobs.map((job) => (
                  <JobCard
                    key={job.id}
                    job={job}
                    onAccept={handleAcceptJob}
                    canAcceptNewJobs
                  />
                ))}
              </View>
            ) : null}

            <View style={styles.homeSection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Job Request</Text>
              </View>

              {openJobRequests.length > 0 ? (
                openJobRequests.map((job) => (
                  <JobCard
                    key={job.id}
                    job={job}
                    onAccept={handleAcceptJob}
                    canAcceptNewJobs={driverStatus === 'online'}
                  />
                ))
              ) : (
                <View style={styles.emptyJobsCard}>
                  <Text style={styles.emptyJobsText}>No job requests available</Text>
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>

      <StatusConfirmModal
        targetStatus={pendingStatus || 'online'}
        visible={pendingStatus !== null}
        onCancel={() => setPendingStatus(null)}
        onConfirm={handleConfirmStatus}
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
  header: {
    backgroundColor: '#dbe6f7',
    borderBottomLeftRadius: rs(24),
    borderBottomRightRadius: rs(24),
    paddingBottom: vs(24),
  },
  statusBar: {
    height: vs(52),
    paddingHorizontal: rs(24),
    paddingVertical: vs(10),
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  statusTime: {
    color: '#1d1b20',
    fontFamily: 'Poppins_500Medium',
    fontSize: fs(14),
    fontWeight: '500',
    lineHeight: fs(20),
    letterSpacing: 0.14,
  },
  statusIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(3),
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: rs(16),
    gap: rs(12),
  },
  locationTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  locationTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(4),
  },
  locationIcon: {
    width: rs(24),
    height: rs(24),
  },
  locationTitle: {
    color: '#1c1c1a',
    fontFamily: 'Poppins_500Medium',
    flex: 1,
    minWidth: 0,
    fontSize: 16,
    fontWeight: '500',
  },
  locationSubtitle: {
    minWidth: 0,
    flexShrink: 1,
    marginTop: 1,
    color: '#5e5e58',
    fontFamily: 'Poppins_400Regular',
    fontSize: fs(12),
    fontWeight: '400',
    lineHeight: fs(18),
  },
  profileImage: {
    width: hit(44),
    height: hit(44),
    borderRadius: hit(44) / 2,
    backgroundColor: '#ffffff',
  },
  earningRow: {
    marginTop: vs(20),
    paddingHorizontal: rs(16),
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: rs(12),
  },
  earningCopy: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
  },
  totalEarning: {
    minWidth: 0,
    flexShrink: 1,
    color: '#1c1c1c',
    fontFamily: 'Poppins_500Medium',
    fontSize: fs(40, 32, 42),
    fontWeight: '500',
    lineHeight: fs(48, 38, 50),
  },
  totalLabel: {
    minWidth: 0,
    flexShrink: 1,
    color: '#606060',
    fontFamily: 'Poppins_400Regular',
    fontSize: fs(14),
    fontWeight: '400',
    lineHeight: fs(21),
  },
  statusToggle: {
    width: rs(98, 88, 104),
    height: hit(40),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent : 'space-between',
    gap: rs(4),
    borderRadius: 100,
    paddingVertical: vs(2),
   
  },
  onlineToggle: {
    backgroundColor: '#05c',
    paddingLeft: rs(5),
    paddingRight: rs(4),
  },
  offlineToggle: {
    backgroundColor: '#8e8e8e',
    paddingLeft: rs(4),
    paddingRight: rs(8),
  },
  statusToggleText: {
   
    color: '#ffffff',
    fontFamily: 'Poppins_500Medium',
    fontSize: fs(14, 12, 15),
    fontWeight: '500',
    lineHeight: fs(21),
    textAlign: 'center',
  },
  statusKnob: {
    width: rs(32),
    height: rs(32),
    borderRadius: rs(16),
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
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    paddingHorizontal: rs(16),
    paddingTop: vs(24),
    paddingBottom: 120,
    gap: vs(24),
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  sectionTitle: {
    color: '#1c1c1c',
    fontFamily: 'Poppins_500Medium',
    fontSize: 24,
    fontWeight: '500',
    letterSpacing: -1,
  },
  homeSection: {
    width: '100%',
    gap: vs(24),
  },
  jobCard: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: rs(12),
    padding: rs(16),
    gap: vs(16),
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  jobCardPressed: {
    opacity: 0.85,
  },
  jobTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: rs(10),
  },
  jobEarningBlock: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
  },
  estimateLabel: {
    color: '#5e5e58',
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    fontWeight: '400',
    lineHeight: fs(18),
  },
  cardEarning: {
    minWidth: 0,
    flexShrink: 1,
    color: '#1c1c1c',
    fontFamily: 'Poppins_500Medium',
    fontSize: fs(32, 26, 34),
    fontWeight: '500',
    lineHeight: fs(34, 28, 36),
  },
  jobMeta: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    minHeight: vs(50),
    flexShrink: 0,
    maxWidth: '45%',
  },
  pickupBadge: {
    backgroundColor: '#ffdb43',
    borderRadius: rs(8),
    paddingHorizontal: rs(8),
    paddingVertical: vs(4),
  },
  pickupBadgeText: {
    color: '#000000',
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: fs(21),
  },
  jobAge: {
    color: '#606060',
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    fontWeight: '400',
    lineHeight: fs(18),
  },
  routeBox: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#bbbbbb',
    borderRadius: rs(12),
    backgroundColor: '#ffffff',
    padding : rs(2),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap : rs(18)
  },
  routeLineGroup: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
  },
  routePoint: {
    marginBottom : vs(5),
    marginTop : vs(5),
    flexShrink: 1,
    width: '100%',
  },
  routeIcon: {
    width: rs(30, 24, 32),
    height : '65%',
    paddingRight : 30
  },
  pickDropContainer : {
    
  },
  routeTextWrap: {
    padding : rs(2),
    minWidth: 0,
    overflow: 'hidden',
    borderColor : '#0000',
    borderWidth : 1
  },
  routeMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(10),
    flexWrap: 'wrap',
    minWidth: 0,
  },
  routeTitle: {
    minWidth: 0,
    flexShrink: 1,
    color: '#1c1c1c',
    fontFamily: 'Poppins_500Medium',
    fontSize: fs(12),
    fontWeight: '500',
    lineHeight: fs(18),
  },
  routeTime: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
    color: '#0055cc',
    fontFamily: 'Poppins_500Medium',
    fontSize: fs(12),
    fontWeight: '500',
    lineHeight: fs(14),
  },
  routeAddress: {
    minWidth: 0,
    flexShrink: 1,
    color: '#616161',
    fontFamily: 'Poppins_400Regular',
    fontSize: 16,
    fontWeight: '400',
  },
  routeSeparator: {
    height: 1,
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#d6d6d6',
     width: '100%',
  },
  routeConnector: {
    position: 'absolute',
    left: 18,
    top: 29,
    height: 58,
    width: 10,
    alignItems: 'center',
    zIndex: 1,
  },
  routeDash: {
    width: 1,
    height: 50,
    borderLeftWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#2f8dff',
  },
  routeArrowHead: {
    width: 0,
    height: 0,
    marginTop: -1,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#2f8dff',
  },
  cardActions: {
    flexDirection: 'row',
    gap: rs(12),
  },
  rejectButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#05c',
    borderRadius: rs(8),
    paddingHorizontal: rs(16),
    paddingVertical: vs(12),
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectText: {
    flexShrink: 1,
    color: '#606060',
    fontFamily: 'Poppins_500Medium',
    fontSize: 16,
    fontWeight: '500',
    lineHeight: fs(18),
    letterSpacing: -0.5,
  },
  acceptButton: {
    flex: 1,
    backgroundColor: '#1fc16b',
    borderRadius: rs(8),
    paddingHorizontal: rs(16),
    paddingVertical: vs(12),
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptButtonDisabled: {
    opacity: 0.45,
  },
  acceptText: {
    flexShrink: 1,
    color: '#ffffff',
    fontFamily: 'Poppins_500Medium',
    fontSize: 16,
    fontWeight: '500',
    lineHeight: fs(18),
    letterSpacing: -0.5,
  },
  emptyJobsCard: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: rs(12),
    paddingHorizontal: rs(16),
    paddingVertical: vs(24),
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyJobsText: {
    color: '#606060',
    fontFamily: 'Poppins_400Regular',
    fontSize: fs(14),
    fontWeight: '400',
    lineHeight: fs(21),
    textAlign: 'center',
  },
  confirmOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: rs(16),
    backgroundColor: 'rgba(0, 0, 0, 0.24)',
  },
  confirmCard: {
    width: '100%',
    maxWidth: rs(380, 320, 420),
    backgroundColor: '#ffffff',
    borderRadius: rs(8),
    padding: rs(12),
    gap: vs(24),
    alignItems: 'center',
    overflow: 'hidden',
  },
  confirmContent: {
    width: '100%',
    gap: vs(16),
    alignItems: 'center',
  },
  confirmIconCircle: {
    width: rs(60),
    height: rs(60),
    borderRadius: rs(30),
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
    width: rs(60),
    height: rs(60),
  },
  confirmTextGroup: {
    width: '100%',
    gap: vs(4),
    alignItems: 'center',
  },
  confirmTitle: {
    width: '100%',
    color: '#1c1c1c',
    fontFamily: 'Poppins_500Medium',
    fontSize: fs(24, 20, 26),
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: fs(26),
    letterSpacing: -1,
  },
  confirmDescription: {
    width: '100%',
    color: '#606060',
    fontFamily: 'Poppins_400Regular',
    fontSize: 16,
    fontWeight: '400',
    lineHeight: fs(24),
    textAlign: 'center',
  },
  confirmActions: {
    width: '100%',
    flexDirection: 'row',
    gap: rs(10),
  },
  confirmNoButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#05c',
    borderRadius: rs(8),
    paddingHorizontal: rs(14),
    paddingVertical: vs(12),
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmNoText: {
    color: '#606060',
    fontFamily: 'Poppins_500Medium',
    fontSize: 16,
    fontWeight: '500',
    lineHeight: fs(18),
    letterSpacing: -0.5,
  },
  confirmYesButton: {
    flex: 1,
    borderRadius: rs(8),
    paddingHorizontal: rs(14),
    paddingVertical: vs(12),
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
    color: '#ffffff',
    fontFamily: 'Poppins_500Medium',
    fontSize: 16,
    fontWeight: '500',
    lineHeight: fs(18),
    letterSpacing: -0.5,
  },
});
