
"use client"; 

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import Logo from '@/components/icons/Logo';
import { Button } from '@/components/ui/button';
import { Home, LogIn, Loader2 } from 'lucide-react'; 
import { useAuth } from '@/contexts/AuthContext';
// Removed: import { auth } from '@/lib/firebaseClient';
// Removed: import { signOut } from 'firebase/auth';
// Removed: import { useToast } from '@/hooks/use-toast';
// Removed: import { useState } from 'react';

const Header = () => {
  const { user, loading: authLoading } = useAuth();
  const pathname = usePathname();
  // const router = useRouter(); // Not needed if sign-out handled by sidebar
  // const { toast } = useToast(); // Not needed
  // const [isSigningOut, setIsSigningOut] = useState(false); // Moved to AdminLayout

  const isAdminRoute = pathname.startsWith('/admin');

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

          {authLoading && !isAdminRoute ? ( // Show loader only if not in admin and loading
            <Button variant="ghost" disabled>
              <Loader2 className="h-4 w-4 animate-spin" />
            </Button>
          ) : !user && !isAdminRoute ? ( // Show sign-in only if not user and not in admin
            <Button variant="default" asChild>
              <Link href="/auth" className="flex items-center space-x-1 sm:space-x-2">
                <LogIn className="h-4 w-4" />
                <span className="hidden sm:inline">Sign In / Up</span>
              </Link>
            </Button>
          ) : null}
          {/* 
            If user is logged in AND on an admin route, the AdminLayout's sidebar handles profile/logout.
            If user is logged in AND NOT on an admin route, this header doesn't show logout for now.
            This simplifies the header logic, assuming admin actions are primary for logged-in users.
            A more complex app might have a user profile dropdown here too.
          */}
        </nav>
      </div>
    </header>
  );
};

export default Header;
