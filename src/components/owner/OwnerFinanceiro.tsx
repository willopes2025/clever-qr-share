import { OwnerMetrics } from "@/hooks/useOwnerMetrics";
import { StripeMetrics } from "@/hooks/useStripeMetrics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DollarSign, TrendingUp, Users, Calculator, CreditCard, Receipt } from "lucide-react";
import MRREvolutionChart from "./charts/MRREvolutionChart";
import RevenueByPlanChart from "./charts/RevenueByPlanChart";
import StripeBalanceCard from "./cards/StripeBalanceCard";
import StripeSubscriptionsTable from "./tables/StripeSubscriptionsTable";
import StripeInvoicesTable from "./tables/StripeInvoicesTable";

interface Props {
  metrics: OwnerMetrics | null;
  stripeMetrics: StripeMetrics | null;
  loading: boolean;
  stripeLoading: boolean;
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

const OwnerFinanceiro = ({ metrics, stripeMetrics, loading, stripeLoading }: Props) => {
  if (loading && stripeLoading) {
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

  // Use Stripe data if available, fallback to local metrics
  const mrr = stripeMetrics?.mrr ?? metrics?.mrr ?? 0;
  const arr = stripeMetrics?.arr ?? metrics?.arr ?? 0;
  const arpu = metrics?.arpu ?? 0;
  const payingUsers = metrics?.payingUsers ?? 0;

  // Calculate LTV (simplified: ARPU * average lifetime in months)
  const avgLifetimeMonths = 12; // Assumption
  const ltv = arpu * avgLifetimeMonths;

  const financialKpis = [
    {
      title: "MRR Real (Stripe)",
      value: formatCurrency(mrr),
      icon: DollarSign,
      description: stripeMetrics ? "Dados reais do Stripe" : "Estimativa local",
      highlight: !!stripeMetrics,
    },
    {
      title: "ARR",
      value: formatCurrency(arr),
      icon: TrendingUp,
      description: "Receita Anual Recorrente",
    },
    {
      title: "Total Faturado",
      value: formatCurrency(stripeMetrics?.totalRevenue ?? 0),
      icon: CreditCard,
      description: "Histórico de pagamentos",
    },
    {
      title: "Assinaturas Ativas",
      value: String(stripeMetrics?.activeSubscriptions ?? payingUsers),
      icon: Users,
      description: stripeMetrics ? `${stripeMetrics.totalCustomers} clientes` : "Usuários pagantes",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Financial KPIs */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {financialKpis.map((kpi) => (
          <Card key={kpi.title} className={kpi.highlight ? "border-green-500/50" : ""}>
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

      {/* Stripe Balance */}
      {stripeMetrics && (
        <div>
          <h3 className="text-lg font-semibold mb-4">Saldo Stripe</h3>
          <StripeBalanceCard 
            available={stripeMetrics.balance.available} 
            pending={stripeMetrics.balance.pending}
            loading={stripeLoading}
          />
        </div>
      )}

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Receita Mensal (12 meses)</CardTitle>
          </CardHeader>
          <CardContent>
            <MRREvolutionChart data={stripeMetrics?.mrrHistory ?? metrics?.mrrHistory ?? []} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Receita por Plano</CardTitle>
          </CardHeader>
          <CardContent>
            <RevenueByPlanChart data={metrics?.revenueByPlan ?? []} />
          </CardContent>
        </Card>
      </div>

      {/* Stripe Data Tabs */}
      {stripeMetrics && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Dados do Stripe
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="subscriptions">
              <TabsList>
                <TabsTrigger value="subscriptions">
                  Assinaturas ({stripeMetrics.subscriptions.length})
                </TabsTrigger>
                <TabsTrigger value="invoices">
                  Faturas ({stripeMetrics.invoices.length})
                </TabsTrigger>
              </TabsList>
              <TabsContent value="subscriptions" className="mt-4">
                <StripeSubscriptionsTable 
                  subscriptions={stripeMetrics.subscriptions} 
                  loading={stripeLoading}
                />
              </TabsContent>
              <TabsContent value="invoices" className="mt-4">
                <StripeInvoicesTable 
                  invoices={stripeMetrics.invoices} 
                  loading={stripeLoading}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {/* Local Subscriptions Table (fallback) */}
      {metrics && !stripeMetrics && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Detalhamento por Plano (Local)</CardTitle>
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
      )}

      {/* Additional Metrics */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Métricas de Saúde</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">LTV Estimado</span>
              <span className="font-bold">{formatCurrency(ltv)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">ARPU</span>
              <span className="font-bold">{formatCurrency(arpu)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Churn Rate</span>
              <span className="font-bold">{formatPercent(metrics?.churnRate ?? 0)}</span>
            </div>
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
                <p className="text-xl font-bold">{formatCurrency(mrr * 3)}</p>
              </div>
              <div className="rounded-lg border p-4 text-center">
                <p className="text-sm text-muted-foreground">Receita Semestral</p>
                <p className="text-xl font-bold">{formatCurrency(mrr * 6)}</p>
              </div>
              <div className="rounded-lg border p-4 text-center">
                <p className="text-sm text-muted-foreground">Receita Anual (ARR)</p>
                <p className="text-xl font-bold">{formatCurrency(arr)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default OwnerFinanceiro;
