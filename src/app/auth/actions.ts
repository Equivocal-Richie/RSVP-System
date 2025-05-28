
'use server';

import { auth, db, FieldValue, Timestamp } from '@/lib/firebaseAdmin';
import type { UserData, TimestampString } from '@/types';
import { sendOtpEmail } from '@/lib/emailService'; // Assuming you have this service
import { randomInt } from 'crypto'; // For OTP generation

const USER_PROFILES_COLLECTION = 'userProfiles';
const OTP_ATTEMPTS_COLLECTION = 'otpAttempts';
const OTP_EXPIRY_MINUTES = 10;


// Helper to generate a simple hash (replace with robust hashing in production)
// For OTPs, since they are short-lived, even a simple hash with salt can be okay if combined with other security.
// However, bcrypt or crypto.createHash('sha256').update(otp + salt).digest('hex') is better.
// For simplicity here, we'll just log it. In a real app, DO NOT log plain OTPs.
const simpleHash = (text: string) => `hashed_${text}`; // Placeholder - DO NOT USE IN PRODUCTION

interface OtpAttemptData {
  email: string;
  name: string; // Store name to use when creating user profile
  otpHash: string;
  expiresAt: FirebaseFirestore.Timestamp;
  createdAt: FirebaseFirestore.Timestamp;
}

