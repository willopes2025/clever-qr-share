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
import { Loader2, Save, Bot, MessageSquare, Clock, Building2, ArrowRight, SkipForward, Phone, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { toast } from "sonner";
import { AIAgentTemplate } from "@/data/ai-agent-templates";
import { AgentStagesTab } from "@/components/campaigns/agent/AgentStagesTab";

interface AIAgentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: AIAgentTemplate | null;
  editingAgentId: string | null;
}

type DialogStep = "company_context" | "agent_form";

export const AIAgentFormDialog = ({
  open,
  onOpenChange,
  template,
  editingAgentId,
}: AIAgentFormDialogProps) => {
  const { user } = useAuth();
  const { organization } = useOrganization();
  const [isSaving, setIsSaving] = useState(false);
  const [isPersonalizing, setIsPersonalizing] = useState(false);
  const [activeTab, setActiveTab] = useState("personality");
  const [agentId, setAgentId] = useState<string | null>(editingAgentId);
  
  // Step management
  const [currentStep, setCurrentStep] = useState<DialogStep>("agent_form");
  const [companyContext, setCompanyContext] = useState("");
  const [isSavingContext, setIsSavingContext] = useState(false);
  const [pendingTemplate, setPendingTemplate] = useState<AIAgentTemplate | null>(null);

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
  const [elevenlabsAgentId, setElevenlabsAgentId] = useState("");

  // Load company context when dialog opens
  useEffect(() => {
    if (open && organization?.id) {
      loadCompanyContext();
    }
  }, [open, organization?.id]);

  // Determine initial step when dialog opens
  useEffect(() => {
    if (open) {
      if (editingAgentId) {
        // Editing existing agent - go directly to form
        setCurrentStep("agent_form");
        loadAgentData(editingAgentId);
      } else if (template) {
        // Creating from template - show company context step first
        setPendingTemplate(template);
        setCurrentStep("company_context");
      } else {
        // Creating from scratch - show company context step first
        setPendingTemplate(null);
        setCurrentStep("company_context");
      }
    }
  }, [open, template, editingAgentId]);

  const loadCompanyContext = async () => {
    if (!organization?.id) return;
    
    try {
      const { data, error } = await supabase
        .from("organizations")
        .select("company_context")
        .eq("id", organization.id)
        .single();

      if (!error && data?.company_context) {
        setCompanyContext(data.company_context);
      }
    } catch (error) {
      console.error("Error loading company context:", error);
    }
  };

  const handleSaveContextAndContinue = async () => {
    if (!organization?.id) {
      toast.error("Organização não encontrada");
      return;
    }

    setIsSavingContext(true);
    try {
      // Save company context to organization
      const { error } = await supabase
        .from("organizations")
        .update({ company_context: companyContext })
        .eq("id", organization.id);

      if (error) throw error;

      // Now personalize the template if we have one
      if (pendingTemplate && companyContext.trim()) {
        setIsPersonalizing(true);
        try {
          const { data, error: funcError } = await supabase.functions.invoke("personalize-agent-template", {
            body: {
              templateId: pendingTemplate.id,
              companyContext: companyContext,
            },
          });

          if (funcError) throw funcError;

          if (data && !data.error) {
            // Normalize data types
            const behaviorRulesStr = Array.isArray(data.behaviorRules) 
              ? data.behaviorRules.join('\n') 
              : (typeof data.behaviorRules === 'string' ? data.behaviorRules : pendingTemplate.behaviorRules);
            
            const handoffKeywordsArr = Array.isArray(data.handoffKeywords)
              ? data.handoffKeywords
              : (typeof data.handoffKeywords === 'string' 
                  ? data.handoffKeywords.split(',').map((k: string) => k.trim()).filter(Boolean)
                  : pendingTemplate.handoffKeywords);

            // Load personalized data
            setAgentName(data.agentName || pendingTemplate.agentName);
            setPersonalityPrompt(data.personalityPrompt || pendingTemplate.personalityPrompt);
            setBehaviorRules(behaviorRulesStr);
            setGreetingMessage(data.greetingMessage || pendingTemplate.greetingMessage);
            setGoodbyeMessage(data.goodbyeMessage || pendingTemplate.goodbyeMessage);
            setFallbackMessage(data.fallbackMessage || pendingTemplate.fallbackMessage);
            setHandoffKeywords(handoffKeywordsArr.join(", "));
            setResponseMode(pendingTemplate.responseMode);
            setResponseDelayMin(pendingTemplate.responseDelayMin);
            setResponseDelayMax(pendingTemplate.responseDelayMax);
            setActiveHoursStart(pendingTemplate.activeHoursStart);
            setActiveHoursEnd(pendingTemplate.activeHoursEnd);
            setMaxInteractions(pendingTemplate.maxInteractions);
            setTemplateType(pendingTemplate.id);
            toast.success("Template personalizado com sucesso!");
          } else {
            throw new Error(data?.error || "Erro ao personalizar template");
          }
        } catch (error: any) {
          console.error("Error personalizing template:", error);
          toast.error("Erro ao personalizar. Usando template padrão.");
          loadTemplateData(pendingTemplate);
        } finally {
          setIsPersonalizing(false);
        }
      } else if (pendingTemplate) {
        // No company context, just load template defaults
        loadTemplateData(pendingTemplate);
      } else {
        // Creating from scratch
        resetForm();
      }

      setCurrentStep("agent_form");
    } catch (error: any) {
      toast.error("Erro ao salvar contexto: " + error.message);
    } finally {
      setIsSavingContext(false);
    }
  };

  const handleSkipContext = () => {
    if (pendingTemplate) {
      loadTemplateData(pendingTemplate);
    } else {
      resetForm();
    }
    setCurrentStep("agent_form");
  };

  const loadTemplateData = (tmpl: AIAgentTemplate) => {
    setAgentName(tmpl.agentName);
    setPersonalityPrompt(tmpl.personalityPrompt);
    setBehaviorRules(tmpl.behaviorRules);
    setGreetingMessage(tmpl.greetingMessage);
    setGoodbyeMessage(tmpl.goodbyeMessage);
    setFallbackMessage(tmpl.fallbackMessage);
    setHandoffKeywords(tmpl.handoffKeywords.join(", "));
    setResponseMode(tmpl.responseMode);
    setResponseDelayMin(tmpl.responseDelayMin);
    setResponseDelayMax(tmpl.responseDelayMax);
    setActiveHoursStart(tmpl.activeHoursStart);
    setActiveHoursEnd(tmpl.activeHoursEnd);
    setMaxInteractions(tmpl.maxInteractions);
    setTemplateType(tmpl.id);
    setIsActive(false);
    setAgentId(null);
  };

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
    setElevenlabsAgentId("");
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
      // Normalize response_mode - convert 'auto' to 'adaptive' for DB compatibility
      const normalizedMode = data.response_mode === 'auto' ? 'adaptive' : (data.response_mode || 'text');
      setResponseMode(normalizedMode);
      setResponseDelayMin(data.response_delay_min || 3);
      setResponseDelayMax(data.response_delay_max || 8);
      setActiveHoursStart(data.active_hours_start || 8);
      setActiveHoursEnd(data.active_hours_end || 20);
      setMaxInteractions(data.max_interactions || 15);
      setIsActive(data.is_active ?? false);
      setTemplateType(data.template_type);
      setElevenlabsAgentId(data.elevenlabs_agent_id || "");
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
      // Normalize response_mode before saving - convert 'auto' to 'adaptive'
      const normalizedResponseMode = responseMode === 'auto' ? 'adaptive' : responseMode;
      
      const configData = {
        user_id: user.id,
        agent_name: agentName,
        personality_prompt: personalityPrompt,
        behavior_rules: behaviorRules,
        greeting_message: greetingMessage,
        goodbye_message: goodbyeMessage,
        fallback_message: fallbackMessage,
        handoff_keywords: handoffKeywords.split(",").map(k => k.trim()).filter(Boolean),
        response_mode: normalizedResponseMode,
        response_delay_min: responseDelayMin,
        response_delay_max: responseDelayMax,
        active_hours_start: activeHoursStart,
        active_hours_end: activeHoursEnd,
        max_interactions: maxInteractions,
        is_active: isActive,
        template_type: templateType,
        elevenlabs_agent_id: elevenlabsAgentId.trim() || null,
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

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      // Reset state when closing
      setCurrentStep("agent_form");
      setPendingTemplate(null);
      resetForm();
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Company Context Step */}
        {currentStep === "company_context" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                Sobre sua Empresa
              </DialogTitle>
            </DialogHeader>

            {isPersonalizing ? (
              <div className="flex flex-col items-center justify-center py-12 gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-muted-foreground">Personalizando template com dados da sua empresa...</p>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Descreva sua empresa para personalizar automaticamente o agente de IA. 
                  Quanto mais detalhes você fornecer, melhor será a personalização.
                </p>

                <div>
                  <Label htmlFor="companyContext">Descrição da Empresa</Label>
                  <Textarea
                    id="companyContext"
                    placeholder="Exemplo: Somos a TechSolutions, uma empresa de tecnologia focada em soluções de automação para pequenas e médias empresas. Nossos principais produtos incluem sistemas de gestão, CRMs e ferramentas de marketing digital. Atendemos principalmente empresas dos setores de varejo, serviços e indústria."
                    value={companyContext}
                    onChange={(e) => setCompanyContext(e.target.value)}
                    className="min-h-[150px] mt-2"
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    Inclua: nome da empresa, setor de atuação, produtos/serviços, público-alvo, diferenciais, tom de voz desejado
                  </p>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button
                    variant="ghost"
                    onClick={handleSkipContext}
                    disabled={isSavingContext}
                  >
                    <SkipForward className="h-4 w-4 mr-2" />
                    Pular
                  </Button>
                  <Button
                    onClick={handleSaveContextAndContinue}
                    disabled={isSavingContext}
                  >
                    {isSavingContext ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <ArrowRight className="h-4 w-4 mr-2" />
                    )}
                    {companyContext.trim() ? "Salvar e Personalizar" : "Continuar"}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Agent Form Step */}
        {currentStep === "agent_form" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-primary" />
                {editingAgentId ? "Editar Agente de IA" : "Criar Agente de IA"}
              </DialogTitle>
            </DialogHeader>

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
                  {/* ElevenLabs Agent ID for Voice Calls */}
                  <div className="p-4 rounded-lg border bg-muted/30">
                    <div className="flex items-center gap-2 mb-2">
                      <Phone className="h-4 w-4 text-primary" />
                      <Label htmlFor="elevenlabsAgentId" className="font-medium">ElevenLabs Agent ID (para ligações com IA)</Label>
                    </div>
                    <Input
                      id="elevenlabsAgentId"
                      placeholder="agent_xxxxxxxxxxxx"
                      value={elevenlabsAgentId}
                      onChange={(e) => setElevenlabsAgentId(e.target.value)}
                      className="mt-1"
                    />
                    <p className="text-xs text-muted-foreground mt-2">
                      Crie um agente de voz no ElevenLabs e cole o ID aqui para habilitar ligações com IA.
                    </p>
                    <a 
                      href="https://elevenlabs.io/conversational-ai" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
                    >
                      Criar agente no ElevenLabs <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>

                  <div>
                    <Label>Modo de Resposta</Label>
                    <Select value={responseMode} onValueChange={setResponseMode}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="text">Apenas Texto</SelectItem>
                        <SelectItem value="audio">Apenas Áudio</SelectItem>
                        <SelectItem value="both">Texto e Áudio</SelectItem>
                        <SelectItem value="adaptive">Automático (baseado no input)</SelectItem>
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
                <Button variant="outline" onClick={() => handleClose(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSave} disabled={isSaving}>
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Salvar
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
