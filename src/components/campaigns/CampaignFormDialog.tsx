import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useMessageTemplates } from '@/hooks/useMessageTemplates';
import { useMetaTemplates } from '@/hooks/useMetaTemplates';
import { useMetaWhatsAppNumbers } from '@/hooks/useMetaWhatsAppNumbers';
import { useBroadcastLists } from '@/hooks/useBroadcastLists';
import { useContacts } from '@/hooks/useContacts';
import { Campaign, MetaVariableMapping } from '@/hooks/useCampaigns';
import { useAgentConfig, useAgentConfigMutations } from '@/hooks/useAIAgentConfig';
import { useCustomFields } from '@/hooks/useCustomFields';
import { Calendar, Clock, Settings2, ChevronDown, ChevronUp, Bot, UserX, ExternalLink, Tag, Plus, Cloud, Phone, Variable } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { AgentPicker } from '@/components/shared/AgentPicker';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
interface CampaignFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaign?: Campaign | null;
  onSubmit: (data: {
    name: string;
    template_id: string | null;
    meta_template_id?: string | null;
    meta_phone_number_id?: string | null;
    list_id: string | null;
    scheduled_at: string | null;
    message_interval_min: number;
    message_interval_max: number;
    daily_limit: number;
    allowed_start_hour: number;
    allowed_end_hour: number;
    allowed_days: string[];
    timezone: string;
    skip_already_sent: boolean;
    skip_mode: 'same_campaign' | 'same_template' | 'same_list' | 'any_campaign' | 'has_tag';
    skip_days_period: number;
    skip_tag_id: string | null;
    tag_on_delivery_id: string | null;
    ai_enabled: boolean;
    ai_prompt: string;
    ai_knowledge_base: string;
    ai_max_interactions: number;
    ai_response_delay_min: number;
    ai_response_delay_max: number;
    ai_handoff_keywords: string[];
    ai_active_hours_start: number;
    ai_active_hours_end: number;
    batch_enabled: boolean;
    batch_size: number;
    batch_pause_minutes: number;
    meta_variable_mappings?: MetaVariableMapping[] | null;
  }) => Promise<{ id: string } | void>;
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
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [messageMode, setMessageMode] = useState<'template' | 'meta_template'>('template');
  const [templateId, setTemplateId] = useState<string>('');
  const [selectedMetaPhoneNumberId, setSelectedMetaPhoneNumberId] = useState('');
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

  // Duplicate control settings
  const [skipAlreadySent, setSkipAlreadySent] = useState(true);
  const [skipMode, setSkipMode] = useState<'same_campaign' | 'same_template' | 'same_list' | 'any_campaign' | 'has_tag'>('same_template');
  const [skipDaysPeriod, setSkipDaysPeriod] = useState(30);
  const [skipTagId, setSkipTagId] = useState<string | null>(null);

  // AI Agent settings - now just selecting an existing agent
  const [aiEnabled, setAiEnabled] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  // Batch sending settings
  const [batchEnabled, setBatchEnabled] = useState(false);
  const [batchSize, setBatchSize] = useState(5);
  const [batchPauseMinutes, setBatchPauseMinutes] = useState(30);

  // Tag on delivery settings
  const [enableTagOnDelivery, setEnableTagOnDelivery] = useState(false);
  const [tagOnDeliveryId, setTagOnDeliveryId] = useState<string | null>(null);
  const [showCreateTag, setShowCreateTag] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#3B82F6');

  // Variable mappings for Meta templates
  const [variableMappings, setVariableMappings] = useState<MetaVariableMapping[]>([]);

  const { templates } = useMessageTemplates();
  const { metaNumbers } = useMetaWhatsAppNumbers();
  const { lists } = useBroadcastLists();
  const { user } = useAuth();
  const { createTag } = useContacts();
  const { contactFieldDefinitions, leadFieldDefinitions } = useCustomFields();

  const activeMetaNumbers = metaNumbers?.filter(n => n.is_active && n.status === 'connected') || [];
  
  // Get the selected number's waba_id to filter templates
  const selectedMetaNumber = activeMetaNumbers.find(n => n.phone_number_id === selectedMetaPhoneNumberId);
  const selectedWabaId = selectedMetaNumber?.waba_id || null;
  
  const { templates: metaTemplates } = useMetaTemplates(messageMode === 'meta_template' ? selectedWabaId : undefined);
  
  // Fetch tags for selection
  const { data: tags } = useQuery({
    queryKey: ['tags', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('tags').select('*').order('name');
      return data || [];
    },
    enabled: !!user?.id,
  });
  
  // Agent config hooks - for existing campaigns
  const { data: agentConfig } = useAgentConfig(campaign?.id || null);
  const { linkConfigToCampaign } = useAgentConfigMutations();

  const activeTemplates = templates?.filter(t => t.is_active) || [];
  const approvedMetaTemplates = metaTemplates?.filter(t => t.status === 'approved') || [];
  const selectedMetaTemplate = approvedMetaTemplates.find(t => t.id === templateId);

  // Detect variables in selected Meta template
  const detectedVariables = useMemo(() => {
    if (!selectedMetaTemplate) return [];
    const matches = selectedMetaTemplate.body_text.match(/\{\{(\d+)\}\}/g) || [];
    return [...new Set(matches)].map(m => parseInt(m.replace(/[{}]/g, ''))).sort((a, b) => a - b);
  }, [selectedMetaTemplate]);

  // Auto-initialize variable mappings when template changes
  useEffect(() => {
    if (detectedVariables.length > 0) {
      // Check if campaign has existing mappings
      const existingMappings = campaign?.meta_variable_mappings as MetaVariableMapping[] | null;
      if (existingMappings && existingMappings.length > 0) {
        setVariableMappings(existingMappings);
      } else {
        // Default: {{1}} = name, {{2}} = phone, rest empty
        setVariableMappings(detectedVariables.map(idx => ({
          variable_index: idx,
          source: idx === 1 ? 'contact_name' : idx === 2 ? 'contact_phone' : 'fixed_text' as MetaVariableMapping['source'],
          label: idx === 1 ? 'Nome' : idx === 2 ? 'Telefone' : `Variável ${idx}`,
        })));
      }
    } else {
      setVariableMappings([]);
    }
  }, [detectedVariables.join(','), campaign?.meta_variable_mappings]);

  // Available variable source options
  const variableSourceOptions = useMemo(() => {
    const options: { value: string; label: string; source: MetaVariableMapping['source']; field_key?: string }[] = [
      { value: 'contact_name', label: 'Nome do Contato', source: 'contact_name' },
      { value: 'contact_phone', label: 'Telefone', source: 'contact_phone' },
      { value: 'contact_email', label: 'E-mail', source: 'contact_email' },
    ];
    // Add contact custom fields
    contactFieldDefinitions.forEach(f => {
      options.push({ value: `contact_cf_${f.field_key}`, label: `📋 ${f.field_name}`, source: 'contact_custom_field', field_key: f.field_key });
    });
    // Add lead custom fields
    leadFieldDefinitions.forEach(f => {
      options.push({ value: `lead_cf_${f.field_key}`, label: `🎯 ${f.field_name}`, source: 'lead_custom_field', field_key: f.field_key });
    });
    options.push({ value: 'fixed_text', label: 'Texto Fixo', source: 'fixed_text' });
    return options;
  }, [contactFieldDefinitions, leadFieldDefinitions]);

  useEffect(() => {
    if (campaign) {
      const isMetaCampaign = !!campaign.meta_template_id;
      setName(campaign.name);
      setMessageMode(isMetaCampaign ? 'meta_template' : 'template');
      setTemplateId(campaign.meta_template_id || campaign.template_id || '');
      setSelectedMetaPhoneNumberId(campaign.meta_phone_number_id || '');
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
      setSkipAlreadySent(campaign.skip_already_sent ?? true);
      setSkipMode(campaign.skip_mode ?? 'same_template');
      setSkipDaysPeriod(campaign.skip_days_period ?? 30);
      setSkipTagId(campaign.skip_tag_id || null);
      setBatchEnabled(campaign.batch_enabled ?? false);
      setBatchSize(campaign.batch_size ?? 5);
      setBatchPauseMinutes(campaign.batch_pause_minutes ?? 30);
      setAiEnabled(campaign.ai_enabled ?? false);
      setEnableTagOnDelivery(!!campaign.tag_on_delivery_id);
      setTagOnDeliveryId(campaign.tag_on_delivery_id || null);
    } else {
      setName('');
      setMessageMode('template');
      setTemplateId('');
      setSelectedMetaPhoneNumberId('');
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
      setSkipAlreadySent(true);
      setSkipMode('same_template');
      setSkipDaysPeriod(30);
      setSkipTagId(null);
      setBatchEnabled(false);
      setBatchSize(5);
      setBatchPauseMinutes(30);
      setAiEnabled(false);
      setSelectedAgentId(null);
      setEnableTagOnDelivery(false);
      setTagOnDeliveryId(null);
      setShowCreateTag(false);
      setNewTagName('');
      setNewTagColor('#3B82F6');
    }
  }, [campaign, open]);

  // Load existing agent config for campaign
  useEffect(() => {
    if (agentConfig) {
      setSelectedAgentId(agentConfig.id);
    }
  }, [agentConfig]);

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;
    
    try {
      const newTag = await createTag.mutateAsync({
        name: newTagName.trim(),
        color: newTagColor,
      });
      setTagOnDeliveryId(newTag.id);
      setShowCreateTag(false);
      setNewTagName('');
      setNewTagColor('#3B82F6');
    } catch (error) {
      console.error('Failed to create tag:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const isMetaMode = messageMode === 'meta_template';
    
    let scheduledAt: string | null = null;
    if (isScheduled && scheduledDate && scheduledTime) {
      scheduledAt = new Date(`${scheduledDate}T${scheduledTime}`).toISOString();
    }

    const result = await onSubmit({
      name,
      template_id: isMetaMode ? null : templateId || null,
      meta_template_id: isMetaMode ? templateId || null : null,
      meta_phone_number_id: isMetaMode ? selectedMetaPhoneNumberId || null : null,
      list_id: listId || null,
      scheduled_at: scheduledAt,
      message_interval_min: intervalMin,
      message_interval_max: intervalMax,
      daily_limit: dailyLimit,
      allowed_start_hour: startHour,
      allowed_end_hour: endHour,
      allowed_days: allowedDays,
      timezone,
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
      ai_handoff_keywords: DEFAULT_HANDOFF_KEYWORDS,
      ai_active_hours_start: 8,
      ai_active_hours_end: 20,
      batch_enabled: batchEnabled,
      batch_size: batchSize,
      batch_pause_minutes: batchPauseMinutes,
      meta_variable_mappings: messageMode === 'meta_template' && variableMappings.length > 0 ? variableMappings : null,
    });

    // For new campaigns with AI enabled: link selected agent to the new campaign
    const newCampaignId = result && 'id' in result ? result.id : null;
    if (!campaign?.id && aiEnabled && selectedAgentId && newCampaignId) {
      try {
        await linkConfigToCampaign.mutateAsync({
          configId: selectedAgentId,
          campaignId: newCampaignId,
        });
      } catch (error) {
        console.error('Failed to link agent config:', error);
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
  const isMetaMode = messageMode === 'meta_template';

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

          <div className="space-y-4">
            <Tabs
              value={messageMode}
              onValueChange={(value) => {
                const nextMode = value as 'template' | 'meta_template';
                setMessageMode(nextMode);
                setTemplateId('');
                if (nextMode !== 'meta_template') {
                  setSelectedMetaPhoneNumberId('');
                }
              }}
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="template">Template Interno</TabsTrigger>
                <TabsTrigger value="meta_template" className="gap-2">
                  <Cloud className="h-4 w-4" />
                  Template Meta
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {messageMode === 'template' ? (
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
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  Número Meta para envio *
                </Label>
                <Select value={selectedMetaPhoneNumberId} onValueChange={(val) => {
                  setSelectedMetaPhoneNumberId(val);
                  setTemplateId(''); // Reset template when number changes
                }}>
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

              <div className="space-y-2">
                <Label>Template Meta (Aprovado) *</Label>
                <Select value={templateId} onValueChange={setTemplateId} disabled={!selectedMetaPhoneNumberId}>
                  <SelectTrigger>
                    <SelectValue placeholder={selectedMetaPhoneNumberId ? "Selecione um template Meta aprovado" : "Selecione o número primeiro"} />
                  </SelectTrigger>
                  <SelectContent>
                    {approvedMetaTemplates.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-muted-foreground">
                        {selectedMetaPhoneNumberId ? "Nenhum template aprovado para este número" : "Selecione um número primeiro"}
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

                {/* Variable Mapping for Meta Templates */}
                {selectedMetaTemplate && detectedVariables.length > 0 && (
                  <div className="border rounded-lg p-4 space-y-3">
                    <Label className="flex items-center gap-2 text-sm font-medium">
                      <Variable className="h-4 w-4" />
                      Mapeamento de Variáveis ({detectedVariables.length})
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Defina quais dados serão usados em cada variável do template
                    </p>
                    <div className="space-y-2">
                      {variableMappings.map((mapping, idx) => {
                        const currentValue = mapping.source === 'contact_custom_field' 
                          ? `contact_cf_${mapping.field_key}` 
                          : mapping.source === 'lead_custom_field'
                          ? `lead_cf_${mapping.field_key}`
                          : mapping.source;
                        
                        return (
                          <div key={mapping.variable_index} className="flex items-center gap-2">
                            <span className="text-xs font-mono bg-primary/10 text-primary px-2 py-1 rounded min-w-[50px] text-center">
                              {`{{${mapping.variable_index}}}`}
                            </span>
                            <Select
                              value={currentValue}
                              onValueChange={(val) => {
                                const option = variableSourceOptions.find(o => o.value === val);
                                if (!option) return;
                                const updated = [...variableMappings];
                                updated[idx] = {
                                  ...updated[idx],
                                  source: option.source,
                                  field_key: option.field_key,
                                  label: option.label,
                                  fixed_value: option.source === 'fixed_text' ? '' : undefined,
                                };
                                setVariableMappings(updated);
                              }}
                            >
                              <SelectTrigger className="flex-1 h-8 text-xs">
                                <SelectValue placeholder="Selecione o campo" />
                              </SelectTrigger>
                              <SelectContent>
                                {variableSourceOptions.map(opt => (
                                  <SelectItem key={opt.value} value={opt.value} className="text-xs">
                                    {opt.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {mapping.source === 'fixed_text' && (
                              <Input
                                className="flex-1 h-8 text-xs"
                                placeholder="Texto fixo"
                                value={mapping.fixed_value || ''}
                                onChange={(e) => {
                                  const updated = [...variableMappings];
                                  updated[idx] = { ...updated[idx], fixed_value: e.target.value };
                                  setVariableMappings(updated);
                                }}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

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
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">
                  {selectedList.contact_count} contatos serão notificados
                </p>
                {selectedList.filter_criteria?.asaasPaymentStatus && (
                  <div className="flex items-center gap-2 text-xs bg-muted p-2 rounded">
                    <Tag className="h-3 w-3 text-muted-foreground" />
                    <span>
                      Filtro Asaas: <strong>{selectedList.filter_criteria.asaasPaymentStatus === 'overdue' ? 'Vencidos' : selectedList.filter_criteria.asaasPaymentStatus === 'pending' ? 'Pendentes' : 'Em dia'}</strong>
                      {(selectedList.filter_criteria.asaasDueDateFrom || selectedList.filter_criteria.asaasDueDateTo) && (
                        <span className="ml-1">
                          ({selectedList.filter_criteria.asaasDueDateFrom || '...'} até {selectedList.filter_criteria.asaasDueDateTo || '...'})
                        </span>
                      )}
                    </span>
                  </div>
                )}
              </div>
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

              {/* Batch Sending Section */}
              <div className="space-y-4 border-t pt-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="font-medium">Disparo em Lotes</Label>
                    <p className="text-sm text-muted-foreground">
                      Envia X mensagens, pausa por Y minutos e repete
                    </p>
                  </div>
                  <Switch checked={batchEnabled} onCheckedChange={setBatchEnabled} />
                </div>

                {batchEnabled && (
                  <div className="grid grid-cols-2 gap-4 pl-4 border-l-2 border-muted">
                    <div className="space-y-2">
                      <Label>Mensagens por lote</Label>
                      <Input
                        type="number"
                        min={1}
                        value={batchSize}
                        onChange={(e) => setBatchSize(parseInt(e.target.value) || 1)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Pausa entre lotes (min)</Label>
                      <Input
                        type="number"
                        min={1}
                        value={batchPauseMinutes}
                        onChange={(e) => setBatchPauseMinutes(parseInt(e.target.value) || 1)}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground col-span-2">
                      Exemplo: Envia {batchSize} mensagens, pausa {batchPauseMinutes} minutos, depois envia mais {batchSize}
                    </p>
                  </div>
                )}
              </div>

              {/* Duplicate Control Section */}
              <div className="space-y-4 border-t pt-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="flex items-center gap-2">
                      <UserX className="h-4 w-4" />
                      Evitar Duplicatas
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Não enviar para quem já recebeu mensagens
                    </p>
                  </div>
                  <Switch checked={skipAlreadySent} onCheckedChange={setSkipAlreadySent} />
                </div>

                {skipAlreadySent && (
                  <div className="space-y-4 pl-4 border-l-2 border-muted">
                    <div className="space-y-2">
                      <Label>Critério de Exclusão</Label>
                      <Select value={skipMode} onValueChange={(v) => setSkipMode(v as typeof skipMode)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="same_template">Mesmo Template (recomendado)</SelectItem>
                          <SelectItem value="same_list">Mesma Lista</SelectItem>
                          <SelectItem value="any_campaign">Qualquer Campanha</SelectItem>
                          <SelectItem value="same_campaign">Esta Campanha (para retomadas)</SelectItem>
                          <SelectItem value="has_tag">Contatos com Tag</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        {skipMode === 'same_template' && 'Exclui contatos que já receberam este template específico'}
                        {skipMode === 'same_list' && 'Exclui contatos que já receberam campanhas desta lista'}
                        {skipMode === 'any_campaign' && 'Exclui contatos que já receberam qualquer campanha'}
                        {skipMode === 'same_campaign' && 'Exclui apenas contatos já enviados nesta campanha (útil para retomar)'}
                        {skipMode === 'has_tag' && 'Exclui contatos que possuem uma tag específica'}
                      </p>
                    </div>

                    {skipMode === 'has_tag' && (
                      <div className="space-y-2">
                        <Label>Tag de Exclusão</Label>
                        <Select 
                          value={skipTagId || 'none'} 
                          onValueChange={(v) => setSkipTagId(v === 'none' ? null : v)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione uma tag" />
                          </SelectTrigger>
                          <SelectContent className="z-[100]">
                            <SelectItem value="none">Nenhuma</SelectItem>
                            {tags?.map((tag) => (
                              <SelectItem key={tag.id} value={tag.id}>
                                <div className="flex items-center gap-2">
                                  <div 
                                    className="w-3 h-3 rounded-full" 
                                    style={{ backgroundColor: tag.color }}
                                  />
                                  {tag.name}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          Contatos com esta tag não receberão mensagens
                        </p>
                      </div>
                    )}

                    {skipMode !== 'has_tag' && (
                      <div className="space-y-2">
                        <Label>Período (dias)</Label>
                        <Input
                          type="number"
                          min={1}
                          max={365}
                          value={skipDaysPeriod}
                          onChange={(e) => setSkipDaysPeriod(parseInt(e.target.value) || 30)}
                        />
                        <p className="text-xs text-muted-foreground">
                          Considerar envios dos últimos {skipDaysPeriod} dias
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Tag on Delivery Settings */}
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
                  <p className="text-sm text-muted-foreground">
                    Adiciona uma tag aos contatos que receberam a mensagem com sucesso
                  </p>
                </div>
                <Switch checked={enableTagOnDelivery} onCheckedChange={setEnableTagOnDelivery} />
              </div>

              {enableTagOnDelivery && (
                <div className="space-y-4 pl-4 border-l-2 border-muted">
                  <div className="space-y-2">
                    <Label>Selecione a Tag</Label>
                    <Select 
                      value={tagOnDeliveryId || 'none'} 
                      onValueChange={(v) => setTagOnDeliveryId(v === 'none' ? null : v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma tag" />
                      </SelectTrigger>
                      <SelectContent className="z-[100]">
                        <SelectItem value="none">Nenhuma</SelectItem>
                        {tags?.map((tag) => (
                          <SelectItem key={tag.id} value={tag.id}>
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-3 h-3 rounded-full" 
                                style={{ backgroundColor: tag.color }}
                              />
                              {tag.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {!showCreateTag ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowCreateTag(true)}
                      className="gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      Criar nova tag
                    </Button>
                  ) : (
                    <div className="space-y-3 p-3 border rounded-lg bg-muted/30">
                      <div className="space-y-2">
                        <Label>Nome da Tag</Label>
                        <Input
                          value={newTagName}
                          onChange={(e) => setNewTagName(e.target.value)}
                          placeholder="Ex: Black Friday 2024"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Cor</Label>
                        <div className="flex gap-2">
                          {['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'].map((color) => (
                            <button
                              key={color}
                              type="button"
                              onClick={() => setNewTagColor(color)}
                              className={`w-8 h-8 rounded-full border-2 transition-all ${
                                newTagColor === color ? 'border-foreground scale-110' : 'border-transparent'
                              }`}
                              style={{ backgroundColor: color }}
                            />
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          onClick={handleCreateTag}
                          disabled={!newTagName.trim() || createTag.isPending}
                        >
                          Criar
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setShowCreateTag(false);
                            setNewTagName('');
                            setNewTagColor('#3B82F6');
                          }}
                        >
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>

          {/* AI Agent Settings - Now just selection */}
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
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Selecione um Agente</Label>
                    <p className="text-xs text-muted-foreground">
                      Escolha um agente já configurado na seção Agentes de IA
                    </p>
                  </div>
                  
                  <AgentPicker
                    selectedAgentId={selectedAgentId}
                    onSelectAgent={setSelectedAgentId}
                    disabled={!!campaign?.id && !!agentConfig}
                  />

                  {!selectedAgentId && (
                    <div className="p-4 border border-dashed rounded-lg text-center space-y-2">
                      <p className="text-sm text-muted-foreground">
                        Nenhum agente selecionado
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => navigate('/ai-agents')}
                        className="gap-2"
                      >
                        <ExternalLink className="h-4 w-4" />
                        Criar novo agente
                      </Button>
                    </div>
                  )}

                  {campaign?.id && agentConfig && (
                    <p className="text-xs text-muted-foreground italic">
                      Para alterar o agente desta campanha, desvincule-o primeiro na seção Agentes de IA.
                    </p>
                  )}
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading || !name || (isMetaMode && (!templateId || !selectedMetaPhoneNumberId))}>
              {campaign ? 'Salvar' : 'Criar Campanha'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
