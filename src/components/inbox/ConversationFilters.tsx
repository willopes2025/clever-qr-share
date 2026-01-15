import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Filter, X, User, Bot, Clock, Megaphone, Pin, Phone, Tag, Calendar, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useWhatsAppInstances } from "@/hooks/useWhatsAppInstances";
import { useConversationTags } from "@/hooks/useConversationTags";
import { useFunnels } from "@/hooks/useFunnels";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { useCampaigns } from "@/hooks/useCampaigns";
import { MultiSelect } from "@/components/ui/multi-select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export interface ConversationFilters {
  instanceIds: string[];
  tagIds: string[];
  dateFilter: 'all' | 'today' | '7days' | '30days';
  funnelIds: string[];
  stageIds: string[];
  responseStatus: 'all' | 'no_response' | '15min' | '1h' | '4h' | '24h';
  assignedToIds: string[];
  aiStatus: 'all' | 'no_ai' | 'ai_active' | 'ai_paused' | 'handoff';
  hasDeal: 'all' | 'with_deal' | 'without_deal';
  campaignIds: string[];
  isPinned: boolean;
  provider: 'all' | 'evolution' | 'meta';
  metaPhoneNumberId: string | null;
}

interface ConversationFiltersProps {
  filters: ConversationFilters;
  onFiltersChange: (filters: ConversationFilters) => void;
}

const dateFilterOptions = [
  { value: 'all', label: 'Qualquer período' },
  { value: 'today', label: 'Hoje' },
  { value: '7days', label: 'Últimos 7 dias' },
  { value: '30days', label: 'Últimos 30 dias' },
];

const responseStatusOptions = [
  { value: 'all', label: 'Qualquer status' },
  { value: 'no_response', label: 'Sem resposta' },
  { value: '15min', label: '+15min sem resposta' },
  { value: '1h', label: '+1h sem resposta' },
  { value: '4h', label: '+4h sem resposta' },
  { value: '24h', label: '+24h sem resposta' },
];

const aiStatusOptions = [
  { value: 'all', label: 'Qualquer status' },
  { value: 'no_ai', label: 'Sem IA' },
  { value: 'ai_active', label: 'IA Ativa' },
  { value: 'ai_paused', label: 'IA Pausada' },
  { value: 'handoff', label: 'Aguardando Humano' },
];

const hasDealOptions = [
  { value: 'all', label: 'Todas' },
  { value: 'with_deal', label: 'Com deal ativo' },
  { value: 'without_deal', label: 'Sem deal' },
];

const providerOptions = [
  { value: 'all', label: 'Todos os canais' },
  { value: 'evolution', label: 'WhatsApp Lite' },
  { value: 'meta', label: 'WhatsApp API' },
];

