import { ReactNode } from "react";
import { SidebarProvider, useSidebarContext } from "@/contexts/SidebarContext";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { MobileHeader } from "@/components/MobileHeader";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { MobileSidebarDrawer } from "@/components/MobileSidebarDrawer";
import { ActivityTracker } from "@/components/productivity/ActivityTracker";
import { WilAssistant } from "@/components/WilAssistant";
import { cn } from "@/lib/utils";

interface DashboardLayoutProps {
  children: ReactNode;
  className?: string;
}

const LayoutContent = ({ children, className }: DashboardLayoutProps) => {
  const { isCollapsed, isMobile } = useSidebarContext();

  return (
    <div className="min-h-screen bg-background">
      {/* Activity Tracker - invisible, tracks user sessions */}
      <ActivityTracker />
      {/* Desktop Sidebar */}
      {!isMobile && <DashboardSidebar />}
      
      {/* Mobile Components */}
      {isMobile && (
        <>
          <MobileHeader />
          <MobileSidebarDrawer />
          <MobileBottomNav />
        </>
      )}
      
      <main
        className={cn(
          "transition-all duration-300 ease-in-out min-h-screen",
          isMobile 
            ? "ml-0 pt-14 pb-16" // Mobile: header top + bottom nav
            : isCollapsed 
              ? "ml-16" 
              : "ml-64",
          className
        )}
      >
        {children}
      </main>
      
      {/* Wil AI Assistant */}
      <WilAssistant />
    </div>
  );
};

export const DashboardLayout = ({ children, className }: DashboardLayoutProps) => {
  return (
    <SidebarProvider>
      <LayoutContent className={className}>{children}</LayoutContent>
    </SidebarProvider>
  );
};
