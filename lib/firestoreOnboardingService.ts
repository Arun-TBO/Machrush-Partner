import { Platform } from 'react-native';

/**
 * Driver onboarding / profile service — backend-only (live MacrushBackend).
 *
 * This app DOES NOT talk to Firestore or Firebase Storage anymore:
 *   - All documents (driver reports) are stored in MongoDB by the backend.
 *   - All file uploads are stored in AWS S3 by the backend.
 *   - Firebase is used for authentication only (idToken passed as Bearer).
 *
 * Endpoints used (see backend routes/):
 *   GET  /api/firestore/drivers/:id          -> driver profile (MongoDB)
 *   POST /api/firestore/drivers              -> create driver (onboarding)
 *   PUT  /api/firestore/drivers/:id          -> update driver
 *   GET  /api/drivers/by-phone/:phone        -> lookup driver by phone
 *   GET  /api/drivers/:uid/availability-state
 *   PATCH /api/drivers/:uid/availability-state
 *   POST /api/drivers/:uid/availability-logs
 *   POST /api/uploads/profile-photo          -> S3
 *   POST /api/uploads/driver-onboarding-assets -> S3
 *   POST /api/uploads/driver-report          -> S3
 */

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
  documentVerificationStatus?: string;
  verified?: boolean;
  status?: string;
  verifiedDate?: string;
  verifiedAt?: string;
  rejectionMessage?: string;
  rejectionReason?: string;
  rejectedDocuments?: string[];
  verificationNotes?: string;
  profilePhotoUrl?: string;
  activeStatus?: boolean;

  // Metadata
  createdAt?: string;
  updatedAt?: string;
  submittedAt?: string;
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
  changedAt?: string | Date | null;
};

const getApiBaseUrl = () =>
  (process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:5000').replace(/\/$/, '');

const getApiErrorMessage = (responseBody: unknown, fallback: string) => {
  if (responseBody && typeof responseBody === 'object' && 'error' in responseBody) {
    const error = (responseBody as { error?: unknown }).error;
    if (typeof error === 'string') return error;
    if (error && typeof error === 'object' && 'message' in error) {
      const message = (error as { message?: unknown }).message;
      if (typeof message === 'string') return message;
    }
  }
  return fallback;
};

const isRemoteUrl = (uri: string) => /^https?:\/\//i.test(uri);

const isPhoneIdentifier = (value: string) =>
  value.startsWith('+') || /^\d{10,15}$/.test(value);

const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('Failed to read selected file'));
    };
    reader.onerror = () => reject(new Error('Failed to read selected file'));
    reader.readAsDataURL(blob);
  });

const localUriToDataUrl = async (uri: string) => {
  if (uri.startsWith('data:')) return uri;
  const response = await fetch(uri);
  const blob = await response.blob();
  return blobToDataUrl(blob);
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
  if (!context) throw new Error('Unable to prepare selected image');

  const sourceSize = Math.min(image.width, image.height);
  const sourceX = (image.width - sourceSize) / 2;
  const sourceY = (image.height - sourceSize) / 2;

  context.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, size, size);
  return canvas.toDataURL('image/jpeg', quality);
};

// ============================================================================
// AWS S3 uploads (via the live backend)
// ============================================================================

const resolveUploadDataUrl = async (uri: string, maxWebSize = 1024, webQuality = 0.8) => {
  if (!uri) return null;
  if (uri.startsWith('data:')) return uri;
  if (Platform.OS === 'web') return resizeWebImageToDataUrl(uri, maxWebSize, webQuality);
  return localUriToDataUrl(uri);
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
      dataUrl: await resolveUploadDataUrl(asset.uri),
    }))
  );

  const response = await fetch(`${getApiBaseUrl()}/api/uploads/driver-onboarding-assets`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ uid, assets: assetsToUpload }),
  });

  const responseBody = await response.json().catch(() => null);
  if (!response.ok || !responseBody?.success) {
    throw new Error(getApiErrorMessage(responseBody, 'Failed to upload onboarding files'));
  }

  return (responseBody.assets || []) as Array<{ type: string; index?: number; url: string }>;
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
  const imageDataUrls = (
    await Promise.all(
      (reportInput.imageUris || []).map((uri) => resolveUploadDataUrl(uri, 720, 0.76))
    )
  ).filter(Boolean) as string[];

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
      imageDataUrls,
    }),
  });

  const responseBody = await response.json().catch(() => null);
  if (!response.ok || !responseBody?.success) {
    throw new Error(getApiErrorMessage(responseBody, 'Failed to submit report'));
  }

  return responseBody.reportId as string;
};

