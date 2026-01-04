import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Copy, Check, Link, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useFunnels, FunnelAutomation } from "@/hooks/useFunnels";
import { useMessageTemplates } from "@/hooks/useMessageTemplates";
import { useChatbotFlows } from "@/hooks/useChatbotFlows";
import { useCustomFields } from "@/hooks/useCustomFields";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { useAllAgentConfigs } from "@/hooks/useAIAgentConfig";
import { useForms } from "@/hooks/useForms";
import { supabase } from "@/integrations/supabase/client";

interface AutomationFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  funnelId?: string;
  automation?: FunnelAutomation | null;
  defaultStageId?: string;
}

type TriggerType = 
  | 'on_stage_enter' 
  | 'on_stage_exit' 
  | 'on_deal_won' 
  | 'on_deal_lost' 
  | 'on_time_in_stage'
  | 'on_message_received'
  | 'on_keyword_received'
  | 'on_contact_created'
  | 'on_tag_added'
  | 'on_tag_removed'
  | 'on_inactivity'
  | 'on_deal_value_changed'
  | 'on_custom_field_changed'
  | 'on_webhook'
  | 'on_form_submission';

type ActionType = 
  | 'send_message' 
  | 'send_template' 
  | 'add_tag' 
  | 'remove_tag' 
  | 'notify_user' 
  | 'move_stage' 
  | 'trigger_chatbot_flow'
  | 'set_custom_field'
  | 'set_deal_value'
  | 'change_responsible'
  | 'add_note'
  | 'webhook_request'
  | 'create_task'
  | 'close_deal_won'
  | 'close_deal_lost'
  | 'ai_analyze_and_move';

interface IntentMapping {
  intent: string;
  target_stage_id: string;
}

// Webhook trigger config component
const WebhookTriggerConfig = ({ 
  automationId, 
  token, 
  onTokenChange 
}: { 
  automationId: string; 
  token: string; 
  onTokenChange: (token: string) => void;
}) => {
  const [copied, setCopied] = useState(false);
  
  const webhookUrl = `https://fgbenetdksqnvwkgnips.supabase.co/functions/v1/receive-automation-webhook?automation_id=${automationId}${token ? `&token=${token}` : ''}`;
  
  const copyToClipboard = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    toast.success('URL copiada!');
    setTimeout(() => setCopied(false), 2000);
  };
  
  return (
    <div className="space-y-4 p-4 bg-muted/50 rounded-lg border">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Link className="h-4 w-4" />
        <span>Configuração do Webhook</span>
      </div>
      
      <div className="space-y-2">
        <Label>URL do Webhook</Label>
        <div className="flex gap-2">
          <Input
            value={webhookUrl}
            readOnly
            className="text-xs font-mono"
          />
          <Button 
            type="button" 
            variant="outline" 
            size="icon"
            onClick={copyToClipboard}
          >
            {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
      </div>
      
      <div className="space-y-2">
        <Label>Token de Segurança (opcional)</Label>
        <Input
          value={token}
          onChange={(e) => onTokenChange(e.target.value)}
          placeholder="Deixe vazio para não exigir token"
        />
        <p className="text-xs text-muted-foreground">
          Se definido, o webhook só será processado se o token na URL corresponder
        </p>
      </div>
      
      <div className="text-xs text-muted-foreground space-y-1">
        <p><strong>Payload esperado (POST):</strong></p>
        <pre className="bg-background p-2 rounded text-[10px] overflow-x-auto">
{`{
  "contact_phone": "5511999999999", // ou
  "contact_id": "uuid",             // ou
  "deal_id": "uuid",                // identificador
  "custom_data": {}                 // dados extras
}`}
        </pre>
      </div>
    </div>
  );
};

