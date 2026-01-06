import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSsotica, SsoticaVenda, SsoticaOS, SsoticaParcela } from "@/hooks/useSsotica";
import { Loader2, FileText, ShoppingCart, Receipt, AlertTriangle, TrendingUp } from "lucide-react";
import { format, parseISO, startOfDay, eachDayOfInterval, isPast, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from "recharts";
import { SsoticaDateRange } from "./SsoticaDateFilter";

interface SsoticaDashboardProps {
  dateRange: SsoticaDateRange;
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

export const SsoticaDashboard = ({ dateRange }: SsoticaDashboardProps) => {
  const { metrics, vendas, ordensServico, parcelas, isLoading } = useSsotica();

  // Filter data by date range
  const filteredVendas = useMemo(() => {
    return vendas.filter((v) => {
      if (!v.data_venda) return false;
      const dataVenda = new Date(v.data_venda);
      return dataVenda >= dateRange.from && dataVenda <= dateRange.to;
    });
  }, [vendas, dateRange]);

  const filteredOS = useMemo(() => {
    return ordensServico.filter((os) => {
      if (!os.data_entrada) return false;
      const dataEntrada = new Date(os.data_entrada);
      return dataEntrada >= dateRange.from && dataEntrada <= dateRange.to;
    });
  }, [ordensServico, dateRange]);

  // Calculate filtered metrics
  const filteredMetrics = useMemo(() => {
    const osAbertas = filteredOS.filter((os) => {
      const status = (os.status || '').toLowerCase();
      return status !== 'concluido' && status !== 'concluída' && status !== 'entregue' && status !== 'finalizado';
    }).length;

    const valorVendas = filteredVendas.reduce((sum, v) => sum + (v.valor_total || 0), 0);

    return {
      ...metrics,
      osAbertas,
      vendasMes: filteredVendas.length,
      valorVendas,
    };
  }, [filteredOS, filteredVendas, metrics]);

  // Prepare chart data - Sales by day
  const vendasPorDia = useMemo(() => {
    const days = eachDayOfInterval({ start: dateRange.from, end: dateRange.to });
    const salesByDay = new Map<string, number>();
    
    filteredVendas.forEach((v) => {
      const day = format(new Date(v.data_venda), 'yyyy-MM-dd');
      salesByDay.set(day, (salesByDay.get(day) || 0) + (v.valor_total || 0));
    });

    return days.map((day) => ({
      date: format(day, 'dd/MM', { locale: ptBR }),
      valor: salesByDay.get(format(day, 'yyyy-MM-dd')) || 0,
    }));
  }, [filteredVendas, dateRange]);

  // OS status distribution
  const osStatusData = useMemo(() => {
    const statusCount: Record<string, number> = {};
    
    filteredOS.forEach((os) => {
      const status = normalizeStatus(os.status);
      statusCount[status] = (statusCount[status] || 0) + 1;
    });

    return Object.entries(statusCount).map(([name, value]) => ({ name, value }));
  }, [filteredOS]);

  // Payment methods distribution
  const formaPagamentoData = useMemo(() => {
    const paymentCount: Record<string, number> = {};
    
    filteredVendas.forEach((v) => {
      const forma = v.forma_pagamento || 'Não informado';
      paymentCount[forma] = (paymentCount[forma] || 0) + 1;
    });

    return Object.entries(paymentCount).map(([name, value]) => ({ name, value }));
  }, [filteredVendas]);

  // Parcelas by week
  const parcelasPorSemana = useMemo(() => {
    const hoje = new Date();
    const semanas: { name: string; vencidas: number; aVencer: number }[] = [
      { name: 'Vencidas', vencidas: 0, aVencer: 0 },
      { name: 'Esta semana', vencidas: 0, aVencer: 0 },
      { name: 'Próxima semana', vencidas: 0, aVencer: 0 },
      { name: 'Em 15 dias', vencidas: 0, aVencer: 0 },
      { name: 'Em 30 dias', vencidas: 0, aVencer: 0 },
    ];

    parcelas.forEach((p) => {
      if (!p.vencimento) return;
      const venc = new Date(p.vencimento);
      const diffDays = Math.ceil((venc.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
      
      if (diffDays < 0) {
        semanas[0].vencidas += p.valor || 0;
      } else if (diffDays <= 7) {
        semanas[1].aVencer += p.valor || 0;
      } else if (diffDays <= 14) {
        semanas[2].aVencer += p.valor || 0;
      } else if (diffDays <= 21) {
        semanas[3].aVencer += p.valor || 0;
      } else if (diffDays <= 30) {
        semanas[4].aVencer += p.valor || 0;
      }
    });

    return semanas;
  }, [parcelas]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatTooltipValue = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Métricas principais */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">O.S. Abertas</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredMetrics.osAbertas}</div>
            <p className="text-xs text-muted-foreground">
              No período selecionado
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vendas</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredMetrics.vendasMes}</div>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(filteredMetrics.valorVendas)} faturado
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">A Receber</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(metrics.valorEmAberto)}</div>
            <p className="text-xs text-muted-foreground">
              {metrics.parcelasEmAberto} parcelas em aberto
            </p>
          </CardContent>
        </Card>

        <Card className={metrics.parcelasVencidas > 0 ? "border-destructive/50" : ""}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vencidas</CardTitle>
            <AlertTriangle className={`h-4 w-4 ${metrics.parcelasVencidas > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${metrics.parcelasVencidas > 0 ? 'text-destructive' : ''}`}>
              {formatCurrency(metrics.valorVencido)}
            </div>
            <p className="text-xs text-muted-foreground">
              {metrics.parcelasVencidas} parcelas vencidas
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos - Linha 1 */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Vendas por dia - maior */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4" />
              Vendas por Dia
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {vendasPorDia.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={vendasPorDia}>
                    <defs>
                      <linearGradient id="colorVendas" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 12 }}
                      className="fill-muted-foreground"
                    />
                    <YAxis 
                      tickFormatter={(v) => formatCurrency(v)}
                      tick={{ fontSize: 12 }}
                      className="fill-muted-foreground"
                    />
                    <Tooltip 
                      formatter={(value: number) => [formatTooltipValue(value), 'Vendas']}
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="valor" 
                      stroke="hsl(var(--primary))" 
                      fillOpacity={1} 
                      fill="url(#colorVendas)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  Sem dados de vendas no período
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Status das OS */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Status das O.S.</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {osStatusData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={osStatusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                      labelLine={false}
                    >
                      {osStatusData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  Sem dados de O.S. no período
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos - Linha 2 */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Parcelas por vencimento */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Parcelas por Vencimento</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={parcelasPorSemana}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fontSize: 11 }}
                    className="fill-muted-foreground"
                  />
                  <YAxis 
                    tickFormatter={(v) => formatCurrency(v)}
                    tick={{ fontSize: 12 }}
                    className="fill-muted-foreground"
                  />
                  <Tooltip 
                    formatter={(value: number) => [formatTooltipValue(value)]}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend />
                  <Bar dataKey="vencidas" name="Vencidas" fill="hsl(var(--destructive))" />
                  <Bar dataKey="aVencer" name="A Vencer" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Formas de pagamento */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Formas de Pagamento</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {formaPagamentoData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={formaPagamentoData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {formaPagamentoData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  Sem dados de vendas no período
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

function normalizeStatus(status: string | undefined): string {
  const s = (status || '').toLowerCase();
  if (s === 'concluido' || s === 'concluída' || s === 'entregue' || s === 'finalizado') return 'Concluído';
  if (s === 'em_andamento' || s === 'producao' || s === 'em andamento') return 'Em Andamento';
  if (s === 'pendente' || s === 'aguardando') return 'Pendente';
  return status || 'Outros';
}