// ============================================================================
// MongoDB writes (via the live backend)
// ============================================================================

const storeDriverViaBackend = async (
  uid: string,
  data: Record<string, any>,
  idToken?: string | null
) => {
  const response = await fetch(`${getApiBaseUrl()}/api/firestore/drivers`, {
    method: 'POST',
    headers: {
      ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ uid, ...data }),
  });

  const responseBody = await response.json().catch(() => null);
  if (!response.ok || !responseBody?.success) {
    throw new Error(getApiErrorMessage(responseBody, 'Failed to store onboarding data'));
  }
  return responseBody.data;
};

const updateDriverViaBackend = async (
  uid: string,
  patch: Record<string, unknown>,
  idToken?: string | null
) => {
  const response = await fetch(`${getApiBaseUrl()}/api/firestore/drivers/${encodeURIComponent(uid)}`, {
    method: 'PUT',
    headers: {
      ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(patch),
  });

  const responseBody = await response.json().catch(() => null);
  if (!response.ok || !responseBody?.success) {
    throw new Error(getApiErrorMessage(responseBody, 'Failed to update driver'));
  }
  return responseBody.data;
};

// ============================================================================
// Driver availability (via the live backend)
// ============================================================================

const setDriverAvailabilityStateViaBackend = async (
  uid: string,
  status: DriverAvailabilityStatus,
  changedAt: string,
  idToken: string
) => {
  const response = await fetch(`${getApiBaseUrl()}/api/drivers/${encodeURIComponent(uid)}/availability-state`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status, changedAt }),
  });

  const responseBody = await response.json().catch(() => null);
  if (!response.ok || !responseBody?.success) {
    throw new Error(getApiErrorMessage(responseBody, 'Failed to update driver availability'));
  }
};

const createDriverAvailabilityLogViaBackend = async (
  uid: string,
  status: DriverAvailabilityStatus,
  changedAt: string,
  idToken: string
) => {
  const response = await fetch(`${getApiBaseUrl()}/api/drivers/${encodeURIComponent(uid)}/availability-logs`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status, changedAt }),
  });

  const responseBody = await response.json().catch(() => null);
  if (!response.ok || !responseBody?.success) {
    throw new Error(getApiErrorMessage(responseBody, 'Failed to create driver availability log'));
  }
};

const getDriverAvailabilityStateViaBackend = async (
  uid: string,
  idToken: string
): Promise<DriverAvailabilityState | null> => {
  const response = await fetch(`${getApiBaseUrl()}/api/drivers/${encodeURIComponent(uid)}/availability-state`, {
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });

  const responseBody = await response.json().catch(() => null);
  if (!response.ok || !responseBody?.success || !responseBody?.data) return null;

  const state = responseBody.data;
  if (state?.status === 'online' || state?.status === 'offline') {
    return { status: state.status, changedAt: state.changedAt || null };
  }
  return null;
};

// ============================================================================
// Verification status resolution
// ============================================================================

