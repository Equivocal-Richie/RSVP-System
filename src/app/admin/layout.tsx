
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
} from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";
import { LayoutDashboard, BarChart3, Users, Settings, LogOut, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import Logo from "@/components/icons/Logo";
import { Separator } from "@/components/ui/separator";
import { usePathname } from 'next/navigation';
import { cn } from "@/lib/utils";


export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const pathname = usePathname();

  // This layout will only render its content if a user is authenticated.
  // Route protection for /admin/** should ideally be handled by middleware
  // or a higher-order component, but this provides a basic UI guard.
  if (!user) {
    // Optionally, you could redirect here or show a "not authorized" message.
    // For now, it might show a flicker before AuthContext redirects or AuthForm takes over.
    // A robust solution would involve route guards.
    return (
        <div className="flex flex-col items-center justify-center min-h-screen">
            <p className="text-lg text-muted-foreground">Loading or not authorized...</p>
            <p className="text-sm mt-2">If you are not redirected, please <Link href="/auth" className="text-primary underline">sign in</Link>.</p>
        </div>
    );
  }

  const sidebarNavItems = [
    { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
    { href: "/admin/analytics", label: "Event Analytics", icon: BarChart3 },
    { href: "/admin/guests", label: "Past Guests", icon: Users }, // Placeholder
  ];

  return (
    <SidebarProvider defaultOpen>
      <div className="flex min-h-screen bg-background">
        <Sidebar collapsible="icon" variant="sidebar" className="border-r border-sidebar-border">
          <SidebarHeader className="p-4 flex items-center justify-between">
             <Link href="/admin" className="group-data-[collapsible=icon]:hidden">
                <Logo />
             </Link>
             <div className="md:hidden"> {/* Show trigger only on mobile within sidebar if needed */}
                <SidebarTrigger />
             </div>
          </SidebarHeader>
          <Separator className="bg-sidebar-border group-data-[collapsible=icon]:hidden" />
          <SidebarContent className="p-2">
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
          {/* SidebarFooter can be added here later for profile/logout */}
        </Sidebar>
        
        <SidebarInset className="flex-1 flex flex-col">
            {/* Mobile Header for Admin section, including sidebar trigger */}
            <header className="md:hidden sticky top-0 z-40 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6 py-2">
                <SidebarTrigger className="sm:hidden" />
                <h1 className="text-lg font-semibold text-primary">Admin Area</h1>
            </header>
            <main className="flex-1 p-4 md:p-6 overflow-auto">
             {children}
            </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
