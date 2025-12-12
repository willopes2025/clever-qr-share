import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useWhatsAppInstances, WARMING_LEVELS } from '@/hooks/useWhatsAppInstances';
import { Loader2, Smartphone, AlertCircle, Shuffle, ListOrdered, Flame } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export type SendingMode = 'sequential' | 'random' | 'warming';

interface SelectInstanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (data: { instanceIds: string[]; sendingMode: SendingMode }) => void;
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
  const [selectedInstanceIds, setSelectedInstanceIds] = useState<string[]>([]);
  const [sendingMode, setSendingMode] = useState<SendingMode>('warming');
  const { instances, isLoading: loadingInstances } = useWhatsAppInstances();

  const connectedInstances = instances?.filter(i => i.status === 'connected') || [];

  // Calculate message distribution based on warming levels
  const distributionInfo = useMemo(() => {
    const selectedInstances = connectedInstances.filter(i => selectedInstanceIds.includes(i.id));
    if (selectedInstances.length === 0) return null;

    const totalWeight = selectedInstances.reduce((sum, i) => sum + (i.warming_level || 1), 0);
    
    return selectedInstances.map(instance => {
      const weight = instance.warming_level || 1;
      const percentage = Math.round((weight / totalWeight) * 100);
      const warmingConfig = WARMING_LEVELS.find(w => w.level === weight) || WARMING_LEVELS[0];
      return {
        id: instance.id,
        name: instance.instance_name,
        warmingLevel: weight,
        warmingConfig,
        percentage
      };
    }).sort((a, b) => b.warmingLevel - a.warmingLevel);
  }, [selectedInstanceIds, connectedInstances]);

  const handleToggleInstance = (instanceId: string) => {
    setSelectedInstanceIds(prev => 
      prev.includes(instanceId)
        ? prev.filter(id => id !== instanceId)
        : [...prev, instanceId]
    );
  };

  const handleSelectAll = () => {
    if (selectedInstanceIds.length === connectedInstances.length) {
      setSelectedInstanceIds([]);
    } else {
      setSelectedInstanceIds(connectedInstances.map(i => i.id));
    }
  };

  const handleConfirm = () => {
    if (selectedInstanceIds.length > 0) {
      onConfirm({ instanceIds: selectedInstanceIds, sendingMode });
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setSelectedInstanceIds([]);
      setSendingMode('warming');
    }
    onOpenChange(newOpen);
  };

  const getWarmingConfig = (level: number) => {
    return WARMING_LEVELS.find(w => w.level === level) || WARMING_LEVELS[0];
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-primary" />
            Selecionar Instâncias WhatsApp
          </DialogTitle>
        </DialogHeader>

        <div className="py-4 space-y-6">
          <p className="text-sm text-muted-foreground">
            Escolha as instâncias do WhatsApp que serão usadas para enviar as mensagens de "{campaignName}".
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
            <>
              {/* Instance Selection */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Instâncias Disponíveis</Label>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={handleSelectAll}
                    className="text-xs h-7"
                  >
                    {selectedInstanceIds.length === connectedInstances.length 
                      ? 'Desmarcar Todas' 
                      : 'Selecionar Todas'}
                  </Button>
                </div>
                
                <ScrollArea className="h-[180px] rounded-md border p-3">
                  <div className="space-y-2">
                    {connectedInstances.map((instance) => {
                      const warmingConfig = getWarmingConfig(instance.warming_level || 1);
                      return (
                        <div
                          key={instance.id}
                          className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                            selectedInstanceIds.includes(instance.id)
                              ? 'border-primary bg-primary/5'
                              : 'border-border hover:bg-muted/50'
                          }`}
                          onClick={() => handleToggleInstance(instance.id)}
                        >
                          <Checkbox
                            checked={selectedInstanceIds.includes(instance.id)}
                            onCheckedChange={() => handleToggleInstance(instance.id)}
                          />
                          <div className="h-2 w-2 rounded-full bg-green-500" />
                          <span className="flex-1 text-sm font-medium">
                            {instance.instance_name}
                          </span>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge variant="outline" className={`text-xs ${warmingConfig.color}`}>
                                  {warmingConfig.icon} Nível {instance.warming_level || 1}
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="text-xs">{warmingConfig.name} - Peso {instance.warming_level || 1}x</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>

                {selectedInstanceIds.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">
                      {selectedInstanceIds.length} instância{selectedInstanceIds.length > 1 ? 's' : ''} selecionada{selectedInstanceIds.length > 1 ? 's' : ''}
                    </Badge>
                  </div>
                )}
              </div>

              {/* Sending Mode Selection */}
              {selectedInstanceIds.length > 1 && (
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Modo de Disparo</Label>
                  <RadioGroup 
                    value={sendingMode} 
                    onValueChange={(value) => setSendingMode(value as SendingMode)}
                    className="grid grid-cols-3 gap-3"
                  >
                    <div 
                      className={`flex flex-col items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                        sendingMode === 'warming'
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:bg-muted/50'
                      }`}
                      onClick={() => setSendingMode('warming')}
                    >
                      <RadioGroupItem value="warming" id="warming" className="sr-only" />
                      <Flame className="h-5 w-5 text-orange-500" />
                      <Label htmlFor="warming" className="cursor-pointer font-medium text-xs text-center">
                        Por Aquecimento
                      </Label>
                    </div>

                    <div 
                      className={`flex flex-col items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                        sendingMode === 'sequential'
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:bg-muted/50'
                      }`}
                      onClick={() => setSendingMode('sequential')}
                    >
                      <RadioGroupItem value="sequential" id="sequential" className="sr-only" />
                      <ListOrdered className="h-5 w-5 text-primary" />
                      <Label htmlFor="sequential" className="cursor-pointer font-medium text-xs text-center">
                        Sequencial
                      </Label>
                    </div>

                    <div 
                      className={`flex flex-col items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                        sendingMode === 'random'
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:bg-muted/50'
                      }`}
                      onClick={() => setSendingMode('random')}
                    >
                      <RadioGroupItem value="random" id="random" className="sr-only" />
                      <Shuffle className="h-5 w-5 text-primary" />
                      <Label htmlFor="random" className="cursor-pointer font-medium text-xs text-center">
                        Aleatório
                      </Label>
                    </div>
                  </RadioGroup>

                  {/* Distribution Preview for Warming Mode */}
                  {sendingMode === 'warming' && distributionInfo && distributionInfo.length > 1 && (
                    <div className="p-3 rounded-lg bg-muted/50 border">
                      <p className="text-xs font-medium mb-2 text-muted-foreground">
                        Distribuição estimada de mensagens:
                      </p>
                      <div className="space-y-2">
                        {distributionInfo.map((item) => (
                          <div key={item.id} className="flex items-center gap-2">
                            <span className="text-xs">{item.warmingConfig.icon}</span>
                            <span className="text-xs flex-1 truncate">{item.name}</span>
                            <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                              <div 
                                className={`h-full ${item.warmingConfig.bgColor}`}
                                style={{ width: `${item.percentage}%` }}
                              />
                            </div>
                            <span className="text-xs font-medium w-10 text-right">{item.percentage}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleConfirm} 
            disabled={selectedInstanceIds.length === 0 || isLoading || connectedInstances.length === 0}
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
