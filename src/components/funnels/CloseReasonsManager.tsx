import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFunnels } from "@/hooks/useFunnels";

interface CloseReasonsManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CloseReasonsManager = ({ open, onOpenChange }: CloseReasonsManagerProps) => {
  const { closeReasons, createCloseReason, deleteCloseReason } = useFunnels();
  const [newReason, setNewReason] = useState('');
  const [activeTab, setActiveTab] = useState<'won' | 'lost'>('won');

  const handleAdd = async () => {
    if (!newReason.trim()) return;
    await createCloseReason.mutateAsync({ type: activeTab, name: newReason.trim() });
    setNewReason('');
  };

  const wonReasons = closeReasons?.filter(r => r.type === 'won') || [];
  const lostReasons = closeReasons?.filter(r => r.type === 'lost') || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Motivos de Fechamento</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'won' | 'lost')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="won" className="text-green-600">Ganhos</TabsTrigger>
            <TabsTrigger value="lost" className="text-red-600">Perdidos</TabsTrigger>
          </TabsList>

          <TabsContent value="won" className="space-y-4 mt-4">
            <div className="flex gap-2">
              <Input
                value={newReason}
                onChange={(e) => setNewReason(e.target.value)}
                placeholder="Novo motivo de ganho"
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              />
              <Button onClick={handleAdd} disabled={!newReason.trim()}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="space-y-2">
              {wonReasons.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum motivo cadastrado
                </p>
              ) : (
                wonReasons.map((reason) => (
                  <div key={reason.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                    <span className="text-sm">{reason.name}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => deleteCloseReason.mutate(reason.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="lost" className="space-y-4 mt-4">
            <div className="flex gap-2">
              <Input
                value={newReason}
                onChange={(e) => setNewReason(e.target.value)}
                placeholder="Novo motivo de perda"
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              />
              <Button onClick={handleAdd} disabled={!newReason.trim()}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="space-y-2">
              {lostReasons.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum motivo cadastrado
                </p>
              ) : (
                lostReasons.map((reason) => (
                  <div key={reason.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                    <span className="text-sm">{reason.name}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => deleteCloseReason.mutate(reason.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
