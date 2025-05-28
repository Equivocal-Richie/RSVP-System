
import admin from 'firebase-admin';
import { config } from 'dotenv';

// Attempt to load environment variables from .env file (and variants like .env.local)
// Next.js usually handles this, but this is an explicit safeguard.
config(); 

// Ensure that GOOGLE_APPLICATION_CREDENTIALS environment variable is set
// or provide the service account key directly.
// For Firebase Hosting/App Hosting, environment variables are preferred.
// Example .env.local or environment configuration:
// FIREBASE_PROJECT_ID="your-project-id"
// FIREBASE_CLIENT_EMAIL="your-service-account-email"
// FIREBASE_PRIVATE_KEY="your-private-key" (ensure to handle newlines correctly, e.g. by base64 encoding)

let dbInstance: admin.firestore.Firestore;
let fieldValueInstance: typeof admin.firestore.FieldValue;
let timestampInstance: typeof admin.firestore.Timestamp; // For class methods like .fromDate()
export type FirestoreTimestampType = admin.firestore.Timestamp; // For type annotations
let storageInstance: admin.storage.Storage;
let authInstance: admin.auth.Auth; // Added Auth instance
let initializationAttempted = false;
let initializationSuccessful = false;

if (!admin.apps.length) {
  initializationAttempted = true;
  console.log("Attempting to initialize Firebase Admin SDK...");
  try {
    const privateKeyEnv = process.env.FIREBASE_PRIVATE_KEY;
    // Ensure privateKey is correctly formatted (replace literal \n with actual newlines)
    const privateKey = privateKeyEnv ? privateKeyEnv.replace(/\\n/g, '\n') : undefined;
    
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
       admin.initializeApp({
        credential: admin.credential.applicationDefault(),
      });
      initializationSuccessful = true;
      console.log("Firebase Admin SDK initialized successfully using GOOGLE_APPLICATION_CREDENTIALS.");
    } else if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && privateKey) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: privateKey,
        }),
      });
      initializationSuccessful = true;
      console.log("Firebase Admin SDK initialized successfully using individual FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY environment variables.");
    } else {
      console.warn(
        'Firebase Admin SDK initialization SKIPPED: Missing required environment variables. Need either GOOGLE_APPLICATION_CREDENTIALS OR all of FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY. Firebase services will be unavailable.'
      );
    }
  } catch (error: any) {
    console.error('Firebase Admin SDK initialization FAILED during attempt. Error:', error.message);
    if (error.stack) {
        console.error("Stacktrace:", error.stack);
    }
  }
} else {
  initializationAttempted = true; 
  initializationSuccessful = true;
  console.log("Firebase Admin SDK was already initialized.");
}

if (initializationSuccessful && admin.apps.length > 0 && admin.apps[0]) {
  try {
    dbInstance = admin.firestore();
    fieldValueInstance = admin.firestore.FieldValue;
    timestampInstance = admin.firestore.Timestamp; // Assign class constructor
    storageInstance = admin.storage();
    authInstance = admin.auth(); // Initialize Auth service
    console.log("Firestore, Storage, and Auth services (db, FieldValue, Timestamp, storage, auth) accessed successfully.");
  } catch (e: any) {
      console.error("CRITICAL ERROR: Failed to access Firestore/Storage/Auth services even after Firebase Admin SDK reported successful initialization. Error:", e.message);
      if (e.stack) {
        console.error("Stacktrace:", e.stack);
      }
      initializationSuccessful = false; 
  }
}

if (!initializationSuccessful || !dbInstance! || !fieldValueInstance! || !timestampInstance! || !storageInstance! || !authInstance!) {
  let errorMessage = "CRITICAL FAILURE: Firebase Admin SDK could not be initialized or core services (Firestore, Storage, Auth) are unavailable. ";
  if (initializationAttempted && !initializationSuccessful) {
    errorMessage += "An initialization attempt was made but FAILED. Review the server logs above for specific credential errors (e.g., malformed private key, incorrect project ID/client email) or other Firebase Admin SDK issues.";
  } else if (!initializationAttempted && !admin.apps.length) { 
    errorMessage += "Initialization was SKIPPED due to missing environment variables (GOOGLE_APPLICATION_CREDENTIALS or the set of FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY).";
  } else if (initializationSuccessful && (!dbInstance! || !fieldValueInstance! || !timestampInstance! || !storageInstance! || !authInstance!)) {
    errorMessage += "SDK initialization appeared successful, but accessing core services FAILED. This is an unexpected state. Check logs for specific errors."
  } else {
     errorMessage += "The reason for failure is unclear from the current state, please check logs thoroughly."
  }
  errorMessage += " As a result, Firebase services will not be available to the application.";
  
  throw new Error(errorMessage);
}

export const db: admin.firestore.Firestore = dbInstance!;
export const FieldValue: typeof admin.firestore.FieldValue = fieldValueInstance!;
export const Timestamp: typeof admin.firestore.Timestamp = timestampInstance!; // Export class constructor
export const storage: admin.storage.Storage = storageInstance!;
export const auth: admin.auth.Auth = authInstance!; // Export Auth service


export const timestampToIsoString = (timestamp: admin.firestore.Timestamp | TimestampString | undefined | null): TimestampString | null => {
  if (!timestamp) return null;
  if (typeof timestamp === 'string') return timestamp; 
  if (timestamp instanceof Timestamp) { 
    return timestamp.toDate().toISOString();
  }
  if (typeof timestamp === 'object' && '_seconds' in timestamp && '_nanoseconds' in timestamp) {
    return new Timestamp((timestamp as any)._seconds, (timestamp as any)._nanoseconds).toDate().toISOString();
  }
  console.warn("timestampToIsoString received an unrecognized timestamp format:", timestamp);
  return null;
};

export type TimestampString = string;

export function convertTimestampsInObj<T extends Record<string, any>>(data: T): T {
  const newData = { ...data };
  for (const key in newData) {
    if (newData[key] instanceof Timestamp || (typeof newData[key] === 'object' && newData[key] !== null && '_seconds' in newData[key] && '_nanoseconds' in newData[key])) {
      newData[key] = timestampToIsoString(newData[key] as admin.firestore.Timestamp) as any;
    } else if (typeof newData[key] === 'object' && newData[key] !== null && !Array.isArray(newData[key])) { 
      newData[key] = convertTimestampsInObj(newData[key]); 
    }
  }
  return newData;
}

    