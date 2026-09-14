import AsyncStorage from '@react-native-async-storage/async-storage';

import { auth } from './firebase';

/**
 * Session helpers.
 *
 * Keeps the driver logged in by:
 * 1. Force-refreshing the Firebase ID token whenever a valid Firebase session
 *    exists (Firebase ID tokens expire after 1 hour — the token saved to
 *    AsyncStorage at login goes stale otherwise).
 * 2. Detecting a stale/unrecoverable token (no Firebase session AND an expired
 *    stored token) so screens can show a graceful "Session expired" message
 *    and return the driver to the login screen instead of failing silently.
 */

type JwtPayload = { exp?: number };

const base64UrlToUtf8 = (base64Url: string): string => {
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  // Use global atob when available (Hermes/RN), otherwise a plain decode
  // via unescape + btoa-compatible string handling. No Node Buffer required.
  if (typeof global.atob === 'function') {
    return global.atob(base64);
  }
  const bin = atobPolyfill(base64);
  const bytes = Uint8Array.from(bin, (char) => char.charCodeAt(0));
  let utf8 = '';
  for (const byte of bytes) {
    utf8 += String.fromCharCode(byte);
  }
  return decodeURIComponent(escape(utf8));
};

const atobPolyfill = (base64: string): string => {
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let output = '';
  let buffer = 0;
  let bits = 0;
  for (const char of base64) {
    if (char === '=') break;
    const index = chars.indexOf(char);
    if (index < 0) continue;
    buffer = (buffer << 6) | index;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      output += String.fromCharCode((buffer >> bits) & 0xff);
    }
  }
  return output;
};

const decodeJwtPayload = (token: string): JwtPayload | null => {
  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) return null;
    return JSON.parse(base64UrlToUtf8(base64Url)) as JwtPayload;
  } catch {
    return null;
  }
};

/** Returns true when the token is missing or its `exp` has passed. */
export const isIdTokenExpired = (token?: string | null): boolean => {
  if (!token) return true;
  const payload = decodeJwtPayload(token);
  if (!payload?.exp) return false; // Not a JWT we can inspect — assume usable.
  return Date.now() / 1000 >= payload.exp;
};

export type SessionContext = {
  uid: string | null;
  idToken: string | null;
  /**
   * True when the session cannot be recovered: there is no live Firebase
   * session and the stored token is expired/missing. Callers should show a
   * "Session expired" message and send the driver back to the login screen.
   */
  sessionExpired: boolean;
};

/**
 * Error codes that mean the Firebase session itself is no longer valid
 * (revoked/expired server-side) — a clearly defined security reason to end
 * the session. Anything else (e.g. auth/network-request-failed) is transient
 * and must NOT log the driver out.
 */
const FATAL_TOKEN_REFRESH_CODES = new Set([
  'auth/user-token-expired',
  'auth/user-disabled',
  'auth/user-not-found',
  'auth/invalid-user-token',
  'auth/invalid-credential',
]);

let authStateReadyPromise: Promise<void> | null = null;

/**
 * Resolves (once) when Firebase has finished restoring the persisted auth
 * state. On a cold start `auth.currentUser` is null until the persisted
 * session is read back from AsyncStorage — judging the session before that
 * point incorrectly reports it as expired and logs the driver out.
 */
const ensureAuthStateReady = (): Promise<void> => {
  if (!authStateReadyPromise) {
    authStateReadyPromise = Promise.resolve(auth.authStateReady()).catch(
      (error) => {
        console.warn('Firebase auth state restore failed:', error);
      },
    );
  }
  return authStateReadyPromise;
};

/**
 * Resolve the current auth context, force-refreshing the Firebase ID token
 * when possible. Falls back to the AsyncStorage values when Firebase has no
 * live session (e.g. right after a cold start while auth state is restoring).
 */
export const refreshSession = async (): Promise<SessionContext> => {
  // 0. Give Firebase a chance to restore the persisted session before
  //    judging it (prevents the cold-start auto-logout race).
  await ensureAuthStateReady();

  const [storedUid, storedIdToken] = await Promise.all([
    AsyncStorage.getItem('firebaseUid'),
    AsyncStorage.getItem('firebaseIdToken'),
  ]);

  const currentUser = auth.currentUser;
  const uid = currentUser?.uid || storedUid || null;

  // 1. Prefer a live Firebase session — force-refresh so the token is always
  //    valid even if the cached one is past its 1-hour lifetime.
  if (currentUser) {
    try {
      const idToken = await currentUser.getIdToken(true);
      await AsyncStorage.multiSet([
        ['firebaseUid', currentUser.uid],
        ['firebaseIdToken', idToken],
      ]);
      return { uid, idToken, sessionExpired: false };
    } catch (error: any) {
      const code = typeof error?.code === 'string' ? error.code : '';
      if (FATAL_TOKEN_REFRESH_CODES.has(code)) {
        // The session was revoked/expired server-side — a clearly defined
        // security reason to end it. Sign out so the persisted state is
        // cleared as well.
        console.warn('Firebase session is no longer valid:', code);
        await auth.signOut().catch(() => undefined);
        return { uid, idToken: null, sessionExpired: true };
      }

      // Transient failure (e.g. a momentary network drop) must not log the
      // driver out — keep the session alive with the stored token and let a
      // later call refresh it.
      console.warn('Could not force-refresh Firebase ID token:', error);
      return { uid, idToken: storedIdToken, sessionExpired: false };
    }
  }

  // 2. No live session at all — fall back to the stored token.
  const idToken = storedIdToken;

  // 3. No live session and the stored token is expired/missing → the session
  //    is unrecoverable and the driver must log in again.
  const sessionExpired = isIdTokenExpired(idToken);
  return { uid, idToken, sessionExpired };
};
