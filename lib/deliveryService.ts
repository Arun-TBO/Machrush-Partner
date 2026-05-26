import {
  Timestamp,
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';
import { auth, db, firebaseApp } from './firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';

const FIREBASE_PROJECT_ID = firebaseApp?.options?.projectId || process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || '';
const VERIFIED_AUTH_SESSION_KEY = 'machrush.verifiedAuthSession';

export interface Vehicle {
  id: string;
  name: string;
  capacity: string;
  basePrice: number;
  category: string;
  imageKey: string;
  estimatedTime: string;
}

export interface DeliveryLocation {
  name?: string;
  address: string;
  coords?: { lat: number; lng: number } | null;
}

export interface DeliveryPricing {
  tripFare: number;
  tax: number;
  total: number;
  baseFare?: number;
  distanceFare?: number;
  timeFare?: number;
  fuelCost?: number;
}

export interface DeliveryPerson {
  name: string;
  phone: string;
}

export interface DriverInfo {
  fullName: string;
  phoneNumber: string;
  photoUri: string;
  vehicleNumber: string;
}

export interface DeliveryReview {
  rating: number | null;
  comment: string | null;
  isSubmitted: boolean;
}

export interface DeliveryTimestamps {
  createdAt: any;
  changedAt?: any;
  assignedAt: any | null;
  inTransitAt: any | null;
  deliveredAt: any | null;
  cancelledAt: any | null;
}

export interface DeliveryTracking {
  otp: number | string | null;
  driverLat: number | null;
  driverLng: number | null;
  estimatedArrival: string | null;
}

export interface DeliveryVehicle {
  id: string;
  name: string;
  imageKey: string;
}

export interface Delivery {
  id: string;
  senderId: string;
  receiverId: string | null;
  driverId: string | null;
  driver: DriverInfo | null;
  status: 'searching' | 'assigned' | 'in_transit' | 'delivered' | 'cancelled';
  vehicle: DeliveryVehicle;
  locations: {
    pickup: DeliveryLocation;
    dropoff: DeliveryLocation;
  };
  sender: DeliveryPerson;
  receiver: DeliveryPerson;
  pricing: DeliveryPricing;
  tracking: DeliveryTracking;
  timestamps: DeliveryTimestamps;
  review: DeliveryReview;
  changedAt?: any;
  pickupTime: string | null;
  dropoffTime: string | null;
  priority?: 'urgent' | 'normal';
  distance?: {
    pickup: number;
    total: number;
  };
  estimatedTime?: {
    pickup: number;
    dropoff: number;
  };
}

// ================================
// VEHICLES
// ================================

const API_BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL || '').replace(/\/$/, '') || undefined;

