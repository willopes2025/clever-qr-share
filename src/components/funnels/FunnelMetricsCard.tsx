import { DollarSign, TrendingUp, Target, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Funnel } from "@/hooks/useFunnels";

interface FunnelMetricsCardProps {
  funnel: Funnel;
}

export const FunnelMetricsCard = ({ funnel }: FunnelMetricsCardProps) => {
  const stages = funnel.stages || [];
  
  // Calculate metrics
  const allDeals = stages.flatMap(s => s.deals || []);
  const openDeals = allDeals.filter(d => !d.closed_at);
  const wonDeals = stages.filter(s => s.final_type === 'won').flatMap(s => s.deals || []);
  const lostDeals = stages.filter(s => s.final_type === 'lost').flatMap(s => s.deals || []);
  
  const totalValue = openDeals.reduce((sum, d) => sum + Number(d.value || 0), 0);
  const wonValue = wonDeals.reduce((sum, d) => sum + Number(d.value || 0), 0);
  
  const closedCount = wonDeals.length + lostDeals.length;
  const conversionRate = closedCount > 0 ? Math.round((wonDeals.length / closedCount) * 100) : 0;
  
  // Average time to close (for won deals)
  const avgDaysToClose = wonDeals.length > 0
    ? Math.round(wonDeals.reduce((sum, d) => {
        const days = d.closed_at 
          ? (new Date(d.closed_at).getTime() - new Date(d.created_at).getTime()) / (1000 * 60 * 60 * 24)
          : 0;
        return sum + days;
      }, 0) / wonDeals.length)
    : 0;

  const metrics = [
    {
      label: "Deals Abertos",
      value: openDeals.length,
      icon: Target,
      color: "text-blue-500"
    },
    {
      label: "Valor do Pipeline",
      value: `R$ ${totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`,
      icon: DollarSign,
      color: "text-green-500"
    },
    {
      label: "Taxa de Conversão",
      value: `${conversionRate}%`,
      icon: TrendingUp,
      color: "text-purple-500"
    },
    {
      label: "Tempo Médio",
      value: avgDaysToClose > 0 ? `${avgDaysToClose} dias` : '-',
      icon: Clock,
      color: "text-orange-500"
    }
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {metrics.map((metric) => (
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
