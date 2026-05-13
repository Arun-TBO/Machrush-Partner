import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';

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

// Initialize Firebase
let firebaseApp: FirebaseApp | null = null;
try {
  firebaseApp = initializeApp(firebaseConfig);
  console.log('✅ Firebase initialized successfully');
} catch (error) {
  console.error('❌ Firebase initialization error:', error);
  throw error;
}

// Initialize Firebase Authentication
let auth;
try {
  auth = getAuth(firebaseApp);
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

export { firebaseApp, auth, db };
