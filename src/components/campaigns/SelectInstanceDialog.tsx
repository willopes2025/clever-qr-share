import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useWhatsAppInstances } from '@/hooks/useWhatsAppInstances';
import { Loader2, Smartphone, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface SelectInstanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (instanceId: string) => void;
  isLoading?: boolean;
  campaignName?: string;
}

export const SelectInstanceDialog = ({
  open,
  onOpenChange,
  onConfirm,
  isLoading = false,
  campaignName = 'esta campanha'
}: SelectInstanceDialogProps) => {
  const [selectedInstanceId, setSelectedInstanceId] = useState<string>('');
  const { instances, isLoading: loadingInstances } = useWhatsAppInstances();

  const connectedInstances = instances?.filter(i => i.status === 'connected') || [];

  const handleConfirm = () => {
    if (selectedInstanceId) {
      onConfirm(selectedInstanceId);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-primary" />
            Selecionar Instância WhatsApp
          </DialogTitle>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            Escolha a instância do WhatsApp que será usada para enviar as mensagens de "{campaignName}".
          </p>

          {loadingInstances ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : connectedInstances.length === 0 ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Nenhuma instância WhatsApp conectada. Por favor, conecte uma instância antes de iniciar a campanha.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="instance">Instância WhatsApp</Label>
              <Select value={selectedInstanceId} onValueChange={setSelectedInstanceId}>
                <SelectTrigger id="instance">
                  <SelectValue placeholder="Selecione uma instância" />
                </SelectTrigger>
                <SelectContent>
                  {connectedInstances.map((instance) => (
                    <SelectItem key={instance.id} value={instance.id}>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-green-500" />
                        {instance.instance_name}
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
            onClick={handleConfirm} 
            disabled={!selectedInstanceId || isLoading || connectedInstances.length === 0}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Iniciando...
              </>
            ) : (
              'Iniciar Campanha'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