export const AutomationFormDialog = ({ open, onOpenChange, funnelId, automation, defaultStageId }: AutomationFormDialogProps) => {
  const { funnels, createAutomation, updateAutomation } = useFunnels();
  const { templates } = useMessageTemplates();
  const { flows } = useChatbotFlows();
  const { fieldDefinitions } = useCustomFields();
  const { members } = useTeamMembers();
  const { data: agentConfigs } = useAllAgentConfigs();
  const { forms } = useForms();
  
  const [name, setName] = useState('');
  const [selectedFunnelId, setSelectedFunnelId] = useState(funnelId || '');
  const [stageId, setStageId] = useState('');
  const [triggerType, setTriggerType] = useState<TriggerType>('on_stage_enter');
  const [triggerConfig, setTriggerConfig] = useState<Record<string, unknown>>({});
  const [actionType, setActionType] = useState<ActionType>('send_message');
  const [actionConfig, setActionConfig] = useState<Record<string, unknown>>({});
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [isGeneratingIntents, setIsGeneratingIntents] = useState(false);

  const selectedFunnel = funnels?.find(f => f.id === selectedFunnelId);
  const stages = selectedFunnel?.stages || [];

  useEffect(() => {
    if (open && automation) {
      setName(automation.name);
      setSelectedFunnelId(automation.funnel_id);
      setStageId(automation.stage_id || '');
      setTriggerType(automation.trigger_type as TriggerType);
      setTriggerConfig((automation.trigger_config as Record<string, unknown>) || {});
      setActionType(automation.action_type as ActionType);
      setActionConfig((automation.action_config as Record<string, unknown>) || {});
    } else if (open) {
      setName('');
      setSelectedFunnelId(funnelId || '');
      setStageId(defaultStageId || '');
      setTriggerType('on_stage_enter');
      setTriggerConfig({});
      setActionType('send_message');
      setActionConfig({});
      setSelectedAgentId('');
    }
  }, [open, automation, funnelId, defaultStageId]);

  const handleGenerateIntents = async () => {
    if (!selectedAgentId) {
      toast.error('Selecione um agente de IA primeiro');
      return;
    }

    if (stages.length === 0) {
      toast.error('Selecione um funil com etapas primeiro');
      return;
    }

    setIsGeneratingIntents(true);
    try {
      const { data, error } = await supabase.functions.invoke('suggest-funnel-intents', {
        body: {
          agentConfigId: selectedAgentId,
          stages: stages.map(s => ({ id: s.id, name: s.name }))
        }
      });

      if (error) throw error;

      if (data?.suggestions && Array.isArray(data.suggestions)) {
        const newMappings: IntentMapping[] = data.suggestions.map((s: { intent: string; suggested_stage_id: string }) => ({
          intent: s.intent,
          target_stage_id: s.suggested_stage_id
        }));
        
        setActionConfig({ ...actionConfig, intent_mappings: newMappings });
        toast.success(`${newMappings.length} intenções geradas com sucesso!`);
      } else {
        throw new Error('Resposta inválida da IA');
      }
    } catch (error) {
      console.error('Error generating intents:', error);
      toast.error('Erro ao gerar intenções. Tente novamente.');
    } finally {
      setIsGeneratingIntents(false);
    }
  };

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
      <DialogContent 
        className="max-w-md max-h-[90vh] overflow-y-auto"
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{automation ? 'Editar Automação' : 'Nova Automação'}</DialogTitle>
          <DialogDescription>
            Configure gatilhos e ações para sua automação
          </DialogDescription>
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
                <SelectItem value="on_message_received">Quando receber mensagem</SelectItem>
                <SelectItem value="on_keyword_received">Quando mensagem conter palavra-chave</SelectItem>
                <SelectItem value="on_contact_created">Quando contato for criado</SelectItem>
                <SelectItem value="on_tag_added">Quando tag for adicionada</SelectItem>
                <SelectItem value="on_tag_removed">Quando tag for removida</SelectItem>
                <SelectItem value="on_inactivity">Após X dias sem interação</SelectItem>
                <SelectItem value="on_deal_value_changed">Quando valor do deal mudar</SelectItem>
                <SelectItem value="on_custom_field_changed">Quando campo personalizado mudar</SelectItem>
                <SelectItem value="on_webhook">Webhook externo</SelectItem>
                <SelectItem value="on_form_submission">📝 Quando formulário for enviado</SelectItem>
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

          {triggerType === 'on_keyword_received' && (
            <div className="space-y-2">
              <Label>Palavras-chave (separadas por vírgula)</Label>
              <Input
                value={triggerConfig.keywords as string || ''}
                onChange={(e) => setTriggerConfig({ ...triggerConfig, keywords: e.target.value })}
                placeholder="Ex: preço, orçamento, valor"
              />
              <p className="text-xs text-muted-foreground">
                A automação será acionada se a mensagem conter qualquer uma das palavras
              </p>
            </div>
          )}

          {(triggerType === 'on_tag_added' || triggerType === 'on_tag_removed') && (
            <div className="space-y-2">
              <Label>Nome da Tag (gatilho)</Label>
              <Input
                value={triggerConfig.tag_name as string || ''}
                onChange={(e) => setTriggerConfig({ ...triggerConfig, tag_name: e.target.value })}
                placeholder="Nome da tag que aciona a automação"
              />
            </div>
          )}

          {triggerType === 'on_inactivity' && (
            <div className="space-y-2">
              <Label>Dias sem interação</Label>
              <Input
                type="number"
                min={1}
                value={triggerConfig.days as number || ''}
                onChange={(e) => setTriggerConfig({ ...triggerConfig, days: Number(e.target.value) })}
                placeholder="Ex: 7"
              />
            </div>
          )}

          {triggerType === 'on_custom_field_changed' && (
            <div className="space-y-2">
              <Label>Campo Personalizado</Label>
              <Select 
                value={triggerConfig.field_key as string || ''} 
                onValueChange={(v) => setTriggerConfig({ ...triggerConfig, field_key: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar campo" />
                </SelectTrigger>
                <SelectContent>
                  {fieldDefinitions?.map((field) => (
                    <SelectItem key={field.id} value={field.field_key}>
                      {field.field_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {triggerType === 'on_webhook' && automation?.id && (
            <WebhookTriggerConfig 
              automationId={automation.id}
              token={triggerConfig.security_token as string || ''}
              onTokenChange={(token) => setTriggerConfig({ ...triggerConfig, security_token: token })}
            />
          )}

          {triggerType === 'on_webhook' && !automation?.id && (
            <div className="p-3 bg-muted rounded-lg text-sm text-muted-foreground">
              <p>💡 Salve a automação para gerar a URL do webhook.</p>
            </div>
          )}

          {triggerType === 'on_form_submission' && (
            <div className="space-y-2">
              <Label>Formulário</Label>
              <Select 
                value={triggerConfig.form_id as string || 'any'} 
                onValueChange={(v) => setTriggerConfig({ ...triggerConfig, form_id: v === 'any' ? null : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar formulário" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Qualquer formulário</SelectItem>
                  {forms?.filter(f => f.status === 'published').map((form) => (
                    <SelectItem key={form.id} value={form.id}>
                      {form.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                A automação será acionada quando o formulário selecionado for enviado
              </p>
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
                <SelectItem value="trigger_chatbot_flow">Acionar fluxo de chatbot</SelectItem>
                <SelectItem value="set_custom_field">Definir campo personalizado</SelectItem>
                <SelectItem value="set_deal_value">Definir valor do deal</SelectItem>
                <SelectItem value="change_responsible">Alterar responsável</SelectItem>
                <SelectItem value="add_note">Adicionar nota</SelectItem>
                <SelectItem value="webhook_request">Enviar webhook</SelectItem>
                <SelectItem value="create_task">Criar tarefa</SelectItem>
                <SelectItem value="close_deal_won">Fechar como ganho</SelectItem>
                <SelectItem value="close_deal_lost">Fechar como perdido</SelectItem>
                <SelectItem value="ai_analyze_and_move">🤖 IA Analisa e Move</SelectItem>
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

          {actionType === 'trigger_chatbot_flow' && (
            <div className="space-y-2">
              <Label>Fluxo de Chatbot</Label>
              <Select 
                value={actionConfig.flow_id as string || ''} 
                onValueChange={(v) => setActionConfig({ ...actionConfig, flow_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar fluxo" />
                </SelectTrigger>
                <SelectContent>
                  {flows?.map((flow) => (
                    <SelectItem key={flow.id} value={flow.id}>
                      <span className="flex items-center gap-2">
                        {flow.name}
                        {!flow.is_active && (
                          <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            Inativo
                          </span>
                        )}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!flows?.length && (
                <p className="text-sm text-muted-foreground">
                  Nenhum fluxo disponível. Crie um fluxo em Chatbots.
                </p>
              )}
              {flows && flows.length > 0 && !flows.some(f => f.is_active) && (
                <p className="text-sm text-yellow-600">
                  ⚠️ Todos os fluxos estão inativos. Ative pelo menos um em Chatbots.
                </p>
              )}
            </div>
          )}

          {actionType === 'set_custom_field' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Campo Personalizado</Label>
                <Select 
                  value={actionConfig.field_key as string || ''} 
                  onValueChange={(v) => setActionConfig({ ...actionConfig, field_key: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar campo" />
                  </SelectTrigger>
                  <SelectContent>
                    {fieldDefinitions?.map((field) => (
                      <SelectItem key={field.id} value={field.field_key}>
                        {field.field_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Valor</Label>
                <Input
                  value={actionConfig.field_value as string || ''}
                  onChange={(e) => setActionConfig({ ...actionConfig, field_value: e.target.value })}
                  placeholder="Valor do campo"
                />
              </div>
            </div>
          )}

          {actionType === 'set_deal_value' && (
            <div className="space-y-2">
              <Label>Valor do Deal</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={actionConfig.value as number || ''}
                onChange={(e) => setActionConfig({ ...actionConfig, value: Number(e.target.value) })}
                placeholder="Ex: 5000"
              />
            </div>
          )}

          {actionType === 'change_responsible' && (
            <div className="space-y-2">
              <Label>Novo Responsável</Label>
              <Select 
                value={actionConfig.responsible_id as string || ''} 
                onValueChange={(v) => setActionConfig({ ...actionConfig, responsible_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar membro" />
                </SelectTrigger>
                <SelectContent>
                  {members?.map((member) => (
                    <SelectItem key={member.id} value={member.user_id || member.id}>
                      {member.profile?.full_name || member.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {actionType === 'add_note' && (
            <div className="space-y-2">
              <Label>Conteúdo da Nota</Label>
              <Textarea
                value={actionConfig.note_content as string || ''}
                onChange={(e) => setActionConfig({ ...actionConfig, note_content: e.target.value })}
                placeholder="Use {{nome}}, {{valor}}, {{etapa}} para variáveis"
                rows={3}
              />
            </div>
          )}

          {actionType === 'webhook_request' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>URL do Webhook</Label>
                <Input
                  type="url"
                  value={actionConfig.webhook_url as string || ''}
                  onChange={(e) => setActionConfig({ ...actionConfig, webhook_url: e.target.value })}
                  placeholder="https://seu-servidor.com/webhook"
                />
              </div>
              <div className="space-y-2">
                <Label>Método HTTP</Label>
                <Select 
                  value={actionConfig.method as string || 'POST'} 
                  onValueChange={(v) => setActionConfig({ ...actionConfig, method: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GET">GET</SelectItem>
                    <SelectItem value="POST">POST</SelectItem>
                    <SelectItem value="PUT">PUT</SelectItem>
                    <SelectItem value="PATCH">PATCH</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">
                O payload inclui dados do deal, contato e funil automaticamente
              </p>
            </div>
          )}

          {actionType === 'create_task' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Título da Tarefa</Label>
                <Input
                  value={actionConfig.task_title as string || ''}
                  onChange={(e) => setActionConfig({ ...actionConfig, task_title: e.target.value })}
                  placeholder="Ex: Fazer follow-up com cliente"
                />
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea
                  value={actionConfig.task_description as string || ''}
                  onChange={(e) => setActionConfig({ ...actionConfig, task_description: e.target.value })}
                  placeholder="Detalhes da tarefa"
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label>Prazo (dias a partir de hoje)</Label>
                <Input
                  type="number"
                  min={0}
                  value={actionConfig.due_days as number || ''}
                  onChange={(e) => setActionConfig({ ...actionConfig, due_days: Number(e.target.value) })}
                  placeholder="Ex: 3"
                />
              </div>
            </div>
          )}

          {(actionType === 'close_deal_won' || actionType === 'close_deal_lost') && (
            <p className="text-sm text-muted-foreground">
              O deal será movido para a etapa final correspondente ({actionType === 'close_deal_won' ? 'ganho' : 'perdido'})
            </p>
          )}

          {actionType === 'ai_analyze_and_move' && (
            <div className="space-y-4">
              <div className="p-3 bg-primary/10 rounded-lg border border-primary/20">
                <p className="text-sm text-muted-foreground">
                  🤖 A IA analisará a intenção da mensagem recebida e moverá o cartão para a etapa correspondente.
                </p>
              </div>

              {/* Agent selector for intent generation */}
              <div className="space-y-2">
                <Label>Gerar intenções a partir de um Agente de IA (opcional)</Label>
                <div className="flex gap-2">
                  <Select
                    value={selectedAgentId || '__none__'}
                    onValueChange={(v) => setSelectedAgentId(v === '__none__' ? '' : v)}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Selecionar agente..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Nenhum agente</SelectItem>
                      {agentConfigs?.map((agent) => (
                        <SelectItem key={agent.id} value={agent.id}>
                          {agent.agent_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="default"
                    disabled={!selectedAgentId || isGeneratingIntents || stages.length === 0}
                    onClick={handleGenerateIntents}
                  >
                    {isGeneratingIntents ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Gerando...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Gerar Intenções
                      </>
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Selecione um agente de IA para gerar intenções automaticamente baseadas no contexto do agente
                </p>
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Mapeamentos de Intenção → Etapa</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const currentMappings = (actionConfig.intent_mappings as IntentMapping[]) || [];
                      setActionConfig({
                        ...actionConfig,
                        intent_mappings: [...currentMappings, { intent: '', target_stage_id: '' }]
                      });
                    }}
                  >
                    + Adicionar
                  </Button>
                </div>
                
                {((actionConfig.intent_mappings as IntentMapping[]) || []).map((mapping, index) => (
                  <div key={index} className="flex gap-2 items-start p-3 bg-muted/50 rounded-lg">
                    <div className="flex-1 space-y-2">
                      <Input
                        value={mapping.intent}
                        onChange={(e) => {
                          const mappings = [...((actionConfig.intent_mappings as IntentMapping[]) || [])];
                          mappings[index] = { ...mappings[index], intent: e.target.value };
                          setActionConfig({ ...actionConfig, intent_mappings: mappings });
                        }}
                        placeholder="Ex: interesse, comprar, orçamento"
                      />
                    </div>
                    <span className="mt-2 text-muted-foreground">→</span>
                    <div className="flex-1">
                      <Select
                        value={mapping.target_stage_id}
                        onValueChange={(v) => {
                          const mappings = [...((actionConfig.intent_mappings as IntentMapping[]) || [])];
                          mappings[index] = { ...mappings[index], target_stage_id: v };
                          setActionConfig({ ...actionConfig, intent_mappings: mappings });
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Etapa destino" />
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
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="mt-1 text-destructive hover:text-destructive"
                      onClick={() => {
                        const mappings = [...((actionConfig.intent_mappings as IntentMapping[]) || [])];
                        mappings.splice(index, 1);
                        setActionConfig({ ...actionConfig, intent_mappings: mappings });
                      }}
                    >
                      ✕
                    </Button>
                  </div>
                ))}
                
                {(!actionConfig.intent_mappings || (actionConfig.intent_mappings as IntentMapping[]).length === 0) && (
                  <p className="text-sm text-muted-foreground text-center py-4 border-2 border-dashed rounded-lg">
                    Adicione mapeamentos para definir como a IA deve mover os cartões
                  </p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label>Etapa padrão (quando nenhuma intenção for detectada)</Label>
                <Select
                  value={actionConfig.default_stage_id as string || '__none__'}
                  onValueChange={(v) => setActionConfig({ ...actionConfig, default_stage_id: v === '__none__' ? '' : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar etapa (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Não mover</SelectItem>
                    {stages.map((stage) => (
                      <SelectItem key={stage.id} value={stage.id}>
                        {stage.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
