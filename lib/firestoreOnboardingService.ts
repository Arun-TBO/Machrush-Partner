import {
  collection,
  doc,
  setDoc,
  getDoc,
  query,
  where,
  getDocs,
  updateDoc,
  addDoc,
  Timestamp,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { Platform } from 'react-native';
import { auth, db, storage } from './firebase';

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
  verificationStatus: 'pending' | 'verified' | 'rejected' | 'suspended';
  rejectionReason?: string;
  rejectedDocuments?: string[];
  verificationNotes?: string;
  profilePhotoUrl?: string;

  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
  submittedAt?: Timestamp;
}

export interface DriverReportData {
  category: string;
  issueType: string;
  description: string;
  imageUris: string[];
}

type VerificationStatus = 'pending' | 'verified' | 'rejected' | 'suspended';
export type DriverAvailabilityStatus = 'online' | 'offline';
export type DriverAvailabilityState = {
  status: DriverAvailabilityStatus;
  changedAt?: Timestamp | string | Date | null;
};

const getApiBaseUrl = () => {
  return (process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:5000').replace(/\/$/, '');
};

const getApiErrorMessage = (responseBody: unknown, fallback: string) => {
  if (
    responseBody &&
    typeof responseBody === 'object' &&
    'error' in responseBody
  ) {
    const error = (responseBody as { error?: unknown }).error;

    if (typeof error === 'string') {
      return error;
    }

    if (error && typeof error === 'object' && 'message' in error) {
      const message = (error as { message?: unknown }).message;
      if (typeof message === 'string') {
        return message;
      }
    }
  }

  return fallback;
};

const isRemoteUrl = (uri: string) => /^https?:\/\//i.test(uri);

const getExtensionForContentType = (contentType: string) => {
  if (contentType.includes('png')) {
    return 'png';
  }

  if (contentType.includes('webp')) {
    return 'webp';
  }

  if (contentType.includes('pdf')) {
    return 'pdf';
  }

  if (contentType.includes('mp4')) {
    return 'mp4';
  }

  if (contentType.includes('quicktime')) {
    return 'mov';
  }

  return 'jpg';
};

const uploadDriverStorageAsset = async (
  uid: string,
  localUri: string,
  folder: string,
  fileName: string,
  fallbackContentType = 'image/jpeg'
) => {
  if (!localUri || isRemoteUrl(localUri)) {
    return localUri;
  }

  const response = await fetch(localUri);
  const blob = await response.blob();
  const contentType = blob.type || fallbackContentType;
  const extension = getExtensionForContentType(contentType);
  const storageRef = ref(
    storage,
    `drivers/${uid}/${folder}/${fileName}-${Date.now()}.${extension}`
  );

  await uploadBytes(storageRef, blob, {
    contentType,
    customMetadata: {
      ownerUid: uid,
    },
  });

  return getDownloadURL(storageRef);
};

const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to read selected file'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read selected file'));
    reader.readAsDataURL(blob);
  });

const localUriToDataUrl = async (uri: string) => {
  if (uri.startsWith('data:')) {
    return uri;
  }

  const response = await fetch(uri);
  const blob = await response.blob();
  return blobToDataUrl(blob);
};

type OnboardingUploadAsset = {
  type: string;
  uri: string;
  index?: number;
};

const uploadOnboardingAssetsViaBackend = async (
  uid: string,
  assets: OnboardingUploadAsset[],
  idToken: string
) => {
  const assetsToUpload = await Promise.all(
    assets.map(async (asset) => ({
      type: asset.type,
      index: asset.index,
      dataUrl: await localUriToDataUrl(asset.uri),
    }))
  );

  const response = await fetch(`${getApiBaseUrl()}/api/uploads/driver-onboarding-assets`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      uid,
      assets: assetsToUpload,
    }),
  });

  const responseBody = await response.json().catch(() => null);

  if (!response.ok || !responseBody?.success) {
    throw new Error(getApiErrorMessage(responseBody, 'Failed to upload onboarding files'));
  }

  return (responseBody.assets || []) as Array<{
    type: string;
    index?: number;
    url: string;
  }>;
};

