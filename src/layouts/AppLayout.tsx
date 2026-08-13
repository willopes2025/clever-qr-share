import { ReactNode } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { DashboardLayout } from "@/components/DashboardLayout";
import { MobileAppLayout } from "@/mobile/layouts/MobileAppLayout";
import { ImpersonationBanner } from "@/components/admin/ImpersonationBanner";

interface AppLayoutProps {
  children: ReactNode;
  className?: string;
  /** Page title for mobile header */
  pageTitle?: string;
}

/**
 * AppLayout - Smart layout router that decides between mobile and desktop layouts
 * 
 * Mobile: Uses MobileAppLayout with native-like experience
 * Desktop: Uses existing DashboardLayout with sidebar
 */
export const AppLayout = ({ children, className, pageTitle }: AppLayoutProps) => {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <MobileAppLayout pageTitle={pageTitle} className={className}>
        <ImpersonationBanner />
        {children}
      </MobileAppLayout>
    );
  }

  return (
    <DashboardLayout className={className}>
      <ImpersonationBanner />
      {children}
    </DashboardLayout>
  );
};
