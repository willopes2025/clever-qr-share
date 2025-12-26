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
import { Bot, Brain, Variable, Workflow, Calendar, Loader2 } from 'lucide-react';
import { AgentPersonalityTab } from '@/components/campaigns/agent/AgentPersonalityTab';
import { AgentKnowledgeTab } from '@/components/campaigns/agent/AgentKnowledgeTab';
import { AgentVariablesTab } from '@/components/campaigns/agent/AgentVariablesTab';
import { AgentStagesTab } from '@/components/campaigns/agent/AgentStagesTab';
import { AgentCalendarTab } from '@/components/campaigns/agent/AgentCalendarTab';
import { useKnowledgeItems, useAgentVariables } from '@/hooks/useAIAgentConfig';
import { useFunnelAgentConfig, useFunnelAgentConfigMutations } from '@/hooks/useFunnelAIAgent';
import { toast } from 'sonner';

interface FunnelAIDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  funnelId: string;
  funnelName: string;
}

export const FunnelAIDialog = ({
  open,
  onOpenChange,
  funnelId,
  funnelName,
}: FunnelAIDialogProps) => {
  const { data: agentConfig, isLoading } = useFunnelAgentConfig(funnelId);
  const { upsertConfig } = useFunnelAgentConfigMutations();
  
  // Fetch knowledge and variables
  const { data: knowledgeItems = [], isLoading: knowledgeLoading } = useKnowledgeItems(agentConfig?.id || null);
  const { data: variables = [], isLoading: variablesLoading } = useAgentVariables(agentConfig?.id || null);

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

  // Load existing config
  useEffect(() => {
    if (agentConfig) {
      setIsActive(agentConfig.is_active ?? false);
      setAgentName(agentConfig.agent_name || 'Assistente');
      setPersonalityPrompt(agentConfig.personality_prompt || '');
      setBehaviorRules(agentConfig.behavior_rules || '');
      setGreetingMessage(agentConfig.greeting_message || '');
      setFallbackMessage(agentConfig.fallback_message || 'Desculpe, não entendi. Poderia reformular?');
      setGoodbyeMessage(agentConfig.goodbye_message || '');
      setMaxInteractions(agentConfig.max_interactions ?? 10);
      setResponseDelayMin(agentConfig.response_delay_min ?? 3);
      setResponseDelayMax(agentConfig.response_delay_max ?? 8);
      setActiveHoursStart(agentConfig.active_hours_start ?? 8);
      setActiveHoursEnd(agentConfig.active_hours_end ?? 20);
      setHandoffKeywords(agentConfig.handoff_keywords || ['atendente', 'humano', 'pessoa']);
      setResponseMode(agentConfig.response_mode || 'text');
      setVoiceId(agentConfig.voice_id || 'EXAVITQu4vr4xnSDxMaL');
    }
  }, [agentConfig]);

  const handleSave = async () => {
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            Agente de IA - {funnelName}
          </DialogTitle>
          <DialogDescription>
            Configure o agente de IA para responder automaticamente aos leads deste funil.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
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
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="personality" className="flex items-center gap-1">
                  <Bot className="h-4 w-4" />
                  <span className="hidden sm:inline">Personalidade</span>
                </TabsTrigger>
                <TabsTrigger value="knowledge" className="flex items-center gap-1">
                  <Brain className="h-4 w-4" />
                  <span className="hidden sm:inline">Conhecimento</span>
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
                    agentConfigId={agentConfig?.id || null} 
                    knowledgeItems={knowledgeItems}
                    isLoading={knowledgeLoading}
                  />
                </TabsContent>

                <TabsContent value="variables" className="m-0">
                  <AgentVariablesTab 
                    agentConfigId={agentConfig?.id || null}
                    variables={variables}
                    isLoading={variablesLoading}
                  />
                </TabsContent>

                <TabsContent value="stages" className="m-0">
                  <AgentStagesTab agentConfigId={agentConfig?.id || null} />
                </TabsContent>

                <TabsContent value="calendar" className="m-0">
                  <AgentCalendarTab agentConfigId={agentConfig?.id || null} />
                </TabsContent>
              </div>
            </Tabs>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
