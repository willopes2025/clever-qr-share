import { OwnerMetrics } from "@/hooks/useOwnerMetrics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, DollarSign, Users, UserCheck, Percent } from "lucide-react";
import MRREvolutionChart from "./charts/MRREvolutionChart";
import UsersGrowthChart from "./charts/UsersGrowthChart";
import PlansDistributionChart from "./charts/PlansDistributionChart";

interface Props {
  metrics: OwnerMetrics | null;
  loading: boolean;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

const formatPercent = (value: number) => {
  return `${value.toFixed(1)}%`;
};

const OwnerOverview = ({ metrics, loading }: Props) => {
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          {[...Array(5)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-4 w-20 mb-2" />
                <Skeleton className="h-8 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardContent className="p-6">
              <Skeleton className="h-[300px] w-full" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <Skeleton className="h-[300px] w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!metrics) return null;

  const kpis = [
    {
      title: "MRR",
      value: formatCurrency(metrics.mrr),
      icon: DollarSign,
      description: "Receita Mensal Recorrente",
      trend: metrics.mrr > 0 ? 'up' : 'neutral',
    },
    {
      title: "ARR",
      value: formatCurrency(metrics.arr),
      icon: TrendingUp,
      description: "Receita Anual (projeção)",
      trend: 'up',
    },
    {
      title: "Total Usuários",
      value: metrics.totalUsers.toString(),
      icon: Users,
      description: `+${metrics.newUsersThisMonth} este mês`,
      trend: metrics.newUsersThisMonth > 0 ? 'up' : 'neutral',
    },
    {
      title: "Pagantes",
      value: metrics.payingUsers.toString(),
      icon: UserCheck,
      description: `${formatPercent(metrics.conversionRate)} de conversão`,
      trend: metrics.conversionRate > 20 ? 'up' : 'down',
    },
    {
      title: "Churn Rate",
      value: formatPercent(metrics.churnRate),
      icon: Percent,
      description: "Taxa de cancelamento",
      trend: metrics.churnRate < 5 ? 'up' : 'down',
    },
  ];

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {kpis.map((kpi) => (
          <Card key={kpi.title} className="relative overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <kpi.icon className="h-5 w-5 text-muted-foreground" />
                {kpi.trend === 'up' && <TrendingUp className="h-4 w-4 text-green-500" />}
                {kpi.trend === 'down' && <TrendingDown className="h-4 w-4 text-red-500" />}
              </div>
              <div className="mt-3">
                <p className="text-sm font-medium text-muted-foreground">{kpi.title}</p>
                <p className="text-2xl font-bold">{kpi.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{kpi.description}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row 1 */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Evolução do MRR</CardTitle>
          </CardHeader>
          <CardContent>
            <MRREvolutionChart data={metrics.mrrHistory} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Crescimento de Usuários</CardTitle>
          </CardHeader>
          <CardContent>
            <UsersGrowthChart data={metrics.signupsByMonth} />
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">Distribuição por Plano</CardTitle>
          </CardHeader>
          <CardContent>
            <PlansDistributionChart data={metrics.revenueByPlan} />
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Resumo Rápido</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">ARPU</p>
                <p className="text-xl font-bold">{formatCurrency(metrics.arpu)}</p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">Free Users</p>
                <p className="text-xl font-bold">{metrics.freeUsers}</p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">Instâncias Ativas</p>
                <p className="text-xl font-bold">{metrics.connectedInstances}/{metrics.totalInstances}</p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">Total Contatos</p>
                <p className="text-xl font-bold">{metrics.totalContacts.toLocaleString('pt-BR')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default OwnerOverview;
