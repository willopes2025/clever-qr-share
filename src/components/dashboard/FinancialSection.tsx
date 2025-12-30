import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useFinancialMetrics, DateRange } from '@/hooks/useDashboardMetricsV2';
import { DollarSign, TrendingUp, Target, Calculator } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface FinancialSectionProps {
  dateRange: DateRange;
}

const formatCurrency = (value: number): string => {
  if (value >= 1000000) return `R$ ${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `R$ ${(value / 1000).toFixed(1)}K`;
  return `R$ ${value.toFixed(0)}`;
};

export const FinancialSection = ({ dateRange }: FinancialSectionProps) => {
  const { data, isLoading } = useFinancialMetrics(dateRange);

  const metrics = [
    { 
      title: 'Vendas Fechadas', 
      value: formatCurrency(data?.salesTotal || 0), 
      icon: DollarSign, 
      color: 'text-green-500',
      bgColor: 'bg-green-500/10'
    },
    { 
      title: 'Em Negociação', 
      value: formatCurrency(data?.valueInNegotiation || 0), 
      icon: TrendingUp, 
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10'
    },
    { 
      title: 'Ticket Médio', 
      value: formatCurrency(data?.avgTicket || 0), 
      icon: Target, 
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10'
    },
    { 
      title: 'Receita Estimada', 
      value: formatCurrency(data?.estimatedRevenue || 0), 
      icon: Calculator, 
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10'
    },
  ];

  const chartData = data?.salesByPeriod.map(item => ({
    ...item,
    dateFormatted: format(parseISO(item.date), 'dd/MM', { locale: ptBR }),
  })) || [];

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          💰 Financeiro
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Metrics Grid */}
        <div className="grid grid-cols-2 gap-3">
          {metrics.map((metric, index) => (
            <div key={index} className={`p-3 rounded-lg border ${metric.bgColor}`}>
              <div className="flex items-center gap-2 mb-1">
                <metric.icon className={`h-4 w-4 ${metric.color}`} />
                <span className="text-xs text-muted-foreground">{metric.title}</span>
              </div>
              {isLoading ? (
                <Skeleton className="h-6 w-20" />
              ) : (
                <span className="text-lg font-bold">{metric.value}</span>
              )}
            </div>
          ))}
        </div>

        {/* Sales Chart */}
        {chartData.length > 0 && (
          <div className="space-y-2">
            <span className="text-sm text-muted-foreground">Evolução de Vendas</span>
            <div className="h-32">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis 
                    dataKey="dateFormatted" 
                    tick={{ fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis 
                    tick={{ fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(value) => formatCurrency(value)}
                    width={60}
                  />
                  <Tooltip 
                    formatter={(value: number) => [formatCurrency(value), 'Vendas']}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      fontSize: '12px'
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="value" 
                    stroke="hsl(var(--primary))" 
                    fillOpacity={1}
                    fill="url(#colorSales)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
