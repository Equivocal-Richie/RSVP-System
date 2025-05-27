
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
let timestampInstance: typeof admin.firestore.Timestamp; // Added for consistency
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
      // This path means no complete set of credentials was provided to attempt initialization.
      console.warn(
        'Firebase Admin SDK initialization SKIPPED: Missing required environment variables. Need either GOOGLE_APPLICATION_CREDENTIALS OR all of FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY. Firestore will be unavailable.'
      );
      // initializationSuccessful remains false
    }
  } catch (error: any) {
    // This path means an attempt was made with provided credentials, but it failed.
    console.error('Firebase Admin SDK initialization FAILED during attempt. Error:', error.message);
    if (error.stack) {
        console.error("Stacktrace:", error.stack);
    }
    // initializationSuccessful remains false
  }
} else {
  // App was already initialized (e.g., in a different module or by Firebase Hosting itself)
  initializationAttempted = true; // Considered an attempt if already initialized
  initializationSuccessful = true;
  console.log("Firebase Admin SDK was already initialized.");
}

// Now, try to get Firestore instances if initialization was successful
if (initializationSuccessful && admin.apps.length > 0 && admin.apps[0]) {
  try {
    dbInstance = admin.firestore();
    fieldValueInstance = admin.firestore.FieldValue;
    timestampInstance = admin.firestore.Timestamp; // Initialize Timestamp class reference
    console.log("Firestore services (db, FieldValue, Timestamp) accessed successfully.");
  } catch (e: any) {
      // This would be very unusual: app initialized but firestore() fails.
      console.error("CRITICAL ERROR: Failed to access Firestore services even after Firebase Admin SDK reported successful initialization. Error:", e.message);
      if (e.stack) {
        console.error("Stacktrace:", e.stack);
      }
      initializationSuccessful = false; // Mark as failed if services can't be accessed
  }
}

// If, after all checks, we don't have a successful initialization for Firestore, throw a clear error.
// This makes `db` and `FieldValue` exports fail loudly if they can't be used.
if (!initializationSuccessful || !dbInstance! || !fieldValueInstance! || !timestampInstance!) {
  let errorMessage = "CRITICAL FAILURE: Firebase Admin SDK could not be initialized or Firestore services are unavailable. ";
  if (initializationAttempted && !initializationSuccessful) {
    errorMessage += "An initialization attempt was made but FAILED. Review the server logs above for specific credential errors (e.g., malformed private key, incorrect project ID/client email) or other Firebase Admin SDK issues.";
  } else if (!initializationAttempted && !admin.apps.length) { 
    // This implies the case where env vars were missing and no attempt was made because !admin.apps.length was true, but then no credentials were found
    errorMessage += "Initialization was SKIPPED due to missing environment variables (GOOGLE_APPLICATION_CREDENTIALS or the set of FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY).";
  } else if (initializationSuccessful && (!dbInstance! || !fieldValueInstance! || !timestampInstance!)) {
    errorMessage += "SDK initialization appeared successful, but accessing core Firestore services FAILED. This is an unexpected state. Check logs for specific errors from Firestore."
  } else {
    // Fallback for any other unhandled state
     errorMessage += "The reason for failure is unclear from the current state, please check logs thoroughly."
  }
  errorMessage += " As a result, Firestore services will not be available to the application.";
  
  // The console.warn/error above should have given specifics. This is the final stop-gap.
  throw new Error(errorMessage);
}

// Exports - TypeScript will require these to be definitely assigned.
// The throw new Error above ensures that if initializationSuccessful is false or instances are not set, this part of the code is not reached.
export const db: admin.firestore.Firestore = dbInstance!;
export const FieldValue: typeof admin.firestore.FieldValue = fieldValueInstance!;
export const Timestamp: typeof admin.firestore.Timestamp = timestampInstance!; // Changed from 'export type' to 'export const'

// Helper to convert Firestore Timestamp to ISO string or return null
export const timestampToIsoString = (timestamp: admin.firestore.Timestamp | TimestampString | undefined | null): TimestampString | null => {
  if (!timestamp) return null;
  if (typeof timestamp === 'string') return timestamp; // Already a string
  if (timestamp instanceof admin.firestore.Timestamp) { // Use admin.firestore.Timestamp for instanceof check
    return timestamp.toDate().toISOString();
  }
  // Handle cases where it might be a plain object from Firestore (e.g., { _seconds: ..., _nanoseconds: ... })
  if (typeof timestamp === 'object' && '_seconds' in timestamp && '_nanoseconds' in timestamp) {
     // Type assertion needed if FirestoreTimestamp is not directly compatible with admin.firestore.Timestamp constructor
    return new admin.firestore.Timestamp((timestamp as any)._seconds, (timestamp as any)._nanoseconds).toDate().toISOString();
  }
  console.warn("timestampToIsoString received an unrecognized timestamp format:", timestamp);
  return null;
};

// Type alias for string representation of Timestamp for client-side use
export type TimestampString = string;

// Helper to convert multiple Timestamps in an object
export function convertTimestampsInObj<T extends Record<string, any>>(data: T): T {
  const newData = { ...data };
  for (const key in newData) {
    if (newData[key] instanceof admin.firestore.Timestamp || (typeof newData[key] === 'object' && newData[key] !== null && '_seconds' in newData[key] && '_nanoseconds' in newData[key])) {
      newData[key] = timestampToIsoString(newData[key] as admin.firestore.Timestamp) as any;
    } else if (typeof newData[key] === 'object' && newData[key] !== null && !Array.isArray(newData[key])) { // Check for plain object and not array
      newData[key] = convertTimestampsInObj(newData[key]); // Recurse for nested objects
    }
  }
  return newData;
}
