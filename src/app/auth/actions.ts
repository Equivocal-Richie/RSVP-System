
'use server';

import type { UserData } from '@/types'; // Assuming UserData might be useful

// Placeholder results for server actions
type AuthResult = {
  success: boolean;
  message: string;
  error?: string;
  userId?: string;
};

type SignUpResult = AuthResult & {
  needsOtpVerification?: boolean;
  email?: string;
};

type GoogleSignInResult = AuthResult & {
  redirectUrl?: string; // Usually Google Sign-In involves client-side redirects handled by Firebase SDK
};


export async function signUpWithEmail(formData: FormData): Promise<SignUpResult> {
  const name = formData.get('name') as string;
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  console.log("Attempting sign up with:", { name, email, password_length: password?.length });

  // --- TODO: Implement Actual Firebase Authentication Sign Up ---
  // 1. Use Firebase Admin SDK to create user (admin.auth().createUser(...))
  //    This is if you want full backend control over user creation.
  //    OR
  //    Rely on Firebase Client SDK on the frontend to handle createUserWithEmailAndPassword,
  //    and this server action might be used for post-signup logic or if client calls it.
  //
  // 2. If successful, and OTP is desired:
  //    - Generate OTP
  //    - Store OTP hash with expiry (e.g., in a 'otpAttempts' Firestore collection)
  //    - Send OTP email (using a separate email service or Firebase Extension)
  //
  // For now, mock success and OTP requirement.
  if (!name || !email || !password) {
    return { success: false, message: "Missing required fields.", error: "All fields are required." };
  }
  if (password.length < 6) {
    return { success: false, message: "Password too short.", error: "Password must be at least 6 characters." };
  }
  
  // Simulate sending OTP
  console.log(`Mock: OTP would be sent to ${email}`);
  // In a real scenario, you'd trigger sendOtp(email) here or similar logic

  return { 
    success: true, 
    message: "Sign up initiated. Please verify your email with the OTP sent.", 
    needsOtpVerification: true,
    email: email 
  };
}

export async function signInWithEmail(formData: FormData): Promise<AuthResult> {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  console.log("Attempting sign in for:", { email, password_length: password?.length });

  // --- TODO: Implement Actual Firebase Authentication Sign In ---
  // Typically, signInWithEmailAndPassword is handled by Firebase Client SDK.
  // If this server action is called after client-side Firebase auth, it might be for session cookies or custom claims.
  // For now, mock success.
  if (!email || !password) {
    return { success: false, message: "Email and password are required.", error: "Missing credentials."};
  }
  
  // Simulate successful sign-in
  return { success: true, message: "Sign in successful! Redirecting..." };
}

export async function handleGoogleSignIn(): Promise<GoogleSignInResult> {
  console.log("Attempting Google Sign-In (server action placeholder)");
  // --- TODO: Implement Google Sign-In ---
  // Google Sign-In is primarily a client-side flow using Firebase Client SDK (signInWithPopup or signInWithRedirect).
  // This server action might be called with an ID token obtained on the client
  // to create a session cookie or perform backend tasks.
  // For now, this is a placeholder.
  return { success: true, message: "Google Sign-In process initiated (mock)." };
  // In a real Firebase Client SDK flow, a redirect or popup would occur on the client.
}

export async function sendOtp(email: string): Promise<AuthResult> {
  console.log(`Server Action: Attempting to send OTP to ${email}`);
  if (!email) {
    return { success: false, message: "Email is required to send OTP.", error: "Email missing." };
  }
  // --- TODO: Implement Actual OTP Generation and Sending ---
  // 1. Generate a secure OTP (e.g., 6-digit random number).
  // 2. Hash the OTP.
  // 3. Store the OTP hash and an expiry timestamp in Firestore (e.g., `otpAttempts` collection).
  //    - Fields: `email`, `otpHash`, `expiresAt`, `createdAt`.
  //    - Use Firestore TTL policy on `expiresAt` for automatic cleanup.
  // 4. Send the plain OTP to the user's email via your email service (e.g., Brevo).
  
  // Mocking OTP sending:
  const mockOtp = Math.floor(100000 + Math.random() * 900000).toString();
  console.log(`Mock OTP for ${email}: ${mockOtp} (This would be emailed, and its hash stored)`);

  return { success: true, message: `A new OTP has been sent to ${email}.` };
}


export async function verifyOtp(formData: FormData): Promise<AuthResult> {
  const otp = formData.get('otp') as string;
  const email = formData.get('email') as string; // Assuming email is passed or retrieved
  console.log(`Attempting to verify OTP ${otp} for email ${email}`);

  if (!otp || !email) {
    return { success: false, message: "Email and OTP are required.", error: "Missing email or OTP." };
  }

  // --- TODO: Implement Actual OTP Verification ---
  // 1. Retrieve the stored OTP hash and expiry for the given email from Firestore.
  // 2. Check if OTP record exists and has not expired.
  // 3. Hash the submitted OTP using the same method as when stored.
  // 4. Compare the submitted OTP's hash with the stored hash.
  // 5. If valid:
  //    - Mark the user's email as verified in Firebase Auth (admin.auth().updateUser(uid, { emailVerified: true }))
  //    - Delete or invalidate the OTP record.
  //    - Potentially create a session / sign the user in.
  // 6. If invalid, increment attempt counter or handle failure.

  // Mocking OTP verification:
  if (otp === "123456") { // Replace with real logic
    console.log(`OTP ${otp} for ${email} verified successfully (mock).`);
    return { success: true, message: "Email verified successfully! Redirecting..." };
  } else {
    console.log(`OTP ${otp} for ${email} verification failed (mock).`);
    return { success: false, message: "Invalid OTP. Please try again.", error: "Invalid OTP." };
  }
}

// Placeholder for signOut if needed on server-side (e.g. revoking refresh tokens, session invalidation)
export async function signOutUser(): Promise<AuthResult> {
    console.log("Server Action: Signing out user (placeholder).");
    // --- TODO: Implement Actual Sign Out ---
    // - Invalidate session cookies if used.
    // - Firebase Client SDK handles client-side sign-out (firebase.auth().signOut()).
    return { success: true, message: "Signed out successfully." };
}
