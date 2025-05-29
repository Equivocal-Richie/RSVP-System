
"use client"; // AdminLayout needs to be client for useAuth and sidebar interactions

import React from "react";
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
  SidebarTrigger,
  // SidebarFooter, // Assuming SidebarFooter might be a conceptual part of SidebarContent
} from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";
import { LayoutDashboard, BarChart3, Users, LogOut, UserCircle, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import Logo from "@/components/icons/Logo";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { usePathname, useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebaseClient';
import { useToast } from '@/hooks/use-toast';
import { cn } from "@/lib/utils";


export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading: authLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast();
  const [isSigningOut, setIsSigningOut] = React.useState(false);

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


  if (authLoading) {
     return (
        <div className="flex flex-col items-center justify-center min-h-screen">
            <p className="text-lg text-muted-foreground">Loading user session...</p>
        </div>
    );
  }

  if (!user) {
    // This check is important. If using middleware for route protection,
    // this might primarily handle the UI flicker before redirect.
    // For direct access attempts, middleware is more robust.
    router.replace('/auth'); // Redirect to login if not authenticated
    return (
        <div className="flex flex-col items-center justify-center min-h-screen">
            <p className="text-lg text-muted-foreground">Redirecting to login...</p>
        </div>
    );
  }

  const sidebarNavItems = [
    { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
    { href: "/admin/analytics", label: "Event Analytics", icon: BarChart3 },
    { href: "/admin/guests", label: "Past Guests", icon: Users },
    // { href: "/admin/settings", label: "Settings", icon: Settings }, // Example for future
  ];

  const userDisplayName = user.displayName || user.email || "Event Organizer";
  const userAvatarFallback = (user.displayName || user.email || "U").substring(0, 2).toUpperCase();

  return (
    <SidebarProvider defaultOpen>
      <div className="flex min-h-screen bg-background">
        <Sidebar collapsible="icon" variant="sidebar" className="border-r border-sidebar-border flex flex-col">
          <SidebarHeader className="p-4 flex items-center justify-between sticky top-0 bg-sidebar z-10">
             <Link href="/admin" className="group-data-[collapsible=icon]:hidden">
                <Logo />
             </Link>
             {/* SidebarTrigger for desktop collapsing / mobile opening */}
             <div className="group-data-[collapsible=icon]:mx-auto"> {/* Center trigger in icon mode */}
                <SidebarTrigger />
             </div>
          </SidebarHeader>
          <Separator className="bg-sidebar-border group-data-[collapsible=icon]:hidden" />
          
          <SidebarContent className="flex-grow p-2 overflow-y-auto">
            <SidebarMenu>
              {sidebarNavItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.href}
                    tooltip={item.label}
                  >
                    <Link href={item.href}>
                      <item.icon />
                      <span className="group-data-[collapsible=icon]:hidden">{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarContent>

          <Separator className="bg-sidebar-border group-data-[collapsible=icon]:hidden" />
          <div className="p-4 mt-auto sticky bottom-0 bg-sidebar z-10">
            <div className="flex items-center gap-3 group-data-[collapsible=icon]:justify-center">
              <Avatar className="h-10 w-10 border-2 border-sidebar-primary">
                <AvatarImage src={user.photoURL || `https://placehold.co/40x40.png?text=${userAvatarFallback}`} alt={userDisplayName} data-ai-hint="profile animal" />
                <AvatarFallback>{userAvatarFallback}</AvatarFallback>
              </Avatar>
              <div className="group-data-[collapsible=icon]:hidden flex-grow">
                <p className="text-sm font-medium text-sidebar-foreground truncate" title={userDisplayName}>{userDisplayName}</p>
                <p className="text-xs text-sidebar-foreground/70 truncate" title={user.email || ''}>{user.email}</p>
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              className="w-full justify-start mt-3 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground group-data-[collapsible=icon]:size-10 group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:justify-center"
              onClick={handleSignOut}
              disabled={isSigningOut}
              title="Sign Out"
            >
              <LogOut className="h-5 w-5" />
              <span className="ml-2 group-data-[collapsible=icon]:hidden">{isSigningOut ? "Signing out..." : "Sign Out"}</span>
            </Button>
          </div>
        </Sidebar>
        
        <SidebarInset className="flex-1 flex flex-col">
            {/* Mobile Header for Admin section, if sidebar trigger needs to be outside sidebar on mobile */}
             <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 md:hidden sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6 py-2">
                {/* On mobile, trigger is inside sidebar, this can be alternative placement or for title */}
                <div className="md:hidden"> {/* Ensure trigger is shown on mobile if needed outside sidebar */}
                    {/* <SidebarTrigger /> */}
                </div>
                <h1 className="text-lg font-semibold text-primary truncate">
                  {sidebarNavItems.find(item => item.href === pathname)?.label || "Admin Area"}
                </h1>
            </header>
            <main className="flex-1 p-4 md:p-6 overflow-auto">
             {children}
            </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
