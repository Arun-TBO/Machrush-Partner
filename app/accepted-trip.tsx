import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import {
  Animated,
  Dimensions,
  Easing,
  Image,
  InteractionManager,
  Keyboard,
  Linking,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, type MapViewRef } from '@/components/NativeMap';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { auth } from '@/lib/firebase';
import { getDriverProfile } from '@/lib/firestoreOnboardingService';
import { useAppAlert } from '@/components/AppAlertModal';
import { fs, rs, vs } from '@/lib/responsive';

const pickAndDropIcon = require('@/assets/images/pickAndDropIcon1.png');
const customerAvatarImage = require('@/assets/images/delivery/customer-avatar.jpg');
const tripCompletedBanknoteImage = require('@/assets/images/delivery/trip-completed-banknote.png');
const tripCompletedTickImage = require('@/assets/images/delivery/trip-completed-tick.png');
const trackingLocationImage = require('@/assets/images/profile/Location.png');
const helpImage = require('@/assets/images/profile/help.png');
const supportCallImage = require('@/assets/images/profile/phone.png');
const tableLocationImage = require('@/assets/images/profile/tablelocation.png');
const otpResetImage = require('@/assets/images/profile/mdi_password-reset.png');
const BYPASS_PICKUP_GEOFENCE_FOR_TESTING = false;
const BYPASS_DROP_GEOFENCE_FOR_TESTING = true;
const PICKUP_ARRIVAL_RADIUS_METERS = 100;
const DROP_ARRIVAL_RADIUS_METERS = 120;
const OFF_ROUTE_THRESHOLD_METERS = 60;
const REROUTE_COOLDOWN_MS = 15000;
const DRIVER_LOCATION_SYNC_INTERVAL_MS = 10000;
const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
const TRACKING_SHEET_HEIGHT = Math.min(520, Math.max(480, Dimensions.get('window').height * 0.54));
const TRACKING_SHEET_COLLAPSED_VISIBLE_HEIGHT = 149;
const TRACKING_SHEET_COLLAPSED_OFFSET =
  TRACKING_SHEET_HEIGHT - TRACKING_SHEET_COLLAPSED_VISIBLE_HEIGHT;

type LatLng = {
  lat: number;
  lng: number;
};

type NavigationStep = {
  instruction: string;
  maneuver?: string;
  start: LatLng;
  end: LatLng;
  distanceMeters: number;
};

type RouteSegment = {
  coordinates: LatLng[];
  color: string;
};

type DriverLocationMetadata = {
  heading?: number | null;
  accuracy?: number | null;
  speed?: number | null;
};

type RoutesApiResponse = {
  routes?: {
    distanceMeters?: number;
    duration?: string;
    polyline?: {
      encodedPolyline?: string;
    };
    travelAdvisory?: {
      speedReadingIntervals?: {
        startPolylinePointIndex?: number;
        endPolylinePointIndex?: number;
        speed?: 'NORMAL' | 'SLOW' | 'TRAFFIC_JAM';
      }[];
    };
    legs?: {
      steps?: {
        distanceMeters?: number;
        startLocation?: {
          latLng?: {
            latitude?: number;
            longitude?: number;
          };
        };
        endLocation?: {
          latLng?: {
            latitude?: number;
            longitude?: number;
          };
        };
        navigationInstruction?: {
          maneuver?: string;
          instructions?: string;
        };
      }[];
    }[];
  }[];
  error?: {
    message?: string;
  };
};

type GoogleDirectionsResponse = {
  routes?: {
    overview_polyline?: {
      points?: string;
    };
    legs?: {
      distance?: {
        text?: string;
        value?: number;
      };
      duration?: {
        text?: string;
        value?: number;
      };
      steps?: {
        html_instructions?: string;
        maneuver?: string;
        start_location?: {
          lat?: number;
          lng?: number;
        };
        end_location?: {
          lat?: number;
          lng?: number;
        };
        distance?: {
          text?: string;
          value?: number;
        };
      }[];
    }[];
  }[];
  status?: string;
  error_message?: string;
};

type CustomerProfileResponse = {
  success?: boolean;
  data?: {
    businessName?: string;
    companyName?: string;
    company?: string;
    fullName?: string;
    name?: string;
    profilePhotoUrl?: string;
    photoUri?: string;
  };
};

type DeliveryTimestamp =
  | string
  | number
  | Date
  | {
      seconds?: number;
      _seconds?: number;
      toDate?: () => Date;
    };

type DeliveryDetails = {
  id?: string;
  senderId?: string | null;
  status?: string;
  pickupTime?: string | null;
  dropoffTime?: string | null;
  sender?: {
    name?: string;
    phone?: string;
    photoUri?: string;
    businessName?: string;
    companyName?: string;
    company?: string;
  };
  receiver?: {
    name?: string;
    phone?: string;
    photoUri?: string;
  };
  driver?: {
    fullName?: string;
    phoneNumber?: string;
    photoUri?: string;
    vehicleNumber?: string;
    vehicleType?: string;
    vehicleCapacity?: string;
  };
  vehicle?: {
    name?: string;
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
  pricing?: {
    tripFare?: number | string;
    total?: number | string;
    distanceKm?: number | string;
    distance?: number | string;
    baseFare?: number | string;
    distanceFare?: number | string;
    fuelCost?: number | string;
    pickupDistanceKm?: number | string;
    perKmRate?: number | string;
    ratePerKm?: number | string;
  };
  tracking?: {
    otp?: string | null;
    estimatedArrival?: string | null;
    driverLat?: number | null;
    driverLng?: number | null;
  };
  timestamps?: {
    createdAt?: DeliveryTimestamp;
    assignedAt?: DeliveryTimestamp;
  };
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

const getCompanyName = (value: {
  businessName?: string;
  companyName?: string;
  company?: string;
  fullName?: string;
  name?: string;
} | null | undefined) => {
  return String(
    value?.businessName ||
      value?.companyName ||
      value?.company ||
      value?.fullName ||
      value?.name ||
      ''
  ).trim();
};

const getCurrencyNumber = (value: unknown) => {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
};

const getAddressParts = (address: string) => {
  const [primaryAddress, ...secondaryParts] = address.split(',');
  return {
    primaryAddress: primaryAddress.trim() || address,
    secondaryAddress: secondaryParts.join(',').trim(),
  };
};

const formatPickupDistance = (value: unknown, fallback = '3 km') => {
  const distance = Number(value);

  if (!Number.isFinite(distance) || distance <= 0) {
    return fallback;
  }

  if (distance < 1) {
    return `${Math.round(distance * 1000)}m`;
  }

  return `${Math.round(distance)} km`;
};

const formatFareDistance = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) {
    return '0 km';
  }

  return `${Math.round(value).toLocaleString('en-IN')} km`;
};

const formatPerKmRate = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) {
    return '\u20b9 0';
  }

  return `\u20b9 ${Math.round(value).toLocaleString('en-IN')}`;
};

const isValidCoord = (coord: unknown): coord is LatLng => {
  const value = coord as LatLng | null | undefined;
  return typeof value?.lat === 'number' && typeof value.lng === 'number';
};

const getDistanceMeters = (from: LatLng, to: LatLng) => {
  const earthRadiusMeters = 6371000;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const latDistance = toRadians(to.lat - from.lat);
  const lngDistance = toRadians(to.lng - from.lng);
  const startLat = toRadians(from.lat);
  const endLat = toRadians(to.lat);
  const a =
    Math.sin(latDistance / 2) * Math.sin(latDistance / 2) +
    Math.cos(startLat) *
      Math.cos(endLat) *
      Math.sin(lngDistance / 2) *
      Math.sin(lngDistance / 2);

  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const formatDistanceMeters = (meters: number | null) => {
  if (!Number.isFinite(meters) || meters === null) {
    return '400m';
  }

  if (meters < 1000) {
    return `${Math.max(1, Math.round(meters))}m`;
  }

  return `${(meters / 1000).toFixed(meters < 10000 ? 1 : 0)} km`;
};

const formatDurationSeconds = (duration: string | undefined) => {
  const seconds = Number(duration?.replace('s', ''));

  if (!Number.isFinite(seconds) || seconds <= 0) {
    return null;
  }

  const minutes = Math.max(1, Math.round(seconds / 60));

  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return remainingMinutes ? `${hours} hr ${remainingMinutes} min` : `${hours} hr`;
};

type RouteSummary = {
  distanceText: string | null;
  durationText: string | null;
};

const formatApproxDuration = (value: string | null | undefined) => {
  if (!value) {
    return '';
  }

  return value.toLowerCase().startsWith('approx') ? value : `Approx. ${value}`;
};

const getFallbackRouteSummary = (origin: LatLng | null, destination: LatLng | null): RouteSummary => {
  if (!origin || !destination) {
    return { distanceText: null, durationText: null };
  }

  const distanceMeters = getDistanceMeters(origin, destination);
  const estimatedMinutes = Math.max(1, Math.round((distanceMeters / 1000 / 30) * 60));

  return {
    distanceText: formatDistanceMeters(distanceMeters),
    durationText: estimatedMinutes < 60
      ? `${estimatedMinutes} min`
      : `${Math.floor(estimatedMinutes / 60)} hr ${estimatedMinutes % 60} min`,
  };
};

const fetchDrivingRouteSummary = async (
  origin: LatLng | null,
  destination: LatLng | null
): Promise<RouteSummary> => {
  if (!origin || !destination) {
    return { distanceText: null, durationText: null };
  }

  const fallback = getFallbackRouteSummary(origin, destination);

  if (!GOOGLE_MAPS_API_KEY) {
    return fallback;
  }

  try {
    const routesResponse = await fetch(
      'https://routes.googleapis.com/directions/v2:computeRoutes',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
          'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters',
        },
        body: JSON.stringify({
          origin: {
            location: {
              latLng: {
                latitude: origin.lat,
                longitude: origin.lng,
              },
            },
          },
          destination: {
            location: {
              latLng: {
                latitude: destination.lat,
                longitude: destination.lng,
              },
            },
          },
          travelMode: 'DRIVE',
          routingPreference: 'TRAFFIC_AWARE_OPTIMAL',
        }),
      }
    );

    if (routesResponse.ok) {
      const routesBody = (await routesResponse.json().catch(() => null)) as RoutesApiResponse | null;
      const route = routesBody?.routes?.[0];

      if (route?.distanceMeters) {
        return {
          distanceText: formatDistanceMeters(route.distanceMeters),
          durationText: formatDurationSeconds(route.duration) || fallback.durationText,
        };
      }
    }

    const originParam = `${origin.lat},${origin.lng}`;
    const destinationParam = `${destination.lat},${destination.lng}`;
    const response = await fetch(
      'https://maps.googleapis.com/maps/api/directions/json' +
        `?origin=${originParam}` +
        `&destination=${destinationParam}` +
        '&mode=driving' +
        '&departure_time=now' +
        `&key=${GOOGLE_MAPS_API_KEY}`
    );
    const body = (await response.json().catch(() => null)) as GoogleDirectionsResponse | null;
    const leg = body?.routes?.[0]?.legs?.[0];

    return {
      distanceText: leg?.distance?.text || fallback.distanceText,
      durationText: leg?.duration?.text || fallback.durationText,
    };
  } catch (error) {
    console.error('Error loading detail route summary:', error);
    return fallback;
  }
};

