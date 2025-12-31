import { useState } from "react";
import { Coins, Send, User, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAITokens } from "@/hooks/useAITokens";

interface TransferTokensDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetUser: {
    id: string;
    email: string;
  } | null;
  onSuccess?: () => void;
}

export const TransferTokensDialog = ({
  open,
  onOpenChange,
  targetUser,
  onSuccess,
}: TransferTokensDialogProps) => {
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [transferring, setTransferring] = useState(false);
  const { balance, formatTokens, fetchBalance } = useAITokens();

  const adminBalance = balance?.balance || 0;
  const amountNum = parseInt(amount) || 0;
  const isValidAmount = amountNum > 0 && amountNum <= adminBalance;

  const handleTransfer = async () => {
    if (!targetUser || !isValidAmount) return;

    setTransferring(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-transfer-tokens', {
        body: {
          targetUserId: targetUser.id,
          amount: amountNum,
          description: description || `Transferência para ${targetUser.email}`,
        },
      });

      if (error) throw error;

      toast.success(`${formatTokens(amountNum)} tokens transferidos com sucesso!`);
      fetchBalance();
      onSuccess?.();
      onOpenChange(false);
      setAmount("");
      setDescription("");
    } catch (err: any) {
      console.error('Error transferring tokens:', err);
      toast.error(err.message || 'Erro ao transferir tokens');
    } finally {
      setTransferring(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-primary" />
            Transferir Tokens
          </DialogTitle>
          <DialogDescription>
            Transfira tokens do seu saldo para outro usuário
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Admin balance */}
          <div className="p-4 bg-muted/50 rounded-xl">
            <p className="text-sm text-muted-foreground mb-1">Seu saldo disponível</p>
            <p className="text-2xl font-bold text-accent">{formatTokens(adminBalance)}</p>
          </div>

          {/* Target user */}
          <div className="space-y-2">
            <Label className="text-sm">Destinatário</Label>
            <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-xl">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{targetUser?.email}</span>
            </div>
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <Label htmlFor="amount">Quantidade de Tokens</Label>
            <Input
              id="amount"
              type="number"
              placeholder="Ex: 10000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="rounded-xl"
              min={1}
              max={adminBalance}
            />
            {amountNum > adminBalance && (
              <p className="text-xs text-destructive">
                Quantidade maior que seu saldo disponível
              </p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Descrição (opcional)</Label>
            <Textarea
              id="description"
              placeholder="Motivo da transferência..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="rounded-xl resize-none"
              rows={2}
            />
          </div>

          {amountNum > 0 && isValidAmount && (
            <Alert className="border-accent/30 bg-accent/5">
              <AlertCircle className="h-4 w-4 text-accent" />
              <AlertDescription className="text-sm">
                Após a transferência, seu saldo será de{" "}
                <strong>{formatTokens(adminBalance - amountNum)}</strong> tokens
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-xl"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleTransfer}
            disabled={!isValidAmount || transferring}
            className="gap-2 rounded-xl"
          >
            {transferring ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Transferindo...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Transferir {amountNum > 0 ? formatTokens(amountNum) : ''} Tokens
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
