import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useFunnels, FunnelDeal } from "@/hooks/useFunnels";
import { useContacts } from "@/hooks/useContacts";

interface DealFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  funnelId?: string;
  stageId?: string;
  deal?: FunnelDeal;
  contactId?: string;
  conversationId?: string;
}

export const DealFormDialog = ({ 
  open, 
  onOpenChange, 
  funnelId, 
  stageId, 
  deal,
  contactId: initialContactId,
  conversationId 
}: DealFormDialogProps) => {
  const { funnels, createDeal, updateDeal } = useFunnels();
  const { contacts } = useContacts();
  
  const [title, setTitle] = useState(deal?.title || '');
  const [contactId, setContactId] = useState(deal?.contact_id || initialContactId || '');
  const [value, setValue] = useState(deal?.value?.toString() || '');
  const [expectedCloseDate, setExpectedCloseDate] = useState(deal?.expected_close_date || '');
  const [source, setSource] = useState(deal?.source || '');
  const [notes, setNotes] = useState(deal?.notes || '');
  const [selectedStageId, setSelectedStageId] = useState(stageId || deal?.stage_id || '');
  const [selectedFunnelId, setSelectedFunnelId] = useState(funnelId || deal?.funnel_id || '');

  const currentFunnel = funnels?.find(f => f.id === selectedFunnelId);
  const stages = currentFunnel?.stages || [];

  // Reset form when dialog opens with new data
  useEffect(() => {
    if (open) {
      setTitle(deal?.title || '');
      setContactId(deal?.contact_id || initialContactId || '');
      setValue(deal?.value?.toString() || '');
      setExpectedCloseDate(deal?.expected_close_date || '');
      setSource(deal?.source || '');
      setNotes(deal?.notes || '');
      setSelectedFunnelId(funnelId || deal?.funnel_id || funnels?.[0]?.id || '');
      setSelectedStageId(stageId || deal?.stage_id || '');
    }
  }, [open, deal, initialContactId, stageId, funnelId, funnels]);

  // Update stage when funnel changes
  useEffect(() => {
    if (selectedFunnelId && !selectedStageId) {
      const funnel = funnels?.find(f => f.id === selectedFunnelId);
      const firstStage = funnel?.stages?.find(s => !s.is_final);
      if (firstStage) {
        setSelectedStageId(firstStage.id);
      }
    }
  }, [selectedFunnelId, funnels, selectedStageId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (deal) {
      await updateDeal.mutateAsync({ 
        id: deal.id, 
        title: title || null,
        value: Number(value) || 0,
        expected_close_date: expectedCloseDate || null,
        notes: notes || null,
        stage_id: selectedStageId
      });
    } else {
      await createDeal.mutateAsync({ 
        funnel_id: selectedFunnelId,
        stage_id: selectedStageId,
        contact_id: contactId,
        conversation_id: conversationId,
        title: title || undefined,
        value: Number(value) || 0,
        expected_close_date: expectedCloseDate || undefined,
        source: source || undefined
      });
    }
    
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{deal ? 'Editar Deal' : 'Novo Deal'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!deal && !initialContactId && (
            <div className="space-y-2">
              <Label>Contato *</Label>
              <Select value={contactId} onValueChange={setContactId} required>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar contato" />
                </SelectTrigger>
                <SelectContent>
                  {contacts?.map((contact) => (
                    <SelectItem key={contact.id} value={contact.id}>
                      {contact.name || contact.phone}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {!funnelId && !deal && (
            <div className="space-y-2">
              <Label>Funil *</Label>
              <Select value={selectedFunnelId} onValueChange={setSelectedFunnelId} required>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar funil" />
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
          )}

          <div className="space-y-2">
            <Label>Etapa</Label>
            <Select value={selectedStageId} onValueChange={setSelectedStageId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecionar etapa" />
              </SelectTrigger>
              <SelectContent>
                {stages.filter(s => !s.is_final).map((stage) => (
                  <SelectItem key={stage.id} value={stage.id}>
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full" style={{ backgroundColor: stage.color }} />
                      {stage.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Título (opcional)</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Projeto Website"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="value">Valor (R$)</Label>
            <Input
              id="value"
              type="number"
              step="0.01"
              min="0"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="0,00"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="expected-date">Previsão de Fechamento</Label>
            <Input
              id="expected-date"
              type="date"
              value={expectedCloseDate}
              onChange={(e) => setExpectedCloseDate(e.target.value)}
            />
          </div>

          {!deal && (
            <div className="space-y-2">
              <Label htmlFor="source">Origem</Label>
              <Input
                id="source"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                placeholder="Ex: WhatsApp, Site, Indicação"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="notes">Notas</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Observações sobre o deal"
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={(!deal && !contactId) || createDeal.isPending || updateDeal.isPending}
            >
              {deal ? 'Salvar' : 'Criar Deal'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