const getTimestampDate = (value: any): Date | null => {
  if (!value) return null;
  if (value?.toDate) return value.toDate();
  if (value instanceof Date) return value;
  if (typeof value === 'object' && ('seconds' in value || '_seconds' in value)) {
    const secs = value.seconds || value._seconds || 0;
    const nsecs = value.nanoseconds || value._nanoseconds || 0;
    return new Date((secs) * 1000 + nsecs / 1000000);
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const fromFirestoreRestValue = (value: any): any => {
  if (!value) return undefined;
  if ('stringValue' in value) return value.stringValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('timestampValue' in value) return value.timestampValue;
  if ('nullValue' in value) return null;
  if ('arrayValue' in value) {
    return (value.arrayValue.values || []).map(fromFirestoreRestValue);
  }
  if ('mapValue' in value) {
    return fromFirestoreRestFields(value.mapValue.fields || {});
  }
  return undefined;
};

const fromFirestoreRestFields = (fields: Record<string, any>) => {
  return Object.entries(fields).reduce<Record<string, any>>((acc, [key, value]) => {
    acc[key] = fromFirestoreRestValue(value);
    return acc;
  }, {});
};

const normalizeDeliveryStatus = (status: unknown): Delivery['status'] => {
  const normalized = typeof status === 'string' ? status.trim().toLowerCase() : '';

  switch (normalized) {
    case 'searching':
    case 'pending':
    case 'open':
    case 'requested':
      return 'searching';
    case 'assigned':
    case 'accepted':
      return 'assigned';
    case 'in_transit':
    case 'in-transit':
    case 'in transit':
    case 'pickup_complete':
    case 'picked_up':
      return 'in_transit';
    case 'delivered':
    case 'completed':
      return 'delivered';
    case 'cancelled':
    case 'canceled':
      return 'cancelled';
    default:
      return 'searching';
  }
};

const normalizeDelivery = (rawDelivery: any): Delivery => {
  const createdAt =
    rawDelivery?.timestamps?.createdAt ||
    rawDelivery?.createdAt ||
    rawDelivery?.timestamp ||
    null;
  const changedAt =
    rawDelivery?.timestamps?.changedAt ||
    rawDelivery?.changedAt ||
    rawDelivery?.updatedAt ||
    createdAt;

  const normalizedDriverId =
    rawDelivery?.driverId ??
    rawDelivery?.driver?.id ??
    rawDelivery?.driver?._id ??
    rawDelivery?.assignedDriverId ??
    null;

  return {
    ...rawDelivery,
    id: rawDelivery?.id || rawDelivery?._id || '',
    senderId: rawDelivery?.senderId || rawDelivery?.userId || '',
    receiverId: rawDelivery?.receiverId ?? null,
    driverId: normalizedDriverId,
    driver: rawDelivery?.driver || null,
    status: normalizeDeliveryStatus(rawDelivery?.status || rawDelivery?.deliveryStatus),
    vehicle: rawDelivery?.vehicle || {
      id: '',
      name: '',
      imageKey: '',
    },
    locations: rawDelivery?.locations || {
      pickup: rawDelivery?.pickup || { address: '' },
      dropoff: rawDelivery?.dropoff || { address: '' },
    },
    sender: rawDelivery?.sender || { name: '', phone: '' },
    receiver: rawDelivery?.receiver || { name: '', phone: '' },
    pricing: rawDelivery?.pricing || {
      tripFare: rawDelivery?.tripFare || rawDelivery?.amount || 0,
      tax: rawDelivery?.tax || 0,
      total: rawDelivery?.total || rawDelivery?.amount || 0,
    },
    tracking: rawDelivery?.tracking || {
      otp: null,
      driverLat: null,
      driverLng: null,
      estimatedArrival: null,
    },
    timestamps: {
      createdAt,
      changedAt,
      assignedAt: rawDelivery?.timestamps?.assignedAt || rawDelivery?.assignedAt || null,
      inTransitAt: rawDelivery?.timestamps?.inTransitAt || rawDelivery?.inTransitAt || null,
      deliveredAt: rawDelivery?.timestamps?.deliveredAt || rawDelivery?.deliveredAt || null,
      cancelledAt: rawDelivery?.timestamps?.cancelledAt || rawDelivery?.cancelledAt || null,
    },
    review: rawDelivery?.review || {
      rating: null,
      comment: null,
      isSubmitted: false,
    },
    pickupTime: rawDelivery?.pickupTime || null,
    dropoffTime: rawDelivery?.dropoffTime || null,
    priority: rawDelivery?.priority === 'urgent' ? 'urgent' : 'normal',
    distance: rawDelivery?.distance,
    estimatedTime: rawDelivery?.estimatedTime,
  };
};

const resolveAuthToken = async (token?: string | null): Promise<string | null> => {
  if (token) return token;

  try {
    if (auth.currentUser) {
      const freshToken = await auth.currentUser.getIdToken();
      if (freshToken) {
        await AsyncStorage.setItem('firebaseIdToken', freshToken);
        return freshToken;
      }
    }

    const [storedToken, storedSession] = await Promise.all([
      AsyncStorage.getItem('firebaseIdToken'),
      AsyncStorage.getItem(VERIFIED_AUTH_SESSION_KEY),
    ]);

    if (storedToken) return storedToken;

    if (storedSession) {
      try {
        const parsed = JSON.parse(storedSession);
        if (parsed?.idToken && typeof parsed.idToken === 'string') {
          return parsed.idToken;
        }
      } catch {
        // Ignore malformed cached session data.
      }
    }
  } catch (error) {
    console.warn('[DeliveryService] Failed to resolve auth token:', error);
  }

  return null;
};

const runDeliveryQueryViaRest = async (
  structuredQuery: Record<string, any>,
  idToken: string
): Promise<Delivery[]> => {
  if (!FIREBASE_PROJECT_ID) {
    throw new Error('Firebase project ID is not configured');
  }

  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents:runQuery`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${idToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ structuredQuery }),
    }
  );

  const responseBody = await response.json().catch(() => null);

  if (!response.ok) {
    console.error('[DeliveryService] Firestore REST query failed:', responseBody);
    throw new Error(responseBody?.error?.message || 'Failed to query deliveries');
  }

  const results = Array.isArray(responseBody) ? responseBody : [];

  return results
    .filter((item) => item?.document?.fields)
    .map((item) => {
      const name: string = item.document.name || '';
      const id = name.split('/').pop() || '';
      return normalizeDelivery({
        id,
        ...fromFirestoreRestFields(item.document.fields || {}),
      });
    });
};

export async function getVehicles(): Promise<Vehicle[]> {
  if (API_BASE_URL) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/deliveries/vehicles`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      if (response.ok) {
        const body = await response.json();
        if (body.success && Array.isArray(body.data)) {
          console.log('[DeliveryService] Vehicles fetched from backend:', body.data.length);
          return body.data as Vehicle[];
        }
      }
      console.warn('[DeliveryService] Backend returned error, falling back to SDK:', response.status);
    } catch (error) {
      console.warn('[DeliveryService] Backend unavailable, falling back to SDK:', error);
    }
  }

  try {
    const snapshot = await getDocs(collection(db, 'vehicles'));
    const vehicles: Vehicle[] = [];
    snapshot.forEach((doc) => {
      vehicles.push({ id: doc.id, ...doc.data() } as Vehicle);
    });
    return vehicles;
  } catch (error) {
    console.error('[DeliveryService] Error fetching vehicles:', error);
    throw error;
  }
}

