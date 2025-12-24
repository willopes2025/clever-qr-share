import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useFunnels, FunnelStage } from "@/hooks/useFunnels";

interface StageFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  funnelId: string;
  stage?: FunnelStage;
}

const COLORS = [
  '#94A3B8', '#3B82F6', '#8B5CF6', '#EC4899', '#EF4444', 
  '#F59E0B', '#22C55E', '#06B6D4', '#6366F1'
];

export const StageFormDialog = ({ open, onOpenChange, funnelId, stage }: StageFormDialogProps) => {
  const { createStage, updateStage } = useFunnels();
  const [name, setName] = useState(stage?.name || '');
  const [color, setColor] = useState(stage?.color || COLORS[0]);
  const [isFinal, setIsFinal] = useState(stage?.is_final || false);
  const [finalType, setFinalType] = useState<'won' | 'lost' | null>(stage?.final_type as 'won' | 'lost' | null);
  const [probability, setProbability] = useState(stage?.probability || 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (stage) {
      await updateStage.mutateAsync({ 
        id: stage.id, 
        name, 
        color, 
        is_final: isFinal, 
        final_type: isFinal ? finalType : null,
        probability 
      });
    } else {
      await createStage.mutateAsync({ 
        funnel_id: funnelId, 
        name, 
        color, 
        is_final: isFinal, 
        final_type: isFinal ? finalType : null 
      });
    }
    
    onOpenChange(false);
    resetForm();
  };

  const resetForm = () => {
    setName('');
    setColor(COLORS[0]);
    setIsFinal(false);
    setFinalType(null);
    setProbability(0);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{stage ? 'Editar Etapa' : 'Nova Etapa'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Proposta Enviada"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Cor</Label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`h-8 w-8 rounded-full transition-all ${color === c ? 'ring-2 ring-offset-2 ring-primary' : ''}`}
                  style={{ backgroundColor: c }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Probabilidade (%)</Label>
            <Input
              type="number"
              min={0}
              max={100}
              value={probability}
              onChange={(e) => setProbability(Number(e.target.value))}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="is-final">Etapa Final</Label>
            <Switch
              id="is-final"
              checked={isFinal}
              onCheckedChange={setIsFinal}
            />
          </div>

          {isFinal && (
            <div className="space-y-2">
              <Label>Tipo de Fechamento</Label>
              <Select value={finalType || ''} onValueChange={(v) => setFinalType(v as 'won' | 'lost')}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="won">Ganho (Won)</SelectItem>
                  <SelectItem value="lost">Perdido (Lost)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!name || createStage.isPending || updateStage.isPending}>
              {stage ? 'Salvar' : 'Criar Etapa'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
