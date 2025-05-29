"use client"

import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { VariantProps, cva } from "class-variance-authority"
import { PanelLeft, X } from "lucide-react" 

import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Sheet, SheetContent, SheetClose } from "@/components/ui/sheet" 
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

const SIDEBAR_COOKIE_NAME = "sidebar_desktop_state_v2" // New cookie name to reset state
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7 // 7 days
const SIDEBAR_WIDTH_EXPANDED = "16rem" // 256px
const SIDEBAR_WIDTH_COLLAPSED = "3.75rem" // 60px (for icons + padding)
const SIDEBAR_WIDTH_MOBILE = "18rem" // Width for mobile off-canvas sheet

interface SidebarContextProps {
  isDesktopOpen: boolean;
  setDesktopOpen: (open: boolean) => void;
  isMobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  isMobile: boolean;
  toggleDesktopSidebar: () => void;
  toggleMobileSidebar: () => void;
  isDesktopCollapsed: boolean;
}

const SidebarContext = React.createContext<SidebarContextProps | null>(null)

export function useSidebar() {
  const context = React.useContext(SidebarContext)
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider.")
  }
  return context
}

export const SidebarProvider: React.FC<React.PropsWithChildren<{ defaultOpen?: boolean }>> = ({
  children,
  defaultOpen = true,
}) => {
  const isMobile = useIsMobile()
  const [isMobileOpen, setMobileOpen] = React.useState(false)
  
  const [isDesktopOpenState, setDesktopOpenState] = React.useState(() => {
    if (typeof window !== "undefined") {
      const cookieValue = document.cookie
        .split("; ")
        .find((row) => row.startsWith(`${SIDEBAR_COOKIE_NAME}=`))
        ?.split("=")[1];
      return cookieValue ? cookieValue === "true" : defaultOpen;
    }
    return defaultOpen;
  });

  const setDesktopOpen = (open: boolean) => {
    setDesktopOpenState(open);
    if (typeof window !== "undefined") {
      document.cookie = `${SIDEBAR_COOKIE_NAME}=${open}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`;
    }
  };

  const toggleDesktopSidebar = () => setDesktopOpen(!isDesktopOpenState)
  const toggleMobileSidebar = () => setMobileOpen(!isMobileOpen)

  const contextValue = React.useMemo(() => ({
    isDesktopOpen: isDesktopOpenState,
    setDesktopOpen,
    isMobileOpen,
    setMobileOpen,
    isMobile,
    toggleDesktopSidebar,
    toggleMobileSidebar,
    isDesktopCollapsed: !isDesktopOpenState,
  }), [isDesktopOpenState, isMobileOpen, isMobile, setDesktopOpen]);

  return (
    <SidebarContext.Provider value={contextValue}>
      <TooltipProvider delayDuration={0}>
        {children}
      </TooltipProvider>
    </SidebarContext.Provider>
  )
}

// Main Sidebar Container
export const Sidebar = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { collapsible?: "icon" | "none", side?: "left" | "right" }
>(({ className, children, collapsible = "icon", side = "left", ...props }, ref) => {
  const { isMobile, isMobileOpen, setMobileOpen, isDesktopOpen, isDesktopCollapsed } = useSidebar();

  if (isMobile) {
    return (
      <Sheet open={isMobileOpen} onOpenChange={setMobileOpen}>
        {/* Trigger will be handled by SidebarTrigger component placed in header or layout */}
        <SheetContent
          side={side}
          className={cn(
            "flex flex-col bg-sidebar text-sidebar-foreground p-0 border-sidebar-border shadow-xl",
            "w-[var(--sidebar-width-mobile)]" ,
            className
          )}
          style={{ '--sidebar-width-mobile': SIDEBAR_WIDTH_MOBILE } as React.CSSProperties}
          showCloseButton={false} // We'll use a custom close button inside if needed or let overlay click close
          {...props}
        >
          {children} 
          {/* The SheetContent itself has an X button by default from its own component */}
        </SheetContent>
      </Sheet>
    );
  }

  // Desktop Sidebar
  return (
    <div
      ref={ref}
      data-state={isDesktopOpen ? "expanded" : "collapsed"}
      data-collapsible={collapsible}
      className={cn(
        "hidden md:flex flex-col h-screen sticky top-0 bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-all duration-300 ease-in-out",
        collapsible === "icon" && (isDesktopCollapsed ? "w-[var(--sidebar-width-collapsed)]" : "w-[var(--sidebar-width-expanded)]"),
        collapsible === "none" && "w-[var(--sidebar-width-expanded)]",
        className
      )}
      style={{
        '--sidebar-width-expanded': SIDEBAR_WIDTH_EXPANDED,
        '--sidebar-width-collapsed': SIDEBAR_WIDTH_COLLAPSED,
      } as React.CSSProperties}
      {...props}
    >
      {children}
    </div>
  );
});
Sidebar.displayName = "Sidebar";

// Sidebar Trigger
export const SidebarTrigger = React.forwardRef<
  React.ElementRef<typeof Button>,
  React.ComponentProps<typeof Button>
