
"use client"

import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { VariantProps, cva } from "class-variance-authority"
import { PanelLeft, X } from "lucide-react" 

import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Sheet, SheetContent, SheetClose } from "@/components/ui/sheet" // Removed RadixSheetTrigger import here as it's not needed by SidebarTrigger
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

const SIDEBAR_COOKIE_NAME = "sidebar_desktop_state_v2";
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

const SIDEBAR_WIDTH_EXPANDED = "16rem"; 
const SIDEBAR_WIDTH_COLLAPSED = "3.75rem"; // Approx 60px, suitable for icons
const SIDEBAR_WIDTH_MOBILE = "18rem"; 


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

  const setDesktopOpen = React.useCallback((open: boolean) => {
    setDesktopOpenState(open);
    if (typeof window !== "undefined") {
      document.cookie = `${SIDEBAR_COOKIE_NAME}=${open}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`;
    }
  }, []);

  const toggleDesktopSidebar = () => setDesktopOpen(!isDesktopOpenState)
  const toggleMobileSidebar = () => setMobileOpen(!isMobileOpen)

  React.useEffect(() => {
    if (isMobile) {
      setMobileOpen(false); 
    }
  }, [isMobile]);


  const contextValue = React.useMemo(() => ({
    isDesktopOpen: isDesktopOpenState,
    setDesktopOpen,
    isMobileOpen,
    setMobileOpen,
    isMobile,
    toggleDesktopSidebar,
    toggleMobileSidebar,
    isDesktopCollapsed: !isDesktopOpenState && !isMobile, 
  }), [isDesktopOpenState, isMobileOpen, isMobile, setDesktopOpen, toggleDesktopSidebar, toggleMobileSidebar]);

  return (
    <SidebarContext.Provider value={contextValue}>
      <TooltipProvider delayDuration={100}> 
        {children}
      </TooltipProvider>
    </SidebarContext.Provider>
  )
}

export const Sidebar = React.forwardRef<
  HTMLDivElement, 
  React.HTMLAttributes<HTMLDivElement> & { children: React.ReactNode }
>(({ className, children, ...props }, ref) => {
  const { isMobile, isMobileOpen, setMobileOpen, isDesktopOpen } = useSidebar();

  if (isMobile) {
    return (
      <Sheet open={isMobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="left"
          className={cn(
            "flex flex-col bg-sidebar text-sidebar-foreground p-0 border-r border-sidebar-border shadow-xl w-[var(--sidebar-width-mobile)]",
            className
          )}
          style={{ '--sidebar-width-mobile': SIDEBAR_WIDTH_MOBILE } as React.CSSProperties}
          showCloseButton={false} 
          {...props} 
        >
          {children}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <aside
      ref={ref}
      data-state={isDesktopOpen ? "expanded" : "collapsed"}
      className={cn(
        "hidden md:flex flex-col fixed top-0 left-0 h-full z-40 bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-all duration-300 ease-in-out overflow-y-auto", 
        isDesktopOpen ? "w-[var(--sidebar-width-expanded)]" : "w-[var(--sidebar-width-collapsed)]",
        className
      )}
      style={{
        '--sidebar-width-expanded': SIDEBAR_WIDTH_EXPANDED,
        '--sidebar-width-collapsed': SIDEBAR_WIDTH_COLLAPSED,
      } as React.CSSProperties}
      {...props}
    >
      {children}
    </aside>
  );
});
Sidebar.displayName = "Sidebar";


export const SidebarTrigger = React.forwardRef<
  React.ElementRef<typeof Button>,
  Omit<React.ComponentProps<typeof Button>, "onClick" | "aria-label"> & { "aria-label"?: string}
>(({ className, children, ...props }, ref) => {
  const { toggleDesktopSidebar, isMobile, isMobileOpen, setMobileOpen, isDesktopOpen } = useSidebar();
  
  if (isMobile) {
    return (
      <Button
        ref={ref}
        variant="ghost"
        size="icon"
        className={cn("text-foreground hover:bg-accent/10 md:hidden", className)} 
        onClick={() => setMobileOpen(!isMobileOpen)}
        aria-label={isMobileOpen ? "Close menu" : "Open menu"}
        {...props}
      >
        {children || (isMobileOpen ? <X className="h-5 w-5" /> : <PanelLeft className="h-5 w-5" />)}
      </Button>
    );
  }

  const label = isDesktopOpen ? "Collapse menu" : "Expand menu";
  return (
    <Button
      ref={ref}
      variant="ghost"
      size="icon"
      className={cn("text-foreground hover:bg-accent/10 hidden md:flex", className)} 
      onClick={toggleDesktopSidebar}
      aria-label={label}
      {...props}
    >
      {children || <PanelLeft className="h-5 w-5" />}
    </Button>
  );
});
SidebarTrigger.displayName = "SidebarTrigger";


export const SidebarHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => {
  const { isMobile, toggleMobileSidebar, isMobileOpen } = useSidebar();
  return (
    <div
      ref={ref}
      className={cn(
        "h-16 flex items-center justify-between border-b border-sidebar-border shrink-0",
        isMobile ? "px-4" : "px-3", 
        className)} 
      {...props}
    >
      {children}
      {isMobile && isMobileOpen && ( 
         <Button variant="ghost" size="icon" onClick={toggleMobileSidebar} aria-label="Close menu" className="text-sidebar-foreground hover:bg-sidebar-accent">
            <X className="h-5 w-5"/>
         </Button>
      )}
    </div>
  )
});
SidebarHeader.displayName = "SidebarHeader";

export const SidebarContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex-grow overflow-y-auto overflow-x-hidden p-3 space-y-1.5", className)} 
    {...props}
  />
));
SidebarContent.displayName = "SidebarContent";


