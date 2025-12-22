import { ReactNode } from "react";
import { SidebarProvider, useSidebarContext } from "@/contexts/SidebarContext";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { cn } from "@/lib/utils";

interface DashboardLayoutProps {
  children: ReactNode;
  className?: string;
}

const LayoutContent = ({ children, className }: DashboardLayoutProps) => {
  const { isCollapsed } = useSidebarContext();

  return (
    <div className="min-h-screen bg-background">
      <DashboardSidebar />
      <main
        className={cn(
          "transition-all duration-300 ease-in-out",
          isCollapsed ? "ml-16" : "ml-64",
          className
        )}
      >
        {children}
      </main>
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
