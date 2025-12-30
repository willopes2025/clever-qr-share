import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { MyPermissionsCard } from "@/components/settings/MyPermissionsCard";
import { DashboardDateFilter } from "@/components/dashboard/DashboardDateFilter";
import { KPICard } from "@/components/dashboard/KPICard";
import { SalesFunnelChart } from "@/components/dashboard/SalesFunnelChart";
import { MessagesChart } from "@/components/dashboard/MessagesChart";
import { TeamProductivityChart } from "@/components/dashboard/TeamProductivityChart";
import { ResponseTimeChart } from "@/components/dashboard/ResponseTimeChart";
import { TeamPerformanceTable } from "@/components/dashboard/TeamPerformanceTable";
import { DealStatusChart } from "@/components/dashboard/DealStatusChart";
import { InsightsPanel } from "@/components/dashboard/InsightsPanel";
import { 
  useSalesMetrics,
  useMessagingMetrics,
  useResponseTimeMetrics,
  useConversationMetrics,
  type DateRange
} from "@/hooks/useAdvancedDashboardMetrics";
import { 
  DollarSign, 
  Trophy, 
  TrendingUp, 
  Clock, 
  MessageSquareText
} from "lucide-react";

const Dashboard = () => {
  const [dateRange, setDateRange] = useState<DateRange>('7d');

  const { data: salesMetrics, isLoading: salesLoading } = useSalesMetrics(dateRange);
  const { data: messagingMetrics, isLoading: messagingLoading } = useMessagingMetrics(dateRange);
  const { data: responseMetrics, isLoading: responseLoading } = useResponseTimeMetrics(dateRange);
  const { data: conversationMetrics, isLoading: conversationLoading } = useConversationMetrics(dateRange);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}min`;
    return `${(seconds / 3600).toFixed(1)}h`;
  };

  const getTrend = (value: number): 'up' | 'down' | 'neutral' => {
    if (value > 0) return 'up';
    if (value < 0) return 'down';
    return 'neutral';
  };

  const total = (conversationMetrics?.totalOpen ?? 0) + (conversationMetrics?.totalResolved ?? 0) + (conversationMetrics?.totalPending ?? 0);
  const resolutionRate = total > 0 ? ((conversationMetrics?.totalResolved ?? 0) / total) * 100 : 0;

  return (
    <DashboardLayout className="p-4 md:p-8">
      <MyPermissionsCard />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">
            Dashboard Analítico
          </h1>
          <p className="text-muted-foreground">
            Visão completa de vendas, produtividade e atendimento
          </p>
        </div>
        <DashboardDateFilter value={dateRange} onChange={setDateRange} />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <KPICard
          title="Pipeline Total"
          value={formatCurrency(salesMetrics?.pipelineTotal ?? 0)}
          subtitle={`${salesMetrics?.pipelineCount ?? 0} deals ativos`}
          icon={DollarSign}
          trend={getTrend(12)}
          trendValue="+12%"
          isLoading={salesLoading}
        />
        <KPICard
          title="Deals Ganhos"
          value={formatCurrency(salesMetrics?.dealsWonValue ?? 0)}
          subtitle={`${salesMetrics?.dealsWon ?? 0} fechados`}
          icon={Trophy}
          trend={getTrend(8)}
          trendValue="+8%"
          isLoading={salesLoading}
        />
        <KPICard
          title="Taxa de Conversão"
          value={`${(salesMetrics?.conversionRate ?? 0).toFixed(1)}%`}
          subtitle="Leads → Clientes"
          icon={TrendingUp}
          trend={getTrend(-2)}
          trendValue="-2%"
          isLoading={salesLoading}
        />
        <KPICard
          title="Tempo de Resposta"
          value={formatTime(responseMetrics?.avgResponseTime ?? 0)}
          subtitle="Média primeira resposta"
          icon={Clock}
          trend={getTrend(-15)}
          trendValue="-15%"
          isLoading={responseLoading}
        />
        <KPICard
          title="Conversas Resolvidas"
          value={String(conversationMetrics?.totalResolved ?? 0)}
          subtitle={`${resolutionRate.toFixed(0)}% taxa resolução`}
          icon={MessageSquareText}
          trend={getTrend(5)}
          trendValue="+5%"
          isLoading={conversationLoading}
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        <SalesFunnelChart />
        <MessagesChart dateRange={dateRange} />
      </div>

      {/* Charts Row 2 */}
      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        <TeamProductivityChart dateRange={dateRange} />
        <ResponseTimeChart dateRange={dateRange} />
      </div>

      {/* Team Performance Table */}
      <div className="mb-6">
        <TeamPerformanceTable dateRange={dateRange} />
      </div>

      {/* Bottom Row */}
      <div className="grid lg:grid-cols-2 gap-6">
        <DealStatusChart dateRange={dateRange} />
        <InsightsPanel dateRange={dateRange} />
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