export const ConversationFiltersComponent = ({ filters, onFiltersChange }: ConversationFiltersProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const { instances } = useWhatsAppInstances();
  const { tags } = useConversationTags();
  const { funnels } = useFunnels();
  const { members } = useTeamMembers();
  const { data: campaigns } = useCampaigns();

  const activeFiltersCount = [
    filters.instanceIds.length > 0,
    filters.tagIds.length > 0,
    filters.dateFilter !== 'all',
    filters.funnelIds.length > 0,
    filters.stageIds.length > 0,
    filters.responseStatus !== 'all',
    filters.assignedToIds.length > 0,
    filters.aiStatus !== 'all',
    filters.hasDeal !== 'all',
    filters.campaignIds.length > 0,
    filters.isPinned,
    filters.provider !== 'all',
    filters.metaPhoneNumberId,
  ].filter(Boolean).length;

  const clearFilters = () => {
    onFiltersChange({
      instanceIds: [],
      tagIds: [],
      dateFilter: 'all',
      funnelIds: [],
      stageIds: [],
      responseStatus: 'all',
      assignedToIds: [],
      aiStatus: 'all',
      hasDeal: 'all',
      campaignIds: [],
      isPinned: false,
      provider: 'all',
      metaPhoneNumberId: null,
    });
  };

  // Prepare options for MultiSelect components
  const instanceOptions = useMemo(() => 
    instances?.map(i => ({ value: i.id, label: i.instance_name })) || [], 
    [instances]
  );
  
  const tagOptions = useMemo(() => 
    tags?.map(t => ({ value: t.id, label: t.name })) || [], 
    [tags]
  );
  
  const funnelOptions = useMemo(() => 
    funnels?.map(f => ({ value: f.id, label: f.name })) || [], 
    [funnels]
  );
  
  const memberOptions = useMemo(() => [
    { value: 'unassigned', label: 'Sem responsável' },
    ...(members?.map(m => ({ 
      value: m.user_id || '', 
      label: m.profile?.full_name || m.email || 'Membro' 
    })) || [])
  ], [members]);
  
  const campaignOptions = useMemo(() => 
    campaigns?.map(c => ({ value: c.id, label: c.name })) || [], 
    [campaigns]
  );

  const selectedDateFilter = dateFilterOptions.find(d => d.value === filters.dateFilter);
  const selectedResponseStatus = responseStatusOptions.find(r => r.value === filters.responseStatus);
  const selectedAiStatus = aiStatusOptions.find(a => a.value === filters.aiStatus);
  const selectedHasDeal = hasDealOptions.find(h => h.value === filters.hasDeal);

  // Get stages for the selected funnels
  const stageOptions = useMemo(() => {
    if (filters.funnelIds.length === 0) return [];
    const stages: { value: string; label: string }[] = [];
    filters.funnelIds.forEach(funnelId => {
      const funnel = funnels?.find(f => f.id === funnelId);
      if (funnel?.stages) {
        funnel.stages.forEach(stage => {
          stages.push({ value: stage.id, label: `${funnel.name} - ${stage.name}` });
        });
      }
    });
    return stages;
  }, [funnels, filters.funnelIds]);

  // Get selected stage names for display
  const selectedStageNames = useMemo(() => {
    if (filters.stageIds.length === 0) return [];
    const names: string[] = [];
    filters.funnelIds.forEach(funnelId => {
      const funnel = funnels?.find(f => f.id === funnelId);
      if (funnel?.stages) {
        funnel.stages.forEach(stage => {
          if (filters.stageIds.includes(stage.id)) {
            names.push(stage.name);
          }
        });
      }
    });
    return names;
  }, [funnels, filters.funnelIds, filters.stageIds]);

  // Get display names for selected filters
  const selectedInstanceNames = useMemo(() => 
    filters.instanceIds.map(id => instances?.find(i => i.id === id)?.instance_name).filter(Boolean) as string[],
    [filters.instanceIds, instances]
  );
  
  const selectedTagNames = useMemo(() => 
    filters.tagIds.map(id => tags?.find(t => t.id === id)?.name).filter(Boolean) as string[],
    [filters.tagIds, tags]
  );
  
  const selectedFunnelNames = useMemo(() => 
    filters.funnelIds.map(id => funnels?.find(f => f.id === id)?.name).filter(Boolean) as string[],
    [filters.funnelIds, funnels]
  );
  
  const selectedMemberNames = useMemo(() => 
    filters.assignedToIds.map(id => {
      if (id === 'unassigned') return 'Sem responsável';
      const member = members?.find(m => m.user_id === id);
      return member?.profile?.full_name || member?.email || null;
    }).filter(Boolean) as string[],
    [filters.assignedToIds, members]
  );
  
  const selectedCampaignNames = useMemo(() => 
    filters.campaignIds.map(id => campaigns?.find(c => c.id === id)?.name).filter(Boolean) as string[],
    [filters.campaignIds, campaigns]
  );

  return (
    <div className="space-y-2">
      {/* Filter Button and Active Chips */}
      <div className="flex items-center gap-2 flex-wrap">
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "h-8 gap-1.5",
                activeFiltersCount > 0 && "border-primary text-primary"
              )}
            >
              <Filter className="h-3.5 w-3.5" />
              Filtros
              {activeFiltersCount > 0 && (
                <Badge
                  variant="default"
                  className="ml-1 h-5 min-w-5 px-1.5 text-[10px]"
                >
                  {activeFiltersCount}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-3 max-h-[70vh] overflow-y-auto" align="start">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-sm">Filtros</h4>
                {activeFiltersCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-muted-foreground"
                    onClick={clearFilters}
                  >
                    Limpar todos
                  </Button>
                )}
              </div>

              {/* Provider Filter - NEW */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Phone className="h-3 w-3" />
                  Canal WhatsApp
                </label>
                <Select
                  value={filters.provider}
                  onValueChange={(value) =>
                    onFiltersChange({
                      ...filters,
                      provider: value as ConversationFilters['provider'],
                      // Clear instance filter when changing to meta
                      instanceIds: value === 'meta' ? [] : filters.instanceIds,
                    })
                  }
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {providerOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Instance Filter - Only show when provider is evolution or all */}
              {filters.provider !== 'meta' && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Phone className="h-3 w-3" />
                  Telefone conectado (Lite)
                </label>
                <MultiSelect
                  options={instanceOptions}
                  value={filters.instanceIds}
                  onChange={(instanceIds) => onFiltersChange({ ...filters, instanceIds })}
                  placeholder="Todos os telefones"
                  maxDisplay={2}
                />
              </div>
              )}

              {/* Tag Filter */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Tag className="h-3 w-3" />
                  Tags
                </label>
                <MultiSelect
                  options={tagOptions}
                  value={filters.tagIds}
                  onChange={(tagIds) => onFiltersChange({ ...filters, tagIds })}
                  placeholder="Todas as tags"
                  maxDisplay={2}
                />
              </div>

              {/* Date Filter */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Calendar className="h-3 w-3" />
                  Período
                </label>
                <Select
                  value={filters.dateFilter}
                  onValueChange={(value) =>
                    onFiltersChange({
                      ...filters,
                      dateFilter: value as ConversationFilters['dateFilter'],
                    })
                  }
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {dateFilterOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              {/* ATENDIMENTO Section */}
              <div className="space-y-3">
                <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Atendimento
                </h5>

                {/* Response Status Filter */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <Clock className="h-3 w-3" />
                    Status de resposta
                  </label>
                  <Select
                    value={filters.responseStatus}
                    onValueChange={(value) =>
                      onFiltersChange({
                        ...filters,
                        responseStatus: value as ConversationFilters['responseStatus'],
                      })
                    }
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {responseStatusOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Assigned To Filter */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <User className="h-3 w-3" />
                    Responsável
                  </label>
                  <MultiSelect
                    options={memberOptions}
                    value={filters.assignedToIds}
                    onChange={(assignedToIds) => onFiltersChange({ ...filters, assignedToIds })}
                    placeholder="Todos"
                    maxDisplay={2}
                  />
                </div>

                {/* AI Status Filter */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <Bot className="h-3 w-3" />
                    Status IA
                  </label>
                  <Select
                    value={filters.aiStatus}
                    onValueChange={(value) =>
                      onFiltersChange({
                        ...filters,
                        aiStatus: value as ConversationFilters['aiStatus'],
                      })
                    }
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {aiStatusOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              {/* FUNIL & CAMPANHA Section */}
              <div className="space-y-3">
                <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Funil & Campanha
                </h5>

                {/* Funnel Filter */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <Target className="h-3 w-3" />
                    Funil
                  </label>
                  <MultiSelect
                    options={funnelOptions}
                    value={filters.funnelIds}
                    onChange={(funnelIds) => onFiltersChange({ ...filters, funnelIds, stageIds: [] })}
                    placeholder="Todos os funis"
                    maxDisplay={2}
                  />
                </div>

                {/* Stage Filter - Only show when a funnel is selected */}
                {filters.funnelIds.length > 0 && stageOptions.length > 0 && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                      Etapas
                    </label>
                    <MultiSelect
                      options={stageOptions}
                      value={filters.stageIds}
                      onChange={(stageIds) => onFiltersChange({ ...filters, stageIds })}
                      placeholder="Selecione etapas..."
                      maxDisplay={2}
                    />
                  </div>
                )}

                {/* Has Deal Filter */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    Vinculado a deal
                  </label>
                  <Select
                    value={filters.hasDeal}
                    onValueChange={(value) =>
                      onFiltersChange({
                        ...filters,
                        hasDeal: value as ConversationFilters['hasDeal'],
                      })
                    }
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {hasDealOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Campaign Filter */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <Megaphone className="h-3 w-3" />
                    Campanha
                  </label>
                  <MultiSelect
                    options={campaignOptions}
                    value={filters.campaignIds}
                    onChange={(campaignIds) => onFiltersChange({ ...filters, campaignIds })}
                    placeholder="Todas as campanhas"
                    maxDisplay={2}
                  />
                </div>
              </div>

              <Separator />

              {/* OUTROS Section */}
              <div className="space-y-3">
                <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Outros
                </h5>

                {/* Pinned Filter */}
                <div className="flex items-center justify-between">
                  <Label htmlFor="pinned-filter" className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <Pin className="h-3 w-3" />
                    Apenas fixadas
                  </Label>
                  <Switch
                    id="pinned-filter"
                    checked={filters.isPinned}
                    onCheckedChange={(checked) =>
                      onFiltersChange({
                        ...filters,
                        isPinned: checked,
                      })
                    }
                  />
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Active Filter Chips */}
        {filters.instanceIds.length > 0 && (
          <Badge variant="secondary" className="h-7 gap-1 pl-2 pr-1">
            <Phone className="h-3 w-3" />
            {selectedInstanceNames.length === 1 
              ? selectedInstanceNames[0] 
              : `${selectedInstanceNames.length} telefones`
            }
            <Button
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0 ml-1 hover:bg-transparent"
              onClick={() => onFiltersChange({ ...filters, instanceIds: [] })}
            >
              <X className="h-3 w-3" />
            </Button>
          </Badge>
        )}

        {filters.tagIds.length > 0 && (
          <Badge variant="secondary" className="h-7 gap-1 pl-2 pr-1">
            <Tag className="h-3 w-3" />
            {selectedTagNames.length === 1 
              ? selectedTagNames[0] 
              : `${selectedTagNames.length} tags`
            }
            <Button
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0 ml-1 hover:bg-transparent"
              onClick={() => onFiltersChange({ ...filters, tagIds: [] })}
            >
              <X className="h-3 w-3" />
            </Button>
          </Badge>
        )}

        {filters.dateFilter !== 'all' && selectedDateFilter && (
          <Badge variant="secondary" className="h-7 gap-1 pl-2 pr-1">
            <Calendar className="h-3 w-3" />
            {selectedDateFilter.label}
            <Button
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0 ml-1 hover:bg-transparent"
              onClick={() => onFiltersChange({ ...filters, dateFilter: 'all' })}
            >
              <X className="h-3 w-3" />
            </Button>
          </Badge>
        )}

        {filters.responseStatus !== 'all' && selectedResponseStatus && (
          <Badge variant="secondary" className="h-7 gap-1 pl-2 pr-1">
            <Clock className="h-3 w-3" />
            {selectedResponseStatus.label}
            <Button
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0 ml-1 hover:bg-transparent"
              onClick={() => onFiltersChange({ ...filters, responseStatus: 'all' })}
            >
              <X className="h-3 w-3" />
            </Button>
          </Badge>
        )}

        {filters.assignedToIds.length > 0 && (
          <Badge variant="secondary" className="h-7 gap-1 pl-2 pr-1">
            <User className="h-3 w-3" />
            {selectedMemberNames.length === 1 
              ? selectedMemberNames[0] 
              : `${selectedMemberNames.length} responsáveis`
            }
            <Button
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0 ml-1 hover:bg-transparent"
              onClick={() => onFiltersChange({ ...filters, assignedToIds: [] })}
            >
              <X className="h-3 w-3" />
            </Button>
          </Badge>
        )}

        {filters.aiStatus !== 'all' && selectedAiStatus && (
          <Badge variant="secondary" className="h-7 gap-1 pl-2 pr-1">
            <Bot className="h-3 w-3" />
            {selectedAiStatus.label}
            <Button
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0 ml-1 hover:bg-transparent"
              onClick={() => onFiltersChange({ ...filters, aiStatus: 'all' })}
            >
              <X className="h-3 w-3" />
            </Button>
          </Badge>
        )}

        {filters.funnelIds.length > 0 && (
          <Badge variant="secondary" className="h-7 gap-1 pl-2 pr-1">
            <Target className="h-3 w-3" />
            {selectedFunnelNames.length === 1 
              ? selectedFunnelNames[0] 
              : `${selectedFunnelNames.length} funis`
            }
            <Button
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0 ml-1 hover:bg-transparent"
              onClick={() => onFiltersChange({ ...filters, funnelIds: [], stageIds: [] })}
            >
              <X className="h-3 w-3" />
            </Button>
          </Badge>
        )}

        {filters.stageIds.length > 0 && selectedStageNames.length > 0 && (
          <Badge variant="secondary" className="h-7 gap-1 pl-2 pr-1">
            {selectedStageNames.length <= 2 
              ? selectedStageNames.join(", ")
              : `${selectedStageNames.slice(0, 2).join(", ")} +${selectedStageNames.length - 2}`
            }
            <Button
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0 ml-1 hover:bg-transparent"
              onClick={() => onFiltersChange({ ...filters, stageIds: [] })}
            >
              <X className="h-3 w-3" />
            </Button>
          </Badge>
        )}

        {filters.hasDeal !== 'all' && selectedHasDeal && (
          <Badge variant="secondary" className="h-7 gap-1 pl-2 pr-1">
            {selectedHasDeal.label}
            <Button
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0 ml-1 hover:bg-transparent"
              onClick={() => onFiltersChange({ ...filters, hasDeal: 'all' })}
            >
              <X className="h-3 w-3" />
            </Button>
          </Badge>
        )}

        {filters.campaignIds.length > 0 && (
          <Badge variant="secondary" className="h-7 gap-1 pl-2 pr-1">
            <Megaphone className="h-3 w-3" />
            {selectedCampaignNames.length === 1 
              ? selectedCampaignNames[0] 
              : `${selectedCampaignNames.length} campanhas`
            }
            <Button
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0 ml-1 hover:bg-transparent"
              onClick={() => onFiltersChange({ ...filters, campaignIds: [] })}
            >
              <X className="h-3 w-3" />
            </Button>
          </Badge>
        )}

        {filters.isPinned && (
          <Badge variant="secondary" className="h-7 gap-1 pl-2 pr-1">
            <Pin className="h-3 w-3" />
            Fixadas
            <Button
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0 ml-1 hover:bg-transparent"
              onClick={() => onFiltersChange({ ...filters, isPinned: false })}
            >
              <X className="h-3 w-3" />
            </Button>
          </Badge>
        )}
      </div>
    </div>
  );
};
