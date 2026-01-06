import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSsotica } from "@/hooks/useSsotica";
import { SsoticaDashboard } from "@/components/ssotica/SsoticaDashboard";
import { SsoticaOSList } from "@/components/ssotica/SsoticaOSList";
import { SsoticaVendasList } from "@/components/ssotica/SsoticaVendasList";
import { SsoticaParcelasList } from "@/components/ssotica/SsoticaParcelasList";
import { Button } from "@/components/ui/button";
import { RefreshCw, Glasses } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const Ssotica = () => {
  const { hasSsotica, lastSync, isSyncing, syncAll, isLoading } = useSsotica();
  const [activeTab, setActiveTab] = useState("dashboard");

  if (!hasSsotica) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-[60vh] text-center">
          <Glasses className="h-16 w-16 text-muted-foreground mb-4" />
          <h2 className="text-2xl font-bold mb-2">ssOtica não conectado</h2>
          <p className="text-muted-foreground max-w-md">
            Conecte sua conta do ssOtica em Configurações → Integrações para visualizar seus dados de ótica aqui.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
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

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4 max-w-lg">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="os">O.S.</TabsTrigger>
            <TabsTrigger value="vendas">Vendas</TabsTrigger>
            <TabsTrigger value="parcelas">Parcelas</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="mt-6">
            <SsoticaDashboard />
          </TabsContent>

          <TabsContent value="os" className="mt-6">
            <SsoticaOSList />
          </TabsContent>

          <TabsContent value="vendas" className="mt-6">
            <SsoticaVendasList />
          </TabsContent>

          <TabsContent value="parcelas" className="mt-6">
            <SsoticaParcelasList />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Ssotica;
