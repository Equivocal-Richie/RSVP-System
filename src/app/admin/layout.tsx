
"use client";

import React, { useEffect } from "react";
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader as OriginalSidebarHeader, // Renamed to avoid conflict if needed locally
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarInset,
  SidebarTrigger, // Correctly importing SidebarTrigger
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";
import { LayoutDashboard, BarChart3, Users, LogOut, PanelLeft, X, Settings, CalendarPlus, UserCog, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import Logo from "@/components/icons/Logo";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { usePathname, useRouter } from 'next/navigation';
import { signOut as firebaseSignOut } from 'firebase/auth';
import { auth as firebaseClientAuth } from '@/lib/firebaseClient';
import { useToast } from '@/hooks/use-toast';
import { cn } from "@/lib/utils";
import { SheetClose } from "@/components/ui/sheet"; // Keep SheetClose for direct use if needed

const AdminNavItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/create-event", label: "Create Event", icon: CalendarPlus },
  { href: "/admin/analytics", label: "Event Analytics", icon: BarChart3 },
  { href: "/admin/guests", label: "Past Guests", icon: Users },
  { href: "/admin/waitlist", label: "Waitlist", icon: ListChecks },
  // { href: "/admin/settings", label: "Settings", icon: Settings },
];

// Internal component for sidebar structure
function AdminSidebarInternalContent() {
  const { isSheetOpen, setSheetOpen } = useSidebar();
  const pathname = usePathname();

  const handleLinkClick = () => {
    setSheetOpen(false); // Close sheet on link click
  };

  return (
    <>
      <OriginalSidebarHeader className="h-16 flex items-center justify-between px-3">
        <Link href="/admin" className="flex items-center gap-2 text-sidebar-foreground hover:opacity-80" onClick={handleLinkClick}>
          <Logo className="h-8 w-auto" />
        </Link>
        {/* OriginalSidebarHeader in sidebar.tsx handles its own close for Sheet variant */}
      </OriginalSidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {AdminNavItems.map((item) => (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton
                asChild
                isActive={pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href))}
                onClick={handleLinkClick}
              >
                <Link href={item.href} className="flex items-center">
                  <item.icon className="size-5 shrink-0" />
                  <span className="ml-3 truncate">{item.label}</span>
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
  const { setSheetOpen } = useSidebar();

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await firebaseSignOut(firebaseClientAuth);
      toast({ title: "Signed Out", description: "You have been successfully signed out." });
      setSheetOpen(false);
      router.push('/');
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
    <div className="flex flex-col items-center gap-2 w-full p-3 border-t border-sidebar-border">
      <div className="flex items-center gap-3 w-full">
        <Avatar className="h-9 w-9 border-2 border-sidebar-primary shrink-0">
          <AvatarImage src={user.photoURL || undefined} alt={userDisplayName} data-ai-hint="profile animal" />
          <AvatarFallback className="bg-sidebar-accent text-sidebar-accent-foreground font-semibold">
            {userAvatarFallback}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-sidebar-foreground truncate" title={userDisplayName}>{userDisplayName}</p>
          {/* Email removed as per previous request */}
        </div>
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
            <TooltipContent side="right" align="center" className="bg-sidebar-accent text-sidebar-accent-foreground border-sidebar-border">
              <p>{isSigningOut ? "Signing out..." : "Sign Out"}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}

// Dedicated header for the admin section
const AdminHeader = () => {
  const { isSheetOpen } = useSidebar(); // Using context to know sheet state for ARIA label
  const pathname = usePathname();

  const currentNavItem = AdminNavItems.find(item => {
    if (item.href === "/admin") return pathname === "/admin";
    return item.href !== "/admin" && pathname.startsWith(item.href);
  });
  const pageTitle = currentNavItem?.label || (pathname === "/admin" ? "Dashboard" : "Admin Section");

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-border bg-background px-4 md:px-6 shadow-sm shrink-0">
      <div className="flex items-center gap-2">
        {/* This SidebarTrigger now correctly uses the imported 'SidebarTrigger' */}
        <SidebarTrigger aria-label={isSheetOpen ? "Close navigation menu" : "Open navigation menu"} />
        <h1 className="text-lg font-semibold text-foreground">{pageTitle}</h1>
      </div>
      {/* Other header items like user menu or global actions can go here if needed */}
    </header>
  );
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!authLoading && !user) {
      const currentPath = pathname + window.location.search;
      router.replace('/auth?redirect=' + encodeURIComponent(currentPath));
    }
  }, [user, authLoading, router, pathname]);

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

  if (!user && pathname.startsWith('/admin')) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background">
        <p className="text-lg text-muted-foreground">Redirecting to login...</p>
      </div>
    );
  }
  
  if (!user) return null;

  return (
    <SidebarProvider>
      <div className="flex min-h-screen bg-muted/40 dark:bg-muted/10">
        <Sidebar> {/* This is now always a Sheet based on latest sidebar.tsx logic */}
          <AdminSidebarInternalContent />
        </Sidebar>

        {/* Main content area that takes remaining space */}
        <SidebarInset className="flex flex-col flex-1 overflow-x-hidden"> {/* Ensure SidebarInset takes full height and flexes */}
          <AdminHeader />
          <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto">
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
