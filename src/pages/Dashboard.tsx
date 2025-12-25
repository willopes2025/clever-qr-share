import { DashboardLayout } from "@/components/DashboardLayout";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { CampaignChart } from "@/components/dashboard/CampaignChart";
import { RecentCampaigns } from "@/components/dashboard/RecentCampaigns";
import { ScheduledCampaigns } from "@/components/dashboard/ScheduledCampaigns";
import { InstancesOverview } from "@/components/dashboard/InstancesOverview";
import { MyPermissionsCard } from "@/components/settings/MyPermissionsCard";
import { 
  useDashboardMetrics, 
  useRecentCampaigns, 
  useScheduledCampaigns,
  useCampaignChartData 
} from "@/hooks/useDashboardMetrics";
import { 
  QrCode, 
  Users, 
  Send, 
  TrendingUp, 
  MessageSquare, 
  CheckCircle,
  Clock,
  XCircle
} from "lucide-react";

const Dashboard = () => {
  const { metrics, isLoading: metricsLoading } = useDashboardMetrics();
  const { data: recentCampaigns, isLoading: campaignsLoading } = useRecentCampaigns();
  const { data: scheduledCampaigns, isLoading: scheduledLoading } = useScheduledCampaigns();
  const { data: chartData, isLoading: chartLoading } = useCampaignChartData();

  const mainStats = [
    {
      icon: QrCode,
      label: "Instâncias Conectadas",
      value: metrics?.instances.connected ?? 0,
      change: `${metrics?.instances.total ?? 0} total`,
    },
    {
      icon: Users,
      label: "Contatos Ativos",
      value: metrics?.contacts.active ?? 0,
      change: `${metrics?.contacts.total ?? 0} total`,
    },
    {
      icon: Send,
      label: "Campanhas",
      value: metrics?.campaigns.total ?? 0,
      change: `${metrics?.campaigns.sending ?? 0} em andamento`,
    },
    {
      icon: TrendingUp,
      label: "Taxa de Entrega",
      value: `${(metrics?.deliveryRate ?? 0).toFixed(1)}%`,
      change: "Baseado em todas campanhas",
    },
  ];

  const campaignStats = [
    {
      icon: Clock,
      label: "Agendadas",
      value: metrics?.campaigns.scheduled ?? 0,
    },
    {
      icon: MessageSquare,
      label: "Enviando",
      value: metrics?.campaigns.sending ?? 0,
    },
    {
      icon: CheckCircle,
      label: "Concluídas",
      value: metrics?.campaigns.completed ?? 0,
    },
    {
      icon: XCircle,
      label: "Falharam",
      value: metrics?.campaigns.failed ?? 0,
    },
  ];

  return (
    <DashboardLayout className="p-8">
      {/* Member Permissions Card - Only shows for org members */}
      <MyPermissionsCard />

      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 text-foreground">
          Dashboard
        </h1>
        <p className="text-muted-foreground">
          Bem-vindo de volta! Aqui está um resumo das suas atividades em tempo real.
        </p>
      </div>

      {/* Main Metrics */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {mainStats.map((stat, index) => (
          <MetricCard
            key={index}
            icon={stat.icon}
            label={stat.label}
            value={stat.value}
            change={stat.change}
            index={index}
            isLoading={metricsLoading}
          />
        ))}
      </div>

      {/* Campaign Status Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {campaignStats.map((stat, index) => (
          <MetricCard
            key={index}
            icon={stat.icon}
            label={stat.label}
            value={stat.value}
            index={index + 4}
            isLoading={metricsLoading}
          />
        ))}
      </div>

      {/* Charts and Lists */}
      <div className="grid lg:grid-cols-2 gap-6 mb-8">
        <CampaignChart data={chartData || []} isLoading={chartLoading} />
        <InstancesOverview />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <RecentCampaigns 
          campaigns={recentCampaigns || []} 
          isLoading={campaignsLoading} 
        />
        <ScheduledCampaigns 
          campaigns={scheduledCampaigns || []} 
          isLoading={scheduledLoading} 
        />
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;