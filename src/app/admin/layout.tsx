
"use client";

import React from "react";
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarInset,
  SidebarTrigger as ExternalSidebarTrigger, 
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";
import { LayoutDashboard, BarChart3, Users, LogOut, PanelLeft, Settings, CalendarPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import Logo from "@/components/icons/Logo";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { usePathname, useRouter } from 'next/navigation';
import { signOut as firebaseSignOut } from 'firebase/auth'; // Renamed to avoid conflict
import { auth as firebaseClientAuth } from '@/lib/firebaseClient'; 
import { useToast } from '@/hooks/use-toast';
import { cn } from "@/lib/utils";

const AdminNavItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/create-event", label: "Create Event", icon: CalendarPlus},
  { href: "/admin/analytics", label: "Event Analytics", icon: BarChart3 },
  { href: "/admin/guests", label: "Past Guests", icon: Users },
  // { href: "/admin/settings", label: "Settings", icon: Settings }, 
];

function AdminSidebarInternalContent() {
  const { isMobile, isDesktopCollapsed, setMobileOpen } = useSidebar();
  const pathname = usePathname();

  const handleLinkClick = () => {
    if (isMobile) {
      setMobileOpen(false); 
    }
  };

  return (
    <>
      <SidebarHeader className="h-16 flex items-center justify-between shrink-0 px-3">
        <Link href="/admin" className={cn("flex items-center gap-2 transition-opacity duration-300 text-sidebar-foreground hover:opacity-80", (isDesktopCollapsed && !isMobile) && "justify-center")}>
          <Logo className={cn("h-8 w-auto", (isDesktopCollapsed && !isMobile) && "h-8 w-8")} />
          <span className={cn("font-semibold text-lg", (isDesktopCollapsed && !isMobile) && "sr-only")}>RSVP Now</span>
        </Link>
        {/* Mobile close is handled by SheetTrigger in AdminHeader if using Sheet for mobile sidebar */}
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {AdminNavItems.map((item) => (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton
                asChild
                isActive={pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href))}
                tooltip={item.label}
                onClick={handleLinkClick}
              >
                <Link href={item.href} className="flex items-center">
                  <item.icon className={cn("shrink-0", (isDesktopCollapsed && !isMobile) ? "size-5" : "size-5")} /> {/* Adjusted icon size */}
                  <span className={cn("ml-3 truncate", (isDesktopCollapsed && !isMobile) && "sr-only")}>{item.label}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter>
        <UserProfileSection />
      </SidebarFooter>
    </>
  );
}

function UserProfileSection() {
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = React.useState(false);
  const { isDesktopCollapsed, isMobile } = useSidebar();

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await firebaseSignOut(firebaseClientAuth); 
      toast({ title: "Signed Out", description: "You have been successfully signed out." });
      router.push('/'); 
    } catch (error) {
      console.error("Sign out error:", error);
      toast({ title: "Sign Out Error", description: "Failed to sign out. Please try again.", variant: "destructive" });
    } finally {
      setIsSigningOut(false);
    }
  };

  if (!user) return null;

  const userDisplayName = user.displayName || user.email || "Event Organizer";
  const userAvatarFallback = (user.displayName?.substring(0,1) || user.email?.substring(0,1) || "U").toUpperCase();

  return (
    <TooltipProvider delayDuration={100}>
      <div className={cn(
        "flex flex-col items-center gap-2 w-full", 
        (isDesktopCollapsed && !isMobile) ? "p-2" : "p-3"
      )}>
        <Separator className={cn("mb-2 bg-sidebar-border", (isDesktopCollapsed && !isMobile) && "hidden")} />
        <div className={cn("flex items-center gap-3 w-full", (isDesktopCollapsed && !isMobile) && "flex-col justify-center")}>
          <Avatar className={cn("h-10 w-10 border-2 border-sidebar-primary", (isDesktopCollapsed && !isMobile) && "h-9 w-9")}>
            <AvatarImage src={user.photoURL || undefined} alt={userDisplayName} data-ai-hint="profile animal" />
            <AvatarFallback className="bg-sidebar-accent text-sidebar-accent-foreground font-semibold">
              {userAvatarFallback}
            </AvatarFallback>
          </Avatar>
          <div className={cn("flex-1 min-w-0", (isDesktopCollapsed && !isMobile) && "hidden")}>
            <p className="text-sm font-semibold text-sidebar-foreground truncate" title={userDisplayName}>{userDisplayName}</p>
            {user.email && <p className="text-xs text-sidebar-foreground/70 truncate" title={user.email}>{user.email}</p>}
          </div>
          <Tooltip>
              <TooltipTrigger asChild>
                  <Button 
                      variant="ghost" 
                      size="icon"
                      className={cn(
                          "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground shrink-0", // Added shrink-0
                          !(isDesktopCollapsed && !isMobile) && "ml-auto" 
                      )}
                      onClick={handleSignOut}
                      disabled={isSigningOut}
                      aria-label="Sign Out"
                  >
                      <LogOut className="h-5 w-5" />
                  </Button>
              </TooltipTrigger>
              <TooltipContent side="right" align="center" className="bg-sidebar-accent text-sidebar-accent-foreground border-sidebar-border">
                  <p>{isSigningOut ? "Signing out..." : "Sign Out"}</p>
              </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  );
}

