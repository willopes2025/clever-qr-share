import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Settings2, ChevronDown, ChevronUp, Bot, UserX, Tag, Plus, Loader2, Send, Sparkles, Cloud } from 'lucide-react';
import { useMessageTemplates } from '@/hooks/useMessageTemplates';
import { useMetaTemplates } from '@/hooks/useMetaTemplates';
import { useMetaWhatsAppNumbers } from '@/hooks/useMetaWhatsAppNumbers';
import { Phone } from 'lucide-react';
import { useContacts } from '@/hooks/useContacts';
import { useAuth } from '@/hooks/useAuth';
import { useCampaignMutations, type SendingMode as CampaignSendingMode } from '@/hooks/useCampaigns';
import { useAgentConfigMutations } from '@/hooks/useAIAgentConfig';
import { AgentPicker } from '@/components/shared/AgentPicker';
import { SelectInstanceDialog } from '@/components/campaigns/SelectInstanceDialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';

const DAYS_OF_WEEK = [
  { value: 'mon', label: 'Seg' },
  { value: 'tue', label: 'Ter' },
  { value: 'wed', label: 'Qua' },
  { value: 'thu', label: 'Qui' },
  { value: 'fri', label: 'Sex' },
  { value: 'sat', label: 'Sáb' },
  { value: 'sun', label: 'Dom' },
];

interface OpportunityBroadcastDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedContacts: { contactId: string; contactName: string }[];
  selectedDealIds: string[];
  funnelId: string;
  funnelName: string;
}

