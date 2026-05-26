import {
  getDelivery,
  streamDeliveryStatus,
  updateDeliveryStatus,
  type Delivery,
} from '@/lib/deliveryService';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  MapPin,
  MoreVertical,
  Navigation,
  Phone,
} from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';

const { width, height } = Dimensions.get('window');

// --- Types ---
type DeliveryStep = 'PICKUP' | 'START_RIDE' | 'ARRIVED_DROP' | 'DETAILS' | 'CANCEL_CONFIRM' | 'COMPLETED';

// Map delivery statuses to our UI steps
const statusToStep: Record<string, DeliveryStep> = {
  accepted: 'PICKUP',
  assigned: 'PICKUP',
  in_transit: 'START_RIDE',
  delivered: 'COMPLETED',
};

// --- Helpers ---
function formatAmount(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`;
}

const DeliverStepsConfirmation = () => {
  const router = useRouter();
  const params = useLocalSearchParams();
  const deliveryId = (params.deliveryId as string) || '';

  const [step, setStep] = useState<DeliveryStep>('PICKUP');
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // ── Driver location + map route state ──
  const [driverLocation, setDriverLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [routeCoords, setRouteCoords] = useState<{ latitude: number; longitude: number }[]>([]);
  const [mapRegion, setMapRegion] = useState<{
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  } | null>(null);

  // Get driver's current location and fetch route
  // Refresh driver location at most once every 2 minutes to prevent map reload jitter.
  const lastLocationFetchAtRef = useRef<number>(0);

  useEffect(() => {
    (async () => {
      // throttle: 2 minutes
      const now = Date.now();
      if (now - lastLocationFetchAtRef.current < 2 * 60 * 1000) return;

      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          console.warn('[DeliverSteps] Location permission denied');
          return;
        }
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        const driverLat = loc.coords.latitude;
        const driverLng = loc.coords.longitude;

        lastLocationFetchAtRef.current = now;
        setDriverLocation({ latitude: driverLat, longitude: driverLng });

        // Update route/region only if we haven't computed it yet (prevents frequent map refresh).
        if (
          delivery?.locations?.pickup?.coords &&
          delivery?.locations?.dropoff?.coords &&
          routeCoords.length === 0
        ) {
          fetchRouteAndSetRegion(driverLat, driverLng);
        }
      } catch (err) {
        console.error('[DeliverSteps] Error getting location:', err);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [delivery?.locations?.pickup?.coords, delivery?.locations?.dropoff?.coords]);

  // Fetch route from OSRM (free, no API key required) and set map region
  // Fetch route and set map region without re-running unnecessarily
  const fetchRouteAndSetRegion = async (
    driverLat: number,
    driverLng: number
  ) => {
    const pickupCoords = delivery?.locations?.pickup?.coords;
    const dropoffCoords = delivery?.locations?.dropoff?.coords;

    if (!pickupCoords || !dropoffCoords) return;

    // Build coordinate string for OSRM: lng,lat;lng,lat;lng,lat
    const coordsStr = `${driverLng},${driverLat};${pickupCoords.lng},${pickupCoords.lat};${dropoffCoords.lng},${dropoffCoords.lat}`;

    try {
      const response = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${coordsStr}?overview=full&geometries=geojson`
      );
      const data = await response.json();
      if (data.code === 'Ok' && data.routes?.length > 0) {
        const points = data.routes[0].geometry.coordinates.map(
          (coord: [number, number]) => ({
            latitude: coord[1],
            longitude: coord[0],
          })
        );
        setRouteCoords(points);
      }
    } catch (err) {
      console.warn('[DeliverSteps] Failed to fetch route, using fallback:', err);
      // Fallback: draw straight line between points
      setRouteCoords([
        { latitude: driverLat, longitude: driverLng },
        { latitude: pickupCoords.lat, longitude: pickupCoords.lng },
        { latitude: dropoffCoords.lat, longitude: dropoffCoords.lng },
      ]);
    }

    // Calculate region to fit all points
    const allLats = [driverLat, pickupCoords.lat, dropoffCoords.lat];
    const allLngs = [driverLng, pickupCoords.lng, dropoffCoords.lng];
    const minLat = Math.min(...allLats);
    const maxLat = Math.max(...allLats);
    const minLng = Math.min(...allLngs);
    const maxLng = Math.max(...allLngs);
    const padding = 0.02;
    setMapRegion({
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: maxLat - minLat + padding * 2,
      longitudeDelta: maxLng - minLng + padding * 2,
    });
  };

  // Fetch delivery on mount
  useEffect(() => {
    if (!deliveryId) {
      setError('No delivery ID provided');
      setIsLoading(false);
      return;
    }

    const loadDelivery = async () => {
      try {
        const data = await getDelivery(deliveryId);
        if (!data) {
          setError('Delivery not found');
          setIsLoading(false);
          return;
        }
        setDelivery(data);

        // Map current status to UI step
        const currentStep = data.status === 'delivered' ? 'COMPLETED' : (statusToStep[data.status] || 'PICKUP');
        setStep(currentStep);
        setIsLoading(false);

        // Start real-time listener for status updates
        if (unsubscribeRef.current) unsubscribeRef.current();
        unsubscribeRef.current = streamDeliveryStatus(deliveryId, (updated) => {
          setDelivery(updated);
          if (updated.status === 'delivered') {
            setStep('COMPLETED');
          } else {
            const newStep = statusToStep[updated.status] || (step !== 'DETAILS' && step !== 'CANCEL_CONFIRM' ? step : step);
            if (newStep && step !== 'DETAILS' && step !== 'CANCEL_CONFIRM') {
              setStep(newStep);
            }
          }
        });
      } catch (err) {
        console.error('[DeliverSteps] Failed to load delivery:', err);
        setError('Failed to load delivery details');
        setIsLoading(false);
      }
    };

    loadDelivery();

    return () => {
      if (unsubscribeRef.current) unsubscribeRef.current();
    };
  }, [deliveryId]);

  // Handle status transitions - only updates backend for actual status changes
  const handleNextStep = async (nextStatus: 'in_transit' | 'delivered') => {
    if (!deliveryId) return;
    setIsUpdating(true);
    try {
      await updateDeliveryStatus(deliveryId, nextStatus);
    } catch (err) {
      console.error('[DeliverSteps] Status update failed:', err);
      Alert.alert('Error', 'Failed to update delivery status. Please try again.');
    } finally {
      setIsUpdating(false);
    }
  };

  // Advance UI step without changing backend status
  const advanceUiStep = (newStep: DeliveryStep) => {
    setStep(newStep);
  };

  const handleCancelDelivery = async () => {
    if (!deliveryId) return;
    setIsUpdating(true);
    try {
      await updateDeliveryStatus(deliveryId, 'cancelled');
      router.back();
    } catch (err) {
      Alert.alert('Error', 'Failed to cancel delivery');
    } finally {
      setIsUpdating(false);
    }
  };

  // Loading / Error states
  if (isLoading) {
    return (
      <SafeAreaView style={styles.fullScreenWhite}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#005CEE" />
          <Text style={styles.loadingText}>Loading delivery details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !delivery) {
    return (
      <SafeAreaView style={styles.fullScreenWhite}>
        <View style={styles.errorContainer}>
          <AlertCircle size={48} color="#EF4444" />
          <Text style={styles.errorText}>{error || 'Delivery not found'}</Text>
          <TouchableOpacity style={styles.noButton} onPress={() => router.back()}>
            <Text style={styles.noButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // --- Data Derivation ---
  const pickupAddress = delivery.locations?.pickup?.address || 'Pickup location';
  const dropoffAddress = delivery.locations?.dropoff?.address || 'Dropoff location';
  const pickupName = delivery.locations?.pickup?.name || pickupAddress.split(',')[0];
  const dropoffName = delivery.locations?.dropoff?.name || dropoffAddress.split(',')[0];
  const receiverName = delivery.receiver?.name || 'Receiver';
  const receiverPhone = delivery.receiver?.phone || '';
  const senderName = delivery.sender?.name || 'Sender';

  const totalEarning = delivery.pricing?.total || 0;
  const baseFare = delivery.pricing?.baseFare || 0;
  const distanceFare = delivery.pricing?.distanceFare || 0;
  const fuelCost = delivery.pricing?.fuelCost || 0;
  const tax = delivery.pricing?.tax || 0;

  const pickupDistKm = delivery.distance?.pickup ? `${delivery.distance.pickup}km` : '3Km';
  const totalDistKm = delivery.distance?.total ? `${delivery.distance.total}km` : '35km';
  const pickupEta = delivery.estimatedTime?.pickup ? `Approx. ${Math.round(delivery.estimatedTime.pickup)} mins` : '';
  const dropoffEta = delivery.estimatedTime?.dropoff ? `Approx. ${Math.round(delivery.estimatedTime.dropoff)} mins` : 'Approx. 50 mins';

  // --- Shared Components ---
  const DeliveryMap = () => {
    // react-native-maps doesn't work on web - show fallback
    if (Platform.OS === 'web') {
      return (
        <View style={styles.mapContainer}>
          <View style={styles.mapFallback}>
            <MapPin size={48} color="#999" />
            <Text style={styles.mapFallbackText}>Map view is not available on web{'\n'}Open on iOS or Android device</Text>
          </View>
        </View>
      );
    }

    const pickupCoords = delivery?.locations?.pickup?.coords;
    const dropoffCoords = delivery?.locations?.dropoff?.coords;

    // If we have no coords, show a fallback
    if (!pickupCoords || !dropoffCoords) {
      return (
        <View style={styles.mapContainer}>
          <View style={styles.mapFallback}>
            <MapPin size={48} color="#999" />
            <Text style={styles.mapFallbackText}>Map unavailable{'\n'}No location coordinates</Text>
          </View>
        </View>
      );
    }

    // Determine initial region if mapRegion not yet computed
    const initialRegion = mapRegion || {
      latitude: (pickupCoords.lat + dropoffCoords.lat) / 2,
      longitude: (pickupCoords.lng + dropoffCoords.lng) / 2,
      latitudeDelta: 0.05,
      longitudeDelta: 0.05,
    };

    return (
      <View style={styles.mapContainer}>
        <MapView
          provider={PROVIDER_GOOGLE}
          style={styles.mapView}
          initialRegion={initialRegion}
          region={mapRegion || undefined}
          showsUserLocation={true}
          showsMyLocationButton={true}
          showsCompass={true}
          rotateEnabled={true}
          zoomEnabled={true}
          scrollEnabled={true}
          pitchEnabled={true}
          toolbarEnabled={true}
          userLocationPriority="high"
        >
          {/* Driver location marker (shown manually since showsUserLocation also shows it) */}
          {driverLocation && (
            <Marker
              coordinate={driverLocation}
              title="Your Location"
              description="You are here"
              anchor={{ x: 0.5, y: 0.5 }}
            >
              <View style={styles.driverMarkerContainer}>
                <View style={styles.driverMarkerDot} />
              </View>
            </Marker>
          )}

          {/* Pickup marker */}
          <Marker
            coordinate={{
              latitude: pickupCoords.lat,
              longitude: pickupCoords.lng,
            }}
            title="Pickup Location"
            description={delivery?.locations?.pickup?.address || 'Pickup'}
            anchor={{ x: 0.5, y: 1 }}
          >
            <View style={styles.pickupMarkerContainer}>
              <MapPin size={20} color="#2563EB" fill="#2563EB" />
            </View>
          </Marker>

          {/* Dropoff marker */}
          <Marker
            coordinate={{
              latitude: dropoffCoords.lat,
              longitude: dropoffCoords.lng,
            }}
            title="Dropoff Location"
            description={delivery?.locations?.dropoff?.address || 'Dropoff'}
            anchor={{ x: 0.5, y: 1 }}
          >
            <View style={styles.dropoffMarkerContainer}>
              <MapPin size={20} color="#EF4444" fill="#EF4444" />
            </View>
          </Marker>

          {/* Route polyline */}
          {routeCoords.length > 1 && (
            <Polyline
              coordinates={routeCoords}
              strokeColor="#2563EB"
              strokeWidth={4}
              lineDashPattern={[0]}
              lineJoin="round"
            />
          )}
        </MapView>
      </View>
    );
  };

  const ProfileSection = () => {
    const displayPerson = step === 'PICKUP'
      ? { name: receiverName, role: `${pickupName} receiver`, phone: receiverPhone }
      : { name: senderName, role: `${dropoffName} contact`, phone: delivery.sender?.phone || '' };

    return (
      <View style={styles.profileContainer}>
        <View style={styles.profileInfo}>
          <View style={styles.avatarContainer}>
            <Image 
              source={{ uri: `https://ui-avatars.com/api/?name=${encodeURIComponent(displayPerson.name)}&background=333&color=fff` }} 
              style={styles.avatar} 
            />
          </View>
          <View>
            <Text style={styles.userName}>{displayPerson.name}</Text>
            <View style={styles.statusRow}>
              <View style={styles.onlineDot} />
              <Text style={styles.roleText}>{displayPerson.role}</Text>
            </View>
          </View>
        </View>
        {displayPerson.phone ? (
          <TouchableOpacity style={styles.callButton} onPress={() => Alert.alert('Call', displayPerson.phone)}>
            <Phone size={20} color="white" fill="white" />
          </TouchableOpacity>
        ) : null}
      </View>
    );
  };

  // --- CANCEL_CONFIRM Screen ---
  if (step === 'CANCEL_CONFIRM') {
    return (
      <SafeAreaView style={styles.fullScreenWhite}>
        <View style={styles.cancelContent}>
          <View style={styles.redCircle}>
            <Text style={styles.exclamationMark}>!</Text>
          </View>
          <Text style={styles.cancelTitle}>Request to cancel{"\n"}this Trip?</Text>
          <Text style={styles.cancelSubtitle}>you cannot undo this action!</Text>
          
          <View style={styles.cancelButtonRow}>
            <TouchableOpacity 
              style={styles.noButton} 
              onPress={() => setStep('DETAILS')}
            >
              <Text style={styles.noButtonText}>No</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.sendRequestButton} 
              onPress={handleCancelDelivery}
              disabled={isUpdating}
            >
              {isUpdating ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Text style={styles.sendRequestText}>Send request</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // --- COMPLETED Screen ---
  if (step === 'COMPLETED') {
    return (
      <SafeAreaView style={styles.fullScreenWhite}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <ChevronLeft size={24} color="black" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Trip Completed</Text>
          <View style={{ width: 24 }} />
        </View>
        
        <View style={styles.completedContent}>
          <View style={styles.illustrationContainer}>
             <Image 
                source={{ uri: 'https://cdn-icons-png.flaticon.com/512/2489/2489006.png' }} 
                style={styles.moneyIllustration}
                resizeMode="contain"
             />
          </View>

          <View style={styles.statusBadge}>
            <CheckCircle2 size={16} color="#22C55E" />
            <Text style={styles.statusBadgeText}>Delivery completed</Text>
          </View>

          <Text style={styles.earnedAmount}>{formatAmount(totalEarning)} earned</Text>
          <Text style={styles.earnedSubtext}>
            Payment will be sent to your bank account{"\n"}within 24 hours.
          </Text>
        </View>

        <TouchableOpacity 
          style={styles.findJobsButton} 
          onPress={() => router.back()}
        >
          <Text style={styles.findJobsText}>Find New Jobs</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // --- DETAILS Screen ---
  if (step === 'DETAILS') {
    return (
      <SafeAreaView style={styles.detailsContainer}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => {
            setStep(delivery.status === 'in_transit' ? 'START_RIDE' : 'PICKUP');
          }}>
            <ChevronLeft size={24} color="black" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Delivery Details</Text>
          <MoreVertical size={24} color="black" />
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.earningsCard}>
            <Text style={styles.earningsLabel}>Estimated earnings</Text>
            <Text style={styles.earningsAmount}>{formatAmount(totalEarning)}</Text>
          </View>

          <View style={styles.routeSection}>
            <View style={styles.sectionHeader}>
              <Navigation size={18} color="black" />
              <Text style={styles.sectionTitle}>Route</Text>
            </View>
            <View style={styles.timelineContainer}>
              <View style={styles.timelineItem}>
                <View style={[styles.dot, { backgroundColor: '#2563EB' }]} />
                <View>
                  <Text style={styles.timelineTitle}>To Pickup {pickupDistKm}</Text>
                  <Text style={styles.timelineLocation}>{pickupName}</Text>
                  <Text style={styles.timelineSub}>{pickupAddress}</Text>
                </View>
              </View>
              <View style={styles.timelineItem}>
                <View style={[styles.dot, { backgroundColor: '#2563EB' }]} />
                <View>
                  <Text style={styles.timelineTitle}>
                    Drop {totalDistKm} {dropoffEta ? <Text style={{color: '#2563EB', fontWeight: '400'}}>{dropoffEta}</Text> : null}
                  </Text>
                  <Text style={styles.timelineLocation}>{dropoffName}</Text>
                  <Text style={styles.timelineSub}>{dropoffAddress}</Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.fareSection}>
            <Text style={styles.fareTitle}>Fare Breakdown</Text>
            {baseFare > 0 && (
              <View style={styles.fareRow}><Text style={styles.fareLabel}>Base fare</Text><Text style={styles.fareValue}>{formatAmount(baseFare)}</Text></View>
            )}
            {distanceFare > 0 && (
              <View style={styles.fareRow}><Text style={styles.fareLabel}>Distance fare</Text><Text style={styles.fareValue}>{formatAmount(distanceFare)}</Text></View>
            )}
            {fuelCost > 0 && (
              <View style={styles.fareRow}><Text style={styles.fareLabel}>Fuel Cost</Text><Text style={styles.fareValue}>{formatAmount(fuelCost)}</Text></View>
            )}
            {tax > 0 && (
              <View style={styles.fareRow}><Text style={styles.fareLabel}>Tax</Text><Text style={styles.fareValue}>{formatAmount(tax)}</Text></View>
            )}
            <View style={[styles.fareRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>Total earning</Text>
              <Text style={styles.totalValue}>{formatAmount(totalEarning)}</Text>
            </View>
          </View>
        </ScrollView>

        <TouchableOpacity 
          style={styles.cancelDeliveryButton} 
          onPress={() => setStep('CANCEL_CONFIRM')}
        >
          <Text style={styles.cancelDeliveryText}>Cancel Delivery</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // --- Main Flow: PICKUP / START_RIDE / ARRIVED_DROP ---
  const stepConfigs: Record<string, { title: string; subtitle: string; buttonText: string; nextStatus?: 'in_transit' | 'delivered'; action?: 'advance' }> = {
    PICKUP: {
      title: delivery.tracking?.estimatedArrival || '4 min away',
      subtitle: `Reach the ${pickupName}`,
      buttonText: 'Arrived pickup point',
      nextStatus: 'in_transit',
    },
    START_RIDE: {
      title: 'Arrived',
      subtitle: `Pick up from ${pickupName}`,
      buttonText: 'Start ride',
      action: 'advance',
    },
    ARRIVED_DROP: {
      title: 'Arrived',
      subtitle: `Drop off at ${dropoffName}`,
      buttonText: 'Arrived drop location',
      nextStatus: 'delivered',
    },
  };

  const cfg = stepConfigs[step];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <DeliveryMap />
      
      <View style={styles.bottomSheet}>
        <View style={styles.handle} />
        <View style={styles.etaRow}>
          <View>
            <Text style={styles.etaText}>{cfg.title}</Text>
            <Text style={styles.etaSubtext}>{cfg.subtitle}</Text>
          </View>
          <View style={styles.distanceBadge}>
            <MapPin size={14} color="#F59E0B" />
            <Text style={styles.distanceText}>{step === 'PICKUP' ? '400m' : totalDistKm}</Text>
          </View>
        </View>

        <ProfileSection />

        <View style={styles.locationCard}>
          <View style={styles.locationHeader}>
            <View style={styles.headingToRow}>
              <Navigation size={14} color="#111" />
              <Text style={styles.headingToText}>Heading to</Text>
            </View>
            <TouchableOpacity onPress={() => setStep('DETAILS')} style={styles.detailsLink}>
              <Text style={styles.detailsLinkText}>Delivery details</Text>
              <ArrowRight size={14} color="#666" />
            </TouchableOpacity>
          </View>

          {step === 'PICKUP' ? (
            <>
              <Text style={styles.locationName}>Pickup-{pickupDistKm} away</Text>
              <Text style={styles.locationAddress}>{pickupAddress}</Text>
            </>
          ) : (
            <>
              <Text style={styles.locationName}>Drop {totalDistKm} away</Text>
              <Text style={styles.locationAddress}>{dropoffAddress}</Text>
            </>
          )}
        </View>

        {cfg.buttonText && (
          <TouchableOpacity 
            style={styles.primaryButton} 
            onPress={() => {
              if (cfg.nextStatus) {
                // Update backend status (PICKUP -> in_transit, ARRIVED_DROP -> delivered)
                handleNextStep(cfg.nextStatus);
              } else if (cfg.action === 'advance') {
                // Just advance the UI step without changing backend status (START_RIDE -> ARRIVED_DROP)
                advanceUiStep('ARRIVED_DROP');
              }
            }}
            disabled={isUpdating}
          >
            {isUpdating ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <Text style={styles.primaryButtonText}>{cfg.buttonText}</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white' },
  fullScreenWhite: { flex: 1, backgroundColor: 'white' },
  mapContainer: { flex: 1 },
  mapView: { width: '100%', height: '100%' },
  mapFallback: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5' },
  mapFallbackText: { fontSize: 14, color: '#999', textAlign: 'center', marginTop: 8, lineHeight: 20 },

  // Map Marker Styles
  driverMarkerContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(37, 99, 235, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#2563EB',
  },
  driverMarkerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#2563EB',
  },
  pickupMarkerContainer: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  dropoffMarkerContainer: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },

  // Loading / Error
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 16, color: '#666' },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  errorText: { fontSize: 18, color: '#EF4444', textAlign: 'center', marginTop: 16, marginBottom: 20 },

  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20 },
  headerTitle: { fontSize: 18, fontWeight: '600' },

  // Bottom Sheet
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    width: width,
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 30,
    elevation: 20,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  handle: { width: 50, height: 4, backgroundColor: '#666', borderRadius: 2, alignSelf: 'center', marginVertical: 12 },
  etaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  etaText: { fontSize: 24, fontWeight: '700' },
  etaSubtext: { fontSize: 13, color: '#666' },
  distanceBadge: { flexDirection: 'row', alignItems: 'center', padding: 4 },
  distanceText: { fontSize: 12, fontWeight: '700', marginLeft: 4 },

  // Profile
  profileContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  profileInfo: { flexDirection: 'row', alignItems: 'center' },
  avatarContainer: { width: 44, height: 44, borderRadius: 22, overflow: 'hidden', marginRight: 12, backgroundColor: '#333' },
  avatar: { width: '100%', height: '100%' },
  userName: { fontSize: 18, fontWeight: '600' },
  statusRow: { flexDirection: 'row', alignItems: 'center' },
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22C55E', marginRight: 6 },
  roleText: { fontSize: 13, color: '#666' },
  callButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#005CEE', justifyContent: 'center', alignItems: 'center' },

  // Location Card
  locationCard: { backgroundColor: '#F8F9FA', borderRadius: 12, padding: 16, marginBottom: 20 },
  locationHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  headingToRow: { flexDirection: 'row', alignItems: 'center' },
  headingToText: { fontSize: 14, fontWeight: '600', marginLeft: 8 },
  detailsLink: { flexDirection: 'row', alignItems: 'center' },
  detailsLinkText: { fontSize: 13, color: '#666', marginRight: 4 },
  locationName: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  locationAddress: { fontSize: 13, color: '#666', lineHeight: 18 },

  // Buttons
  primaryButton: { backgroundColor: '#1DBF73', paddingVertical: 18, borderRadius: 8, alignItems: 'center' },
  primaryButtonText: { color: 'white', fontSize: 16, fontWeight: '600' },

  // Details Screen
  detailsContainer: { flex: 1, backgroundColor: 'white' },
  earningsCard: { padding: 30, alignItems: 'center' },
  earningsLabel: { fontSize: 14, color: '#666', marginBottom: 8 },
  earningsAmount: { fontSize: 44, fontWeight: '700' },
  routeSection: { padding: 20, borderTopWidth: 1, borderColor: '#F0F0F0' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginLeft: 10 },
  timelineContainer: { paddingLeft: 10, borderLeftWidth: 1, borderLeftColor: '#E0E0E0', borderStyle: 'dashed', marginLeft: 10 },
  timelineItem: { marginBottom: 30, paddingLeft: 20 },
  dot: { position: 'absolute', left: -6, top: 6, width: 12, height: 12, borderRadius: 6 },
  timelineTitle: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  timelineLocation: { fontSize: 14, fontWeight: '500' },
  timelineSub: { fontSize: 12, color: '#999' },
  fareSection: { padding: 20 },
  fareTitle: { fontSize: 16, fontWeight: '600', marginBottom: 20 },
  fareRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  fareLabel: { fontSize: 15, color: '#666' },
  fareValue: { fontSize: 15, fontWeight: '600' },
  totalRow: { marginTop: 15, paddingTop: 15, borderTopWidth: 1, borderColor: '#F0F0F0' },
  totalLabel: { fontSize: 14, color: '#999' },
  totalValue: { fontSize: 16, fontWeight: '700' },
  cancelDeliveryButton: { margin: 20, padding: 18, borderRadius: 8, borderWidth: 1, borderColor: '#EF4444', alignItems: 'center' },
  cancelDeliveryText: { color: '#EF4444', fontWeight: '600' },

  // Cancel Screen
  cancelContent: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30 },
  redCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#E11D48', justifyContent: 'center', alignItems: 'center', marginBottom: 30 },
  exclamationMark: { color: 'white', fontSize: 40, fontWeight: '700' },
  cancelTitle: { fontSize: 26, fontWeight: '700', textAlign: 'center', lineHeight: 32, marginBottom: 12 },
  cancelSubtitle: { fontSize: 16, color: '#666', marginBottom: 40 },
  cancelButtonRow: { flexDirection: 'row', width: '100%' },
  noButton: { flex: 1, padding: 18, borderRadius: 8, borderWidth: 1, borderColor: '#005CEE', marginRight: 10, alignItems: 'center' },
  noButtonText: { color: '#111', fontWeight: '600', fontSize: 16 },
  sendRequestButton: { flex: 1, padding: 18, backgroundColor: '#E11D48', borderRadius: 8, alignItems: 'center' },
  sendRequestText: { color: 'white', fontWeight: '600', fontSize: 16 },

  // Completed Screen
  completedContent: { flex: 1, alignItems: 'center', paddingTop: 50 },
  illustrationContainer: { width: width * 0.7, height: 250, marginBottom: 40 },
  moneyIllustration: { width: '100%', height: '100%' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  statusBadgeText: { fontSize: 14, color: '#22C55E', fontWeight: '600', marginLeft: 8 },
  earnedAmount: { fontSize: 42, fontWeight: '700', marginBottom: 10 },
  earnedSubtext: { fontSize: 15, color: '#666', textAlign: 'center', lineHeight: 22 },
  findJobsButton: { margin: 20, padding: 18, backgroundColor: '#005CEE', borderRadius: 8, alignItems: 'center' },
  findJobsText: { color: 'white', fontWeight: '600', fontSize: 16 },
});

export default DeliverStepsConfirmation;