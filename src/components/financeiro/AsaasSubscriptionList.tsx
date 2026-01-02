import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAsaas, AsaasSubscription } from "@/hooks/useAsaas";
import { useOrganization } from "@/hooks/useOrganization";
import { Loader2, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
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
  ACTIVE: "bg-green-500/20 text-green-500",
  INACTIVE: "bg-gray-500/20 text-gray-500",
  EXPIRED: "bg-red-500/20 text-red-500",
};

const statusLabels: Record<string, string> = {
  ACTIVE: "Ativa",
  INACTIVE: "Inativa",
  EXPIRED: "Expirada",
};

const cycleLabels: Record<string, string> = {
  WEEKLY: "Semanal",
  BIWEEKLY: "Quinzenal",
  MONTHLY: "Mensal",
  BIMONTHLY: "Bimestral",
  QUARTERLY: "Trimestral",
  SEMIANNUALLY: "Semestral",
  YEARLY: "Anual",
};

export const AsaasSubscriptionList = () => {
  const { subscriptions, isLoadingSubscriptions, deleteSubscription, customers } = useAsaas();
  const { checkPermission } = useOrganization();
  const [deletingSubscription, setDeletingSubscription] = useState<AsaasSubscription | null>(null);

  const canDelete = checkPermission('delete_subscriptions_asaas');

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

  const handleDelete = async () => {
    if (deletingSubscription) {
      await deleteSubscription.mutateAsync(deletingSubscription.id);
      setDeletingSubscription(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Assinaturas</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoadingSubscriptions ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Ciclo</TableHead>
                <TableHead>Próximo Venc.</TableHead>
                <TableHead>Status</TableHead>
                {canDelete && <TableHead className="text-right">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {subscriptions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canDelete ? 7 : 6} className="text-center text-muted-foreground py-8">
                    Nenhuma assinatura encontrada
                  </TableCell>
                </TableRow>
              ) : (
                subscriptions.map((subscription) => (
                  <TableRow key={subscription.id}>
                    <TableCell className="font-medium">{getCustomerName(subscription.customer)}</TableCell>
                    <TableCell>{subscription.description || '-'}</TableCell>
                    <TableCell className="font-medium">{formatCurrency(subscription.value)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{cycleLabels[subscription.cycle] || subscription.cycle}</Badge>
                    </TableCell>
                    <TableCell>
                      {format(new Date(subscription.nextDueDate), "dd/MM/yyyy", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColors[subscription.status] || "bg-gray-500/20"}>
                        {statusLabels[subscription.status] || subscription.status}
                      </Badge>
                    </TableCell>
                    {canDelete && (
                      <TableCell className="text-right">
                        {subscription.status === 'ACTIVE' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeletingSubscription(subscription)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <AlertDialog open={!!deletingSubscription} onOpenChange={() => setDeletingSubscription(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar Assinatura</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja cancelar esta assinatura? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Cancelar Assinatura
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};