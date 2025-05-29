
"use client"; 

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Logo from '@/components/icons/Logo';
import { Button } from '@/components/ui/button';
import { Home, LogIn, Loader2, UserCog, LayoutDashboard } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
// Removed useSidebar import as admin sidebar trigger is handled in AdminHeader

const Header = () => {
  const { user, loading: authLoading } = useAuth();
  const pathname = usePathname();
  
  const isAdminRoute = pathname.startsWith('/admin');

  // If on an admin route, this main header will not be rendered.
  // The admin section has its own AdminHeader within AdminLayout.
  if (isAdminRoute) {
    return null; 
  }

  return (
    <header className="bg-card border-b border-border shadow-sm sticky top-0 z-50 h-16">
      <div className="container mx-auto px-4 h-full flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href="/" aria-label="RSVP Now Home">
            <Logo />
          </Link>
        </div>

        <nav className="flex items-center space-x-2 sm:space-x-4">
          <Button variant="ghost" asChild>
            <Link href="/" className="flex items-center space-x-1 sm:space-x-2">
              <Home className="h-4 w-4" />
              <span className="hidden sm:inline">Home</span>
            </Link>
          </Button>

          {authLoading && (
            <Button variant="ghost" disabled className="px-3">
              <Loader2 className="h-4 w-4 animate-spin" />
            </Button>
          )}

          {!authLoading && !user && (
            <Button variant="default" asChild>
              <Link href="/auth" className="flex items-center space-x-1 sm:space-x-2">
                <LogIn className="h-4 w-4" />
                <span className="hidden sm:inline">Sign In / Up</span>
              </Link>
            </Button>
          )}
          
          {!authLoading && user && ( // If logged in, always show Admin Dashboard link (if not on admin page itself)
            <Button variant="outline" asChild>
              <Link href="/admin" className="flex items-center space-x-1 sm:space-x-2">
                <LayoutDashboard className="h-4 w-4" />
                <span className="hidden sm:inline">Admin Dashboard</span>
              </Link>
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
};

export default Header;
    