>(({ className, children, ...props }, ref) => {
  const { toggleDesktopSidebar, toggleMobileSidebar, isMobile, isMobileOpen, isDesktopCollapsed } = useSidebar();
  const Icon = isMobile ? (isMobileOpen ? X : PanelLeft) : (isDesktopCollapsed ? PanelLeft : PanelLeft); // Could use different icon for collapsed state

  return (
    <Button
      ref={ref}
      variant="ghost"
      size="icon"
      className={cn(
        "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        className
      )}
      onClick={isMobile ? toggleMobileSidebar : toggleDesktopSidebar}
      aria-label={isMobile ? (isMobileOpen ? "Close sidebar" : "Open sidebar") : (isDesktopCollapsed ? "Expand sidebar" : "Collapse sidebar")}
      {...props}
    >
      {children || <Icon className="h-5 w-5" />}
    </Button>
  );
});
SidebarTrigger.displayName = "SidebarTrigger";


// Sidebar Header
export const SidebarHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("p-3 flex items-center justify-between border-b border-sidebar-border", className)} // Adjusted padding
    {...props}
  />
));
SidebarHeader.displayName = "SidebarHeader";

// Sidebar Content (Scrollable Area for Menu)
export const SidebarContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex-grow overflow-y-auto overflow-x-hidden p-3 space-y-2", className)} // Adjusted padding
    {...props}
  />
));
SidebarContent.displayName = "SidebarContent";


// Sidebar Menu (UL)
export const SidebarMenu = React.forwardRef<
  HTMLUListElement,
  React.HTMLAttributes<HTMLUListElement>
>(({ className, ...props }, ref) => (
  <ul
    ref={ref}
    className={cn("flex flex-col gap-1", className)}
    {...props}
  />
));
SidebarMenu.displayName = "SidebarMenu";


// Sidebar Menu Item (LI)
export const SidebarMenuItem = React.forwardRef<
  HTMLLIElement,
  React.HTMLAttributes<HTMLLIElement>
>(({ className, ...props }, ref) => (
  <li
    ref={ref}
    className={cn("relative", className)}
    {...props}
  />
));
SidebarMenuItem.displayName = "SidebarMenuItem";


// Sidebar Menu Button (Button or A)
const sidebarMenuButtonVariants = cva(
  "flex items-center w-full text-left rounded-md text-sm font-medium transition-colors duration-150 ease-in-out outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-1 focus-visible:ring-offset-sidebar-background disabled:opacity-50 disabled:pointer-events-none",
  {
    variants: {
      isActive: {
        true: "bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90",
        false: "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
      },
      isCollapsed: {
        true: "justify-center p-2.5 [&_svg]:size-5", // Increased padding and icon size for collapsed
        false: "p-2.5 gap-3 [&_svg]:size-5", // Increased padding
      }
    },
    defaultVariants: {
      isActive: false,
      isCollapsed: false,
    },
  }
)

export const SidebarMenuButton = React.forwardRef<
  HTMLButtonElement, // Assuming button, but can be an anchor too
  React.ButtonHTMLAttributes<HTMLButtonElement> & // Or React.AnchorHTMLAttributes<HTMLAnchorElement>
  VariantProps<typeof sidebarMenuButtonVariants> & {
    asChild?: boolean;
    tooltip?: string | React.ReactNode; // For collapsed state
  }
>(({ className, children, asChild, isActive, tooltip, ...props }, ref) => {
  const { isDesktopCollapsed, isMobile } = useSidebar();
  const Comp = asChild ? Slot : "button"; // Or "a" if used with Link

  const buttonContent = (
    <Comp
      ref={ref}
      className={cn(sidebarMenuButtonVariants({ isActive, isCollapsed: !isMobile && isDesktopCollapsed }), className)}
      {...props}
    >
      {children}
    </Comp>
  );

  if (!isMobile && isDesktopCollapsed && tooltip) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{buttonContent}</TooltipTrigger>
        <TooltipContent side="right" align="center" className="ml-2">
          {typeof tooltip === 'string' ? <p>{tooltip}</p> : tooltip}
        </TooltipContent>
      </Tooltip>
    );
  }

  return buttonContent;
});
SidebarMenuButton.displayName = "SidebarMenuButton";


// Sidebar Footer
export const SidebarFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("mt-auto p-3 border-t border-sidebar-border", className)} // Adjusted padding
    {...props}
  />
));
SidebarFooter.displayName = "SidebarFooter";


// SidebarInset (Main Content Wrapper)
export const SidebarInset = React.forwardRef<
  HTMLDivElement, // Changed from main to div for more general use
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  const { isMobile, isDesktopCollapsed } = useSidebar();

  return (
    <div // Changed from main to div
      ref={ref}
      className={cn(
        "flex-1 flex flex-col overflow-x-hidden transition-all duration-300 ease-in-out",
        !isMobile && (isDesktopCollapsed ? "md:ml-[var(--sidebar-width-collapsed)]" : "md:ml-[var(--sidebar-width-expanded)]"),
        className
      )}
      style={{
        '--sidebar-width-expanded': SIDEBAR_WIDTH_EXPANDED,
        '--sidebar-width-collapsed': SIDEBAR_WIDTH_COLLAPSED,
      } as React.CSSProperties}
      {...props}
    />
  );
});
SidebarInset.displayName = "SidebarInset";
