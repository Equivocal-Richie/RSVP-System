
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
  SidebarTrigger as ExternalSidebarTrigger, // Renamed to avoid conflict
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";
import { LayoutDashboard, BarChart3, Users, LogOut, PanelLeft, Image as ImageIcon, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import Logo from "@/components/icons/Logo";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { usePathname, useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { auth as firebaseClientAuth } from '@/lib/firebaseClient'; // Renamed to avoid conflict with admin auth
import { useToast } from '@/hooks/use-toast';
import { cn } from "@/lib/utils";

const AdminNavItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/analytics", label: "Event Analytics", icon: BarChart3 },
  { href: "/admin/guests", label: "Past Guests", icon: Users },
  // { href: "/admin/settings", label: "Settings", icon: Settings }, // Example
];

function AdminSidebarInternalContent() {
  const { isMobile, isDesktopCollapsed, setMobileOpen } = useSidebar();
  const pathname = usePathname();

  const handleLinkClick = () => {
    if (isMobile) {
      setMobileOpen(false); // Close mobile sidebar on link click
    }
  };

  return (
    <>
      <SidebarHeader>
        <Link href="/admin" className={cn("flex items-center gap-2 transition-opacity duration-300 text-sidebar-foreground hover:opacity-80", (isDesktopCollapsed && !isMobile) && "justify-center")}>
          <Logo className={cn((isDesktopCollapsed && !isMobile) ? "h-8 w-8" : "h-7 w-auto")} />
          <span className={cn("font-semibold text-lg", (isDesktopCollapsed && !isMobile) && "sr-only")}>RSVP Now</span>
        </Link>
        {/* The mobile close button is now inside SidebarHeader component itself */}
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
                  <item.icon className={cn("shrink-0", (isDesktopCollapsed && !isMobile) ? "size-6" : "size-5")} />
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
      await signOut(firebaseClientAuth); // Use the renamed firebase client auth
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
    <div className={cn("flex flex-col items-center gap-2 w-full", (isDesktopCollapsed && !isMobile) ? "p-2" : "p-3")}>
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
                        "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                        !(isDesktopCollapsed && !isMobile) && "ml-auto" // Only ml-auto if sidebar is expanded
                    )}
                    onClick={handleSignOut}
                    disabled={isSigningOut}
                >
                    <LogOut className="h-5 w-5" />
                </Button>
            </TooltipTrigger>
            <TooltipContent side="top" align="center" className="bg-sidebar-accent text-sidebar-accent-foreground border-sidebar-border">
                <p>{isSigningOut ? "Signing out..." : "Sign Out"}</p>
            </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}

// New Admin specific header
function AdminHeader() {
    const { isMobile } = useSidebar();
    const pathname = usePathname();
    const currentNavItem = AdminNavItems.find(item => pathname.startsWith(item.href));
    const pageTitle = currentNavItem?.label || "Admin";

    return (
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b bg-background px-4 md:px-6 shadow-sm">
            <div className="flex items-center gap-2">
                {/* Use the SidebarTrigger imported from your ui/sidebar component */}
                <ExternalSidebarTrigger className="text-primary"/>
                <h1 className="text-lg font-semibold text-foreground hidden md:block">{pageTitle}</h1>
            </div>
            {/* Placeholder for other header items like search, notifications, user menu if needed */}
            <div className="flex items-center gap-4">
                {/* Example: <Button variant="outline" size="icon"><Settings className="h-5 w-5"/></Button> */}
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
      router.replace('/auth?redirect=/admin'); // Redirect to auth if not logged in, with callback
    }
  }, [user, authLoading, router]);

  if (authLoading || (!user && typeof window !== 'undefined' && window.location.pathname.startsWith('/admin'))) {
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
  // If still no user after loading and already on an admin path, this might flicker before redirect.
  // The redirect in useEffect should handle it.
  if (!user) return null; 


  return (
    <SidebarProvider defaultOpen={true}> {/* Ensure defaultOpen is true for desktop */}
      <div className="flex min-h-screen bg-muted/40"> {/* Slightly off-white background for content area */}
        <Sidebar>
          <AdminSidebarInternalContent />
        </Sidebar>
        
        <div className="flex flex-col flex-1"> {/* Wrapper for header and content inset */}
            <AdminHeader />
            <SidebarInset> {/* SidebarInset now just handles margin based on sidebar state */}
                <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-auto">
                {children}
                </main>
            </SidebarInset>
        </div>
      </div>
    </SidebarProvider>
  );
}
    