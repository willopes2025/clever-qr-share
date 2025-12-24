import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useFunnels, FunnelDeal, FunnelStage } from "@/hooks/useFunnels";
import { CheckCircle, XCircle } from "lucide-react";

interface CloseDealDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deal: FunnelDeal;
  stages: FunnelStage[];
}

export const CloseDealDialog = ({ open, onOpenChange, deal, stages }: CloseDealDialogProps) => {
  const { updateDeal, closeReasons } = useFunnels();
  const [closeType, setCloseType] = useState<'won' | 'lost' | null>(null);
  const [reasonId, setReasonId] = useState('');

  const wonStage = stages.find(s => s.is_final && s.final_type === 'won');
  const lostStage = stages.find(s => s.is_final && s.final_type === 'lost');
  
  const filteredReasons = closeReasons?.filter(r => r.type === closeType) || [];

  const handleClose = async () => {
    const targetStage = closeType === 'won' ? wonStage : lostStage;
    if (!targetStage) return;

    await updateDeal.mutateAsync({
      id: deal.id,
      stage_id: targetStage.id,
      closed_at: new Date().toISOString(),
      close_reason_id: reasonId || null
    });

    onOpenChange(false);
    setCloseType(null);
    setReasonId('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Fechar Deal</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {!closeType ? (
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                className="h-24 flex-col gap-2 border-green-500/30 hover:bg-green-500/10 hover:border-green-500"
                onClick={() => setCloseType('won')}
                disabled={!wonStage}
              >
                <CheckCircle className="h-8 w-8 text-green-500" />
                <span className="font-medium">Ganho</span>
              </Button>
              <Button
                variant="outline"
                className="h-24 flex-col gap-2 border-red-500/30 hover:bg-red-500/10 hover:border-red-500"
                onClick={() => setCloseType('lost')}
                disabled={!lostStage}
              >
                <XCircle className="h-8 w-8 text-red-500" />
                <span className="font-medium">Perdido</span>
              </Button>
            </div>
          ) : (
            <>
              <div className="text-center p-4 rounded-lg bg-muted">
                {closeType === 'won' ? (
                  <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-2" />
                ) : (
                  <XCircle className="h-12 w-12 text-red-500 mx-auto mb-2" />
                )}
                <p className="font-medium">
                  {closeType === 'won' ? 'Marcar como Ganho' : 'Marcar como Perdido'}
                </p>
              </div>

              {filteredReasons.length > 0 && (
                <div className="space-y-2">
                  <Label>Motivo (opcional)</Label>
                  <Select value={reasonId} onValueChange={setReasonId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar motivo" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredReasons.map((reason) => (
                        <SelectItem key={reason.id} value={reason.id}>
                          {reason.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setCloseType(null)}>
                  Voltar
                </Button>
                <Button 
                  className="flex-1"
                  onClick={handleClose}
                  disabled={updateDeal.isPending}
                >
                  Confirmar
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