const uploadProfilePhotoViaBackend = async (
  uid: string,
  imageData: string,
  idToken: string
) => {
  const response = await fetch(`${getApiBaseUrl()}/api/uploads/profile-photo`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ uid, imageData }),
  });

  const responseBody = await response.json().catch(() => null);

  if (!response.ok || !responseBody?.success) {
    throw new Error(getApiErrorMessage(responseBody, 'Failed to upload profile photo'));
  }

  return responseBody.imageUrl as string;
};

const submitDriverReportViaBackend = async (
  uid: string,
  reportInput: DriverReportData,
  idToken: string
) => {
  const response = await fetch(`${getApiBaseUrl()}/api/uploads/driver-report`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      uid,
      category: reportInput.category,
      issueType: reportInput.issueType,
      description: reportInput.description,
      imageDataUrls: reportInput.imageUris,
    }),
  });

  const responseBody = await response.json().catch(() => null);

  if (!response.ok || !responseBody?.success) {
    throw new Error(getApiErrorMessage(responseBody, 'Failed to submit report'));
  }

  return responseBody.reportId as string;
};

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

  if (
    normalized === 'suspend' ||
    normalized === 'suspended' ||
    normalized === 'blocked' ||
    normalized === 'block'
  ) {
    return 'suspended';
  }

  return null;
};

export const updateDriverProfilePhoto = async (
  uid: string,
  localImageUri: string,
  idToken?: string | null
): Promise<string> => {
  if (!uid) {
    throw new Error('Firebase UID is required');
  }

  if (localImageUri.startsWith('data:image') && idToken) {
    return uploadProfilePhotoViaBackend(uid, localImageUri, idToken);
  }

  if (Platform.OS === 'web') {
    if (!idToken) {
      throw new Error('Firebase ID token is required to update profile photo on web');
    }

    const profilePhotoDataUrl = await resizeWebImageToDataUrl(localImageUri);
    const profilePhotoUrl = await uploadDriverStorageAsset(
      uid,
      profilePhotoDataUrl,
      'profile',
      'profile-photo'
    );
    await updateDriverProfilePhotoViaRest(uid, profilePhotoUrl, idToken);
    return profilePhotoUrl;
  }

  const profilePhotoUrl = await uploadDriverStorageAsset(
    uid,
    localImageUri,
    'profile',
    'profile-photo'
  );

  if (auth.currentUser?.uid === uid) {
    await setDoc(
      doc(db, 'drivers', uid),
      {
        profilePhotoUrl,
        updatedAt: Timestamp.now(),
      },
      { merge: true }
    );
  } else if (idToken) {
    await updateDriverProfilePhotoViaRest(uid, profilePhotoUrl, idToken);
  } else {
    throw new Error('Firebase user is not signed in and no ID token was provided');
  }

  return profilePhotoUrl;
};

const uploadReportImage = async (
  uid: string,
  localImageUri: string,
  reportSeed: number,
  index: number
) => {
  if (Platform.OS === 'web') {
    const imageDataUrl = localImageUri.startsWith('data:image')
      ? localImageUri
      : await resizeWebImageToDataUrl(localImageUri, 720, 0.76);

    return uploadDriverStorageAsset(
      uid,
      imageDataUrl,
      'reports',
      `${reportSeed}-${index + 1}`
    );
  }

  return uploadDriverStorageAsset(
    uid,
    localImageUri,
    'reports',
    `${reportSeed}-${index + 1}`
  );
};

