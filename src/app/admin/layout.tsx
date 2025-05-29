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
  SidebarTrigger,
  useSidebar, // Import useSidebar to allow child components to access context
} from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";
import { LayoutDashboard, BarChart3, Users, LogOut, Settings, PanelLeft, Image as ImageIcon } from "lucide-react"; // Added ImageIcon
import { Button } from "@/components/ui/button";
import Logo from "@/components/icons/Logo";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { usePathname, useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebaseClient';
import { useToast } from '@/hooks/use-toast';
import { cn } from "@/lib/utils";

const AdminNavItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/analytics", label: "Event Analytics", icon: BarChart3 },
  { href: "/admin/guests", label: "Past Guests", icon: Users },
  // { href: "/admin/settings", label: "Settings", icon: Settings }, // Example
];

function AdminSidebarContent() {
  const { isDesktopCollapsed, isMobile, setMobileOpen } = useSidebar();
  const pathname = usePathname();

  const handleLinkClick = () => {
    if (isMobile) {
      setMobileOpen(false); // Close mobile sidebar on link click
    }
  };

  return (
    <>
      <SidebarHeader>
        <Link href="/admin" className={cn("transition-opacity duration-300", isDesktopCollapsed && !isMobile ? "opacity-0 w-0 h-0" : "opacity-100")}>
          <Logo />
        </Link>
        {/* SidebarTrigger for desktop collapsing. Mobile trigger is in AdminMobileHeader */}
        {!isMobile && <SidebarTrigger />}
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {AdminNavItems.map((item) => (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton
                asChild
                isActive={pathname === item.href}
                tooltip={item.label}
                onClick={handleLinkClick}
              >
                <Link href={item.href} className="flex items-center">
                  <item.icon />
                  {!isMobile && isDesktopCollapsed ? null : <span className="ml-3 truncate">{item.label}</span>}
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
      await signOut(auth);
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
  const userAvatarFallback = (user.displayName || user.email || "U")?.[0]?.toUpperCase() || "U";

  return (
    <div className={cn("flex flex-col items-center gap-2", isDesktopCollapsed && !isMobile ? "p-1" : "p-0")}>
      <Avatar className={cn("h-12 w-12 border-2 border-sidebar-primary", isDesktopCollapsed && !isMobile ? "h-10 w-10" : "")}>
        <AvatarImage src={user.photoURL || undefined} alt={userDisplayName} data-ai-hint="profile animal" />
        <AvatarFallback className="bg-sidebar-accent text-sidebar-accent-foreground">
          {userAvatarFallback}
        </AvatarFallback>
      </Avatar>
      {!isDesktopCollapsed && !isMobile && (
        <div className="text-center">
          <p className="text-sm font-medium text-sidebar-foreground truncate max-w-[180px]" title={userDisplayName}>{userDisplayName}</p>
          <p className="text-xs text-sidebar-foreground/70 truncate max-w-[180px]" title={user.email || ''}>{user.email}</p>
        </div>
      )}
      <Button 
        variant="ghost" 
        size={isDesktopCollapsed && !isMobile ? "icon" : "sm"}
        className="w-full justify-center text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        onClick={handleSignOut}
        disabled={isSigningOut}
        title="Sign Out"
      >
        <LogOut className="h-5 w-5" />
        {!isDesktopCollapsed && !isMobile && <span className="ml-2">{isSigningOut ? "Signing out..." : "Sign Out"}</span>}
      </Button>
    </div>
  );
}


function AdminMobileHeader() {
    const { isMobile } = useSidebar();
    const pathname = usePathname();
    const currentNavItem = AdminNavItems.find(item => item.href === pathname);
    const pageTitle = currentNavItem?.label || "Admin";

    if (!isMobile) return null;

    return (
        <header className="sticky top-0 z-40 flex h-14 items-center justify-between gap-4 border-b bg-background px-4 sm:px-6 md:hidden">
            <SidebarTrigger /> {/* Mobile trigger */}
            <h1 className="text-lg font-semibold text-primary truncate">{pageTitle}</h1>
            <div className="w-8"> {/* Spacer to balance trigger */} </div>
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
      router.replace('/auth');
    }
  }, [user, authLoading, router]);

  if (authLoading || !user) {
     return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-background">
            {/* You can add a spinner or loading animation here */}
            <p className="text-lg text-muted-foreground">Loading admin area...</p>
        </div>
    );
  }

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex min-h-screen bg-background">
        <Sidebar collapsible="icon">
          <AdminSidebarContent />
        </Sidebar>
        
        <SidebarInset>
            <AdminMobileHeader />
            <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-auto">
             {children}
            </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
