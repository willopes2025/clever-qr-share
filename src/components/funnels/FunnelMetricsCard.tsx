import { DollarSign, TrendingUp, Target, Clock, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Funnel } from "@/hooks/useFunnels";
import { useFunnelMetrics } from "@/hooks/useFunnelDeals";

interface FunnelMetricsCardProps {
  funnel: Funnel;
}

export const FunnelMetricsCard = ({ funnel }: FunnelMetricsCardProps) => {
  const { data: metrics, isLoading } = useFunnelMetrics(funnel.id);
  
  const closedCount = (metrics?.wonDealsCount || 0) + (metrics?.lostDealsCount || 0);
  const conversionRate = closedCount > 0 
    ? Math.round((metrics?.wonDealsCount || 0) / closedCount * 100) 
    : 0;

  const metricsData = [
    {
      label: "Deals Abertos",
      value: metrics?.openDealsCount ?? '-',
      icon: Target,
      color: "text-blue-500"
    },
    {
      label: "Valor do Pipeline",
      value: metrics ? `R$ ${metrics.openDealsValue.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}` : '-',
      icon: DollarSign,
      color: "text-green-500"
    },
    {
      label: "Taxa de Conversão",
      value: metrics ? `${conversionRate}%` : '-',
      icon: TrendingUp,
      color: "text-purple-500"
    },
    {
      label: "Tempo Médio",
      value: metrics && metrics.avgDaysToClose > 0 ? `${metrics.avgDaysToClose} dias` : '-',
      icon: Clock,
      color: "text-orange-500"
    }
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="flex items-center justify-center h-16">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {metricsData.map((metric) => (
        <Card key={metric.label}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`h-10 w-10 rounded-lg bg-muted flex items-center justify-center ${metric.color}`}>
                <metric.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{metric.label}</p>
                <p className="text-lg font-semibold">{metric.value}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
