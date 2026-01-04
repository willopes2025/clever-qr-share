import { useState, useEffect } from "react";
import { ArrowRightLeft } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { FunnelDeal, useFunnels } from "@/hooks/useFunnels";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface MoveDealFunnelDialogProps {
  deal: FunnelDeal;
  currentFunnelId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const MoveDealFunnelDialog = ({
  deal,
  currentFunnelId,
  open,
  onOpenChange,
}: MoveDealFunnelDialogProps) => {
  const { funnels } = useFunnels();
  const queryClient = useQueryClient();
  const [selectedFunnelId, setSelectedFunnelId] = useState<string>("");
  const [selectedStageId, setSelectedStageId] = useState<string>("");
  const [isMoving, setIsMoving] = useState(false);

  // Get funnels excluding the current one
  const availableFunnels = funnels?.filter(f => f.id !== currentFunnelId) || [];

  // Get stages from selected funnel
  const selectedFunnel = funnels?.find(f => f.id === selectedFunnelId);
  const availableStages = selectedFunnel?.stages?.sort((a, b) => a.display_order - b.display_order) || [];

  // Reset stage selection when funnel changes
  useEffect(() => {
    if (selectedFunnelId && availableStages.length > 0) {
      setSelectedStageId(availableStages[0].id);
    } else {
      setSelectedStageId("");
    }
  }, [selectedFunnelId]);

  // Reset selections when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedFunnelId("");
      setSelectedStageId("");
    }
  }, [open]);

  const handleMove = async () => {
    if (!selectedFunnelId || !selectedStageId) {
      toast.error("Selecione um funil e uma etapa");
      return;
    }

    setIsMoving(true);

    try {
      const currentFunnel = funnels?.find(f => f.id === currentFunnelId);
      const targetFunnel = funnels?.find(f => f.id === selectedFunnelId);

      // Update the deal
      const { error: updateError } = await supabase
        .from("funnel_deals")
        .update({
          funnel_id: selectedFunnelId,
          stage_id: selectedStageId,
          entered_stage_at: new Date().toISOString(),
        })
        .eq("id", deal.id);

      if (updateError) throw updateError;

      // Record in history
      await supabase.from("funnel_deal_history").insert({
        deal_id: deal.id,
        from_stage_id: deal.stage_id,
        to_stage_id: selectedStageId,
        notes: `Movido do funil "${currentFunnel?.name || 'anterior'}" para "${targetFunnel?.name || 'novo'}"`,
      });

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ["funnels"] });

      toast.success("Lead movido para o novo funil com sucesso!");
      onOpenChange(false);
    } catch (error) {
      console.error("Erro ao mover deal:", error);
      toast.error("Erro ao mover lead. Tente novamente.");
    } finally {
      setIsMoving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5" />
            Mover para outro funil
          </DialogTitle>
          <DialogDescription>
            Transfira este lead para um funil diferente. Selecione o funil de destino e a etapa inicial.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="funnel">Funil de destino</Label>
            <Select value={selectedFunnelId} onValueChange={setSelectedFunnelId}>
              <SelectTrigger id="funnel">
                <SelectValue placeholder="Selecione um funil..." />
              </SelectTrigger>
              <SelectContent>
                {availableFunnels.length === 0 ? (
                  <div className="p-2 text-sm text-muted-foreground text-center">
                    Nenhum outro funil disponível
                  </div>
                ) : (
                  availableFunnels.map((funnel) => (
                    <SelectItem key={funnel.id} value={funnel.id}>
                      {funnel.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {selectedFunnelId && (
            <div className="space-y-2">
              <Label htmlFor="stage">Etapa inicial</Label>
              <Select value={selectedStageId} onValueChange={setSelectedStageId}>
                <SelectTrigger id="stage">
                  <SelectValue placeholder="Selecione uma etapa..." />
                </SelectTrigger>
                <SelectContent>
                  {availableStages.map((stage) => (
                    <SelectItem key={stage.id} value={stage.id}>
                      {stage.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleMove} 
            disabled={!selectedFunnelId || !selectedStageId || isMoving}
          >
            {isMoving ? "Movendo..." : "Mover"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
