
"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { AlertCircle, LogIn, UserPlus, Mail, KeyRound, User, Send } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
// Placeholder for server actions - will be implemented later
// import { signUpWithEmail, signInWithEmail, handleGoogleSignIn, verifyOtp, sendOtp } from '../actions';

// Placeholder for a Google icon if you don't want to use lucide-react
const GoogleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="24px" height="24px">
    <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/>
    <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/>
    <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/>
    <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.574l0.003-0.002l6.19,5.238C39.908,34.42,44,28.718,44,20C44,22.659,43.862,21.35,43.611,20.083z"/>
  </svg>
);


export default function AuthForm() {
  const [isSignUp, setIsSignUp] = useState(true);
  const [showOtpForm, setShowOtpForm] = useState(false);
  const [emailForOtp, setEmailForOtp] = useState('');
  const { toast } = useToast();

  // Placeholder action handlers
  const handleEmailPasswordSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    // const email = formData.get('email') as string;
    // const password = formData.get('password') as string;
    // const name = formData.get('name') as string; // Only for sign up

    toast({ title: "Processing...", description: "Please wait." });

    if (isSignUp) {
      // Call await signUpWithEmail(formData);
      // Mock response:
      // setEmailForOtp(email);
      // setShowOtpForm(true);
      toast({ title: "Sign Up (Mock)", description: "OTP step would be next." });
    } else {
      // Call await signInWithEmail(formData);
      // Mock response:
      toast({ title: "Sign In (Mock)", description: "Redirecting to dashboard..." });
      // router.push('/admin');
    }
  };

  const handleGoogleAuth = async () => {
    toast({ title: "Processing...", description: "Redirecting to Google." });
    // Call await handleGoogleSignIn();
    // Mock response:
    toast({ title: "Google Sign-In (Mock)", description: "Checking authentication..." });
  };

  const handleOtpSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // const formData = new FormData(event.currentTarget);
    // formData.append('email', emailForOtp);
    toast({ title: "Verifying OTP...", description: "Please wait." });
    // Call await verifyOtp(formData);
    // Mock response:
    toast({ title: "OTP Verified (Mock)", description: "Redirecting to dashboard..." });
    // router.push('/admin');
  };
  
  const handleResendOtp = async () => {
    toast({ title: "Sending OTP...", description: "Please wait."});
    // Call await sendOtp(emailForOtp);
    toast({ title: "OTP Sent (Mock)", description: "Check your email for the new OTP."});
  };


  if (showOtpForm) {
    return (
      <div className="space-y-6 animate-fadeIn">
        <h3 className="text-xl font-semibold text-center">Verify Your Email</h3>
        <p className="text-sm text-center text-muted-foreground">
          An OTP has been sent to {emailForOtp}. Please enter it below.
        </p>
        <form onSubmit={handleOtpSubmit} className="space-y-4">
          <div>
            <Label htmlFor="otp" className="sr-only">OTP Code</Label>
            <Input id="otp" name="otp" type="text" placeholder="Enter OTP Code" required className="text-center tracking-widest" maxLength={6} />
          </div>
          <Button type="submit" className="w-full bg-accent hover:bg-accent/90">
            <Send className="mr-2" /> Verify OTP
          </Button>
        </form>
        <Button variant="link" onClick={handleResendOtp} className="w-full text-sm">
          Didn&apos;t receive OTP? Resend.
        </Button>
         <Button variant="outline" onClick={() => {setShowOtpForm(false); setEmailForOtp('');}} className="w-full">
          Back to Sign Up
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fadeIn">
      <div className="text-center">
        <h3 className="text-2xl font-bold text-foreground">
          {isSignUp ? 'Create Your Organizer Account' : 'Welcome Back, Organizer!'}
        </h3>
        <p className="text-muted-foreground">
          {isSignUp ? 'Join to start creating and managing your events.' : 'Sign in to access your dashboard.'}
        </p>
      </div>

      <form onSubmit={handleEmailPasswordSubmit} className="space-y-6">
        {isSignUp && (
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

        {/* Placeholder for form errors */}
        {/* <div className="text-destructive text-sm">Error message here</div> */}

        <Button type="submit" className="w-full">
          {isSignUp ? <UserPlus className="mr-2" /> : <LogIn className="mr-2" />}
          {isSignUp ? 'Sign Up with Email' : 'Sign In'}
        </Button>
      </form>

      <div className="relative">
        <Separator />
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-2 text-sm text-muted-foreground">
          OR
        </span>
      </div>

      <Button variant="outline" onClick={handleGoogleAuth} className="w-full">
        <GoogleIcon /> <span className="ml-2">Continue with Google</span>
      </Button>

      <div className="text-center">
        <Button variant="link" onClick={() => setIsSignUp(!isSignUp)} className="text-sm">
          {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
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
