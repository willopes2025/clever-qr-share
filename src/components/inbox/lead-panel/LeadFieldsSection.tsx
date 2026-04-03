import { useState, useEffect } from "react";
import { Check, X, Pencil, Target, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
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
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { parseAnyDateValue, isDateLikeFieldName, formatDateValue } from "@/lib/date-utils";
import { useCustomFields, CustomFieldDefinition, FieldType, EntityType } from "@/hooks/useCustomFields";
import { useLeadPanelTabs } from "@/hooks/useLeadPanelTabs";
import { CustomFieldsManager } from "../CustomFieldsManager";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface LeadFieldsSectionProps {
  deal: {
    id: string;
    title?: string;
    value?: number | null;
    custom_fields?: Record<string, any> | null;
  } | null;
  activeTabId?: string | null;
}

export const LeadFieldsSection = ({ deal, activeTabId }: LeadFieldsSectionProps) => {
  const { leadFieldDefinitions, updateDealCustomFields } = useCustomFields();
  const { tabs } = useLeadPanelTabs();
  const queryClient = useQueryClient();

  // Filter fields based on active tab's field_keys
  const activeTabData = tabs?.find(t => t.id === activeTabId);
  const tabFieldKeys = activeTabData?.field_keys || [];
  
  // Only consider field_keys that match actual LEAD definitions for tab assignment
  const leadFieldKeySet = new Set(leadFieldDefinitions.map(f => f.field_key));
  
  // Collect all field_keys assigned to ANY tab (only lead-type keys)
  const allAssignedFieldKeys = new Set(
    (tabs || []).flatMap(t => t.field_keys || []).filter(k => leadFieldKeySet.has(k))
  );
  
  // Show tab-specific fields + unassigned fields (orphans)
  const filteredLeadFields = tabFieldKeys.length > 0
    ? leadFieldDefinitions.filter(f => 
        tabFieldKeys.includes(f.field_key) || !allAssignedFieldKeys.has(f.field_key)
      )
    : leadFieldDefinitions;
  
  // Also detect custom_fields keys that have data but NO lead field definition (orphan data)
  const dealCustomFields = (deal?.custom_fields || {}) as Record<string, any>;
  const orphanDataFields: CustomFieldDefinition[] = [];
  if (deal?.custom_fields) {
    for (const key of Object.keys(dealCustomFields)) {
      const val = dealCustomFields[key];
      if (val === null || val === undefined || val === '') continue;
      if (!leadFieldKeySet.has(key)) {
        orphanDataFields.push({
          id: `orphan_${key}`,
          user_id: '',
          field_name: key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
          field_key: key,
          field_type: 'text' as FieldType,
          options: [],
          is_required: false,
          display_order: 999,
          entity_type: 'lead' as EntityType,
          created_at: '',
        });
      }
    }
  }
  
  // Combine defined fields + orphan data fields
  const allVisibleFields = [...filteredLeadFields, ...orphanDataFields];
  
  const customFields = dealCustomFields;
  const [localFields, setLocalFields] = useState<Record<string, any>>(customFields);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [manuallyAdded, setManuallyAdded] = useState<Set<string>>(new Set());
  
  // Estado para edição do título do lead
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [localTitle, setLocalTitle] = useState(deal?.title || '');

  useEffect(() => {
    setLocalFields(customFields);
  }, [JSON.stringify(customFields)]);

  useEffect(() => {
    setLocalTitle(deal?.title || '');
  }, [deal?.title]);

  const handleSaveTitle = async () => {
    if (!deal) return;
    
    const { error } = await supabase
      .from('funnel_deals')
      .update({ title: localTitle })
      .eq('id', deal.id);
    
    if (error) {
      toast.error("Erro ao atualizar título");
      return;
    }
    
    queryClient.invalidateQueries({ queryKey: ['funnel-deals'] });
    toast.success("Título atualizado");
    setIsEditingTitle(false);
  };

  const handleSave = async (fieldKey: string, value: any) => {
    if (!deal) return;
    
    const updatedFields = { ...localFields, [fieldKey]: value };
    setLocalFields(updatedFields);
    await updateDealCustomFields.mutateAsync({
      dealId: deal.id,
      customFields: updatedFields,
    });
    toast.success("Campo atualizado");
    setEditingField(null);
  };

  // Helper to parse date values (handles Excel serial numbers and ISO strings)
  const parseDateValue = (value: any): Date | undefined => {
    if (!value) return undefined;
    if (typeof value === 'number' || (typeof value === 'string' && /^\d{4,5}$/.test(value))) {
      const serial = typeof value === 'number' ? value : parseInt(value, 10);
      if (serial > 25000 && serial < 100000) {
        const excelEpoch = new Date(1899, 11, 30);
        return new Date(excelEpoch.getTime() + serial * 86400000);
      }
    }
    // Timezone-safe: parse YYYY-MM-DD as local date, not UTC
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
      const datePart = value.split('T')[0];
      const [y, m, d] = datePart.split('-').map(Number);
      if (y && m && d) return new Date(y, m - 1, d);
    }
    const d = new Date(value);
    return isNaN(d.getTime()) ? undefined : d;
  };

  // Check if a field name suggests it's a date field
  const isDateLikeField = (fieldName: string) => {
    return /data|date|vencimento|nascimento|pagamento|entrada|saída|saida|prazo/i.test(fieldName);
  };

  // Format a display value, auto-detecting Excel serial dates
  const formatDisplayValue = (value: any, fieldName: string): string => {
    if (value === null || value === undefined || value === '') return '';
    if (isDateLikeField(fieldName)) {
      const parsed = parseDateValue(value);
      if (parsed) return format(parsed, "dd/MM/yyyy", { locale: ptBR });
    }
    return String(value);
  };

  const renderFieldValue = (definition: CustomFieldDefinition) => {
    const value = localFields[definition.field_key];
    const isEditing = editingField === definition.field_key;

    switch (definition.field_type) {
      case 'boolean':
      case 'switch':
        return (
          <Switch
            checked={!!value}
            onCheckedChange={(checked) => handleSave(definition.field_key, checked)}
          />
        );

      case 'date': {
        const parsedDate = parseDateValue(value);
        return (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 px-3 text-sm justify-start font-normal border-border/50 hover:border-primary/50 hover:bg-primary/5">
                {parsedDate ? format(parsedDate, "dd/MM/yyyy", { locale: ptBR }) : <span className="text-muted-foreground">Selecionar</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={parsedDate}
                onSelect={(date) => handleSave(definition.field_key, date?.toISOString())}
                locale={ptBR}
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        );
      }

      case 'time':
        return (
          <Input
            type="time"
            value={value || ''}
            onChange={(e) => handleSave(definition.field_key, e.target.value)}
            className="h-8 w-32 text-sm border-border/50 hover:border-primary/50 hover:bg-primary/5"
          />
        );

      case 'datetime': {
        const parsedDt = parseDateValue(value);
        return (
          <div className="flex items-center gap-1.5">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 px-3 text-sm justify-start font-normal border-border/50 hover:border-primary/50 hover:bg-primary/5">
                  {parsedDt ? format(parsedDt, "dd/MM/yyyy", { locale: ptBR }) : <span className="text-muted-foreground">Data</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="single"
                  selected={parsedDt}
                  onSelect={(date) => {
                    if (!date) return handleSave(definition.field_key, null);
                    const existing = parsedDt || new Date();
                    date.setHours(existing.getHours(), existing.getMinutes());
                    handleSave(definition.field_key, date.toISOString());
                  }}
                  locale={ptBR}
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
            <Input
              type="time"
              value={parsedDt ? format(parsedDt, "HH:mm") : ''}
              onChange={(e) => {
                const [hours, minutes] = e.target.value.split(':').map(Number);
                const d = parsedDt || new Date();
                d.setHours(hours, minutes);
                handleSave(definition.field_key, d.toISOString());
              }}
              className="h-8 w-24 text-sm border-border/50 hover:border-primary/50 hover:bg-primary/5"
            />
          </div>
        );
      }

      case 'select':
        return (
          <Select 
            value={value || ''} 
            onValueChange={(val) => handleSave(definition.field_key, val)}
          >
            <SelectTrigger className="h-8 text-sm border-border/50 bg-transparent shadow-none min-w-[120px] hover:border-primary/50">
              <SelectValue placeholder="Selecionar" />
            </SelectTrigger>
            <SelectContent>
              {definition.options?.map((option) => (
                <SelectItem key={option} value={option}>{option}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'number':
        if (isEditing) {
          return (
            <div className="flex items-center gap-1 min-w-0">
              <Input
                type="number"
                value={localFields[definition.field_key] || ''}
                onChange={(e) => setLocalFields({ ...localFields, [definition.field_key]: e.target.value })}
                className="h-8 w-20 min-w-0 text-sm border-primary/30 focus:border-primary"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSave(definition.field_key, localFields[definition.field_key]);
                  if (e.key === 'Escape') setEditingField(null);
                }}
              />
              <Button size="icon" variant="default" className="h-7 w-7 shrink-0" onClick={() => handleSave(definition.field_key, localFields[definition.field_key])}>
                <Check className="h-3.5 w-3.5" />
              </Button>
              <Button size="icon" variant="outline" className="h-7 w-7 shrink-0" onClick={() => setEditingField(null)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          );
        }
        return (
          <button 
            onClick={() => setEditingField(definition.field_key)}
            className="text-sm text-foreground hover:text-primary hover:bg-primary/5 px-2 py-1.5 rounded-md transition-all flex items-center gap-2 group min-h-[32px]"
          >
            {formatDisplayValue(value, definition.field_name) || <span className="text-muted-foreground italic">Clique para editar</span>}
            <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-60 transition-opacity" />
          </button>
        );

      default: // text, url, phone, email
        if (isEditing) {
          return (
            <div className="flex items-center gap-1 min-w-0 w-full">
              <Input
                value={localFields[definition.field_key] || ''}
                onChange={(e) => setLocalFields({ ...localFields, [definition.field_key]: e.target.value })}
                className="h-8 flex-1 min-w-0 text-sm border-primary/30 focus:border-primary"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSave(definition.field_key, localFields[definition.field_key]);
                  if (e.key === 'Escape') setEditingField(null);
                }}
              />
              <Button size="icon" variant="default" className="h-7 w-7 shrink-0" onClick={() => handleSave(definition.field_key, localFields[definition.field_key])}>
                <Check className="h-3.5 w-3.5" />
              </Button>
              <Button size="icon" variant="outline" className="h-7 w-7 shrink-0" onClick={() => setEditingField(null)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          );
        }
        return (
          <button 
            onClick={() => setEditingField(definition.field_key)}
            className="text-sm text-foreground hover:text-primary hover:bg-primary/5 px-2 py-1.5 rounded-md transition-all flex items-center gap-2 group min-h-[32px] min-w-0 overflow-hidden max-w-full"
          >
            <span className="truncate block">{formatDisplayValue(value, definition.field_name) || <span className="text-muted-foreground italic">Clique para editar</span>}</span>
            <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-60 transition-opacity shrink-0" />
          </button>
        );
    }
  };

  if (!deal) {
    return null;
  }

  return (
    <div className="p-4 space-y-2 min-w-0 overflow-hidden w-full">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 mb-2 min-w-0">
        <div className="flex items-center gap-2 bg-primary/10 px-3 py-2 rounded-lg min-w-0">
          <Target className="h-4 w-4 text-primary shrink-0" />
          <span className="text-sm font-semibold text-primary truncate">Dados do Lead</span>
        </div>
        <CustomFieldsManager />
      </div>

      {/* Título do Lead - Campo Editável */}
      <div className="flex items-center justify-between py-3 px-2 rounded-lg hover:bg-muted/30 transition-colors border-b border-border/40 min-w-0 gap-2">
        <span className="text-xs font-medium text-foreground/70 shrink-0">Título do Lead</span>
        {isEditingTitle ? (
          <div className="flex items-center gap-1 min-w-0 flex-1 justify-end">
            <Input
              value={localTitle}
              onChange={(e) => setLocalTitle(e.target.value)}
              className="h-8 min-w-0 flex-1 text-sm border-primary/30 focus:border-primary"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveTitle();
                if (e.key === 'Escape') {
                  setLocalTitle(deal?.title || '');
                  setIsEditingTitle(false);
                }
              }}
            />
            <Button size="icon" variant="default" className="h-7 w-7 shrink-0" onClick={handleSaveTitle}>
              <Check className="h-3.5 w-3.5" />
            </Button>
            <Button size="icon" variant="outline" className="h-7 w-7 shrink-0" onClick={() => {
              setLocalTitle(deal?.title || '');
              setIsEditingTitle(false);
            }}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <button 
            onClick={() => setIsEditingTitle(true)}
            className="text-sm text-foreground hover:text-primary hover:bg-primary/5 px-2 py-1.5 rounded-md transition-all flex items-center gap-2 group min-h-[32px] min-w-0 overflow-hidden"
          >
            <span className="truncate">{deal?.title || <span className="text-muted-foreground italic">Clique para editar</span>}</span>
            <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-60 transition-opacity shrink-0" />
          </button>
        )}
      </div>

      {/* Valor da Venda (native deal.value) */}
      <div className="flex items-center justify-between py-3 px-2 rounded-lg hover:bg-muted/30 transition-colors border-b border-border/40 min-w-0 gap-2">
        <span className="text-xs font-medium text-foreground/70 shrink-0">Valor da Venda</span>
        <span className="text-sm text-foreground font-medium">
          {deal?.value != null ? `R$ ${Number(deal.value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : <span className="text-muted-foreground italic">—</span>}
        </span>
      </div>
      {(() => {
        const isFieldFilled = (field: CustomFieldDefinition) => {
          const val = localFields[field.field_key];
          if (field.field_type === 'boolean' || field.field_type === 'switch') return true;
          return val !== undefined && val !== null && val !== '';
        };

        const filledFields = allVisibleFields.filter(f => isFieldFilled(f) || manuallyAdded.has(f.field_key));
        const emptyFields = allVisibleFields.filter(f => !isFieldFilled(f) && !manuallyAdded.has(f.field_key));

        return (
          <>
            {filledFields.length === 0 && emptyFields.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum campo configurado para esta aba
              </p>
            ) : (
              filledFields.map((field) => (
                <div key={field.id} className="flex items-center justify-between py-3 px-2 rounded-lg hover:bg-muted/30 transition-colors border-b border-border/40 min-w-0 gap-2 overflow-hidden">
                  <span className="text-xs font-medium text-foreground/70 shrink-0 max-w-[40%] truncate">{field.field_name}</span>
                  <div className="flex justify-end items-center min-w-0 overflow-hidden max-w-[60%]">
                    {renderFieldValue(field)}
                  </div>
                </div>
              ))
            )}

            {emptyFields.length > 0 && (
              <div className="pt-2">
                <Select
                  value=""
                  onValueChange={(fieldKey) => {
                    setManuallyAdded(prev => new Set(prev).add(fieldKey));
                    setEditingField(fieldKey);
                  }}
                >
                  <SelectTrigger className="h-8 text-xs border-dashed border-border/50 bg-transparent text-muted-foreground hover:border-primary/50 hover:text-foreground">
                    <div className="flex items-center gap-1.5">
                      <Plus className="h-3.5 w-3.5" />
                      <span>Preencher campo ({emptyFields.length})</span>
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    {emptyFields.map((field) => (
                      <SelectItem key={field.id} value={field.field_key}>
                        {field.field_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </>
        );
      })()}
    </div>
  );
};
