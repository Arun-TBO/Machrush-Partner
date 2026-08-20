/**
 * Vehicle image resolution via AWS S3.
 *
 * Storage is handled by the backend (MacrushBackend) which uploads to an AWS S3
 * bucket. This app no longer reads anything from Firebase Storage.
 *
 * The vehicle image mapping below mirrors the backend's
 * config/vehicleImageMapping.js: the MongoDB `imageKey` (e.g. "3wheeler") is
 * mapped to the exact file name in S3 (e.g. "3Wheeler.png").
 */

/**
 * S3 folder where vehicle images live (matches the backend bucket layout).
 */
const VEHICLE_IMAGES_PATH = 'vehicle_images';

/**
 * Public S3 base URL.
 * Defaults to: https://{bucket}.s3.{region}.amazonaws.com
 * Override by setting EXPO_PUBLIC_S3_BASE_URL (e.g. a CloudFront distribution).
 */
const S3_PUBLIC_BASE_URL = (
  process.env.EXPO_PUBLIC_S3_BASE_URL ||
  'https://machrush-storage.s3.us-east-1.amazonaws.com'
).replace(/\/+$/, '');

/**
 * imageKey -> exact S3 file name.
 * Keep in sync with backend config/vehicleImageMapping.js.
 */
const vehicleImageMap: Record<string, string> = {
  '3wheeler':       '3Wheeler.png',
  'mini3wheeler':   'Mini3W.png',
  'pickup9ft':      'pickup.png',
  'tataace_open':   'Tataopen.png',
  'tataace_closed': 'Tata.png',
  'pickup8ft':      'pickup.png',
  '14ft':           '14ft.png',
  '17ft':           '17ft.png',
  'scooty':         'Scooter.png',
  '2wheeler':       '2Wheeler.png',
  'bike':           '2Wheeler.png', // fallback — uses 2-wheeler image
};

/**
 * In-memory cache to avoid repeated URL building.
 */
const imageUrlCache = new Map<string, string>();

const toS3Url = (fileName: string) => {
  const encoded = fileName.split('/').map(encodeURIComponent).join('/');
  return `${S3_PUBLIC_BASE_URL}/${VEHICLE_IMAGES_PATH}/${encoded}`;
};

/**
 * Resolve a vehicle imageKey to a full public S3 URL.
 *
 * @param imageKey - the MongoDB vehicleType/imageKey (e.g. "3wheeler")
 * @returns the S3 URL, or null if no mapping exists for the key
 */
export function getVehicleImageUrl(imageKey: string): string | null {
  if (!imageKey) return null;

  const key = imageKey.trim().toLowerCase();

  // Check cache first
  if (imageUrlCache.has(key)) {
    return imageUrlCache.get(key)!;
  }

  const fileName = vehicleImageMap[key];
  if (!fileName) {
    console.warn(`[vehicleImageService] No image mapping for key: ${imageKey}`);
    return null;
  }

  const url = toS3Url(fileName);
  imageUrlCache.set(key, url);
  return url;
}

/**
 * Alias kept for compatibility. Returns the public S3 URL for an imageKey.
 */
export function getPublicVehicleImageUrl(imageKey: string): string | null {
  return getVehicleImageUrl(imageKey);
}