export const OpportunityBroadcastDialog = ({
  open,
  onOpenChange,
  selectedContacts,
  selectedDealIds,
  funnelId,
  funnelName,
}: OpportunityBroadcastDialogProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { templates } = useMessageTemplates();
  const { templates: metaTemplates } = useMetaTemplates();
  const { metaNumbers } = useMetaWhatsAppNumbers();
  const activeMetaNumbers = metaNumbers?.filter(n => n.is_active && n.status === 'connected') || [];
  const { createTag } = useContacts();
  const { createCampaign, startCampaign } = useCampaignMutations();
  const { linkConfigToCampaign } = useAgentConfigMutations();

  // Message mode
  const [messageMode, setMessageMode] = useState<'template' | 'meta_template' | 'ai'>('template');

  // Template mode state
  const [templateId, setTemplateId] = useState('');

  // AI mode state
  const [aiPrompt, setAiPrompt] = useState('');

  // Shared state
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [intervalMin, setIntervalMin] = useState(90);
  const [intervalMax, setIntervalMax] = useState(180);
  const [dailyLimit, setDailyLimit] = useState(1000);
  const [startHour, setStartHour] = useState(8);
  const [endHour, setEndHour] = useState(20);
  const [allowedDays, setAllowedDays] = useState<string[]>(['mon', 'tue', 'wed', 'thu', 'fri']);

  // Duplicate control
  const [skipAlreadySent, setSkipAlreadySent] = useState(true);
  const [skipMode, setSkipMode] = useState<'same_campaign' | 'same_template' | 'same_list' | 'any_campaign' | 'has_tag'>('same_template');
  const [skipDaysPeriod, setSkipDaysPeriod] = useState(30);
  const [skipTagId, setSkipTagId] = useState<string | null>(null);

  // Tag on delivery
  const [enableTagOnDelivery, setEnableTagOnDelivery] = useState(false);
  const [tagOnDeliveryId, setTagOnDeliveryId] = useState<string | null>(null);
  const [showCreateTag, setShowCreateTag] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#3B82F6');

  // Batch sending
  const [batchEnabled, setBatchEnabled] = useState(false);
  const [batchSize, setBatchSize] = useState(5);
  const [batchPauseMinutes, setBatchPauseMinutes] = useState(30);

  // AI Agent (only for template mode)
  const [aiEnabled, setAiEnabled] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  // Instance selection
  const [showInstanceDialog, setShowInstanceDialog] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [pendingCampaignId, setPendingCampaignId] = useState<string | null>(null);

  // For AI mode - we need instance selection before generating
  const [pendingAiInstanceConfig, setPendingAiInstanceConfig] = useState<{ instanceIds: string[]; sendingMode: string } | null>(null);

  // Meta phone number selection
  const [selectedMetaPhoneNumberId, setSelectedMetaPhoneNumberId] = useState('');

  const { data: tags } = useQuery({
    queryKey: ['tags', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('tags').select('*').order('name');
      return data || [];
    },
    enabled: !!user?.id,
  });

  const activeTemplates = templates?.filter(t => t.is_active) || [];
  const selectedTemplate = activeTemplates.find(t => t.id === templateId);
  const approvedMetaTemplates = metaTemplates?.filter(t => t.status === 'approved') || [];
  const selectedMetaTemplate = approvedMetaTemplates.find(t => t.id === templateId);

  const toggleDay = (day: string) => {
    setAllowedDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;
    try {
      const newTag = await createTag.mutateAsync({ name: newTagName.trim(), color: newTagColor });
      setTagOnDeliveryId(newTag.id);
      setShowCreateTag(false);
      setNewTagName('');
    } catch (error) {
      console.error('Failed to create tag:', error);
    }
  };

  const isSubmitDisabled = messageMode === 'meta_template' 
    ? (!templateId || !selectedMetaPhoneNumberId) 
    : messageMode === 'template' 
      ? !templateId 
      : !aiPrompt.trim();

  const handleSubmit = async () => {
    if (messageMode === 'ai') {
      // For AI mode, open instance dialog first, then generate
      setShowInstanceDialog(true);
      return;
    }

    // Template/Meta Template mode
    if (!templateId || !user?.id) return;
    setIsProcessing(true);

    const isMetaMode = messageMode === 'meta_template';

    try {
      const { data: list, error: listError } = await supabase
        .from('broadcast_lists')
        .insert({
          user_id: user.id,
          name: `Oportunidades - ${funnelName} - ${new Date().toLocaleString('pt-BR')}`,
          description: `Lista temporária criada a partir de ${selectedContacts.length} oportunidades selecionadas`,
          type: 'manual' as const,
        })
        .select()
        .single();

      if (listError) throw listError;

      const contactEntries = selectedContacts.map(c => ({
        list_id: list.id,
        contact_id: c.contactId,
      }));

      const { error: contactsError } = await supabase
        .from('broadcast_list_contacts')
        .insert(contactEntries);

      if (contactsError) throw contactsError;

      const campaign = await createCampaign.mutateAsync({
        name: `Disparo Oportunidades - ${funnelName}`,
        template_id: isMetaMode ? null : templateId,
        meta_template_id: isMetaMode ? templateId : null,
        list_id: list.id,
        scheduled_at: null,
        message_interval_min: intervalMin,
        message_interval_max: intervalMax,
        daily_limit: dailyLimit,
        allowed_start_hour: startHour,
        allowed_end_hour: endHour,
        allowed_days: allowedDays,
        timezone: 'America/Sao_Paulo',
        skip_already_sent: skipAlreadySent,
        skip_mode: skipMode,
        skip_days_period: skipDaysPeriod,
        skip_tag_id: skipMode === 'has_tag' ? skipTagId : null,
        tag_on_delivery_id: enableTagOnDelivery ? tagOnDeliveryId : null,
        ai_enabled: aiEnabled && !!selectedAgentId,
        ai_prompt: '',
        ai_knowledge_base: '',
        ai_max_interactions: 10,
        ai_response_delay_min: 3,
        ai_response_delay_max: 8,
        ai_handoff_keywords: ['atendente', 'humano', 'pessoa', 'falar com alguém'],
        ai_active_hours_start: 8,
        ai_active_hours_end: 20,
        batch_enabled: batchEnabled,
        batch_size: batchSize,
        batch_pause_minutes: batchPauseMinutes,
      });

      if (aiEnabled && selectedAgentId && campaign?.id) {
        try {
          await linkConfigToCampaign.mutateAsync({
            configId: selectedAgentId,
            campaignId: campaign.id,
          });
        } catch (error) {
          console.error('Failed to link agent:', error);
        }
      }

      setPendingCampaignId(campaign.id);
      setShowInstanceDialog(true);
    } catch (error: any) {
      console.error(error);
      toast.error('Erro ao preparar disparo: ' + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleInstanceConfirm = async ({ instanceIds, sendingMode }: { instanceIds: string[]; sendingMode: string }) => {
    if (messageMode === 'ai') {
      // AI mode: call edge function that generates messages + creates campaign + starts sending
      setIsProcessing(true);
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        if (!token) throw new Error('Sessão expirada');

        const { data, error } = await supabase.functions.invoke('generate-opportunity-messages', {
          body: {
            funnel_id: funnelId,
            deal_ids: selectedDealIds,
            prompt: aiPrompt,
            instance_ids: instanceIds,
            sending_mode: sendingMode,
            campaign_config: {
              message_interval_min: intervalMin,
              message_interval_max: intervalMax,
              daily_limit: dailyLimit,
              allowed_start_hour: startHour,
              allowed_end_hour: endHour,
              allowed_days: allowedDays,
              timezone: 'America/Sao_Paulo',
              skip_already_sent: skipAlreadySent,
              skip_mode: skipMode,
              skip_days_period: skipDaysPeriod,
              skip_tag_id: skipMode === 'has_tag' ? skipTagId : null,
              tag_on_delivery_id: enableTagOnDelivery ? tagOnDeliveryId : null,
              ai_enabled: aiEnabled && !!selectedAgentId,
              agent_id: aiEnabled ? selectedAgentId : null,
            },
          },
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        setShowInstanceDialog(false);
        onOpenChange(false);
        queryClient.invalidateQueries({ queryKey: ['campaigns'] });
        toast.success(`Disparo IA iniciado! ${data?.messages_generated || selectedContacts.length} mensagens personalizadas criadas.`);

        setAiPrompt('');
      } catch (error: any) {
        console.error(error);
        toast.error('Erro ao gerar mensagens IA: ' + error.message);
      } finally {
        setIsProcessing(false);
      }
      return;
    }

    // Template mode - existing flow
    if (!pendingCampaignId) return;

    try {
      await startCampaign.mutateAsync({
        campaignId: pendingCampaignId,
        instanceIds,
        sendingMode: sendingMode as CampaignSendingMode,
      });

      setShowInstanceDialog(false);
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      toast.success(`Disparo iniciado para ${selectedContacts.length} contatos!`);

      setTemplateId('');
      setPendingCampaignId(null);
    } catch (error: any) {
      toast.error('Erro ao iniciar disparo: ' + error.message);
    }
  };

  return (
    <>
      <Dialog open={open && !showInstanceDialog} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              Disparar Mensagem em Massa
            </DialogTitle>
            <DialogDescription>
              Enviar mensagem para {selectedContacts.length} oportunidade{selectedContacts.length !== 1 ? 's' : ''} selecionada{selectedContacts.length !== 1 ? 's' : ''}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Mode Selection */}
            <Tabs value={messageMode} onValueChange={(v) => { setMessageMode(v as 'template' | 'meta_template' | 'ai'); setTemplateId(''); }}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="template" className="gap-2">
                  <Send className="h-4 w-4" />
                  Template
                </TabsTrigger>
                <TabsTrigger value="meta_template" className="gap-2">
                  <Cloud className="h-4 w-4" />
                  Template Meta
                </TabsTrigger>
                <TabsTrigger value="ai" className="gap-2">
                  <Sparkles className="h-4 w-4" />
                  Mensagem IA
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Template Mode */}
            {messageMode === 'template' && (
              <div className="space-y-2">
                <Label>Template de Mensagem *</Label>
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
            )}

            {/* Meta Template Mode */}
            {messageMode === 'meta_template' && (
              <div className="space-y-2">
                <Label>Template Meta (Aprovado) *</Label>
                <Select value={templateId} onValueChange={setTemplateId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um template Meta aprovado" />
                  </SelectTrigger>
                  <SelectContent>
                    {approvedMetaTemplates.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-muted-foreground">
                        Nenhum template Meta aprovado encontrado
                      </div>
                    ) : (
                      approvedMetaTemplates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          <div className="flex items-center gap-2">
                            <span>{template.name}</span>
                            <span className="text-xs text-muted-foreground">({template.language})</span>
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {selectedMetaTemplate && (
                  <div className="p-3 bg-muted rounded-lg text-sm space-y-1">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-medium">{selectedMetaTemplate.category}</span>
                      <span>•</span>
                      <span>{selectedMetaTemplate.language}</span>
                    </div>
                    <p className="text-muted-foreground line-clamp-3">{selectedMetaTemplate.body_text}</p>
                  </div>
                )}

                {/* Meta Phone Number Selection */}
                <div className="space-y-2 mt-4">
                  <Label className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    Número Meta para envio *
                  </Label>
                  <Select value={selectedMetaPhoneNumberId} onValueChange={setSelectedMetaPhoneNumberId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o número Meta" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeMetaNumbers.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-muted-foreground">
                          Nenhum número Meta conectado
                        </div>
                      ) : (
                        activeMetaNumbers.map((number) => (
                          <SelectItem key={number.id} value={number.phone_number_id}>
                            <div className="flex items-center gap-2">
                              <span>{number.display_name || number.phone_number || number.phone_number_id}</span>
                              {number.phone_number && number.display_name && (
                                <span className="text-xs text-muted-foreground">({number.phone_number})</span>
                              )}
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* AI Mode */}
            {messageMode === 'ai' && (
              <div className="space-y-4">
                <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg space-y-2">
                  <div className="flex items-center gap-2 text-primary font-medium">
                    <Sparkles className="h-4 w-4" />
                    Mensagens Personalizadas por IA
                  </div>
                  <p className="text-sm text-muted-foreground">
                    A IA criará uma mensagem <strong>única</strong> para cada contato, baseada no histórico de conversa, 
                    score de oportunidade, insight da análise e suas instruções abaixo.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Instruções para a IA *</Label>
                  <Textarea
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder="Ex: Faça um follow-up mencionando o interesse do cliente. Ofereça uma condição especial de fechamento este mês."
                    className="min-h-[100px]"
                  />
                  <p className="text-xs text-muted-foreground">
                    Descreva o objetivo da mensagem. A IA usará os dados de cada oportunidade para personalizar.
                  </p>
                </div>
              </div>
            )}

            {/* Contacts preview */}
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-sm font-medium">{selectedContacts.length} contatos selecionados</p>
              <p className="text-xs text-muted-foreground mt-1">
                {selectedContacts.slice(0, 5).map(c => c.contactName).join(', ')}
                {selectedContacts.length > 5 && ` e mais ${selectedContacts.length - 5}...`}
              </p>
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
                        <Checkbox id={`opp-${day.value}`} checked={allowedDays.includes(day.value)} onCheckedChange={() => toggleDay(day.value)} />
                        <Label htmlFor={`opp-${day.value}`} className="text-sm cursor-pointer">{day.label}</Label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Batch Sending */}
                <div className="space-y-4 border-t pt-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="font-medium">Disparo em Lotes</Label>
                      <p className="text-sm text-muted-foreground">Envia X mensagens, pausa por Y minutos e repete</p>
                    </div>
                    <Switch checked={batchEnabled} onCheckedChange={setBatchEnabled} />
                  </div>
                  {batchEnabled && (
                    <div className="grid grid-cols-2 gap-4 pl-4 border-l-2 border-muted">
                      <div className="space-y-2">
                        <Label>Mensagens por lote</Label>
                        <Input type="number" min={1} value={batchSize} onChange={(e) => setBatchSize(parseInt(e.target.value) || 1)} />
                      </div>
                      <div className="space-y-2">
                        <Label>Pausa entre lotes (min)</Label>
                        <Input type="number" min={1} value={batchPauseMinutes} onChange={(e) => setBatchPauseMinutes(parseInt(e.target.value) || 1)} />
                      </div>
                      <p className="text-xs text-muted-foreground col-span-2">
                        Exemplo: Envia {batchSize} mensagens, pausa {batchPauseMinutes} minutos, depois envia mais {batchSize}
                      </p>
                    </div>
                  )}
                </div>

                {/* Duplicate Control */}
                <div className="space-y-4 border-t pt-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="flex items-center gap-2">
                        <UserX className="h-4 w-4" />
                        Evitar Duplicatas
                      </Label>
                      <p className="text-sm text-muted-foreground">Não enviar para quem já recebeu mensagens</p>
                    </div>
                    <Switch checked={skipAlreadySent} onCheckedChange={setSkipAlreadySent} />
                  </div>

                  {skipAlreadySent && (
                    <div className="space-y-4 pl-4 border-l-2 border-muted">
                      <div className="space-y-2">
                        <Label>Critério de Exclusão</Label>
                        <Select value={skipMode} onValueChange={(v) => setSkipMode(v as typeof skipMode)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="same_template">Mesmo Template (recomendado)</SelectItem>
                            <SelectItem value="same_list">Mesma Lista</SelectItem>
                            <SelectItem value="any_campaign">Qualquer Campanha</SelectItem>
                            <SelectItem value="same_campaign">Esta Campanha (para retomadas)</SelectItem>
                            <SelectItem value="has_tag">Contatos com Tag</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {skipMode === 'has_tag' && (
                        <div className="space-y-2">
                          <Label>Tag de Exclusão</Label>
                          <Select value={skipTagId || 'none'} onValueChange={(v) => setSkipTagId(v === 'none' ? null : v)}>
                            <SelectTrigger><SelectValue placeholder="Selecione uma tag" /></SelectTrigger>
                            <SelectContent className="z-[100]">
                              <SelectItem value="none">Nenhuma</SelectItem>
                              {tags?.map((tag) => (
                                <SelectItem key={tag.id} value={tag.id}>
                                  <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: tag.color }} />
                                    {tag.name}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {skipMode !== 'has_tag' && (
                        <div className="space-y-2">
                          <Label>Período (dias)</Label>
                          <Input type="number" min={1} max={365} value={skipDaysPeriod} onChange={(e) => setSkipDaysPeriod(parseInt(e.target.value) || 30)} />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Tag on Delivery */}
            <Collapsible>
              <CollapsibleTrigger asChild>
                <Button type="button" variant="outline" className="w-full justify-between">
                  <span className="flex items-center gap-2">
                    <Tag className="h-4 w-4" />
                    Tag de Entrega
                    {enableTagOnDelivery && tagOnDeliveryId && <span className="ml-2 px-2 py-0.5 bg-primary/20 text-primary text-xs rounded-full">Ativo</span>}
                  </span>
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4 pt-4">
                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                  <div className="space-y-0.5">
                    <Label className="font-medium">Aplicar Tag ao Entregar</Label>
                    <p className="text-sm text-muted-foreground">Adiciona uma tag aos contatos que receberam a mensagem</p>
                  </div>
                  <Switch checked={enableTagOnDelivery} onCheckedChange={setEnableTagOnDelivery} />
                </div>

                {enableTagOnDelivery && (
                  <div className="space-y-4 pl-4 border-l-2 border-muted">
                    <div className="space-y-2">
                      <Label>Selecione a Tag</Label>
                      <Select value={tagOnDeliveryId || 'none'} onValueChange={(v) => setTagOnDeliveryId(v === 'none' ? null : v)}>
                        <SelectTrigger><SelectValue placeholder="Selecione uma tag" /></SelectTrigger>
                        <SelectContent className="z-[100]">
                          <SelectItem value="none">Nenhuma</SelectItem>
                          {tags?.map((tag) => (
                            <SelectItem key={tag.id} value={tag.id}>
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: tag.color }} />
                                {tag.name}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {!showCreateTag ? (
                      <Button type="button" variant="outline" size="sm" onClick={() => setShowCreateTag(true)} className="gap-2">
                        <Plus className="h-4 w-4" />
                        Criar nova tag
                      </Button>
                    ) : (
                      <div className="space-y-3 p-3 border rounded-lg bg-muted/30">
                        <div className="space-y-2">
                          <Label>Nome da Tag</Label>
                          <Input value={newTagName} onChange={(e) => setNewTagName(e.target.value)} placeholder="Ex: Oportunidade Quente" />
                        </div>
                        <div className="space-y-2">
                          <Label>Cor</Label>
                          <div className="flex gap-2">
                            {['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'].map((color) => (
                              <button
                                key={color}
                                type="button"
                                onClick={() => setNewTagColor(color)}
                                className={`w-8 h-8 rounded-full border-2 transition-all ${newTagColor === color ? 'border-foreground scale-110' : 'border-transparent'}`}
                                style={{ backgroundColor: color }}
                              />
                            ))}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button type="button" size="sm" onClick={handleCreateTag} disabled={!newTagName.trim() || createTag.isPending}>Criar</Button>
                          <Button type="button" variant="ghost" size="sm" onClick={() => { setShowCreateTag(false); setNewTagName(''); }}>Cancelar</Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CollapsibleContent>
            </Collapsible>

            {/* AI Agent - only for template mode */}
            {messageMode === 'template' && (
              <Collapsible>
                <CollapsibleTrigger asChild>
                  <Button type="button" variant="outline" className="w-full justify-between">
                    <span className="flex items-center gap-2">
                      <Bot className="h-4 w-4" />
                      Agente de IA
                      {aiEnabled && selectedAgentId && <span className="ml-2 px-2 py-0.5 bg-primary/20 text-primary text-xs rounded-full">Ativo</span>}
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
                    <div className="space-y-2">
                      <Label>Selecione um Agente</Label>
                      <AgentPicker selectedAgentId={selectedAgentId} onSelectAgent={setSelectedAgentId} />
                    </div>
                  )}
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={isSubmitDisabled || isProcessing || createCampaign.isPending}
              >
                {isProcessing || createCampaign.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {messageMode === 'ai' ? 'Gerando mensagens...' : 'Preparando...'}
                  </>
                ) : (
                  <>
                    {messageMode === 'ai' ? <Sparkles className="h-4 w-4 mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                    {messageMode === 'ai' ? 'Gerar e Disparar com IA' : 'Selecionar Instância e Disparar'}
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <SelectInstanceDialog
        open={showInstanceDialog}
        onOpenChange={(open) => {
          setShowInstanceDialog(open);
          if (!open) {
            setPendingCampaignId(null);
            setPendingAiInstanceConfig(null);
          }
        }}
        onConfirm={handleInstanceConfirm}
        isLoading={isProcessing || startCampaign.isPending}
        campaignName={messageMode === 'ai' ? `Disparo IA - Oportunidades` : `Disparo Oportunidades - ${funnelName}`}
      />
    </>
  );
};
