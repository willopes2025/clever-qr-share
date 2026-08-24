import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useCRMKPIs, useFunnelsList, DateRange, CustomDateRange } from '@/hooks/useDashboardMetricsV2';
import {
  TrendingUp,
  DollarSign,
  Target,
  Clock,
  AlertTriangle,
  BarChart3,
  Percent,
  Zap,
} from 'lucide-react';
import { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface CRMKPIsSectionProps {
  dateRange: DateRange;
  customRange?: CustomDateRange;
}

const formatCurrency = (value: number): string => {
  if (value >= 1000000) return `R$ ${(value / 1000000).toFixed(2)}M`;
  if (value >= 1000) return `R$ ${(value / 1000).toFixed(1)}K`;
  return `R$ ${value.toFixed(0)}`;
};

export const CRMKPIsSection = ({ dateRange, customRange }: CRMKPIsSectionProps) => {
  const [selectedFunnelId, setSelectedFunnelId] = useState<string | undefined>(undefined);
  const { data: funnels } = useFunnelsList();
  const { data, isLoading } = useCRMKPIs(dateRange, selectedFunnelId, customRange);

  const kpis = [
    {
      title: 'Negócios em Aberto',
      value: isLoading ? null : data?.dealsOpen ?? 0,
      display: (v: number) => v.toLocaleString(),
      icon: BarChart3,
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-50 dark:bg-blue-950/30',
    },
    {
      title: 'Valor em Negociação',
      value: isLoading ? null : data?.valueInPipeline ?? 0,
      display: formatCurrency,
      icon: DollarSign,
      color: 'text-violet-600 dark:text-violet-400',
      bgColor: 'bg-violet-50 dark:bg-violet-950/30',
    },
    {
      title: 'Taxa de Conversão',
      value: isLoading ? null : data?.winRate ?? 0,
      display: (v: number) => `${v.toFixed(1)}%`,
      icon: Percent,
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-50 dark:bg-green-950/30',
    },
    {
      title: 'Ciclo de Venda Médio',
      value: isLoading ? null : data?.avgSalesCycleDays ?? 0,
      display: (v: number) => v > 0 ? `${v.toFixed(1)} dias` : '—',
      icon: Clock,
      color: 'text-amber-600 dark:text-amber-400',
      bgColor: 'bg-amber-50 dark:bg-amber-950/30',
    },
    {
      title: 'Ticket Médio',
      value: isLoading ? null : data?.avgTicket ?? 0,
      display: (v: number) => v > 0 ? formatCurrency(v) : '—',
      icon: Target,
      color: 'text-cyan-600 dark:text-cyan-400',
      bgColor: 'bg-cyan-50 dark:bg-cyan-950/30',
    },
    {
      title: 'Receita Fechada',
      value: isLoading ? null : data?.revenueClosed ?? 0,
      display: formatCurrency,
      icon: TrendingUp,
      color: 'text-emerald-600 dark:text-emerald-400',
      bgColor: 'bg-emerald-50 dark:bg-emerald-950/30',
    },
    {
      title: 'Previsão de Receita',
      value: isLoading ? null : data?.forecastRevenue ?? 0,
      display: formatCurrency,
      icon: Zap,
      color: 'text-indigo-600 dark:text-indigo-400',
      bgColor: 'bg-indigo-50 dark:bg-indigo-950/30',
      hint: 'Pipeline ponderado pela probabilidade de cada etapa',
    },
    {
      title: 'Deals Sem Atividade',
      value: isLoading ? null : data?.staleDeals ?? 0,
      display: (v: number) => v > 0 ? v.toLocaleString() : '0',
      icon: AlertTriangle,
      color: data?.staleDeals ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground',
      bgColor: data?.staleDeals ? 'bg-red-50 dark:bg-red-950/30' : 'bg-muted/30',
      hint: 'Negócios sem movimentação há mais de 7 dias',
    },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <CardTitle className="text-lg flex items-center gap-2">
            📊 KPIs do CRM
          </CardTitle>
          {funnels && funnels.length > 1 && (
            <Select
              value={selectedFunnelId ?? 'all'}
              onValueChange={v => setSelectedFunnelId(v === 'all' ? undefined : v)}
            >
              <SelectTrigger className="w-[180px] h-8 text-xs">
                <SelectValue placeholder="Todos os funis" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os funis</SelectItem>
                {funnels.map(f => (
                  <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {kpis.map((kpi, index) => (
            <div
              key={index}
              className={`rounded-lg p-3 border ${kpi.bgColor} flex flex-col gap-1`}
              title={kpi.hint}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground leading-tight">{kpi.title}</span>
                <kpi.icon className={`h-4 w-4 shrink-0 ${kpi.color}`} />
              </div>
              {isLoading ? (
                <Skeleton className="h-6 w-16" />
              ) : (
                <span className={`text-lg font-bold leading-tight ${kpi.color}`}>
                  {kpi.value !== null ? kpi.display(kpi.value as number) : '—'}
                </span>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
