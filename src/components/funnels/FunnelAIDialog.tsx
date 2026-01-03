import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Bot, Brain, Variable, Workflow, Calendar, Loader2, ArrowLeft, Sparkles } from 'lucide-react';
import { AgentPersonalityTab } from '@/components/campaigns/agent/AgentPersonalityTab';
import { AgentKnowledgeTab } from '@/components/campaigns/agent/AgentKnowledgeTab';
import { AgentVariablesTab } from '@/components/campaigns/agent/AgentVariablesTab';
import { AgentStagesTab } from '@/components/campaigns/agent/AgentStagesTab';
import { AgentCalendarTab } from '@/components/campaigns/agent/AgentCalendarTab';
import { AgentLearningSuggestionsTab } from '@/components/campaigns/agent/AgentLearningSuggestionsTab';
import { AgentSelector } from '@/components/funnels/AgentSelector';
import { useKnowledgeItems, useAgentVariables } from '@/hooks/useAIAgentConfig';
import { useFunnelAgentConfig, useFunnelAgentConfigMutations, useAgentConfigById } from '@/hooks/useFunnelAIAgent';
import { toast } from 'sonner';

interface FunnelAIDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  funnelId: string;
  funnelName: string;
}

type ViewMode = 'select' | 'create' | 'edit';