const normalizeVerificationStatus = (status: unknown): VerificationStatus | null => {
  if (typeof status !== 'string') return null;
  const normalized = status.trim().toLowerCase();

  if (normalized === 'verified' || normalized === 'approved') return 'verified';
  if (
    normalized === 'pending' ||
    normalized === 'waiting' ||
    normalized === 'waiting for verification' ||
    normalized === 'waiting for approval'
  ) {
    return 'pending';
  }
  if (normalized === 'rejected') return 'rejected';
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

/**
 * Resolve a driver's verification status from a raw driver document.
 * Mirrors the backend admin logic across the multiple fields it writes.
 * Suspension always wins.
 */
export const resolveDriverVerificationStatus = (
  data: Record<string, any> | null | undefined
): VerificationStatus | null => {
  if (!data) return null;

  const vStatus = normalizeVerificationStatus(data.verificationStatus);
  const dStatus = normalizeVerificationStatus(data.documentVerificationStatus);
  const statusField = normalizeVerificationStatus(data.status);

  if (
    vStatus === 'suspended' ||
    dStatus === 'suspended' ||
    statusField === 'suspended'
  ) {
    return 'suspended';
  }

  if (
    vStatus === 'verified' ||
    dStatus === 'verified' ||
    statusField === 'verified' ||
    data.verified === true
  ) {
    return 'verified';
  }

  if (
    vStatus === 'rejected' ||
    dStatus === 'rejected' ||
    statusField === 'rejected'
  ) {
    return 'rejected';
  }

  if (
    vStatus === 'pending' ||
    dStatus === 'pending' ||
    statusField === 'pending'
  ) {
    return 'pending';
  }

  if (data.submittedAt || data.createdAt) return 'pending';
  return null;
};

// ============================================================================
// Onboarding uploads (assets -> S3 via backend)
// ============================================================================

const uploadOnboardingAssets = async (
  uid: string,
  onboardingData: Omit<OnboardingData, 'createdAt' | 'updatedAt' | 'submittedAt'>,
  idToken?: string
): Promise<Omit<OnboardingData, 'createdAt' | 'updatedAt' | 'submittedAt'>> => {
  const vehiclePhotoUris = onboardingData.vehiclePhotoUris || [];

  const assets: OnboardingUploadAsset[] = [
    { type: 'photoUri', uri: onboardingData.photoUri },
    { type: 'drivingLicenseUri', uri: onboardingData.drivingLicenseUri },
    { type: 'identityProofUri', uri: onboardingData.identityProofUri },
    { type: 'rcBookUri', uri: onboardingData.rcBookUri },
    { type: 'insuranceUri', uri: onboardingData.insuranceUri },
    ...vehiclePhotoUris.map((uri, index) => ({ type: 'vehiclePhotoUris', uri, index })),
  ].filter((asset) => asset.uri && !isRemoteUrl(asset.uri));

  if (assets.length === 0) {
    return {
      ...onboardingData,
      profilePhotoUrl: onboardingData.profilePhotoUrl || onboardingData.photoUri,
    };
  }

  if (!idToken) {
    throw new Error('Firebase ID token is required to upload onboarding files');
  }

  const uploadedAssets = await uploadOnboardingAssetsViaBackend(uid, assets, idToken);
  const nextData = {
    ...onboardingData,
    vehiclePhotoUris: [...vehiclePhotoUris],
  };

  uploadedAssets.forEach((asset) => {
    if (!asset.url) return;
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
};

// ============================================================================
// Public API
// ============================================================================

export const updateDriverProfilePhoto = async (
  uid: string,
  localImageUri: string,
  idToken?: string | null
): Promise<string> => {
  if (!uid) throw new Error('Firebase UID is required');
  if (!localImageUri) throw new Error('Missing image');
  if (isRemoteUrl(localImageUri)) return localImageUri;
  if (!idToken) throw new Error('Firebase ID token is required to update profile photo');

  const imageData = await resolveUploadDataUrl(localImageUri, 1024, 0.82);
  if (!imageData) {
    throw new Error('Failed to convert selected image to a data URL');
  }

  // The backend uploads to S3 and updates the driver's profilePhotoUrl in MongoDB.
  return uploadProfilePhotoViaBackend(uid, imageData, idToken);
};

export const submitDriverReport = async (
  uid: string,
  reportInput: DriverReportData,
  idToken?: string | null
): Promise<{ success: boolean; reportId?: string; error?: string }> => {
  try {
    if (!uid) throw new Error('Firebase UID is required');
    if (!idToken) throw new Error('Firebase ID token is required to submit a report');

    const reportId = await submitDriverReportViaBackend(uid, reportInput, idToken);
    return { success: true, reportId };
  } catch (error: any) {
    console.error('❌ Error submitting report:', error);
    return { success: false, error: error.message || 'Failed to submit report' };
  }
};

/**
 * Store complete onboarding data to MongoDB via the backend.
 */
export const storeOnboardingData = async (
  uid: string,
  phoneNumber: string,
  onboardingData: Omit<OnboardingData, 'createdAt' | 'updatedAt' | 'submittedAt'>,
  idToken?: string
): Promise<{ success: boolean; driverId?: string; error?: string }> => {
  try {
    if (!uid) throw new Error('Firebase UID is required');

    // SAFEGUARD: never clobber an existing terminal verification decision.
    try {
      const existing = await getDriverProfile(uid, idToken);
      const existingStatus = resolveDriverVerificationStatus(existing);
      if (existingStatus === 'verified' || existingStatus === 'suspended') {
        console.warn(
          `Driver ${uid} is already ${existingStatus}; skipping onboarding overwrite to preserve verification state.`
        );
        return { success: true, driverId: uid };
      }
    } catch (preCheckError) {
      console.warn('Could not pre-check existing verification status:', preCheckError);
    }

    if (!idToken) {
      throw new Error('Firebase ID token is required to store onboarding data');
    }

    const uploadedOnboardingData = await uploadOnboardingAssets(uid, onboardingData, idToken);

    const now = new Date().toISOString();
    const dataToStore: OnboardingData = {
      ...uploadedOnboardingData,
      phoneNumber,
      activeStatus: false,
      verificationStatus: uploadedOnboardingData.verificationStatus || 'pending',
      createdAt: now,
      updatedAt: now,
      submittedAt: now,
    };

    console.log(`📝 Storing onboarding data to MongoDB via backend for UID: ${uid}`);
    await storeDriverViaBackend(uid, dataToStore, idToken);
    console.log('✅ Onboarding data stored successfully');

    return { success: true, driverId: uid };
  } catch (error: any) {
    console.error('❌ Error storing onboarding data:', error);
    return {
      success: false,
      error: error.message || 'Failed to store data',
    };
  }
};

/**
 * Fetch verification status for a driver (by UID or phone number).
 */
export const getVerificationStatus = async (uidOrPhone: string, idToken?: string) => {
  try {
    const profile = await getDriverProfile(uidOrPhone, idToken);

    if (!profile) {
      console.warn(`No verification status found for: ${uidOrPhone}`);
      return null;
    }

    const status = resolveDriverVerificationStatus(profile);
    if (!status) {
      console.warn(`Unknown verification status for ${uidOrPhone}:`, {
        verificationStatus: profile.verificationStatus,
        documentVerificationStatus: profile.documentVerificationStatus,
        status: profile.status,
        verified: profile.verified,
      });
      return null;
    }

    return {
      status,
      rejectionMessage: profile.rejectionMessage,
      rejectionReason: profile.rejectionReason,
      rejectedDocuments: profile.rejectedDocuments,
      verificationNotes: profile.verificationNotes,
    };
  } catch (error) {
    console.error('Error fetching verification status:', error);
    return null;
  }
};

/**
 * Fetch a complete driver profile (by UID or phone number) from MongoDB.
 */
export const getDriverProfile = async (
  uidOrPhone: string,
  idToken?: string | null
): Promise<OnboardingData | null> => {
  try {
    const apiBase = getApiBaseUrl();
    const headers: Record<string, string> = {};
    if (idToken) headers['Authorization'] = `Bearer ${idToken}`;

    const url = isPhoneIdentifier(uidOrPhone)
      ? `${apiBase}/api/drivers/by-phone/${encodeURIComponent(uidOrPhone)}`
      : `${apiBase}/api/firestore/drivers/${encodeURIComponent(uidOrPhone)}`;

    const response = await fetch(url, { headers, cache: 'no-cache' });
    if (response.ok) {
      const body = await response.json().catch(() => null);
      if (body?.success && body.data) {
        return body.data as OnboardingData;
      }
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
): Promise<{ success: boolean; error?: string }> => {
  try {
    if (!uid) throw new Error('Firebase UID is required');
    if (!idToken) throw new Error('Firebase ID token is required to update availability');

    const activeStatus = status === 'online';
    const changedAt = new Date().toISOString();

    await createDriverAvailabilityLogViaBackend(uid, status, changedAt, idToken);
    await setDriverAvailabilityStateViaBackend(uid, status, changedAt, idToken);
    await updateDriverViaBackend(uid, { activeStatus, updatedAt: new Date().toISOString() }, idToken);

    return { success: true };
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
    if (!uid) return null;

    const state = idToken
      ? await getDriverAvailabilityStateViaBackend(uid, idToken)
      : null;

    if (state?.status === 'online' || state?.status === 'offline') return state;

    // Fallback: derive from the driver's activeStatus in MongoDB.
    const profile = await getDriverProfile(uid, idToken);
    if (profile && typeof profile.activeStatus === 'boolean') {
      return {
        status: profile.activeStatus ? 'online' : 'offline',
        changedAt: profile.updatedAt || null,
      };
    }

    return null;
  } catch (error) {
    console.error('Error fetching latest driver availability:', error);
    return null;
  }
};
