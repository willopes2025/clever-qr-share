import { useState, useEffect } from "react";
import { Check, X, Database } from "lucide-react";
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
              <Button variant="ghost" size="sm" className="h-7 px-2 text-sm justify-start font-normal">
                {value ? format(new Date(value), "dd/MM/yyyy", { locale: ptBR }) : "Selecionar"}
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
            <SelectTrigger className="h-7 text-sm border-0 bg-transparent shadow-none p-0 w-auto min-w-[100px]">
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
            <div className="flex items-center gap-1">
              <Input
                type="number"
                value={localFields[definition.field_key] || ''}
                onChange={(e) => setLocalFields({ ...localFields, [definition.field_key]: e.target.value })}
                className="h-7 w-24 text-sm"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSave(definition.field_key, localFields[definition.field_key]);
                  if (e.key === 'Escape') setEditingField(null);
                }}
              />
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleSave(definition.field_key, localFields[definition.field_key])}>
                <Check className="h-3 w-3 text-primary" />
              </Button>
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditingField(null)}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          );
        }
        return (
          <button 
            onClick={() => setEditingField(definition.field_key)}
            className="text-sm hover:text-primary transition-colors text-left"
          >
            {value || <span className="text-muted-foreground">-</span>}
          </button>
        );

      default: // text, url, phone, email
        if (isEditing) {
          return (
            <div className="flex items-center gap-1">
              <Input
                value={localFields[definition.field_key] || ''}
                onChange={(e) => setLocalFields({ ...localFields, [definition.field_key]: e.target.value })}
                className="h-7 flex-1 text-sm"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSave(definition.field_key, localFields[definition.field_key]);
                  if (e.key === 'Escape') setEditingField(null);
                }}
              />
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleSave(definition.field_key, localFields[definition.field_key])}>
                <Check className="h-3 w-3 text-primary" />
              </Button>
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditingField(null)}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          );
        }
        return (
          <button 
            onClick={() => setEditingField(definition.field_key)}
            className="text-sm hover:text-primary transition-colors text-left truncate max-w-[150px]"
          >
            {value || <span className="text-muted-foreground">-</span>}
          </button>
        );
    }
  };

  return (
    <div className="p-3 space-y-1">
      {/* Header with fields manager */}
      <div className="flex items-center justify-between pb-2 mb-1">
        <div className="flex items-center gap-1.5">
          <Database className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium">Dados do Lead</span>
        </div>
        <CustomFieldsManager />
      </div>

      {/* Responsável (sempre visível) */}
      <div className="flex items-center justify-between py-1.5 border-b border-border/20">
        <span className="text-xs text-muted-foreground">Responsável</span>
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
        <p className="text-sm text-muted-foreground text-center py-4">
          Nenhum campo configurado para esta aba
        </p>
      ) : (
        fieldsToShow.map((field) => (
          <div key={field.id} className="flex items-center justify-between py-1.5 border-b border-border/20">
            <span className="text-xs text-muted-foreground truncate max-w-[120px]">{field.field_name}</span>
            <div className="flex-1 flex justify-end items-center">
              {renderFieldValue(field)}
            </div>
          </div>
        ))
      )}
    </div>
  );
};
