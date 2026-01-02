import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAsaas } from "@/hooks/useAsaas";
import { useOrganization } from "@/hooks/useOrganization";
import { Plus, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const statusColors: Record<string, string> = {
  PENDING: "bg-yellow-500/20 text-yellow-500",
  BANK_PROCESSING: "bg-blue-500/20 text-blue-500",
  DONE: "bg-green-500/20 text-green-500",
  CANCELLED: "bg-gray-500/20 text-gray-500",
  FAILED: "bg-red-500/20 text-red-500",
};

const statusLabels: Record<string, string> = {
  PENDING: "Pendente",
  BANK_PROCESSING: "Processando",
  DONE: "Concluída",
  CANCELLED: "Cancelada",
  FAILED: "Falhou",
};

export const AsaasTransferList = () => {
  const { transfers, isLoadingTransfers, balance } = useAsaas();
  const { checkPermission } = useOrganization();

  const canCreate = checkPermission('create_transfers_asaas');

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Transferências</CardTitle>
          {balance !== undefined && (
            <p className="text-sm text-muted-foreground mt-1">
              Saldo disponível: <span className="font-medium text-primary">{formatCurrency(balance)}</span>
            </p>
          )}
        </div>
        {canCreate && (
          <Button disabled>
            <Plus className="h-4 w-4 mr-2" />
            Nova Transferência
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {isLoadingTransfers ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Destino</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Taxa</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transfers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Nenhuma transferência encontrada
                  </TableCell>
                </TableRow>
              ) : (
                transfers.map((transfer) => (
                  <TableRow key={transfer.id}>
                    <TableCell>
                      {format(new Date(transfer.dateCreated), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{transfer.type}</Badge>
                    </TableCell>
                    <TableCell>
                      {transfer.bankAccount?.pixAddressKey || 
                       transfer.bankAccount?.ownerName || 
                       '-'}
                    </TableCell>
                    <TableCell className="font-medium">{formatCurrency(transfer.value)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {transfer.transferFee ? formatCurrency(transfer.transferFee) : '-'}
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColors[transfer.status] || "bg-gray-500/20"}>
                        {statusLabels[transfer.status] || transfer.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};