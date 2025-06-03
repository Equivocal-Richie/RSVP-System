
"use client"

import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { VariantProps, cva } from "class-variance-authority"
import { PanelLeft, X } from "lucide-react"

import { useIsMobile } from "@/hooks/use-mobile" // Retain for potential future device-specific tweaks, though core logic is unified.
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetClose, SheetTitle, SheetTrigger as RadixSheetTrigger } from "@/components/ui/sheet"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

const SIDEBAR_WIDTH_SHEET = "18rem"; // Unified width for the sheet sidebar

interface SidebarContextProps {
  isSheetOpen: boolean;
  setSheetOpen: (open: boolean) => void;
  toggleSheet: () => void;
}

const SidebarContext = React.createContext<SidebarContextProps | null>(null)

export function useSidebar() {
  const context = React.useContext(SidebarContext)
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider.")
  }
  return context
}

export const SidebarProvider: React.FC<React.PropsWithChildren<{}>> = ({ children }) => {
  const [isSheetOpen, setSheetOpen] = React.useState(false);

  const toggleSheet = () => setSheetOpen(prev => !prev);

  const contextValue = React.useMemo(() => ({
    isSheetOpen,
    setSheetOpen,
    toggleSheet,
  }), [isSheetOpen, setSheetOpen, toggleSheet]);

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
  const { isSheetOpen, setSheetOpen } = useSidebar();

  return (
    <Sheet open={isSheetOpen} onOpenChange={setSheetOpen}>
      {/* The RadixSheetTrigger is now expected to be rendered by the consumer (e.g., AdminHeader) */}
      {/* and will control the Sheet's open state via context or direct prop passing */}
      <SheetContent
        side="left"
        className={cn(
          "flex flex-col bg-sidebar text-sidebar-foreground p-0 border-r border-sidebar-border shadow-xl w-[var(--sidebar-width-sheet)]",
          className
        )}
        style={{ '--sidebar-width-sheet': SIDEBAR_WIDTH_SHEET } as React.CSSProperties}
        showCloseButton={false} // We will use a custom close button in SidebarHeader
        ref={ref} // Pass ref to SheetContent if needed by Radix
        {...props} // Pass other props to SheetContent
      >
        <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
        {children}
      </SheetContent>
    </Sheet>
  );
});
Sidebar.displayName = "Sidebar";


export const SidebarTrigger = React.forwardRef<
  React.ElementRef<typeof Button>,
  Omit<React.ComponentProps<typeof Button>, "onClick" | "aria-label"> & { "aria-label"?: string }
>(({ className, children, ...props }, ref) => {
  const { isSheetOpen, toggleSheet } = useSidebar();

  return (
    // This button is the actual trigger that the user clicks.
    // It is NOT a RadixSheetTrigger itself, but controls the Sheet via context.
    <Button
      ref={ref}
      variant="ghost"
      size="icon"
      className={cn("text-foreground hover:bg-accent/10", className)}
      onClick={toggleSheet}
      aria-label={isSheetOpen ? "Close menu" : "Open menu"}
      {...props}
    >
      {children || (isSheetOpen ? <X className="h-5 w-5" /> : <PanelLeft className="h-5 w-5" />)}
    </Button>
  );
});
SidebarTrigger.displayName = "SidebarTrigger";


export const SidebarHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => {
  const { setSheetOpen } = useSidebar(); // Use context to close
  return (
    <div
      ref={ref}
      className={cn(
        "flex items-center justify-between border-b border-sidebar-border shrink-0 px-3 h-16",
        className)}
      {...props}
    >
      {children}
      {/* Custom Close Button for the sheet */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setSheetOpen(false)}
        aria-label="Close menu"
        className="text-sidebar-foreground hover:bg-sidebar-accent"
      >
        <X className="h-5 w-5" />
      </Button>
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
  "flex items-center w-full text-left rounded-md text-sm font-medium transition-colors duration-150 ease-in-out outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-1 focus-visible:ring-offset-sidebar-background disabled:opacity-50 disabled:pointer-events-none px-3 py-2.5 gap-3", // Unified padding, no icon-only logic needed here
  {
    variants: {
      isActive: {
        true: "bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90",
        false: "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
      },
      // isCollapsed variant is no longer needed as sidebar is always a sheet
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
    tooltip?: string | React.ReactNode; // Tooltip prop can be removed if not used, or kept for future icon-only buttons elsewhere
  }
>(({ className, children, asChild, isActive, tooltip, ...props }, ref) => {
  const Comp = asChild ? Slot : "button";

  const buttonContent = (
    <Comp
      ref={ref}
      className={cn(sidebarMenuButtonVariants({ isActive }), className)}
      {...props}
    >
      {children}
    </Comp>
  );

  // Tooltips are generally for icon-only buttons when collapsed, not relevant for full-width sheet items.
  // Can be removed if not needed for this component anymore.
  // if (tooltip) { ... } 

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
  // No longer needs to adjust margin based on desktop sidebar state
  return (
    <div
      ref={ref}
      className={cn("flex flex-col flex-1", className)} // Main content area takes available space
      {...props}
    />
  );
});
SidebarInset.displayName = "SidebarInset";
