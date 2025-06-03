
"use client";

import React, { useEffect } from "react";
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
  ExternalSidebarTrigger, // This is the trigger from sidebar.tsx to be used in AdminHeader
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";
import { LayoutDashboard, BarChart3, Users, LogOut, PanelLeft, X, Settings, CalendarPlus, UserCog, ListChecks, UserRoundCheck, UserRoundX } from "lucide-react";
import { Button } from "@/components/ui/button";
import Logo from "@/components/icons/Logo";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { usePathname, useRouter } from 'next/navigation';
import { signOut as firebaseSignOut } from 'firebase/auth';
import { auth as firebaseClientAuth } from '@/lib/firebaseClient';
import { useToast } from '@/hooks/use-toast';
import { cn } from "@/lib/utils";
import { SheetClose } from "@/components/ui/sheet"; // Import SheetClose

const AdminNavItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/create-event", label: "Create Event", icon: CalendarPlus },
  { href: "/admin/analytics", label: "Event Analytics", icon: BarChart3 },
  { href: "/admin/guests", label: "Past Guests", icon: Users },
  { href: "/admin/waitlist", label: "Waitlist", icon: ListChecks },
  // { href: "/admin/settings", label: "Settings", icon: Settings },
];


function AdminSidebarInternalContent() {
  const { setSheetOpen, isDesktopOpen, isMobile } = useSidebar();
  const pathname = usePathname();

  const handleLinkClick = () => {
    if (isMobile) { // Only close sheet sidebar on mobile after link click
      setSheetOpen(false);
    }
  };

  return (
    <>
      <SidebarHeader className={cn("px-3 h-16 flex items-center justify-between", isDesktopOpen ? "justify-between" : "justify-center")}>
        <Link href="/admin" className={cn("flex items-center gap-2 transition-opacity duration-300 text-sidebar-foreground hover:opacity-80", !isDesktopOpen && "justify-center w-full")} onClick={handleLinkClick}>
          <Logo className={cn("h-8 w-auto", !isDesktopOpen && "h-7 w-7")} />
        </Link>
        {/* Desktop toggle is in AdminHeader, Mobile close button is part of SheetContent by default or handled by SheetClose */}
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {AdminNavItems.map((item) => (
            <SidebarMenuItem key={item.href}>
               <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <SidebarMenuButton
                        asChild
                        isActive={pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href))}
                        onClick={handleLinkClick}
                        isCollapsed={!isDesktopOpen}
                        className={cn(!isDesktopOpen && "justify-center")}
                    >
                        <Link href={item.href} className="flex items-center">
                        <item.icon className="size-5 shrink-0" />
                        {isDesktopOpen && <span className="ml-3 truncate">{item.label}</span>}
                        </Link>
                    </SidebarMenuButton>
                  </TooltipTrigger>
                  {!isDesktopOpen && (
                    <TooltipContent side="right" className="bg-sidebar-accent text-sidebar-accent-foreground border-sidebar-border">
                      <p>{item.label}</p>
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
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
  const { setSheetOpen, isDesktopOpen, isMobile } = useSidebar();

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await firebaseSignOut(firebaseClientAuth);
      toast({ title: "Signed Out", description: "You have been successfully signed out." });
      if (isMobile) setSheetOpen(false);
      router.push('/'); // Redirect to home after sign out
    } catch (error) {
      console.error("Sign out error:", error);
      toast({ title: "Sign Out Error", description: "Failed to sign out. Please try again.", variant: "destructive" });
    } finally {
      setIsSigningOut(false);
    }
  };

  if (!user) return null;

  const userDisplayName = user.displayName || user.email?.split('@')[0] || "Organizer";
  const userAvatarFallback = (user.displayName?.substring(0, 1) || user.email?.substring(0,1) || "U").toUpperCase();

  return (
    <div className={cn("flex flex-col items-center gap-2 w-full p-2 border-t border-sidebar-border")}>
      <div className={cn("flex items-center gap-3 w-full", !isDesktopOpen && "justify-center")}>
        <Avatar className="h-9 w-9 border-2 border-sidebar-primary shrink-0">
          <AvatarImage src={user.photoURL || undefined} alt={userDisplayName} data-ai-hint="profile animal" />
          <AvatarFallback className="bg-sidebar-accent text-sidebar-accent-foreground font-semibold">
            {userAvatarFallback}
          </AvatarFallback>
        </Avatar>
        {isDesktopOpen && (
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-sidebar-foreground truncate" title={userDisplayName}>{userDisplayName}</p>
            {/* Email removed as per request */}
          </div>
        )}
        <TooltipProvider delayDuration={100}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground shrink-0"
                onClick={handleSignOut}
                disabled={isSigningOut}
                aria-label="Sign Out"
              >
                <LogOut className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
             <TooltipContent side={isDesktopOpen ? "right" : "top"} align="center" className="bg-sidebar-accent text-sidebar-accent-foreground border-sidebar-border">
              <p>{isSigningOut ? "Signing out..." : "Sign Out"}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}


// AdminHeader component to house the trigger and page title
function AdminHeader() {
  const { isSheetOpen } = useSidebar(); // For mobile sheet state
  const pathname = usePathname();

  const currentNavItem = AdminNavItems.find(item => {
    if (item.href === "/admin") return pathname === "/admin";
    return item.href !== "/admin" && pathname.startsWith(item.href);
  });
  const pageTitle = currentNavItem?.label || (pathname === "/admin" ? "Dashboard" : "Admin");

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-border bg-background px-4 md:px-6 shadow-sm shrink-0">
      <div className="flex items-center gap-2">
        {/* ExternalSidebarTrigger is used here to control the sidebar */}
        <ExternalSidebarTrigger aria-label={isSheetOpen ? "Close navigation menu" : "Open navigation menu"} />
        <h1 className="text-lg font-semibold text-foreground">{pageTitle}</h1>
      </div>
      {/* Placeholder for other header items if needed */}
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

  useEffect(() => {
    if (!authLoading && !user) {
      // Store the intended redirect path before navigating to /auth
      const currentPath = window.location.pathname + window.location.search;
      router.replace('/auth?redirect=' + encodeURIComponent(currentPath));
    }
  }, [user, authLoading, router]);

  if (authLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background">
        <Logo className="h-12 w-auto mb-4" />
        <p className="text-lg text-muted-foreground flex items-center gap-2">
          <LayoutDashboard className="animate-spin h-5 w-5" />
          Loading admin area...
        </p>
      </div>
    );
  }

  // If still no user after loading and we are on an admin path, means redirect should have happened or is in progress.
  // Showing minimal UI to prevent flashing admin content before redirect.
  if (!user && typeof window !== 'undefined' && window.location.pathname.startsWith('/admin')) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background">
        <p className="text-lg text-muted-foreground">Redirecting to login...</p>
      </div>
    );
  }
  
  // If not an admin path or user is finally loaded, proceed.
  // Final check to ensure user is present before rendering admin content.
  if (!user) return null;


  return (
    <SidebarProvider>
      <div className="flex min-h-screen bg-muted/40 dark:bg-muted/10">
        <Sidebar>
          <AdminSidebarInternalContent />
        </Sidebar>

        <SidebarInset className="flex flex-col flex-1 overflow-x-hidden">
          <AdminHeader />
          <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto">
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
