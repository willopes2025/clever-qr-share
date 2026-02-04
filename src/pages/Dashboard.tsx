import { useIsMobile } from "@/hooks/use-mobile";
import { AppLayout } from "@/layouts/AppLayout";
import { TraditionalDashboard } from "@/components/dashboard/TraditionalDashboard";
import { MobileAppLayout } from "@/mobile/layouts/MobileAppLayout";
import { MobileHome } from "@/mobile/pages/MobileHome";

const Dashboard = () => {
  const isMobile = useIsMobile();

  // Mobile: dedicated mobile home experience
  if (isMobile) {
    return (
      <MobileAppLayout pageTitle="Dashboard">
        <MobileHome />
      </MobileAppLayout>
    );
  }

  // Desktop: full dashboard with sidebar
  return (
    <AppLayout pageTitle="Dashboard" className="p-4 md:p-8">
      <TraditionalDashboard />
    </AppLayout>
  );
};

export default Dashboard;
