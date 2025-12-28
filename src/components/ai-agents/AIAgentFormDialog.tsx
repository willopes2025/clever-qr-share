import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Loader2, Save, Bot, MessageSquare, Clock, Mic } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { AIAgentTemplate } from "@/data/ai-agent-templates";
import { AgentKnowledgeTab } from "@/components/campaigns/agent/AgentKnowledgeTab";
import { AgentVariablesTab } from "@/components/campaigns/agent/AgentVariablesTab";
import { AgentStagesTab } from "@/components/campaigns/agent/AgentStagesTab";
import { AgentCalendarTab } from "@/components/campaigns/agent/AgentCalendarTab";

interface AIAgentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: AIAgentTemplate | null;
  editingAgentId: string | null;
  isPersonalizing: boolean;
}

export const AIAgentFormDialog = ({
  open,
  onOpenChange,
  template,
  editingAgentId,
  isPersonalizing,
}: AIAgentFormDialogProps) => {
  const { user } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("personality");
  const [agentId, setAgentId] = useState<string | null>(editingAgentId);

  // Form state
  const [agentName, setAgentName] = useState("");
  const [personalityPrompt, setPersonalityPrompt] = useState("");
  const [behaviorRules, setBehaviorRules] = useState("");
  const [greetingMessage, setGreetingMessage] = useState("");
  const [goodbyeMessage, setGoodbyeMessage] = useState("");
  const [fallbackMessage, setFallbackMessage] = useState("");
  const [handoffKeywords, setHandoffKeywords] = useState("");
  const [responseMode, setResponseMode] = useState("text");
  const [responseDelayMin, setResponseDelayMin] = useState(3);
  const [responseDelayMax, setResponseDelayMax] = useState(8);
  const [activeHoursStart, setActiveHoursStart] = useState(8);
  const [activeHoursEnd, setActiveHoursEnd] = useState(20);
  const [maxInteractions, setMaxInteractions] = useState(15);
  const [isActive, setIsActive] = useState(false);
  const [templateType, setTemplateType] = useState<string | null>(null);

  // Load template or existing agent data
  useEffect(() => {
    if (template) {
      setAgentName(template.agentName);
      setPersonalityPrompt(template.personalityPrompt);
      setBehaviorRules(template.behaviorRules);
      setGreetingMessage(template.greetingMessage);
      setGoodbyeMessage(template.goodbyeMessage);
      setFallbackMessage(template.fallbackMessage);
      setHandoffKeywords(template.handoffKeywords.join(", "));
      setResponseMode(template.responseMode);
      setResponseDelayMin(template.responseDelayMin);
      setResponseDelayMax(template.responseDelayMax);
      setActiveHoursStart(template.activeHoursStart);
      setActiveHoursEnd(template.activeHoursEnd);
      setMaxInteractions(template.maxInteractions);
      setTemplateType(template.id);
      setIsActive(false);
      setAgentId(null);
    } else if (editingAgentId) {
      loadAgentData(editingAgentId);
    } else {
      resetForm();
    }
  }, [template, editingAgentId, open]);

  const resetForm = () => {
    setAgentName("");
    setPersonalityPrompt("");
    setBehaviorRules("");
    setGreetingMessage("");
    setGoodbyeMessage("");
    setFallbackMessage("");
    setHandoffKeywords("");
    setResponseMode("text");
    setResponseDelayMin(3);
    setResponseDelayMax(8);
    setActiveHoursStart(8);
    setActiveHoursEnd(20);
    setMaxInteractions(15);
    setIsActive(false);
    setTemplateType(null);
    setAgentId(null);
    setActiveTab("personality");
  };

  const loadAgentData = async (id: string) => {
    try {
      const { data, error } = await supabase
        .from("ai_agent_configs")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;

      setAgentId(data.id);
      setAgentName(data.agent_name);
      setPersonalityPrompt(data.personality_prompt || "");
      setBehaviorRules(data.behavior_rules || "");
      setGreetingMessage(data.greeting_message || "");
      setGoodbyeMessage(data.goodbye_message || "");
      setFallbackMessage(data.fallback_message || "");
      setHandoffKeywords(data.handoff_keywords?.join(", ") || "");
      setResponseMode(data.response_mode || "text");
      setResponseDelayMin(data.response_delay_min || 3);
      setResponseDelayMax(data.response_delay_max || 8);
      setActiveHoursStart(data.active_hours_start || 8);
      setActiveHoursEnd(data.active_hours_end || 20);
      setMaxInteractions(data.max_interactions || 15);
      setIsActive(data.is_active ?? false);
      setTemplateType(data.template_type);
    } catch (error: any) {
      toast.error("Erro ao carregar agente: " + error.message);
    }
  };

  const handleSave = async () => {
    if (!user?.id) return;
    if (!agentName.trim()) {
      toast.error("Nome do agente é obrigatório");
      return;
    }

    setIsSaving(true);
    try {
      const configData = {
        user_id: user.id,
        agent_name: agentName,
        personality_prompt: personalityPrompt,
        behavior_rules: behaviorRules,
        greeting_message: greetingMessage,
        goodbye_message: goodbyeMessage,
        fallback_message: fallbackMessage,
        handoff_keywords: handoffKeywords.split(",").map(k => k.trim()).filter(Boolean),
        response_mode: responseMode,
        response_delay_min: responseDelayMin,
        response_delay_max: responseDelayMax,
        active_hours_start: activeHoursStart,
        active_hours_end: activeHoursEnd,
        max_interactions: maxInteractions,
        is_active: isActive,
        template_type: templateType,
      };

      if (agentId) {
        const { error } = await supabase
          .from("ai_agent_configs")
          .update(configData)
          .eq("id", agentId);

        if (error) throw error;
        toast.success("Agente atualizado com sucesso!");
      } else {
        const { data, error } = await supabase
          .from("ai_agent_configs")
          .insert(configData)
          .select()
          .single();

        if (error) throw error;
        setAgentId(data.id);
        toast.success("Agente criado com sucesso!");
      }
    } catch (error: any) {
      toast.error("Erro ao salvar: " + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            {editingAgentId ? "Editar Agente de IA" : "Criar Agente de IA"}
          </DialogTitle>
        </DialogHeader>

        {isPersonalizing ? (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Personalizando template com dados da sua empresa...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Header with name and active toggle */}
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <Label htmlFor="agentName">Nome do Agente</Label>
                <Input
                  id="agentName"
                  placeholder="Ex: SDR Virtual, Assistente de Vendas..."
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Label htmlFor="isActive">Ativo</Label>
                <Switch
                  id="isActive"
                  checked={isActive}
                  onCheckedChange={setIsActive}
                />
              </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid grid-cols-5 w-full">
                <TabsTrigger value="personality" className="gap-1">
                  <Bot className="h-4 w-4" />
                  <span className="hidden sm:inline">Personalidade</span>
                </TabsTrigger>
                <TabsTrigger value="messages" className="gap-1">
                  <MessageSquare className="h-4 w-4" />
                  <span className="hidden sm:inline">Mensagens</span>
                </TabsTrigger>
                <TabsTrigger value="settings" className="gap-1">
                  <Clock className="h-4 w-4" />
                  <span className="hidden sm:inline">Configurações</span>
                </TabsTrigger>
                <TabsTrigger value="knowledge" disabled={!agentId}>
                  Base de Conhecimento
                </TabsTrigger>
                <TabsTrigger value="stages" disabled={!agentId}>
                  Etapas
                </TabsTrigger>
              </TabsList>

              <TabsContent value="personality" className="space-y-4 mt-4">
                <div>
                  <Label htmlFor="personalityPrompt">Prompt de Personalidade</Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Defina quem é o agente, como ele deve se comportar e quais são seus objetivos
                  </p>
                  <Textarea
                    id="personalityPrompt"
                    placeholder="Você é um assistente de vendas consultivo..."
                    value={personalityPrompt}
                    onChange={(e) => setPersonalityPrompt(e.target.value)}
                    className="min-h-[200px]"
                  />
                </div>

                <div>
                  <Label htmlFor="behaviorRules">Regras de Comportamento</Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Defina regras específicas que o agente deve seguir
                  </p>
                  <Textarea
                    id="behaviorRules"
                    placeholder="1. Sempre pergunte sobre o orçamento de forma sutil..."
                    value={behaviorRules}
                    onChange={(e) => setBehaviorRules(e.target.value)}
                    className="min-h-[150px]"
                  />
                </div>

                <div>
                  <Label htmlFor="handoffKeywords">Palavras para Handoff</Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Palavras que acionam a transferência para um humano (separadas por vírgula)
                  </p>
                  <Input
                    id="handoffKeywords"
                    placeholder="atendente, humano, gerente, falar com alguém..."
                    value={handoffKeywords}
                    onChange={(e) => setHandoffKeywords(e.target.value)}
                  />
                </div>
              </TabsContent>

              <TabsContent value="messages" className="space-y-4 mt-4">
                <div>
                  <Label htmlFor="greetingMessage">Mensagem de Saudação</Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Primeira mensagem enviada ao iniciar uma conversa
                  </p>
                  <Textarea
                    id="greetingMessage"
                    placeholder="Olá! Bem-vindo(a)..."
                    value={greetingMessage}
                    onChange={(e) => setGreetingMessage(e.target.value)}
                    className="min-h-[100px]"
                  />
                </div>

                <div>
                  <Label htmlFor="goodbyeMessage">Mensagem de Despedida</Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Mensagem enviada ao encerrar a conversa
                  </p>
                  <Textarea
                    id="goodbyeMessage"
                    placeholder="Foi um prazer ajudá-lo..."
                    value={goodbyeMessage}
                    onChange={(e) => setGoodbyeMessage(e.target.value)}
                    className="min-h-[100px]"
                  />
                </div>

                <div>
                  <Label htmlFor="fallbackMessage">Mensagem de Fallback</Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Mensagem quando não consegue entender o usuário
                  </p>
                  <Textarea
                    id="fallbackMessage"
                    placeholder="Desculpe, não consegui entender..."
                    value={fallbackMessage}
                    onChange={(e) => setFallbackMessage(e.target.value)}
                    className="min-h-[100px]"
                  />
                </div>
              </TabsContent>

              <TabsContent value="settings" className="space-y-6 mt-4">
                <div>
                  <Label>Modo de Resposta</Label>
                  <Select value={responseMode} onValueChange={setResponseMode}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">Apenas Texto</SelectItem>
                      <SelectItem value="audio">Apenas Áudio</SelectItem>
                      <SelectItem value="auto">Automático (baseado no input)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Delay de Resposta (segundos): {responseDelayMin}s - {responseDelayMax}s</Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Tempo de espera antes de enviar a resposta
                  </p>
                  <div className="flex gap-4 items-center mt-2">
                    <span className="text-sm w-8">{responseDelayMin}s</span>
                    <Slider
                      value={[responseDelayMin, responseDelayMax]}
                      onValueChange={([min, max]) => {
                        setResponseDelayMin(min);
                        setResponseDelayMax(max);
                      }}
                      min={1}
                      max={30}
                      step={1}
                      className="flex-1"
                    />
                    <span className="text-sm w-8">{responseDelayMax}s</span>
                  </div>
                </div>

                <div>
                  <Label>Horário de Funcionamento: {activeHoursStart}h - {activeHoursEnd}h</Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Período em que o agente responde automaticamente
                  </p>
                  <div className="flex gap-4 items-center mt-2">
                    <span className="text-sm w-10">{activeHoursStart}h</span>
                    <Slider
                      value={[activeHoursStart, activeHoursEnd]}
                      onValueChange={([start, end]) => {
                        setActiveHoursStart(start);
                        setActiveHoursEnd(end);
                      }}
                      min={0}
                      max={24}
                      step={1}
                      className="flex-1"
                    />
                    <span className="text-sm w-10">{activeHoursEnd}h</span>
                  </div>
                </div>

                <div>
                  <Label>Máximo de Interações: {maxInteractions}</Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Número máximo de mensagens antes de solicitar handoff
                  </p>
                  <Slider
                    value={[maxInteractions]}
                    onValueChange={([value]) => setMaxInteractions(value)}
                    min={5}
                    max={50}
                    step={1}
                    className="mt-2"
                  />
                </div>
              </TabsContent>

              <TabsContent value="knowledge" className="mt-4">
                {agentId ? (
                  <div className="text-center text-muted-foreground py-8">
                    Base de conhecimento disponível após salvar
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    Salve o agente primeiro para adicionar conhecimento
                  </p>
                )}
              </TabsContent>

              <TabsContent value="stages" className="mt-4">
                {agentId ? (
                  <AgentStagesTab agentConfigId={agentId} />
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    Salve o agente primeiro para configurar etapas
                  </p>
                )}
              </TabsContent>
            </Tabs>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={isSaving} className="gap-2">
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {agentId ? "Salvar Alterações" : "Criar Agente"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
