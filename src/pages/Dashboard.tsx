import { DashboardLayout } from "@/components/DashboardLayout";
import { CustomizableDashboard } from "@/components/dashboard/customizable/CustomizableDashboard";

const Dashboard = () => {
  return (
    <DashboardLayout className="p-4 md:p-8">
      <CustomizableDashboard />
    </DashboardLayout>
  );
};

export default Dashboard;