// ================================
// DELIVERIES - CREATE
// ================================

export interface InitiateDeliveryInput {
  userId: string;
  vehicle: { id: string; name: string; imageKey?: string };
  locations: {
    pickup: { address: string; coords?: { lat: number; lng: number } };
    dropoff: { address: string; coords?: { lat: number; lng: number } };
  };
  pricing: { tripFare: number; tax?: number; total: number };
  sender?: { name: string; phone: string };
  receiver?: { name: string; phone: string };
  pickupTime?: string;
  dropoffTime?: string;
}

export async function initiateDelivery(orderData: InitiateDeliveryInput): Promise<string> {
  if (API_BASE_URL) {
    try {
      const bodyData = {
        senderId: orderData.userId,
        vehicle: orderData.vehicle,
        locations: {
          pickup: {
            address: orderData.locations.pickup.address,
            coords: orderData.locations.pickup.coords || undefined,
          },
          dropoff: {
            address: orderData.locations.dropoff.address,
            coords: orderData.locations.dropoff.coords || undefined,
          },
        },
        pricing: orderData.pricing,
        sender: orderData.sender,
        receiver: orderData.receiver,
        pickupTime: orderData.pickupTime,
      };
      const response = await fetch(`${API_BASE_URL}/api/deliveries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyData),
      });
      const body = await response.json();
      if (response.ok && body.success && body.data?.id) {
        console.log('[DeliveryService] Delivery created via backend:', body.data.id);
        return body.data.id;
      }
      console.warn('[DeliveryService] Backend returned error:', body);
    } catch (error) {
      console.warn('[DeliveryService] Backend unavailable, falling back to SDK:', error);
    }
  }

  try {
    const now = Timestamp.now();
    const deliveryDoc = {
      senderId: orderData.userId,
      receiverId: null,
      driverId: null,
      driver: null,
      status: 'searching',
      vehicle: {
        id: orderData.vehicle.id,
        name: orderData.vehicle.name,
        imageKey: orderData.vehicle.imageKey || orderData.vehicle.name,
      },
      locations: {
        pickup: {
          address: orderData.locations.pickup.address,
          coords: orderData.locations.pickup.coords || null,
        },
        dropoff: {
          address: orderData.locations.dropoff.address,
          coords: orderData.locations.dropoff.coords || null,
        },
      },
      sender: {
        name: orderData.sender?.name || '',
        phone: orderData.sender?.phone || '',
      },
      receiver: {
        name: orderData.receiver?.name || '',
        phone: orderData.receiver?.phone || '',
      },
      pricing: {
        tripFare: orderData.pricing.tripFare,
        tax: orderData.pricing.tax || 0,
        total: orderData.pricing.total,
      },
      tracking: {
        otp: null,
        driverLat: null,
        driverLng: null,
        estimatedArrival: null,
      },
      timestamps: {
        createdAt: now,
        changedAt: now,
        assignedAt: null,
        inTransitAt: null,
        deliveredAt: null,
        cancelledAt: null,
      },
      review: {
        rating: null,
        comment: null,
        isSubmitted: false,
      },
      pickupTime: null,
      dropoffTime: null,
    };

    const docRef = await addDoc(collection(db, 'deliveries'), deliveryDoc);
    console.log('[DeliveryService] Delivery created:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('[DeliveryService] Error creating delivery:', error);
    throw error;
  }
}

// ================================
// DELIVERIES - READ
// ================================

export async function getDelivery(deliveryId: string): Promise<Delivery | null> {
  if (API_BASE_URL) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/deliveries/${deliveryId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      if (response.ok) {
        const body = await response.json();
        if (body.success && body.data) {
          return body.data as Delivery;
        }
      }
    } catch (error) {
      console.warn('[DeliveryService] Backend getDelivery failed:', error);
    }
  }

  try {
    const docSnap = await getDoc(doc(db, 'deliveries', deliveryId));
    if (!docSnap.exists()) return null;
    return { id: docSnap.id, ...docSnap.data() } as Delivery;
  } catch (error) {
    console.error('[DeliveryService] Error getting delivery:', error);
    return null;
  }
}

const sortDeliveriesByDateDesc = (deliveries: Delivery[]): Delivery[] => {
  return deliveries.sort((a, b) => {
    const getTime = (d: Delivery) => {
      const ts = d.timestamps?.createdAt;
      if (ts?.toDate) return ts.toDate().getTime();
      if (ts instanceof Date) return ts.getTime();
      if (ts && typeof ts === 'object' && 'seconds' in ts) return (ts.seconds || 0) * 1000;
      return 0;
    };
    return getTime(b) - getTime(a);
  });
};

const isSameLocalDay = (date: Date, reference: Date) => {
  return (
    date.getFullYear() === reference.getFullYear() &&
    date.getMonth() === reference.getMonth() &&
    date.getDate() === reference.getDate()
  );
};

export const filterTodayDeliveries = (
  deliveries: Delivery[],
  referenceDate: Date = new Date()
): Delivery[] => {
  return sortDeliveriesByDateDesc(
    deliveries.filter((delivery) => {
      const createdAt = getTimestampDate(delivery.timestamps?.createdAt);
      return createdAt ? isSameLocalDay(createdAt, referenceDate) : false;
    })
  );
};

export const calculateDriverTodayEarnings = (
  deliveries: Delivery[],
  driverId: string,
  referenceDate: Date = new Date()
): number => {
  const today = new Date(referenceDate);
  today.setHours(0, 0, 0, 0);

  return deliveries
    .filter((d) => {
      if (d.status !== 'delivered') return false;
      if (d.driverId !== driverId) return false;

      const deliveredDate = getTimestampDate(d.timestamps?.deliveredAt);
      if (!deliveredDate) return false;

      deliveredDate.setHours(0, 0, 0, 0);
      return deliveredDate.getTime() === today.getTime();
    })
    .reduce((sum, d) => sum + (d.pricing?.total || 0), 0);
};

const dedupeDeliveriesById = (deliveries: Delivery[]): Delivery[] => {
  const unique = new Map<string, Delivery>();

  deliveries.forEach((delivery) => {
    if (delivery.id) {
      unique.set(delivery.id, delivery);
    }
  });

  return Array.from(unique.values());
};

const fetchDeliveriesFromBackend = async (
  path: string,
  token?: string | null
): Promise<Delivery[] | null> => {
  if (!API_BASE_URL) {
    return null;
  }

  try {
    const authToken = await resolveAuthToken(token);
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
    });

    if (!response.ok) {
      console.warn('[DeliveryService] Backend fetch failed:', path, response.status);
      return null;
    }

    const body = await response.json().catch(() => null);
    if (!body?.success || !Array.isArray(body.data)) {
      console.warn('[DeliveryService] Backend fetch returned invalid payload:', path, body);
      return null;
    }

    return body.data.map(normalizeDelivery);
  } catch (error) {
    console.warn('[DeliveryService] Backend fetch error:', path, error);
    return null;
  }
};

const mapSnapshotToDeliveries = (snapshot: any): Delivery[] => {
  const deliveries: Delivery[] = [];

  snapshot.forEach((docSnap: any) => {
    deliveries.push(
      normalizeDelivery({
        id: docSnap.id,
        ...docSnap.data(),
      })
    );
  });

  return deliveries;
};

export const filterDriverActiveDeliveries = (
  deliveries: Delivery[],
  driverId: string
): Delivery[] => {
  const now = new Date();

  const boundaries = {
    set1: 20,
    set2: 40,
    set3: 60,
    set4: 90,
  };

  const availableDeliveries = deliveries.filter((delivery) => {
    if (delivery.status !== 'searching') return false;
    if (delivery.driverId && delivery.driverId !== '') return false;
    return true;
  });

  const categorizedDeliveries = availableDeliveries
    .map((delivery) => {
      const createdDate = getTimestampDate(delivery.timestamps?.createdAt);

      if (!createdDate) return null;

      const ageInMinutes = (now.getTime() - createdDate.getTime()) / (1000 * 60);

      // Exclude deliveries older than 90 minutes — delivery window expired
      if (ageInMinutes > 90) return null;

      let set = 0;
      if (ageInMinutes <= boundaries.set1) {
        set = 1;
      } else if (ageInMinutes <= boundaries.set2) {
        set = 2;
      } else if (ageInMinutes <= boundaries.set3) {
        set = 3;
      } else {
        set = 4;
      }

      return { delivery, ageMinutes: ageInMinutes, set };
    })
    .filter((item) => item !== null) as { delivery: Delivery; ageMinutes: number; set: number }[];

  categorizedDeliveries.sort((a, b) => {
    if (a.set !== b.set) {
      return a.set - b.set;
    }
    return b.ageMinutes - a.ageMinutes;
  });

  const activeDeliveries = categorizedDeliveries.map((item) => item.delivery);

  console.log(`[DeliveryService] Found ${activeDeliveries.length} active deliveries`);
  console.log(`  Set 1 (0-20min): ${categorizedDeliveries.filter((d) => d.set === 1).length}`);
  console.log(`  Set 2 (20-40min): ${categorizedDeliveries.filter((d) => d.set === 2).length}`);
  console.log(`  Set 3 (40-60min): ${categorizedDeliveries.filter((d) => d.set === 3).length}`);
  console.log(`  Set 4 (60-90min): ${categorizedDeliveries.filter((d) => d.set === 4).length}`);

  return activeDeliveries;
};

/**
 * Get ALL deliveries from backend API (bypasses security rules)
 */
/**
 * Get ALL deliveries from backend API (bypasses security rules)
 */
/**
 * Fetch driver profile via backend Admin SDK (bypasses Firestore security rules).
 * Returns the driver document data from the 'drivers' collection.
 */
export async function getDriverProfileViaBackend(
  driverId: string,
  token?: string | null
): Promise<{ fullName?: string; phoneNumber?: string; photoUri?: string; vehicleNumber?: string; profilePhotoUrl?: string } | null> {
  if (!API_BASE_URL) {
    return null;
  }

  try {
    const authToken = await resolveAuthToken(token);
    const response = await fetch(
      `${API_BASE_URL}/api/deliveries/driver-profile/${encodeURIComponent(driverId)}`,
      {
        headers: {
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
      }
    );
    if (!response.ok) {
      console.warn('[DeliveryService] Backend driver profile fetch failed:', response.status);
      return null;
    }
    const body = await response.json();
    if (body.success && body.data) {
      return body.data;
    }
    return null;
  } catch (error) {
    console.warn('[DeliveryService] Backend driver profile fetch error:', error);
    return null;
  }
}

export async function getAllDeliveries(token?: string | null): Promise<Delivery[]> {
  const backendOpenDeliveries = await fetchDeliveriesFromBackend('/api/deliveries/open', token);
  if (backendOpenDeliveries) {
    console.log('[DeliveryService] Backend open deliveries count:', backendOpenDeliveries.length);
    return sortDeliveriesByDateDesc(backendOpenDeliveries);
  }

  if (API_BASE_URL) {
    console.warn('[DeliveryService] Backend open deliveries unavailable; skipping Firestore fallback.');
    return [];
  }

  console.warn('[DeliveryService] Falling back to Firestore for all deliveries');

  try {
    const snapshot = await getDocs(collection(db, 'deliveries'));
    const deliveries: Delivery[] = [];

    snapshot.forEach((docSnap) => {
      deliveries.push(
        normalizeDelivery({
          id: docSnap.id,
          ...docSnap.data(),
        })
      );
    });

    const sortedDeliveries = sortDeliveriesByDateDesc(deliveries);
    console.log('[DeliveryService] Firestore fallback deliveries count:', sortedDeliveries.length);
    return sortedDeliveries;
  } catch (error) {
    console.error('[DeliveryService] Firestore fallback failed:', error);
    return [];
  }
}

export async function getDriverVisibleDeliveries(
  driverId: string,
  token?: string | null
): Promise<Delivery[]> {
  try {
    const [backendOpenDeliveries, backendAssignedDeliveries] = await Promise.all([
      fetchDeliveriesFromBackend('/api/deliveries/open', token),
      fetchDeliveriesFromBackend(`/api/deliveries/driver/${encodeURIComponent(driverId)}?type=active`, token),
    ]);

    if (backendOpenDeliveries || backendAssignedDeliveries) {
      const visibleDeliveries = sortDeliveriesByDateDesc(
        dedupeDeliveriesById([
          ...(backendOpenDeliveries || []),
          ...(backendAssignedDeliveries || []),
        ])
      );

      console.log('[DeliveryService] Visible deliveries for driver:', visibleDeliveries.length);
      return visibleDeliveries;
    }

    if (API_BASE_URL) {
      console.warn('[DeliveryService] Driver delivery backend unavailable; falling back to Firestore SDK.');
      // Do NOT return early - fall through to Firestore SDK fallback
    }

    // Attempt REST query; if it fails (e.g. invalid auth token), fall through to SDK
    let restQuerySucceeded = false;
    try {
      const authToken = await resolveAuthToken(token);

      if (authToken) {
        const [searchingDeliveries, assignedDeliveries] = await Promise.all([
          runDeliveryQueryViaRest(
            {
              from: [{ collectionId: 'deliveries' }],
              where: {
                compositeFilter: {
                  op: 'AND',
                  filters: [
                    {
                      fieldFilter: {
                        field: { fieldPath: 'status' },
                        op: 'EQUAL',
                        value: { stringValue: 'searching' },
                      },
                    },
                    {
                      fieldFilter: {
                        field: { fieldPath: 'driverId' },
                        op: 'EQUAL',
                        value: { nullValue: null },
                      },
                    },
                  ],
                },
              },
            },
            authToken
          ),
          runDeliveryQueryViaRest(
            {
              from: [{ collectionId: 'deliveries' }],
              where: {
                fieldFilter: {
                  field: { fieldPath: 'driverId' },
                  op: 'EQUAL',
                  value: { stringValue: driverId },
                },
              },
            },
            authToken
          ),
        ]);

        const visibleDeliveries = sortDeliveriesByDateDesc(
          dedupeDeliveriesById([...searchingDeliveries, ...assignedDeliveries])
        );

        console.log('[DeliveryService] Visible deliveries for driver:', visibleDeliveries.length);
        restQuerySucceeded = true;
        return visibleDeliveries;
      }
    } catch (error) {
      console.warn('[DeliveryService] Firestore REST query failed, falling back to SDK:', error);
      // Fall through to SDK fallback below
    }

    // Fallback: use Firestore SDK directly
    // Note: Use a simpler query without composite index requirements
    // Filter driverId === null in code rather than in the query
    const [searchingSnapshot, assignedSnapshot] = await Promise.all([
      getDocs(
        query(
          collection(db, 'deliveries'),
          where('status', '==', 'searching')
        )
      ),
      getDocs(
        query(
          collection(db, 'deliveries'),
          where('driverId', '==', driverId)
        )
      ),
    ]);

    const visibleDeliveries = sortDeliveriesByDateDesc(
      dedupeDeliveriesById([
        ...mapSnapshotToDeliveries(searchingSnapshot),
        ...mapSnapshotToDeliveries(assignedSnapshot),
      ])
    );

    console.log('[DeliveryService] Visible deliveries for driver:', visibleDeliveries.length);
    return visibleDeliveries;
  } catch (error) {
    console.error('[DeliveryService] Error getting visible driver deliveries:', error);
    return [];
  }
}

export async function getTodayDeliveries(driverId: string, token?: string | null): Promise<Delivery[]> {
  const visibleDeliveries = await getDriverVisibleDeliveries(driverId, token);
  const todayDeliveries = filterTodayDeliveries(visibleDeliveries);

  console.log('[DeliveryService] Today deliveries count:', todayDeliveries.length);
  todayDeliveries.forEach((delivery, index) => {
    const createdAt = getTimestampDate(delivery.timestamps?.createdAt);
    console.log(`\n[Today Delivery ${index + 1}] ${delivery.id}`);
    console.log(`Status: ${delivery.status}`);
    console.log(`Sender ID: ${delivery.senderId}`);
    console.log(`Driver ID: ${delivery.driverId || 'not assigned'}`);
    console.log(`Pickup: ${delivery.locations?.pickup?.address || 'N/A'}`);
    console.log(`Dropoff: ${delivery.locations?.dropoff?.address || 'N/A'}`);
    console.log(`Created At: ${createdAt ? createdAt.toLocaleString() : 'missing'}`);
    console.log(`Amount: ₹${delivery.pricing?.total || 0}`);
  });

  return todayDeliveries;
}
/**
 * Get active deliveries for driver with time-based priority sets
 * Set 1: 0-20 minutes (highest priority)
 * Set 2: 20-40 minutes 
 * Set 3: 40-60 minutes
 * Set 4: 60-90 minutes (lowest priority)
 */
export async function getDriverActiveDeliveries(driverId: string, token?: string | null): Promise<Delivery[]> {
  try {
    const visibleDeliveries = await getDriverVisibleDeliveries(driverId, token);
    return filterDriverActiveDeliveries(visibleDeliveries, driverId);
  } catch (error) {
    console.error('[DeliveryService] Error getting active deliveries:', error);
    return [];
  }
}

/**
 * Get driver's assigned deliveries (for history)
 */
export async function getDriverAssignedDeliveries(driverId: string, token?: string | null): Promise<Delivery[]> {
  // Strategy: try backend → REST → SDK. Each step logs, but we always
  // fall through to the SDK query at the end so that we never return
  // empty prematurely due to a false-negative from an upstream method.

  let deliveries: Delivery[] | null = null;

  // 1. Try backend API
  if (API_BASE_URL) {
    try {
      const backendDeliveries = await fetchDeliveriesFromBackend(
        `/api/deliveries/driver/${encodeURIComponent(driverId)}?type=active`,
        token
      );
      if (backendDeliveries !== null && backendDeliveries !== undefined) {
        deliveries = backendDeliveries.filter((d) => d.status !== 'searching');
        console.log(`[DeliveryService] Backend returned ${deliveries.length} assigned deliveries`);
      }
    } catch (error) {
      console.warn('[DeliveryService] Backend assigned fetch failed:', error);
    }
  }

  // 2. Try Firestore REST API (if we still have no results)
  if (!deliveries) {
    try {
      const authToken = await resolveAuthToken(token);
      if (authToken) {
        const restDeliveries = await runDeliveryQueryViaRest(
          {
            from: [{ collectionId: 'deliveries' }],
            where: {
              fieldFilter: {
                field: { fieldPath: 'driverId' },
                op: 'EQUAL',
                value: { stringValue: driverId },
              },
            },
          },
          authToken
        );
        deliveries = restDeliveries.filter((d) => d.status !== 'searching');
        console.log(`[DeliveryService] REST returned ${deliveries.length} assigned deliveries`);
      }
    } catch (error) {
      console.warn('[DeliveryService] REST assigned query failed:', error);
    }
  }

  // 3. Final fallback: Firestore SDK (most reliable)
  if (!deliveries) {
    try {
      const snapshot = await getDocs(
        query(
          collection(db, 'deliveries'),
          where('driverId', '==', driverId)
        )
      );
      deliveries = mapSnapshotToDeliveries(snapshot).filter(
        (d) => d.status !== 'searching'
      );
      console.log(`[DeliveryService] SDK returned ${deliveries.length} assigned deliveries`);
    } catch (error) {
      console.error('[DeliveryService] SDK assigned query failed:', error);
      deliveries = [];
    }
  }

  return deliveries;
}

/**
 * Get driver's today's earnings
 */
export async function getDriverTodayEarnings(driverId: string, token?: string | null): Promise<number> {
  try {
    const assignedDeliveries = await getDriverAssignedDeliveries(driverId, token);
    const todayEarnings = calculateDriverTodayEarnings(assignedDeliveries, driverId);
    console.log(`[DeliveryService] Today's earnings for driver: ₹${todayEarnings}`);
    return todayEarnings;
    
  } catch (error) {
    console.error('[DeliveryService] Error getting today earnings:', error);
    return 0;
  }
}

// Keep original functions for backward compatibility
export async function getDriverDeliveries(driverId: string, token?: string | null): Promise<Delivery[]> {
  return getDriverAssignedDeliveries(driverId, token);
}

export async function getDriverHistoryDeliveries(driverId: string, token?: string | null): Promise<Delivery[]> {
  const allDeliveries = await getDriverAssignedDeliveries(driverId, token);
  return allDeliveries.filter(d => 
    d.status === 'delivered' || 
    d.status === 'cancelled'
  );
}

export async function getUserShipments(senderId: string, type: 'active' | 'history' = 'active'): Promise<Delivery[]> {
  if (API_BASE_URL) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/deliveries/user/${senderId}?type=${type}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      if (response.ok) {
        const body = await response.json();
        if (body.success && Array.isArray(body.data)) {
          return body.data as Delivery[];
        }
      }
    } catch (error) {
      console.warn('[DeliveryService] Backend getUserShipments failed:', error);
    }
  }

  try {
    let q;
    if (type === 'active') {
      q = query(
        collection(db, 'deliveries'),
        where('senderId', '==', senderId),
        where('status', 'in', ['searching', 'assigned', 'in_transit']),
      );
    } else {
      q = query(
        collection(db, 'deliveries'),
        where('senderId', '==', senderId),
        where('status', '==', 'delivered'),
      );
    }

    const snapshot = await getDocs(q);
    const deliveries: Delivery[] = [];
    snapshot.forEach((doc) => {
      deliveries.push({ id: doc.id, ...doc.data() } as Delivery);
    });
    return deliveries;
  } catch (error: any) {
    console.error('[DeliveryService] Error getting sender shipments:', error);
    return [];
  }
}