const getTrafficColor = (speed: RouteSegmentSpeed | undefined) => {
  if (speed === 'TRAFFIC_JAM') return '#d93025';
  if (speed === 'SLOW') return '#fbbc04';
  return '#0055cc';
};

type RouteSegmentSpeed = 'NORMAL' | 'SLOW' | 'TRAFFIC_JAM';

const buildTrafficSegments = (
  coordinates: LatLng[],
  intervals: NonNullable<
    NonNullable<RoutesApiResponse['routes']>[number]['travelAdvisory']
  >['speedReadingIntervals']
) => {
  if (!coordinates.length || !intervals?.length) {
    return [
      {
        coordinates,
        color: '#0055cc',
      },
    ];
  }

  return intervals
    .map((interval) => {
      const startIndex = Math.max(interval.startPolylinePointIndex || 0, 0);
      const endIndex = Math.min(
        interval.endPolylinePointIndex ?? coordinates.length - 1,
        coordinates.length - 1
      );
      const segmentCoordinates = coordinates.slice(startIndex, endIndex + 1);

      if (segmentCoordinates.length < 2) {
        return null;
      }

      return {
        coordinates: segmentCoordinates,
        color: getTrafficColor(interval.speed),
      };
    })
    .filter((segment): segment is RouteSegment => Boolean(segment));
};

const stripHtml = (value: string | undefined) => {
  if (!value) return 'Continue on route';
  return value
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .trim();
};

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
const toDegrees = (radians: number) => (radians * 180) / Math.PI;

const getBearing = (from: LatLng, to: LatLng) => {
  const startLat = toRadians(from.lat);
  const endLat = toRadians(to.lat);
  const lngDistance = toRadians(to.lng - from.lng);
  const y = Math.sin(lngDistance) * Math.cos(endLat);
  const x =
    Math.cos(startLat) * Math.sin(endLat) -
    Math.sin(startLat) * Math.cos(endLat) * Math.cos(lngDistance);

  return (toDegrees(Math.atan2(y, x)) + 360) % 360;
};

const getDistanceToSegmentMeters = (point: LatLng, start: LatLng, end: LatLng) => {
  const segmentLength = getDistanceMeters(start, end);

  if (segmentLength <= 0) {
    return getDistanceMeters(point, start);
  }

  const pointToStart = getDistanceMeters(point, start);
  const pointToEnd = getDistanceMeters(point, end);

  if (pointToStart <= 0 || pointToEnd <= 0) {
    return 0;
  }

  const semiPerimeter = (segmentLength + pointToStart + pointToEnd) / 2;
  const area = Math.sqrt(
    Math.max(
      semiPerimeter *
        (semiPerimeter - segmentLength) *
        (semiPerimeter - pointToStart) *
        (semiPerimeter - pointToEnd),
      0
    )
  );

  return (2 * area) / segmentLength;
};

const getDistanceToRouteMeters = (point: LatLng, route: LatLng[]) => {
  if (route.length < 2) {
    return Number.POSITIVE_INFINITY;
  }

  let shortestDistance = Number.POSITIVE_INFINITY;

  for (let index = 0; index < route.length - 1; index += 1) {
    shortestDistance = Math.min(
      shortestDistance,
      getDistanceToSegmentMeters(point, route[index], route[index + 1])
    );
  }

  return shortestDistance;
};

const getNextInstruction = (
  driverLocation: LatLng | null,
  destination: LatLng | null,
  steps: NavigationStep[]
) => {
  if (!driverLocation || !destination) {
    return 'Waiting for GPS signal...';
  }

  if (getDistanceMeters(driverLocation, destination) <= PICKUP_ARRIVAL_RADIUS_METERS) {
    return 'You have arrived';
  }

  const nextStep = steps.find((step) => getDistanceMeters(driverLocation, step.end) > 35) || steps[0];

  if (!nextStep) {
    return 'Continue to destination';
  }

  const distanceToTurn = getDistanceMeters(driverLocation, nextStep.start);
  const instruction = nextStep.instruction || 'Continue on route';

  if (distanceToTurn <= 30) {
    return instruction;
  }

  return `${instruction} in ${formatDistanceMeters(distanceToTurn)}`;
};

const decodePolyline = (encoded: string) => {
  const points: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    lat += result & 1 ? ~(result >> 1) : result >> 1;
    shift = 0;
    result = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    lng += result & 1 ? ~(result >> 1) : result >> 1;
    points.push({
      lat: lat / 1e5,
      lng: lng / 1e5,
    });
  }

  return points;
};

const getRouteRegion = (driverLocation: LatLng | null, pickupLocation: LatLng | null) => {
  const fallback = pickupLocation || driverLocation;

  if (!fallback) {
    return {
      latitude: 13.0827,
      longitude: 80.2707,
      latitudeDelta: 0.08,
      longitudeDelta: 0.08,
    };
  }

  if (!driverLocation || !pickupLocation) {
    return {
      latitude: fallback.lat,
      longitude: fallback.lng,
      latitudeDelta: 0.02,
      longitudeDelta: 0.02,
    };
  }

  const latDelta = Math.max(Math.abs(driverLocation.lat - pickupLocation.lat) * 1.8, 0.01);
  const lngDelta = Math.max(Math.abs(driverLocation.lng - pickupLocation.lng) * 1.8, 0.01);

  return {
    latitude: (driverLocation.lat + pickupLocation.lat) / 2,
    longitude: (driverLocation.lng + pickupLocation.lng) / 2,
    latitudeDelta: latDelta,
    longitudeDelta: lngDelta,
  };
};

const toMapCoordinate = (coord: LatLng) => ({
  latitude: coord.lat,
  longitude: coord.lng,
});

