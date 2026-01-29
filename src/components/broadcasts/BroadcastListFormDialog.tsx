import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, AlertCircle, Plus, Users, GitBranch } from "lucide-react";
import { BroadcastList, FilterCriteria, CustomFieldFilter, CustomFieldOperator } from "@/hooks/useBroadcastLists";
import { Tag } from "@/hooks/useContacts";
import { Funnel, FunnelStage } from "@/hooks/useFunnels";
import { CustomFieldDefinition } from "@/hooks/useCustomFields";
import { CustomFieldFilterRow } from "./CustomFieldFilterRow";

interface BroadcastListFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  list?: BroadcastList | null;
  tags: Tag[];
  funnels?: Funnel[];
  customFieldDefinitions?: CustomFieldDefinition[];
  onSubmit: (data: {
    name: string;
    description?: string;
    type: "manual" | "dynamic";
    filter_criteria?: FilterCriteria;
  }) => void;
}

interface CustomFieldFilterState {
  id: string;
  fieldKey: string;
  operator: CustomFieldOperator;
  value?: string;
}

export const BroadcastListFormDialog = ({
  open,
  onOpenChange,
  list,
  tags,
  funnels = [],
  customFieldDefinitions = [],
  onSubmit,
}: BroadcastListFormDialogProps) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<"manual" | "dynamic">("manual");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [status, setStatus] = useState<string>("all");
  const [excludeOptedOut, setExcludeOptedOut] = useState(true);
  const [asaasPaymentStatus, setAsaasPaymentStatus] = useState<string>("all");
  
  // Novos estados para filtros avançados
  const [source, setSource] = useState<'contacts' | 'funnel'>('contacts');
  const [selectedFunnelId, setSelectedFunnelId] = useState<string>("");
  const [selectedStageId, setSelectedStageId] = useState<string>("all");
  const [customFieldFilters, setCustomFieldFilters] = useState<CustomFieldFilterState[]>([]);

  // Obtém os estágios do funil selecionado
  const selectedFunnel = useMemo(() => {
    return funnels.find(f => f.id === selectedFunnelId);
  }, [funnels, selectedFunnelId]);

  const funnelStages = useMemo(() => {
    return selectedFunnel?.stages?.filter(s => !s.is_final) || [];
  }, [selectedFunnel]);

  // Campos disponíveis para filtro (baseado na fonte)
  const availableCustomFields = useMemo(() => {
    // Para contatos, usa campos de contato; para funil, usa campos de lead
    return source === 'contacts' 
      ? customFieldDefinitions.filter(f => f.entity_type === 'contact')
      : customFieldDefinitions.filter(f => f.entity_type === 'lead');
  }, [customFieldDefinitions, source]);

  useEffect(() => {
    if (list) {
      setName(list.name);
      setDescription(list.description || "");
      setType(list.type);
      setSelectedTags(list.filter_criteria?.tags || []);
      setStatus(list.filter_criteria?.status || "all");
      setExcludeOptedOut(list.filter_criteria?.optedOut === false);
      setAsaasPaymentStatus(list.filter_criteria?.asaasPaymentStatus || "all");
      setSource(list.filter_criteria?.source || 'contacts');
      setSelectedFunnelId(list.filter_criteria?.funnelId || "");
      setSelectedStageId(list.filter_criteria?.stageId || "all");
      
      // Restaurar filtros de campos dinâmicos
      const existingFilters = list.filter_criteria?.customFields || {};
      const filtersArray = Object.entries(existingFilters).map(([fieldKey, filter]) => ({
        id: crypto.randomUUID(),
        fieldKey,
        operator: filter.operator,
        value: filter.value,
      }));
      setCustomFieldFilters(filtersArray);
    } else {
      setName("");
      setDescription("");
      setType("manual");
      setSelectedTags([]);
      setStatus("all");
      setExcludeOptedOut(true);
      setAsaasPaymentStatus("all");
      setSource('contacts');
      setSelectedFunnelId("");
      setSelectedStageId("all");
      setCustomFieldFilters([]);
    }
  }, [list, open]);

  // Reset estágio quando o funil muda
  useEffect(() => {
    setSelectedStageId("all");
  }, [selectedFunnelId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const filterCriteria: FilterCriteria = {};
    if (type === "dynamic") {
      // Campos existentes
      if (selectedTags.length > 0) filterCriteria.tags = selectedTags;
      if (status && status !== "all") filterCriteria.status = status;
      if (excludeOptedOut) filterCriteria.optedOut = false;
      if (asaasPaymentStatus && asaasPaymentStatus !== "all") {
        filterCriteria.asaasPaymentStatus = asaasPaymentStatus as 'overdue' | 'pending' | 'current';
      }
      
      // Novos campos
      filterCriteria.source = source;
      if (source === 'funnel' && selectedFunnelId) {
        filterCriteria.funnelId = selectedFunnelId;
        if (selectedStageId && selectedStageId !== "all") {
          filterCriteria.stageId = selectedStageId;
        }
      }
      
      // Campos dinâmicos
      if (customFieldFilters.length > 0) {
        const customFields: Record<string, CustomFieldFilter> = {};
        customFieldFilters.forEach(filter => {
          if (filter.fieldKey) {
            customFields[filter.fieldKey] = {
              operator: filter.operator,
              value: filter.value,
            };
          }
        });
        if (Object.keys(customFields).length > 0) {
          filterCriteria.customFields = customFields;
        }
      }
    }

    onSubmit({
      name,
      description: description || undefined,
      type,
      filter_criteria: type === "dynamic" ? filterCriteria : undefined,
    });
    onOpenChange(false);
  };

  const toggleTag = (tagId: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  const addCustomFieldFilter = () => {
    const firstAvailableField = availableCustomFields[0];
    setCustomFieldFilters(prev => [...prev, {
      id: crypto.randomUUID(),
      fieldKey: firstAvailableField?.field_key || "",
      operator: 'equals' as CustomFieldOperator,
      value: "",
    }]);
  };

  const updateCustomFieldFilter = (id: string, updates: Partial<CustomFieldFilterState>) => {
    setCustomFieldFilters(prev => prev.map(filter => 
      filter.id === id ? { ...filter, ...updates } : filter
    ));
  };

  const removeCustomFieldFilter = (id: string) => {
    setCustomFieldFilters(prev => prev.filter(filter => filter.id !== id));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] grid grid-rows-[auto_1fr_auto] overflow-hidden gap-0 p-0">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle>
            {list ? "Editar Lista" : "Nova Lista de Transmissão"}
          </DialogTitle>
          <DialogDescription>
            {list ? "Edite as configurações da sua lista." : "Configure sua nova lista de transmissão para campanhas."}
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="min-h-0 px-6" type="always" scrollHideDelay={0}>
          <form id="broadcast-list-form" onSubmit={handleSubmit} className="space-y-4 pr-4 pb-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome da Lista</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Clientes VIP"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição (opcional)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descreva o propósito desta lista..."
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Tipo de Lista</Label>
              <RadioGroup value={type} onValueChange={(v) => setType(v as "manual" | "dynamic")}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="manual" id="manual" />
                  <Label htmlFor="manual" className="font-normal cursor-pointer">
                    Manual - Adicione contatos individualmente
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="dynamic" id="dynamic" />
                  <Label htmlFor="dynamic" className="font-normal cursor-pointer">
                    Dinâmica - Contatos filtrados automaticamente
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {type === "dynamic" && (
              <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
                <h4 className="font-medium text-sm">Critérios de Filtro</h4>
                
                {/* Fonte de Dados */}
                <div className="space-y-2">
                  <Label>Fonte de Dados</Label>
                  <RadioGroup 
                    value={source} 
                    onValueChange={(v) => setSource(v as 'contacts' | 'funnel')}
                    className="flex gap-4"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="contacts" id="source-contacts" />
                      <Label htmlFor="source-contacts" className="font-normal cursor-pointer flex items-center gap-1.5">
                        <Users className="h-4 w-4" />
                        Contatos
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="funnel" id="source-funnel" />
                      <Label htmlFor="source-funnel" className="font-normal cursor-pointer flex items-center gap-1.5">
                        <GitBranch className="h-4 w-4" />
                        Funil
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                {/* Seleção de Funil e Etapa */}
                {source === 'funnel' && (
                  <div className="space-y-3 pl-4 border-l-2 border-primary/30">
                    <div className="space-y-2">
                      <Label htmlFor="funnel">Funil</Label>
                      <Select value={selectedFunnelId} onValueChange={setSelectedFunnelId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um funil" />
                        </SelectTrigger>
                        <SelectContent>
                          {funnels.map((funnel) => (
                            <SelectItem key={funnel.id} value={funnel.id}>
                              {funnel.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {selectedFunnelId && funnelStages.length > 0 && (
                      <div className="space-y-2">
                        <Label htmlFor="stage">Etapa</Label>
                        <Select value={selectedStageId} onValueChange={setSelectedStageId}>
                          <SelectTrigger>
                            <SelectValue placeholder="Todas as etapas" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todas as etapas</SelectItem>
                            {funnelStages.map((stage) => (
                              <SelectItem key={stage.id} value={stage.id}>
                                <span className="flex items-center gap-2">
                                  <span 
                                    className="h-2 w-2 rounded-full" 
                                    style={{ backgroundColor: stage.color }}
                                  />
                                  {stage.name}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                )}
                
                {/* Tags */}
                <div className="space-y-2">
                  <Label>Tags</Label>
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag) => (
                      <Badge
                        key={tag.id}
                        variant={selectedTags.includes(tag.id) ? "default" : "outline"}
                        className="cursor-pointer"
                        style={{
                          backgroundColor: selectedTags.includes(tag.id) ? tag.color : "transparent",
                          borderColor: tag.color,
                          color: selectedTags.includes(tag.id) ? "white" : tag.color,
                        }}
                        onClick={() => toggleTag(tag.id)}
                      >
                        {tag.name}
                        {selectedTags.includes(tag.id) && (
                          <X className="ml-1 h-3 w-3" />
                        )}
                      </Badge>
                    ))}
                    {tags.length === 0 && (
                      <span className="text-sm text-muted-foreground">
                        Nenhuma tag disponível
                      </span>
                    )}
                  </div>
                </div>

                {/* Campos Personalizados */}
                {availableCustomFields.length > 0 && (
                  <div className="space-y-2">
                    <Label>Campos Personalizados</Label>
                    <div className="space-y-2">
                      {customFieldFilters.map((filter) => (
                        <CustomFieldFilterRow
                          key={filter.id}
                          fieldKey={filter.fieldKey}
                          operator={filter.operator}
                          value={filter.value}
                          availableFields={availableCustomFields}
                          onChangeField={(newKey) => updateCustomFieldFilter(filter.id, { fieldKey: newKey })}
                          onChangeOperator={(op) => updateCustomFieldFilter(filter.id, { operator: op })}
                          onChangeValue={(val) => updateCustomFieldFilter(filter.id, { value: val })}
                          onRemove={() => removeCustomFieldFilter(filter.id)}
                        />
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addCustomFieldFilter}
                        className="w-full"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Adicionar filtro de campo
                      </Button>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="status">Status do Contato</Label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos os status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os status</SelectItem>
                      <SelectItem value="active">Ativo</SelectItem>
                      <SelectItem value="inactive">Inativo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Filtro de Status de Pagamento Asaas */}
                <div className="space-y-2">
                  <Label htmlFor="asaasPaymentStatus" className="flex items-center gap-2">
                    Status de Pagamento (Asaas)
                    {asaasPaymentStatus === "overdue" && (
                      <Badge variant="destructive" className="text-xs">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Vencidos
                      </Badge>
                    )}
                  </Label>
                  <Select value={asaasPaymentStatus} onValueChange={setAsaasPaymentStatus}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="overdue">
                        <span className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-red-500" />
                          Cobranças Vencidas
                        </span>
                      </SelectItem>
                      <SelectItem value="pending">
                        <span className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-yellow-500" />
                          Cobranças Pendentes
                        </span>
                      </SelectItem>
                      <SelectItem value="current">
                        <span className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-green-500" />
                          Em Dia
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Filtre contatos com base no status de pagamento no Asaas
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="excludeOptedOut"
                    checked={excludeOptedOut}
                    onCheckedChange={(checked) => setExcludeOptedOut(!!checked)}
                  />
                  <Label htmlFor="excludeOptedOut" className="font-normal cursor-pointer">
                    Excluir contatos que optaram por sair
                  </Label>
                </div>
              </div>
            )}
          </form>
        </ScrollArea>
        <DialogFooter className="px-6 py-4 border-t">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" form="broadcast-list-form">{list ? "Salvar" : "Criar Lista"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};