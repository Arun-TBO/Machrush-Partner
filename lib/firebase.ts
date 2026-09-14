import { initializeApp, FirebaseApp, getApp } from 'firebase/app';
import { Auth, getAuth, initializeAuth } from 'firebase/auth';
import type { Persistence } from 'firebase/auth';
import * as firebaseAuth from 'firebase/auth';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// firebase/auth exposes getReactNativePersistence only through the React
// Native entrypoint (dist/rn/index.rn.d.ts), which Metro resolves but tsc
// does not (tsc uses the browser/node types). Access it through the namespace
// so both the real bundler and type-checking are satisfied.
const getReactNativePersistence = (
  firebaseAuth as unknown as {
    getReactNativePersistence: (storage: unknown) => Persistence;
  }
).getReactNativePersistence;

// Firebase configuration from environment variables
// These values are securely stored in .env.local (never commit to git)
//
// IMPORTANT: This app uses Firebase for AUTHENTICATION ONLY.
// - All file/image storage is handled by the backend via AWS S3
//   (see lib/firestoreOnboardingService.ts / the /api/uploads routes).
// - All application data lives in MongoDB (exposed by the same backend).
//
// Firestore and Firebase Storage are intentionally NOT initialized here.
const firebaseConfig = {
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
};

// Validate that all required Firebase config values are present
const requiredFields = ['projectId', 'apiKey', 'appId', 'messagingSenderId'];
const missingFields = requiredFields.filter(field => !firebaseConfig[field as keyof typeof firebaseConfig]);

if (missingFields.length > 0) {
  console.error(
    'Missing Firebase configuration values in .env.local:',
    missingFields.map(field => `EXPO_PUBLIC_FIREBASE_${field.toUpperCase()}`).join(', ')
  );
  throw new Error('Firebase configuration is incomplete. Please check your .env.local file.');
}

// Initialize Firebase (prevent duplicate initialization)
let firebaseApp: FirebaseApp | null = null;
try {
  try {
    firebaseApp = getApp();
    console.log('Firebase app already initialized, reusing existing instance');
  } catch {
    firebaseApp = initializeApp(firebaseConfig);
    console.log('Firebase initialized successfully');
  }
} catch (error) {
  console.error('Firebase initialization error:', error);
  throw error;
}

// Initialize Firebase Authentication.
// IMPORTANT: On native platforms the auth state must be persisted to
// AsyncStorage - otherwise the session is memory-only and every app
// restart/reload silently "logs the driver out" (auth.currentUser = null).
//
// firebase/auth resolves to the React Native entry (dist/rn/index.js) under
// Metro, which exports the official getReactNativePersistence(AsyncStorage).
let auth: Auth;
if (Platform.OS === 'web') {
  try {
    auth = getAuth(firebaseApp);
    console.log('Firebase Auth initialized (web persistence)');
  } catch (error) {
    console.error('Firebase Auth initialization error:', error);
    throw error;
  }
} else {
  try {
    auth = initializeAuth(firebaseApp, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
    console.log('Firebase Auth initialized with AsyncStorage persistence');
  } catch (error: any) {
    // "auth/already-initialized" - reuse the existing instance.
    if (error?.code === 'auth/already-initialized') {
      auth = getAuth(firebaseApp);
      console.log('Firebase Auth already initialized, reusing instance');
    } else {
      console.error('Firebase Auth initialization error:', error);
      throw error;
    }
  }
}

export { auth };