// Helper function to get or create a Firestore user profile
async function getOrCreateFirestoreUserProfile(
  uid: string,
  email: string | null,
  displayName?: string | null,
  photoURL?: string | null
): Promise<UserData> {
  const userProfileRef = db.collection(USER_PROFILES_COLLECTION).doc(uid);
  const docSnap = await userProfileRef.get();

  if (docSnap.exists) {
    const existingData = docSnap.data() as UserData;
    const updateData: Partial<UserData> & { updatedAt: any } = {
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (displayName && displayName !== existingData.displayName) {
      updateData.displayName = displayName;
    }
    if (photoURL && photoURL !== existingData.photoURL) {
      updateData.photoURL = photoURL;
    }
    if (email && email !== existingData.email) { // Update email if changed
        updateData.email = email;
    }
    await userProfileRef.update(updateData);
    const updatedSnap = await userProfileRef.get(); // Re-fetch to get server timestamp
    return { id: uid, ...(updatedSnap.data() as Omit<UserData, 'id'>) };
  } else {
    const newUserProfile: Omit<UserData, 'id' | 'createdAt'> & { createdAt: any, updatedAt: any } = {
      email: email || '', // Ensure email is not null
      displayName: displayName || email?.split('@')[0] || 'User', // Default display name
      photoURL: photoURL || undefined,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };
    await userProfileRef.set(newUserProfile);
    const createdSnap = await userProfileRef.get(); // Re-fetch
    return { id: uid, ...(createdSnap.data() as Omit<UserData, 'id'>) };
  }
}


type AuthResult = {
  success: boolean;
  message: string;
  error?: string;
  userId?: string;
  userData?: UserData;
};

type SignUpResult = AuthResult & {
  needsOtpVerification?: boolean;
  email?: string;
};


export async function signUpWithEmail(formData: FormData): Promise<SignUpResult> {
  const name = formData.get('name') as string;
  const email = (formData.get('email') as string || '').toLowerCase(); // Normalize email
  const password = formData.get('password') as string;

  console.log("Attempting sign up initiation for:", { name, email, password_length: password?.length });

  if (!name || !email || !password) {
    return { success: false, message: "Missing required fields.", error: "All fields are required." };
  }
  if (password.length < 6) {
    return { success: false, message: "Password too short.", error: "Password must be at least 6 characters." };
  }

  try {
    // Check if user already exists in Firebase Auth
    const existingUser = await auth.getUserByEmail(email).catch(() => null);
    if (existingUser) {
      return { success: false, message: "An account with this email already exists. Please sign in.", error: "Email already in use." };
    }

    const otp = randomInt(100000, 999999).toString(); // Generate 6-digit OTP
    const otpHash = simpleHash(otp); // Replace with secure hashing
    const expiresAt = Timestamp.fromMillis(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
    
    const otpAttemptRef = db.collection(OTP_ATTEMPTS_COLLECTION).doc(email); // Use email as doc ID for easy lookup
    const otpAttemptData: OtpAttemptData = {
      email,
      name, // Store name for later use when creating profile
      otpHash,
      expiresAt,
      createdAt: Timestamp.now(),
    };
    await otpAttemptRef.set(otpAttemptData);

    // Send OTP email
    const emailSent = await sendOtpEmail(email, name, otp);
    if (!emailSent.success) {
        console.error("Failed to send OTP email:", emailSent.error);
        return { success: false, message: "Sign up initiated, but failed to send OTP email. Please try again or contact support.", error: emailSent.error || "OTP email sending failed" };
    }

    console.log(`Mock OTP for ${email} (would be emailed): ${otp}. Hashed: ${otpHash}`);
    return { 
      success: true, 
      message: `Sign up initiated. An OTP has been sent to ${email}. It will expire in ${OTP_EXPIRY_MINUTES} minutes.`, 
      needsOtpVerification: true,
      email: email 
    };

  } catch (error: any) {
    console.error("Error during signUpWithEmail:", error);
    return { success: false, message: error.message || "An unexpected error occurred during sign up.", error: error.message };
  }
}

export async function verifyOtpAndCreateUser(formData: FormData): Promise<AuthResult> {
  const otpSubmitted = formData.get('otp') as string;
  const email = (formData.get('email') as string || '').toLowerCase();
  const password = formData.get('password') as string; // Password should be sent again from client

  if (!otpSubmitted || !email || !password) {
    return { success: false, message: "Email, OTP, and password are required.", error: "Missing email, OTP or password." };
  }

  try {
    const otpAttemptRef = db.collection(OTP_ATTEMPTS_COLLECTION).doc(email);
    const otpDoc = await otpAttemptRef.get();

    if (!otpDoc.exists) {
      return { success: false, message: "OTP record not found. Please try signing up again.", error: "Invalid OTP or session." };
    }

    const otpData = otpDoc.data() as OtpAttemptData;

    if (Timestamp.now().toMillis() > otpData.expiresAt.toMillis()) {
      await otpAttemptRef.delete(); // Clean up expired OTP
      return { success: false, message: "OTP has expired. Please request a new one.", error: "OTP expired." };
    }

    // Replace simpleHash with your actual hash comparison logic
    if (simpleHash(otpSubmitted) !== otpData.otpHash) {
      // You might want to add attempt counting here
      return { success: false, message: "Invalid OTP. Please try again.", error: "Invalid OTP." };
    }

    // OTP is valid, create user in Firebase Auth
    const userRecord = await auth.createUser({
      email: otpData.email,
      password: password, // Password provided from client
      displayName: otpData.name,
      emailVerified: true, // Since OTP verified email
    });

    // Create user profile in Firestore
    const userProfile = await getOrCreateFirestoreUserProfile(userRecord.uid, userRecord.email, userRecord.displayName, userRecord.photoURL);

    await otpAttemptRef.delete(); // Clean up used OTP record

    return { 
      success: true, 
      message: "Email verified and account created successfully! You can now sign in.", 
      userId: userRecord.uid,
      userData: userProfile
    };

  } catch (error: any) {
    console.error("Error during verifyOtpAndCreateUser:", error);
    if (error.code === 'auth/email-already-exists') {
      return { success: false, message: "This email is already registered. Please sign in.", error: error.message };
    }
    return { success: false, message: error.message || "An unexpected error occurred.", error: error.message };
  }
}

export async function resendOtp(email: string): Promise<AuthResult> {
  const normalizedEmail = email.toLowerCase();
  console.log(`Server Action: Attempting to resend OTP to ${normalizedEmail}`);
  if (!normalizedEmail) {
    return { success: false, message: "Email is required to resend OTP.", error: "Email missing." };
  }

  try {
    const otpAttemptRef = db.collection(OTP_ATTEMPTS_COLLECTION).doc(normalizedEmail);
    const otpDoc = await otpAttemptRef.get();

    if (!otpDoc.exists) {
      return { success: false, message: "No pending OTP verification found for this email. Please start the sign-up process again.", error: "No pending OTP." };
    }
    
    const otpData = otpDoc.data() as OtpAttemptData;

    const newOtp = randomInt(100000, 999999).toString();
    const newOtpHash = simpleHash(newOtp); // Replace with secure hashing
    const newExpiresAt = Timestamp.fromMillis(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    await otpAttemptRef.update({
      otpHash: newOtpHash,
      expiresAt: newExpiresAt,
      createdAt: Timestamp.now(), // Update timestamp to reflect new OTP generation
    });

    const emailSent = await sendOtpEmail(normalizedEmail, otpData.name, newOtp);
    if (!emailSent.success) {
        console.error("Failed to resend OTP email:", emailSent.error);
        return { success: false, message: "Failed to resend OTP email. Please try again or contact support.", error: emailSent.error || "OTP email sending failed" };
    }

    console.log(`Mock Resent OTP for ${normalizedEmail} (would be emailed): ${newOtp}`);
    return { success: true, message: `A new OTP has been sent to ${normalizedEmail}. It will expire in ${OTP_EXPIRY_MINUTES} minutes.` };

  } catch (error: any) {
    console.error("Error resending OTP:", error);
    return { success: false, message: error.message || "Failed to resend OTP.", error: error.message };
  }
}


// This action is a placeholder. Secure email/password sign-in is typically handled by Firebase Client SDK.
// This server action could be used for post-client-signin tasks if needed, like creating a session cookie
// or if the client sends an ID token after successful sign-in.
export async function signInWithEmailAction(formData: FormData): Promise<AuthResult> {
  const email = formData.get('email') as string;
  // const password = formData.get('password') as string; // Password should not be sent here for sign-in
  console.log("Attempting Email Sign-In (Server Action Placeholder for email):", { email });

  // --- TODO: Implement logic if this action is used post-client-SDK sign-in ---
  // For example, if client sends an ID token:
  // const idToken = formData.get('idToken') as string;
  // if (idToken) {
  //   try {
  //     const decodedToken = await auth.verifyIdToken(idToken);
  //     const userProfile = await getOrCreateFirestoreUserProfile(decodedToken.uid, decodedToken.email, decodedToken.name, decodedToken.picture);
  //     // Potentially create a session cookie here
  //     return { success: true, message: "ID Token verified, session would be managed here.", userId: decodedToken.uid, userData: userProfile };
  //   } catch (error: any) {
  //     return { success: false, message: "Invalid ID Token.", error: error.message };
  //   }
  // }

  return { 
    success: false, // Default to false as this action doesn't perform actual sign-in
    message: "Sign-in with email/password should be handled by client-side Firebase SDK for security. This server action is a placeholder for post-sign-in tasks." 
  };
}

// This action expects an ID token from the client after a successful Google Sign-In via Firebase Client SDK.
export async function handleGoogleSignInServerAction(formData: FormData): Promise<AuthResult> {
  const idToken = formData.get('idToken') as string | null;
  console.log("Attempting Google Sign-In (Server Action with ID Token)");

  if (!idToken) {
    return { success: false, message: "ID token is required for Google Sign-In verification.", error: "Missing ID token." };
  }

  try {
    const decodedToken = await auth.verifyIdToken(idToken);
    // ID token is valid. Get user data.
    const { uid, email, name, picture } = decodedToken;

    // Create or update user profile in Firestore
    const userProfile = await getOrCreateFirestoreUserProfile(uid, email || null, name, picture);
    
    // Here you might also create a session cookie if you're using them.
    // For now, just return success and user data.
    return { 
      success: true, 
      message: "Google Sign-In successful. User verified and profile managed.", 
      userId: uid,
      userData: userProfile
    };

  } catch (error: any) {
    console.error("Google Sign-In verification failed (Server Action):", error);
    return { success: false, message: "Google Sign-In verification failed.", error: error.message };
  }
}


export async function signOutUser(): Promise<AuthResult> {
    console.log("Server Action: Signing out user (placeholder).");
    // Actual sign-out (clearing client session) is handled by Firebase Client SDK.
    // Server-side, you might revoke refresh tokens or invalidate session cookies if used.
    return { success: true, message: "Signed out successfully (server placeholder)." };
}

    