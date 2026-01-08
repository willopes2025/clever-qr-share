import { useState, useEffect } from "react";
import { Check, X, Database, Pencil } from "lucide-react";
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
import { useCustomFields, CustomFieldDefinition } from "@/hooks/useCustomFields";
import { useLeadPanelTabs } from "@/hooks/useLeadPanelTabs";
import { AssigneeSelector } from "@/components/calendar/AssigneeSelector";
import { useLeadDistribution } from "@/hooks/useLeadDistribution";
import { Conversation } from "@/hooks/useConversations";
import { CustomFieldsManager } from "../CustomFieldsManager";
import { toast } from "sonner";

interface LeadPanelTabContentProps {
  conversation: Conversation;
  activeTabId: string | null;
}

export const LeadPanelTabContent = ({ conversation, activeTabId }: LeadPanelTabContentProps) => {
  const { fieldDefinitions, updateContactCustomFields } = useCustomFields();
  const { tabs } = useLeadPanelTabs();
  const { assignConversation } = useLeadDistribution();
  
  const customFields = conversation.contact?.custom_fields || {};
  const [localFields, setLocalFields] = useState<Record<string, any>>(customFields);
  const [editingField, setEditingField] = useState<string | null>(null);

  useEffect(() => {
    setLocalFields(customFields);
  }, [JSON.stringify(customFields)]);

  const activeTab = tabs?.find(t => t.id === activeTabId);
  const tabFieldKeys = activeTab?.field_keys || [];

  // Get fields to display: if tab has specific fields, show those; otherwise show all
  const fieldsToShow = fieldDefinitions?.filter(field => {
    if (tabFieldKeys.length === 0) return true;
    return tabFieldKeys.includes(field.field_key);
  }) || [];

  const handleSave = async (fieldKey: string, value: any) => {
    const updatedFields = { ...localFields, [fieldKey]: value };
    setLocalFields(updatedFields);
    await updateContactCustomFields.mutateAsync({
      contactId: conversation.contact_id,
      customFields: updatedFields,
    });
    toast.success("Campo atualizado com sucesso");
    setEditingField(null);
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

      case 'date':
        return (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 px-3 text-sm justify-start font-normal border-border/50 hover:border-primary/50 hover:bg-primary/5">
                {value ? format(new Date(value), "dd/MM/yyyy", { locale: ptBR }) : <span className="text-muted-foreground">Selecionar data</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={value ? new Date(value) : undefined}
                onSelect={(date) => handleSave(definition.field_key, date?.toISOString())}
                locale={ptBR}
              />
            </PopoverContent>
          </Popover>
        );

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
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={localFields[definition.field_key] || ''}
                onChange={(e) => setLocalFields({ ...localFields, [definition.field_key]: e.target.value })}
                className="h-8 w-28 text-sm border-primary/30 focus:border-primary"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSave(definition.field_key, localFields[definition.field_key]);
                  if (e.key === 'Escape') setEditingField(null);
                }}
              />
              <Button size="icon" variant="default" className="h-7 w-7" onClick={() => handleSave(definition.field_key, localFields[definition.field_key])}>
                <Check className="h-3.5 w-3.5" />
              </Button>
              <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setEditingField(null)}>
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
            {value || <span className="text-muted-foreground italic">Clique para editar</span>}
            <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-60 transition-opacity" />
          </button>
        );

      default: // text, url, phone, email
        if (isEditing) {
          return (
            <div className="flex items-center gap-2">
              <Input
                value={localFields[definition.field_key] || ''}
                onChange={(e) => setLocalFields({ ...localFields, [definition.field_key]: e.target.value })}
                className="h-8 flex-1 text-sm border-primary/30 focus:border-primary"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSave(definition.field_key, localFields[definition.field_key]);
                  if (e.key === 'Escape') setEditingField(null);
                }}
              />
              <Button size="icon" variant="default" className="h-7 w-7" onClick={() => handleSave(definition.field_key, localFields[definition.field_key])}>
                <Check className="h-3.5 w-3.5" />
              </Button>
              <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setEditingField(null)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          );
        }
        return (
          <button 
            onClick={() => setEditingField(definition.field_key)}
            className="text-sm text-foreground hover:text-primary hover:bg-primary/5 px-2 py-1.5 rounded-md transition-all flex items-center gap-2 group min-h-[32px] max-w-[180px]"
          >
            <span className="truncate">{value || <span className="text-muted-foreground italic">Clique para editar</span>}</span>
            <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-60 transition-opacity shrink-0" />
          </button>
        );
    }
  };

  return (
    <div className="p-4 space-y-2">
      {/* Header with fields manager */}
      <div className="flex items-center justify-between pb-3 mb-2">
        <div className="flex items-center gap-2 bg-primary/10 px-3 py-2 rounded-lg">
          <Database className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-primary">Dados do Lead</span>
        </div>
        <CustomFieldsManager />
      </div>

      {/* Responsável (sempre visível) */}
      <div className="flex items-center justify-between py-3 px-2 rounded-lg hover:bg-muted/30 transition-colors border-b border-border/40">
        <span className="text-xs font-medium text-foreground/70">Responsável</span>
        <div className="flex-1 flex justify-end">
          <AssigneeSelector
            value={conversation.assigned_to || null}
            onChange={(memberId) => {
              assignConversation.mutate({
                conversationId: conversation.id,
                memberId: memberId || '',
              });
            }}
            compact
          />
        </div>
      </div>

      {/* Custom Fields */}
      {fieldsToShow.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">
          Nenhum campo configurado para esta aba
        </p>
      ) : (
        fieldsToShow.map((field) => (
          <div key={field.id} className="flex items-center justify-between py-3 px-2 rounded-lg hover:bg-muted/30 transition-colors border-b border-border/40">
            <span className="text-xs font-medium text-foreground/70">{field.field_name}</span>
            <div className="flex-1 flex justify-end items-center">
              {renderFieldValue(field)}
            </div>
          </div>
        ))
      )}
    </div>
  );
};
