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
import { Textarea } from "@/components/ui/textarea";
import { useFunnels, Funnel } from "@/hooks/useFunnels";

interface FunnelFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  funnel?: Funnel;
}

const COLORS = [
  '#3B82F6', '#8B5CF6', '#EC4899', '#EF4444', '#F59E0B', 
  '#22C55E', '#06B6D4', '#6366F1', '#64748B'
];

export const FunnelFormDialog = ({ open, onOpenChange, funnel }: FunnelFormDialogProps) => {
  const { createFunnel, updateFunnel } = useFunnels();
  const [name, setName] = useState(funnel?.name || '');
  const [description, setDescription] = useState(funnel?.description || '');
  const [color, setColor] = useState(funnel?.color || COLORS[0]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (funnel) {
      await updateFunnel.mutateAsync({ id: funnel.id, name, description, color });
    } else {
      await createFunnel.mutateAsync({ name, description, color });
    }
    
    onOpenChange(false);
    setName('');
    setDescription('');
    setColor(COLORS[0]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{funnel ? 'Editar Funil' : 'Novo Funil'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Funil de Vendas"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descrição opcional do funil"
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>Cor</Label>
            <div className="flex gap-2">
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

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!name || createFunnel.isPending || updateFunnel.isPending}>
              {funnel ? 'Salvar' : 'Criar Funil'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
