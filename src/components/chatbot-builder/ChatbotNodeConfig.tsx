import { Node } from "@xyflow/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Settings, Bot, Plus, Trash2, GitBranch } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useAllAgentConfigs } from "@/hooks/useAIAgentConfig";
import { useFunnels } from "@/hooks/useFunnels";

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
  delay?: number;
  question?: string;
  variable?: string;
  operator?: string;
  value?: string;
  duration?: number;
  unit?: string;
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
  };
  // Condition fields
  conditionMode?: 'variable' | 'ai_intent';
  intentDescription?: string;
  // Multiple conditions (variable mode)
  logicOperator?: 'and' | 'or';
  conditions?: ConditionItem[];
  // Multiple intents (AI mode)
  intents?: IntentItem[];
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
  const intents = data?.intents || [{ id: generateId(), label: '', description: '' }];

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

  return (
    <div className="space-y-4">
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
        <Button
          variant="outline"
          size="sm"
          onClick={addIntent}
          className="w-full border-purple-500/30 text-purple-600 dark:text-purple-400 hover:bg-purple-500/10"
        >
          <Plus className="h-3 w-3 mr-1" />
          Adicionar Intenção
        </Button>
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
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="message">Mensagem</Label>
              <Textarea
                id="message"
                value={data?.message || ""}
                onChange={(e) => handleChange("message", e.target.value)}
                placeholder="Digite a mensagem a ser enviada..."
                rows={4}
              />
              <p className="text-xs text-muted-foreground">
                Use {"{{variavel}}"} para inserir variáveis dinâmicas
              </p>
            </div>
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

      case "delay":
        return (
          <div className="space-y-4">
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
          </div>
        );

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
                </SelectContent>
              </Select>
            </div>
            {renderActionConfig()}
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
