import {
  collection,
  doc,
  setDoc,
  getDoc,
  query,
  where,
  getDocs,
  updateDoc,
  Timestamp,
} from 'firebase/firestore';
import { auth, db } from './firebase';

export interface OnboardingData {
  // Personal Info
  phoneNumber: string;
  fullName: string;

  // Documents
  photoUri: string;
  drivingLicenseUri: string;
  identityProofUri: string;

  // Vehicle Details
  vehicleNumber: string;
  vehicleType: string;
  vehicleCapacity: string;
  bodyType: string;
  rcBookUri: string;
  insuranceUri: string;
  vehiclePhotoUris: string[];

  // Bank Details
  bankName: string;
  accountNumber: string;
  ifscCode: string;
  upiId?: string;

  // Verification Status
  verificationStatus: 'pending' | 'verified' | 'rejected';
  rejectionReason?: string;
  rejectedDocuments?: string[];
  verificationNotes?: string;

  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
  submittedAt?: Timestamp;
}

type VerificationStatus = 'pending' | 'verified' | 'rejected';

const normalizeVerificationStatus = (status: unknown): VerificationStatus | null => {
  if (typeof status !== 'string') {
    return null;
  }

  const normalized = status.trim().toLowerCase();

  if (normalized === 'verified' || normalized === 'approved') {
    return 'verified';
  }

  if (
    normalized === 'pending' ||
    normalized === 'waiting' ||
    normalized === 'waiting for verification' ||
    normalized === 'waiting for approval'
  ) {
    return 'pending';
  }

  if (normalized === 'rejected') {
    return 'rejected';
  }

  return null;
};

const toFirestoreRestValue = (value: any): any => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return { nullValue: null };
  }

  if (value instanceof Timestamp) {
    return { timestampValue: value.toDate().toISOString() };
  }

  if (value instanceof Date) {
    return { timestampValue: value.toISOString() };
  }

  if (Array.isArray(value)) {
    const values = value
      .map((item) => toFirestoreRestValue(item))
      .filter((item) => item !== undefined);

    return values.length > 0 ? { arrayValue: { values } } : { arrayValue: {} };
  }

  switch (typeof value) {
    case 'string':
      return { stringValue: value };
    case 'boolean':
      return { booleanValue: value };
    case 'number':
      return Number.isInteger(value)
        ? { integerValue: String(value) }
        : { doubleValue: value };
    case 'object': {
      const fields = Object.entries(value).reduce<Record<string, any>>((acc, [key, item]) => {
        const converted = toFirestoreRestValue(item);
        if (converted !== undefined) {
          acc[key] = converted;
        }
        return acc;
      }, {});

      return { mapValue: { fields } };
    }
    default:
      return undefined;
  }
};

const storeOnboardingDataViaRest = async (
  uid: string,
  dataToStore: OnboardingData,
  idToken: string
) => {
  const projectId = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID;

  if (!projectId) {
    throw new Error('Firebase project ID is not configured');
  }

  const fields = Object.entries(dataToStore).reduce<Record<string, any>>((acc, [key, value]) => {
    const converted = toFirestoreRestValue(value);
    if (converted !== undefined) {
      acc[key] = converted;
    }
    return acc;
  }, {});

  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/drivers/${encodeURIComponent(uid)}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${idToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fields }),
    }
  );

  const responseBody = await response.json().catch(() => null);

  if (!response.ok) {
    console.error('Firestore REST write failed:', responseBody);
    throw new Error(responseBody?.error?.message || 'Failed to store onboarding data');
  }
};

