import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAsaas } from "@/hooks/useAsaas";
import { Wallet, TrendingUp, Receipt, AlertCircle, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export const AsaasDashboard = () => {
  const { 
    balance, 
    isLoadingBalance, 
    refetchBalance,
    payments,
    isLoadingPayments,
    subscriptions,
    isLoadingSubscriptions
  } = useAsaas();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const pendingPayments = payments.filter(p => p.status === 'PENDING');
  const overduePayments = payments.filter(p => p.status === 'OVERDUE');
  const receivedPayments = payments.filter(p => ['RECEIVED', 'CONFIRMED'].includes(p.status));
  const activeSubscriptions = subscriptions.filter(s => s.status === 'ACTIVE');

  const totalPending = pendingPayments.reduce((sum, p) => sum + p.value, 0);
  const totalOverdue = overduePayments.reduce((sum, p) => sum + p.value, 0);
  const totalReceived = receivedPayments.reduce((sum, p) => sum + p.value, 0);
  const totalRecurring = activeSubscriptions.reduce((sum, s) => sum + s.value, 0);

  const isLoading = isLoadingBalance || isLoadingPayments || isLoadingSubscriptions;

  return (
    <div className="space-y-6">
      {/* Refresh Button */}
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetchBalance()}
          disabled={isLoading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* Main Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Saldo Disponível</CardTitle>
            <Wallet className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            {isLoadingBalance ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <div className="text-2xl font-bold text-primary">
                {formatCurrency(balance || 0)}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-accent/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Recebido</CardTitle>
            <TrendingUp className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent>
            {isLoadingPayments ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <>
                <div className="text-2xl font-bold text-accent">{formatCurrency(totalReceived)}</div>
                <p className="text-xs text-muted-foreground">{receivedPayments.length} cobranças</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-yellow-500/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">A Receber</CardTitle>
            <Receipt className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            {isLoadingPayments ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <>
                <div className="text-2xl font-bold text-yellow-500">{formatCurrency(totalPending)}</div>
                <p className="text-xs text-muted-foreground">{pendingPayments.length} cobranças pendentes</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-destructive/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Vencido</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            {isLoadingPayments ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <>
                <div className="text-2xl font-bold text-destructive">{formatCurrency(totalOverdue)}</div>
                <p className="text-xs text-muted-foreground">{overduePayments.length} cobranças vencidas</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recurring Revenue */}
      <Card>
        <CardHeader>
          <CardTitle>Receita Recorrente</CardTitle>
          <CardDescription>Valor das assinaturas ativas</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingSubscriptions ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : (
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold">{formatCurrency(totalRecurring)}</span>
              <span className="text-muted-foreground">/mês</span>
              <span className="text-sm text-muted-foreground ml-4">
                ({activeSubscriptions.length} assinaturas ativas)
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