export const FunnelAIDialog = ({
  open,
  onOpenChange,
  funnelId,
  funnelName,
}: FunnelAIDialogProps) => {
  const { data: agentConfig, isLoading, refetch } = useFunnelAgentConfig(funnelId);
  const { upsertConfig, linkAgentToFunnel, unlinkAgentFromFunnel, createAgentForFunnel } = useFunnelAgentConfigMutations();
  
  const [viewMode, setViewMode] = useState<ViewMode>('select');
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [newAgentName, setNewAgentName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Fetch selected agent config when editing
  const { data: selectedAgentConfig, isLoading: isLoadingSelected } = useAgentConfigById(
    viewMode === 'edit' ? selectedAgentId : null
  );

  // Use either the funnel's linked agent or selected agent
  const activeConfig = agentConfig || selectedAgentConfig;
  
  // Fetch knowledge and variables
  const { data: knowledgeItems = [], isLoading: knowledgeLoading } = useKnowledgeItems(activeConfig?.id || null);
  const { data: variables = [], isLoading: variablesLoading } = useAgentVariables(activeConfig?.id || null);

  // State for agent config
  const [isActive, setIsActive] = useState(false);
  const [agentName, setAgentName] = useState('Assistente');
  const [personalityPrompt, setPersonalityPrompt] = useState('');
  const [behaviorRules, setBehaviorRules] = useState('');
  const [greetingMessage, setGreetingMessage] = useState('');
  const [fallbackMessage, setFallbackMessage] = useState('Desculpe, não entendi. Poderia reformular?');
  const [goodbyeMessage, setGoodbyeMessage] = useState('');
  const [maxInteractions, setMaxInteractions] = useState(10);
  const [responseDelayMin, setResponseDelayMin] = useState(3);
  const [responseDelayMax, setResponseDelayMax] = useState(8);
  const [activeHoursStart, setActiveHoursStart] = useState(8);
  const [activeHoursEnd, setActiveHoursEnd] = useState(20);
  const [handoffKeywords, setHandoffKeywords] = useState<string[]>(['atendente', 'humano', 'pessoa']);
  const [responseMode, setResponseMode] = useState<'text' | 'audio' | 'both' | 'adaptive'>('adaptive');
  const [voiceId, setVoiceId] = useState('EXAVITQu4vr4xnSDxMaL');
  const [isSaving, setIsSaving] = useState(false);

  // Set initial view mode based on whether agent is linked
  useEffect(() => {
    if (!isLoading && open) {
      if (agentConfig) {
        setViewMode('edit');
        setSelectedAgentId(agentConfig.id);
      } else {
        setViewMode('select');
        setSelectedAgentId(null);
      }
    }
  }, [agentConfig, isLoading, open]);

  // Load existing config
  useEffect(() => {
    const config = activeConfig;
    if (config) {
      setIsActive(config.is_active ?? false);
      setAgentName(config.agent_name || 'Assistente');
      setPersonalityPrompt(config.personality_prompt || '');
      setBehaviorRules(config.behavior_rules || '');
      setGreetingMessage(config.greeting_message || '');
      setFallbackMessage(config.fallback_message || 'Desculpe, não entendi. Poderia reformular?');
      setGoodbyeMessage(config.goodbye_message || '');
      setMaxInteractions(config.max_interactions ?? 10);
      setResponseDelayMin(config.response_delay_min ?? 3);
      setResponseDelayMax(config.response_delay_max ?? 8);
      setActiveHoursStart(config.active_hours_start ?? 8);
      setActiveHoursEnd(config.active_hours_end ?? 20);
      setHandoffKeywords(config.handoff_keywords || ['atendente', 'humano', 'pessoa']);
      setResponseMode(config.response_mode || 'text');
      setVoiceId(config.voice_id || 'EXAVITQu4vr4xnSDxMaL');
    }
  }, [activeConfig]);

  const handleSelectAgent = async (agentId: string) => {
    try {
      await linkAgentToFunnel.mutateAsync({ agentId, funnelId });
      setSelectedAgentId(agentId);
      setViewMode('edit');
      refetch();
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handleCreateNew = () => {
    setNewAgentName('');
    setViewMode('create');
  };

  const handleConfirmCreate = async () => {
    if (!newAgentName.trim()) {
      toast.error('Digite um nome para o agente');
      return;
    }

    setIsCreating(true);
    try {
      const result = await createAgentForFunnel.mutateAsync({
        funnelId,
        agentName: newAgentName.trim(),
      });
      setSelectedAgentId(result.id);
      setViewMode('edit');
      refetch();
    } catch (error) {
      // Error handled by mutation
    } finally {
      setIsCreating(false);
    }
  };

  const handleUnlink = async () => {
    try {
      await unlinkAgentFromFunnel.mutateAsync(funnelId);
      setSelectedAgentId(null);
      setViewMode('select');
      refetch();
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handleSave = async () => {
    if (!activeConfig?.id) return;
    
    setIsSaving(true);
    try {
      await upsertConfig.mutateAsync({
        funnel_id: funnelId,
        is_active: isActive,
        agent_name: agentName,
        personality_prompt: personalityPrompt,
        behavior_rules: behaviorRules,
        greeting_message: greetingMessage,
        fallback_message: fallbackMessage,
        goodbye_message: goodbyeMessage,
        max_interactions: maxInteractions,
        response_delay_min: responseDelayMin,
        response_delay_max: responseDelayMax,
        active_hours_start: activeHoursStart,
        active_hours_end: activeHoursEnd,
        handoff_keywords: handoffKeywords,
        response_mode: responseMode,
        voice_id: voiceId,
      });
      toast.success('Configuração do agente salva!');
    } catch (error) {
      toast.error('Erro ao salvar configuração');
    } finally {
      setIsSaving(false);
    }
  };

  const handleBack = () => {
    setViewMode('select');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            Agente de IA - {funnelName}
          </DialogTitle>
          <DialogDescription>
            {viewMode === 'select' && 'Selecione ou crie um agente de IA para este funil.'}
            {viewMode === 'create' && 'Crie um novo agente de IA para este funil.'}
            {viewMode === 'edit' && 'Configure o agente de IA para responder automaticamente aos leads deste funil.'}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : viewMode === 'select' ? (
          <div className="flex-1 overflow-y-auto py-4">
            <AgentSelector
              funnelId={funnelId}
              currentAgentId={agentConfig?.id || null}
              onSelectAgent={handleSelectAgent}
              onCreateNew={handleCreateNew}
              onUnlink={handleUnlink}
            />
          </div>
        ) : viewMode === 'create' ? (
          <div className="flex-1 py-4 space-y-4">
            <Button variant="ghost" size="sm" onClick={handleBack} className="mb-2">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Voltar
            </Button>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-agent-name">Nome do Agente</Label>
                <Input
                  id="new-agent-name"
                  placeholder="Ex: SDR Vendas, Suporte Técnico..."
                  value={newAgentName}
                  onChange={(e) => setNewAgentName(e.target.value)}
                  autoFocus
                />
              </div>
              
              <Button 
                onClick={handleConfirmCreate} 
                disabled={isCreating || !newAgentName.trim()}
                className="w-full"
              >
                {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Criar Agente
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-2">
              <Button variant="ghost" size="sm" onClick={handleBack}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                Trocar agente
              </Button>
            </div>

            <div className="flex items-center justify-between py-3 px-4 bg-muted/30 rounded-lg mb-4">
              <div className="flex items-center gap-3">
                <Switch
                  id="ai-active"
                  checked={isActive}
                  onCheckedChange={setIsActive}
                />
                <Label htmlFor="ai-active" className="cursor-pointer">
                  {isActive ? (
                    <span className="text-primary font-medium">Agente Ativo</span>
                  ) : (
                    <span className="text-muted-foreground">Agente Desativado</span>
                  )}
                </Label>
              </div>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar Configurações
              </Button>
            </div>

            <Tabs defaultValue="personality" className="flex-1 overflow-hidden flex flex-col">
              <TabsList className="grid w-full grid-cols-6">
                <TabsTrigger value="personality" className="flex items-center gap-1">
                  <Bot className="h-4 w-4" />
                  <span className="hidden sm:inline">Personalidade</span>
                </TabsTrigger>
                <TabsTrigger value="knowledge" className="flex items-center gap-1">
                  <Brain className="h-4 w-4" />
                  <span className="hidden sm:inline">Conhecimento</span>
                </TabsTrigger>
                <TabsTrigger value="learning" className="flex items-center gap-1">
                  <Sparkles className="h-4 w-4" />
                  <span className="hidden sm:inline">Aprendizado</span>
                </TabsTrigger>
                <TabsTrigger value="variables" className="flex items-center gap-1">
                  <Variable className="h-4 w-4" />
                  <span className="hidden sm:inline">Variáveis</span>
                </TabsTrigger>
                <TabsTrigger value="stages" className="flex items-center gap-1">
                  <Workflow className="h-4 w-4" />
                  <span className="hidden sm:inline">Etapas</span>
                </TabsTrigger>
                <TabsTrigger value="calendar" className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  <span className="hidden sm:inline">Agenda</span>
                </TabsTrigger>
              </TabsList>

              <div className="flex-1 overflow-y-auto mt-4 pr-2">
                <TabsContent value="personality" className="m-0">
                  <AgentPersonalityTab
                    agentName={agentName}
                    setAgentName={setAgentName}
                    personalityPrompt={personalityPrompt}
                    setPersonalityPrompt={setPersonalityPrompt}
                    behaviorRules={behaviorRules}
                    setBehaviorRules={setBehaviorRules}
                    greetingMessage={greetingMessage}
                    setGreetingMessage={setGreetingMessage}
                    fallbackMessage={fallbackMessage}
                    setFallbackMessage={setFallbackMessage}
                    goodbyeMessage={goodbyeMessage}
                    setGoodbyeMessage={setGoodbyeMessage}
                    maxInteractions={maxInteractions}
                    setMaxInteractions={setMaxInteractions}
                    responseDelayMin={responseDelayMin}
                    setResponseDelayMin={setResponseDelayMin}
                    responseDelayMax={responseDelayMax}
                    setResponseDelayMax={setResponseDelayMax}
                    activeHoursStart={activeHoursStart}
                    setActiveHoursStart={setActiveHoursStart}
                    activeHoursEnd={activeHoursEnd}
                    setActiveHoursEnd={setActiveHoursEnd}
                    handoffKeywords={handoffKeywords}
                    setHandoffKeywords={setHandoffKeywords}
                    responseMode={responseMode}
                    setResponseMode={setResponseMode}
                    voiceId={voiceId}
                    setVoiceId={setVoiceId}
                  />
                </TabsContent>

                <TabsContent value="knowledge" className="m-0">
                  <AgentKnowledgeTab 
                    agentConfigId={activeConfig?.id || null} 
                    knowledgeItems={knowledgeItems}
                    isLoading={knowledgeLoading}
                  />
                </TabsContent>

                <TabsContent value="learning" className="m-0">
                  {activeConfig?.id && (
                    <AgentLearningSuggestionsTab agentConfigId={activeConfig.id} />
                  )}
                </TabsContent>

                <TabsContent value="variables" className="m-0">
                  <AgentVariablesTab 
                    agentConfigId={activeConfig?.id || null}
                    variables={variables}
                    isLoading={variablesLoading}
                  />
                </TabsContent>

                <TabsContent value="stages" className="m-0">
                  <AgentStagesTab agentConfigId={activeConfig?.id || null} />
                </TabsContent>

                <TabsContent value="calendar" className="m-0">
                  <AgentCalendarTab agentConfigId={activeConfig?.id || null} />
                </TabsContent>
              </div>
            </Tabs>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
