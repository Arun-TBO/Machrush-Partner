import {
  signInWithPhoneNumber,
  ConfirmationResult,
  RecaptchaVerifier,
  ApplicationVerifier,
  signInWithCustomToken,
} from 'firebase/auth';
import { auth } from './firebase';

let confirmationResult: ConfirmationResult | null = null;
let currentPhoneNumber: string | null = null;
let recaptchaVerifier: RecaptchaVerifier | null = null;
let sessionInfo: string | null = null; // For Firebase REST API fallback

/**
 * Initialize or get the reCAPTCHA verifier
 * For React Native/Expo, we use a simple verifier without UI
 */
const getRecaptchaVerifier = (): RecaptchaVerifier => {
  if (!recaptchaVerifier) {
    try {
      recaptchaVerifier = new RecaptchaVerifier(
        auth,
        ({
          size: 'invisible',
          callback: (token: string) => {
            console.log('✅ reCAPTCHA verification successful');
          },
        } as any)
      );
    } catch (error) {
      console.warn('⚠️ reCAPTCHA initialization warning:', error);
      // reCAPTCHA might not be available in Expo, continue without it
      throw error;
    }
  }
  return recaptchaVerifier;
};

/**
 * Alternative: Send OTP using Firebase REST API
 * This works better with Expo/React Native
 */
const sendOTPViaREST = async (phoneNumber: string): Promise<void> => {
  try {
    const apiKey = process.env.EXPO_PUBLIC_FIREBASE_API_KEY;
    if (!apiKey) {
      throw new Error('Firebase API key not configured');
    }

    console.log('📡 Using Firebase REST API for phone auth...');

    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:sendVerificationCode?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phoneNumber: phoneNumber,
          recaptchaToken: 'dummy-token-for-expo', // Expo doesn't support reCAPTCHA
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error('REST API Error:', data);
      if (data.error?.code === 'INVALID_PHONE_NUMBER') {
        throw new Error('Invalid phone number format');
      } else if (data.error?.code === 'MISSING_PHONE_NUMBER') {
        throw new Error('Phone number is required');
      } else if (data.error?.code === 'TOO_MANY_ATTEMPTS_TRY_LATER') {
        throw new Error('Too many attempts. Please try again later');
      }
      throw new Error(data.error?.message || 'Failed to send OTP');
    }

    // Store session info for verification
    sessionInfo = data.sessionInfo;
    console.log('✅ OTP sent successfully via REST API');
    return;
  } catch (error: any) {
    console.error('❌ Error in REST API phone auth:', error);
    throw error;
  }
};

/**
 * Send OTP to the provided phone number
 * Tries standard SDK method first, then falls back to REST API for Expo
 * @param phoneNumber - Phone number in format +91XXXXXXXXXX
 * @returns Promise that resolves when OTP is sent
 */
export const sendOTP = async (phoneNumber: string): Promise<void> => {
  try {
    console.log('📱 Sending OTP to:', phoneNumber);

    // Validate phone number format
    if (!phoneNumber.startsWith('+')) {
      throw new Error('Phone number must include country code (e.g., +91)');
    }

    if (phoneNumber.replace(/\D/g, '').length < 10) {
      throw new Error('Phone number must have at least 10 digits');
    }

    // Store the phone number for resend functionality
    currentPhoneNumber = phoneNumber;

    // Try standard SDK method first
    try {
      const verifier = getRecaptchaVerifier();
      console.log('🔐 Using SDK phone sign-in with reCAPTCHA...');

      confirmationResult = await signInWithPhoneNumber(
        auth,
        phoneNumber,
        verifier as ApplicationVerifier
      );

      console.log('✅ OTP sent successfully via SDK');
      return;
    } catch (sdkError: any) {
      console.warn('⚠️ SDK method failed, trying REST API...', sdkError.message);
      
      // Clear recaptcha for retry
      recaptchaVerifier = null;

      // Fall back to REST API method
      await sendOTPViaREST(phoneNumber);
    }
  } catch (error: any) {
    console.error('❌ Error sending OTP:', error);

    // Clear recaptcha verifier on error for retry
    recaptchaVerifier = null;

    // Handle specific error cases
    if (error.code === 'auth/invalid-phone-number' || error.message?.includes('Invalid phone')) {
      throw new Error('Invalid phone number format. Use +91XXXXXXXXXX');
    } else if (error.code === 'auth/operation-not-allowed') {
      throw new Error('Phone authentication is not enabled in Firebase Console');
    } else if (error.code === 'auth/too-many-requests' || error.message?.includes('Too many')) {
      throw new Error('Too many requests. Please try again in a few minutes');
    } else if (error.code === 'auth/argument-error') {
      throw new Error('Invalid argument. Please check your phone number format');
    }

    throw new Error(error.message || 'Failed to send OTP. Please try again.');
  }
};

/**
 * Verify the OTP code entered by the user
 * @param otp - 6-digit OTP code
 * @returns Promise that resolves with user credential on success
 */
