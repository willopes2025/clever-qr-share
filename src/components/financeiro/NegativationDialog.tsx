import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, FileX, Loader2 } from 'lucide-react';
import { TopDebtor } from '@/hooks/useFinancialMetrics';

interface NegativationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  debtor: TopDebtor | null;
  onConfirm: (paymentId: string, description?: string) => void;
  isLoading?: boolean;
}

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

export const NegativationDialog = ({
  open,
  onOpenChange,
  debtor,
  onConfirm,
  isLoading = false,
}: NegativationDialogProps) => {
  const [description, setDescription] = useState('');

  const handleConfirm = () => {
    if (debtor && debtor.overduePaymentIds.length > 0) {
      // Negativar a primeira cobrança vencida
      onConfirm(debtor.overduePaymentIds[0], description || undefined);
    }
  };

  if (!debtor) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileX className="h-5 w-5 text-destructive" />
            Negativar no Serasa
          </DialogTitle>
          <DialogDescription>
            Você está prestes a negativar o cliente no Serasa. Esta ação pode ser cancelada posteriormente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Atenção</AlertTitle>
            <AlertDescription className="text-sm">
              <ul className="list-disc list-inside space-y-1 mt-2">
                <li>A negativação tem custos associados no Asaas</li>
                <li>É necessário ter permissão de negativação ativa</li>
                <li>O cliente será notificado sobre a negativação</li>
                <li>Cobranças recentes podem não ser elegíveis</li>
              </ul>
            </AlertDescription>
          </Alert>

          <div className="rounded-lg border p-4 space-y-2 bg-muted/50">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Cliente</span>
              <span className="text-sm font-medium">{debtor.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">CPF/CNPJ</span>
              <span className="text-sm font-medium">{debtor.customerCpfCnpj || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Valor total em atraso</span>
              <span className="text-sm font-semibold text-destructive">
                {formatCurrency(debtor.value)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Cobranças vencidas</span>
              <span className="text-sm font-medium">{debtor.paymentsCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Dias em atraso</span>
              <span className="text-sm font-medium">{debtor.daysOverdue} dias</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição/Observação (opcional)</Label>
            <Textarea
              id="description"
              placeholder="Ex: Tentativas de contato sem sucesso..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={isLoading || debtor.overduePaymentIds.length === 0}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processando...
              </>
            ) : (
              <>
                <FileX className="mr-2 h-4 w-4" />
                Confirmar Negativação
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
