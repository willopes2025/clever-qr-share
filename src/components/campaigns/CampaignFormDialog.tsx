import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { useMessageTemplates } from '@/hooks/useMessageTemplates';
import { useBroadcastLists } from '@/hooks/useBroadcastLists';
import { Campaign } from '@/hooks/useCampaigns';
import { Calendar, Clock, Settings2, ChevronDown, ChevronUp, Bot, MessageSquare, Zap } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

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
    // AI settings
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
  
  // Sending settings
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
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiKnowledgeBase, setAiKnowledgeBase] = useState('');
  const [aiMaxInteractions, setAiMaxInteractions] = useState(10);
  const [aiResponseDelayMin, setAiResponseDelayMin] = useState(3);
  const [aiResponseDelayMax, setAiResponseDelayMax] = useState(8);
  const [aiHandoffKeywords, setAiHandoffKeywords] = useState<string[]>(DEFAULT_HANDOFF_KEYWORDS);
  const [aiActiveHoursStart, setAiActiveHoursStart] = useState(8);
  const [aiActiveHoursEnd, setAiActiveHoursEnd] = useState(20);
  const [newKeyword, setNewKeyword] = useState('');

  const { templates } = useMessageTemplates();
  const { lists } = useBroadcastLists();

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
      // Load campaign-specific settings
      setIntervalMin(campaign.message_interval_min ?? 90);
      setIntervalMax(campaign.message_interval_max ?? 180);
      setDailyLimit(campaign.daily_limit ?? 1000);
      setStartHour(campaign.allowed_start_hour ?? 8);
      setEndHour(campaign.allowed_end_hour ?? 20);
      setAllowedDays(campaign.allowed_days ?? ['mon', 'tue', 'wed', 'thu', 'fri']);
      // Load AI settings
      setAiEnabled(campaign.ai_enabled ?? false);
      setAiPrompt(campaign.ai_prompt ?? '');
      setAiKnowledgeBase(campaign.ai_knowledge_base ?? '');
      setAiMaxInteractions(campaign.ai_max_interactions ?? 10);
      setAiResponseDelayMin(campaign.ai_response_delay_min ?? 3);
      setAiResponseDelayMax(campaign.ai_response_delay_max ?? 8);
      setAiHandoffKeywords(campaign.ai_handoff_keywords ?? DEFAULT_HANDOFF_KEYWORDS);
      setAiActiveHoursStart(campaign.ai_active_hours_start ?? 8);
      setAiActiveHoursEnd(campaign.ai_active_hours_end ?? 20);
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
      // Reset AI settings
      setAiEnabled(false);
      setAiPrompt('');
      setAiKnowledgeBase('');
      setAiMaxInteractions(10);
      setAiResponseDelayMin(3);
      setAiResponseDelayMax(8);
      setAiHandoffKeywords(DEFAULT_HANDOFF_KEYWORDS);
      setAiActiveHoursStart(8);
      setAiActiveHoursEnd(20);
    }
  }, [campaign, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    let scheduledAt: string | null = null;
    if (isScheduled && scheduledDate && scheduledTime) {
      scheduledAt = new Date(`${scheduledDate}T${scheduledTime}`).toISOString();
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
      // AI settings
      ai_enabled: aiEnabled,
      ai_prompt: aiPrompt,
      ai_knowledge_base: aiKnowledgeBase,
      ai_max_interactions: aiMaxInteractions,
      ai_response_delay_min: aiResponseDelayMin,
      ai_response_delay_max: aiResponseDelayMax,
      ai_handoff_keywords: aiHandoffKeywords,
      ai_active_hours_start: aiActiveHoursStart,
      ai_active_hours_end: aiActiveHoursEnd,
    });
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
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
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
                <p className="text-muted-foreground line-clamp-3">
                  {selectedTemplate.content}
                </p>
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
                <p className="text-sm text-muted-foreground">
                  Defina data e hora para envio automático
                </p>
              </div>
              <Switch
                checked={isScheduled}
                onCheckedChange={setIsScheduled}
              />
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
              {/* Message Intervals */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="intervalMin">Intervalo Mínimo (seg)</Label>
                  <Input
                    id="intervalMin"
                    type="number"
                    min={1}
                    value={intervalMin}
                    onChange={(e) => setIntervalMin(parseInt(e.target.value) || 1)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="intervalMax">Intervalo Máximo (seg)</Label>
                  <Input
                    id="intervalMax"
                    type="number"
                    min={1}
                    value={intervalMax}
                    onChange={(e) => setIntervalMax(parseInt(e.target.value) || 1)}
                  />
                </div>
              </div>

              {/* Daily Limit */}
              <div className="space-y-2">
                <Label htmlFor="dailyLimit">Limite Diário de Mensagens</Label>
                <Input
                  id="dailyLimit"
                  type="number"
                  min={1}
                  value={dailyLimit}
                  onChange={(e) => setDailyLimit(parseInt(e.target.value) || 1)}
                />
              </div>

              {/* Allowed Hours */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startHour">Hora Início</Label>
                  <Select value={startHour.toString()} onValueChange={(v) => setStartHour(parseInt(v))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 24 }, (_, i) => (
                        <SelectItem key={i} value={i.toString()}>
                          {i.toString().padStart(2, '0')}:00
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endHour">Hora Fim</Label>
                  <Select value={endHour.toString()} onValueChange={(v) => setEndHour(parseInt(v))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 24 }, (_, i) => (
                        <SelectItem key={i} value={i.toString()}>
                          {i.toString().padStart(2, '0')}:00
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Allowed Days */}
              <div className="space-y-2">
                <Label>Dias Permitidos</Label>
                <div className="flex flex-wrap gap-2">
                  {DAYS_OF_WEEK.map((day) => (
                    <div
                      key={day.value}
                      className="flex items-center space-x-2"
                    >
                      <Checkbox
                        id={day.value}
                        checked={allowedDays.includes(day.value)}
                        onCheckedChange={() => toggleDay(day.value)}
                      />
                      <Label htmlFor={day.value} className="text-sm cursor-pointer">
                        {day.label}
                      </Label>
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
                  {aiEnabled && (
                    <span className="ml-2 px-2 py-0.5 bg-primary/20 text-primary text-xs rounded-full">
                      Ativo
                    </span>
                  )}
                </span>
                <ChevronDown className="h-4 w-4" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 pt-4">
              {/* Enable AI Toggle */}
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-primary" />
                    <Label className="font-medium">Ativar Agente de IA</Label>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Responde automaticamente às mensagens dos contatos
                  </p>
                </div>
                <Switch
                  checked={aiEnabled}
                  onCheckedChange={setAiEnabled}
                />
              </div>

              {aiEnabled && (
                <Tabs defaultValue="prompt" className="w-full">
                  <TabsList className="w-full">
                    <TabsTrigger value="prompt" className="flex-1 gap-1.5">
                      <MessageSquare className="h-3.5 w-3.5" />
                      Prompt
                    </TabsTrigger>
                    <TabsTrigger value="config" className="flex-1 gap-1.5">
                      <Settings2 className="h-3.5 w-3.5" />
                      Configurações
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="prompt" className="space-y-4 mt-4">
                    {/* AI Prompt */}
                    <div className="space-y-2">
                      <Label>Prompt do Agente</Label>
                      <Textarea
                        value={aiPrompt}
                        onChange={(e) => setAiPrompt(e.target.value)}
                        placeholder="Ex: Você é um assistente de vendas amigável. Responda perguntas sobre nossos produtos e ajude os clientes a fazer pedidos..."
                        rows={4}
                        className="resize-none"
                      />
                      <p className="text-xs text-muted-foreground">
                        Defina como o agente deve se comportar e responder
                      </p>
                    </div>

                    {/* Knowledge Base */}
                    <div className="space-y-2">
                      <Label>Base de Conhecimento</Label>
                      <Textarea
                        value={aiKnowledgeBase}
                        onChange={(e) => setAiKnowledgeBase(e.target.value)}
                        placeholder="Informações sobre produtos, preços, políticas de entrega, horários de funcionamento..."
                        rows={4}
                        className="resize-none"
                      />
                      <p className="text-xs text-muted-foreground">
                        Informações que o agente pode usar para responder
                      </p>
                    </div>
                  </TabsContent>

                  <TabsContent value="config" className="space-y-4 mt-4">
                    {/* Response Delay */}
                    <div className="space-y-2">
                      <Label>Tempo de Resposta (segundos)</Label>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Mínimo</Label>
                          <Input
                            type="number"
                            min={1}
                            max={60}
                            value={aiResponseDelayMin}
                            onChange={(e) => setAiResponseDelayMin(parseInt(e.target.value) || 3)}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Máximo</Label>
                          <Input
                            type="number"
                            min={1}
                            max={120}
                            value={aiResponseDelayMax}
                            onChange={(e) => setAiResponseDelayMax(parseInt(e.target.value) || 8)}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Active Hours */}
                    <div className="space-y-2">
                      <Label>Horário de Atendimento</Label>
                      <div className="grid grid-cols-2 gap-4">
                        <Select value={aiActiveHoursStart.toString()} onValueChange={(v) => setAiActiveHoursStart(parseInt(v))}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: 24 }, (_, i) => (
                              <SelectItem key={i} value={i.toString()}>
                                {i.toString().padStart(2, '0')}:00
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select value={aiActiveHoursEnd.toString()} onValueChange={(v) => setAiActiveHoursEnd(parseInt(v))}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: 24 }, (_, i) => (
                              <SelectItem key={i} value={i.toString()}>
                                {i.toString().padStart(2, '0')}:00
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Max Interactions */}
                    <div className="space-y-2">
                      <Label>Máximo de Interações por Conversa</Label>
                      <Input
                        type="number"
                        min={1}
                        max={100}
                        value={aiMaxInteractions}
                        onChange={(e) => setAiMaxInteractions(parseInt(e.target.value) || 10)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Após atingir o limite, a conversa é passada para atendimento humano
                      </p>
                    </div>

                    {/* Handoff Keywords */}
                    <div className="space-y-2">
                      <Label>Palavras-chave para Handoff</Label>
                      <div className="flex flex-wrap gap-2 mb-2">
                        {aiHandoffKeywords.map((keyword) => (
                          <span
                            key={keyword}
                            className="px-2 py-1 bg-muted text-sm rounded-full flex items-center gap-1"
                          >
                            {keyword}
                            <button
                              type="button"
                              onClick={() => setAiHandoffKeywords(prev => prev.filter(k => k !== keyword))}
                              className="hover:text-destructive"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <Input
                          value={newKeyword}
                          onChange={(e) => setNewKeyword(e.target.value)}
                          placeholder="Nova palavra-chave"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && newKeyword.trim()) {
                              e.preventDefault();
                              if (!aiHandoffKeywords.includes(newKeyword.trim().toLowerCase())) {
                                setAiHandoffKeywords(prev => [...prev, newKeyword.trim().toLowerCase()]);
                              }
                              setNewKeyword('');
                            }
                          }}
                        />
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => {
                            if (newKeyword.trim() && !aiHandoffKeywords.includes(newKeyword.trim().toLowerCase())) {
                              setAiHandoffKeywords(prev => [...prev, newKeyword.trim().toLowerCase()]);
                              setNewKeyword('');
                            }
                          }}
                        >
                          Adicionar
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Quando o contato mencionar essas palavras, a IA pausa e solicita atendimento humano
                      </p>
                    </div>
                  </TabsContent>
                </Tabs>
              )}
            </CollapsibleContent>
          </Collapsible>

          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
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