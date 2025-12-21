import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, Link2, ArrowLeftRight } from "lucide-react";
import { WarmingPair } from "@/hooks/useWarming";

interface Instance {
  id: string;
  instance_name: string;
  status: string;
}

interface WarmingPairsManagerProps {
  pairs: WarmingPair[];
  instances: Instance[];
  onAdd: (data: { instanceAId: string; instanceBId: string }) => void;
  onDelete: (pairId: string) => void;
  isAdding?: boolean;
}

export function WarmingPairsManager({ pairs, instances, onAdd, onDelete, isAdding }: WarmingPairsManagerProps) {
  const [open, setOpen] = useState(false);
  const [instanceA, setInstanceA] = useState('');
  const [instanceB, setInstanceB] = useState('');

  const connectedInstances = instances.filter(i => i.status === 'connected');

  const handleSubmit = () => {
    if (!instanceA || !instanceB || instanceA === instanceB) return;
    onAdd({ instanceAId: instanceA, instanceBId: instanceB });
    setInstanceA('');
    setInstanceB('');
    setOpen(false);
  };

  // Get already paired instance IDs
  const pairedInstanceIds = new Set<string>();
  pairs.forEach(pair => {
    pairedInstanceIds.add(pair.instance_a_id);
    pairedInstanceIds.add(pair.instance_b_id);
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Link2 className="h-5 w-5" />
          Pareamento de Instâncias
        </CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" disabled={connectedInstances.length < 2}>
              <Plus className="h-4 w-4 mr-2" />
              Parear
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Parear Instâncias</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <p className="text-sm text-muted-foreground">
                Selecione duas instâncias para trocar mensagens automaticamente durante o aquecimento.
              </p>
              
              <div className="space-y-2">
                <Select value={instanceA} onValueChange={setInstanceA}>
                  <SelectTrigger>
                    <SelectValue placeholder="Primeira instância" />
                  </SelectTrigger>
                  <SelectContent>
                    {connectedInstances.map((instance) => (
                      <SelectItem key={instance.id} value={instance.id}>
                        {instance.instance_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-center">
                <ArrowLeftRight className="h-5 w-5 text-muted-foreground" />
              </div>

              <div className="space-y-2">
                <Select value={instanceB} onValueChange={setInstanceB}>
                  <SelectTrigger>
                    <SelectValue placeholder="Segunda instância" />
                  </SelectTrigger>
                  <SelectContent>
                    {connectedInstances
                      .filter(i => i.id !== instanceA)
                      .map((instance) => (
                        <SelectItem key={instance.id} value={instance.id}>
                          {instance.instance_name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <Button 
                onClick={handleSubmit} 
                disabled={!instanceA || !instanceB || instanceA === instanceB || isAdding} 
                className="w-full"
              >
                Criar Pareamento
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {connectedInstances.length < 2 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Você precisa de pelo menos 2 instâncias conectadas para criar um pareamento.
          </p>
        ) : pairs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhum pareamento criado.
            <br />
            Instâncias pareadas trocam mensagens entre si automaticamente.
          </p>
        ) : (
          <div className="space-y-2">
            {pairs.map((pair) => (
              <div 
                key={pair.id} 
                className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={pair.instance_a?.status === 'connected' ? 'border-green-500' : ''}>
                      {pair.instance_a?.instance_name || 'Instância A'}
                    </Badge>
                    <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
                    <Badge variant="outline" className={pair.instance_b?.status === 'connected' ? 'border-green-500' : ''}>
                      {pair.instance_b?.instance_name || 'Instância B'}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {pair.is_active && (
                    <Badge className="bg-green-500">Ativo</Badge>
                  )}
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => onDelete(pair.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
