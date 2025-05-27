import admin from 'firebase-admin';

// Ensure that GOOGLE_APPLICATION_CREDENTIALS environment variable is set
// or provide the service account key directly.
// For Firebase Hosting/App Hosting, environment variables are preferred.
// Example .env.local or environment configuration:
// FIREBASE_PROJECT_ID="your-project-id"
// FIREBASE_CLIENT_EMAIL="your-service-account-email"
// FIREBASE_PRIVATE_KEY="your-private-key" (ensure to handle newlines correctly, e.g. by base64 encoding)

try {
  if (!admin.apps.length) {
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
       admin.initializeApp({
        credential: admin.credential.applicationDefault(),
      });
    } else if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && privateKey) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: privateKey,
        }),
      });
    } else {
      console.warn(
        'Firebase Admin SDK not initialized. Missing GOOGLE_APPLICATION_CREDENTIALS or individual FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY environment variables.'
      );
    }
  }
} catch (error) {
  console.error('Firebase Admin SDK initialization error:', error);
}

export const db = admin.firestore();
export const FieldValue = admin.firestore.FieldValue;
export type Timestamp = admin.firestore.Timestamp;

// Helper to convert Firestore Timestamp to ISO string or return null
export const timestampToIsoString = (timestamp: Timestamp | TimestampString | undefined | null): TimestampString | null => {
  if (!timestamp) return null;
  if (typeof timestamp === 'string') return timestamp; // Already a string
  if (timestamp instanceof admin.firestore.Timestamp) {
    return timestamp.toDate().toISOString();
  }
  // Handle cases where it might be a plain object from Firestore (e.g., { _seconds: ..., _nanoseconds: ... })
  if (typeof timestamp === 'object' && '_seconds' in timestamp && '_nanoseconds' in timestamp) {
     // Type assertion needed if FirestoreTimestamp is not directly compatible with admin.firestore.Timestamp constructor
    return new admin.firestore.Timestamp((timestamp as any)._seconds, (timestamp as any)._nanoseconds).toDate().toISOString();
  }
  return null;
};

// Helper to convert multiple Timestamps in an object
export function convertTimestampsInObj<T extends Record<string, any>>(data: T): T {
  const newData = { ...data };
  for (const key in newData) {
    if (newData[key] instanceof admin.firestore.Timestamp) {
      newData[key] = timestampToIsoString(newData[key] as Timestamp) as any;
    } else if (typeof newData[key] === 'object' && newData[key] !== null && '_seconds' in newData[key] && '_nanoseconds' in newData[key]) {
      newData[key] = timestampToIsoString(newData[key] as Timestamp) as any;
    } else if (typeof newData[key] === 'object' && newData[key] !== null) {
      newData[key] = convertTimestampsInObj(newData[key]); // Recurse for nested objects
    }
  }
  return newData;
}
