import { useState } from "react";
import { AppLayout } from "@/layouts/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSsotica } from "@/hooks/useSsotica";
import { useIntegrationStatus } from "@/hooks/useIntegrationStatus";
import { useOrganization } from "@/hooks/useOrganization";
import { SsoticaDashboard } from "@/components/ssotica/SsoticaDashboard";
import { SsoticaOSList } from "@/components/ssotica/SsoticaOSList";
import { SsoticaVendasList } from "@/components/ssotica/SsoticaVendasList";
import { SsoticaParcelasList } from "@/components/ssotica/SsoticaParcelasList";
import { SsoticaFinanceiro } from "@/components/ssotica/SsoticaFinanceiro";
import { SsoticaDateFilter, SsoticaDateRange } from "@/components/ssotica/SsoticaDateFilter";
import { Button } from "@/components/ui/button";
import { RefreshCw, Glasses } from "lucide-react";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";

const Ssotica = () => {
  const { hasSsotica, isLoading: isLoadingStatus } = useIntegrationStatus();
  const { lastSync, isSyncing, syncAll, isLoading } = useSsotica();
  const { currentMember } = useOrganization();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [dateRange, setDateRange] = useState<SsoticaDateRange>(() => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const from = subDays(today, 30);
    from.setHours(0, 0, 0, 0);
    return { from, to: today };
  });

  // Check if user is a member (not owner)
  const isMember = !!currentMember;

  if (isLoadingStatus) {
    return (
      <AppLayout pageTitle="ssOtica">
        <div className="flex flex-col items-center justify-center h-[60vh] text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!hasSsotica) {
    return (
      <AppLayout pageTitle="ssOtica">
        <div className="flex flex-col items-center justify-center h-[60vh] text-center">
          <Glasses className="h-16 w-16 text-muted-foreground mb-4" />
          <h2 className="text-2xl font-bold mb-2">ssOtica não conectado</h2>
          <p className="text-muted-foreground max-w-md">
            {isMember
              ? "O ssOtica ainda não foi configurado pelo administrador. Solicite a conexão em Configurações → Integrações."
              : "Conecte sua conta do ssOtica em Configurações → Integrações para visualizar seus dados de ótica aqui."}
          </p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout pageTitle="ssOtica">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Glasses className="h-7 w-7 text-primary" />
                ssOtica
              </h1>
              <p className="text-muted-foreground">
                Gerencie suas ordens de serviço, vendas e parcelas
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              {lastSync && (
                <span className="text-xs text-muted-foreground">
                  Atualizado: {format(new Date(lastSync), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                </span>
              )}
              <Button 
                variant="outline" 
                size="sm" 
                onClick={syncAll}
                disabled={isSyncing}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
                Sincronizar
              </Button>
            </div>
          </div>

          {/* Date Filter */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Período:</span>
            <SsoticaDateFilter value={dateRange} onChange={setDateRange} />
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5 max-w-xl">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="os">O.S.</TabsTrigger>
            <TabsTrigger value="vendas">Vendas</TabsTrigger>
            <TabsTrigger value="parcelas">Parcelas</TabsTrigger>
            <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="mt-6">
            <SsoticaDashboard dateRange={dateRange} />
          </TabsContent>

          <TabsContent value="os" className="mt-6">
            <SsoticaOSList dateRange={dateRange} />
          </TabsContent>

          <TabsContent value="vendas" className="mt-6">
            <SsoticaVendasList dateRange={dateRange} />
          </TabsContent>

          <TabsContent value="parcelas" className="mt-6">
            <SsoticaParcelasList />
          </TabsContent>

          <TabsContent value="financeiro" className="mt-6">
            <SsoticaFinanceiro dateRange={dateRange} />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default Ssotica;
