import { useState } from "react";
import { Plus, Trash2, Zap } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useFunnels, FunnelAutomation } from "@/hooks/useFunnels";
import { AutomationFormDialog } from "./AutomationFormDialog";

interface AutomationsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  funnelId?: string;
}

const TRIGGER_LABELS: Record<string, string> = {
  on_stage_enter: 'Entrar na etapa',
  on_stage_exit: 'Sair da etapa',
  on_deal_won: 'Deal ganho',
  on_deal_lost: 'Deal perdido',
  on_time_in_stage: 'Tempo na etapa',
  on_message_received: 'Receber mensagem',
  on_keyword_received: 'Palavra-chave recebida',
  on_contact_created: 'Contato criado',
  on_tag_added: 'Tag adicionada',
  on_tag_removed: 'Tag removida',
  on_inactivity: 'Inatividade',
  on_deal_value_changed: 'Valor do deal alterado',
  on_custom_field_changed: 'Campo personalizado alterado'
};

const ACTION_LABELS: Record<string, string> = {
  send_message: 'Enviar mensagem',
  send_template: 'Enviar template',
  add_tag: 'Adicionar tag',
  remove_tag: 'Remover tag',
  notify_user: 'Notificar usuário',
  move_stage: 'Mover etapa',
  trigger_chatbot_flow: 'Acionar chatbot',
  set_custom_field: 'Definir campo',
  set_deal_value: 'Definir valor',
  change_responsible: 'Alterar responsável',
  add_note: 'Adicionar nota',
  webhook_request: 'Enviar webhook',
  create_task: 'Criar tarefa',
  close_deal_won: 'Fechar como ganho',
  close_deal_lost: 'Fechar como perdido'
};

export const AutomationsDialog = ({ open, onOpenChange, funnelId }: AutomationsDialogProps) => {
  const { automations, updateAutomation, deleteAutomation, funnels } = useFunnels();
  const [showForm, setShowForm] = useState(false);
  const [editingAutomation, setEditingAutomation] = useState<FunnelAutomation | null>(null);

  const filteredAutomations = funnelId 
    ? automations?.filter(a => a.funnel_id === funnelId)
    : automations;

  const getFunnelName = (funnelId: string) => {
    return funnels?.find(f => f.id === funnelId)?.name || 'Funil';
  };

  const getStageName = (stageId: string | null) => {
    if (!stageId) return null;
    for (const funnel of funnels || []) {
      const stage = funnel.stages?.find(s => s.id === stageId);
      if (stage) return stage.name;
    }
    return null;
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-500" />
              Automações
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <Button onClick={() => { setEditingAutomation(null); setShowForm(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Automação
            </Button>

            {!filteredAutomations?.length ? (
              <div className="text-center py-8 text-muted-foreground">
                <Zap className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p>Nenhuma automação configurada</p>
                <p className="text-sm">Crie automações para executar ações automaticamente</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredAutomations.map((automation) => (
                  <div 
                    key={automation.id}
                    className="p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">{automation.name}</span>
                          <Badge variant={automation.is_active ? 'default' : 'secondary'}>
                            {automation.is_active ? 'Ativa' : 'Inativa'}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground space-y-1">
                          <p>
                            <span className="text-foreground">Gatilho:</span>{' '}
                            {TRIGGER_LABELS[automation.trigger_type] || automation.trigger_type}
                            {getStageName(automation.stage_id) && ` - ${getStageName(automation.stage_id)}`}
                          </p>
                          <p>
                            <span className="text-foreground">Ação:</span>{' '}
                            {ACTION_LABELS[automation.action_type] || automation.action_type}
                          </p>
                          {!funnelId && (
                            <p className="text-xs">Funil: {getFunnelName(automation.funnel_id)}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={automation.is_active}
                          onCheckedChange={(checked) => 
                            updateAutomation.mutate({ id: automation.id, is_active: checked })
                          }
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => { setEditingAutomation(automation); setShowForm(true); }}
                        >
                          <Zap className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => deleteAutomation.mutate(automation.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AutomationFormDialog
        open={showForm}
        onOpenChange={setShowForm}
        funnelId={funnelId}
        automation={editingAutomation}
      />
    </>
  );
};