export const verifyOTP = async (otp: string): Promise<any> => {
  try {
    if (otp.length !== 6) {
      throw new Error('OTP must be 6 digits');
    }

    console.log('🔐 Verifying OTP...');

    // If using REST API
    if (sessionInfo && !confirmationResult) {
      return verifyOTPViaREST(otp);
    }

    // Standard SDK method
    if (!confirmationResult) {
      throw new Error('OTP not sent. Please request a new OTP.');
    }

    const result = await confirmationResult.confirm(otp);
    const user = result.user;

    console.log('✅ OTP verified successfully');
    console.log('User UID:', user.uid);
    console.log('Phone Number:', user.phoneNumber);

    // Get the ID token for future API calls
    const idToken = await user.getIdToken();

    // Clear recaptcha verifier after successful verification
    recaptchaVerifier = null;

    return {
      uid: user.uid,
      phoneNumber: user.phoneNumber,
      idToken: idToken,
      user: user,
    };
  } catch (error: any) {
    console.error('❌ Error verifying OTP:', error);

    // Handle specific error cases
    if (error.code === 'auth/invalid-verification-code' || error.message?.includes('Invalid OTP')) {
      throw new Error('Invalid OTP. Please check and try again.');
    } else if (error.code === 'auth/code-expired' || error.message?.includes('expired')) {
      throw new Error('OTP has expired. Please request a new one.');
    } else if (error.message?.includes('6 digits')) {
      throw new Error('OTP must be exactly 6 digits');
    }

    throw new Error(error.message || 'Failed to verify OTP');
  }
};

/**
 * Verify OTP using Firebase REST API (for Expo compatibility)
 */
const verifyOTPViaREST = async (otp: string): Promise<any> => {
  try {
    const apiKey = process.env.EXPO_PUBLIC_FIREBASE_API_KEY;
    if (!apiKey) {
      throw new Error('Firebase API key not configured');
    }

    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPhoneNumber?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionInfo: sessionInfo,
          code: otp,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error('REST API Verification Error:', data);
      if (data.error?.code === 'INVALID_SESSION_ID') {
        throw new Error('OTP session expired. Please request a new OTP.');
      } else if (data.error?.code === 'INVALID_CODE') {
        throw new Error('Invalid OTP. Please check and try again.');
      }
      throw new Error(data.error?.message || 'Failed to verify OTP');
    }

    console.log('✅ OTP verified successfully via REST API');

    // Create a custom token or use the returned credentials
    // Note: The REST API returns idToken and refreshToken directly
    return {
      uid: data.localId,
      phoneNumber: currentPhoneNumber,
      idToken: data.idToken,
      refreshToken: data.refreshToken,
    };
  } catch (error: any) {
    console.error('❌ Error in REST API OTP verification:', error);
    throw error;
  }
};

/**
 * Resend OTP to the same phone number
 * @returns Promise that resolves when OTP is resent
 */
export const resendOTP = async (): Promise<void> => {
  try {
    if (!currentPhoneNumber) {
      throw new Error('No phone number on file. Please request a new OTP.');
    }

    console.log('📱 Resending OTP to:', currentPhoneNumber);

    // Clear the old recaptcha verifier
    recaptchaVerifier = null;
    sessionInfo = null;

    // Try standard SDK method first
    try {
      const verifier = getRecaptchaVerifier();
      confirmationResult = await signInWithPhoneNumber(
        auth,
        currentPhoneNumber,
        verifier as ApplicationVerifier
      );
      console.log('✅ OTP resent successfully via SDK');
      return;
    } catch (sdkError: any) {
      console.warn('⚠️ SDK resend failed, trying REST API...', sdkError.message);
      recaptchaVerifier = null;

      // Fall back to REST API
      await sendOTPViaREST(currentPhoneNumber);
    }
  } catch (error: any) {
    console.error('❌ Error resending OTP:', error);

    // Clear recaptcha verifier on error
    recaptchaVerifier = null;

    if (error.code === 'auth/invalid-phone-number') {
      throw new Error('Invalid phone number format');
    } else if (error.code === 'auth/too-many-requests' || error.message?.includes('Too many')) {
      throw new Error('Too many requests. Please try again later');
    } else if (error.code === 'auth/argument-error') {
      throw new Error('Invalid argument. Please check your phone number');
    }

    throw new Error(error.message || 'Failed to resend OTP');
  }
};

/**
 * Clear the confirmation result and verifier (logout)
 */
export const clearAuthState = (): void => {
  confirmationResult = null;
  currentPhoneNumber = null;
  recaptchaVerifier = null;
  sessionInfo = null;
  console.log('🔄 Auth state cleared');
};

/**
 * Sign out the user
 */
export const signOutUser = async (): Promise<void> => {
  try {
    await auth.signOut();
    clearAuthState();
    console.log('✅ User signed out');
  } catch (error) {
    console.error('❌ Error signing out:', error);
    clearAuthState();
    throw error;
  }
};

export default {
  sendOTP,
  verifyOTP,
  resendOTP,
  clearAuthState,
  signOutUser,
};
