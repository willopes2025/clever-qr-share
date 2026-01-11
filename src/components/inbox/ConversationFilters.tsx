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
  instanceId: string | null;
  tagId: string | null;
  dateFilter: 'all' | 'today' | '7days' | '30days';
  funnelId: string | null;
  stageIds: string[];
  responseStatus: 'all' | 'no_response' | '15min' | '1h' | '4h' | '24h';
  assignedTo: string | null;
  aiStatus: 'all' | 'no_ai' | 'ai_active' | 'ai_paused' | 'handoff';
  hasDeal: 'all' | 'with_deal' | 'without_deal';
  campaignId: string | null;
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
    filters.instanceId,
    filters.tagId,
    filters.dateFilter !== 'all' ? filters.dateFilter : null,
    filters.funnelId,
    filters.stageIds.length > 0 ? true : null,
    filters.responseStatus !== 'all' ? filters.responseStatus : null,
    filters.assignedTo,
    filters.aiStatus !== 'all' ? filters.aiStatus : null,
    filters.hasDeal !== 'all' ? filters.hasDeal : null,
    filters.campaignId,
    filters.isPinned ? true : null,
    filters.provider !== 'all' ? filters.provider : null,
    filters.metaPhoneNumberId,
  ].filter(Boolean).length;

  const clearFilters = () => {
    onFiltersChange({
      instanceId: null,
      tagId: null,
      dateFilter: 'all',
      funnelId: null,
      stageIds: [],
      responseStatus: 'all',
      assignedTo: null,
      aiStatus: 'all',
      hasDeal: 'all',
      campaignId: null,
      isPinned: false,
      provider: 'all',
      metaPhoneNumberId: null,
    });
  };

  const selectedInstance = instances?.find(i => i.id === filters.instanceId);
  const selectedTag = tags?.find(t => t.id === filters.tagId);
  const selectedDateFilter = dateFilterOptions.find(d => d.value === filters.dateFilter);
  const selectedFunnel = funnels?.find(f => f.id === filters.funnelId);
  const selectedResponseStatus = responseStatusOptions.find(r => r.value === filters.responseStatus);
  const selectedMember = members?.find(m => m.user_id === filters.assignedTo);
  const selectedAiStatus = aiStatusOptions.find(a => a.value === filters.aiStatus);
  const selectedHasDeal = hasDealOptions.find(h => h.value === filters.hasDeal);
  const selectedCampaign = campaigns?.find(c => c.id === filters.campaignId);

  // Get stages for the selected funnel
  const stageOptions = useMemo(() => {
    if (!selectedFunnel?.stages) return [];
    return selectedFunnel.stages.map(stage => ({
      value: stage.id,
      label: stage.name,
      color: stage.color,
    }));
  }, [selectedFunnel]);

  // Get selected stage names for display
  const selectedStageNames = useMemo(() => {
    if (!selectedFunnel?.stages || filters.stageIds.length === 0) return [];
    return filters.stageIds
      .map(id => selectedFunnel.stages.find(s => s.id === id)?.name)
      .filter(Boolean) as string[];
  }, [selectedFunnel, filters.stageIds]);

  const handleFunnelChange = (value: string) => {
    onFiltersChange({
      ...filters,
      funnelId: value === "all" ? null : value,
      stageIds: [], // Clear stages when funnel changes
    });
  };

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
                      instanceId: value === 'meta' ? null : filters.instanceId,
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
                <Select
                  value={filters.instanceId || "all"}
                  onValueChange={(value) =>
                    onFiltersChange({
                      ...filters,
                      instanceId: value === "all" ? null : value,
                    })
                  }
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Todos os telefones" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os telefones</SelectItem>
                    {instances?.map((instance) => (
                      <SelectItem key={instance.id} value={instance.id}>
                        {instance.instance_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              )}

              {/* Tag Filter */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Tag className="h-3 w-3" />
                  Tag
                </label>
                <Select
                  value={filters.tagId || "all"}
                  onValueChange={(value) =>
                    onFiltersChange({
                      ...filters,
                      tagId: value === "all" ? null : value,
                    })
                  }
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Todas as tags" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as tags</SelectItem>
                    {tags?.map((tag) => (
                      <SelectItem key={tag.id} value={tag.id}>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: tag.color }}
                          />
                          {tag.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                  <Select
                    value={filters.assignedTo || "all"}
                    onValueChange={(value) =>
                      onFiltersChange({
                        ...filters,
                        assignedTo: value === "all" ? null : value,
                      })
                    }
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="unassigned">Sem responsável</SelectItem>
                      {members?.map((member) => (
                        <SelectItem key={member.user_id} value={member.user_id || ''}>
                          {member.profile?.full_name || member.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                  <Select
                    value={filters.funnelId || "all"}
                    onValueChange={handleFunnelChange}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Todos os funis" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os funis</SelectItem>
                      {funnels?.map((funnel) => (
                        <SelectItem key={funnel.id} value={funnel.id}>
                          <div className="flex items-center gap-2">
                            <div
                              className="w-2.5 h-2.5 rounded-full"
                              style={{ backgroundColor: funnel.color }}
                            />
                            {funnel.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Stage Filter - Only show when a funnel is selected */}
                {filters.funnelId && stageOptions.length > 0 && (
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
                  <Select
                    value={filters.campaignId || "all"}
                    onValueChange={(value) =>
                      onFiltersChange({
                        ...filters,
                        campaignId: value === "all" ? null : value,
                      })
                    }
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Todas as campanhas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as campanhas</SelectItem>
                      {campaigns?.map((campaign) => (
                        <SelectItem key={campaign.id} value={campaign.id}>
                          {campaign.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
        {filters.instanceId && selectedInstance && (
          <Badge variant="secondary" className="h-7 gap-1 pl-2 pr-1">
            <Phone className="h-3 w-3" />
            {selectedInstance.instance_name}
            <Button
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0 ml-1 hover:bg-transparent"
              onClick={() => onFiltersChange({ ...filters, instanceId: null })}
            >
              <X className="h-3 w-3" />
            </Button>
          </Badge>
        )}

        {filters.tagId && selectedTag && (
          <Badge variant="secondary" className="h-7 gap-1 pl-2 pr-1">
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: selectedTag.color }}
            />
            {selectedTag.name}
            <Button
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0 ml-1 hover:bg-transparent"
              onClick={() => onFiltersChange({ ...filters, tagId: null })}
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

        {filters.assignedTo && (
          <Badge variant="secondary" className="h-7 gap-1 pl-2 pr-1">
            <User className="h-3 w-3" />
            {filters.assignedTo === 'unassigned' 
              ? 'Sem responsável' 
              : selectedMember?.profile?.full_name || selectedMember?.email || 'Responsável'
            }
            <Button
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0 ml-1 hover:bg-transparent"
              onClick={() => onFiltersChange({ ...filters, assignedTo: null })}
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

        {filters.funnelId && selectedFunnel && (
          <Badge variant="secondary" className="h-7 gap-1 pl-2 pr-1">
            <Target className="h-3 w-3" />
            {selectedFunnel.name}
            <Button
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0 ml-1 hover:bg-transparent"
              onClick={() => onFiltersChange({ ...filters, funnelId: null, stageIds: [] })}
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

        {filters.campaignId && selectedCampaign && (
          <Badge variant="secondary" className="h-7 gap-1 pl-2 pr-1">
            <Megaphone className="h-3 w-3" />
            {selectedCampaign.name}
            <Button
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0 ml-1 hover:bg-transparent"
              onClick={() => onFiltersChange({ ...filters, campaignId: null })}
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