const storeDriverReportViaRest = async (
  reportData: Record<string, any>,
  idToken: string
) => {
  const projectId = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID;

  if (!projectId) {
    throw new Error('Firebase project ID is not configured');
  }

  const fields = Object.entries(reportData).reduce<Record<string, any>>((acc, [key, value]) => {
    const converted = toFirestoreRestValue(value);
    if (converted !== undefined) {
      acc[key] = converted;
    }
    return acc;
  }, {});

  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/driverReports`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${idToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fields }),
    }
  );

  const responseBody = await response.json().catch(() => null);

  if (!response.ok) {
    console.error('Firestore REST report write failed:', responseBody);
    throw new Error(responseBody?.error?.message || 'Failed to submit report');
  }

  return responseBody?.name?.split('/').pop();
};

export const submitDriverReport = async (
  uid: string,
  reportInput: DriverReportData,
  idToken?: string | null
): Promise<{ success: boolean; reportId?: string; error?: string }> => {
  try {
    if (!uid) {
      throw new Error('Firebase UID is required');
    }

    if (idToken) {
      const reportId = await submitDriverReportViaBackend(uid, reportInput, idToken);
      return { success: true, reportId };
    }

    const reportSeed = Date.now();
    const imageUrls = await Promise.all(
      reportInput.imageUris.map((imageUri, index) =>
        uploadReportImage(uid, imageUri, reportSeed, index)
      )
    );

    const now = Timestamp.now();
    const reportData = {
      uid,
      category: reportInput.category,
      issueType: reportInput.issueType,
      description: reportInput.description,
      imageUrls,
      imageCount: imageUrls.length,
      status: 'submitted',
      createdAt: now,
      updatedAt: now,
    };

    if (auth.currentUser?.uid === uid) {
      const reportRef = await addDoc(collection(db, 'driverReports'), reportData);
      return { success: true, reportId: reportRef.id };
    }

    if (idToken) {
      const reportId = await storeDriverReportViaRest(reportData, idToken);
      return { success: true, reportId };
    }

    throw new Error('Firebase user is not signed in and no ID token was provided');
  } catch (error: any) {
    console.error('Error submitting driver report:', error);
    return {
      success: false,
      error: error.message || 'Failed to submit report',
    };
  }
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

const updateDriverProfilePhotoViaRest = async (
  uid: string,
  profilePhotoUrl: string,
  idToken: string
) => {
  const projectId = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID;

  if (!projectId) {
    throw new Error('Firebase project ID is not configured');
  }

  const fields = {
    profilePhotoUrl: toFirestoreRestValue(profilePhotoUrl),
    updatedAt: toFirestoreRestValue(Timestamp.now()),
  };

  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/drivers/${encodeURIComponent(uid)}?updateMask.fieldPaths=profilePhotoUrl&updateMask.fieldPaths=updatedAt`,
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
    console.error('Firestore REST profile photo update failed:', responseBody);
    throw new Error(responseBody?.error?.message || 'Failed to update profile photo');
  }
};

const createDriverAvailabilityLogViaRest = async (
  uid: string,
  status: DriverAvailabilityStatus,
  idToken: string
) => {
  const projectId = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID;

  if (!projectId) {
    throw new Error('Firebase project ID is not configured');
  }

  const now = Timestamp.now();
  const logId = `${uid}_${now.toMillis()}_${status}`;
  const fields = {
    uid: toFirestoreRestValue(uid),
    status: toFirestoreRestValue(status),
    changedAt: toFirestoreRestValue(now),
    createdAt: toFirestoreRestValue(now),
  };

  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/driverAvailabilityLogs?documentId=${encodeURIComponent(logId)}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${idToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fields }),
    }
  );

  const responseBody = await response.json().catch(() => null);

  if (!response.ok) {
    console.error('Firestore REST availability log create failed:', responseBody);
    throw new Error(responseBody?.error?.message || 'Failed to create driver availability log');
  }
};

