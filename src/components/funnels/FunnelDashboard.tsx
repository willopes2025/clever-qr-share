import { useMemo } from "react";
import { DollarSign, TrendingUp, Target, Clock, BarChart3, Users, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Funnel, FunnelDeal } from "@/hooks/useFunnels";
import { useFunnelMetrics } from "@/hooks/useFunnelDeals";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  AreaChart,
  Area,
} from "recharts";

interface FunnelDashboardProps {
  funnel: Funnel;
}

export const FunnelDashboard = ({ funnel }: FunnelDashboardProps) => {
  const stages = funnel.stages || [];
  const { data: metrics, isLoading: metricsLoading } = useFunnelMetrics(funnel.id);
  
  const closedCount = (metrics?.wonDealsCount || 0) + (metrics?.lostDealsCount || 0);
  const conversionRate = closedCount > 0 
    ? Math.round((metrics?.wonDealsCount || 0) / closedCount * 100) 
    : 0;

  // Total deals from all stages (for charts that use local data)
  const allLocalDeals = useMemo(() => {
    return stages.flatMap(s => s.deals || []);
  }, [stages]);

  // Conversion funnel data - uses local deals for visualization
  const conversionData = useMemo(() => {
    const nonFinalStages = stages.filter(s => !s.is_final);
    const totalLeads = allLocalDeals.length;
    
    return nonFinalStages.map((stage, index) => {
      const dealsInStage = stage.deals?.length || 0;
      const previousStages = nonFinalStages.slice(0, index + 1);
      const cumulativeDeals = previousStages.reduce((sum, s) => sum + (s.deals?.length || 0), 0);
      const stageValue = (stage.deals || []).reduce((sum, d) => sum + Number(d.value || 0), 0);
      
      return {
        name: stage.name,
        deals: dealsInStage,
        value: stageValue,
        rate: totalLeads > 0 ? Math.round((dealsInStage / totalLeads) * 100) : 0,
        color: stage.color
      };
    });
  }, [stages, allLocalDeals.length]);

  // Time in stage data
  const timeInStageData = useMemo(() => {
    const nonFinalStages = stages.filter(s => !s.is_final);
    
    return nonFinalStages.map(stage => {
      const stageDeals = stage.deals || [];
      const avgDays = stageDeals.length > 0
        ? Math.round(stageDeals.reduce((sum, deal) => {
            const days = Math.floor(
              (Date.now() - new Date(deal.entered_stage_at).getTime()) / (1000 * 60 * 60 * 24)
            );
            return sum + days;
          }, 0) / stageDeals.length)
        : 0;
      
      return {
        name: stage.name.length > 12 ? stage.name.substring(0, 12) + '...' : stage.name,
        fullName: stage.name,
        dias: avgDays,
        color: stage.color
      };
    });
  }, [stages]);

  // Win/Loss distribution - use RPC metrics
  const winLossData = useMemo(() => {
    if (!metrics) return [];
    return [
      { name: 'Ganhos', value: metrics.wonDealsCount, color: '#22C55E' },
      { name: 'Perdidos', value: metrics.lostDealsCount, color: '#EF4444' },
      { name: 'Em Aberto', value: metrics.openDealsCount, color: '#3B82F6' }
    ].filter(d => d.value > 0);
  }, [metrics]);

  // Value by stage - still uses local data for chart visualization
  const valueByStageData = useMemo(() => {
    return stages.filter(s => !s.is_final).map(stage => ({
      name: stage.name.length > 10 ? stage.name.substring(0, 10) + '...' : stage.name,
      fullName: stage.name,
      valor: (stage.deals || []).reduce((sum, d) => sum + Number(d.value || 0), 0),
      color: stage.color
    }));
  }, [stages]);

  const summaryCards = [
    {
      label: "Deals em Aberto",
      value: metrics?.openDealsCount ?? '-',
      icon: Target,
      color: "bg-blue-500/10 text-blue-500"
    },
    {
      label: "Pipeline Total",
      value: metrics ? `R$ ${metrics.openDealsValue.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}` : '-',
      icon: DollarSign,
      color: "bg-green-500/10 text-green-500"
    },
    {
      label: "Taxa de Conversão",
      value: `${conversionRate}%`,
      icon: TrendingUp,
      color: "bg-purple-500/10 text-purple-500"
    },
    {
      label: "Tempo Médio p/ Fechar",
      value: metrics && metrics.avgDaysToClose > 0 ? `${metrics.avgDaysToClose} dias` : '-',
      icon: Clock,
      color: "bg-orange-500/10 text-orange-500"
    },
    {
      label: "Deals Ganhos",
      value: metrics?.wonDealsCount ?? '-',
      subValue: metrics ? `R$ ${metrics.wonDealsValue.toLocaleString('pt-BR')}` : undefined,
      icon: CheckCircle,
      color: "bg-emerald-500/10 text-emerald-500"
    },
    {
      label: "Deals Perdidos",
      value: metrics?.lostDealsCount ?? '-',
      subValue: metrics ? `R$ ${metrics.lostDealsValue.toLocaleString('pt-BR')}` : undefined,
      icon: XCircle,
      color: "bg-red-500/10 text-red-500"
    }
  ];

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string }[]; label?: string }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium text-sm">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} className="text-sm text-muted-foreground">
              {entry.name}: {typeof entry.value === 'number' && entry.name.includes('valor') 
                ? `R$ ${entry.value.toLocaleString('pt-BR')}` 
                : entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {summaryCards.map((card) => (
          <Card key={card.label}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${card.color}`}>
                  <card.icon className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-3">
                <p className="text-xl font-bold">{card.value}</p>
                <p className="text-xs text-muted-foreground">{card.label}</p>
                {card.subValue && (
                  <p className="text-xs text-muted-foreground mt-0.5">{card.subValue}</p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row 1 */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Deals por Etapa */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              Deals por Etapa
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={conversionData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis 
                    type="category" 
                    dataKey="name" 
                    tick={{ fontSize: 11 }} 
                    width={100}
                    stroke="hsl(var(--muted-foreground))"
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="deals" radius={[0, 4, 4, 0]}>
                    {conversionData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Tempo Médio por Etapa */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-orange-500" />
              Tempo Médio por Etapa (dias)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={timeInStageData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fontSize: 10 }} 
                    stroke="hsl(var(--muted-foreground))"
                    angle={-20}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip 
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
                            <p className="font-medium text-sm">{data.fullName}</p>
                            <p className="text-sm text-muted-foreground">{data.dias} dias em média</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="dias" radius={[4, 4, 0, 0]}>
                    {timeInStageData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Valor por Etapa */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-green-500" />
              Valor do Pipeline por Etapa
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={valueByStageData}>
                  <defs>
                    <linearGradient id="colorValor" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22C55E" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#22C55E" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fontSize: 10 }} 
                    stroke="hsl(var(--muted-foreground))"
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }} 
                    stroke="hsl(var(--muted-foreground))"
                    tickFormatter={(value) => `R$${(value/1000).toFixed(0)}k`}
                  />
                  <Tooltip 
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
                            <p className="font-medium text-sm">{data.fullName}</p>
                            <p className="text-sm text-green-500 font-semibold">
                              R$ {data.valor.toLocaleString('pt-BR')}
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="valor" 
                    stroke="#22C55E" 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill="url(#colorValor)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Distribuição de Deals */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-purple-500" />
              Distribuição de Deals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              {winLossData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={winLossData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {winLossData.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
                              <p className="font-medium text-sm">{data.name}</p>
                              <p className="text-sm text-muted-foreground">{data.value} deals</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend 
                      verticalAlign="bottom" 
                      height={36}
                      formatter={(value) => <span className="text-sm text-foreground">{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  Nenhum deal para exibir
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
