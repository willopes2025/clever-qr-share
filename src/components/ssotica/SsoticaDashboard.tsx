import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSsotica } from "@/hooks/useSsotica";
import { Loader2, FileText, ShoppingCart, Receipt, AlertTriangle } from "lucide-react";

export const SsoticaDashboard = () => {
  const { metrics, isLoading } = useSsotica();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

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
            <div className="text-2xl font-bold">{metrics.osAbertas}</div>
            <p className="text-xs text-muted-foreground">
              Ordens de serviço em andamento
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vendas do Mês</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.vendasMes}</div>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(metrics.valorVendas)} faturado
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

      {/* Informativo sobre limite de 30 dias */}
      <Card className="bg-muted/50">
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">
            <strong>Nota:</strong> A API do ssOtica permite consultar apenas os últimos 30 dias por requisição. 
            Os dados de O.S. e Vendas mostram os últimos 30 dias, enquanto as parcelas buscam até 365 dias.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