export async function getDriverShipments(driverId: string, type: 'active' | 'history' = 'active'): Promise<Delivery[]> {
  try {
    let q;
    if (type === 'active') {
      q = query(
        collection(db, 'deliveries'),
        where('driverId', '==', driverId),
        where('status', 'in', ['searching', 'assigned', 'in_transit']),
      );
    } else {
      q = query(
        collection(db, 'deliveries'),
        where('driverId', '==', driverId),
        where('status', '==', 'delivered'),
      );
    }

    const snapshot = await getDocs(q);
    const deliveries: Delivery[] = [];
    snapshot.forEach((doc) => {
      deliveries.push({ id: doc.id, ...doc.data() } as Delivery);
    });
    return deliveries;
  } catch (error: any) {
    console.error('[DeliveryService] Error getting driver shipments:', error);
    return [];
  }
}

// ================================
// REAL-TIME LISTENER
// ================================

export function streamDeliveryStatus(
  deliveryId: string,
  callback: (delivery: Delivery) => void,
): () => void {
  if (API_BASE_URL) {
    let pollInterval: ReturnType<typeof setInterval> | null = null;
    let lastStatus = '';

    const poll = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/deliveries/${deliveryId}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });
        if (response.ok) {
          const body = await response.json();
          if (body.success && body.data) {
            const data = body.data as Delivery;
            if (data.status !== lastStatus) {
              lastStatus = data.status;
            }
            callback(data);
          }
        }
      } catch (error) {
        console.warn('[DeliveryService] Poll error:', error);
      }
    };

    poll();
    pollInterval = setInterval(poll, 3000);

    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }

  const unsubscribe = onSnapshot(
    doc(db, 'deliveries', deliveryId),
    (docSnap) => {
      if (docSnap.exists()) {
        const data = { id: docSnap.id, ...docSnap.data() } as Delivery;
        callback(data);
      }
    },
    (error) => {
      console.error('[DeliveryService] Stream error:', error);
    },
  );
  return unsubscribe;
}

