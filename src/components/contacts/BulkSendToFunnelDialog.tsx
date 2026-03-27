import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useFunnels } from "@/hooks/useFunnels";
import { toast } from "sonner";
import { GitBranch, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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

interface BulkSendToFunnelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactIds: string[];
  onSuccess?: () => void;
}

export function BulkSendToFunnelDialog({
  open,
  onOpenChange,
  contactIds,
  onSuccess,
}: BulkSendToFunnelDialogProps) {
  const { user } = useAuth();
  const { funnels } = useFunnels();
  const queryClient = useQueryClient();

  const [selectedFunnelId, setSelectedFunnelId] = useState("");
  const [selectedStageId, setSelectedStageId] = useState("");

  const selectedFunnel = funnels?.find((f) => f.id === selectedFunnelId);
  const stages = selectedFunnel?.stages || [];

  const bulkCreate = useMutation({
    mutationFn: async () => {
      if (!user?.id || !selectedFunnelId || !selectedStageId) return;

      // Find contacts that already have a deal in this funnel
      const { data: existingDeals } = await supabase
        .from("funnel_deals")
        .select("contact_id")
        .eq("funnel_id", selectedFunnelId)
        .in("contact_id", contactIds);

      const existingContactIds = new Set(
        (existingDeals || []).map((d) => d.contact_id)
      );
      const newContactIds = contactIds.filter(
        (id) => !existingContactIds.has(id)
      );

      if (newContactIds.length === 0) {
        toast.info("Todos os contatos selecionados já estão neste funil");
        return;
      }

      const BATCH_SIZE = 50;
      let created = 0;
      for (let i = 0; i < newContactIds.length; i += BATCH_SIZE) {
        const batch = newContactIds.slice(i, i + BATCH_SIZE);
        const deals = batch.map((contactId) => ({
          user_id: user.id,
          funnel_id: selectedFunnelId,
          stage_id: selectedStageId,
          contact_id: contactId,
          title: "",
          value: 0,
        }));

        const { error } = await supabase.from("funnel_deals").insert(deals);
        if (error) throw error;
        created += batch.length;
      }

      const skipped = existingContactIds.size;
      const msg = skipped > 0
        ? `${created} contatos enviados ao funil (${skipped} já existiam)`
        : `${created} contatos enviados ao funil`;
      toast.success(msg);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["funnel-deals"] });
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      setSelectedFunnelId("");
      setSelectedStageId("");
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast.error("Erro ao enviar para funil: " + error.message);
    },
  });

  const handleFunnelChange = (funnelId: string) => {
    setSelectedFunnelId(funnelId);
    const funnel = funnels?.find((f) => f.id === funnelId);
    const firstStage = funnel?.stages?.[0];
    setSelectedStageId(firstStage?.id || "");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            Enviar para Funil
          </DialogTitle>
          <DialogDescription>
            Enviar {contactIds.length} contato{contactIds.length !== 1 ? "s" : ""} selecionado{contactIds.length !== 1 ? "s" : ""} para um funil
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Funil *</Label>
            <Select value={selectedFunnelId} onValueChange={handleFunnelChange}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um funil" />
              </SelectTrigger>
              <SelectContent>
                {funnels?.map((funnel) => (
                  <SelectItem key={funnel.id} value={funnel.id}>
                    {funnel.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedFunnelId && (
            <div className="space-y-2">
              <Label>Etapa *</Label>
              <Select value={selectedStageId} onValueChange={setSelectedStageId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma etapa" />
                </SelectTrigger>
                <SelectContent>
                  {stages.map((stage) => (
                    <SelectItem key={stage.id} value={stage.id}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: stage.color }}
                        />
                        {stage.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => bulkCreate.mutate()}
            disabled={!selectedFunnelId || !selectedStageId || bulkCreate.isPending}
          >
            {bulkCreate.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Enviando...
              </>
            ) : (
              "Enviar para Funil"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}