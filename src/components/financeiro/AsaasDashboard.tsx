import { useState } from 'react';
import { useAsaas } from '@/hooks/useAsaas';
import { useFinancialMetrics, DateRange, TopDebtor } from '@/hooks/useFinancialMetrics';
import { FinancialDateFilter } from './FinancialDateFilter';
import { FinancialKPICard } from './FinancialKPICard';
import { DelinquencyAnalysis } from './DelinquencyAnalysis';
import { AgingTable } from './AgingTable';
import { TopDebtorsTable } from './TopDebtorsTable';
import { RevenueChart } from './RevenueChart';
import { PaymentMethodChart } from './PaymentMethodChart';
import { MRRCard } from './MRRCard';
import { NegativationDialog } from './NegativationDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Wallet, TrendingUp, Receipt, AlertCircle, RefreshCw, Loader2, Calendar, TrendingDown } from 'lucide-react';
import { startOfDay, endOfDay, subDays, format, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

export const AsaasDashboard = () => {
  const today = new Date();
  const [dateRange, setDateRange] = useState<DateRange>({
    start: startOfDay(subDays(today, 29)),
    end: endOfDay(today),
  });
  const [negativationDialogOpen, setNegativationDialogOpen] = useState(false);
  const [selectedDebtor, setSelectedDebtor] = useState<TopDebtor | null>(null);

  const { syncAll, isSyncing, lastSync, createNegativation, refetchNegativations } = useAsaas();
  const metrics = useFinancialMetrics(dateRange);

  const handleSync = async () => {
    await syncAll();
  };

  const handleNegativar = (debtor: TopDebtor) => {
    setSelectedDebtor(debtor);
    setNegativationDialogOpen(true);
  };

  const handleConfirmNegativation = async (paymentId: string, description?: string) => {
    try {
      await createNegativation.mutateAsync({ paymentId, description });
      setNegativationDialogOpen(false);
      setSelectedDebtor(null);
      refetchNegativations();
    } catch (error) {
      // Error handled by mutation
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with filters and sync */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Dashboard Financeiro</h2>
          <p className="text-muted-foreground text-sm">
            Visão geral das finanças e análise de inadimplência
          </p>
        </div>
        <div className="flex items-center gap-2">
          {lastSync && (
            <span className="text-xs text-muted-foreground hidden sm:inline">
              Atualizado: {format(new Date(lastSync), 'HH:mm', { locale: ptBR })}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleSync}
            disabled={isSyncing}
          >
            <RefreshCw className={cn('h-4 w-4 mr-2', isSyncing && 'animate-spin')} />
            Sincronizar
          </Button>
        </div>
      </div>

      {/* Date filter */}
      <FinancialDateFilter dateRange={dateRange} onDateRangeChange={setDateRange} />

      {/* Loading indicator */}
      {metrics.isLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">Carregando dados financeiros...</span>
        </div>
      )}

      {!metrics.isLoading && (
        <>
          {/* KPI Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <FinancialKPICard
              title="Saldo Disponível"
              value={metrics.balance}
              icon={Wallet}
              iconColor="text-primary"
              borderColor="border-primary/20"
              subtitle="Saldo na conta Asaas"
            />
            <FinancialKPICard
              title="Recebido no Período"
              value={metrics.receivedInPeriod}
              growth={metrics.receivedGrowth}
              icon={TrendingUp}
              iconColor="text-green-500"
              borderColor="border-green-500/20"
              subtitle={`${metrics.receivedCountInPeriod} cobranças recebidas`}
            />
            <FinancialKPICard
              title="A Receber no Período"
              value={metrics.pendingInPeriod}
              icon={Receipt}
              iconColor="text-yellow-500"
              borderColor="border-yellow-500/20"
              subtitle={`${metrics.pendingCountInPeriod} cobranças pendentes`}
            />
            <FinancialKPICard
              title="Total Vencido"
              value={metrics.overdueTotal}
              icon={AlertCircle}
              iconColor="text-destructive"
              borderColor="border-destructive/20"
              subtitle={`${metrics.overdueCount} cobranças em atraso`}
            />
          </div>

          {/* Revenue Chart */}
          <RevenueChart
            data={metrics.dailyReceived}
            title="Recebimentos no Período"
            description="Evolução diária dos recebimentos"
          />

          {/* Delinquency Analysis Row */}
          <div className="grid gap-4 lg:grid-cols-3">
            <DelinquencyAnalysis
              rate={metrics.delinquencyRate}
              overdueTotal={metrics.overdueTotal}
              overdueCount={metrics.overdueCount}
            />
            <div className="lg:col-span-2">
              <AgingTable aging={metrics.aging} />
            </div>
          </div>

          {/* Top Debtors & Payment Methods */}
          <div className="grid gap-4 lg:grid-cols-2">
            <TopDebtorsTable 
              debtors={metrics.topDebtors} 
              onNegativar={handleNegativar}
            />
            <div className="space-y-4">
              <PaymentMethodChart data={metrics.byPaymentMethod} />
              <MRRCard
                mrr={metrics.currentMRR}
                subscriptionsCount={metrics.activeSubscriptionsCount}
              />
            </div>
          </div>

          {/* Forecast Section */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="border-blue-500/20">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Previsão Próximos 30 Dias</CardTitle>
                    <CardDescription>Cobranças pendentes com vencimento em 30 dias</CardDescription>
                  </div>
                  <Calendar className="h-5 w-5 text-blue-500" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-blue-500">
                    {formatCurrency(metrics.forecast30Days)}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {metrics.forecast30DaysCount} cobranças com vencimento até{' '}
                  {format(addDays(new Date(), 30), "dd 'de' MMMM", { locale: ptBR })}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Resumo do Período</CardTitle>
                <CardDescription>
                  {format(dateRange.start, "dd/MM/yyyy", { locale: ptBR })} - {format(dateRange.end, "dd/MM/yyyy", { locale: ptBR })}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Total de cobranças</span>
                    <span className="font-medium">{metrics.totalPaymentsCount}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Valor total</span>
                    <span className="font-medium">{formatCurrency(metrics.totalPaymentsValue)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Taxa de inadimplência</span>
                    <span className={cn(
                      'font-medium',
                      metrics.delinquencyRate > 15 ? 'text-destructive' : 'text-green-500'
                    )}>
                      {metrics.delinquencyRate.toFixed(1)}%
                    </span>
                  </div>
                  {metrics.receivedGrowth !== 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Crescimento vs período anterior</span>
                      <span className={cn(
                        'font-medium flex items-center gap-1',
                        metrics.receivedGrowth > 0 ? 'text-green-500' : 'text-destructive'
                      )}>
                        {metrics.receivedGrowth > 0 ? (
                          <TrendingUp className="h-3 w-3" />
                        ) : (
                          <TrendingDown className="h-3 w-3" />
                        )}
                        {Math.abs(metrics.receivedGrowth).toFixed(1)}%
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* Negativation Dialog */}
      <NegativationDialog
        open={negativationDialogOpen}
        onOpenChange={setNegativationDialogOpen}
        debtor={selectedDebtor}
        onConfirm={handleConfirmNegativation}
        isLoading={createNegativation.isPending}
      />
    </div>
  );
};