export const SidebarMenu = React.forwardRef<
  HTMLUListElement,
  React.HTMLAttributes<HTMLUListElement>
>(({ className, ...props }, ref) => (
  <ul
    ref={ref}
    className={cn("flex flex-col", className)} 
    {...props}
  />
));
SidebarMenu.displayName = "SidebarMenu";


export const SidebarMenuItem = React.forwardRef<
  HTMLLIElement,
  React.HTMLAttributes<HTMLLIElement>
>(({ className, ...props }, ref) => (
  <li
    ref={ref}
    className={cn("", className)} 
    {...props}
  />
));
SidebarMenuItem.displayName = "SidebarMenuItem";


const sidebarMenuButtonVariants = cva(
  "flex items-center w-full text-left rounded-md text-sm font-medium transition-colors duration-150 ease-in-out outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-1 focus-visible:ring-offset-sidebar-background disabled:opacity-50 disabled:pointer-events-none",
  {
    variants: {
      isActive: {
        true: "bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90",
        false: "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
      },
      isCollapsed: { 
        true: "justify-center p-2.5 aspect-square", 
        false: "px-3 py-2.5 gap-3", 
      }
    },
    defaultVariants: {
      isActive: false,
    },
  }
)

export const SidebarMenuButton = React.forwardRef<
  HTMLButtonElement, 
  React.ButtonHTMLAttributes<HTMLButtonElement> & 
  VariantProps<typeof sidebarMenuButtonVariants> & {
    asChild?: boolean;
    tooltip?: string | React.ReactNode;
  }
>(({ className, children, asChild, isActive, tooltip, ...props }, ref) => {
  const { isDesktopCollapsed, isMobile } = useSidebar();
  const Comp = asChild ? Slot : "button";

  const effectiveIsCollapsed = !isMobile && isDesktopCollapsed;

  const buttonContent = (
    <Comp
      ref={ref}
      className={cn(sidebarMenuButtonVariants({ isActive, isCollapsed: effectiveIsCollapsed }), className)}
      {...props}
    >
      {children}
    </Comp>
  );

  if (effectiveIsCollapsed && tooltip) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{buttonContent}</TooltipTrigger>
        <TooltipContent side="right" align="center" className="ml-2 bg-sidebar-accent text-sidebar-accent-foreground border-sidebar-border">
          {typeof tooltip === 'string' ? <p>{tooltip}</p> : tooltip}
        </TooltipContent>
      </Tooltip>
    );
  }

  return buttonContent;
});
SidebarMenuButton.displayName = "SidebarMenuButton";


export const SidebarFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("mt-auto border-t border-sidebar-border shrink-0", className)} 
    {...props}
  />
));
SidebarFooter.displayName = "SidebarFooter";


export const SidebarInset = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  const { isMobile, isDesktopOpen } = useSidebar();

  return (
    <div
      ref={ref}
      className={cn(
        "flex flex-col flex-1 transition-all duration-300 ease-in-out overflow-hidden", 
        !isMobile && 
          (isDesktopOpen
            ? "md:ml-[var(--sidebar-width-expanded)]"
            : "md:ml-[var(--sidebar-width-collapsed)]"),
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