// ================================
// DELIVERIES - UPDATE
// ================================

export async function submitReview(
  deliveryId: string,
  reviewData: { rating: number; comment?: string },
): Promise<void> {
  if (API_BASE_URL) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/deliveries/${deliveryId}/review`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reviewData),
      });
      if (response.ok) {
        console.log('[DeliveryService] Review submitted via backend:', deliveryId);
        return;
      }
    } catch (error) {
      console.warn('[DeliveryService] Backend review failed:', error);
    }
  }

  try {
    await updateDoc(doc(db, 'deliveries', deliveryId), {
      'review.rating': reviewData.rating,
      'review.comment': reviewData.comment || '',
      'review.isSubmitted': true,
    });
    console.log('[DeliveryService] Review submitted for:', deliveryId);
  } catch (error) {
    console.error('[DeliveryService] Error submitting review:', error);
    throw error;
  }
}

/**
 * Assign a driver to a delivery via the backend /api/deliveries/:id/assign endpoint.
 * This properly sets driverId, driver info, tracking.otp, tracking.estimatedArrival,
 * and timestamps.assignedAt in a single call.
 */
export async function assignDriverToDelivery(
  deliveryId: string,
  driverId: string,
  driverData: {
    fullName: string;
    phoneNumber: string;
    photoUri: string;
    vehicleNumber: string;
  },
): Promise<void> {
  if (API_BASE_URL) {
    try {
      const authToken = await resolveAuthToken();
      const response = await fetch(`${API_BASE_URL}/api/deliveries/${deliveryId}/assign`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({ driverId, driver: driverData }),
      });
      if (response.ok) {
        const body = await response.json();
        console.log('[DeliveryService] Driver assigned via backend:', deliveryId, 'OTP:', body.data?.otp);
        return;
      }
      console.warn('[DeliveryService] Backend assign failed:', response.status);
    } catch (error) {
      console.warn('[DeliveryService] Backend assign error:', error);
    }
  }

  // Fallback: write directly via Firestore SDK
  try {
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    const now = Timestamp.now();

    await updateDoc(doc(db, 'deliveries', deliveryId), {
      driverId: driverId,
      driver: {
        fullName: driverData.fullName || '',
        phoneNumber: driverData.phoneNumber || '',
        photoUri: driverData.photoUri || '',
        vehicleNumber: driverData.vehicleNumber || '',
      },
      status: 'assigned',
      'tracking.otp': otp,
      'tracking.driverLat': null,
      'tracking.driverLng': null,
      'tracking.estimatedArrival': '~10 mins',
      'timestamps.assignedAt': now,
    });

    console.log('[DeliveryService] Driver assigned via SDK:', deliveryId, 'OTP:', otp);
  } catch (error) {
    console.error('[DeliveryService] Error assigning driver:', error);
    throw error;
  }
}

export async function updateDeliveryStatus(
  deliveryId: string,
  status: 'assigned' | 'in_transit' | 'delivered' | 'cancelled',
): Promise<void> {
  if (API_BASE_URL) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/deliveries/${deliveryId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (response.ok) {
        console.log('[DeliveryService] Status updated via backend:', deliveryId, status);
        return;
      }
    } catch (error) {
      console.warn('[DeliveryService] Backend status update failed:', error);
    }
  }

  try {
    const updateData: any = { status };
    const now = Timestamp.now();

    switch (status) {
      case 'in_transit':
        updateData['timestamps.inTransitAt'] = now;
        break;
      case 'delivered':
        updateData['timestamps.deliveredAt'] = now;
        break;
      case 'cancelled':
        updateData['timestamps.cancelledAt'] = now;
        break;
    }

    await updateDoc(doc(db, 'deliveries', deliveryId), updateData);
    console.log('[DeliveryService] Status updated:', deliveryId, status);
  } catch (error) {
    console.error('[DeliveryService] Error updating status:', error);
    throw error;
  }
}
