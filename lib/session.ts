import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import { auth } from './firebase';

declare const require: any;

/**
 * Native Firebase Auth singleton (@react-native-firebase/auth). The
 * production driver build signs in through this instance (see
 * lib/firebaseAuthService.ts), so its `currentUser` is the REAL logged-in
 * session — and it is restored automatically from the OS on cold start.
 */
let nativeAuthInstance: any = null;
const getNativeAuth = (): any => {
  if (Platform.OS === 'web') return null;
  if (nativeAuthInstance !== null) return nativeAuthInstance;
  try {
    const nativeAuthPackage = require('@react-native-firebase/auth');
    if (nativeAuthPackage.getAuth) {
      nativeAuthInstance = nativeAuthPackage.getAuth();
    } else {
      const authFactory = nativeAuthPackage.default || nativeAuthPackage;
      nativeAuthInstance =
        typeof authFactory === 'function' ? authFactory() : authFactory;
    }
  } catch {
    nativeAuthInstance = null;
  }
  return nativeAuthInstance;
};

/**
 * Read the long-lived refresh token out of a Firebase user object.
 * RNFB and the JS SDK both expose it via `toJSON().stsTokenManager`.
 */
const readRefreshToken = (user: any): string => {
  try {
    if (!user) return '';
    if (typeof user.refreshToken === 'string' && user.refreshToken) {
      return user.refreshToken;
    }
    if (typeof user.toJSON === 'function') {
      const json = user.toJSON();
      const rt = json?.stsTokenManager?.refreshToken;
      if (typeof rt === 'string' && rt) return rt;
    }
  } catch {
    // ignore
  }
  return '';
};

const getApiKey = (): string | undefined =>
  process.env.EXPO_PUBLIC_FIREBASE_API_KEY as string | undefined;

/**
 * Mint a brand-new 1-hour ID token from a long-lived Firebase refresh token
 * using the official securetoken REST endpoint. Refresh tokens do NOT expire,
 * so this lets a driver reopen the app weeks later and stay logged in even if
 * every in-memory SDK session was lost.
 */
const refreshIdTokenViaREST = async (refreshToken: string): Promise<string> => {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('Firebase API key not configured');

  const response = await fetch(
    `https://securetoken.googleapis.com/v1/token?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    }
  );
  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data.id_token) {
    const code = String(data?.error?.message || 'refresh-token/invalid');
    const error: any = new Error(`Token refresh failed: ${code}`);
    error.code = code;
    throw error;
  }

  return data.id_token;
};

const persistSession = async (
  uid: string,
  idToken: string,
  refreshToken?: string | null
): Promise<void> => {
  const entries: [string, string][] = [
    ['firebaseUid', uid],
    ['firebaseIdToken', idToken],
  ];
  if (refreshToken) entries.push(['firebaseRefreshToken', refreshToken]);
  await AsyncStorage.multiSet(entries);
};

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

  const [storedUid, storedIdToken, storedRefreshToken] = await Promise.all([
    AsyncStorage.getItem('firebaseUid'),
    AsyncStorage.getItem('firebaseIdToken'),
    AsyncStorage.getItem('firebaseRefreshToken'),
  ]);

  // 1. Prefer a LIVE Firebase session — from EITHER auth instance.
  //    The production driver build signs in via @react-native-firebase/auth
  //    (native) and the native instance restores its user on cold start. The
  //    JS SDK `auth` only ever has a user in Expo-Go/dev flows, so checking
  //    only it was the cause of the "asked to log in again" bug: after a
  //    native login the JS SDK reported null, the guard fell back to the
  //    stored ID token, and once that expired (1 hour) nothing refreshed it.
  const jsUser = auth.currentUser;
  const nativeAuth = getNativeAuth();
  const nativeUser = nativeAuth?.currentUser ?? null;
  const liveUser = jsUser ?? nativeUser;
  const uid = liveUser?.uid || storedUid || null;

  if (liveUser) {
    try {
      const idToken = await liveUser.getIdToken(true);
      const refreshToken =
        readRefreshToken(liveUser) || storedRefreshToken || undefined;
      await persistSession(liveUser.uid, idToken, refreshToken);
      return { uid: liveUser.uid, idToken, sessionExpired: false };
    } catch (error: any) {
      const code = typeof error?.code === 'string' ? error.code : '';
      if (FATAL_TOKEN_REFRESH_CODES.has(code)) {
        // The session was revoked/expired server-side — a clearly defined
        // security reason to end it. Sign out so the persisted state is
        // cleared as well.
        console.warn('Firebase session is no longer valid:', code);
        await auth.signOut().catch(() => undefined);
        await nativeAuth?.signOut().catch(() => undefined);
        return { uid, idToken: null, sessionExpired: true };
      }

      // Transient failure (e.g. a momentary network drop) must not log the
      // driver out — keep the session alive with the stored token and let a
      // later call refresh it.
      console.warn('Could not force-refresh Firebase ID token:', error);
      return { uid: liveUser.uid, idToken: storedIdToken, sessionExpired: false };
    }
  }

  // 2. No live session in either instance — but a persisted refresh token can
  //    still mint a fresh ID token (refresh tokens don't expire). This is the
  //    safety net that keeps drivers logged in across restarts even when the
  //    OS cleared every SDK session.
  if (storedRefreshToken) {
    try {
      const idToken = await refreshIdTokenViaREST(storedRefreshToken);
      await persistSession(storedUid || '', idToken, storedRefreshToken);
      return { uid: storedUid || null, idToken, sessionExpired: false };
    } catch (error: any) {
      const code = typeof error?.code === 'string' ? error.code : '';
      if (code) {
        // Server rejected the refresh token — genuinely expired/revoked.
        console.warn('Stored refresh token rejected:', code);
        return { uid: storedUid || null, idToken: null, sessionExpired: true };
      }
      // Network failure — keep the session alive; a later call retries.
      console.warn('Could not refresh token over network:', error);
      return { uid: storedUid || null, idToken: storedIdToken, sessionExpired: false };
    }
  }

  // 3. No live session and no refresh token left — fall back to the stored
  //    ID token and only declare the session expired if it truly is.
  const idToken = storedIdToken;
  const sessionExpired = isIdTokenExpired(idToken);
  return { uid, idToken, sessionExpired };
};
