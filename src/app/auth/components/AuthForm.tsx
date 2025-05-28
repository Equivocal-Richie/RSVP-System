
"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { AlertCircle, LogIn, UserPlus, Mail, KeyRound, User, Send, Loader2, ShieldAlert } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { signUpWithEmail as initiateSignUpServer, verifyOtpAndCreateUser, resendOtp, handleGoogleSignInServerAction } from '../actions';
import { auth } from '@/lib/firebaseClient';
import { 
  signInWithEmailAndPassword, 
  GoogleAuthProvider, 
  signInWithPopup,
  sendPasswordResetEmail
} from 'firebase/auth';
import { useAuth } from '@/contexts/AuthContext';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const GoogleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="24px" height="24px">
    <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/>
    <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/>
    <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/>
    <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.574l0.003-0.002l6.19,5.238C39.908,34.42,44,28.718,44,20C44,22.659,43.862,21.35,43.611,20.083z"/>
  </svg>
);

export default function AuthForm() {
  const [isSignUpView, setIsSignUpView] = useState(true);
  const [showOtpForm, setShowOtpForm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Store details for OTP step
  const [nameForOtp, setNameForOtp] = useState('');
  const [emailForOtp, setEmailForOtp] = useState('');
  const [passwordForOtp, setPasswordForOtp] = useState('');

  const router = useRouter();
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      router.push('/admin'); // Redirect if already logged in
    }
  }, [user, router]);

  const handleInitialSignUp = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsLoading(true);
    const formData = new FormData(event.currentTarget);
    const name = formData.get('name') as string;
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    setNameForOtp(name);
    setEmailForOtp(email);
    setPasswordForOtp(password);

    const result = await initiateSignUpServer(formData);
    if (result.success && result.needsOtpVerification) {
      setEmailForOtp(result.email || email); // Use email returned from server if available
      setShowOtpForm(true);
      toast({ title: "OTP Sent", description: result.message });
    } else {
      setError(result.message || "Sign up initiation failed.");
      toast({ title: "Sign Up Error", description: result.message || result.error, variant: "destructive" });
    }
    setIsLoading(false);
  };

  const handleOtpSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsLoading(true);
    const formData = new FormData(event.currentTarget);
    formData.append('email', emailForOtp);
    formData.append('password', passwordForOtp); // Pass original password for account creation

    const result = await verifyOtpAndCreateUser(formData);
    if (result.success) {
      toast({ title: "Account Created!", description: "Signing you in..." });
      // Now attempt to sign in the user on the client-side
      try {
        await signInWithEmailAndPassword(auth, emailForOtp, passwordForOtp);
        toast({ title: "Signed In!", description: "Redirecting to dashboard..." });
        router.push('/admin');
      } catch (clientSignInError: any) {
        setError(`Account created, but client sign-in failed: ${clientSignInError.message}. Please try signing in manually.`);
        toast({ title: "Sign In Required", description: `Account created, but automatic sign-in failed. Please sign in. Error: ${clientSignInError.code}`, variant: "destructive" });
        setShowOtpForm(false); // Go back to main form to allow manual sign-in
        setIsSignUpView(false); // Switch to sign-in view
      }
    } else {
      setError(result.message || "OTP verification failed.");
      toast({ title: "OTP Error", description: result.message || result.error, variant: "destructive" });
    }
    setIsLoading(false);
  };
  
  const handleResendOtpClick = async () => {
    if (!emailForOtp) return;
    setError(null);
    setIsLoading(true);
    const result = await resendOtp(emailForOtp);
    if (result.success) {
      toast({ title: "OTP Resent", description: result.message });
    } else {
      setError(result.message || "Failed to resend OTP.");
      toast({ title: "OTP Resend Error", description: result.message || result.error, variant: "destructive" });
    }
    setIsLoading(false);
  };

  const handleEmailPasswordSignIn = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsLoading(true);
    const formData = new FormData(event.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    try {
      await signInWithEmailAndPassword(auth, email, password);
      toast({ title: "Signed In!", description: "Redirecting to dashboard..." });
      router.push('/admin');
    } catch (err: any) {
      setError(err.message);
      toast({ title: "Sign In Error", description: err.message || `Error code: ${err.code}`, variant: "destructive" });
    }
    setIsLoading(false);
  };

  const handleGoogleAuth = async () => {
    setError(null);
    setIsLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const idToken = await result.user.getIdToken();
      
      // Send ID token to server
      const serverFormData = new FormData();
      serverFormData.append('idToken', idToken);
      const serverResult = await handleGoogleSignInServerAction(serverFormData);

      if (serverResult.success) {
        toast({ title: "Google Sign-In Successful!", description: "Redirecting to dashboard..." });
        router.push('/admin');
      } else {
        setError(serverResult.message || "Google Sign-In failed on server.");
        toast({ title: "Google Sign-In Error", description: serverResult.message || serverResult.error, variant: "destructive" });
      }
    } catch (err: any) {
      setError(err.message);
      toast({ title: "Google Sign-In Error", description: err.message || `Error code: ${err.code}`, variant: "destructive" });
    }
    setIsLoading(false);
  };

  const handlePasswordReset = async () => {
    const email = (document.getElementById('email') as HTMLInputElement)?.value;
    if (!email) {
      toast({ title: "Password Reset", description: "Please enter your email address first.", variant: "destructive" });
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      toast({ title: "Password Reset Email Sent", description: "Check your email for instructions to reset your password." });
    } catch (err: any) {
      setError(err.message);
      toast({ title: "Password Reset Error", description: err.message, variant: "destructive" });
    }
    setIsLoading(false);
  };


  if (showOtpForm) {
    return (
      <div className="space-y-6 animate-fadeIn">
        <h3 className="text-xl font-semibold text-center">Verify Your Email</h3>
        <p className="text-sm text-center text-muted-foreground">
          An OTP has been sent to {emailForOtp}. Please enter it below.
        </p>
        {error && (
          <Alert variant="destructive">
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <form onSubmit={handleOtpSubmit} className="space-y-4">
          <div>
            <Label htmlFor="otp" className="sr-only">OTP Code</Label>
            <Input id="otp" name="otp" type="text" placeholder="Enter OTP Code" required className="text-center tracking-widest" maxLength={6} />
          </div>
          <Button type="submit" className="w-full bg-accent hover:bg-accent/90" disabled={isLoading}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2" />} 
            Verify OTP
          </Button>
        </form>
        <Button variant="link" onClick={handleResendOtpClick} className="w-full text-sm" disabled={isLoading}>
          Didn&apos;t receive OTP? Resend.
        </Button>
         <Button variant="outline" onClick={() => {setShowOtpForm(false); setEmailForOtp(''); setError(null);}} className="w-full" disabled={isLoading}>
          Back
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fadeIn">
      <div className="text-center">
        <h3 className="text-2xl font-bold text-foreground">
          {isSignUpView ? 'Create Your Organizer Account' : 'Welcome Back, Organizer!'}
        </h3>
        <p className="text-muted-foreground">
          {isSignUpView ? 'Join to start creating and managing your events.' : 'Sign in to access your dashboard.'}
        </p>
      </div>
      
      {error && (
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Authentication Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={isSignUpView ? handleInitialSignUp : handleEmailPasswordSignIn} className="space-y-6">
        {isSignUpView && (
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input id="name" name="name" type="text" placeholder="e.g., Jane Doe" required className="pl-10" />
            </div>
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="email">Email Address</Label>
           <div className="relative">
            <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input id="email" name="email" type="email" placeholder="you@example.com" required className="pl-10" />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <KeyRound className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input id="password" name="password" type="password" placeholder="••••••••" required className="pl-10" />
          </div>
        </div>
        {!isSignUpView && (
          <div className="text-right">
            <Button type="button" variant="link" onClick={handlePasswordReset} className="text-xs px-0" disabled={isLoading}>
              Forgot password?
            </Button>
          </div>
        )}
        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (isSignUpView ? <UserPlus className="mr-2" /> : <LogIn className="mr-2" />)}
          {isSignUpView ? 'Sign Up with Email' : 'Sign In'}
        </Button>
      </form>

      <div className="relative">
        <Separator />
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-2 text-sm text-muted-foreground">
          OR
        </span>
      </div>

      <Button variant="outline" onClick={handleGoogleAuth} className="w-full" disabled={isLoading}>
        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <GoogleIcon />} 
        <span className="ml-2">Continue with Google</span>
      </Button>

      <div className="text-center">
        <Button variant="link" onClick={() => { setIsSignUpView(!isSignUpView); setError(null); }} className="text-sm" disabled={isLoading}>
          {isSignUpView ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
        </Button>
      </div>
      
      <style jsx global>{`
        .animate-fadeIn {
          animation: fadeIn 0.5s ease-out;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
