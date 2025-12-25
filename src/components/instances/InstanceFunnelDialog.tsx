import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useFunnels } from '@/hooks/useFunnels';
import { Loader2, GitBranch } from 'lucide-react';

interface InstanceFunnelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instanceId: string;
  instanceName: string;
  currentFunnelId: string | null;
  onSave: (funnelId: string | null) => Promise<void>;
}

export const InstanceFunnelDialog = ({
  open,
  onOpenChange,
  instanceId,
  instanceName,
  currentFunnelId,
  onSave,
}: InstanceFunnelDialogProps) => {
  const [selectedFunnelId, setSelectedFunnelId] = useState<string | null>(currentFunnelId);
  const [isSaving, setIsSaving] = useState(false);
  const { funnels, isLoading } = useFunnels();

  useEffect(() => {
    if (open) {
      setSelectedFunnelId(currentFunnelId);
    }
  }, [open, currentFunnelId]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(selectedFunnelId);
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-primary" />
            Vincular Funil à Instância
          </DialogTitle>
          <DialogDescription>
            Configure um funil para capturar leads automaticamente da instância <strong>{instanceName}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Funil de Captura (opcional)</Label>
            {isLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando funis...
              </div>
            ) : (
              <Select
                value={selectedFunnelId || 'none'}
                onValueChange={(value) => setSelectedFunnelId(value === 'none' ? null : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um funil" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum funil</SelectItem>
                  {(funnels || []).map((funnel) => (
                    <SelectItem key={funnel.id} value={funnel.id}>
                      <div className="flex items-center gap-2">
                        <div
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: funnel.color || '#3B82F6' }}
                        />
                        {funnel.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <p className="text-xs text-muted-foreground">
              Quando um contato enviar mensagem, um deal será criado automaticamente na primeira etapa do funil selecionado.
            </p>
          </div>

          {selectedFunnelId && (
            <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
              <p className="text-sm text-primary">
                ✨ Novos leads serão capturados automaticamente neste funil!
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
