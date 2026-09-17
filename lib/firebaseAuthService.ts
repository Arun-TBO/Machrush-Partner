import nativeAuth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

export type VerifiedAuthSession = {
  idToken: string;
  phoneNumber: string | null;
  refreshToken?: string;
  uid: string;
};

let nativeConfirmationResult: FirebaseAuthTypes.ConfirmationResult | null = null;
let currentPhoneNumber: string | null = null;
let verifiedAuthSession: VerifiedAuthSession | null = null;

const SESSION_KEY = 'machrush.verifiedAuthSession';

const persistVerifiedAuthSession = async (session: VerifiedAuthSession) => {
  verifiedAuthSession = session;
  try {
    await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // ignore
  }
};

const readUserRefreshToken = (user: any): string => {
  try {
    if (!user) return '';
    if (typeof user.refreshToken === 'string' && user.refreshToken) {
      return user.refreshToken;
    }
  } catch {
    // fall through
  }
  try {
    if (user && typeof user.toJSON === 'function') {
      const json = user.toJSON();
      const rt = json?.stsTokenManager?.refreshToken;
      if (typeof rt === 'string' && rt) return rt;
    }
  } catch {
    // ignore
  }
  return '';
};

const getNativeAuth = () => {
  if (Platform.OS === 'web') return null;
  try {
    // nativeAuth is the default export from @react-native-firebase/auth —
    // it IS the namespaced Auth instance (equivalent to firebase.auth()).
    // It does NOT have an .auth() method. Calling .auth() throws.
    return nativeAuth();
  } catch {
    return null;
  }
};

/**
 * Send OTP using native Firebase Auth (@react-native-firebase/auth).
 * Works in APK / AAB / IPA.
 */
export const sendOTP = async (phoneNumber: string): Promise<void> => {
  try {
    if (!phoneNumber.startsWith('+')) {
      throw new Error('Phone number must include country code (e.g., +91)');
    }
    if (phoneNumber.replace(/\D/g, '').length < 10) {
      throw new Error('Phone number must have at least 10 digits');
    }

    currentPhoneNumber = phoneNumber;
    nativeConfirmationResult = null;

    if (Platform.OS !== 'web') {
      const nativeAuthInstance = getNativeAuth();
      if (!nativeAuthInstance) {
        throw new Error(
          'Firebase Auth native module not available. Rebuild the app with native Firebase.'
        );
      }
      nativeConfirmationResult = await nativeAuthInstance.signInWithPhoneNumber(phoneNumber);
      return;
    }

    throw new Error('Phone authentication is only supported on Android and iOS in this app.');
  } catch (error: any) {
    nativeConfirmationResult = null;
    if (error.code === 'auth/invalid-phone-number' || error.message?.includes('Invalid phone')) {
      throw new Error('Invalid phone number format. Use +91XXXXXXXXXX');
    }
    if (error.code === 'auth/operation-not-allowed') {
      throw new Error('Phone authentication is not enabled in Firebase Console');
    }
    if (error.code === 'auth/too-many-requests' || error.message?.includes('Too many')) {
      throw new Error('Too many requests. Please try again in a few minutes.');
    }
    if (error.code === 'auth/argument-error') {
      throw new Error('Invalid argument. Please check your phone number format.');
    }
    throw new Error(error.message || 'Failed to send OTP. Please try again.');
  }
};

export const verifyOTP = async (otp: string) => {
  try {
    if (otp.length !== 6) {
      throw new Error('OTP must be 6 digits');
    }

    if (Platform.OS !== 'web' && nativeConfirmationResult) {
      const result = await nativeConfirmationResult.confirm(otp);
      if (!result) {
        throw new Error('Failed to verify OTP');
      }
      const user = result.user;
      const idToken = await user.getIdToken();

      nativeConfirmationResult = null;
      await persistVerifiedAuthSession({
        uid: user.uid,
        phoneNumber: user.phoneNumber || currentPhoneNumber,
        idToken,
        refreshToken: readUserRefreshToken(user),
      });

      return {
        uid: user.uid,
        phoneNumber: user.phoneNumber || currentPhoneNumber,
        idToken,
        refreshToken: readUserRefreshToken(user),
        user,
      };
    }

    throw new Error('OTP not sent. Please request a new OTP.');
  } catch (error: any) {
    if (error.code === 'auth/invalid-verification-code' || error.message?.includes('Invalid OTP')) {
      throw new Error('Invalid OTP. Please check and try again.');
    }
    if (error.code === 'auth/code-expired' || error.message?.includes('expired')) {
      throw new Error('OTP has expired. Please request a new one.');
    }
    if (error.message?.includes('6 digits')) {
      throw new Error('OTP must be exactly 6 digits');
    }
    throw new Error(error.message || 'Failed to verify OTP');
  }
};

export const resendOTP = async (): Promise<void> => {
  const phoneNumber = currentPhoneNumber;
  if (!phoneNumber) {
    throw new Error('No phone number on file. Please request a new OTP.');
  }
  nativeConfirmationResult = null;
  currentPhoneNumber = null;
  await sendOTP(phoneNumber);
};

export const clearAuthState = async (): Promise<void> => {
  nativeConfirmationResult = null;
  currentPhoneNumber = null;
  verifiedAuthSession = null;
  try {
    await AsyncStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
};

export const signOutUser = async (): Promise<void> => {
  try {
    if (Platform.OS !== 'web') {
      const nativeAuthInstance = getNativeAuth();
      if (nativeAuthInstance) {
        await nativeAuthInstance.signOut();
      }
    }
  } catch {
    // ignore
  }
  await clearAuthState();
};

export const getVerifiedAuthSession = () => verifiedAuthSession;

export const getPersistedVerifiedAuthSession = async () => {
  if (verifiedAuthSession) {
    return verifiedAuthSession;
  }
  try {
    const cachedSession = await AsyncStorage.getItem(SESSION_KEY);
    if (!cachedSession) {
      return null;
    }
    verifiedAuthSession = JSON.parse(cachedSession);
    return verifiedAuthSession;
  } catch {
    return null;
  }
};
