import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSsotica } from "@/hooks/useSsotica";
import { Loader2, DollarSign, TrendingUp, TrendingDown, AlertTriangle, Clock } from "lucide-react";
import { format, differenceInDays, isPast, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
} from "recharts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { SsoticaDateRange } from "./SsoticaDateFilter";

interface SsoticaFinanceiroProps {
  dateRange: SsoticaDateRange;
}

export const SsoticaFinanceiro = ({ dateRange }: SsoticaFinanceiroProps) => {
  const { vendas, parcelas, isLoading } = useSsotica();

  // Filter vendas by date range
  const filteredVendas = useMemo(() => {
    return vendas.filter((v) => {
      if (!v.data_venda) return false;
      const dataVenda = new Date(v.data_venda);
      return dataVenda >= dateRange.from && dataVenda <= dateRange.to;
    });
  }, [vendas, dateRange]);

  // Financial metrics
  const financialMetrics = useMemo(() => {
    const faturado = filteredVendas.reduce((sum, v) => sum + (v.valor_total || 0), 0);
    
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    
    const parcelasVencidas = parcelas.filter((p) => {
      if (!p.vencimento) return false;
      const venc = new Date(p.vencimento);
      venc.setHours(0, 0, 0, 0);
      return venc < hoje;
    });
    
    const parcelasEmDia = parcelas.filter((p) => {
      if (!p.vencimento) return false;
      const venc = new Date(p.vencimento);
      venc.setHours(0, 0, 0, 0);
      return venc >= hoje;
    });

    const vencido = parcelasVencidas.reduce((sum, p) => sum + (p.valor || 0), 0);
    const aReceber = parcelasEmDia.reduce((sum, p) => sum + (p.valor || 0), 0);
    
    // Recebido estimation (faturado - em aberto)
    const totalEmAberto = parcelas.reduce((sum, p) => sum + (p.valor || 0), 0);
    const recebido = Math.max(0, faturado - totalEmAberto);

    return {
      faturado,
      recebido,
      aReceber,
      vencido,
      parcelasVencidas: parcelasVencidas.length,
      parcelasAReceber: parcelasEmDia.length,
    };
  }, [filteredVendas, parcelas]);

  // Aging data - categorize overdue by days
  const agingData = useMemo(() => {
    const hoje = new Date();
    const aging = [
      { name: '1-7 dias', valor: 0, count: 0 },
      { name: '8-15 dias', valor: 0, count: 0 },
      { name: '16-30 dias', valor: 0, count: 0 },
      { name: '31-60 dias', valor: 0, count: 0 },
      { name: '60+ dias', valor: 0, count: 0 },
    ];

    parcelas.forEach((p) => {
      if (!p.vencimento) return;
      const venc = new Date(p.vencimento);
      if (venc >= hoje) return; // Skip non-overdue
      
      const diasAtraso = differenceInDays(hoje, venc);
      
      if (diasAtraso <= 7) {
        aging[0].valor += p.valor || 0;
        aging[0].count++;
      } else if (diasAtraso <= 15) {
        aging[1].valor += p.valor || 0;
        aging[1].count++;
      } else if (diasAtraso <= 30) {
        aging[2].valor += p.valor || 0;
        aging[2].count++;
      } else if (diasAtraso <= 60) {
        aging[3].valor += p.valor || 0;
        aging[3].count++;
      } else {
        aging[4].valor += p.valor || 0;
        aging[4].count++;
      }
    });

    return aging.filter(a => a.valor > 0);
  }, [parcelas]);

  // Próximas parcelas a vencer
  const proximasParcelas = useMemo(() => {
    const hoje = new Date();
    return parcelas
      .filter((p) => {
        if (!p.vencimento) return false;
        const venc = new Date(p.vencimento);
        return venc >= hoje || isToday(venc);
      })
      .sort((a, b) => new Date(a.vencimento).getTime() - new Date(b.vencimento).getTime())
      .slice(0, 10);
  }, [parcelas]);

  // Parcelas mais atrasadas
  const parcelasMaisAtrasadas = useMemo(() => {
    const hoje = new Date();
    return parcelas
      .filter((p) => {
        if (!p.vencimento) return false;
        const venc = new Date(p.vencimento);
        return venc < hoje && !isToday(venc);
      })
      .sort((a, b) => new Date(a.vencimento).getTime() - new Date(b.vencimento).getTime())
      .slice(0, 10);
  }, [parcelas]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatCurrencyShort = (value: number) => {
    if (value >= 1000) {
      return `R$ ${(value / 1000).toFixed(1)}K`;
    }
    return formatCurrency(value);
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
      {/* Métricas Financeiras */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Faturado</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrencyShort(financialMetrics.faturado)}</div>
            <p className="text-xs text-muted-foreground">
              No período selecionado
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recebido (est.)</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrencyShort(financialMetrics.recebido)}</div>
            <p className="text-xs text-muted-foreground">
              Estimativa baseada em vendas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">A Receber</CardTitle>
            <Clock className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{formatCurrencyShort(financialMetrics.aReceber)}</div>
            <p className="text-xs text-muted-foreground">
              {financialMetrics.parcelasAReceber} parcelas em dia
            </p>
          </CardContent>
        </Card>

        <Card className={financialMetrics.vencido > 0 ? "border-destructive/50" : ""}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vencido</CardTitle>
            <AlertTriangle className={`h-4 w-4 ${financialMetrics.vencido > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${financialMetrics.vencido > 0 ? 'text-destructive' : ''}`}>
              {formatCurrencyShort(financialMetrics.vencido)}
            </div>
            <p className="text-xs text-muted-foreground">
              {financialMetrics.parcelasVencidas} parcelas em atraso
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Aging e Parcelas */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Aging de inadimplência */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-destructive" />
              Aging de Inadimplência
            </CardTitle>
          </CardHeader>
          <CardContent>
            {agingData.length > 0 ? (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={agingData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      type="number" 
                      tickFormatter={(v) => formatCurrencyShort(v)}
                      tick={{ fontSize: 12 }}
                      className="fill-muted-foreground"
                    />
                    <YAxis 
                      dataKey="name" 
                      type="category" 
                      tick={{ fontSize: 12 }}
                      width={80}
                      className="fill-muted-foreground"
                    />
                    <Tooltip 
                      formatter={(value: number, name) => [formatCurrency(value), 'Valor']}
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                    <Bar dataKey="valor" fill="hsl(var(--destructive))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
                <TrendingUp className="h-12 w-12 mb-2 text-green-500" />
                <p>Nenhuma parcela vencida!</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Parcelas mais atrasadas */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Parcelas Mais Atrasadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {parcelasMaisAtrasadas.length > 0 ? (
              <div className="max-h-[300px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead>Atraso</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parcelasMaisAtrasadas.map((p, i) => {
                      const diasAtraso = differenceInDays(new Date(), new Date(p.vencimento));
                      return (
                        <TableRow key={p.id || i}>
                          <TableCell className="max-w-[120px] truncate">
                            {p.cliente?.nome || 'N/D'}
                          </TableCell>
                          <TableCell>
                            {format(new Date(p.vencimento), 'dd/MM', { locale: ptBR })}
                          </TableCell>
                          <TableCell>
                            <Badge variant="destructive" className="text-xs">
                              {diasAtraso}d
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(p.valor)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
                <TrendingUp className="h-12 w-12 mb-2 text-green-500" />
                <p>Nenhuma parcela vencida!</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Próximas parcelas a vencer */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4 text-blue-500" />
            Próximas Parcelas a Vencer
          </CardTitle>
        </CardHeader>
        <CardContent>
          {proximasParcelas.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Documento</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Dias</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {proximasParcelas.map((p, i) => {
                    const diasRestantes = differenceInDays(new Date(p.vencimento), new Date());
                    const isHoje = isToday(new Date(p.vencimento));
                    return (
                      <TableRow key={p.id || i}>
                        <TableCell className="font-medium">
                          {p.documento || p.numero || '-'}
                        </TableCell>
                        <TableCell>{p.cliente?.nome || 'N/D'}</TableCell>
                        <TableCell>
                          {format(new Date(p.vencimento), 'dd/MM/yyyy', { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          {isHoje ? (
                            <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30">
                              Hoje
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30">
                              {diasRestantes}d
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(p.valor)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma parcela a vencer encontrada
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
