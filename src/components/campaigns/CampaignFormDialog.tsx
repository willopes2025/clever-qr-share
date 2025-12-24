import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { useMessageTemplates } from '@/hooks/useMessageTemplates';
import { useBroadcastLists } from '@/hooks/useBroadcastLists';
import { Campaign } from '@/hooks/useCampaigns';
import { useAgentConfig, useKnowledgeItems, useAgentVariables, useAgentConfigMutations, useVariableMutations } from '@/hooks/useAIAgentConfig';
import { Calendar, Clock, Settings2, ChevronDown, ChevronUp, Bot, Smile, BookOpen, Variable } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AgentPersonalityTab } from './agent/AgentPersonalityTab';
import { AgentKnowledgeTab } from './agent/AgentKnowledgeTab';
import { AgentVariablesTab } from './agent/AgentVariablesTab';

interface CampaignFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaign?: Campaign | null;
  onSubmit: (data: {
    name: string;
    template_id: string | null;
    list_id: string | null;
    scheduled_at: string | null;
    message_interval_min: number;
    message_interval_max: number;
    daily_limit: number;
    allowed_start_hour: number;
    allowed_end_hour: number;
    allowed_days: string[];
    timezone: string;
    ai_enabled: boolean;
    ai_prompt: string;
    ai_knowledge_base: string;
    ai_max_interactions: number;
    ai_response_delay_min: number;
    ai_response_delay_max: number;
    ai_handoff_keywords: string[];
    ai_active_hours_start: number;
    ai_active_hours_end: number;
  }) => void;
  isLoading?: boolean;
}

const DAYS_OF_WEEK = [
  { value: 'mon', label: 'Seg' },
  { value: 'tue', label: 'Ter' },
  { value: 'wed', label: 'Qua' },
  { value: 'thu', label: 'Qui' },
  { value: 'fri', label: 'Sex' },
  { value: 'sat', label: 'Sáb' },
  { value: 'sun', label: 'Dom' },
];

const DEFAULT_HANDOFF_KEYWORDS = ['atendente', 'humano', 'pessoa', 'falar com alguém'];

