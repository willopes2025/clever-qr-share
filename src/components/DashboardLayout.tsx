import { ReactNode } from "react";
import { SidebarProvider, useSidebarContext } from "@/contexts/SidebarContext";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { ActivitySessionProvider } from "@/hooks/useActivitySession";
import { WilAssistant } from "@/components/WilAssistant";
import { cn } from "@/lib/utils";

interface DashboardLayoutProps {
  children: ReactNode;
  className?: string;
}

/**
 * DashboardLayout - Desktop-only layout with sidebar
 * For mobile, use MobileAppLayout via AppLayout router
 */
const LayoutContent = ({ children, className }: DashboardLayoutProps) => {
  const { isCollapsed } = useSidebarContext();

  return (
    <ActivitySessionProvider>
      <div className="min-h-screen bg-background">
        {/* Desktop Sidebar */}
        <DashboardSidebar />

        <main
          className={cn(
            "transition-all duration-300 ease-in-out min-h-screen",
            isCollapsed ? "ml-16" : "ml-64",
            className
          )}
        >
          {children}
        </main>

        {/* Wil AI Assistant */}
        <WilAssistant />
      </div>
    </ActivitySessionProvider>
  );
};

export const DashboardLayout = ({ children, className }: DashboardLayoutProps) => {
  return (
    <SidebarProvider>
      <LayoutContent className={className}>{children}</LayoutContent>
    </SidebarProvider>
  );
};
