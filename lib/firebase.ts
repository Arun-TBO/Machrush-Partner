import { initializeApp, FirebaseApp, getApp } from 'firebase/app';
import * as FirebaseAuth from 'firebase/auth';
import { Auth, getAuth, initializeAuth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { FirebaseStorage, getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Firebase configuration from environment variables
// These values are securely stored in .env.local (never commit to git)
const firebaseConfig = {
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
};

// Validate that all required Firebase config values are present
const requiredFields = ['projectId', 'storageBucket', 'apiKey', 'appId', 'messagingSenderId'];
const missingFields = requiredFields.filter(field => !firebaseConfig[field as keyof typeof firebaseConfig]);

if (missingFields.length > 0) {
  console.error(
    '❌ Missing Firebase configuration values in .env.local:',
    missingFields.map(field => `EXPO_PUBLIC_FIREBASE_${field.toUpperCase()}`).join(', ')
  );
  throw new Error('Firebase configuration is incomplete. Please check your .env.local file.');
}

// Initialize Firebase (prevent duplicate initialization)
let firebaseApp: FirebaseApp | null = null;
try {
  // Check if Firebase app already exists
  try {
    firebaseApp = getApp();
    console.log('✅ Firebase app already initialized, reusing existing instance');
  } catch {
    // App doesn't exist, initialize it
    firebaseApp = initializeApp(firebaseConfig);
    console.log('✅ Firebase initialized successfully');
  }
} catch (error) {
  console.error('❌ Firebase initialization error:', error);
  throw error;
}

// Initialize Firebase Authentication
let auth: Auth;
try {
  if (Platform.OS === 'web') {
    auth = getAuth(firebaseApp);
  } else {
    try {
      const getReactNativePersistence = (FirebaseAuth as any).getReactNativePersistence;

      if (typeof getReactNativePersistence === 'function') {
        auth = initializeAuth(firebaseApp, {
          persistence: getReactNativePersistence(AsyncStorage),
        });
      } else {
        auth = getAuth(firebaseApp);
      }
    } catch {
      auth = getAuth(firebaseApp);
    }
  }
  console.log('✅ Firebase Auth initialized');
} catch (error) {
  console.error('❌ Firebase Auth initialization error:', error);
  throw error;
}

// Initialize Firestore
let db: Firestore;
try {
  db = getFirestore(firebaseApp);
  console.log('✅ Firestore initialized');
} catch (error) {
  console.error('❌ Firestore initialization error:', error);
  throw error;
}

// Initialize Firebase Storage
let storage: FirebaseStorage;
try {
  storage = getStorage(firebaseApp);
  console.log('âœ… Firebase Storage initialized');
} catch (error) {
  console.error('âŒ Firebase Storage initialization error:', error);
  throw error;
}

export { firebaseApp, auth, db, storage };
