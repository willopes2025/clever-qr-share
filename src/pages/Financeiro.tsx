import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAsaas } from "@/hooks/useAsaas";
import { Wallet, Users, Receipt, RefreshCcw, CreditCard, Link2, Loader2 } from "lucide-react";
import { AsaasDashboard } from "@/components/financeiro/AsaasDashboard";
import { AsaasCustomerList } from "@/components/financeiro/AsaasCustomerList";
import { AsaasPaymentList } from "@/components/financeiro/AsaasPaymentList";
import { AsaasSubscriptionList } from "@/components/financeiro/AsaasSubscriptionList";
import { AsaasTransferList } from "@/components/financeiro/AsaasTransferList";
import { AsaasPaymentLinkList } from "@/components/financeiro/AsaasPaymentLinkList";

const Financeiro = () => {
  const [activeTab, setActiveTab] = useState("dashboard");
  const { hasAsaas } = useAsaas();

  if (!hasAsaas) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-full py-12">
          <Wallet className="h-16 w-16 text-muted-foreground mb-4" />
          <h2 className="text-2xl font-bold mb-2">Financeiro não configurado</h2>
          <p className="text-muted-foreground text-center max-w-md">
            Para usar o módulo financeiro, conecte sua conta Asaas em Configurações → Integrações.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Financeiro</h1>
          <p className="text-muted-foreground">
            Gerencie cobranças, clientes e pagamentos do Asaas
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-secondary/50 p-1">
            <TabsTrigger value="dashboard" className="flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="customers" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Clientes
            </TabsTrigger>
            <TabsTrigger value="payments" className="flex items-center gap-2">
              <Receipt className="h-4 w-4" />
              Cobranças
            </TabsTrigger>
            <TabsTrigger value="subscriptions" className="flex items-center gap-2">
              <RefreshCcw className="h-4 w-4" />
              Assinaturas
            </TabsTrigger>
            <TabsTrigger value="transfers" className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Transferências
            </TabsTrigger>
            <TabsTrigger value="payment-links" className="flex items-center gap-2">
              <Link2 className="h-4 w-4" />
              Links
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="mt-6">
            <AsaasDashboard />
          </TabsContent>

          <TabsContent value="customers" className="mt-6">
            <AsaasCustomerList />
          </TabsContent>

          <TabsContent value="payments" className="mt-6">
            <AsaasPaymentList />
          </TabsContent>

          <TabsContent value="subscriptions" className="mt-6">
            <AsaasSubscriptionList />
          </TabsContent>

          <TabsContent value="transfers" className="mt-6">
            <AsaasTransferList />
          </TabsContent>

          <TabsContent value="payment-links" className="mt-6">
            <AsaasPaymentLinkList />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Financeiro;
