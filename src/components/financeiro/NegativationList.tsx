import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AsaasNegativation } from '@/hooks/useAsaas';
import { AlertCircle, X, Loader2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface NegativationListProps {
  negativations: AsaasNegativation[];
  isLoading?: boolean;
  onCancel?: (id: string) => void;
  isCancelling?: boolean;
}

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

const getStatusBadge = (status: AsaasNegativation['status']) => {
  const statusConfig: Record<AsaasNegativation['status'], { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    PENDING: { label: 'Pendente', variant: 'secondary' },
    AWAITING_APPROVAL: { label: 'Aguardando Aprovação', variant: 'outline' },
    PROCESSED: { label: 'Processada', variant: 'default' },
    CANCELLED: { label: 'Cancelada', variant: 'destructive' },
    AWAITING_CANCELLATION: { label: 'Cancelando...', variant: 'outline' },
  };

  const config = statusConfig[status] || { label: status, variant: 'outline' as const };

  return <Badge variant={config.variant}>{config.label}</Badge>;
};

export const NegativationList = ({
  negativations,
  isLoading = false,
  onCancel,
  isCancelling = false,
}: NegativationListProps) => {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Negativações</CardTitle>
          <CardDescription>Lista de negativações no Serasa</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (negativations.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Negativações</CardTitle>
          <CardDescription>Lista de negativações no Serasa</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <AlertCircle className="h-8 w-8 mb-2 opacity-50" />
            <p className="text-sm">Nenhuma negativação encontrada</p>
            <p className="text-xs">Nenhum cliente foi negativado ainda</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Negativações</CardTitle>
        <CardDescription>{negativations.length} negativação(ões) registrada(s)</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>CPF/CNPJ</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {negativations.map((negativation) => (
              <TableRow key={negativation.id}>
                <TableCell className="font-medium">
                  {negativation.customerName || '-'}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {negativation.customerCpfCnpj || '-'}
                </TableCell>
                <TableCell className="text-right font-semibold">
                  {formatCurrency(negativation.value)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {negativation.requestDate
                    ? format(parseISO(negativation.requestDate), 'dd/MM/yyyy', { locale: ptBR })
                    : '-'}
                </TableCell>
                <TableCell>
                  {getStatusBadge(negativation.status)}
                </TableCell>
                <TableCell className="text-right">
                  {negativation.canBeCancelled && onCancel && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onCancel(negativation.id)}
                      disabled={isCancelling}
                    >
                      {isCancelling ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <X className="h-4 w-4 mr-1" />
                          Cancelar
                        </>
                      )}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};