// Admin specific header
function AdminHeader() {
    const { isMobile, isDesktopCollapsed } = useSidebar();
    const pathname = usePathname();
    
    const currentNavItem = AdminNavItems.find(item => {
      if (item.href === "/admin") return pathname === "/admin"; // Exact match for dashboard
      return item.href !== "/admin" && pathname.startsWith(item.href); // StartsWith for others
    });
    const pageTitle = currentNavItem?.label || (pathname === "/admin" ? "Dashboard" : "Admin");


    return (
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-border bg-background px-4 md:px-6 shadow-sm shrink-0">
            <div className="flex items-center gap-2">
                {/* This trigger controls both mobile sheet and desktop collapse */}
                <ExternalSidebarTrigger className="text-foreground hover:bg-accent/10"/> 
                <h1 className="text-lg font-semibold text-foreground hidden md:block">{pageTitle}</h1>
            </div>
            {/* Mobile page title, as sidebar is off-canvas */}
            {isMobile && <h1 className="text-lg font-semibold text-foreground md:hidden">{pageTitle}</h1>}
            
            <div className="flex items-center gap-4">
                {/* Placeholder for other header items like search, notifications */}
            </div>
        </header>
    );
}


export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  React.useEffect(() => {
    if (!authLoading && !user) {
      // If trying to access an admin route while not logged in, redirect
      if (typeof window !== 'undefined' && window.location.pathname.startsWith('/admin')) {
        router.replace('/auth?redirect=' + window.location.pathname); 
      }
    }
  }, [user, authLoading, router]);

  if (authLoading) {
     return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-background">
            <Logo className="h-12 w-auto mb-4"/>
            <p className="text-lg text-muted-foreground flex items-center gap-2">
                <LayoutDashboard className="animate-spin h-5 w-5" />
                Loading admin area...
            </p>
        </div>
    );
  }
  
  if (!user && typeof window !== 'undefined' && window.location.pathname.startsWith('/admin')) {
    // This case might be hit briefly before useEffect redirect fires.
    // Returning null or a minimal loader avoids rendering admin content to unauth users.
    return ( 
        <div className="flex flex-col items-center justify-center min-h-screen bg-background">
           <p className="text-lg text-muted-foreground">Redirecting to login...</p>
        </div>
    );
  }
  
  // If user is null and not loading, and we are on an admin page, we should not render further.
  // The useEffect above should handle redirection. If it hasn't fired yet, or if somehow this state is reached,
  // returning null prevents rendering the admin layout for unauthenticated users.
  if (!user) return null; 


  return (
    <SidebarProvider defaultOpen={true}> 
      <div className="flex min-h-screen bg-muted/40 dark:bg-muted/10"> {/* Main flex container */}
        <Sidebar> {/* Sidebar component (fixed on desktop, sheet on mobile) */}
          <AdminSidebarInternalContent />
        </Sidebar>
        
        {/* SidebarInset handles the margin adjustment for the fixed sidebar */}
        {/* It now also contains the AdminHeader and the main scrollable content */}
        <SidebarInset> 
          <AdminHeader /> 
          <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto"> {/* Scrollable main content */}
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
    

    

    