const getDistanceKm = (delivery: DeliveryDetails | null) => {
  const dbDistance = Number(delivery?.pricing?.distanceKm ?? delivery?.pricing?.distance);

  if (Number.isFinite(dbDistance) && dbDistance > 0) {
    return Math.round(dbDistance);
  }

  const pickupLat = delivery?.locations?.pickup?.coords?.lat;
  const pickupLng = delivery?.locations?.pickup?.coords?.lng;
  const dropLat = delivery?.locations?.dropoff?.coords?.lat;
  const dropLng = delivery?.locations?.dropoff?.coords?.lng;

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

  return Math.round(earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};

function TopNav({
  onBack,
  onHelp,
}: {
  onBack?: () => void;
  onHelp?: () => void;
}) {
  const router = useRouter();

  return (
    <View style={styles.navShell}>
      {/* <View style={styles.statusSpacer} /> */}
      <View style={styles.topNav}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={styles.backButton}
          onPress={onBack || (() => router.back())}
        >
          <Ionicons name="arrow-back" size={24} color="#1c1c1c" />
        </Pressable>
        <Text style={styles.navTitle}>Delivery Details</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Get help"
          style={styles.helpButton}
          onPress={onHelp}
        >
          <Image source={helpImage} style={styles.helpIcon} resizeMode="contain" />
        </Pressable>
      </View>
    </View>
  );
}

function RouteRow({
  title,
  time,
  address,
  variant,
}: {
  title: string;
  time: string;
  address: string;
  variant: 'pickup' | 'drop';
}) {
  const { primaryAddress, secondaryAddress } = getAddressParts(address);

  return (
    <View style={styles.routeRow}>
  
      <View style={styles.routeCopy}>
        <View style={styles.routeMeta}>
          <Text style={styles.routeTitle}>{title}</Text>
          {time ? <Text style={styles.routeTime}>{time}</Text> : null}
        </View>
        <Text style={styles.routeAddress} numberOfLines={2}>
          {primaryAddress}
        </Text>
        {secondaryAddress ? (
          <Text style={styles.routeSubAddress} numberOfLines={2}>
            {secondaryAddress}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function OtpVerificationCard({
  value,
  error,
  onChange,
  onSubmit,
  isLoading,
}: {
  value: string;
  error: string | null;
  onChange: (value: string) => void;
  onSubmit: () => void;
  isLoading?: boolean;
}) {

  React.useEffect(() => {
  if (error) {
    const firstEmptyIndex = digits.findIndex((d) => !d);

    if (firstEmptyIndex >= 0) {
      inputRefs.current[firstEmptyIndex]?.focus();
    } else {
      inputRefs.current[3]?.focus();
    }
  }
}, [error]);

  const inputRefs = React.useRef<(TextInput | null)[]>([]);

  const digits = Array.from({ length: 4 }, (_, index) => value[index] || '');

const handleOtpInput = (index: number, text: string) => {
  const digit = text.replace(/\D/g, '').slice(-1);

  const updatedDigits = [...digits];
  updatedDigits[index] = digit;

  onChange(updatedDigits.join(''));

  if (digit && index < 3) {
    inputRefs.current[index + 1]?.focus();
  }
};

const handleOtpBackspace = (index: number) => {
  const updatedDigits = [...digits];

  if (updatedDigits[index]) {
    // clear current box
    updatedDigits[index] = '';
    onChange(updatedDigits.join(''));
    return;
  }

  if (index > 0) {
    updatedDigits[index - 1] = '';
    onChange(updatedDigits.join(''));

    inputRefs.current[index - 1]?.focus();
  }
};

  React.useEffect(() => {
    if (value.length === 4 && !isLoading) {
      onSubmit();
    }
  }, [value, isLoading, onSubmit]);

  return (
    <Pressable style={styles.otpCard}>
      <View style={styles.otpIconWrap}>
        <Image
          source={otpResetImage}
          style={styles.otpIconImage}
          resizeMode="contain"
        />
      </View>

      <Text style={styles.otpTitle}>Enter OTP</Text>

      <View style={styles.otpBoxRow}>
        {digits.map((digit, index) => (
          <TextInput
            key={index}
            ref={(ref) => {
              inputRefs.current[index] = ref;
            }}
            style={[
              styles.otpBox,
              digit ? styles.otpInputFilled : null,
            ]}
            value={digit}
            onChangeText={(text) =>
              handleOtpInput(index, text)
            }
            onKeyPress={({ nativeEvent }) => {
  if (nativeEvent.key === 'Backspace') {
    handleOtpBackspace(index);
  }
}}
            keyboardType="number-pad"
            maxLength={1}
            editable={!isLoading}
            textAlign="center"
            autoFocus={index === 0}
          />
        ))}
      </View>

      {isLoading && (
        <Text style={styles.otpHelpText}>
          Verifying OTP...
        </Text>
      )}

      {error && (
        <Text style={styles.otpError}>
          {error}
        </Text>
      )}
    </Pressable>
  );
}

function AcceptedPickupView({
  delivery,
  deliveryId,
  pickupDistanceKm,
  pickupAddress,
  pickupLocation,
  dropAddress,
  dropLocation,
  isUpdatingStatus,
  onArrivedPickupPoint,
  onVerifyPickupOtp,
  onCompleteDrop,
  onOpenDeliveryDetails,
}: {
  delivery: DeliveryDetails | null;
  deliveryId?: string;
  pickupDistanceKm: number;
  pickupAddress: string;
  pickupLocation: LatLng | null;
  dropAddress: string;
  dropLocation: LatLng | null;
  isUpdatingStatus: boolean;
  onArrivedPickupPoint: () => void;
  onVerifyPickupOtp: (otp: string) => Promise<boolean>;
  onCompleteDrop: () => void;
  onOpenDeliveryDetails: () => void;
}) {
  const insets = useSafeAreaInsets();
  const mapRef = React.useRef<MapViewRef>(null);
  const previousLocationRef = React.useRef<LatLng | null>(null);
  const driverLocationRef = React.useRef<LatLng | null>(null);
  const headingRef = React.useRef(0);
  const lastRerouteAtRef = React.useRef(0);
  const lastDriverLocationSyncAtRef = React.useRef(0);
  const sheetTranslateY = React.useRef(new Animated.Value(0)).current;
  const sheetPositionRef = React.useRef(0);
  const [driverLocation, setDriverLocation] = React.useState<LatLng | null>(() => {
    if (
      typeof delivery?.tracking?.driverLat === 'number' &&
      typeof delivery.tracking.driverLng === 'number'
    ) {
      return {
        lat: delivery.tracking.driverLat,
        lng: delivery.tracking.driverLng,
      };
    }

    return null;
  });
  const [routeCoordinates, setRouteCoordinates] = React.useState<LatLng[]>([]);
  const [routeSegments, setRouteSegments] = React.useState<RouteSegment[]>([]);
  const [routeSteps, setRouteSteps] = React.useState<NavigationStep[]>([]);
  const [routeDuration, setRouteDuration] = React.useState<string | null>(null);
  const [routeDistance, setRouteDistance] = React.useState<string | null>(null);
  const [routeStartLocation, setRouteStartLocation] = React.useState<LatLng | null>(null);
  const [routeRefreshIndex, setRouteRefreshIndex] = React.useState(0);
  const [locationError, setLocationError] = React.useState<string | null>(null);
  const [hasLiveDriverLocation, setHasLiveDriverLocation] = React.useState(false);
  const [pickupOtp, setPickupOtp] = React.useState('');
  const [otpError, setOtpError] = React.useState<string | null>(null);
  const [isVerifyingOtp, setIsVerifyingOtp] = React.useState(false);
  const [isOtpModalVisible, setIsOtpModalVisible] = React.useState(false);
  const { alertModal, showAlert } = useAppAlert();
  const bookingPerson = delivery?.sender?.name ? delivery.sender : delivery?.receiver;
  const bookingName = bookingPerson?.name || 'Customer';
  const bookingPhone = bookingPerson?.phone || '';
  const [bookingCompanyName, setBookingCompanyName] = React.useState(
    getCompanyName(delivery?.sender)
  );
  const [bookingPhotoUri, setBookingPhotoUri] = React.useState<string | null>(
    bookingPerson?.photoUri || null
  );
  const isArrived = delivery?.status === 'arrived';
  const isInTransit = delivery?.status === 'in_transit';
  const activeAddress = isInTransit ? dropAddress : pickupAddress;
  const { primaryAddress, secondaryAddress } = getAddressParts(activeAddress);
  const routeOrigin = driverLocation;
  const routeDestination = isInTransit ? dropLocation : pickupLocation;
  const pickupDistanceMeters =
    driverLocation && pickupLocation ? getDistanceMeters(driverLocation, pickupLocation) : null;
  const dropDistanceMeters =
    driverLocation && dropLocation ? getDistanceMeters(driverLocation, dropLocation) : null;
  const activeDestinationDistanceMeters = isInTransit ? dropDistanceMeters : pickupDistanceMeters;
  const pickupDistance = pickupDistanceMeters
    ? formatDistanceMeters(pickupDistanceMeters)
    : formatPickupDistance(pickupDistanceKm);
  const arrivalDistance = activeDestinationDistanceMeters
    ? formatDistanceMeters(activeDestinationDistanceMeters)
    : formatPickupDistance(pickupDistanceKm, '400m');
  const routeRegion = getRouteRegion(routeOrigin, routeDestination);
  const canArrive =
    BYPASS_PICKUP_GEOFENCE_FOR_TESTING ||
    (pickupDistanceMeters !== null && pickupDistanceMeters <= PICKUP_ARRIVAL_RADIUS_METERS);
  const hasArrivedAtDrop =
    isInTransit &&
    (BYPASS_DROP_GEOFENCE_FOR_TESTING ||
      (hasLiveDriverLocation &&
        driverLocation !== null &&
        dropLocation !== null &&
        dropDistanceMeters !== null &&
        dropDistanceMeters <= DROP_ARRIVAL_RADIUS_METERS));
  const etaText =
    routeDuration ||
    delivery?.tracking?.estimatedArrival?.replace('~', '') ||
    delivery?.pickupTime ||
    '4 min';
  const etaTitle = etaText.toLowerCase().includes('away') ? etaText : `${etaText} away`;
  const nextInstruction =
    locationError || getNextInstruction(driverLocation, routeDestination, routeSteps);

  React.useEffect(() => {
    if (isArrived) {
      setIsOtpModalVisible(true);
      return;
    }

    setIsOtpModalVisible(false);
    setPickupOtp('');
    setOtpError(null);
  }, [isArrived]);

  const snapTrackingSheet = React.useCallback(
    (toValue: number) => {
      sheetPositionRef.current = toValue;
      Animated.spring(sheetTranslateY, {
        toValue,
        useNativeDriver: true,
        tension: 78,
        friction: 12,
      }).start();
    },
    [sheetTranslateY]
  );

  const sheetPanResponder = React.useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > 8,
      onPanResponderMove: (_, gestureState) => {
        const nextValue = Math.min(
          TRACKING_SHEET_COLLAPSED_OFFSET,
          Math.max(0, sheetPositionRef.current + gestureState.dy)
        );
        sheetTranslateY.setValue(nextValue);
      },
      onPanResponderRelease: (_, gestureState) => {
        const projectedValue = sheetPositionRef.current + gestureState.dy;
        const shouldCollapse =
          gestureState.vy > 0.45 ||
          projectedValue > TRACKING_SHEET_COLLAPSED_OFFSET * 0.45;

        snapTrackingSheet(shouldCollapse ? TRACKING_SHEET_COLLAPSED_OFFSET : 0);
      },
      onPanResponderTerminate: (_, gestureState) => {
        const projectedValue = sheetPositionRef.current + gestureState.dy;
        snapTrackingSheet(
          projectedValue > TRACKING_SHEET_COLLAPSED_OFFSET * 0.5
            ? TRACKING_SHEET_COLLAPSED_OFFSET
            : 0
        );
      },
    })
  ).current;

  React.useEffect(() => {
    let isActive = true;

    const loadBookingProfilePhoto = async () => {
      const inlinePhotoUri = bookingPerson?.photoUri;

      if (inlinePhotoUri) {
        setBookingPhotoUri(inlinePhotoUri);
        return;
      }

      if (!delivery?.senderId) {
        setBookingPhotoUri(null);
        setBookingCompanyName(getCompanyName(delivery?.sender));
        return;
      }

      try {
        const response = await fetch(
          `${getApiBaseUrl()}/api/firestore/customers/${encodeURIComponent(delivery.senderId)}`
        );
        const body = (await response.json().catch(() => null)) as CustomerProfileResponse | null;
        const photoUri = body?.data?.profilePhotoUrl || body?.data?.photoUri || null;
        const companyName = getCompanyName(body?.data) || getCompanyName(delivery?.sender);

        if (isActive) {
          setBookingPhotoUri(photoUri);
          setBookingCompanyName(companyName);
        }
      } catch (error) {
        console.error('Error loading booking profile photo:', error);
        if (isActive) {
          setBookingPhotoUri(null);
          setBookingCompanyName(getCompanyName(delivery?.sender));
        }
      }
    };

    loadBookingProfilePhoto();

    return () => {
      isActive = false;
    };
  }, [bookingPerson?.photoUri, delivery?.sender, delivery?.senderId]);

  React.useEffect(() => {
    let isActive = true;
    let subscription: Location.LocationSubscription | null = null;

    const updateDriverLocation = (
      nextLocation: LatLng,
      metadata: DriverLocationMetadata = {}
    ) => {
      const previousLocation = previousLocationRef.current;
      const nextHeading =
        typeof metadata.heading === 'number'
          ? metadata.heading
          : previousLocation && getDistanceMeters(previousLocation, nextLocation) > 2
          ? getBearing(previousLocation, nextLocation)
          : headingRef.current;

      driverLocationRef.current = nextLocation;
      previousLocationRef.current = nextLocation;
      headingRef.current = nextHeading;

      if (isActive) {
        setDriverLocation(nextLocation);
        setHasLiveDriverLocation(true);
        setLocationError(null);
      }

      mapRef.current?.animateCamera(
        {
          center: {
            latitude: nextLocation.lat,
            longitude: nextLocation.lng,
          },
          heading: nextHeading,
          pitch: 55,
          zoom: 17.5,
        },
        { duration: 700 }
      );

      const now = Date.now();
      const shouldSyncDriverLocation =
        deliveryId &&
        (lastDriverLocationSyncAtRef.current === 0 ||
          now - lastDriverLocationSyncAtRef.current >= DRIVER_LOCATION_SYNC_INTERVAL_MS);

      if (shouldSyncDriverLocation) {
        lastDriverLocationSyncAtRef.current = now;
        fetch(`${getApiBaseUrl()}/api/deliveries/${deliveryId}/location`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...nextLocation,
            heading: nextHeading,
            accuracy: metadata.accuracy,
            speed: metadata.speed,
          }),
        }).catch((error) => {
          lastDriverLocationSyncAtRef.current = 0;
          console.error('Error updating driver location:', error);
        });
      }
    };

    const loadDriverLocation = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();

        if (status !== Location.PermissionStatus.GRANTED) {
          if (isActive) {
            setLocationError('Location permission needed for live route');
          }
          return;
        }

        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        const nextLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };

        updateDriverLocation(nextLocation, {
          heading: position.coords.heading,
          accuracy: position.coords.accuracy,
          speed: position.coords.speed,
        });

        subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            distanceInterval: 0,
            timeInterval: DRIVER_LOCATION_SYNC_INTERVAL_MS,
          },
          (location) => {
            updateDriverLocation(
              {
                lat: location.coords.latitude,
                lng: location.coords.longitude,
              },
              {
                heading: location.coords.heading,
                accuracy: location.coords.accuracy,
                speed: location.coords.speed,
              }
            );
          }
        );
      } catch (error) {
        console.error('Error loading driver location:', error);
        if (isActive) {
          setLocationError('Unable to get current location');
        }
      }
    };

    loadDriverLocation();

    return () => {
      isActive = false;
      subscription?.remove();
    };
  }, [deliveryId]);

  React.useEffect(() => {
    if (driverLocation && !routeStartLocation) {
      setRouteStartLocation(driverLocation);
    }
  }, [driverLocation, routeStartLocation]);

  React.useEffect(() => {
    const latestDriverLocation = driverLocationRef.current;

    if (latestDriverLocation) {
      setRouteStartLocation(latestDriverLocation);
      setRouteRefreshIndex((current) => current + 1);
    }
  }, [isInTransit]);

  React.useEffect(() => {
    if (!driverLocation || routeCoordinates.length < 2) {
      return;
    }

    const offRouteDistance = getDistanceToRouteMeters(driverLocation, routeCoordinates);
    const canReroute = Date.now() - lastRerouteAtRef.current > REROUTE_COOLDOWN_MS;

    if (offRouteDistance > OFF_ROUTE_THRESHOLD_METERS && canReroute) {
      lastRerouteAtRef.current = Date.now();
      setRouteStartLocation(driverLocation);
      setRouteRefreshIndex((current) => current + 1);
    }
  }, [driverLocation, routeCoordinates]);

  React.useEffect(() => {
    let isActive = true;

    const loadBestRoute = async () => {
      if (!GOOGLE_MAPS_API_KEY || !routeStartLocation || !routeDestination) {
        if (isActive) {
          setRouteCoordinates([]);
          setRouteSegments([]);
          setRouteSteps([]);
          setRouteDuration(null);
          setRouteDistance(null);
        }
        return;
      }

      try {
        const routesResponse = await fetch(
          'https://routes.googleapis.com/directions/v2:computeRoutes',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
              'X-Goog-FieldMask':
                'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.travelAdvisory.speedReadingIntervals,routes.legs.steps.distanceMeters,routes.legs.steps.startLocation,routes.legs.steps.endLocation,routes.legs.steps.navigationInstruction',
            },
            body: JSON.stringify({
              origin: {
                location: {
                  latLng: {
                    latitude: routeStartLocation.lat,
                    longitude: routeStartLocation.lng,
                  },
                },
              },
              destination: {
                location: {
                  latLng: {
                    latitude: routeDestination.lat,
                    longitude: routeDestination.lng,
                  },
                },
              },
              travelMode: 'DRIVE',
              routingPreference: 'TRAFFIC_AWARE_OPTIMAL',
              polylineQuality: 'HIGH_QUALITY',
              polylineEncoding: 'ENCODED_POLYLINE',
              extraComputations: ['TRAFFIC_ON_POLYLINE'],
            }),
          }
        );

        if (routesResponse.ok) {
          const routesBody = (await routesResponse.json().catch(() => null)) as RoutesApiResponse | null;
          const route = routesBody?.routes?.[0];
          const encodedPolyline = route?.polyline?.encodedPolyline;

          if (encodedPolyline) {
            const coordinates = decodePolyline(encodedPolyline);
            const steps =
              route?.legs?.[0]?.steps
                ?.map((step): NavigationStep | null => {
                  const startLat = step.startLocation?.latLng?.latitude;
                  const startLng = step.startLocation?.latLng?.longitude;
                  const endLat = step.endLocation?.latLng?.latitude;
                  const endLng = step.endLocation?.latLng?.longitude;

                  if (
                    typeof startLat !== 'number' ||
                    typeof startLng !== 'number' ||
                    typeof endLat !== 'number' ||
                    typeof endLng !== 'number'
                  ) {
                    return null;
                  }

                  return {
                    instruction: step.navigationInstruction?.instructions || 'Continue on route',
                    maneuver: step.navigationInstruction?.maneuver,
                    start: { lat: startLat, lng: startLng },
                    end: { lat: endLat, lng: endLng },
                    distanceMeters: step.distanceMeters || 0,
                  };
                })
                .filter((step): step is NavigationStep => Boolean(step)) || [];

            if (isActive) {
              setRouteCoordinates(coordinates);
              setRouteSegments(
                buildTrafficSegments(coordinates, route?.travelAdvisory?.speedReadingIntervals)
              );
              setRouteSteps(steps);
              setRouteDuration(formatDurationSeconds(route?.duration));
              setRouteDistance(formatDistanceMeters(route?.distanceMeters || null));
            }

            return;
          }

          throw new Error(routesBody?.error?.message || 'Routes API did not return a route');
        }

        const origin = `${routeStartLocation.lat},${routeStartLocation.lng}`;
        const destination = `${routeDestination.lat},${routeDestination.lng}`;
        const response = await fetch(
          'https://maps.googleapis.com/maps/api/directions/json' +
            `?origin=${origin}` +
            `&destination=${destination}` +
            '&mode=driving' +
            '&departure_time=now' +
            '&alternatives=false' +
            `&key=${GOOGLE_MAPS_API_KEY}`
        );
        const body = (await response.json().catch(() => null)) as GoogleDirectionsResponse | null;
        const route = body?.routes?.[0];
        const leg = route?.legs?.[0];
        const steps =
          leg?.steps
            ?.map((step): NavigationStep | null => {
              const startLat = step.start_location?.lat;
              const startLng = step.start_location?.lng;
              const endLat = step.end_location?.lat;
              const endLng = step.end_location?.lng;

              if (
                typeof startLat !== 'number' ||
                typeof startLng !== 'number' ||
                typeof endLat !== 'number' ||
                typeof endLng !== 'number'
              ) {
                return null;
              }

              return {
                instruction: stripHtml(step.html_instructions),
                maneuver: step.maneuver,
                start: { lat: startLat, lng: startLng },
                end: { lat: endLat, lng: endLng },
                distanceMeters: step.distance?.value || 0,
              };
            })
            .filter((step): step is NavigationStep => Boolean(step)) || [];

        if (!response.ok || !route?.overview_polyline?.points) {
          throw new Error(body?.error_message || body?.status || 'Unable to load route');
        }

        if (isActive) {
          const coordinates = decodePolyline(route.overview_polyline.points);
          setRouteCoordinates(coordinates);
          setRouteSegments([{ coordinates, color: '#0055cc' }]);
          setRouteSteps(steps);
          setRouteDuration(leg?.duration?.text || null);
          setRouteDistance(leg?.distance?.text || null);
        }
      } catch (error) {
        console.error('Error loading Google route:', error);
      }
    };

    loadBestRoute();

    return () => {
      isActive = false;
    };
  }, [routeStartLocation, routeDestination, routeRefreshIndex]);

  const handleCallBookingPerson = async () => {
    if (!bookingPhone) {
      showAlert('Phone unavailable', 'No phone number is available for this booking.');
      return;
    }

    await Linking.openURL(`tel:${bookingPhone}`);
  };

  const handleOpenDirections = async () => {
    if (!routeDestination) {
      showAlert('Location unavailable', 'No destination coordinates are available for this trip.');
      return;
    }

    const destination = `${routeDestination.lat},${routeDestination.lng}`;
    const webUrl = `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`;
    const nativeUrl =
      Platform.OS === 'android'
        ? `google.navigation:q=${destination}&mode=d`
        : `comgooglemaps://?daddr=${destination}&directionsmode=driving`;

    try {
      const canOpenNative = await Linking.canOpenURL(nativeUrl);
      await Linking.openURL(canOpenNative ? nativeUrl : webUrl);
    } catch (error) {
      console.error('Error opening navigation:', error);
      await Linking.openURL(webUrl);
    }
  };

  const handleVerifyOtp = React.useCallback(async () => {
    if (pickupOtp.length !== 4 || isVerifyingOtp) {
      return;
    }

    setIsVerifyingOtp(true);
    setOtpError(null);

    const isValid = await onVerifyPickupOtp(pickupOtp);

    if (!isValid) {
      setOtpError('Invalid OTP');
      setPickupOtp('');
    } else {
      Keyboard.dismiss();
      setIsOtpModalVisible(false);
    }

    setIsVerifyingOtp(false);
  }, [isVerifyingOtp, onVerifyPickupOtp, pickupOtp]);

  return (
    <SafeAreaView style={styles.acceptedContainer}>
      <View style={styles.mapPanel}>
        <MapView
          ref={mapRef}
          style={styles.mapView}
          provider={PROVIDER_GOOGLE}
          initialRegion={routeRegion}
          showsUserLocation
          showsMyLocationButton
          followsUserLocation
          showsCompass
          showsTraffic
          loadingEnabled
          toolbarEnabled={false}
        >
          {pickupLocation ? (
            <Marker
              coordinate={toMapCoordinate(pickupLocation)}
              title="Pickup point"
              description={isInTransit ? getAddressParts(pickupAddress).primaryAddress : primaryAddress}
            >
              <View style={styles.pickupMapMarker}>
                <Image source={trackingLocationImage} style={styles.pickupMapMarkerImage} resizeMode="contain" />
              </View>
            </Marker>
          ) : null}

          {isInTransit && dropLocation ? (
            <Marker coordinate={toMapCoordinate(dropLocation)} title="Drop point" description={primaryAddress}>
              <View style={styles.dropMapMarker}>
                <Ionicons name="flag" size={17} color="#ffffff" />
              </View>
            </Marker>
          ) : null}

          {routeSegments.length > 0
            ? routeSegments.map((segment, index) => (
                <Polyline
                  key={`route-segment-${index}`}
                  coordinates={segment.coordinates.map(toMapCoordinate)}
                  strokeColor={segment.color}
                  strokeWidth={6}
                  lineCap="round"
                  lineJoin="round"
                />
              ))
            : null}
        </MapView>
      </View>
    
    <StatusBar backgroundColor="#fff" />
      <Animated.View
        style={[
          styles.pickupSheet,
          {
            height: TRACKING_SHEET_HEIGHT + 85,
            paddingBottom: insets.bottom + 16,
            transform: [{ translateY: sheetTranslateY }],
          },
          
        ]}
      >
        <View style={styles.pickupSheetContent}>
          <View style={styles.arrivalCard} {...sheetPanResponder.panHandlers}>
            <View style={styles.dragHandleWrap}>
              <View style={styles.dragHandle} />
            </View>

            <View style={styles.arrivalInfoRow}>
              <View style={styles.arrivalCopy}>
                <Text style={styles.arrivalTitle}>{etaTitle}</Text>
                <Text style={styles.arrivalSubtitle} numberOfLines={1}>
                  {nextInstruction}
                </Text>
              </View>

              <View style={styles.distanceBadge}>
                <Image source={trackingLocationImage} style={styles.distanceBadgeIcon} resizeMode="contain" />
                <Text style={styles.distanceBadgeText}>{arrivalDistance}</Text>
              </View>
            </View>
          </View>

          <View style={styles.bookingPersonRow}>
            <Image
              source={bookingPhotoUri ? { uri: bookingPhotoUri } : customerAvatarImage}
              style={styles.bookingAvatar}
              resizeMode="cover"
            />
            <View style={styles.bookingCopy}>
              <Text style={styles.bookingName} numberOfLines={1}>
                {bookingName}
              </Text>
              <View style={styles.bookingMetaRow}>
                <View style={styles.bookingDot} />
                <Text style={styles.bookingMeta} numberOfLines={1}>
                  {bookingCompanyName || 'Company name unavailable'}
                </Text>
              </View>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Call booking customer"
              style={styles.callButton}
              onPress={handleCallBookingPerson}
            >
              <Image source={supportCallImage} style={styles.callButtonIcon} resizeMode="contain" />
            </Pressable>
          </View>

          <View style={styles.headingCard}>
            <View style={styles.headingHeader}>
              <View style={styles.headingTitleRow}>
                <Image source={tableLocationImage} style={styles.headingTitleIcon} resizeMode="contain" />
                <Text style={styles.headingTitle}>Heading to</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open delivery details"
                style={styles.headingDetailsButton}
                onPress={onOpenDeliveryDetails}
              >
                <Text style={styles.headingDetailsText}>Delivery details</Text>
                <Ionicons name="arrow-forward" size={18} color="#606060" />
              </Pressable>
            </View>

            <Pressable
              style={styles.headingAddressBox}
              accessibilityRole="button"
              accessibilityLabel="Open directions"
              onPress={handleOpenDirections}
            >
              <Text style={styles.headingAddressTitle} numberOfLines={1}>
                {isInTransit ? 'Drop' : 'Pickup'}-{routeDistance || pickupDistance} away
              </Text>
              <Text style={styles.headingAddressPrimary} numberOfLines={1}>
                {primaryAddress}
              </Text>
              {secondaryAddress ? (
                <Text style={styles.headingAddressSecondary} numberOfLines={1}>
                  {secondaryAddress}
                </Text>
              ) : null}
            </Pressable>
          </View>
        </View>

        <View style={styles.pickupActionArea}>
          {isArrived ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Enter pickup OTP"
              style={styles.arrivedButton}
              onPress={() => setIsOtpModalVisible(true)}
            >
              <Text style={styles.arrivedButtonText}>Enter pickup OTP</Text>
            </Pressable>
          ) : isInTransit ? (
            <View style={styles.inTransitCard}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Arrived drop location"
                style={[
                  styles.completeDropButton,
                  isUpdatingStatus || !hasArrivedAtDrop ? styles.arrivedButtonDisabled : null,
                ]}
                disabled={isUpdatingStatus || !hasArrivedAtDrop}
                onPress={onCompleteDrop}
              >
                <Text style={styles.completeDropButtonText}>
                  {isUpdatingStatus
                    ? 'Completing trip...'
                    : hasArrivedAtDrop
                      ? 'Arrived drop location'
                      : 'Reach drop location'}
                </Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Arrived pickup point"
              style={[
                styles.arrivedButton,
                isUpdatingStatus || !canArrive ? styles.arrivedButtonDisabled : null,
              ]}
              disabled={!deliveryId || isUpdatingStatus || !canArrive}
              onPress={onArrivedPickupPoint}
            >
              <Text style={styles.arrivedButtonText}>
                {isUpdatingStatus ? 'Updating...' : 'Arrived pickup point'}
              </Text>
            </Pressable>
          )}
        </View>
      
      </Animated.View>

      <Modal
        visible={isArrived && isOtpModalVisible} 
        transparent  
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => false}
      >
        <Pressable
    style={styles.otpModalBackdrop}
    onPress={() => setIsOtpModalVisible(false)}
  >
    <Pressable
      onPress={(e) => e.stopPropagation()}
    >
        {/* <View style={styles.otpModalBackdrop}> */}
          
          <OtpVerificationCard
          value={pickupOtp}
          error={otpError}
          isLoading={isVerifyingOtp}
          onChange={(nextValue) => {
            setPickupOtp(nextValue);
            setOtpError(null);
          }}
          onSubmit={handleVerifyOtp}
        />
        {/* </View> */}
        </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function FareLine({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.fareLine}>
      <Text style={[styles.fareLabel, strong ? styles.fareTotalLabel : null]} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[styles.fareValue, strong ? styles.fareTotalValue : null]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function CancelDeliveryModal({
  visible,
  onClose,
  onSendRequest,
}: {
  visible: boolean;
  onClose: () => void;
  onSendRequest: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.cancelModalBackdrop} onPress={onClose}>
        <Pressable style={styles.cancelModalCard} onPress={(event) => event.stopPropagation()}>
          <View style={styles.cancelModalContent}>
            <View style={styles.cancelWarningIcon}>
              <Text style={styles.cancelWarningText}>!</Text>
            </View>

            <View style={styles.cancelModalCopy}>
              <Text style={styles.cancelModalTitle}>Request to cancel{'\n'}this Trip?</Text>
              <Text style={styles.cancelModalSubtitle}>you cannot undo this action!</Text>
            </View>
          </View>

          <View style={styles.cancelModalActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Do not cancel delivery"
              style={styles.cancelModalNoButton}
              onPress={onClose}
            >
              <Text style={styles.cancelModalNoText}>No</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Send cancellation request"
              style={styles.cancelModalSendButton}
              onPress={onSendRequest}
            >
              <Text style={styles.cancelModalSendText}>Send request</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function CompletedDropScreen({
  totalEarning,
  onFindNewJobs,
}: {
  totalEarning: number;
  onFindNewJobs: () => void;
}) {
  return (
    <SafeAreaView style={styles.completedContainer}>
      <View style={styles.completedMain}>
        {/* <View style={styles.completedStatusSpacer} /> */}
        <View style={styles.completedTopNav}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to jobs"
            style={styles.completedBackButton}
            onPress={onFindNewJobs}
          >
            <Ionicons name="arrow-back" size={24} color="#1c1c1c" />
          </Pressable>
          <Text style={styles.completedNavTitle}>Trip Completed</Text>
        </View>

        <View style={styles.completedBody}>
          <Image
            source={tripCompletedBanknoteImage}
            style={styles.completedIllustration}
            resizeMode="contain"
          />

          <View style={styles.completedCopyBlock}>
            <View style={styles.completedSuccessRow}>
              <Image
                source={tripCompletedTickImage}
                style={styles.completedTickIcon}
                resizeMode="contain"
              />
              <Text style={styles.completedSuccessText}>Delivery completed</Text>
            </View>
            <View style={styles.completedEarningCopy}>
              <Text style={styles.completedEarningValue}>{formatCurrency(totalEarning)} earned</Text>
              <Text style={styles.completedSubtitle}>
                Payment will be sent to your bank account within 24 hours.
              </Text>
            </View>
          </View>
        </View>
      </View>

      <View style={[styles.completedCtaBar]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Find new jobs"
          style={styles.completedHomeButton}
          onPress={onFindNewJobs}
        >
          <Text style={styles.completedHomeText}>Find New Jobs</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function SlideAcceptButton({
  isLoading,
  isDisabled,
  onAccept,
}: {
  isLoading: boolean;
  isDisabled: boolean;
  onAccept: () => Promise<void>;
}) {
  const slideX = React.useRef(new Animated.Value(0)).current;
  const [trackWidth, setTrackWidth] = React.useState(0);
  const isAcceptingRef = React.useRef(false);
  const maxSlideDistance = Math.max(trackWidth - 52, 0);
  const acceptThreshold = maxSlideDistance * 0.82;

  const resetSlide = React.useCallback(() => {
    Animated.timing(slideX, {
      toValue: 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [slideX]);

  React.useEffect(() => {
    if (!isLoading) {
      isAcceptingRef.current = false;
      resetSlide();
    }
  }, [isLoading, resetSlide]);

  const completeSlide = React.useCallback(() => {
    if (isAcceptingRef.current) {
      return;
    }

    isAcceptingRef.current = true;
    Animated.timing(slideX, {
      toValue: maxSlideDistance,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) {
        isAcceptingRef.current = false;
        return;
      }

      onAccept().finally(() => {
        isAcceptingRef.current = false;
        resetSlide();
      });
    });
  }, [maxSlideDistance, onAccept, resetSlide, slideX]);

  const slidePanResponder = React.useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !isDisabled && !isLoading && maxSlideDistance > 0,
        onMoveShouldSetPanResponder: (_, gestureState) =>
          !isDisabled && !isLoading && maxSlideDistance > 0 && Math.abs(gestureState.dx) > 4,
        onPanResponderMove: (_, gestureState) => {
          const nextValue = Math.min(maxSlideDistance, Math.max(0, gestureState.dx));
          slideX.setValue(nextValue);
        },
        onPanResponderRelease: (_, gestureState) => {
          const finalValue = Math.min(maxSlideDistance, Math.max(0, gestureState.dx));

          if (finalValue >= acceptThreshold) {
            completeSlide();
            return;
          }

          resetSlide();
        },
        onPanResponderTerminate: resetSlide,
      }),
    [acceptThreshold, completeSlide, isDisabled, isLoading, maxSlideDistance, resetSlide, slideX]
  );

  return (
    <View
      accessibilityLabel="Slide to accept trip"
      style={[styles.acceptButton, isDisabled ? styles.acceptButtonDisabled : null]}
      onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
    >
      <Text style={styles.acceptText}>{isLoading ? 'Accepting...' : 'Slide to accept'}</Text>
      <Animated.View
        {...slidePanResponder.panHandlers}
        style={[
          styles.acceptIconBox,
          styles.acceptSlideIconBox,
          { transform: [{ translateX: slideX }] },
        ]}
      >
        <Ionicons name="arrow-forward" size={20} color="#ffffff" />
      </Animated.View>
    </View>
  );
}

export default function AcceptedTripScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { deliveryId, view } = useLocalSearchParams<{ deliveryId?: string; view?: string }>();
  const [delivery, setDelivery] = React.useState<DeliveryDetails | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isAccepting, setIsAccepting] = React.useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = React.useState(false);
  const [isCancelModalVisible, setIsCancelModalVisible] = React.useState(false);
  const [pickupRouteSummary, setPickupRouteSummary] = React.useState<RouteSummary | null>(null);
  const [dropRouteSummary, setDropRouteSummary] = React.useState<RouteSummary | null>(null);
  const [isLoadingDetailRoutes, setIsLoadingDetailRoutes] = React.useState(false);
  const hasLoadedDeliveryRef = React.useRef(false);
  const { alertModal, showAlert } = useAppAlert();

  React.useEffect(() => {
    let isActive = true;

    const loadDelivery = async () => {
      if (!deliveryId) {
        setIsLoading(false);
        return;
      }

      try {
        if (!hasLoadedDeliveryRef.current) {
          setIsLoading(true);
        }
        const response = await fetch(`${getApiBaseUrl()}/api/deliveries/${deliveryId}`);
        const body = (await response.json().catch(() => null)) as {
          success?: boolean;
          data?: DeliveryDetails;
          error?: string;
        } | null;

        if (!response.ok || body?.success === false) {
          throw new Error(body?.error || 'Unable to load accepted trip');
        }

        if (isActive) {
          setDelivery(body?.data || null);
        }
      } catch (error) {
        console.error('Error loading accepted trip:', error);
      } finally {
        if (isActive) {
          hasLoadedDeliveryRef.current = true;
          setIsLoading(false);
        }
      }
    };

    loadDelivery();
    const interval = setInterval(loadDelivery, 5000);

    return () => {
      isActive = false;
      clearInterval(interval);
    };
  }, [deliveryId]);

  const distanceKm = getDistanceKm(delivery);
  const fareDistanceKm = Number.isFinite(distanceKm) && distanceKm ? distanceKm : 0;
  const totalAmount = getCurrencyNumber(delivery?.pricing?.tripFare ?? delivery?.pricing?.total);
  const baseFare = getCurrencyNumber(delivery?.pricing?.baseFare);
  const distanceFare = getCurrencyNumber(delivery?.pricing?.distanceFare);
  const fuelCost = getCurrencyNumber(delivery?.pricing?.fuelCost);
  const fareLineSubtotal = baseFare + distanceFare + fuelCost;
  const totalEarning = totalAmount || fareLineSubtotal;
  const explicitPerKmRate = getCurrencyNumber(
    delivery?.pricing?.perKmRate ?? delivery?.pricing?.ratePerKm
  );
  const perKmRate =
    explicitPerKmRate ||
    (fareDistanceKm > 0 && totalEarning > 0 ? totalEarning / fareDistanceKm : 0);
  const pickupDistanceKm = Number(delivery?.pricing?.pickupDistanceKm);
  const pickupAddress = delivery?.locations?.pickup?.address || 'Pickup address unavailable';
  const pickupLocation = isValidCoord(delivery?.locations?.pickup?.coords)
    ? delivery.locations.pickup.coords
    : null;
  const dropAddress = delivery?.locations?.dropoff?.address || 'Drop address unavailable';
  const dropLocation = isValidCoord(delivery?.locations?.dropoff?.coords)
    ? delivery.locations.dropoff.coords
    : null;
  const isCompletedDelivery =
    delivery?.status === 'delivered' || delivery?.status === 'completed';
  const isAccepted =
    delivery?.status === 'assigned' ||
    delivery?.status === 'arrived' ||
    delivery?.status === 'in_transit' ||
    (!isCompletedDelivery && Boolean(delivery?.driver));
  const isDetailsView = view === 'details';
  const showTrackingView = isAccepted && !isCompletedDelivery && !isDetailsView;
  const pickupDetailTitle = pickupRouteSummary?.distanceText
    ? `To Pickup ${pickupRouteSummary.distanceText}`
    : 'To Pickup';
  const pickupDetailTime = pickupRouteSummary?.durationText
    ? formatApproxDuration(pickupRouteSummary.durationText)
    : isLoadingDetailRoutes
    ? 'Calculating route...'
    : 'Route unavailable';
  const dropDetailTitle = dropRouteSummary?.distanceText
    ? `Drop ${dropRouteSummary.distanceText}`
    : 'Drop';
  const dropDetailTime = dropRouteSummary?.durationText
    ? formatApproxDuration(dropRouteSummary.durationText)
    : isLoadingDetailRoutes
    ? 'Calculating route...'
    : 'Route unavailable';

  React.useEffect(() => {
    let isActive = true;

    const loadDetailRouteSummaries = async () => {
      if (!isDetailsView || !pickupLocation || !dropLocation) {
        setPickupRouteSummary(null);
        setDropRouteSummary(null);
        setIsLoadingDetailRoutes(false);
        return;
      }

      try {
        setIsLoadingDetailRoutes(true);
        const { status } = await Location.requestForegroundPermissionsAsync();
        let currentLocation: LatLng | null = null;

        if (status === Location.PermissionStatus.GRANTED) {
          const position = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          currentLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
        }

        const [pickupSummary, dropSummary] = await Promise.all([
          fetchDrivingRouteSummary(currentLocation, pickupLocation),
          fetchDrivingRouteSummary(pickupLocation, dropLocation),
        ]);

        if (isActive) {
          setPickupRouteSummary(pickupSummary);
          setDropRouteSummary(dropSummary);
          setIsLoadingDetailRoutes(false);
        }
      } catch (error) {
        console.error('Error loading delivery detail route summaries:', error);

        if (isActive) {
          setPickupRouteSummary(getFallbackRouteSummary(null, pickupLocation));
          setDropRouteSummary(getFallbackRouteSummary(pickupLocation, dropLocation));
          setIsLoadingDetailRoutes(false);
        }
      }
    };

    loadDetailRouteSummaries();

    return () => {
      isActive = false;
    };
  }, [dropLocation, isDetailsView, pickupLocation]);

  const handleReportIssue = () => {
    if (!deliveryId) {
      return;
    }

    const deliveryTitle = pickupAddress || dropAddress;

    router.push({
      pathname: '/report-problem',
      params: {
        deliveryId,
        deliveryTitle,
        prefillCategory: 'Delivery Issue',
      },
    });
  };

  const handleCancelDelivery = () => {
    setIsCancelModalVisible(true);
  };

  const handleSendCancelRequest = () => {
    setIsCancelModalVisible(false);
    handleReportIssue();
  };

  const handleAcceptDelivery = async () => {
    if (!deliveryId || isAccepting || isAccepted) {
      return;
    }

    const [storedUid, storedIdToken] = await Promise.all([
      AsyncStorage.getItem('firebaseUid'),
      AsyncStorage.getItem('firebaseIdToken'),
    ]);
    const uid = auth.currentUser?.uid || storedUid;

    if (!uid) {
      showAlert('Login required', 'Please login again before accepting this trip.');
      return;
    }

    setIsAccepting(true);

    try {
      const profile = await getDriverProfile(uid, storedIdToken);
      const response = await fetch(`${getApiBaseUrl()}/api/deliveries/${deliveryId}/assign`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          driverId: uid,
          driver: {
            fullName: profile?.fullName || '',
            phoneNumber: profile?.phoneNumber || '',
            photoUri: profile?.profilePhotoUrl || profile?.photoUri || '',
            vehicleNumber: profile?.vehicleNumber || '',
            vehicleType: profile?.vehicleType || '',
            vehicleCapacity: profile?.vehicleCapacity || '',
          },
        }),
      });
      const body = (await response.json().catch(() => null)) as {
        success?: boolean;
        error?: string;
      } | null;

      if (!response.ok || body?.success === false) {
        throw new Error(body?.error || 'Unable to accept this delivery');
      }

      const refreshed = await fetch(`${getApiBaseUrl()}/api/deliveries/${deliveryId}`);
      const refreshedBody = (await refreshed.json().catch(() => null)) as {
        success?: boolean;
        data?: DeliveryDetails;
      } | null;

      if (refreshed.ok && refreshedBody?.data) {
        setDelivery(refreshedBody.data);
      } else {
        setDelivery((current) =>
          current
            ? {
                ...current,
                status: 'assigned',
                driver: {
                  fullName: profile?.fullName || '',
                  phoneNumber: profile?.phoneNumber || '',
                  photoUri: profile?.profilePhotoUrl || profile?.photoUri || '',
                  vehicleNumber: profile?.vehicleNumber || '',
                  vehicleType: profile?.vehicleType || '',
                  vehicleCapacity: profile?.vehicleCapacity || '',
                },
              }
            : current
        );
      }
    } catch (error) {
      console.error('Error accepting delivery:', error);
      showAlert('Accept failed', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setIsAccepting(false);
    }
  };

  const handleArrivedPickupPoint = async () => {
    if (!deliveryId || isUpdatingStatus) {
      return;
    }

    setIsUpdatingStatus(true);

    try {
      const response = await fetch(`${getApiBaseUrl()}/api/deliveries/${deliveryId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'arrived' }),
      });
      const body = (await response.json().catch(() => null)) as {
        success?: boolean;
        error?: string;
      } | null;

      if (!response.ok || body?.success === false) {
        throw new Error(body?.error || 'Unable to update pickup arrival');
      }

      setDelivery((current) =>
        current
          ? {
              ...current,
              status: 'arrived',
            }
          : current
      );
    } catch (error) {
      console.error('Error updating pickup arrival:', error);
      showAlert('Update failed', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleVerifyPickupOtp = async (otp: string) => {
    if (!deliveryId) {
      return false;
    }

    const expectedOtp = delivery?.tracking?.otp;

    if (!expectedOtp || otp !== expectedOtp) {
      return false;
    }

    try {
      const response = await fetch(`${getApiBaseUrl()}/api/deliveries/${deliveryId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'in_transit' }),
      });
      const body = (await response.json().catch(() => null)) as {
        success?: boolean;
        error?: string;
      } | null;

      if (!response.ok || body?.success === false) {
        throw new Error(body?.error || 'Unable to start delivery');
      }

      setDelivery((current) =>
        current
          ? {
              ...current,
              status: 'in_transit',
            }
          : current
      );

      return true;
    } catch (error) {
      console.error('Error verifying pickup OTP:', error);
      showAlert('OTP failed', error instanceof Error ? error.message : 'Please try again.');
      return false;
    }
  };

  const handleCompleteDrop = async () => {
    if (!deliveryId || isUpdatingStatus) {
      return;
    }

    setIsUpdatingStatus(true);

    try {
      const response = await fetch(`${getApiBaseUrl()}/api/deliveries/${deliveryId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'delivered' }),
      });
      const body = (await response.json().catch(() => null)) as {
        success?: boolean;
        error?: string;
      } | null;

      if (!response.ok || body?.success === false) {
        throw new Error(body?.error || 'Unable to complete delivery');
      }

      setDelivery((current) =>
        current
          ? {
              ...current,
              status: 'delivered',
            }
          : current
      );
    } catch (error) {
      console.error('Error completing delivery:', error);
      showAlert('Complete failed', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  if (isCompletedDelivery && !isDetailsView) {
    return (
      <CompletedDropScreen
        totalEarning={totalEarning}
        onFindNewJobs={() => router.replace('/(tabs)')}
      />
    );
  }

  if (showTrackingView) {
    return (
      <>
        < AcceptedPickupView
          delivery={delivery}
          deliveryId={deliveryId}
          pickupDistanceKm={pickupDistanceKm}
          pickupAddress={pickupAddress}
          pickupLocation={pickupLocation}
          dropAddress={dropAddress}
          dropLocation={dropLocation}
          isUpdatingStatus={isUpdatingStatus}
          onArrivedPickupPoint={handleArrivedPickupPoint}
          onVerifyPickupOtp={handleVerifyPickupOtp}
          onCompleteDrop={handleCompleteDrop}
          onOpenDeliveryDetails={() =>
            router.push({
              pathname: '/accepted-trip',
              params: {
                deliveryId,
                view: 'details',
              },
            })
          }
        />
        {alertModal}
      </>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <TopNav
        onHelp={handleReportIssue}
        onBack={
          isAccepted && isDetailsView
            ? () =>
                router.replace({
                  pathname: '/accepted-trip',
                  params: { deliveryId },
                })
            : isCompletedDelivery || isDetailsView
              ? () => router.back()
            : undefined
        }
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.earningBlock}>
          <Text style={styles.earningLabel}>
            {isCompletedDelivery ? 'Total earning' : 'Estimated earnings'}
          </Text>
          <Text style={styles.earningValue}>{isLoading ? '...' : formatCurrency(totalEarning)}</Text>
        </View>

        <View style={styles.routeCard}>
          <View style={styles.routeHeader}>
            <Image source={tableLocationImage} style={styles.routeHeaderIcon} resizeMode="contain" />
            <Text style={styles.sectionTitle}>Route</Text>
          </View>

          <View style={styles.routeBox}>
          {/* <View style={styles.routeConnector} /> */}
            
               <Image source={ pickAndDropIcon } style={styles.routeIcon}  />
        
        
           <View>
                
              <RouteRow
              variant="pickup"
              title={pickupDetailTitle}
              time={pickupDetailTime}
              address={pickupAddress}
            />
            <View style={styles.routeSeparator} />
            <RouteRow
              variant="drop"
              title={dropDetailTitle}
              time={dropDetailTime}
              address={dropAddress}
            />

           </View>
            
          </View>
        </View>

        <View style={styles.fareSection}>
          <Text style={styles.sectionTitle}>Fare Breakdown</Text>
          <View style={styles.fareList}>
            <FareLine label="Trip distance" value={formatFareDistance(fareDistanceKm)} />
            <FareLine label="Per km rate" value={formatPerKmRate(perKmRate)} />
            <View style={styles.fareDivider} />
            <FareLine label="Total earning" value={formatCurrency(totalEarning)} strong />
            <View style={styles.fareDivider} />
          </View>
        </View>
      </ScrollView>

      <View style={[styles.ctaBar]}>
        {isCompletedDelivery ? (
          <Pressable style={styles.reportButton} onPress={handleReportIssue}>
            <Text style={styles.reportButtonText}>Report issue</Text>
            <Ionicons name="arrow-forward" size={20} color="#d00416" />
          </Pressable>
        ) : isAccepted && isDetailsView ? (
          <Pressable style={styles.cancelDeliveryButton} onPress={handleCancelDelivery}>
            <Text style={styles.cancelDeliveryButtonText}>Cancel Delivery</Text>
          </Pressable>
        ) : !isAccepted ? (
          <SlideAcceptButton
            isLoading={isAccepting}
            isDisabled={isAccepting || isLoading}
            onAccept={handleAcceptDelivery}
          />
        ) : (
          <Pressable
            style={styles.acceptButton}
            onPress={() =>
              router.replace({
                pathname: '/accepted-trip',
                params: { deliveryId },
              })
            }
          >
            <View style={styles.acceptIconBox}>
              <Ionicons name="navigate" size={20} color="#ffffff" />
            </View>
            <Text style={styles.acceptText}>Back to tracking</Text>
            <View style={styles.acceptIconGhost} />
          </Pressable>
        )}
         
      </View>

      <CancelDeliveryModal
        visible={isCancelModalVisible}
        onClose={() => setIsCancelModalVisible(false)}
        onSendRequest={handleSendCancelRequest}
      />
      {alertModal}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  completedContainer: {
    flex: 1,
    backgroundColor: '#eff2f6',
  },
  completedMain: {
    flex: 1,
    width: '100%',
  },
  completedStatusSpacer: {
    height: vs(52),
  },
  completedTopNav: {
    minHeight: vs(64),
    width: '100%',
    maxWidth: rs(720, 320, 720),
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: rs(4),
    paddingVertical: vs(8),
  },
  completedBackButton: {
    width: rs(48),
    height: rs(48),
    alignItems: 'center',
    justifyContent: 'center',
  },
  completedNavTitle: {
    fontFamily: 'Poppins_500Medium',
    fontSize: fs(20, 17, 22),
    lineHeight: fs(32, 26, 34),
    color: '#1c1c1c',
  },
  completedBody: {
    flex: 1,
    width: '100%',
    maxWidth: rs(412, 320, 430),
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    gap: vs(40),
  },
  completedIllustration: {
    width: '100%',
    maxWidth: rs(412, 320, 430),
    height: vs(334, 260, 360),
  },
  completedCopyBlock: {
    width: '100%',
    alignItems: 'center',
    gap: vs(8),
    paddingHorizontal: rs(16),
  },
  completedSuccessRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: rs(4),
  },
  completedTickIcon: {
    width: rs(24),
    height: rs(24),
  },
  completedSuccessText: {
    flexShrink: 1,
    fontFamily: 'Poppins_500Medium',
    fontSize: fs(16),
    lineHeight: fs(20),
    color: '#007f3c',
    letterSpacing: -0.5,
  },
  completedEarningCopy: {
    width: '100%',
    alignItems: 'center',
    gap: vs(4),
  },
  completedEarningValue: {
    fontFamily: 'Poppins_500Medium',
    fontSize: fs(40, 30, 42),
    lineHeight: fs(48, 36, 50),
    color: '#1c1c1c',
    textAlign: 'center',
  },
  completedSubtitle: {
    width: '100%',
    fontFamily: 'Poppins_400Regular',
    fontSize: fs(16),
    lineHeight: fs(24),
    color: '#1c1c1c',
    textAlign: 'center',
  },
  completedCtaBar: {
    alignItems: 'center',
    paddingTop: vs(8),
    paddingBottom: vs(16),
    paddingHorizontal: rs(16),
  },
  completedHomeButton: {
    minHeight: vs(60),
    width: '100%',
    maxWidth: rs(361, 300, 380),
    borderRadius: rs(12),
    backgroundColor: '#05c',
    alignItems: 'center',
    justifyContent: 'center',
  },
  completedHomeText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: fs(16),
    lineHeight: fs(20),
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  acceptedContainer: {
    flex: 1,
    backgroundColor: '#eff2f6',
  },
  mapPanel: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#eff2f6',
    overflow: 'hidden',
  },
  mapView: {
    width: '100%',
    height: '100%',
  },
  mapImage: {
    width: '100%',
    height: '100%',
  },
  driverMapMarker: {
    width: rs(34),
    height: rs(34),
    borderRadius: rs(17),
    borderWidth: 3,
    borderColor: '#ffffff',
    backgroundColor: '#0055cc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickupMapMarker: {
    width: rs(34),
    height: rs(34),
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickupMapMarkerImage: {
    width: rs(36),
    height: rs(36),
    marginTop: -vs(4),
  },
  dropMapMarker: {
    width: rs(34),
    height: rs(34),
    borderRadius: rs(17),
    borderWidth: 3,
    borderColor: '#ffffff',
    backgroundColor: '#1fc16b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  routeDirectionLine: {
    position: 'absolute',
    height: vs(4),
    borderRadius: rs(999),
    backgroundColor: '#0055cc',
    transformOrigin: 'left center',
  },
  driverMarker: {
    position: 'absolute',
    width: rs(34),
    height: rs(34),
    marginLeft: -rs(17),
    marginTop: -rs(17),
    borderRadius: rs(17),
    borderWidth: 3,
    borderColor: '#ffffff',
    backgroundColor: '#0055cc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickupMarker: {
    position: 'absolute',
    width: rs(34),
    height: rs(34),
    marginLeft: -rs(17),
    marginTop: -rs(17),
    borderRadius: rs(17),
    borderWidth: 3,
    borderColor: '#ffffff',
    backgroundColor: '#f7931e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickupSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: rs(24),
    borderTopRightRadius: rs(24),
    backgroundColor: '#ffffff',
     paddingHorizontal: rs(16),
     paddingVertical : vs(16),
    // paddingTop: 16,
    // // paddingBottom: 40,
    // padding : 30,
     zIndex: 10,
     
  },
  pickupSheetContent: {
    flex: 1,
    gap: vs(24),
  },
  pickupActionArea: {
   
    paddingTop: vs(2),
  
  },
  arrivalCard: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#e8e8e8',
    borderRadius: rs(16),
    paddingHorizontal: rs(12),
    paddingTop: vs(4),
    paddingBottom: vs(12),
    backgroundColor: '#ffffff',
  },
  dragHandleWrap: {
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
  arrivalInfoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: rs(12),
  },
  arrivalCopy: {
    flex: 1,
    minWidth: 0,
  },
  arrivalTitle: {
    fontFamily: 'Poppins_500Medium',
    fontSize: fs(24, 20, 26),
    color: '#1c1c1c',
    letterSpacing: -1,
  },
  arrivalSubtitle: {
    fontFamily: 'Poppins_400Regular',
    fontSize: fs(12, 11, 13),
    lineHeight: fs(18),
    color: '#606060',
  },
  distanceBadge: {
    width: rs(40),
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: rs(4),
    paddingVertical: vs(5),
  },
  distanceBadgeIcon: {
    width: rs(28),
    height: rs(28),
  },
  distanceBadgeText: {
    width: '100%',
    marginTop: -vs(4),
    fontFamily: 'Poppins_600SemiBold',
    fontSize: fs(10, 9, 11),
    color: '#1c1c1c',
    textAlign: 'center',
  },
  bookingPersonRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(16),
    paddingHorizontal: rs(16),
  },
  bookingAvatar: {
    width: rs(52),
    height: rs(52),
    borderRadius: rs(26),
    backgroundColor: '#eff2f6',
  },
  bookingCopy: {
    flex: 1,
    minWidth: 0,
    gap: vs(4),
  },
  bookingName: {
    fontFamily: 'Poppins_500Medium',
    fontSize: fs(18),
    color: '#212121',
  },
  bookingMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(8),
  },
  bookingDot: {
    width: rs(8),
    height: rs(8),
    borderRadius: rs(4),
    backgroundColor: '#4cc38a',
  },
  bookingMeta: {
    flex: 1,
    fontFamily: 'Poppins_500Medium',
    fontSize: fs(12, 11, 13),
    color: '#616161',
  },
  callButton: {
    width: rs(52),
    height: rs(52),
    borderRadius: rs(26),
    alignItems: 'center',
    justifyContent: 'center',
  },
  callButtonIcon: {
    width: rs(52),
    height: rs(52),
  },
  headingCard: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#e8e8e8',
    borderRadius: rs(12),
    padding: rs(10),
    gap: vs(12),
    backgroundColor: '#ffffff',
   
  },
  headingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: rs(12),
  },
  headingTitleRow: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(8),
  },
  headingTitleIcon: {
    width: rs(20),
    height: rs(20),
  },
  headingTitle: {
    fontFamily: 'Poppins_500Medium',
    fontSize: fs(16),
    color: '#1c1c1c',
    letterSpacing: -0.5,
  },
  headingDetailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(2),
    flexShrink: 0,
  },
  headingDetailsText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: fs(16),
    lineHeight: fs(24),
    color: '#606060',
  },
  headingAddressBox: {
    width: '100%',
    borderRadius: rs(12),
    backgroundColor: '#eff2f6',
    padding: rs(12),
   
  },
  headingAddressTitle: {
    fontFamily: 'Poppins_500Medium',
    fontSize: fs(16),
    color: '#1c1c1c',
    letterSpacing: -0.5,
  },
  headingAddressPrimary: {
    fontFamily: 'Poppins_400Regular',
    fontSize: fs(16),
    lineHeight: fs(24),
    color: '#616161',
  },
  headingAddressSecondary: {
    fontFamily: 'Poppins_400Regular',
    fontSize: fs(12, 11, 13),
    lineHeight: fs(18),
    color: '#616161',
  },
  arrivedButton: {
    height: vs(52),
    width: '100%',
    maxWidth: rs(720, 320, 720),
    backgroundColor: '#1fc16b',
    borderRadius: rs(12),
    padding: rs(4),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: rs(10),
    marginTop : 'auto'
  },
  arrivedButtonDisabled: {
    opacity: 0.65,
  },
  arrivedButtonText: {
    flex: 1,
    fontFamily: 'Poppins_500Medium',
    fontSize: fs(16),
    color: '#ffffff',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  otpCard: {
    width: '100%',
    maxWidth: rs(356, 300, 380),
    borderRadius: rs(8),
    backgroundColor: '#ffffff',
    padding: rs(12),
    alignItems: 'center',
    gap: vs(16),
    overflow: 'hidden',
  },
 hiddenOtpInput: {
  position: 'absolute',
  width: 1,
  height: 1,
  opacity: 0,
},
  otpIconWrap: {
    width: rs(60),
    height: rs(60),
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpIconImage: {
    width: rs(60),
    height: rs(60),
  },
  otpTitle: {
    width: '100%',
    fontFamily: 'Poppins_500Medium',
    fontSize: fs(24, 20, 26),
    color: '#1c1c1c',
    letterSpacing: 0,
    textAlign: 'center',
  },
  otpBoxRow: {
    flexDirection: 'row',
  justifyContent: 'center',
  gap: rs(12),
  marginTop: vs(20),
  },

otpBox: {
  width: rs(48),
  height: rs(48),
  borderWidth: 1,
  borderColor: '#BBBBBB',
  borderRadius: rs(8),
  fontSize: fs(20, 17, 22),
  fontWeight: '600',
  color: '#000',
},
  
  otpBoxError: {
    borderColor: '#d00416',
  },
  otpDigit: {
    fontFamily: 'Poppins_500Medium',
    fontSize: fs(24, 20, 26),
    color: '#1c1c1c',
    letterSpacing: 0,
  },
  otpHelpText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: fs(12, 11, 13),
    lineHeight: fs(18),
    color: '#606060',
    textAlign: 'center',
  },
  otpError: {
    fontFamily: 'Poppins_400Regular',
    fontSize: fs(12, 11, 13),
    lineHeight: fs(18),
    color: '#d00416',
    textAlign: 'center',
  },
  otpModalBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.32)',
    paddingHorizontal: rs(24),
  },
  cancelModalBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.32)',
    paddingHorizontal: rs(12),
  },
  cancelModalCard: {
    width: '100%',
    maxWidth: rs(380, 320, 420),
    alignItems: 'center',
    gap: vs(24),
    borderRadius: rs(8),
    backgroundColor: '#ffffff',
    padding: rs(12),
    overflow: 'hidden',
  },
  cancelModalContent: {
    width: '100%',
    alignItems: 'center',
    gap: vs(16),
  },
  cancelWarningIcon: {
    width: rs(60),
    height: rs(60),
    borderRadius: rs(30),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#d00416',
  },
  cancelWarningText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: fs(36, 30, 38),
    lineHeight: fs(44, 36, 46),
    color: '#ffffff',
    textAlign: 'center',
  },
  cancelModalCopy: {
    width: '100%',
    alignItems: 'center',
    gap: vs(4),
  },
  cancelModalTitle: {
    width: '100%',
    fontFamily: 'Poppins_500Medium',
    fontSize: fs(24, 20, 26),
    lineHeight: fs(32, 28, 34),
    letterSpacing: -1,
    color: '#1c1c1c',
    textAlign: 'center',
  },
  cancelModalSubtitle: {
    width: '100%',
    fontFamily: 'Poppins_400Regular',
    fontSize: fs(16),
    lineHeight: fs(24),
    color: '#606060',
    textAlign: 'center',
  },
  cancelModalActions: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: rs(10),
  },
  cancelModalNoButton: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#0055cc',
    borderRadius: rs(8),
    paddingHorizontal: rs(24),
    paddingVertical: vs(12),
  },
  cancelModalNoText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: fs(16),
    lineHeight: fs(20),
    letterSpacing: -0.5,
    color: '#606060',
    textAlign: 'center',
  },
  cancelModalSendButton: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: rs(8),
    backgroundColor: '#d00416',
    paddingHorizontal: rs(24),
    paddingVertical: vs(12),
  },
  cancelModalSendText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: fs(16),
    lineHeight: fs(20),
    letterSpacing: -0.5,
    color: '#ffffff',
    textAlign: 'center',
  },
  inTransitCard: {
    width: '100%',
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  completeDropButton: {
    width: '100%',
    minHeight: vs(48),
    borderRadius: rs(12),
    backgroundColor: '#1fc16b',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: rs(18),
    paddingVertical: vs(12),
  },
  completeDropButtonText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: fs(16),
    color: '#ffffff',
    textAlign: 'center',
  },
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  navShell: {
    backgroundColor: '#ffffff',
  },
  statusSpacer: {
    height: vs(52),
  },
  topNav: {
    minHeight: vs(64),
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: rs(4),
    paddingVertical: vs(8),
  },
  backButton: {
    width: rs(48),
    height: rs(48),
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitle: {
    flex: 1,
    minWidth: 0,
    fontFamily: 'Poppins_500Medium',
    fontSize: fs(20, 17, 22),
    lineHeight: fs(32, 26, 34),
    color: '#1c1c1c',
  },
  helpButton: {
    width: rs(48),
    height: rs(48),
    alignItems: 'center',
    justifyContent: 'center',
    padding: rs(10),
  },
  helpIcon: {
    width: rs(24),
    height: rs(24),
  },
  scroll: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  content: {
    width: '100%',
    maxWidth: rs(720, 320, 720),
    alignSelf: 'center',
    paddingHorizontal: rs(8),
    paddingTop: vs(8),
    gap: vs(24),
    paddingBottom: vs(50),
  },
  earningBlock: {
    paddingHorizontal: rs(8),
    paddingVertical: vs(4),
  },
  earningLabel: {
    fontFamily: 'Poppins_400Regular',
    fontSize: fs(12, 11, 13),
    color: '#606060',
    lineHeight: fs(18),
  },
  earningValue: {
    fontFamily: 'Poppins_500Medium',
    fontSize: fs(40, 30, 42),
    color: '#1c1c1c',
    lineHeight: fs(48, 36, 50),
  },
  routeCard: {
    backgroundColor: '#ffffff',
    borderRadius: rs(12),
    paddingHorizontal: rs(8),
    paddingVertical: vs(12),
    borderWidth: 1,
    borderColor: '#e8e8e8',
    gap: vs(12),
  },
  routeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(8),
  },
  routeHeaderIcon: {
    width: rs(20),
    height: rs(20),
  },
  sectionTitle: {
    fontFamily: 'Poppins_500Medium',
    fontSize: fs(16),
    color: '#1c1c1c',
    letterSpacing: -0.5,
  },
  routeBox: {
    position: 'relative',
    backgroundColor: '#eff2f6',
    width: '100%',
    borderRadius: rs(12),
    padding: rs(12),
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(24),
  },
  routeRow: {
    minHeight: vs(64),
    justifyContent: 'center',
    width: '90%'
  },
  routeMarkerWrap: {
    width: rs(20),
    height: rs(20),
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  routeMarkerHalo: {
    width: rs(20),
    height: rs(20),
    borderRadius: rs(10),
    backgroundColor: '#9fc9ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  routeMarkerDot: {
    width: rs(10),
    height: rs(10),
    borderRadius: rs(5),
    backgroundColor: '#0055cc',
  },
  dropChevron: {
    position: 'absolute',
  },
  routeConnector: {
    position: 'absolute',
    left: rs(21),
    top: vs(45),
    height: vs(90),
   
  },
  routeCopy: {
   
    minWidth: 0,
    padding : rs(3),
  

  },
  routeMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(8),
    minWidth: 0,
  },
  routeTitle: {
    minWidth: 0,
    flexShrink: 1,
    fontFamily: 'Poppins_500Medium',
    fontSize: fs(16),
    color: '#1c1c1c',
    letterSpacing: -0.5,
  },
  routeTime: {
    flexShrink: 1,
    fontFamily: 'Poppins_500Medium',
    fontSize: fs(12, 11, 13),
    color: '#05c',
  },
  routeAddress: {
    fontFamily: 'Poppins_400Regular',
    fontSize: fs(16),
    color: '#616161',
    lineHeight: fs(24),
   
  },
  routeSubAddress: {
    fontFamily: 'Poppins_400Regular',
    fontSize: fs(12, 11, 13),
    color: '#616161',
    lineHeight: fs(18),
  },
  routeSeparator: {
    height: vs(1),
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#d6d6d6',
    width : '95%'
  },
  fareSection: {
    paddingHorizontal: rs(8),
    paddingBottom: vs(8),
    gap: vs(16),
  },
  fareList: {
    gap: vs(8),
  },
  fareLine: {
    minHeight: vs(24),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: rs(16),
  },
  fareLabel: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
    fontFamily: 'Poppins_400Regular',
    fontSize: fs(14),
    color: '#8e8e8e',
    lineHeight: fs(21),
  },
  fareValue: {
    maxWidth: '45%',
    flexShrink: 1,
    fontFamily: 'Poppins_500Medium',
    fontSize: fs(14),
    color: '#606060',
    lineHeight: fs(21),
  },
  fareTotalLabel: {
    color: '#8e8e8e',
  },
  fareTotalValue: {
    color: '#1c1c1c',
  },
  fareDivider: {
    height: vs(1),
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#e8e8e8',
    marginTop: vs(5),
    marginBottom : vs(5)
  },
  ctaBar: {
    backgroundColor: '#eff2f6',
    alignItems: 'center',
    paddingHorizontal: rs(16),
    paddingTop: vs(8),
    paddingBottom: vs(16),
  },
  acceptButton: {
    minHeight: vs(52),
    width: '100%',
    maxWidth: rs(720, 320, 720),
    backgroundColor: '#1fc16b',
    borderRadius: rs(12),
    padding: rs(4),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: rs(10),
    overflow: 'hidden',
    position: 'relative',
  
  },
  acceptButtonDisabled: {
    opacity: 0.65,
  },
  acceptIconBox: {
    height: rs(44),
    width: rs(44),
    borderRadius: rs(16),
    backgroundColor: '#00a54d',
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptSlideIconBox: {
    position: 'absolute',
    left: rs(4),
    top: vs(4),
    zIndex: 2,
  },
  acceptIconGhost: {
    height: rs(44),
    width: rs(44),
    borderRadius: rs(16),
    opacity: 0,
  },
  acceptText: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
    fontFamily: 'Poppins_500Medium',
    fontSize: fs(16),
    color: '#ffffff',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  reportButton: {
    width: '100%',
    minHeight: vs(52),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: rs(8),
    borderWidth: 1,
    borderColor: '#d00416',
    borderRadius: rs(12),
    backgroundColor: '#ffffff',
    paddingHorizontal: rs(18),
    paddingVertical: vs(12),
  },
  reportButtonText: {
    flexShrink: 1,
    fontFamily: 'Poppins_500Medium',
    fontSize: fs(16),
    letterSpacing: -0.5,
    color: '#d00416',
    textAlign: 'center',
  },
  cancelDeliveryButton: {
    width: '100%',
    minHeight: vs(48),
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#d00416',
    borderRadius: rs(8),
    paddingHorizontal: rs(24),
    paddingVertical: vs(12),
  },
  cancelDeliveryButtonText: {
    flexShrink: 1,
    fontFamily: 'Poppins_500Medium',
    fontSize: fs(16),
    lineHeight: fs(20),
    letterSpacing: -0.5,
    color: '#d00416',
    textAlign: 'center',
  },
  routeIcon: {
    width: rs(30),
    height: '75%',
  },
 cursor: {
  width: rs(2),
  height: vs(24),
  backgroundColor: '#1565D9',
  borderRadius: rs(2),
},
navigation: {
    height: vs(24),
    alignItems: 'center',
    justifyContent: 'center',
  },
 

otpInputFilled: {
  borderColor: '#1565D9',
  borderWidth: 2,
},
});