const fromFirestoreRestValue = (value: any): any => {
  if (!value) {
    return undefined;
  }

  if ('stringValue' in value) {
    return value.stringValue;
  }

  if ('booleanValue' in value) {
    return value.booleanValue;
  }

  if ('integerValue' in value) {
    return Number(value.integerValue);
  }

  if ('doubleValue' in value) {
    return value.doubleValue;
  }

  if ('timestampValue' in value) {
    return value.timestampValue;
  }

  if ('nullValue' in value) {
    return null;
  }

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

const isPhoneIdentifier = (value: string) => {
  return value.startsWith('+') || /^\d{10,15}$/.test(value);
};

const getDriverByUidViaRest = async (uid: string, idToken: string) => {
  const projectId = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID;

  if (!projectId) {
    throw new Error('Firebase project ID is not configured');
  }

  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/drivers/${encodeURIComponent(uid)}`,
    {
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
    }
  );

  if (response.status === 404) {
    return null;
  }

  const responseBody = await response.json().catch(() => null);

  if (!response.ok) {
    console.error('Firestore REST read failed:', responseBody);
    throw new Error(responseBody?.error?.message || 'Failed to fetch driver profile');
  }

  return fromFirestoreRestFields(responseBody.fields || {}) as OnboardingData;
};

const getDriverByPhoneViaRest = async (phoneNumber: string, idToken: string) => {
  const projectId = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID;

  if (!projectId) {
    throw new Error('Firebase project ID is not configured');
  }

  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${idToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: 'drivers' }],
          where: {
            fieldFilter: {
              field: { fieldPath: 'phoneNumber' },
              op: 'EQUAL',
              value: { stringValue: phoneNumber },
            },
          },
          limit: 1,
        },
      }),
    }
  );

  const responseBody = await response.json().catch(() => null);

  if (!response.ok) {
    console.error('Firestore REST query failed:', responseBody);
    throw new Error(responseBody?.error?.message || 'Failed to fetch driver profile');
  }

  const result = Array.isArray(responseBody)
    ? responseBody.find((item) => item.document?.fields)
    : null;

  if (!result) {
    return null;
  }

  return fromFirestoreRestFields(result.document.fields || {}) as OnboardingData;
};

/**
 * Store complete onboarding data to Firestore
 * Uses Firebase UID as document ID for security and proper auth rules
 * 
 * @param uid - Firebase user UID (from authentication)
 * @param phoneNumber - User's phone number
 * @param onboardingData - Complete onboarding data object
 */
export const storeOnboardingData = async (
  uid: string,
  phoneNumber: string,
  onboardingData: Omit<OnboardingData, 'createdAt' | 'updatedAt' | 'submittedAt'>,
  idToken?: string
): Promise<{ success: boolean; driverId?: string; error?: string }> => {
  try {
    if (!uid) {
      throw new Error('Firebase UID is required');
    }

    const now = Timestamp.now();

    const dataToStore: OnboardingData = {
      ...onboardingData,
      phoneNumber,
      createdAt: now,
      updatedAt: now,
      submittedAt: now,
    };

    console.log(`📝 Storing onboarding data to Firestore for UID: ${uid}`);

    console.log('Firebase Auth current user:', auth.currentUser?.uid || 'not signed in');

    if (auth.currentUser?.uid === uid) {
      await setDoc(doc(db, 'drivers', uid), dataToStore);
    } else if (idToken) {
      await storeOnboardingDataViaRest(uid, dataToStore, idToken);
    } else {
      throw new Error('Firebase user is not signed in and no ID token was provided');
    }

    console.log('✅ Onboarding data stored successfully to Firestore');
    console.log(`📍 Document path: drivers/${uid}`);

    return { success: true, driverId: uid };
  } catch (error: any) {
    console.error('❌ Error storing onboarding data:', error);
    
    if (error.code === 'permission-denied') {
      return {
        success: false,
        error: 'Permission denied. Check Firestore security rules. Make sure you are authenticated.',
      };
    }
    
    return {
      success: false,
      error: error.message || 'Failed to store data',
    };
  }
};

/**
 * Fetch verification status for a driver
 * Can use either UID (preferred) or phone number (for admin queries)
 */
export const getVerificationStatus = async (uidOrPhone: string, idToken?: string) => {
  try {
    if (idToken && auth.currentUser?.uid !== uidOrPhone) {
      const data = isPhoneIdentifier(uidOrPhone)
        ? await getDriverByPhoneViaRest(uidOrPhone, idToken)
        : await getDriverByUidViaRest(uidOrPhone, idToken);

      if (!data) {
        console.warn(`âš ï¸ No verification status found for: ${uidOrPhone}`);
        return null;
      }

      const status = normalizeVerificationStatus(data.verificationStatus);

      if (!status) {
        console.warn(`Unknown verification status for ${uidOrPhone}:`, data.verificationStatus);
        return null;
      }

      return {
        status,
        rejectionReason: data.rejectionReason,
        rejectedDocuments: data.rejectedDocuments,
        verificationNotes: data.verificationNotes,
      };
    }

    // Try as UID first (direct document access)
    let docSnap = await getDoc(doc(db, 'drivers', uidOrPhone));

    // If not found and looks like a phone number, try searching by phone field
    if (!docSnap.exists() && isPhoneIdentifier(uidOrPhone)) {
      const q = query(
        collection(db, 'drivers'),
        where('phoneNumber', '==', uidOrPhone)
      );
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.docs.length > 0) {
        docSnap = querySnapshot.docs[0];
      }
    }

    if (docSnap.exists()) {
      const data = docSnap.data() as OnboardingData;
      const status = normalizeVerificationStatus(data.verificationStatus);

      if (!status) {
        console.warn(`Unknown verification status for ${uidOrPhone}:`, data.verificationStatus);
        return null;
      }

      return {
        status,
        rejectionReason: data.rejectionReason,
        rejectedDocuments: data.rejectedDocuments,
        verificationNotes: data.verificationNotes,
      };
    }

    console.warn(`⚠️ No verification status found for: ${uidOrPhone}`);
    return null;
  } catch (error) {
    console.error('Error fetching verification status:', error);
    return null;
  }
};

/**
 * Fetch complete driver profile
 * Can use either UID (preferred) or phone number (for admin queries)
 */
export const getDriverProfile = async (uidOrPhone: string) => {
  try {
    // Try as UID first
    let docSnap = await getDoc(doc(db, 'drivers', uidOrPhone));

    // If not found and looks like a phone number, search by phone field
    if (!docSnap.exists() && uidOrPhone.startsWith('+')) {
      const q = query(
        collection(db, 'drivers'),
        where('phoneNumber', '==', uidOrPhone)
      );
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.docs.length > 0) {
        docSnap = querySnapshot.docs[0];
      }
    }

    if (docSnap.exists()) {
      return docSnap.data() as OnboardingData;
    }

    return null;
  } catch (error) {
    console.error('Error fetching driver profile:', error);
    return null;
  }
};

/**
 * Update verification status (Admin function)
 * Can update using either UID or phone number
 */
export const updateVerificationStatus = async (
  uidOrPhone: string,
  status: 'pending' | 'verified' | 'rejected',
  rejectionReason?: string,
  rejectedDocuments?: string[]
): Promise<{ success: boolean; error?: string }> => {
  try {
    let docId = uidOrPhone;

    // If it's a phone number, find the UID first
    if (uidOrPhone.startsWith('+')) {
      const q = query(
        collection(db, 'drivers'),
        where('phoneNumber', '==', uidOrPhone)
      );
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.docs.length === 0) {
        return {
          success: false,
          error: `Driver not found for phone: ${uidOrPhone}`,
        };
      }
      
      docId = querySnapshot.docs[0].id;
    }

    const updateData: any = {
      verificationStatus: status,
      updatedAt: Timestamp.now(),
    };

    if (status === 'rejected') {
      updateData.rejectionReason = rejectionReason;
      updateData.rejectedDocuments = rejectedDocuments;
    }

    await updateDoc(doc(db, 'drivers', docId), updateData);
    
    console.log(`✅ Verification status updated to "${status}" for UID: ${docId}`);

    return { success: true };
  } catch (error: any) {
    console.error('Error updating verification status:', error);
    return {
      success: false,
      error: error.message || 'Failed to update status',
    };
  }
};

/**
 * Get all pending verifications (Admin function)
 */
export const getPendingVerifications = async () => {
  try {
    const q = query(
      collection(db, 'drivers'),
      where('verificationStatus', '==', 'pending')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error('Error fetching pending verifications:', error);
    return [];
  }
};

/**
 * Get rejected drivers (Admin function)
 */
export const getRejectedDrivers = async () => {
  try {
    const q = query(
      collection(db, 'drivers'),
      where('verificationStatus', '==', 'rejected')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error('Error fetching rejected drivers:', error);
    return [];
  }
};

/**
 * Get verified drivers (Admin function)
 */
export const getVerifiedDrivers = async () => {
  try {
    const q = query(
      collection(db, 'drivers'),
      where('verificationStatus', '==', 'verified')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error('Error fetching verified drivers:', error);
    return [];
  }
};
