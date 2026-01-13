import { DashboardLayout } from "@/components/DashboardLayout";
import { TraditionalDashboard } from "@/components/dashboard/TraditionalDashboard";

const Dashboard = () => {
  return (
    <DashboardLayout className="p-4 md:p-8">
      <TraditionalDashboard />
    </DashboardLayout>
  );
};

export default Dashboard;