const setDriverAvailabilityStateViaRest = async (
  uid: string,
  status: DriverAvailabilityStatus,
  idToken: string,
  changedAt: Timestamp
) => {
  const projectId = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID;

  if (!projectId) {
    throw new Error('Firebase project ID is not configured');
  }

  const fields = {
    uid: toFirestoreRestValue(uid),
    status: toFirestoreRestValue(status),
    changedAt: toFirestoreRestValue(changedAt),
    updatedAt: toFirestoreRestValue(Timestamp.now()),
  };

  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/driverAvailabilityStates/${encodeURIComponent(uid)}`,
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
    console.error('Firestore REST availability state update failed:', responseBody);
    throw new Error(responseBody?.error?.message || 'Failed to update driver availability state');
  }
};

const getDriverAvailabilityStateViaRest = async (
  uid: string,
  idToken: string
): Promise<DriverAvailabilityState | null> => {
  const projectId = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID;

  if (!projectId) {
    throw new Error('Firebase project ID is not configured');
  }

  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/driverAvailabilityStates/${encodeURIComponent(uid)}`,
    {
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
    }
  );

  if (response.status === 404 || response.status === 403) {
    if (response.status === 403) {
      console.warn('Driver availability state read is blocked by Firestore rules.');
    }
    return null;
  }

  const responseBody = await response.json().catch(() => null);

  if (!response.ok) {
    console.error('Firestore REST availability state read failed:', responseBody);
    throw new Error(responseBody?.error?.message || 'Failed to fetch driver availability');
  }

  const data = fromFirestoreRestFields(responseBody.fields || {});
  return data.status === 'online' || data.status === 'offline'
    ? { status: data.status, changedAt: data.changedAt || null }
    : null;
};

const resizeWebImageToDataUrl = async (
  imageUri: string,
  size = 256,
  quality = 0.82
): Promise<string> => {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error('Web image resizing is only available in a browser');
  }

  const image = new window.Image();

  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('Failed to load selected image'));
    image.src = imageUri;
  });

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;

  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Unable to prepare selected image');
  }

  const sourceSize = Math.min(image.width, image.height);
  const sourceX = (image.width - sourceSize) / 2;
  const sourceY = (image.height - sourceSize) / 2;

  context.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, size, size);

  return canvas.toDataURL('image/jpeg', quality);
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

