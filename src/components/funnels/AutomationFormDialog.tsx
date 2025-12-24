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
import { useFunnels, FunnelAutomation } from "@/hooks/useFunnels";
import { useMessageTemplates } from "@/hooks/useMessageTemplates";

interface AutomationFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  funnelId?: string;
  automation?: FunnelAutomation | null;
}

type TriggerType = 'on_stage_enter' | 'on_stage_exit' | 'on_deal_won' | 'on_deal_lost' | 'on_time_in_stage';
type ActionType = 'send_message' | 'send_template' | 'add_tag' | 'remove_tag' | 'notify_user' | 'move_stage';

export const AutomationFormDialog = ({ open, onOpenChange, funnelId, automation }: AutomationFormDialogProps) => {
  const { funnels, createAutomation, updateAutomation } = useFunnels();
  const { templates } = useMessageTemplates();
  
  const [name, setName] = useState('');
  const [selectedFunnelId, setSelectedFunnelId] = useState(funnelId || '');
  const [stageId, setStageId] = useState('');
  const [triggerType, setTriggerType] = useState<TriggerType>('on_stage_enter');
  const [triggerConfig, setTriggerConfig] = useState<Record<string, unknown>>({});
  const [actionType, setActionType] = useState<ActionType>('send_message');
  const [actionConfig, setActionConfig] = useState<Record<string, unknown>>({});

  const selectedFunnel = funnels?.find(f => f.id === selectedFunnelId);
  const stages = selectedFunnel?.stages || [];

  useEffect(() => {
    if (open && automation) {
      setName(automation.name);
      setSelectedFunnelId(automation.funnel_id);
      setStageId(automation.stage_id || '');
      setTriggerType(automation.trigger_type);
      setTriggerConfig(automation.trigger_config);
      setActionType(automation.action_type);
      setActionConfig(automation.action_config);
    } else if (open) {
      setName('');
      setSelectedFunnelId(funnelId || '');
      setStageId('');
      setTriggerType('on_stage_enter');
      setTriggerConfig({});
      setActionType('send_message');
      setActionConfig({});
    }
  }, [open, automation, funnelId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const data = {
      funnel_id: selectedFunnelId,
      stage_id: stageId || null,
      name,
      trigger_type: triggerType,
      trigger_config: triggerConfig,
      action_type: actionType,
      action_config: actionConfig,
      is_active: true
    };

    if (automation) {
      await updateAutomation.mutateAsync({ id: automation.id, ...data });
    } else {
      await createAutomation.mutateAsync(data);
    }
    
    onOpenChange(false);
  };

  const needsStage = ['on_stage_enter', 'on_stage_exit', 'on_time_in_stage'].includes(triggerType);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{automation ? 'Editar Automação' : 'Nova Automação'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Enviar mensagem de boas-vindas"
              required
            />
          </div>

          {!funnelId && (
            <div className="space-y-2">
              <Label>Funil</Label>
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
            <Label>Gatilho</Label>
            <Select value={triggerType} onValueChange={(v) => setTriggerType(v as TriggerType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="on_stage_enter">Quando entrar na etapa</SelectItem>
                <SelectItem value="on_stage_exit">Quando sair da etapa</SelectItem>
                <SelectItem value="on_deal_won">Quando deal for ganho</SelectItem>
                <SelectItem value="on_deal_lost">Quando deal for perdido</SelectItem>
                <SelectItem value="on_time_in_stage">Após X dias na etapa</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {needsStage && (
            <div className="space-y-2">
              <Label>Etapa</Label>
              <Select value={stageId} onValueChange={setStageId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar etapa" />
                </SelectTrigger>
                <SelectContent>
                  {stages.map((stage) => (
                    <SelectItem key={stage.id} value={stage.id}>
                      {stage.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {triggerType === 'on_time_in_stage' && (
            <div className="space-y-2">
              <Label>Dias na etapa</Label>
              <Input
                type="number"
                min={1}
                value={triggerConfig.days as number || ''}
                onChange={(e) => setTriggerConfig({ ...triggerConfig, days: Number(e.target.value) })}
                placeholder="Ex: 3"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label>Ação</Label>
            <Select value={actionType} onValueChange={(v) => setActionType(v as ActionType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="send_message">Enviar mensagem</SelectItem>
                <SelectItem value="send_template">Enviar template</SelectItem>
                <SelectItem value="add_tag">Adicionar tag</SelectItem>
                <SelectItem value="remove_tag">Remover tag</SelectItem>
                <SelectItem value="notify_user">Notificar usuário</SelectItem>
                <SelectItem value="move_stage">Mover para etapa</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {actionType === 'send_message' && (
            <div className="space-y-2">
              <Label>Mensagem</Label>
              <Textarea
                value={actionConfig.message as string || ''}
                onChange={(e) => setActionConfig({ ...actionConfig, message: e.target.value })}
                placeholder="Use {{nome}}, {{telefone}} para variáveis"
                rows={3}
              />
            </div>
          )}

          {actionType === 'send_template' && (
            <div className="space-y-2">
              <Label>Template</Label>
              <Select 
                value={actionConfig.template_id as string || ''} 
                onValueChange={(v) => setActionConfig({ ...actionConfig, template_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar template" />
                </SelectTrigger>
                <SelectContent>
                  {templates?.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {actionType === 'move_stage' && (
            <div className="space-y-2">
              <Label>Mover para etapa</Label>
              <Select 
                value={actionConfig.target_stage_id as string || ''} 
                onValueChange={(v) => setActionConfig({ ...actionConfig, target_stage_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar etapa" />
                </SelectTrigger>
                <SelectContent>
                  {stages.map((stage) => (
                    <SelectItem key={stage.id} value={stage.id}>
                      {stage.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {(actionType === 'add_tag' || actionType === 'remove_tag') && (
            <div className="space-y-2">
              <Label>Nome da Tag</Label>
              <Input
                value={actionConfig.tag_name as string || ''}
                onChange={(e) => setActionConfig({ ...actionConfig, tag_name: e.target.value })}
                placeholder="Nome da tag"
              />
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={!name || !selectedFunnelId || createAutomation.isPending || updateAutomation.isPending}
            >
              {automation ? 'Salvar' : 'Criar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
