import { Node } from "@xyflow/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Settings, Bot, Plus, Trash2, GitBranch, Sparkles, Loader2, Send, FileText } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useAllAgentConfigs } from "@/hooks/useAIAgentConfig";
import { useFunnels } from "@/hooks/useFunnels";
import { useMetaTemplates } from "@/hooks/useMetaTemplates";
import { useMetaWhatsAppNumbers } from "@/hooks/useMetaWhatsAppNumbers";
import { useMessageTemplates } from "@/hooks/useMessageTemplates";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { VariableChipsSelector } from "@/components/shared/VariableChipsSelector";

interface ConditionItem {
  id: string;
  variable: string;
  operator: string;
  value: string;
}

interface IntentItem {
  id: string;
  label: string;
  description: string;
}

interface NodeData {
  message?: string;
  messageMode?: 'text' | 'template' | 'meta_template';
  templateId?: string;
  delay?: number;
  question?: string;
  variable?: string;
  operator?: string;
  value?: string;
  duration?: number;
  unit?: string;
  waitMode?: 'time' | 'message';
  messageTimeoutMinutes?: number | null;
  prompt?: string;
  maxTokens?: number;
  aiConfigId?: string;
  aiMode?: 'existing' | 'custom';
  actionType?: string;
  config?: {
    tagName?: string;
    varName?: string;
    varValue?: string;
    funnelId?: string;
    stageId?: string;
    transferTo?: string;
    httpUrl?: string;
    httpMethod?: string;
    httpBody?: string;
    fieldKey?: string;
    fieldValue?: string;
    noteContent?: string;
    taskTitle?: string;
    taskDescription?: string;
    taskDueDate?: string;
    conversationStatus?: string;
    responsibleId?: string;
    metaPhoneNumberId?: string;
    metaTemplateId?: string;
    metaTemplateName?: string;
    metaTemplateLanguage?: string;
  };
  // Condition fields
  conditionMode?: 'variable' | 'ai_intent';
  intentDescription?: string;
  conditionAiConfigId?: string;
  logicOperator?: 'and' | 'or';
  conditions?: ConditionItem[];
  intents?: IntentItem[];
  // List message fields
  header?: string;
  body?: string;
  buttonText?: string;
  items?: Array<{ title: string; description: string }>;
  // Validation fields
  validationType?: string;
  regexPattern?: string;
  errorMessage?: string;
  // Sub flow fields
  flowName?: string;
  targetFlowId?: string;
  // Round robin fields
  members?: string[];
}

interface ChatbotNodeConfigProps {
  node: Node;
  onClose: () => void;
  onUpdate: (nodeId: string, data: Record<string, any>) => void;
}