const uploadOnboardingAssets = async (
  uid: string,
  onboardingData: Omit<OnboardingData, 'createdAt' | 'updatedAt' | 'submittedAt'>,
  idToken?: string
): Promise<Omit<OnboardingData, 'createdAt' | 'updatedAt' | 'submittedAt'>> => {
  const vehiclePhotoUris = onboardingData.vehiclePhotoUris || [];

  if (idToken) {
    const assets: OnboardingUploadAsset[] = [
      { type: 'photoUri', uri: onboardingData.photoUri },
      { type: 'drivingLicenseUri', uri: onboardingData.drivingLicenseUri },
      { type: 'identityProofUri', uri: onboardingData.identityProofUri },
      { type: 'rcBookUri', uri: onboardingData.rcBookUri },
      { type: 'insuranceUri', uri: onboardingData.insuranceUri },
      ...vehiclePhotoUris.map((uri, index) => ({
        type: 'vehiclePhotoUris',
        uri,
        index,
      })),
    ].filter((asset) => asset.uri && !isRemoteUrl(asset.uri));

    if (assets.length > 0) {
      const uploadedAssets = await uploadOnboardingAssetsViaBackend(uid, assets, idToken);
      const nextData = {
        ...onboardingData,
        vehiclePhotoUris: [...vehiclePhotoUris],
      };

      uploadedAssets.forEach((asset) => {
        if (!asset.url) {
          return;
        }

        if (asset.type === 'vehiclePhotoUris' && typeof asset.index === 'number') {
          nextData.vehiclePhotoUris[asset.index] = asset.url;
          return;
        }

        if (asset.type in nextData) {
          (nextData as Record<string, any>)[asset.type] = asset.url;
        }
      });

      return {
        ...nextData,
        profilePhotoUrl: nextData.profilePhotoUrl || nextData.photoUri,
      };
    }
  }

  const [
    photoUri,
    drivingLicenseUri,
    identityProofUri,
    rcBookUri,
    insuranceUri,
    uploadedVehiclePhotoUris,
  ] = await Promise.all([
    uploadDriverStorageAsset(uid, onboardingData.photoUri, 'onboarding', 'driver-photo'),
    uploadDriverStorageAsset(uid, onboardingData.drivingLicenseUri, 'onboarding', 'driving-license'),
    uploadDriverStorageAsset(uid, onboardingData.identityProofUri, 'onboarding', 'identity-proof'),
    uploadDriverStorageAsset(uid, onboardingData.rcBookUri, 'onboarding', 'rc-book'),
    uploadDriverStorageAsset(uid, onboardingData.insuranceUri, 'onboarding', 'insurance'),
    Promise.all(
      vehiclePhotoUris.map((uri, index) =>
        uploadDriverStorageAsset(
          uid,
          uri,
          'onboarding/vehicle-photos',
          `vehicle-photo-${index + 1}`
        )
      )
    ),
  ]);

  return {
    ...onboardingData,
    photoUri,
    profilePhotoUrl: onboardingData.profilePhotoUrl || photoUri,
    drivingLicenseUri,
    identityProofUri,
    rcBookUri,
    insuranceUri,
    vehiclePhotoUris: uploadedVehiclePhotoUris,
  };
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

    const uploadedOnboardingData = await uploadOnboardingAssets(uid, onboardingData, idToken);

    const dataToStore: OnboardingData = {
      ...uploadedOnboardingData,
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
export const getDriverProfile = async (uidOrPhone: string, idToken?: string | null) => {
  try {
    if (idToken && auth.currentUser?.uid !== uidOrPhone) {
      const data = isPhoneIdentifier(uidOrPhone)
        ? await getDriverByPhoneViaRest(uidOrPhone, idToken)
        : await getDriverByUidViaRest(uidOrPhone, idToken);

      return data;
    }

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

export const updateDriverAvailability = async (
  uid: string,
  status: DriverAvailabilityStatus,
  idToken?: string | null
) => {
  try {
    if (!uid) {
      throw new Error('Firebase UID is required');
    }

    const now = Timestamp.now();
    const logId = `${uid}_${now.toMillis()}_${status}`;
    const availabilityLog = {
      uid,
      status,
      changedAt: now,
      createdAt: now,
    };

    if (auth.currentUser?.uid === uid) {
      await setDoc(
        doc(db, 'driverAvailabilityLogs', logId),
        availabilityLog
      );
      await setDoc(doc(db, 'driverAvailabilityStates', uid), {
        uid,
        status,
        changedAt: now,
        updatedAt: now,
      });
      return { success: true };
    }

    if (idToken) {
      await createDriverAvailabilityLogViaRest(uid, status, idToken);
      await setDriverAvailabilityStateViaRest(uid, status, idToken, now);
      return { success: true };
    }

    throw new Error('Firebase user is not signed in and no ID token was provided');
  } catch (error: any) {
    console.error('Error updating driver availability:', error);
    return {
      success: false,
      error: error.message || 'Failed to update driver availability',
    };
  }
};

export const getLatestDriverAvailability = async (
  uid: string,
  idToken?: string | null
): Promise<DriverAvailabilityState | null> => {
  try {
    if (!uid) {
      return null;
    }

    if (auth.currentUser?.uid === uid) {
      const docSnap = await getDoc(doc(db, 'driverAvailabilityStates', uid));
      const latest = docSnap.exists() ? docSnap.data() : null;
      return latest?.status === 'online' || latest?.status === 'offline'
        ? { status: latest.status, changedAt: latest.changedAt || null }
        : null;
    }

    if (idToken) {
      return getDriverAvailabilityStateViaRest(uid, idToken);
    }

    return null;
  } catch (error) {
    console.error('Error fetching latest driver availability:', error);
    return null;
  }
};

/**
 * Update verification status (Admin function)
 * Can update using either UID or phone number
 */
export const updateVerificationStatus = async (
  uidOrPhone: string,
  status: 'pending' | 'verified' | 'rejected' | 'suspended',
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