export const CampaignFormDialog = ({
  open,
  onOpenChange,
  campaign,
  onSubmit,
  isLoading,
}: CampaignFormDialogProps) => {
  const [name, setName] = useState('');
  const [templateId, setTemplateId] = useState<string>('');
  const [listId, setListId] = useState<string>('');
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [intervalMin, setIntervalMin] = useState(90);
  const [intervalMax, setIntervalMax] = useState(180);
  const [dailyLimit, setDailyLimit] = useState(1000);
  const [startHour, setStartHour] = useState(8);
  const [endHour, setEndHour] = useState(20);
  const [allowedDays, setAllowedDays] = useState<string[]>(['mon', 'tue', 'wed', 'thu', 'fri']);
  const [timezone] = useState('America/Sao_Paulo');

  // AI Agent settings
  const [aiEnabled, setAiEnabled] = useState(false);
  const [agentName, setAgentName] = useState('Assistente IA');
  const [personalityPrompt, setPersonalityPrompt] = useState('');
  const [behaviorRules, setBehaviorRules] = useState('');
  const [greetingMessage, setGreetingMessage] = useState('');
  const [fallbackMessage, setFallbackMessage] = useState('Desculpe, não entendi. Pode reformular?');
  const [goodbyeMessage, setGoodbyeMessage] = useState('');
  const [aiMaxInteractions, setAiMaxInteractions] = useState(10);
  const [aiResponseDelayMin, setAiResponseDelayMin] = useState(3);
  const [aiResponseDelayMax, setAiResponseDelayMax] = useState(8);
  const [aiHandoffKeywords, setAiHandoffKeywords] = useState<string[]>(DEFAULT_HANDOFF_KEYWORDS);
  const [aiActiveHoursStart, setAiActiveHoursStart] = useState(8);
  const [aiActiveHoursEnd, setAiActiveHoursEnd] = useState(20);

  const { templates } = useMessageTemplates();
  const { lists } = useBroadcastLists();
  
  // Agent config hooks
  const { data: agentConfig } = useAgentConfig(campaign?.id || null);
  const { data: knowledgeItems = [], isLoading: knowledgeLoading } = useKnowledgeItems(agentConfig?.id || null);
  const { data: variables = [], isLoading: variablesLoading } = useAgentVariables(agentConfig?.id || null);
  const { upsertConfig } = useAgentConfigMutations();
  const { initSystemVariables } = useVariableMutations();

  const activeTemplates = templates?.filter(t => t.is_active) || [];

  useEffect(() => {
    if (campaign) {
      setName(campaign.name);
      setTemplateId(campaign.template_id || '');
      setListId(campaign.list_id || '');
      if (campaign.scheduled_at) {
        setIsScheduled(true);
        const date = new Date(campaign.scheduled_at);
        setScheduledDate(date.toISOString().split('T')[0]);
        setScheduledTime(date.toTimeString().slice(0, 5));
      } else {
        setIsScheduled(false);
        setScheduledDate('');
        setScheduledTime('');
      }
      setIntervalMin(campaign.message_interval_min ?? 90);
      setIntervalMax(campaign.message_interval_max ?? 180);
      setDailyLimit(campaign.daily_limit ?? 1000);
      setStartHour(campaign.allowed_start_hour ?? 8);
      setEndHour(campaign.allowed_end_hour ?? 20);
      setAllowedDays(campaign.allowed_days ?? ['mon', 'tue', 'wed', 'thu', 'fri']);
      setAiEnabled(campaign.ai_enabled ?? false);
    } else {
      setName('');
      setTemplateId('');
      setListId('');
      setIsScheduled(false);
      setScheduledDate('');
      setScheduledTime('');
      setIntervalMin(90);
      setIntervalMax(180);
      setDailyLimit(1000);
      setStartHour(8);
      setEndHour(20);
      setAllowedDays(['mon', 'tue', 'wed', 'thu', 'fri']);
      setAiEnabled(false);
    }
  }, [campaign, open]);

  // Load agent config when available
  useEffect(() => {
    if (agentConfig) {
      setAgentName(agentConfig.agent_name);
      setPersonalityPrompt(agentConfig.personality_prompt || '');
      setBehaviorRules(agentConfig.behavior_rules || '');
      setGreetingMessage(agentConfig.greeting_message || '');
      setFallbackMessage(agentConfig.fallback_message || 'Desculpe, não entendi. Pode reformular?');
      setGoodbyeMessage(agentConfig.goodbye_message || '');
      setAiMaxInteractions(agentConfig.max_interactions);
      setAiResponseDelayMin(agentConfig.response_delay_min);
      setAiResponseDelayMax(agentConfig.response_delay_max);
      setAiHandoffKeywords(agentConfig.handoff_keywords);
      setAiActiveHoursStart(agentConfig.active_hours_start);
      setAiActiveHoursEnd(agentConfig.active_hours_end);
    }
  }, [agentConfig]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    let scheduledAt: string | null = null;
    if (isScheduled && scheduledDate && scheduledTime) {
      scheduledAt = new Date(`${scheduledDate}T${scheduledTime}`).toISOString();
    }

    // Build prompt from personality settings
    let fullPrompt = personalityPrompt;
    if (behaviorRules) {
      fullPrompt += `\n\nRegras:\n${behaviorRules}`;
    }

    onSubmit({
      name,
      template_id: templateId || null,
      list_id: listId || null,
      scheduled_at: scheduledAt,
      message_interval_min: intervalMin,
      message_interval_max: intervalMax,
      daily_limit: dailyLimit,
      allowed_start_hour: startHour,
      allowed_end_hour: endHour,
      allowed_days: allowedDays,
      timezone,
      ai_enabled: aiEnabled,
      ai_prompt: fullPrompt,
      ai_knowledge_base: '', // Knowledge is now stored separately
      ai_max_interactions: aiMaxInteractions,
      ai_response_delay_min: aiResponseDelayMin,
      ai_response_delay_max: aiResponseDelayMax,
      ai_handoff_keywords: aiHandoffKeywords,
      ai_active_hours_start: aiActiveHoursStart,
      ai_active_hours_end: aiActiveHoursEnd,
    });

    // Save agent config if campaign exists
    if (campaign?.id && aiEnabled) {
      const configResult = await upsertConfig.mutateAsync({
        campaign_id: campaign.id,
        agent_name: agentName,
        personality_prompt: personalityPrompt,
        behavior_rules: behaviorRules,
        greeting_message: greetingMessage,
        fallback_message: fallbackMessage,
        goodbye_message: goodbyeMessage,
        max_interactions: aiMaxInteractions,
        response_delay_min: aiResponseDelayMin,
        response_delay_max: aiResponseDelayMax,
        active_hours_start: aiActiveHoursStart,
        active_hours_end: aiActiveHoursEnd,
        handoff_keywords: aiHandoffKeywords,
        is_active: true,
      });
      
      // Initialize system variables if new config
      if (configResult && !agentConfig) {
        initSystemVariables.mutate(configResult.id);
      }
    }
  };

  const toggleDay = (day: string) => {
    setAllowedDays(prev => 
      prev.includes(day) 
        ? prev.filter(d => d !== day) 
        : [...prev, day]
    );
  };

  const selectedTemplate = activeTemplates.find(t => t.id === templateId);
  const selectedList = lists?.find(l => l.id === listId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {campaign ? 'Editar Campanha' : 'Nova Campanha'}
          </DialogTitle>
          <DialogDescription>
            {campaign ? 'Edite as configurações da sua campanha.' : 'Configure sua nova campanha de mensagens em massa.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name">Nome da Campanha</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Black Friday 2024"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Template de Mensagem</Label>
            <Select value={templateId} onValueChange={setTemplateId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um template" />
              </SelectTrigger>
              <SelectContent>
                {activeTemplates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedTemplate && (
              <div className="p-3 bg-muted rounded-lg text-sm">
                <p className="text-muted-foreground line-clamp-3">{selectedTemplate.content}</p>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Lista de Transmissão</Label>
            <Select value={listId} onValueChange={setListId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma lista" />
              </SelectTrigger>
              <SelectContent>
                {lists?.map((list) => (
                  <SelectItem key={list.id} value={list.id}>
                    {list.name} ({list.contact_count} contatos)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedList && (
              <p className="text-sm text-muted-foreground">
                {selectedList.contact_count} contatos serão notificados
              </p>
            )}
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Agendar Envio</Label>
                <p className="text-sm text-muted-foreground">Defina data e hora para envio automático</p>
              </div>
              <Switch checked={isScheduled} onCheckedChange={setIsScheduled} />
            </div>

            {isScheduled && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="date" className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Data
                  </Label>
                  <Input
                    id="date"
                    type="date"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    required={isScheduled}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="time" className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Hora
                  </Label>
                  <Input
                    id="time"
                    type="time"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    required={isScheduled}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Advanced Sending Settings */}
          <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
            <CollapsibleTrigger asChild>
              <Button type="button" variant="outline" className="w-full justify-between">
                <span className="flex items-center gap-2">
                  <Settings2 className="h-4 w-4" />
                  Configurações de Envio
                </span>
                {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Intervalo Mínimo (seg)</Label>
                  <Input type="number" min={1} value={intervalMin} onChange={(e) => setIntervalMin(parseInt(e.target.value) || 1)} />
                </div>
                <div className="space-y-2">
                  <Label>Intervalo Máximo (seg)</Label>
                  <Input type="number" min={1} value={intervalMax} onChange={(e) => setIntervalMax(parseInt(e.target.value) || 1)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Limite Diário de Mensagens</Label>
                <Input type="number" min={1} value={dailyLimit} onChange={(e) => setDailyLimit(parseInt(e.target.value) || 1)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Hora Início</Label>
                  <Select value={startHour.toString()} onValueChange={(v) => setStartHour(parseInt(v))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 24 }, (_, i) => (
                        <SelectItem key={i} value={i.toString()}>{i.toString().padStart(2, '0')}:00</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Hora Fim</Label>
                  <Select value={endHour.toString()} onValueChange={(v) => setEndHour(parseInt(v))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 24 }, (_, i) => (
                        <SelectItem key={i} value={i.toString()}>{i.toString().padStart(2, '0')}:00</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Dias Permitidos</Label>
                <div className="flex flex-wrap gap-2">
                  {DAYS_OF_WEEK.map((day) => (
                    <div key={day.value} className="flex items-center space-x-2">
                      <Checkbox id={day.value} checked={allowedDays.includes(day.value)} onCheckedChange={() => toggleDay(day.value)} />
                      <Label htmlFor={day.value} className="text-sm cursor-pointer">{day.label}</Label>
                    </div>
                  ))}
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* AI Agent Settings */}
          <Collapsible>
            <CollapsibleTrigger asChild>
              <Button type="button" variant="outline" className="w-full justify-between">
                <span className="flex items-center gap-2">
                  <Bot className="h-4 w-4" />
                  Agente de IA
                  {aiEnabled && <span className="ml-2 px-2 py-0.5 bg-primary/20 text-primary text-xs rounded-full">Ativo</span>}
                </span>
                <ChevronDown className="h-4 w-4" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 pt-4">
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                <div className="space-y-0.5">
                  <Label className="font-medium">Ativar Agente de IA</Label>
                  <p className="text-sm text-muted-foreground">Responde automaticamente às mensagens dos contatos</p>
                </div>
                <Switch checked={aiEnabled} onCheckedChange={setAiEnabled} />
              </div>

              {aiEnabled && (
                <Tabs defaultValue="personality" className="w-full">
                  <TabsList className="w-full grid grid-cols-3">
                    <TabsTrigger value="personality" className="gap-1.5">
                      <Smile className="h-3.5 w-3.5" />
                      Personalidade
                    </TabsTrigger>
                    <TabsTrigger value="knowledge" className="gap-1.5">
                      <BookOpen className="h-3.5 w-3.5" />
                      Conhecimento
                    </TabsTrigger>
                    <TabsTrigger value="variables" className="gap-1.5">
                      <Variable className="h-3.5 w-3.5" />
                      Variáveis
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="personality" className="mt-4">
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
                      maxInteractions={aiMaxInteractions}
                      setMaxInteractions={setAiMaxInteractions}
                      responseDelayMin={aiResponseDelayMin}
                      setResponseDelayMin={setAiResponseDelayMin}
                      responseDelayMax={aiResponseDelayMax}
                      setResponseDelayMax={setAiResponseDelayMax}
                      activeHoursStart={aiActiveHoursStart}
                      setActiveHoursStart={setAiActiveHoursStart}
                      activeHoursEnd={aiActiveHoursEnd}
                      setActiveHoursEnd={setAiActiveHoursEnd}
                      handoffKeywords={aiHandoffKeywords}
                      setHandoffKeywords={setAiHandoffKeywords}
                    />
                  </TabsContent>

                  <TabsContent value="knowledge" className="mt-4">
                    <AgentKnowledgeTab
                      agentConfigId={agentConfig?.id || null}
                      knowledgeItems={knowledgeItems}
                      isLoading={knowledgeLoading}
                    />
                  </TabsContent>

                  <TabsContent value="variables" className="mt-4">
                    <AgentVariablesTab
                      agentConfigId={agentConfig?.id || null}
                      variables={variables}
                      isLoading={variablesLoading}
                    />
                  </TabsContent>
                </Tabs>
              )}
            </CollapsibleContent>
          </Collapsible>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading || !name}>
              {campaign ? 'Salvar' : 'Criar Campanha'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
