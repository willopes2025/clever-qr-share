import { OwnerMetrics } from "@/hooks/useOwnerMetrics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DollarSign, TrendingUp, Users, Calculator } from "lucide-react";
import MRREvolutionChart from "./charts/MRREvolutionChart";
import RevenueByPlanChart from "./charts/RevenueByPlanChart";

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

const OwnerFinanceiro = ({ metrics, loading }: Props) => {
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

  // Calculate LTV (simplified: ARPU * average lifetime in months)
  const avgLifetimeMonths = 12; // Assumption
  const ltv = metrics.arpu * avgLifetimeMonths;

  const financialKpis = [
    {
      title: "MRR Atual",
      value: formatCurrency(metrics.mrr),
      icon: DollarSign,
      description: "Receita Mensal Recorrente",
    },
    {
      title: "ARR",
      value: formatCurrency(metrics.arr),
      icon: TrendingUp,
      description: "Receita Anual Recorrente",
    },
    {
      title: "ARPU",
      value: formatCurrency(metrics.arpu),
      icon: Users,
      description: "Receita Média por Usuário",
    },
    {
      title: "LTV Estimado",
      value: formatCurrency(ltv),
      icon: Calculator,
      description: `Base: ${avgLifetimeMonths} meses`,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Financial KPIs */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {financialKpis.map((kpi) => (
          <Card key={kpi.title}>
            <CardContent className="p-6">
              <div className="flex items-center gap-2 text-muted-foreground">
                <kpi.icon className="h-4 w-4" />
                <span className="text-sm font-medium">{kpi.title}</span>
              </div>
              <p className="text-2xl font-bold mt-2">{kpi.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{kpi.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Evolução do MRR (12 meses)</CardTitle>
          </CardHeader>
          <CardContent>
            <MRREvolutionChart data={metrics.mrrHistory} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Receita por Plano</CardTitle>
          </CardHeader>
          <CardContent>
            <RevenueByPlanChart data={metrics.revenueByPlan} />
          </CardContent>
        </Card>
      </div>

      {/* Subscriptions Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Detalhamento por Plano</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plano</TableHead>
                <TableHead className="text-right">Usuários</TableHead>
                <TableHead className="text-right">MRR</TableHead>
                <TableHead className="text-right">% do Total</TableHead>
                <TableHead className="text-right">Ticket Médio</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {metrics.revenueByPlan.map((plan) => (
                <TableRow key={plan.plan_name}>
                  <TableCell className="font-medium">{plan.plan_name}</TableCell>
                  <TableCell className="text-right">{plan.count}</TableCell>
                  <TableCell className="text-right">{formatCurrency(plan.revenue)}</TableCell>
                  <TableCell className="text-right">{formatPercent(plan.percentage)}</TableCell>
                  <TableCell className="text-right">
                    {plan.count > 0 ? formatCurrency(plan.revenue / plan.count) : '-'}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="font-bold">
                <TableCell>Total</TableCell>
                <TableCell className="text-right">{metrics.payingUsers}</TableCell>
                <TableCell className="text-right">{formatCurrency(metrics.mrr)}</TableCell>
                <TableCell className="text-right">100%</TableCell>
                <TableCell className="text-right">{formatCurrency(metrics.arpu)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Additional Metrics */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Métricas de Saúde</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">LTV/CAC Ratio</span>
              <span className="font-bold text-green-500">N/A</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Quick Ratio</span>
              <span className="font-bold">N/A</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Net Revenue Retention</span>
              <span className="font-bold">N/A</span>
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              * Métricas avançadas requerem dados históricos adicionais
            </p>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Projeções</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-lg border p-4 text-center">
                <p className="text-sm text-muted-foreground">Receita Trimestral</p>
                <p className="text-xl font-bold">{formatCurrency(metrics.mrr * 3)}</p>
              </div>
              <div className="rounded-lg border p-4 text-center">
                <p className="text-sm text-muted-foreground">Receita Semestral</p>
                <p className="text-xl font-bold">{formatCurrency(metrics.mrr * 6)}</p>
              </div>
              <div className="rounded-lg border p-4 text-center">
                <p className="text-sm text-muted-foreground">Receita Anual (ARR)</p>
                <p className="text-xl font-bold">{formatCurrency(metrics.arr)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default OwnerFinanceiro;
