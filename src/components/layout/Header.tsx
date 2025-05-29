"use client"; 

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Logo from '@/components/icons/Logo';
import { Button } from '@/components/ui/button';
import { Home, LogIn, Loader2, UserCog } from 'lucide-react'; // Changed UserPlus to UserCog for Admin
import { useAuth } from '@/contexts/AuthContext';
import { useSidebar } from '@/components/ui/sidebar'; // Import useSidebar

const Header = () => {
  const { user, loading: authLoading } = useAuth();
  const pathname = usePathname();
  // Conditionally get sidebar context only if SidebarProvider is an ancestor
  // This check is to prevent errors if Header is used outside SidebarProvider context
  let sidebarContext = null;
  try {
    sidebarContext = useSidebar();
  } catch (e) {
    // console.warn("useSidebar used outside of SidebarProvider in Header, this is expected for non-admin routes.");
  }
  const { isMobile, toggleMobileSidebar } = sidebarContext || { isMobile: false, toggleMobileSidebar: () => {} };


  const isAdminRoute = pathname.startsWith('/admin');

  // Show a specific trigger for admin routes on mobile, if sidebar is not handling it
  const showAdminMobileTriggerInHeader = isAdminRoute && isMobile;


  return (
    <header className="bg-card border-b border-border shadow-sm sticky top-0 z-50 h-16">
      <div className="container mx-auto px-4 h-full flex items-center justify-between">
        <div className="flex items-center gap-2">
          {showAdminMobileTriggerInHeader && (
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleMobileSidebar}
              className="md:hidden text-foreground" // Show only on mobile for admin
              aria-label="Open admin menu"
            >
              <PanelLeft className="h-5 w-5" />
            </Button>
          )}
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
          
          {!authLoading && user && !isAdminRoute && ( // If logged in but NOT on an admin route
            <Button variant="outline" asChild>
              <Link href="/admin" className="flex items-center space-x-1 sm:space-x-2">
                <UserCog className="h-4 w-4" />
                <span className="hidden sm:inline">Admin</span>
              </Link>
            </Button>
          )}
          {/* Sign Out button is now in the admin sidebar's profile section */}
        </nav>
      </div>
    </header>
  );
};

export default Header;
