import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAsaas, AsaasPayment } from "@/hooks/useAsaas";
import { useOrganization } from "@/hooks/useOrganization";
import { Plus, Loader2, ExternalLink, Copy, Trash2, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AsaasPaymentForm } from "./AsaasPaymentForm";
import { AsaasPaymentFilters, PaymentFilters, initialPaymentFilters } from "./AsaasPaymentFilters";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const statusColors: Record<string, string> = {
  PENDING: "bg-yellow-500/20 text-yellow-500",
  RECEIVED: "bg-green-500/20 text-green-500",
  CONFIRMED: "bg-green-500/20 text-green-500",
  OVERDUE: "bg-red-500/20 text-red-500",
  REFUNDED: "bg-purple-500/20 text-purple-500",
  RECEIVED_IN_CASH: "bg-green-500/20 text-green-500",
  REFUND_REQUESTED: "bg-orange-500/20 text-orange-500",
};

const statusLabels: Record<string, string> = {
  PENDING: "Pendente",
  RECEIVED: "Recebido",
  CONFIRMED: "Confirmado",
  OVERDUE: "Vencido",
  REFUNDED: "Reembolsado",
  RECEIVED_IN_CASH: "Recebido em Dinheiro",
  REFUND_REQUESTED: "Reembolso Solicitado",
  AWAITING_RISK_ANALYSIS: "Análise de Risco",
};

const billingTypeLabels: Record<string, string> = {
  BOLETO: "Boleto",
  CREDIT_CARD: "Cartão",
  PIX: "PIX",
  UNDEFINED: "-",
};

export const AsaasPaymentList = () => {
  const { 
    payments, 
    isLoadingPayments, 
    deletePayment, 
    getPixQrCode, 
    customers,
    paymentsCount,
    lastSync,
    isSyncing,
    syncAll
  } = useAsaas();
  const { checkPermission } = useOrganization();
  const [filters, setFilters] = useState<PaymentFilters>(initialPaymentFilters);
  const [showForm, setShowForm] = useState(false);
  const [deletingPayment, setDeletingPayment] = useState<AsaasPayment | null>(null);
  const [loadingQr, setLoadingQr] = useState<string | null>(null);

  const canCreate = checkPermission('create_payments_asaas');
  const canDelete = checkPermission('delete_payments_asaas');

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const getCustomerName = (customerId: string) => {
    const customer = customers.find(c => c.id === customerId);
    return customer?.name || customerId;
  };

  const filteredPayments = payments.filter(payment => {
    // Filtro por busca texto
    if (filters.searchQuery && 
        !payment.description?.toLowerCase().includes(filters.searchQuery.toLowerCase()) &&
        !getCustomerName(payment.customer).toLowerCase().includes(filters.searchQuery.toLowerCase())) {
      return false;
    }
    
    // Filtro por cliente
    if (filters.customer && payment.customer !== filters.customer) return false;
    
    // Filtro por status
    if (filters.status !== "all" && payment.status !== filters.status) return false;
    
    // Filtro por tipo
    if (filters.billingType !== "all" && payment.billingType !== filters.billingType) return false;
    
    // Filtro por data de vencimento
    if (filters.dueDateStart && payment.dueDate < filters.dueDateStart) return false;
    if (filters.dueDateEnd && payment.dueDate > filters.dueDateEnd) return false;
    
    // Filtro por valor
    if (filters.valueMin && payment.value < parseFloat(filters.valueMin)) return false;
    if (filters.valueMax && payment.value > parseFloat(filters.valueMax)) return false;
    
    return true;
  });

  const handleDelete = async () => {
    if (deletingPayment) {
      await deletePayment.mutateAsync(deletingPayment.id);
      setDeletingPayment(null);
    }
  };

  const handleCopyPix = async (payment: AsaasPayment) => {
    setLoadingQr(payment.id);
    try {
      const result = await getPixQrCode.mutateAsync(payment.id);
      if (result?.payload) {
        await navigator.clipboard.writeText(result.payload);
        toast.success("Código PIX copiado!");
      }
    } catch {
      toast.error("Erro ao obter código PIX");
    } finally {
      setLoadingQr(null);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-3">
          <CardTitle>Cobranças</CardTitle>
          {!isLoadingPayments && (
            <Badge variant="secondary" className="font-normal">
              {paymentsCount} registros
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {lastSync && (
            <span className="text-xs text-muted-foreground hidden sm:inline">
              Atualizado: {format(new Date(lastSync), "HH:mm", { locale: ptBR })}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={syncAll}
            disabled={isSyncing}
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", isSyncing && "animate-spin")} />
            Sincronizar
          </Button>
          {canCreate && (
            <Button onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Cobrança
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <AsaasPaymentFilters
            filters={filters}
            onFiltersChange={setFilters}
            customers={customers}
          />
        </div>

        {isLoadingPayments ? (
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">
              Carregando cobranças do Asaas...
            </span>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPayments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Nenhuma cobrança encontrada
                  </TableCell>
                </TableRow>
              ) : (
                filteredPayments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell className="font-medium">{getCustomerName(payment.customer)}</TableCell>
                    <TableCell>{payment.description || '-'}</TableCell>
                    <TableCell>
                      {format(new Date(payment.dueDate), "dd/MM/yyyy", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="font-medium">{formatCurrency(payment.value)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{billingTypeLabels[payment.billingType]}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColors[payment.status] || "bg-gray-500/20"}>
                        {statusLabels[payment.status] || payment.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {payment.billingType === 'PIX' && payment.status === 'PENDING' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleCopyPix(payment)}
                            disabled={loadingQr === payment.id}
                          >
                            {loadingQr === payment.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                        {payment.invoiceUrl && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => window.open(payment.invoiceUrl, '_blank')}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        )}
                        {canDelete && payment.status === 'PENDING' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeletingPayment(payment)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {showForm && (
        <AsaasPaymentForm onClose={() => setShowForm(false)} />
      )}

      <AlertDialog open={!!deletingPayment} onOpenChange={() => setDeletingPayment(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Cobrança</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta cobrança? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};