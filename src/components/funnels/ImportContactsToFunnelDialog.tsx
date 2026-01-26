import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar as CalendarIcon, Users, Tag, Filter, Search, Loader2, CheckCircle2, XCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Calendar } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { Funnel, FunnelStage } from "@/hooks/useFunnels";

interface ImportContactsToFunnelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  funnel: Funnel;
}

interface ContactWithTags {
  id: string;
  name: string | null;
  phone: string;
  email: string | null;
  created_at: string;
  custom_fields: Record<string, unknown> | null;
  tags: { id: string; name: string; color: string }[];
}

export const ImportContactsToFunnelDialog = ({
  open,
  onOpenChange,
  funnel,
}: ImportContactsToFunnelDialogProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  // State
  const [importAll, setImportAll] = useState(true);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [tagOperator, setTagOperator] = useState<'AND' | 'OR'>('OR');
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [selectedStageId, setSelectedStageId] = useState<string>('');
  const [customFieldKey, setCustomFieldKey] = useState<string>('');
  const [customFieldValue, setCustomFieldValue] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  // Set default stage when funnel changes
  useEffect(() => {
    if (funnel?.stages?.length) {
      const nonFinalStage = funnel.stages.find(s => !s.is_final);
      setSelectedStageId(nonFinalStage?.id || funnel.stages[0].id);
    }
  }, [funnel]);

  // Fetch available tags
  const { data: availableTags } = useQuery({
    queryKey: ['tags', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tags')
        .select('*')
        .order('name');
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id && open,
  });

  // Fetch custom field definitions
  const { data: customFieldDefinitions } = useQuery({
    queryKey: ['custom-field-definitions', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('custom_field_definitions')
        .select('*')
        .order('display_order');
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id && open,
  });

  // Fetch all contacts with tags
  const { data: allContacts, isLoading: loadingContacts } = useQuery({
    queryKey: ['contacts-for-import', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contacts')
        .select(`
          id,
          name,
          phone,
          email,
          created_at,
          custom_fields,
          contact_tags(
            tag:tags(id, name, color)
          )
        `)
        .order('name');
      
      if (error) throw error;
      
      return (data || []).map(contact => ({
        ...contact,
        tags: (contact.contact_tags || [])
          .map((ct: { tag: { id: string; name: string; color: string } | null }) => ct.tag)
          .filter(Boolean) as { id: string; name: string; color: string }[],
      })) as ContactWithTags[];
    },
    enabled: !!user?.id && open,
  });

  // Fetch existing deals in this funnel
  const { data: existingDealContactIds } = useQuery({
    queryKey: ['existing-deals', funnel.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('funnel_deals')
        .select('contact_id')
        .eq('funnel_id', funnel.id);
      
      if (error) throw error;
      return new Set((data || []).map(d => d.contact_id));
    },
    enabled: !!funnel.id && open,
  });

  // Filter contacts based on criteria
  const filteredContacts = useMemo(() => {
    if (!allContacts) return [];
    
    let contacts = [...allContacts];

    // Apply search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      contacts = contacts.filter(c => 
        c.name?.toLowerCase().includes(search) ||
        c.phone.includes(search) ||
        c.email?.toLowerCase().includes(search)
      );
    }

    if (!importAll) {
      // Filter by tags
      if (selectedTagIds.length > 0) {
        contacts = contacts.filter(contact => {
          const contactTagIds = contact.tags.map(t => t.id);
          if (tagOperator === 'AND') {
            return selectedTagIds.every(tagId => contactTagIds.includes(tagId));
          } else {
            return selectedTagIds.some(tagId => contactTagIds.includes(tagId));
          }
        });
      }

      // Filter by date range
      if (dateFrom) {
        contacts = contacts.filter(c => new Date(c.created_at) >= dateFrom);
      }
      if (dateTo) {
        const endOfDay = new Date(dateTo);
        endOfDay.setHours(23, 59, 59, 999);
        contacts = contacts.filter(c => new Date(c.created_at) <= endOfDay);
      }

      // Filter by custom field
      if (customFieldKey && customFieldValue) {
        contacts = contacts.filter(contact => {
          const fieldValue = contact.custom_fields?.[customFieldKey];
          if (fieldValue === undefined || fieldValue === null) return false;
          return String(fieldValue).toLowerCase().includes(customFieldValue.toLowerCase());
        });
      }
    }

    return contacts;
  }, [allContacts, importAll, selectedTagIds, tagOperator, dateFrom, dateTo, customFieldKey, customFieldValue, searchTerm]);

  // Separate new and existing contacts
  const { newContacts, existingContacts } = useMemo(() => {
    const newOnes: ContactWithTags[] = [];
    const existingOnes: ContactWithTags[] = [];
    
    filteredContacts.forEach(contact => {
      if (existingDealContactIds?.has(contact.id)) {
        existingOnes.push(contact);
      } else {
        newOnes.push(contact);
      }
    });
    
    return { newContacts: newOnes, existingContacts: existingOnes };
  }, [filteredContacts, existingDealContactIds]);

  // Bulk create deals mutation
  const bulkCreateDeals = useMutation({
    mutationFn: async (contactIds: string[]) => {
      const BATCH_SIZE = 50;
      let created = 0;

      for (let i = 0; i < contactIds.length; i += BATCH_SIZE) {
        const batch = contactIds.slice(i, i + BATCH_SIZE);
        const deals = batch.map(contactId => ({
          user_id: user!.id,
          funnel_id: funnel.id,
          stage_id: selectedStageId,
          contact_id: contactId,
          value: 0,
          next_action_required: true,
        }));

        const { error } = await supabase.from('funnel_deals').insert(deals);
        if (error) throw error;
        created += batch.length;
      }

      return created;
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['funnels'] });
      toast.success(`${created} deals criados com sucesso!`);
      onOpenChange(false);
      resetFilters();
    },
    onError: () => {
      toast.error("Erro ao importar contatos");
    },
  });

  const handleImport = async () => {
    if (newContacts.length === 0) {
      toast.error("Nenhum contato novo para importar");
      return;
    }

    setIsImporting(true);
    try {
      await bulkCreateDeals.mutateAsync(newContacts.map(c => c.id));
    } finally {
      setIsImporting(false);
    }
  };

  const resetFilters = () => {
    setImportAll(true);
    setSelectedTagIds([]);
    setTagOperator('OR');
    setDateFrom(undefined);
    setDateTo(undefined);
    setCustomFieldKey('');
    setCustomFieldValue('');
    setSearchTerm('');
  };

  const toggleTag = (tagId: string) => {
    setSelectedTagIds(prev => 
      prev.includes(tagId) 
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  };

  const selectedStageName = funnel.stages?.find(s => s.id === selectedStageId)?.name || '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Importar Contatos para {funnel.name}
          </DialogTitle>
          <DialogDescription>
            Selecione os contatos que deseja adicionar ao funil como novos deals
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden space-y-4">
          {/* Stage Selection */}
          <div className="space-y-2">
            <Label>Etapa inicial</Label>
            <Select value={selectedStageId} onValueChange={setSelectedStageId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a etapa" />
              </SelectTrigger>
              <SelectContent className="z-[100]">
                {funnel.stages?.filter(s => !s.is_final).length === 0 ? (
                  <SelectItem value="none" disabled>
                    Nenhuma etapa disponível
                  </SelectItem>
                ) : (
                  funnel.stages?.filter(s => !s.is_final).map(stage => (
                    <SelectItem key={stage.id} value={stage.id}>
                      <div className="flex items-center gap-2">
                        <div 
                          className="h-3 w-3 rounded-full" 
                          style={{ backgroundColor: stage.color }}
                        />
                        {stage.name}
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Import All Toggle */}
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <Label htmlFor="import-all">Importar todos os contatos</Label>
            </div>
            <Switch 
              id="import-all" 
              checked={importAll} 
              onCheckedChange={setImportAll}
            />
          </div>

          {/* Filters */}
          {!importAll && (
            <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Filter className="h-4 w-4" />
                Filtros
              </div>

              {/* Tags Filter */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    <Tag className="h-4 w-4" />
                    Tags
                  </Label>
                  {selectedTagIds.length > 1 && (
                    <Select value={tagOperator} onValueChange={(v) => setTagOperator(v as 'AND' | 'OR')}>
                      <SelectTrigger className="w-24 h-7 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="OR">OU</SelectItem>
                        <SelectItem value="AND">E</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {availableTags?.map(tag => (
                    <Badge
                      key={tag.id}
                      variant={selectedTagIds.includes(tag.id) ? "default" : "outline"}
                      className="cursor-pointer transition-colors"
                      style={selectedTagIds.includes(tag.id) ? { backgroundColor: tag.color } : {}}
                      onClick={() => toggleTag(tag.id)}
                    >
                      {tag.name}
                    </Badge>
                  ))}
                  {!availableTags?.length && (
                    <span className="text-sm text-muted-foreground">Nenhuma tag disponível</span>
                  )}
                </div>
              </div>

              {/* Date Range Filter */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4" />
                    Criado a partir de
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !dateFrom && "text-muted-foreground"
                        )}
                      >
                        {dateFrom ? format(dateFrom, "dd/MM/yyyy", { locale: ptBR }) : "Selecionar data"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dateFrom}
                        onSelect={setDateFrom}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label>Até</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !dateTo && "text-muted-foreground"
                        )}
                      >
                        {dateTo ? format(dateTo, "dd/MM/yyyy", { locale: ptBR }) : "Selecionar data"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dateTo}
                        onSelect={setDateTo}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* Custom Field Filter */}
              {customFieldDefinitions && customFieldDefinitions.length > 0 && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Campo personalizado</Label>
                    <Select value={customFieldKey} onValueChange={setCustomFieldKey}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecionar campo" />
                      </SelectTrigger>
                      <SelectContent>
                        {customFieldDefinitions.map(field => (
                          <SelectItem key={field.id} value={field.field_key}>
                            {field.field_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Valor contém</Label>
                    <Input
                      placeholder="Valor do campo"
                      value={customFieldValue}
                      onChange={(e) => setCustomFieldValue(e.target.value)}
                      disabled={!customFieldKey}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, telefone ou email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Preview */}
          <div className="border rounded-lg overflow-hidden">
            <div className="p-3 bg-muted/50 border-b flex items-center justify-between">
              <span className="text-sm font-medium">
                Preview: {newContacts.length} contatos serão importados
              </span>
              {existingContacts.length > 0 && (
                <span className="text-sm text-muted-foreground">
                  ({existingContacts.length} já estão no funil)
                </span>
              )}
            </div>
            
            <ScrollArea className="h-[200px]">
              {loadingContacts ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredContacts.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  Nenhum contato encontrado com os filtros selecionados
                </div>
              ) : (
                <div className="divide-y">
                  {filteredContacts.slice(0, 50).map(contact => {
                    const isExisting = existingDealContactIds?.has(contact.id);
                    return (
                      <div 
                        key={contact.id} 
                        className={cn(
                          "flex items-center justify-between p-3",
                          isExisting && "opacity-50 bg-muted/30"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          {isExisting ? (
                            <XCircle className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4 text-primary" />
                          )}
                          <div>
                            <p className="font-medium">{contact.name || 'Sem nome'}</p>
                            <p className="text-sm text-muted-foreground">{contact.phone}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {contact.tags.slice(0, 2).map(tag => (
                            <Badge 
                              key={tag.id} 
                              variant="outline" 
                              className="text-xs"
                              style={{ borderColor: tag.color, color: tag.color }}
                            >
                              {tag.name}
                            </Badge>
                          ))}
                          {contact.tags.length > 2 && (
                            <Badge variant="outline" className="text-xs">
                              +{contact.tags.length - 2}
                            </Badge>
                          )}
                          {isExisting && (
                            <Badge variant="secondary" className="text-xs">
                              Já no funil
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {filteredContacts.length > 50 && (
                    <div className="p-3 text-center text-sm text-muted-foreground">
                      Mostrando 50 de {filteredContacts.length} contatos
                    </div>
                  )}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleImport} 
            disabled={newContacts.length === 0 || isImporting || !selectedStageId}
          >
            {isImporting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Importando...
              </>
            ) : (
              <>
                Importar {newContacts.length} contatos
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
