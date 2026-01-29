import { useState, useEffect } from "react";
import { Check, X, Pencil, User, Plus } from "lucide-react";
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
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { InlineFieldCreator } from "@/components/contacts/InlineFieldCreator";

interface ContactFieldsSectionProps {
  contact: {
    id: string;
    name?: string | null;
    phone?: string;
    email?: string | null;
    custom_fields?: Record<string, any> | null;
  };
}

export const ContactFieldsSection = ({ contact }: ContactFieldsSectionProps) => {
  const { contactFieldDefinitions, updateContactCustomFields, createField } = useCustomFields();
  const queryClient = useQueryClient();
  
  const customFields = (contact.custom_fields || {}) as Record<string, any>;
  const [localFields, setLocalFields] = useState<Record<string, any>>(customFields);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [showFieldCreator, setShowFieldCreator] = useState(false);
  
  // Estado para edição do nome do contato
  const [isEditingName, setIsEditingName] = useState(false);
  const [localName, setLocalName] = useState(contact.name || '');

  useEffect(() => {
    setLocalFields(customFields);
  }, [JSON.stringify(customFields)]);

  useEffect(() => {
    setLocalName(contact.name || '');
  }, [contact.name]);

  const handleSaveName = async () => {
    const { error } = await supabase
      .from('contacts')
      .update({ name: localName })
      .eq('id', contact.id);
    
    if (error) {
      toast.error("Erro ao atualizar nome");
      return;
    }
    
    queryClient.invalidateQueries({ queryKey: ['conversations'] });
    queryClient.invalidateQueries({ queryKey: ['contacts'] });
    toast.success("Nome atualizado");
    setIsEditingName(false);
  };

  const handleSave = async (fieldKey: string, value: any) => {
    const updatedFields = { ...localFields, [fieldKey]: value };
    setLocalFields(updatedFields);
    await updateContactCustomFields.mutateAsync({
      contactId: contact.id,
      customFields: updatedFields,
    });
    toast.success("Campo atualizado");
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
                {value ? format(new Date(value), "dd/MM/yyyy", { locale: ptBR }) : <span className="text-muted-foreground">Selecionar</span>}
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
      {/* Header */}
      <div className="flex items-center gap-2 bg-muted/50 px-3 py-2 rounded-lg mb-3">
        <User className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-semibold text-muted-foreground">Dados do Contato</span>
      </div>

      {/* Nome Completo - Campo Editável */}
      <div className="flex items-center justify-between py-3 px-2 rounded-lg hover:bg-muted/30 transition-colors border-b border-border/40">
        <span className="text-xs font-medium text-foreground/70">Nome Completo</span>
        {isEditingName ? (
          <div className="flex items-center gap-2">
            <Input
              value={localName}
              onChange={(e) => setLocalName(e.target.value)}
              className="h-8 w-40 text-sm border-primary/30 focus:border-primary"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveName();
                if (e.key === 'Escape') {
                  setLocalName(contact.name || '');
                  setIsEditingName(false);
                }
              }}
            />
            <Button size="icon" variant="default" className="h-7 w-7" onClick={handleSaveName}>
              <Check className="h-3.5 w-3.5" />
            </Button>
            <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => {
              setLocalName(contact.name || '');
              setIsEditingName(false);
            }}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <button 
            onClick={() => setIsEditingName(true)}
            className="text-sm text-foreground hover:text-primary hover:bg-primary/5 px-2 py-1.5 rounded-md transition-all flex items-center gap-2 group min-h-[32px] max-w-[180px]"
          >
            <span className="truncate">{contact.name || <span className="text-muted-foreground italic">Clique para editar</span>}</span>
            <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-60 transition-opacity shrink-0" />
          </button>
        )}
      </div>

      {/* Standard Contact Fields */}
      <div className="flex items-center justify-between py-3 px-2 rounded-lg hover:bg-muted/30 transition-colors border-b border-border/40">
        <span className="text-xs font-medium text-foreground/70">Telefone</span>
        <span className="text-sm text-foreground">{contact.phone || '-'}</span>
      </div>
      
      {contact.email && (
        <div className="flex items-center justify-between py-3 px-2 rounded-lg hover:bg-muted/30 transition-colors border-b border-border/40">
          <span className="text-xs font-medium text-foreground/70">Email</span>
          <span className="text-sm text-foreground truncate max-w-[180px]">{contact.email}</span>
        </div>
      )}

      {/* Custom Contact Fields */}
      {contactFieldDefinitions.map((field) => (
        <div key={field.id} className="flex items-center justify-between py-3 px-2 rounded-lg hover:bg-muted/30 transition-colors border-b border-border/40">
          <span className="text-xs font-medium text-foreground/70">{field.field_name}</span>
          <div className="flex-1 flex justify-end items-center">
            {renderFieldValue(field)}
          </div>
        </div>
      ))}

      {/* Add Field Button / Creator */}
      {showFieldCreator ? (
        <div className="mt-3">
          <InlineFieldCreator
            onSave={(fieldData) => {
              createField.mutate(fieldData, {
                onSuccess: () => {
                  setShowFieldCreator(false);
                }
              });
            }}
            onCancel={() => setShowFieldCreator(false)}
            isLoading={createField.isPending}
            defaultEntityType="contact"
          />
        </div>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowFieldCreator(true)}
          className="w-full mt-3 text-muted-foreground hover:text-primary hover:bg-primary/5 border border-dashed border-border/50 hover:border-primary/50"
        >
          <Plus className="h-4 w-4 mr-2" />
          Adicionar Campo
        </Button>
      )}
    </div>
  );
};
