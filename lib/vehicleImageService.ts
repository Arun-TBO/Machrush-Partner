import { getDownloadURL, ref } from 'firebase/storage';
import { storage } from './firebase';

/**
 * ✅ Firebase Storage folder where vehicle images are stored.
 * From your Firebase Console: vehicle_images/
 */
const VEHICLE_IMAGES_PATH = 'vehicle_images';

/**
 * In-memory cache to avoid repeated Firebase Storage calls
 */
const imageUrlCache = new Map<string, string>();

/**
 * Generate possible file name variations for case-insensitive matching.
 * Firebase Storage is case-sensitive, so we try multiple casing patterns.
 *
 * Example: imageKey "3wheeler" generates:
 *   - "3wheeler"      (as-is / lowercase)
 *   - "3Wheeler"      (PascalCase — capitalize first alpha after digits)
 *   - "3WHEELER"      (all uppercase)
 *
 * Then each variation is tried with extensions: (none), .png, .jpg, .jpeg, .webp
 */
function generateNameVariations(imageKey: string): string[] {
  const seen = new Set<string>();
  const add = (s: string) => { if (s && !seen.has(s)) { seen.add(s); } };

  const lower = imageKey.toLowerCase();
  const upper = imageKey.toUpperCase();

  // 1. As-is (whatever MongoDB stored)
  add(imageKey);
  // 2. All lowercase
  add(lower);
  // 3. PascalCase: capitalize first alpha after any leading digits/non-alpha chars
  //    e.g. "3wheeler" → "3Wheeler", "mini-truck" → "Mini-Truck"
  const pascalCased = lower.replace(/(^|\d+|\W+)([a-z])/g, (_, prefix, letter) =>
    prefix + letter.toUpperCase()
  );
  add(pascalCased);
  // 4. Title Case (capitalize first char only if it's a letter)
  if (/^[a-z]/i.test(imageKey)) {
    add(imageKey.charAt(0).toUpperCase() + imageKey.slice(1).toLowerCase());
  }
  // 5. All uppercase
  add(upper);

  return Array.from(seen);
}

/**
 * Try to resolve a file path in Firebase Storage with multiple extensions.
 */
async function tryResolve(pathVariations: string[]): Promise<string | null> {
  const extensions = ['', '.png', '.jpg', '.jpeg', '.webp'];

  for (const name of pathVariations) {
    for (const ext of extensions) {
      const fullPath = `${VEHICLE_IMAGES_PATH}/${name}${ext}`;
      try {
        const storageRef = ref(storage, fullPath);
        const url = await getDownloadURL(storageRef);
        return url;
      } catch {
        // Try next extension/name
        continue;
      }
    }
  }

  return null;
}

/**
 * Resolve a vehicle imageKey to a full download URL using Firebase SDK.
 *
 * The imageKey comes from MongoDB (e.g., "3wheeler") and is matched
 * against files in Firebase Storage at vehicle_images/ (e.g., "3Wheeler.png").
 *
 * Since Firebase Storage is case-sensitive but the imageKey casing may differ
 * from the file name, we automatically try multiple casing variations and
 * file extensions. Results are cached for the session.
 */
export async function getVehicleImageUrl(imageKey: string): Promise<string | null> {
  if (!imageKey) return null;

  // Check cache first (no need to re-resolve during the session)
  if (imageUrlCache.has(imageKey)) {
    return imageUrlCache.get(imageKey)!;
  }

  // Generate all possible name variations to handle case differences
  const nameVariations = generateNameVariations(imageKey);

  const url = await tryResolve(nameVariations);

  if (url) {
    imageUrlCache.set(imageKey, url);
    return url;
  }

  console.warn(`[vehicleImageService] No image found for key: ${imageKey} (tried: ${nameVariations.join(', ')})`);
  return null;
}

/**
 * Build a Firebase Storage public URL without SDK calls.
 * Faster than getVehicleImageUrl() but only works if your Firebase
 * Storage rules allow public reads.
 *
 * Useful when you know the exact file name convention.
 */
export function getPublicVehicleImageUrl(imageKey: string): string | null {
  if (!imageKey) return null;

  const bucket = process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET;
  if (!bucket) return null;

  // Assume PascalCase .png (most common convention)
  const pascalCased = imageKey.toLowerCase().replace(/(^|\d+|\W+)([a-z])/g, (_, prefix, letter) =>
    prefix + letter.toUpperCase()
  );

  return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(`${VEHICLE_IMAGES_PATH}/${pascalCased}.png`)}?alt=media`;
}
