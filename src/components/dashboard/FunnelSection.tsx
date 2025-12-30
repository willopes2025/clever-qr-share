import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFunnelMetrics, useFunnelsList, DateRange } from '@/hooks/useDashboardMetricsV2';
import { TrendingUp, CheckCircle2, XCircle, Clock } from 'lucide-react';

interface FunnelSectionProps {
  dateRange: DateRange;
}

const formatCurrency = (value: number): string => {
  if (value >= 1000000) return `R$ ${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `R$ ${(value / 1000).toFixed(1)}K`;
  return `R$ ${value.toFixed(0)}`;
};

export const FunnelSection = ({ dateRange }: FunnelSectionProps) => {
  const [selectedFunnelId, setSelectedFunnelId] = useState<string | undefined>(undefined);
  const { data: funnels } = useFunnelsList();
  const { data, isLoading } = useFunnelMetrics(dateRange, selectedFunnelId);

  const summaryCards = [
    { 
      title: 'Em Negociação', 
      value: data?.dealsInNegotiation || 0, 
      subValue: formatCurrency(data?.valueInNegotiation || 0),
      icon: TrendingUp, 
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10'
    },
    { 
      title: 'Vendas Fechadas', 
      value: data?.dealsClosed || 0, 
      subValue: formatCurrency(data?.valueClosed || 0),
      icon: CheckCircle2, 
      color: 'text-green-500',
      bgColor: 'bg-green-500/10'
    },
    { 
      title: 'Perdidos', 
      value: data?.dealsLost || 0, 
      subValue: formatCurrency(data?.valueLost || 0),
      icon: XCircle, 
      color: 'text-red-500',
      bgColor: 'bg-red-500/10'
    },
    { 
      title: 'Ciclo Médio', 
      value: `${(data?.avgSalesCycle || 0).toFixed(0)}d`, 
      icon: Clock, 
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
      isText: true
    },
  ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-lg flex items-center gap-2">
            🔄 Funil / CRM
          </CardTitle>
          <Select 
            value={selectedFunnelId || 'all'} 
            onValueChange={(value) => setSelectedFunnelId(value === 'all' ? undefined : value)}
          >
            <SelectTrigger className="w-[180px] h-8 text-sm">
              <SelectValue placeholder="Todos os funis" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os funis</SelectItem>
              {funnels?.map((funnel) => (
                <SelectItem key={funnel.id} value={funnel.id}>
                  {funnel.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {summaryCards.map((card, index) => (
            <div key={index} className={`p-3 rounded-lg border ${card.bgColor}`}>
              <div className="flex items-center gap-2 mb-1">
                <card.icon className={`h-4 w-4 ${card.color}`} />
                <span className="text-xs text-muted-foreground">{card.title}</span>
              </div>
              {isLoading ? (
                <Skeleton className="h-6 w-16" />
              ) : (
                <>
                  <span className="text-xl font-bold block">
                    {card.isText ? card.value : card.value.toLocaleString()}
                  </span>
                  {card.subValue && (
                    <span className="text-xs text-muted-foreground">{card.subValue}</span>
                  )}
                </>
              )}
            </div>
          ))}
        </div>

        {/* Funnel Stages */}
        <div className="space-y-2">
          <span className="text-sm text-muted-foreground">Leads por Etapa</span>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : (
            <div className="space-y-2">
              {data?.stages.map((stage, index) => {
                const maxDeals = Math.max(...(data?.stages.map(s => s.dealCount) || [1]));
                const widthPercent = maxDeals > 0 ? (stage.dealCount / maxDeals) * 100 : 0;
                
                return (
                  <div 
                    key={stage.stageId} 
                    className="flex items-center gap-3 p-2 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                  >
                    <div 
                      className="w-3 h-3 rounded-full flex-shrink-0" 
                      style={{ backgroundColor: stage.stageColor }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium truncate">{stage.stageName}</span>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-semibold">{stage.dealCount}</span>
                          <span className="text-muted-foreground">
                            {formatCurrency(stage.dealValue)}
                          </span>
                          <span className="text-muted-foreground">
                            ({stage.probability}%)
                          </span>
                        </div>
                      </div>
                      <Progress value={widthPercent} className="h-1.5" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
