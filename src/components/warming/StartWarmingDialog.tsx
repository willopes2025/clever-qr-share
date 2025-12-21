import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Play, Flame } from "lucide-react";

interface Instance {
  id: string;
  instance_name: string;
  status: string;
}

interface StartWarmingDialogProps {
  instances: Instance[];
  existingScheduleInstanceIds: string[];
  onStart: (data: { instanceId: string; targetDays: number }) => void;
  isStarting?: boolean;
}

export function StartWarmingDialog({ 
  instances, 
  existingScheduleInstanceIds, 
  onStart, 
  isStarting 
}: StartWarmingDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedInstance, setSelectedInstance] = useState('');
  const [targetDays, setTargetDays] = useState(21);

  const availableInstances = instances.filter(
    i => i.status === 'connected' && !existingScheduleInstanceIds.includes(i.id)
  );

  const handleStart = () => {
    if (!selectedInstance) return;
    onStart({ instanceId: selectedInstance, targetDays });
    setSelectedInstance('');
    setTargetDays(21);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button disabled={availableInstances.length === 0}>
          <Flame className="h-4 w-4 mr-2" />
          Iniciar Aquecimento
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Iniciar Aquecimento de Chip</DialogTitle>
        </DialogHeader>
        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label>Instância</Label>
            {availableInstances.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Todas as instâncias conectadas já estão em aquecimento ou não há instâncias disponíveis.
              </p>
            ) : (
              <Select value={selectedInstance} onValueChange={setSelectedInstance}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma instância" />
                </SelectTrigger>
                <SelectContent>
                  {availableInstances.map((instance) => (
                    <SelectItem key={instance.id} value={instance.id}>
                      {instance.instance_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Duração do Aquecimento</Label>
              <span className="font-medium">{targetDays} dias</span>
            </div>
            <Slider
              value={[targetDays]}
              onValueChange={(value) => setTargetDays(value[0])}
              min={7}
              max={30}
              step={1}
            />
            <p className="text-xs text-muted-foreground">
              Recomendado: 21 dias para aquecimento completo
            </p>
          </div>

          <div className="bg-muted/50 rounded-lg p-4">
            <h4 className="font-medium mb-2">Como funciona:</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Dia 1-3: 5-20 mensagens/dia (textos)</li>
              <li>• Dia 4-7: 15-60 mensagens/dia (texto + imagem)</li>
              <li>• Dia 8-14: 40-130 mensagens/dia (texto + mídia)</li>
              <li>• Dia 15+: 80-250 mensagens/dia (todos os tipos)</li>
            </ul>
          </div>

          <Button 
            onClick={handleStart} 
            disabled={!selectedInstance || isStarting} 
            className="w-full"
          >
            <Play className="h-4 w-4 mr-2" />
            Iniciar Aquecimento
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
