import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAsaas } from "@/hooks/useAsaas";
import { useOrganization } from "@/hooks/useOrganization";
import { Wallet, Users, Receipt, RefreshCcw, CreditCard, Link2 } from "lucide-react";
import { AsaasDashboard } from "@/components/financeiro/AsaasDashboard";
import { AsaasCustomerList } from "@/components/financeiro/AsaasCustomerList";
import { AsaasPaymentList } from "@/components/financeiro/AsaasPaymentList";
import { AsaasSubscriptionList } from "@/components/financeiro/AsaasSubscriptionList";
import { AsaasTransferList } from "@/components/financeiro/AsaasTransferList";
import { AsaasPaymentLinkList } from "@/components/financeiro/AsaasPaymentLinkList";

const Financeiro = () => {
  const [activeTab, setActiveTab] = useState("dashboard");
  const { hasAsaas } = useAsaas();
  const { checkPermission } = useOrganization();

  // Permission checks for each tab
  const canViewDashboard = checkPermission('view_finances');
  const canViewCustomers = checkPermission('view_customers_asaas');
  const canViewPayments = checkPermission('view_payments_asaas');
  const canViewSubscriptions = checkPermission('view_subscriptions_asaas');
  const canViewTransfers = checkPermission('view_transfers_asaas');
  const canViewPaymentLinks = checkPermission('view_payment_links_asaas');

  // Get first available tab
  const getDefaultTab = () => {
    if (canViewDashboard) return "dashboard";
    if (canViewCustomers) return "customers";
    if (canViewPayments) return "payments";
    if (canViewSubscriptions) return "subscriptions";
    if (canViewTransfers) return "transfers";
    if (canViewPaymentLinks) return "payment-links";
    return "dashboard";
  };

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

  // Set initial tab to first available
  const effectiveTab = activeTab === "dashboard" && !canViewDashboard ? getDefaultTab() : activeTab;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Financeiro</h1>
          <p className="text-muted-foreground">
            Gerencie cobranças, clientes e pagamentos do Asaas
          </p>
        </div>

        <Tabs value={effectiveTab} onValueChange={setActiveTab}>
          <TabsList className="bg-secondary/50 p-1">
            {canViewDashboard && (
              <TabsTrigger value="dashboard" className="flex items-center gap-2">
                <Wallet className="h-4 w-4" />
                Dashboard
              </TabsTrigger>
            )}
            {canViewCustomers && (
              <TabsTrigger value="customers" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Clientes
              </TabsTrigger>
            )}
            {canViewPayments && (
              <TabsTrigger value="payments" className="flex items-center gap-2">
                <Receipt className="h-4 w-4" />
                Cobranças
              </TabsTrigger>
            )}
            {canViewSubscriptions && (
              <TabsTrigger value="subscriptions" className="flex items-center gap-2">
                <RefreshCcw className="h-4 w-4" />
                Assinaturas
              </TabsTrigger>
            )}
            {canViewTransfers && (
              <TabsTrigger value="transfers" className="flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Transferências
              </TabsTrigger>
            )}
            {canViewPaymentLinks && (
              <TabsTrigger value="payment-links" className="flex items-center gap-2">
                <Link2 className="h-4 w-4" />
                Links
              </TabsTrigger>
            )}
          </TabsList>

          {canViewDashboard && (
            <TabsContent value="dashboard" className="mt-6">
              <AsaasDashboard />
            </TabsContent>
          )}

          {canViewCustomers && (
            <TabsContent value="customers" className="mt-6">
              <AsaasCustomerList />
            </TabsContent>
          )}

          {canViewPayments && (
            <TabsContent value="payments" className="mt-6">
              <AsaasPaymentList />
            </TabsContent>
          )}

          {canViewSubscriptions && (
            <TabsContent value="subscriptions" className="mt-6">
              <AsaasSubscriptionList />
            </TabsContent>
          )}

          {canViewTransfers && (
            <TabsContent value="transfers" className="mt-6">
              <AsaasTransferList />
            </TabsContent>
          )}

          {canViewPaymentLinks && (
            <TabsContent value="payment-links" className="mt-6">
              <AsaasPaymentLinkList />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Financeiro;