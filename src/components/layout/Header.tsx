
"use client"; // Header needs to be client for useAuth and router

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Logo from '@/components/icons/Logo';
import { Button } from '@/components/ui/button';
import { Home, ShieldCheck, LogIn, LogOut, UserCircle, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { auth } from '@/lib/firebaseClient'; // Firebase client auth instance
import { signOut } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';

const Header = () => {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOut(auth);
      toast({ title: "Signed Out", description: "You have been successfully signed out." });
      router.push('/'); // Redirect to home page after sign out
    } catch (error) {
      console.error("Sign out error:", error);
      toast({ title: "Sign Out Error", description: "Failed to sign out. Please try again.", variant: "destructive" });
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <header className="bg-card border-b border-border shadow-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" aria-label="RSVP Now Home">
          <Logo />
        </Link>
        <nav className="flex items-center space-x-2 sm:space-x-4">
          <Button variant="ghost" asChild>
            <Link href="/" className="flex items-center space-x-1 sm:space-x-2">
              <Home className="h-4 w-4" />
              <span className="hidden sm:inline">Home</span>
            </Link>
          </Button>

          {authLoading ? (
            <Button variant="ghost" disabled>
              <Loader2 className="h-4 w-4 animate-spin" />
            </Button>
          ) : user ? (
            <>
              <Button variant="ghost" asChild>
                <Link href="/admin" className="flex items-center space-x-1 sm:space-x-2">
                  <ShieldCheck className="h-4 w-4" />
                  <span className="hidden sm:inline">Dashboard</span>
                </Link>
              </Button>
              <Button variant="outline" onClick={handleSignOut} disabled={isSigningOut} className="flex items-center space-x-1 sm:space-x-2">
                {isSigningOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
                <span className="hidden sm:inline">Sign Out</span>
              </Button>
            </>
          ) : (
            <Button variant="default" asChild>
              <Link href="/auth" className="flex items-center space-x-1 sm:space-x-2">
                <LogIn className="h-4 w-4" />
                <span className="hidden sm:inline">Sign In / Up</span>
              </Link>
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
};

export default Header;
