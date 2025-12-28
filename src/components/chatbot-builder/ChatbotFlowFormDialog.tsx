import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useChatbotFlows } from "@/hooks/useChatbotFlows";
import { useWhatsAppInstances } from "@/hooks/useWhatsAppInstances";

interface ChatbotFlowFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ChatbotFlowFormDialog = ({ open, onOpenChange }: ChatbotFlowFormDialogProps) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [instanceId, setInstanceId] = useState<string>("");
  const { createFlow } = useChatbotFlows();
  const { instances } = useWhatsAppInstances();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    await createFlow.mutateAsync({
      name,
      description: description || undefined,
      instance_id: instanceId || undefined,
    });

    setName("");
    setDescription("");
    setInstanceId("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo Fluxo de Chatbot</DialogTitle>
          <DialogDescription>
            Crie um novo fluxo de automação visual para seu chatbot
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome do Fluxo</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Atendimento Inicial"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Descrição (opcional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva o objetivo deste fluxo..."
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="instance">Instância WhatsApp (opcional)</Label>
            <Select value={instanceId} onValueChange={(val) => setInstanceId(val === "none" ? "" : val)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma instância" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhuma (configurar depois)</SelectItem>
                {instances?.map((instance) => (
                  <SelectItem key={instance.id} value={instance.id}>
                    {instance.instance_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!name || createFlow.isPending}>
              {createFlow.isPending ? 'Criando...' : 'Criar Fluxo'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
