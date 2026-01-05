import { OwnerMetrics } from "@/hooks/useOwnerMetrics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, UserCheck, UserPlus, UserMinus, TrendingUp, TrendingDown } from "lucide-react";
import UsersGrowthChart from "./charts/UsersGrowthChart";
import SignupsDailyChart from "./charts/SignupsDailyChart";

interface Props {
  metrics: OwnerMetrics | null;
  loading: boolean;
}

const formatPercent = (value: number) => {
  return `${value.toFixed(1)}%`;
};

const OwnerUsuarios = ({ metrics, loading }: Props) => {
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-4 w-20 mb-2" />
                <Skeleton className="h-8 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!metrics) return null;

  const userKpis = [
    {
      title: "Total Usuários",
      value: metrics.totalUsers.toString(),
      icon: Users,
      description: "Cadastrados na plataforma",
      trend: 'up' as const,
    },
    {
      title: "Taxa de Conversão",
      value: formatPercent(metrics.conversionRate),
      icon: TrendingUp,
      description: `${metrics.payingUsers} pagantes de ${metrics.totalUsers}`,
      trend: metrics.conversionRate > 20 ? 'up' as const : 'down' as const,
    },
    {
      title: "Novos Este Mês",
      value: metrics.newUsersThisMonth.toString(),
      icon: UserPlus,
      description: "Signups no período",
      trend: metrics.newUsersThisMonth > 0 ? 'up' as const : 'neutral' as const,
    },
    {
      title: "Churn Rate",
      value: formatPercent(metrics.churnRate),
      icon: UserMinus,
      description: "Cancelamentos / Início mês",
      trend: metrics.churnRate < 5 ? 'up' as const : 'down' as const,
    },
  ];

  return (
    <div className="space-y-6">
      {/* User KPIs */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {userKpis.map((kpi) => (
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

      {/* User Distribution */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Distribuição de Usuários</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span className="text-sm">Pagantes</span>
                </div>
                <span className="font-bold">{metrics.payingUsers}</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div 
                  className="bg-green-500 h-2 rounded-full transition-all"
                  style={{ width: `${metrics.conversionRate}%` }}
                />
              </div>
              
              <div className="flex items-center justify-between mt-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-muted-foreground" />
                  <span className="text-sm">Free/Trial</span>
                </div>
                <span className="font-bold">{metrics.freeUsers}</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div 
                  className="bg-muted-foreground h-2 rounded-full transition-all"
                  style={{ width: `${100 - metrics.conversionRate}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Funil de Conversão</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Signup Stage */}
              <div className="relative">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">Visitantes → Signup</span>
                  <span className="text-sm text-muted-foreground">100%</span>
                </div>
                <div className="w-full bg-primary/20 rounded h-8 flex items-center justify-center">
                  <span className="text-sm font-medium">{metrics.totalUsers} usuários</span>
                </div>
              </div>

              {/* Trial Stage */}
              <div className="relative">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">Signup → Trial/Free</span>
                  <span className="text-sm text-muted-foreground">
                    {formatPercent((metrics.freeUsers / metrics.totalUsers) * 100)}
                  </span>
                </div>
                <div 
                  className="bg-primary/40 rounded h-8 flex items-center justify-center"
                  style={{ width: `${100 - metrics.conversionRate}%` }}
                >
                  <span className="text-sm font-medium">{metrics.freeUsers} em trial</span>
                </div>
              </div>

              {/* Paid Stage */}
              <div className="relative">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">Trial → Pagante</span>
                  <span className="text-sm text-muted-foreground">
                    {formatPercent(metrics.conversionRate)}
                  </span>
                </div>
                <div 
                  className="bg-green-500 rounded h-8 flex items-center justify-center"
                  style={{ width: `${metrics.conversionRate}%`, minWidth: '80px' }}
                >
                  <span className="text-sm font-medium text-white">{metrics.payingUsers} pagantes</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Signups por Mês (12 meses)</CardTitle>
          </CardHeader>
          <CardContent>
            <UsersGrowthChart data={metrics.signupsByMonth} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Signups Diários (30 dias)</CardTitle>
          </CardHeader>
          <CardContent>
            <SignupsDailyChart data={metrics.signupsByDay} />
          </CardContent>
        </Card>
      </div>

      {/* Cohort Placeholder */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Análise de Cohorts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Análise de cohorts disponível com mais dados históricos</p>
            <p className="text-sm mt-2">Acompanhe a retenção mês a mês por grupo de entrada</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default OwnerUsuarios;
