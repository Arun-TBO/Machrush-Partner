import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Alert,
  Image,
  Linking,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { auth } from '@/lib/firebase';
import { getDriverProfile } from '@/lib/firestoreOnboardingService';

const customerAvatarImage = require('@/assets/images/delivery/customer-avatar.png');
const BYPASS_PICKUP_GEOFENCE_FOR_TESTING = false;
const PICKUP_ARRIVAL_RADIUS_METERS = 100;
const DROP_ARRIVAL_RADIUS_METERS = 120;
const OFF_ROUTE_THRESHOLD_METERS = 60;
const REROUTE_COOLDOWN_MS = 15000;
const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

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
          onPress={() => router.replace('/(tabs)')}
        >
          <Ionicons name="arrow-back" size={24} color="#9f9f9f" />
        </Pressable>
        <Text style={styles.navTitle}>Delivery Details</Text>
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
      <View style={styles.routeMarkerWrap}>
        <View style={styles.routeMarkerHalo}>
          <View style={styles.routeMarkerDot} />
        </View>
        {variant === 'drop' ? (
          <Ionicons name="chevron-down" size={15} color="#ffffff" style={styles.dropChevron} />
        ) : null}
      </View>
      <View style={styles.routeCopy}>
        <View style={styles.routeMeta}>
          <Text style={styles.routeTitle}>{title}</Text>
          {time ? <Text style={styles.routeTime}>{time}</Text> : null}
        </View>
        <Text style={styles.routeAddress} numberOfLines={1}>
          {primaryAddress}
        </Text>
        {secondaryAddress ? (
          <Text style={styles.routeSubAddress} numberOfLines={1}>
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
}: {
  value: string;
  error: string | null;
  onChange: (value: string) => void;
  onSubmit: () => void;
}) {
  const inputRef = React.useRef<TextInput>(null);
  const digits = Array.from({ length: 4 }, (_, index) => value[index] || '');

  React.useEffect(() => {
    if (value.length === 4) {
      onSubmit();
    }
  }, [onSubmit, value]);

  return (
    <Pressable style={styles.otpCard} onPress={() => inputRef.current?.focus()}>
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={(nextValue) => onChange(nextValue.replace(/\D/g, '').slice(0, 4))}
        keyboardType="number-pad"
        maxLength={4}
        style={styles.hiddenOtpInput}
        autoFocus
      />
      <View style={styles.otpIconWrap}>
        <Ionicons name="refresh" size={30} color="#0055cc" />
        <View style={styles.otpLockCircle}>
          <Ionicons name="lock-closed" size={18} color="#ffffff" />
        </View>
      </View>
      <Text style={styles.otpTitle}>Enter OTP</Text>
      <View style={styles.otpBoxRow}>
        {digits.map((digit, index) => (
          <View key={`${index}`} style={[styles.otpBox, error ? styles.otpBoxError : null]}>
            <Text style={styles.otpDigit}>{digit}</Text>
          </View>
        ))}
      </View>
      {error ? <Text style={styles.otpError}>{error}</Text> : null}
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
}) {
  const mapRef = React.useRef<MapView>(null);
  const previousLocationRef = React.useRef<LatLng | null>(null);
  const driverLocationRef = React.useRef<LatLng | null>(null);
  const headingRef = React.useRef(0);
  const lastRerouteAtRef = React.useRef(0);
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
  const [pickupOtp, setPickupOtp] = React.useState('');
  const [otpError, setOtpError] = React.useState<string | null>(null);
  const [isVerifyingOtp, setIsVerifyingOtp] = React.useState(false);
  const bookingPerson = delivery?.sender?.name ? delivery.sender : delivery?.receiver;
  const bookingName = bookingPerson?.name || 'Customer';
  const bookingPhone = bookingPerson?.phone || '';
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
    isInTransit && dropDistanceMeters !== null && dropDistanceMeters <= DROP_ARRIVAL_RADIUS_METERS;
  const etaText =
    routeDuration ||
    delivery?.tracking?.estimatedArrival?.replace('~', '') ||
    delivery?.pickupTime ||
    '4 min';
  const etaTitle = etaText.toLowerCase().includes('away') ? etaText : `${etaText} away`;
  const nextInstruction =
    locationError || getNextInstruction(driverLocation, routeDestination, routeSteps);

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
        return;
      }

      try {
        const response = await fetch(
          `${getApiBaseUrl()}/api/firestore/customers/${encodeURIComponent(delivery.senderId)}`
        );
        const body = (await response.json().catch(() => null)) as CustomerProfileResponse | null;
        const photoUri = body?.data?.profilePhotoUrl || body?.data?.photoUri || null;

        if (isActive) {
          setBookingPhotoUri(photoUri);
        }
      } catch (error) {
        console.error('Error loading booking profile photo:', error);
        if (isActive) {
          setBookingPhotoUri(null);
        }
      }
    };

    loadBookingProfilePhoto();

    return () => {
      isActive = false;
    };
  }, [bookingPerson?.photoUri, delivery?.senderId]);

  React.useEffect(() => {
    let isActive = true;
    let subscription: Location.LocationSubscription | null = null;

    const updateDriverLocation = (nextLocation: LatLng) => {
      const previousLocation = previousLocationRef.current;
      const nextHeading =
        previousLocation && getDistanceMeters(previousLocation, nextLocation) > 2
          ? getBearing(previousLocation, nextLocation)
          : headingRef.current;

      driverLocationRef.current = nextLocation;
      previousLocationRef.current = nextLocation;
      headingRef.current = nextHeading;

      if (isActive) {
        setDriverLocation(nextLocation);
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

      if (deliveryId) {
        fetch(`${getApiBaseUrl()}/api/deliveries/${deliveryId}/location`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(nextLocation),
        }).catch((error) => {
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

        updateDriverLocation(nextLocation);

        subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            distanceInterval: 10,
            timeInterval: 5000,
          },
          (location) => {
            updateDriverLocation({
              lat: location.coords.latitude,
              lng: location.coords.longitude,
            });
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
      Alert.alert('Phone unavailable', 'No phone number is available for this booking.');
      return;
    }

    await Linking.openURL(`tel:${bookingPhone}`);
  };

  const handleOpenDirections = async () => {
    if (!routeDestination) {
      Alert.alert('Location unavailable', 'No destination coordinates are available for this trip.');
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
                <Ionicons name="location" size={18} color="#ffffff" />
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

      <View style={styles.pickupSheet}>
        <View style={styles.arrivalCard}>
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
              <Ionicons name="location-outline" size={24} color="#f7931e" />
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
                Vehicle booked by this customer
              </Text>
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Call booking customer"
            style={styles.callButton}
            onPress={handleCallBookingPerson}
          >
            <Ionicons name="call" size={22} color="#ffffff" />
          </Pressable>
        </View>

        <Pressable style={styles.headingCard} accessibilityRole="button" onPress={handleOpenDirections}>
          <View style={styles.turnInstructionRow}>
            <View style={styles.turnIconBox}>
              <Ionicons name="navigate" size={18} color="#ffffff" />
            </View>
            <Text style={styles.turnInstructionText} numberOfLines={2}>
              {nextInstruction}
            </Text>
          </View>

          <View style={styles.headingHeader}>
            <View style={styles.headingTitleRow}>
              <Ionicons name="navigate" size={20} color="#1c1c1c" />
              <Text style={styles.headingTitle}>Heading to</Text>
            </View>
            <View style={styles.headingDetailsRow}>
              <Text style={styles.headingDetailsText}>Delivery details</Text>
              <Ionicons name="arrow-forward" size={18} color="#606060" />
            </View>
          </View>

          <View style={styles.headingAddressBox}>
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
          </View>
        </Pressable>

        {isArrived ? (
          <OtpVerificationCard
            value={pickupOtp}
            error={otpError}
            onChange={(nextValue) => {
              setPickupOtp(nextValue);
              setOtpError(null);
            }}
            onSubmit={handleVerifyOtp}
          />
        ) : isInTransit ? (
          <View style={styles.inTransitCard}>
            <Ionicons name="checkmark-circle" size={28} color="#1fc16b" />
            <Text style={styles.inTransitText}>
              {hasArrivedAtDrop ? 'You have arrived at drop point.' : 'OTP verified. Heading to drop point.'}
            </Text>
            {hasArrivedAtDrop ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Complete delivery"
                style={styles.completeDropButton}
                disabled={isUpdatingStatus}
                onPress={onCompleteDrop}
              >
                <Text style={styles.completeDropButtonText}>
                  {isUpdatingStatus ? 'Completing...' : 'Complete delivery'}
                </Text>
              </Pressable>
            ) : null}
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
    </SafeAreaView>
  );
}

function FareLine({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.fareLine}>
      <Text style={[styles.fareLabel, strong ? styles.fareTotalLabel : null]}>{label}</Text>
      <Text style={[styles.fareValue, strong ? styles.fareTotalValue : null]}>{value}</Text>
    </View>
  );
}

export default function AcceptedTripScreen() {
  const router = useRouter();
  const { deliveryId } = useLocalSearchParams<{ deliveryId?: string }>();
  const [delivery, setDelivery] = React.useState<DeliveryDetails | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isAccepting, setIsAccepting] = React.useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = React.useState(false);

  React.useEffect(() => {
    let isActive = true;

    const loadDelivery = async () => {
      if (!deliveryId) {
        setIsLoading(false);
        return;
      }

      try {
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
        if (isActive) {
          setDelivery(null);
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    loadDelivery();

    return () => {
      isActive = false;
    };
  }, [deliveryId]);

  const distanceKm = getDistanceKm(delivery);
  const tripFare = formatCurrency(delivery?.pricing?.tripFare ?? delivery?.pricing?.total);
  const totalAmount = getCurrencyNumber(delivery?.pricing?.tripFare ?? delivery?.pricing?.total);
  const baseFare = getCurrencyNumber(delivery?.pricing?.baseFare) || 700;
  const distanceFare = getCurrencyNumber(delivery?.pricing?.distanceFare) || 400;
  const fuelCost =
    getCurrencyNumber(delivery?.pricing?.fuelCost) ||
    Math.max(totalAmount - baseFare - distanceFare, 0) ||
    800;
  const totalEarning =
    totalAmount || baseFare + distanceFare + fuelCost || getCurrencyNumber(delivery?.pricing?.total);
  const pickupDistanceKm = Number(delivery?.pricing?.pickupDistanceKm);
  const pickupAddress = delivery?.locations?.pickup?.address || 'Pickup address unavailable';
  const pickupLocation = isValidCoord(delivery?.locations?.pickup?.coords)
    ? delivery.locations.pickup.coords
    : null;
  const dropAddress = delivery?.locations?.dropoff?.address || 'Drop address unavailable';
  const dropLocation = isValidCoord(delivery?.locations?.dropoff?.coords)
    ? delivery.locations.dropoff.coords
    : null;
  const dropTime = delivery?.dropoffTime || 'Approx. 50 mins';
  const isAccepted =
    delivery?.status === 'assigned' ||
    delivery?.status === 'arrived' ||
    delivery?.status === 'in_transit' ||
    Boolean(delivery?.driver);

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
      Alert.alert('Login required', 'Please login again before accepting this trip.');
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
                },
              }
            : current
        );
      }
    } catch (error) {
      console.error('Error accepting delivery:', error);
      Alert.alert('Accept failed', error instanceof Error ? error.message : 'Please try again.');
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
      Alert.alert('Update failed', error instanceof Error ? error.message : 'Please try again.');
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
      Alert.alert('OTP failed', error instanceof Error ? error.message : 'Please try again.');
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
      router.replace('/(tabs)');
    } catch (error) {
      console.error('Error completing delivery:', error);
      Alert.alert('Complete failed', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  if (isAccepted) {
    return (
      <AcceptedPickupView
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
      />
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <TopNav />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.earningBlock}>
          <Text style={styles.earningLabel}>Estimated earnings</Text>
          <Text style={styles.earningValue}>{isLoading ? '...' : tripFare}</Text>
        </View>

        <View style={styles.routeCard}>
          <View style={styles.routeHeader}>
            <Ionicons name="navigate" size={20} color="#1c1c1c" />
            <Text style={styles.sectionTitle}>Route</Text>
          </View>

          <View style={styles.routeBox}>
            <View style={styles.routeConnector} />
            <RouteRow
              variant="pickup"
              title={
                Number.isFinite(pickupDistanceKm) && pickupDistanceKm > 0
                  ? `To Pickup ${Math.round(pickupDistanceKm)}Km`
                  : 'To Pickup 3Km'
              }
              time=""
              address={pickupAddress}
            />
            <View style={styles.routeSeparator} />
            <RouteRow
              variant="drop"
              title={distanceKm ? `Drop ${distanceKm}km` : 'Drop 35km'}
              time={dropTime}
              address={dropAddress}
            />
          </View>
        </View>

        <View style={styles.fareSection}>
          <Text style={styles.sectionTitle}>Fare Breakdown</Text>
          <View style={styles.fareList}>
            <FareLine label="Base fare 50km" value={formatCurrency(baseFare)} />
            <FareLine label="Distance fare" value={formatCurrency(distanceFare)} />
            <FareLine label="Fuel Cost" value={formatCurrency(fuelCost)} />
            <View style={styles.fareDivider} />
            <FareLine label="Total earning" value={formatCurrency(totalEarning)} strong />
            <View style={styles.fareDivider} />
          </View>
        </View>
      </ScrollView>

      <View style={styles.ctaBar}>
        <Pressable
          style={[
            styles.acceptButton,
            isAccepted || isAccepting || isLoading ? styles.acceptButtonDisabled : null,
          ]}
          disabled={isAccepted || isAccepting || isLoading}
          onPress={handleAcceptDelivery}
        >
          <View style={styles.acceptIconBox}>
            <Ionicons name="arrow-forward" size={20} color="#ffffff" />
          </View>
          <Text style={styles.acceptText}>
            {isAccepted ? 'Accepted' : isAccepting ? 'Accepting...' : 'Accept'}
          </Text>
          <View style={styles.acceptIconGhost} />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  acceptedContainer: {
    flex: 1,
    backgroundColor: '#eff2f6',
  },
  mapPanel: {
    height: 418,
    width: '100%',
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
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 3,
    borderColor: '#ffffff',
    backgroundColor: '#0055cc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickupMapMarker: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 3,
    borderColor: '#ffffff',
    backgroundColor: '#f7931e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropMapMarker: {
    width: 34,
    height: 34,
    borderRadius: 17,
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
    height: 4,
    borderRadius: 999,
    backgroundColor: '#0055cc',
    transformOrigin: 'left center',
  },
  driverMarker: {
    position: 'absolute',
    width: 34,
    height: 34,
    marginLeft: -17,
    marginTop: -17,
    borderRadius: 17,
    borderWidth: 3,
    borderColor: '#ffffff',
    backgroundColor: '#0055cc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickupMarker: {
    position: 'absolute',
    width: 34,
    height: 34,
    marginLeft: -17,
    marginTop: -17,
    borderRadius: 17,
    borderWidth: 3,
    borderColor: '#ffffff',
    backgroundColor: '#f7931e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickupSheet: {
    flex: 1,
    marginTop: -1,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
    gap: 32,
  },
  arrivalCard: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#e8e8e8',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingTop: 4,
    paddingBottom: 12,
    backgroundColor: '#ffffff',
  },
  dragHandleWrap: {
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
  arrivalInfoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  arrivalCopy: {
    flex: 1,
    minWidth: 0,
  },
  arrivalTitle: {
    fontFamily: 'Poppins',
    fontSize: 24,
    fontWeight: '500',
    color: '#1c1c1c',
    letterSpacing: -1,
  },
  arrivalSubtitle: {
    fontFamily: 'Poppins',
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 18,
    color: '#606060',
  },
  distanceBadge: {
    width: 40,
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 5,
  },
  distanceBadgeText: {
    marginTop: -4,
    fontFamily: 'Poppins',
    fontSize: 10,
    fontWeight: '600',
    color: '#1c1c1c',
  },
  bookingPersonRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 16,
  },
  bookingAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#eff2f6',
  },
  bookingCopy: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  bookingName: {
    fontFamily: 'Poppins',
    fontSize: 18,
    fontWeight: '500',
    color: '#212121',
  },
  bookingMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bookingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4cc38a',
  },
  bookingMeta: {
    flex: 1,
    fontFamily: 'Satoshi',
    fontSize: 12,
    fontWeight: '500',
    color: '#616161',
  },
  callButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#0055cc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headingCard: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#e8e8e8',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 12,
    gap: 12,
    backgroundColor: '#ffffff',
  },
  turnInstructionRow: {
    minHeight: 48,
    borderRadius: 10,
    backgroundColor: '#0055cc',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  turnIconBox: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  turnInstructionText: {
    flex: 1,
    fontFamily: 'Poppins',
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
    color: '#ffffff',
  },
  headingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headingTitleRow: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headingTitle: {
    fontFamily: 'Poppins',
    fontSize: 16,
    fontWeight: '500',
    color: '#1c1c1c',
    letterSpacing: -0.5,
  },
  headingDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headingDetailsText: {
    fontFamily: 'Poppins',
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 24,
    color: '#606060',
  },
  headingAddressBox: {
    width: '100%',
    borderRadius: 12,
    backgroundColor: '#eff2f6',
    padding: 12,
  },
  headingAddressTitle: {
    fontFamily: 'Poppins',
    fontSize: 16,
    fontWeight: '500',
    color: '#1c1c1c',
    letterSpacing: -0.5,
  },
  headingAddressPrimary: {
    fontFamily: 'Poppins',
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 24,
    color: '#616161',
  },
  headingAddressSecondary: {
    fontFamily: 'Poppins',
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 18,
    color: '#616161',
  },
  arrivedButton: {
    width: '100%',
    minHeight: 48,
    borderRadius: 8,
    backgroundColor: '#1fc16b',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  arrivedButtonDisabled: {
    opacity: 0.65,
  },
  arrivedButtonText: {
    fontFamily: 'Poppins',
    fontSize: 16,
    fontWeight: '500',
    color: '#ffffff',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  otpCard: {
    width: '100%',
    borderRadius: 8,
    backgroundColor: '#ffffff',
    padding: 12,
    alignItems: 'center',
    gap: 16,
    overflow: 'hidden',
  },
  hiddenOtpInput: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
  otpIconWrap: {
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpLockCircle: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#0055cc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpTitle: {
    width: '100%',
    fontFamily: 'Poppins',
    fontSize: 24,
    fontWeight: '500',
    color: '#1c1c1c',
    letterSpacing: -1,
    textAlign: 'center',
  },
  otpBoxRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  otpBox: {
    width: 44,
    height: 44,
    borderWidth: 1,
    borderColor: '#bbbbbb',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  otpBoxError: {
    borderColor: '#d00416',
  },
  otpDigit: {
    fontFamily: 'Poppins',
    fontSize: 24,
    fontWeight: '500',
    color: '#1c1c1c',
    letterSpacing: -1,
  },
  otpError: {
    fontFamily: 'Poppins',
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 18,
    color: '#d00416',
    textAlign: 'center',
  },
  inTransitCard: {
    width: '100%',
    minHeight: 52,
    borderRadius: 8,
    backgroundColor: 'rgba(31, 193, 107, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  inTransitText: {
    flex: 1,
    fontFamily: 'Poppins',
    fontSize: 14,
    fontWeight: '500',
    color: '#1c1c1c',
    textAlign: 'center',
  },
  completeDropButton: {
    width: '100%',
    minHeight: 44,
    borderRadius: 8,
    backgroundColor: '#1fc16b',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  completeDropButtonText: {
    fontFamily: 'Poppins',
    fontSize: 15,
    fontWeight: '600',
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
    height: 52,
  },
  topNav: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  backButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
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
    backgroundColor: '#ffffff',
  },
  content: {
    paddingHorizontal: 8,
    paddingTop: 8,
    gap: 24,
    paddingBottom: 112,
  },
  earningBlock: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  earningLabel: {
    fontFamily: 'Poppins',
    fontSize: 12,
    fontWeight: '400',
    color: '#606060',
    lineHeight: 18,
  },
  earningValue: {
    fontFamily: 'Poppins',
    fontSize: 40,
    fontWeight: '500',
    color: '#1c1c1c',
    lineHeight: 48,
  },
  routeCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#e8e8e8',
    gap: 12,
  },
  routeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontFamily: 'Poppins',
    fontSize: 16,
    fontWeight: '500',
    color: '#1c1c1c',
    letterSpacing: -0.5,
  },
  routeBox: {
    position: 'relative',
    backgroundColor: '#eff2f6',
    borderRadius: 12,
    padding: 12,
    gap: 12,
    overflow: 'hidden',
  },
  routeRow: {
    flexDirection: 'row',
    gap: 24,
    alignItems: 'center',
    minHeight: 64,
  },
  routeMarkerWrap: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  routeMarkerHalo: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#9fc9ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  routeMarkerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#0055cc',
  },
  dropChevron: {
    position: 'absolute',
  },
  routeConnector: {
    position: 'absolute',
    left: 21,
    top: 45,
    height: 90,
    borderLeftWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#0055cc',
  },
  routeCopy: {
    flex: 1,
    minWidth: 0,
  },
  routeMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  routeTitle: {
    fontFamily: 'Poppins',
    fontSize: 16,
    fontWeight: '500',
    color: '#1c1c1c',
    letterSpacing: -0.5,
  },
  routeTime: {
    flex: 1,
    fontFamily: 'Satoshi',
    fontSize: 12,
    fontWeight: '500',
    color: '#05c',
  },
  routeAddress: {
    fontFamily: 'Poppins',
    fontSize: 16,
    fontWeight: '400',
    color: '#616161',
    lineHeight: 24,
  },
  routeSubAddress: {
    fontFamily: 'Poppins',
    fontSize: 12,
    fontWeight: '400',
    color: '#616161',
    lineHeight: 18,
  },
  routeSeparator: {
    height: 1,
    marginLeft: 44,
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#d6d6d6',
  },
  fareSection: {
    paddingHorizontal: 8,
    paddingBottom: 8,
    gap: 16,
  },
  fareList: {
    gap: 8,
  },
  fareLine: {
    minHeight: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  fareLabel: {
    fontFamily: 'Poppins',
    fontSize: 14,
    fontWeight: '400',
    color: '#8e8e8e',
    lineHeight: 21,
  },
  fareValue: {
    fontFamily: 'Poppins',
    fontSize: 14,
    fontWeight: '500',
    color: '#606060',
    lineHeight: 21,
  },
  fareTotalLabel: {
    color: '#8e8e8e',
  },
  fareTotalValue: {
    color: '#1c1c1c',
  },
  fareDivider: {
    height: 1,
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#e8e8e8',
    marginTop: 8,
  },
  ctaBar: {
    backgroundColor: '#eff2f6',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  acceptButton: {
    height: 52,
    width: '100%',
    backgroundColor: '#1fc16b',
    borderRadius: 12,
    padding: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  acceptButtonDisabled: {
    opacity: 0.65,
  },
  acceptIconBox: {
    height: 44,
    width: 44,
    borderRadius: 16,
    backgroundColor: '#00a54d',
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptIconGhost: {
    height: 44,
    width: 44,
    borderRadius: 16,
    opacity: 0,
  },
  acceptText: {
    flex: 1,
    fontFamily: 'Poppins',
    fontSize: 16,
    fontWeight: '500',
    color: '#ffffff',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
});