// Generate unique ID
const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// Separate component for AI Response configuration
const AIResponseConfig = ({ 
  data, 
  handleChange 
}: { 
  data: NodeData; 
  handleChange: (key: string, value: any) => void;
}) => {
  const { data: agentConfigs, isLoading } = useAllAgentConfigs();
  const selectedAgent = agentConfigs?.find(a => a.id === data?.aiConfigId);
  const aiMode = data?.aiMode || 'custom';

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <Label>Modo de Resposta</Label>
        <RadioGroup
          value={aiMode}
          onValueChange={(v) => handleChange("aiMode", v)}
          className="space-y-2"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="existing" id="existing" />
            <Label htmlFor="existing" className="font-normal cursor-pointer">
              Usar IA existente
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="custom" id="custom" />
            <Label htmlFor="custom" className="font-normal cursor-pointer">
              Prompt personalizado
            </Label>
          </div>
        </RadioGroup>
      </div>

      {aiMode === 'existing' && (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="aiConfigId">Selecionar IA</Label>
            <Select
              value={data?.aiConfigId || "none"}
              onValueChange={(v) => handleChange("aiConfigId", v === "none" ? "" : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma IA..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Selecione uma IA...</SelectItem>
                {isLoading ? (
                  <SelectItem value="loading" disabled>Carregando...</SelectItem>
                ) : agentConfigs?.length === 0 ? (
                  <SelectItem value="empty" disabled>Nenhuma IA configurada</SelectItem>
                ) : (
                  agentConfigs?.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      <div className="flex items-center gap-2">
                        <Bot className="h-3 w-3" />
                        {agent.agent_name}
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {selectedAgent && (
            <div className="rounded-lg bg-muted/50 p-3 space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Preview da IA:</p>
              <p className="text-sm line-clamp-4">
                {selectedAgent.personality_prompt || "Sem prompt definido"}
              </p>
            </div>
          )}
        </div>
      )}

      {aiMode === 'custom' && (
        <>
          <div className="space-y-2">
            <Label htmlFor="prompt">Prompt do Sistema</Label>
            <Textarea
              id="prompt"
              value={data?.prompt || ""}
              onChange={(e) => handleChange("prompt", e.target.value)}
              placeholder="Você é um assistente útil..."
              rows={4}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="maxTokens">Máximo de Tokens</Label>
            <Input
              id="maxTokens"
              type="number"
              min={50}
              max={4000}
              value={data?.maxTokens || 500}
              onChange={(e) => handleChange("maxTokens", parseInt(e.target.value) || 500)}
            />
          </div>
        </>
      )}
    </div>
  );
};

// Component for multiple conditions (variable mode)
const MultipleConditionsConfig = ({
  data,
  handleChange
}: {
  data: NodeData;
  handleChange: (key: string, value: any) => void;
}) => {
  const conditions = data?.conditions || [{ id: generateId(), variable: '', operator: 'equals', value: '' }];
  const logicOperator = data?.logicOperator || 'and';

  const addCondition = () => {
    handleChange('conditions', [...conditions, { id: generateId(), variable: '', operator: 'equals', value: '' }]);
  };

  const removeCondition = (id: string) => {
    if (conditions.length > 1) {
      handleChange('conditions', conditions.filter(c => c.id !== id));
    }
  };

  const updateCondition = (id: string, field: string, value: string) => {
    handleChange('conditions', conditions.map(c => 
      c.id === id ? { ...c, [field]: value } : c
    ));
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Operador Lógico</Label>
        <RadioGroup
          value={logicOperator}
          onValueChange={(v) => handleChange("logicOperator", v)}
          className="flex gap-4"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="and" id="op-and" />
            <Label htmlFor="op-and" className="font-normal cursor-pointer text-sm">
              E (todas verdadeiras)
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="or" id="op-or" />
            <Label htmlFor="op-or" className="font-normal cursor-pointer text-sm">
              OU (pelo menos uma)
            </Label>
          </div>
        </RadioGroup>
      </div>

      <div className="space-y-3">
        <Label>Condições</Label>
        {conditions.map((condition, index) => (
          <div key={condition.id} className="p-3 border border-border rounded-lg space-y-2 bg-muted/30">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground font-medium">Condição {index + 1}</span>
              {conditions.length > 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => removeCondition(condition.id)}
                >
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              )}
            </div>
            <Input
              value={condition.variable}
              onChange={(e) => updateCondition(condition.id, 'variable', e.target.value)}
              placeholder="Variável"
              className="h-8 text-sm"
            />
            <Select
              value={condition.operator}
              onValueChange={(v) => updateCondition(condition.id, 'operator', v)}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="equals">Igual a</SelectItem>
                <SelectItem value="not_equals">Diferente de</SelectItem>
                <SelectItem value="contains">Contém</SelectItem>
                <SelectItem value="not_contains">Não contém</SelectItem>
                <SelectItem value="starts_with">Começa com</SelectItem>
                <SelectItem value="ends_with">Termina com</SelectItem>
                <SelectItem value="greater_than">Maior que</SelectItem>
                <SelectItem value="less_than">Menor que</SelectItem>
              </SelectContent>
            </Select>
            <Input
              value={condition.value}
              onChange={(e) => updateCondition(condition.id, 'value', e.target.value)}
              placeholder="Valor"
              className="h-8 text-sm"
            />
          </div>
        ))}
        <Button
          variant="outline"
          size="sm"
          onClick={addCondition}
          className="w-full"
        >
          <Plus className="h-3 w-3 mr-1" />
          Adicionar Condição
        </Button>
      </div>
    </div>
  );
};

// Component for multiple intents (AI mode)
const MultipleIntentsConfig = ({
  data,
  handleChange
}: {
  data: NodeData;
  handleChange: (key: string, value: any) => void;
}) => {
  const [isSuggesting, setIsSuggesting] = useState(false);
  const { data: agentConfigs, isLoading: isLoadingAgents } = useAllAgentConfigs();
  
  const intents = data?.intents || [{ id: generateId(), label: '', description: '' }];
  const selectedAgent = agentConfigs?.find(a => a.id === data?.conditionAiConfigId);

  const addIntent = () => {
    handleChange('intents', [...intents, { id: generateId(), label: '', description: '' }]);
  };

  const removeIntent = (id: string) => {
    if (intents.length > 1) {
      handleChange('intents', intents.filter(i => i.id !== id));
    }
  };

  const updateIntent = (id: string, field: string, value: string) => {
    handleChange('intents', intents.map(i => 
      i.id === id ? { ...i, [field]: value } : i
    ));
  };

  const handleSuggestIntents = async () => {
    if (!data?.conditionAiConfigId) {
      toast.error("Selecione um assistente de IA primeiro");
      return;
    }

    setIsSuggesting(true);
    try {
      const { data: result, error } = await supabase.functions.invoke('suggest-chatbot-intents', {
        body: { agentConfigId: data.conditionAiConfigId }
      });

      if (error) throw error;

      if (result?.suggestions && Array.isArray(result.suggestions)) {
        const newIntents = result.suggestions.map((s: { label: string; description: string }) => ({
          id: generateId(),
          label: s.label,
          description: s.description
        }));
        handleChange('intents', newIntents);
        toast.success(`${newIntents.length} intenções sugeridas com sucesso!`);
      } else {
        toast.error("Não foi possível gerar sugestões");
      }
    } catch (error) {
      console.error("Error suggesting intents:", error);
      toast.error("Erro ao gerar sugestões de intenções");
    } finally {
      setIsSuggesting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* AI Assistant Selector */}
      <div className="space-y-2">
        <Label>Assistente de IA</Label>
        <Select
          value={data?.conditionAiConfigId || "none"}
          onValueChange={(v) => handleChange("conditionAiConfigId", v === "none" ? "" : v)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione uma IA..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">IA Genérica (padrão)</SelectItem>
            {isLoadingAgents ? (
              <SelectItem value="loading" disabled>Carregando...</SelectItem>
            ) : agentConfigs?.length === 0 ? (
              <SelectItem value="empty" disabled>Nenhuma IA configurada</SelectItem>
            ) : (
              agentConfigs?.map((agent) => (
                <SelectItem key={agent.id} value={agent.id}>
                  <div className="flex items-center gap-2">
                    <Bot className="h-3 w-3" />
                    {agent.agent_name}
                  </div>
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Selecione uma IA para usar seu contexto na análise de intenções
        </p>
      </div>

      {/* Selected AI Preview */}
      {selectedAgent && (
        <div className="rounded-lg bg-purple-500/10 p-3 space-y-2 border border-purple-500/20">
          <p className="text-xs font-medium text-purple-600 dark:text-purple-400">
            Personalidade da IA:
          </p>
          <p className="text-xs text-muted-foreground line-clamp-3">
            {selectedAgent.personality_prompt || "Sem prompt definido"}
          </p>
        </div>
      )}

      <div className="space-y-3">
        <Label>Intenções</Label>
        <p className="text-xs text-muted-foreground">
          Cada intenção cria uma saída no nó. Há também uma saída "Nenhuma" para quando não houver correspondência.
        </p>
        {intents.map((intent, index) => (
          <div key={intent.id} className="p-3 border border-purple-500/30 rounded-lg space-y-2 bg-purple-500/5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-purple-600 dark:text-purple-400 font-medium">
                Intenção {index + 1}
              </span>
              {intents.length > 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => removeIntent(intent.id)}
                >
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              )}
            </div>
            <Input
              value={intent.label}
              onChange={(e) => updateIntent(intent.id, 'label', e.target.value)}
              placeholder="Nome da saída (ex: Preço, Agendar)"
              className="h-8 text-sm"
            />
            <Textarea
              value={intent.description}
              onChange={(e) => updateIntent(intent.id, 'description', e.target.value)}
              placeholder="Descrição da intenção (ex: O usuário quer saber sobre preços)"
              rows={2}
              className="text-sm"
            />
          </div>
        ))}
        
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={addIntent}
            className="flex-1"
          >
            <Plus className="h-3 w-3 mr-1" />
            Adicionar
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSuggestIntents}
            disabled={isSuggesting || !data?.conditionAiConfigId}
            className="flex-1 border-purple-500/30 text-purple-600 dark:text-purple-400 hover:bg-purple-500/10"
          >
            {isSuggesting ? (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : (
              <Sparkles className="h-3 w-3 mr-1" />
            )}
            Sugerir com IA
          </Button>
        </div>
      </div>

      <div className="rounded-lg bg-muted/50 p-3 space-y-1">
        <p className="text-xs font-medium text-muted-foreground">Exemplos de intenção:</p>
        <ul className="text-xs text-muted-foreground space-y-0.5 list-disc pl-4">
          <li>"Quer saber sobre preços"</li>
          <li>"Quer falar com atendente humano"</li>
          <li>"Quer agendar uma reunião"</li>
          <li>"Está interessado em comprar"</li>
        </ul>
      </div>
    </div>
  );
};

// Component for Meta Template action configuration
const MetaTemplateActionConfig = ({
  config,
  handleChange,
  data,
}: {
  config: Record<string, any>;
  handleChange: (key: string, value: any) => void;
  data: NodeData;
}) => {
  const { metaNumbers, isLoading: isLoadingNumbers } = useMetaWhatsAppNumbers();
  
  // Get waba_id from selected number to filter templates
  const selectedNumber = metaNumbers?.find(n => n.phone_number_id === config.metaPhoneNumberId);
  const { templates, isLoading: isLoadingTemplates } = useMetaTemplates(selectedNumber?.waba_id);
  
  const approvedTemplates = templates.filter(t => t.status === 'approved');
  const selectedTemplate = approvedTemplates.find(t => t.id === config.metaTemplateId);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Número Meta WhatsApp</Label>
        <Select
          value={config.metaPhoneNumberId || ""}
          onValueChange={(v) => handleChange("config", { 
            ...config, 
            metaPhoneNumberId: v, 
            metaTemplateId: "",
            metaTemplateName: "",
          })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione um número..." />
          </SelectTrigger>
          <SelectContent>
            {isLoadingNumbers ? (
              <SelectItem value="loading" disabled>Carregando...</SelectItem>
            ) : metaNumbers?.length === 0 ? (
              <SelectItem value="empty" disabled>Nenhum número configurado</SelectItem>
            ) : (
              metaNumbers?.filter(n => n.is_active).map((number) => (
                 <SelectItem key={number.phone_number_id} value={number.phone_number_id}>
                   <div className="flex items-center gap-2">
                     <Send className="h-3 w-3" />
                     {number.display_name && number.phone_number 
                       ? `${number.display_name} (${number.phone_number})`
                       : number.display_name || number.phone_number || number.phone_number_id}
                  </div>
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </div>

      {config.metaPhoneNumberId && (
        <div className="space-y-2">
          <Label>Template Aprovado</Label>
          <Select
            value={config.metaTemplateId || ""}
            onValueChange={(v) => {
              const tpl = approvedTemplates.find(t => t.id === v);
              handleChange("config", { 
                ...config, 
                metaTemplateId: v,
                metaTemplateName: tpl?.name || "",
                metaTemplateLanguage: tpl?.language || "pt_BR",
              });
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione um template..." />
            </SelectTrigger>
            <SelectContent>
              {isLoadingTemplates ? (
                <SelectItem value="loading" disabled>Carregando...</SelectItem>
              ) : approvedTemplates.length === 0 ? (
                <SelectItem value="empty" disabled>Nenhum template aprovado</SelectItem>
              ) : (
                approvedTemplates.map((tpl) => (
                  <SelectItem key={tpl.id} value={tpl.id}>
                    {tpl.name} ({tpl.category})
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
      )}

      {selectedTemplate && (
        <div className="rounded-lg bg-muted/50 p-3 space-y-2 border">
          <p className="text-xs font-medium text-muted-foreground">Preview:</p>
          <p className="text-sm whitespace-pre-line line-clamp-5">
            {selectedTemplate.body_text}
          </p>
          {selectedTemplate.body_examples?.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Variáveis: {selectedTemplate.body_examples.length} exemplo(s) configurado(s)
            </p>
          )}
        </div>
      )}

      <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
        <p>O template será enviado via WhatsApp Cloud API (Meta) usando o número selecionado. As variáveis do template serão substituídas com os dados do contato.</p>
      </div>
    </div>
  );
};

// Component for Message node with template support
const MessageNodeConfig = ({
  data,
  handleChange,
}: {
  data: NodeData;
  handleChange: (key: string, value: any) => void;
}) => {
  const messageMode = data?.messageMode || 'text';
  const { templates } = useMessageTemplates();
  const { metaNumbers, isLoading: isLoadingNumbers } = useMetaWhatsAppNumbers();
  
  const selectedMetaNumber = metaNumbers?.find(n => n.phone_number_id === data?.config?.metaPhoneNumberId);
  const { templates: metaTemplatesList, isLoading: isLoadingMetaTemplates } = useMetaTemplates(selectedMetaNumber?.waba_id);
  const approvedMetaTemplates = metaTemplatesList.filter(t => t.status === 'approved');

  const activeTemplates = templates?.filter(t => t.is_active) || [];
  const selectedTemplate = activeTemplates.find(t => t.id === data?.templateId);
  const selectedMetaTemplate = approvedMetaTemplates.find(t => t.id === data?.config?.metaTemplateId);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Tipo de Mensagem</Label>
        <RadioGroup
          value={messageMode}
          onValueChange={(v) => handleChange("messageMode", v)}
          className="space-y-2"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="text" id="msg-text" />
            <Label htmlFor="msg-text" className="font-normal cursor-pointer text-sm">
              Texto livre
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="template" id="msg-template" />
            <Label htmlFor="msg-template" className="font-normal cursor-pointer text-sm">
              Template (WhatsApp Lite)
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="meta_template" id="msg-meta-template" />
            <Label htmlFor="msg-meta-template" className="font-normal cursor-pointer text-sm">
              Template Meta (WhatsApp Oficial)
            </Label>
          </div>
        </RadioGroup>
      </div>

      {messageMode === 'text' && (
        <>
          <div className="space-y-2">
            <Label htmlFor="message">Mensagem</Label>
            <Textarea
              id="message"
              value={data?.message || ""}
              onChange={(e) => handleChange("message", e.target.value)}
              placeholder="Digite a mensagem a ser enviada..."
              rows={4}
            />
            <VariableChipsSelector
              onInsert={(variable) => handleChange("message", (data?.message || "") + " " + variable)}
              compact
            />
          </div>
        </>
      )}

      {messageMode === 'template' && (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Template</Label>
            <Select
              value={data?.templateId || ""}
              onValueChange={(v) => {
                const tpl = activeTemplates.find(t => t.id === v);
                handleChange("templateId", v);
                if (tpl) {
                  handleChange("message", tpl.content);
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione um template..." />
              </SelectTrigger>
              <SelectContent>
                {activeTemplates.length === 0 ? (
                  <SelectItem value="empty" disabled>Nenhum template disponível</SelectItem>
                ) : (
                  activeTemplates.map((tpl) => (
                    <SelectItem key={tpl.id} value={tpl.id}>
                      <div className="flex items-center gap-2">
                        <FileText className="h-3 w-3" />
                        {tpl.name}
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          {selectedTemplate && (
            <div className="rounded-lg bg-muted/50 p-3 space-y-2 border">
              <p className="text-xs font-medium text-muted-foreground">Preview:</p>
              <p className="text-sm whitespace-pre-line line-clamp-6">{selectedTemplate.content}</p>
              {selectedTemplate.media_type && (
                <p className="text-xs text-muted-foreground">
                  Mídia: {selectedTemplate.media_type} {selectedTemplate.media_filename ? `(${selectedTemplate.media_filename})` : ''}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {messageMode === 'meta_template' && (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Número Meta WhatsApp</Label>
            <Select
              value={data?.config?.metaPhoneNumberId || ""}
              onValueChange={(v) => handleChange("config", {
                ...(data?.config || {}),
                metaPhoneNumberId: v,
                metaTemplateId: "",
                metaTemplateName: "",
              })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione um número..." />
              </SelectTrigger>
              <SelectContent>
                {isLoadingNumbers ? (
                  <SelectItem value="loading" disabled>Carregando...</SelectItem>
                ) : metaNumbers?.length === 0 ? (
                  <SelectItem value="empty" disabled>Nenhum número configurado</SelectItem>
                ) : (
                  metaNumbers?.filter(n => n.is_active).map((number) => (
                    <SelectItem key={number.phone_number_id} value={number.phone_number_id}>
                      <div className="flex items-center gap-2">
                        <Send className="h-3 w-3" />
                        {number.display_name && number.phone_number 
                          ? `${number.display_name} (${number.phone_number})`
                          : number.display_name || number.phone_number || number.phone_number_id}
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {data?.config?.metaPhoneNumberId && (
            <div className="space-y-2">
              <Label>Template Aprovado</Label>
              <Select
                value={data?.config?.metaTemplateId || ""}
                onValueChange={(v) => {
                  const tpl = approvedMetaTemplates.find(t => t.id === v);
                  handleChange("config", {
                    ...(data?.config || {}),
                    metaTemplateId: v,
                    metaTemplateName: tpl?.name || "",
                    metaTemplateLanguage: tpl?.language || "pt_BR",
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um template..." />
                </SelectTrigger>
                <SelectContent>
                  {isLoadingMetaTemplates ? (
                    <SelectItem value="loading" disabled>Carregando...</SelectItem>
                  ) : approvedMetaTemplates.length === 0 ? (
                    <SelectItem value="empty" disabled>Nenhum template aprovado</SelectItem>
                  ) : (
                    approvedMetaTemplates.map((tpl) => (
                      <SelectItem key={tpl.id} value={tpl.id}>
                        {tpl.name} ({tpl.category})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          {selectedMetaTemplate && (
            <div className="rounded-lg bg-muted/50 p-3 space-y-2 border">
              <p className="text-xs font-medium text-muted-foreground">Preview:</p>
              <p className="text-sm whitespace-pre-line line-clamp-5">{selectedMetaTemplate.body_text}</p>
            </div>
          )}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="delay">Delay (segundos)</Label>
        <Input
          id="delay"
          type="number"
          min={0}
          value={data?.delay || 0}
          onChange={(e) => handleChange("delay", parseInt(e.target.value) || 0)}
        />
      </div>
    </div>
  );
};

export const ChatbotNodeConfig = ({ node, onClose, onUpdate }: ChatbotNodeConfigProps) => {
  const data = node.data as NodeData;
  const { funnels } = useFunnels();
  
  const handleChange = (key: string, value: any) => {
    onUpdate(node.id, { [key]: value });
  };
  
  const selectedFunnel = funnels?.find(f => f.id === data?.config?.funnelId);

  const renderConfig = () => {
    switch (node.type) {
      case "start":
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Este é o ponto de entrada do fluxo. Quando uma mensagem é recebida, o fluxo inicia aqui.
            </p>
          </div>
        );

      case "message":
        return (
          <MessageNodeConfig data={data} handleChange={handleChange} />
        );

      case "question":
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="question">Pergunta</Label>
              <Textarea
                id="question"
                value={data?.question || ""}
                onChange={(e) => handleChange("question", e.target.value)}
                placeholder="Digite a pergunta..."
                rows={3}
              />
              <VariableChipsSelector
                onInsert={(variable) => handleChange("question", (data?.question || "") + " " + variable)}
                compact
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="variable">Salvar resposta em</Label>
              <Input
                id="variable"
                value={data?.variable || ""}
                onChange={(e) => handleChange("variable", e.target.value)}
                placeholder="nome_variavel"
              />
            </div>
          </div>
        );

      case "condition":
        return (
          <div className="space-y-4">
            <div className="space-y-3">
              <Label>Tipo de Condição</Label>
              <RadioGroup
                value={data?.conditionMode || 'variable'}
                onValueChange={(v) => handleChange("conditionMode", v)}
                className="space-y-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="variable" id="mode-variable" />
                  <Label htmlFor="mode-variable" className="font-normal cursor-pointer">
                    Comparar Variável
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="ai_intent" id="mode-ai" />
                  <Label htmlFor="mode-ai" className="font-normal cursor-pointer flex items-center gap-1">
                    <Bot className="h-3 w-3" />
                    Assistente IA (Intenções)
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {(data?.conditionMode || 'variable') === 'variable' ? (
              <MultipleConditionsConfig data={data} handleChange={handleChange} />
            ) : (
              <MultipleIntentsConfig data={data} handleChange={handleChange} />
            )}
          </div>
        );

      case "delay": {
        const waitMode = (data?.waitMode as string) || "time";
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="waitMode">Tipo de espera</Label>
              <Select
                value={waitMode}
                onValueChange={(v) => handleChange("waitMode", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="time">Aguardar tempo determinado</SelectItem>
                  <SelectItem value="message">Aguardar até receber mensagem</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {waitMode === "message"
                  ? "O fluxo pausa até o contato enviar qualquer mensagem."
                  : "O fluxo pausa pelo tempo configurado e segue automaticamente."}
              </p>
            </div>

            {waitMode === "time" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="duration">Duração</Label>
                  <Input
                    id="duration"
                    type="number"
                    min={1}
                    value={data?.duration || 5}
                    onChange={(e) => handleChange("duration", parseInt(e.target.value) || 5)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="unit">Unidade</Label>
                  <Select
                    value={data?.unit || "seconds"}
                    onValueChange={(v) => handleChange("unit", v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="seconds">Segundos</SelectItem>
                      <SelectItem value="minutes">Minutos</SelectItem>
                      <SelectItem value="hours">Horas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {waitMode === "message" && (
              <div className="space-y-2">
                <Label htmlFor="messageTimeoutMinutes">
                  Timeout (minutos, opcional)
                </Label>
                <Input
                  id="messageTimeoutMinutes"
                  type="number"
                  min={0}
                  placeholder="Sem timeout"
                  value={data?.messageTimeoutMinutes ?? ""}
                  onChange={(e) =>
                    handleChange(
                      "messageTimeoutMinutes",
                      e.target.value === "" ? null : parseInt(e.target.value) || 0
                    )
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Se preenchido, o fluxo continua automaticamente caso o contato
                  não responda nesse tempo.
                </p>
              </div>
            )}
          </div>
        );
      }

      case "ai_response":
        return <AIResponseConfig data={data} handleChange={handleChange} />;

      case "action":
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="actionType">Tipo de Ação</Label>
              <Select
                value={data?.actionType || "add_tag"}
                onValueChange={(v) => handleChange("actionType", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="add_tag">Adicionar Tag</SelectItem>
                  <SelectItem value="remove_tag">Remover Tag</SelectItem>
                  <SelectItem value="move_funnel">Mover no Funil</SelectItem>
                  <SelectItem value="set_variable">Definir Variável</SelectItem>
                  <SelectItem value="transfer">Transferir para Humano</SelectItem>
                  <SelectItem value="http_request">Requisição HTTP</SelectItem>
                  <SelectItem value="set_field">Definir Campo</SelectItem>
                  <SelectItem value="create_lead">Criar Lead</SelectItem>
                  <SelectItem value="change_lead_status">Mudar Status do Lead</SelectItem>
                  <SelectItem value="add_note">Adicionar Nota</SelectItem>
                  <SelectItem value="add_task">Adicionar Tarefa</SelectItem>
                  <SelectItem value="change_conversation_status">Alterar Status Conversa</SelectItem>
                  <SelectItem value="complete_tasks">Completar Tarefas</SelectItem>
                  <SelectItem value="change_responsible">Mudar Responsável</SelectItem>
                  <SelectItem value="send_meta_template">Enviar Template Meta</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {renderActionConfig()}
          </div>
        );

      case "list_message":
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="header">Título</Label>
              <Input
                id="header"
                value={data?.header || ""}
                onChange={(e) => handleChange("header", e.target.value)}
                placeholder="Escolha uma opção"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="body">Corpo da mensagem</Label>
              <Textarea
                id="body"
                value={data?.body || ""}
                onChange={(e) => handleChange("body", e.target.value)}
                placeholder="Selecione abaixo a opção desejada..."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="buttonText">Texto do Botão</Label>
              <Input
                id="buttonText"
                value={data?.buttonText || "Ver opções"}
                onChange={(e) => handleChange("buttonText", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Itens da Lista</Label>
              {((data?.items as Array<{ title: string; description: string }>) || []).map((item: { title: string; description: string }, index: number) => (
                <div key={index} className="p-2 border border-border rounded-lg space-y-1 bg-muted/30">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Item {index + 1}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5"
                      onClick={() => {
                        const items = [...((data?.items as any[]) || [])];
                        items.splice(index, 1);
                        handleChange("items", items);
                      }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                  <Input
                    value={item.title}
                    onChange={(e) => {
                      const items = [...((data?.items as any[]) || [])];
                      items[index] = { ...items[index], title: e.target.value };
                      handleChange("items", items);
                    }}
                    placeholder="Título"
                    className="h-7 text-xs"
                  />
                  <Input
                    value={item.description}
                    onChange={(e) => {
                      const items = [...((data?.items as any[]) || [])];
                      items[index] = { ...items[index], description: e.target.value };
                      handleChange("items", items);
                    }}
                    placeholder="Descrição (opcional)"
                    className="h-7 text-xs"
                  />
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => {
                  const items = [...((data?.items as any[]) || []), { title: '', description: '' }];
                  handleChange("items", items);
                }}
              >
                <Plus className="h-3 w-3 mr-1" />
                Adicionar Item
              </Button>
            </div>
          </div>
        );

      case "validation":
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="variable">Variável a Validar</Label>
              <Input
                id="variable"
                value={data?.variable || ""}
                onChange={(e) => handleChange("variable", e.target.value)}
                placeholder="nome_variavel"
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo de Validação</Label>
              <Select
                value={data?.validationType || "not_empty"}
                onValueChange={(v) => handleChange("validationType", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="not_empty">Não vazio</SelectItem>
                  <SelectItem value="email">E-mail</SelectItem>
                  <SelectItem value="phone">Telefone</SelectItem>
                  <SelectItem value="cpf">CPF</SelectItem>
                  <SelectItem value="number">Número</SelectItem>
                  <SelectItem value="regex">Regex personalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {data?.validationType === "regex" && (
              <div className="space-y-2">
                <Label htmlFor="regexPattern">Padrão Regex</Label>
                <Input
                  id="regexPattern"
                  value={data?.regexPattern || ""}
                  onChange={(e) => handleChange("regexPattern", e.target.value)}
                  placeholder="^[0-9]{11}$"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="errorMessage">Mensagem de Erro</Label>
              <Textarea
                id="errorMessage"
                value={data?.errorMessage || ""}
                onChange={(e) => handleChange("errorMessage", e.target.value)}
                placeholder="Por favor, informe um valor válido."
                rows={2}
              />
            </div>
            <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
              <p>Saídas: <strong>Válido</strong> (esquerda) e <strong>Inválido</strong> (direita)</p>
            </div>
          </div>
        );

      case "sub_flow":
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Fluxo a Iniciar</Label>
              <Input
                value={data?.flowName || ""}
                onChange={(e) => handleChange("flowName", e.target.value)}
                placeholder="Nome do fluxo de destino"
              />
              <p className="text-xs text-muted-foreground">
                O fluxo selecionado será iniciado quando a execução chegar neste nó.
              </p>
            </div>
          </div>
        );

      case "round_robin":
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Membros do Rodízio</Label>
              {((data?.members as string[]) || []).map((member: string, index: number) => (
                <div key={index} className="flex gap-2">
                  <Input
                    value={member}
                    onChange={(e) => {
                      const members = [...((data?.members as string[]) || [])];
                      members[index] = e.target.value;
                      handleChange("members", members);
                    }}
                    placeholder="Nome do membro"
                    className="h-8 text-sm"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => {
                      const members = [...((data?.members as string[]) || [])];
                      members.splice(index, 1);
                      handleChange("members", members);
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => {
                  const members = [...((data?.members as string[]) || []), ''];
                  handleChange("members", members);
                }}
              >
                <Plus className="h-3 w-3 mr-1" />
                Adicionar Membro
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              A conversa será distribuída de forma rotativa entre os membros configurados.
            </p>
          </div>
        );

      case "end":
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Este é o ponto de finalização do fluxo. A conversa será encerrada aqui.
            </p>
          </div>
        );

      default:
        return null;
    }
  };

  const renderActionConfig = () => {
    const actionType = data?.actionType || "add_tag";
    const config = data?.config || {};
    
    switch (actionType) {
      case "add_tag":
      case "remove_tag":
        return (
          <div className="space-y-2">
            <Label htmlFor="tagName">Nome da Tag</Label>
            <Input
              id="tagName"
              value={config.tagName || ""}
              onChange={(e) => handleChange("config", { ...config, tagName: e.target.value })}
              placeholder="nome-da-tag"
            />
          </div>
        );
      case "set_variable":
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="varName">Nome da Variável</Label>
              <Input
                id="varName"
                value={config.varName || ""}
                onChange={(e) => handleChange("config", { ...config, varName: e.target.value })}
                placeholder="nome_variavel"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="varValue">Valor</Label>
              <Input
                id="varValue"
                value={config.varValue || ""}
                onChange={(e) => handleChange("config", { ...config, varValue: e.target.value })}
                placeholder="valor"
              />
            </div>
          </>
        );
      case "move_funnel":
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="funnelId">Funil</Label>
              <Select
                value={config.funnelId || ""}
                onValueChange={(v) => handleChange("config", { ...config, funnelId: v, stageId: "" })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um funil..." />
                </SelectTrigger>
                <SelectContent>
                  {funnels?.map((funnel) => (
                    <SelectItem key={funnel.id} value={funnel.id}>
                      <div className="flex items-center gap-2">
                        <GitBranch className="h-3 w-3" />
                        {funnel.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {config.funnelId && selectedFunnel && (
              <div className="space-y-2">
                <Label htmlFor="stageId">Etapa</Label>
                <Select
                  value={config.stageId || ""}
                  onValueChange={(v) => handleChange("config", { ...config, stageId: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma etapa..." />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedFunnel.stages?.map((stage) => (
                      <SelectItem key={stage.id} value={stage.id}>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-2 h-2 rounded-full" 
                            style={{ backgroundColor: stage.color || '#888' }} 
                          />
                          {stage.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </>
        );
      case "transfer":
        return (
          <div className="space-y-2">
            <Label>Tipo de Transferência</Label>
            <Select
              value={config.transferTo || "human"}
              onValueChange={(v) => handleChange("config", { ...config, transferTo: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="human">Atendente Humano</SelectItem>
                <SelectItem value="team">Equipe Específica</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              A conversa será transferida e marcada como pendente
            </p>
          </div>
        );
      case "http_request":
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="httpUrl">URL</Label>
              <Input
                id="httpUrl"
                value={config.httpUrl || ""}
                onChange={(e) => handleChange("config", { ...config, httpUrl: e.target.value })}
                placeholder="https://api.example.com/webhook"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="httpMethod">Método</Label>
              <Select
                value={config.httpMethod || "POST"}
                onValueChange={(v) => handleChange("config", { ...config, httpMethod: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GET">GET</SelectItem>
                  <SelectItem value="POST">POST</SelectItem>
                  <SelectItem value="PUT">PUT</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="httpBody">Body (JSON)</Label>
              <Textarea
                id="httpBody"
                value={config.httpBody || ""}
                onChange={(e) => handleChange("config", { ...config, httpBody: e.target.value })}
                placeholder='{"contact": "{{phone}}"}'
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                Use {"{{variavel}}"} para inserir dados dinâmicos
              </p>
            </div>
          </>
        );
      case "set_field":
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="fieldKey">Campo</Label>
              <Input
                id="fieldKey"
                value={config.fieldKey || ""}
                onChange={(e) => handleChange("config", { ...config, fieldKey: e.target.value })}
                placeholder="nome_do_campo"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fieldValue">Valor</Label>
              <Input
                id="fieldValue"
                value={config.fieldValue || ""}
                onChange={(e) => handleChange("config", { ...config, fieldValue: e.target.value })}
                placeholder="valor ou {{variavel}}"
              />
            </div>
          </>
        );
      case "create_lead":
      case "change_lead_status":
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="funnelId">Funil</Label>
              <Select
                value={config.funnelId || ""}
                onValueChange={(v) => handleChange("config", { ...config, funnelId: v, stageId: "" })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um funil..." />
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
            {config.funnelId && selectedFunnel && (
              <div className="space-y-2">
                <Label htmlFor="stageId">Etapa</Label>
                <Select
                  value={config.stageId || ""}
                  onValueChange={(v) => handleChange("config", { ...config, stageId: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma etapa..." />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedFunnel.stages?.map((stage) => (
                      <SelectItem key={stage.id} value={stage.id}>
                        {stage.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </>
        );
      case "add_note":
        return (
          <div className="space-y-2">
            <Label htmlFor="noteContent">Conteúdo da Nota</Label>
            <Textarea
              id="noteContent"
              value={config.noteContent || ""}
              onChange={(e) => handleChange("config", { ...config, noteContent: e.target.value })}
              placeholder="Escreva o conteúdo da nota..."
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              Use {"{{variavel}}"} para dados dinâmicos
            </p>
          </div>
        );
      case "add_task":
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="taskTitle">Título da Tarefa</Label>
              <Input
                id="taskTitle"
                value={config.taskTitle || ""}
                onChange={(e) => handleChange("config", { ...config, taskTitle: e.target.value })}
                placeholder="Título da tarefa"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="taskDescription">Descrição</Label>
              <Textarea
                id="taskDescription"
                value={config.taskDescription || ""}
                onChange={(e) => handleChange("config", { ...config, taskDescription: e.target.value })}
                placeholder="Descrição da tarefa..."
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="taskDueDate">Prazo (dias)</Label>
              <Input
                id="taskDueDate"
                type="number"
                min={1}
                value={config.taskDueDate || "1"}
                onChange={(e) => handleChange("config", { ...config, taskDueDate: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">Dias a partir da execução</p>
            </div>
          </>
        );
      case "change_conversation_status":
        return (
          <div className="space-y-2">
            <Label>Novo Status</Label>
            <Select
              value={config.conversationStatus || "open"}
              onValueChange={(v) => handleChange("config", { ...config, conversationStatus: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Aberta</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="resolved">Resolvida</SelectItem>
              </SelectContent>
            </Select>
          </div>
        );
      case "complete_tasks":
        return (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Todas as tarefas pendentes do contato serão marcadas como concluídas.
            </p>
          </div>
        );
      case "change_responsible":
        return (
          <div className="space-y-2">
            <Label htmlFor="responsibleId">Responsável</Label>
            <Input
              id="responsibleId"
              value={config.responsibleId || ""}
              onChange={(e) => handleChange("config", { ...config, responsibleId: e.target.value })}
              placeholder="ID ou nome do responsável"
            />
          </div>
        );
      case "send_meta_template":
        return <MetaTemplateActionConfig config={config} handleChange={handleChange} data={data} />;
      default:
        return null;
    }
  };

  const getNodeTypeName = () => {
    const typeNames: Record<string, string> = {
      start: "Início",
      message: "Mensagem",
      question: "Pergunta",
      condition: "Condição",
      delay: "Aguardar",
      ai_response: "Resposta IA",
      action: "Ação",
      end: "Fim",
      list_message: "List Message",
      validation: "Validação",
      sub_flow: "Iniciar Fluxo",
      round_robin: "Round Robin",
    };
    return typeNames[node.type || ""] || "Nó";
  };

  return (
    <aside className="w-80 border-l border-border bg-card flex flex-col">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-semibold">{getNodeTypeName()}</h3>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-4">
          {renderConfig()}
        </div>
      </ScrollArea>
    </aside>
  );
};
