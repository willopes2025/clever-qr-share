import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Check, X, Pencil } from "lucide-react";
import { format, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { CustomFieldDefinition, useCustomFields } from "@/hooks/useCustomFields";
import { toast } from "sonner";

interface CustomFieldsEditorProps {
  contactId: string;
  customFields: Record<string, any>;
  hideEmptyFields?: boolean;
}

export const CustomFieldsEditor = ({ contactId, customFields, hideEmptyFields = false }: CustomFieldsEditorProps) => {
  const { fieldDefinitions, updateContactCustomFields } = useCustomFields();
  const [localFields, setLocalFields] = useState<Record<string, any>>(customFields || {});
  const [editingField, setEditingField] = useState<string | null>(null);

  useEffect(() => {
    setLocalFields(customFields || {});
  }, [customFields]);

  const handleSave = async (fieldKey: string) => {
    await updateContactCustomFields.mutateAsync({
      contactId,
      customFields: localFields,
    });
    toast.success("Campo atualizado com sucesso");
    setEditingField(null);
  };

  const handleFieldChange = (fieldKey: string, value: any) => {
    setLocalFields(prev => ({
      ...prev,
      [fieldKey]: value,
    }));
  };

  const renderField = (definition: CustomFieldDefinition) => {
    const value = localFields[definition.field_key];
    const isEditing = editingField === definition.field_key;

    switch (definition.field_type) {
      case 'text':
        return (
          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <Input
                  value={value || ''}
                  onChange={(e) => handleFieldChange(definition.field_key, e.target.value)}
                  className="h-9 text-sm flex-1 border-primary/30 focus:border-primary"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSave(definition.field_key);
                    if (e.key === 'Escape') setEditingField(null);
                  }}
                />
                <Button size="icon" variant="default" className="h-8 w-8" onClick={() => handleSave(definition.field_key)}>
                  <Check className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => setEditingField(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <button 
                className="text-sm text-foreground cursor-pointer hover:text-primary hover:bg-primary/5 px-2 py-1.5 rounded-md transition-all flex items-center gap-2 group flex-1 min-h-[36px]"
                onClick={() => setEditingField(definition.field_key)}
              >
                {value || <span className="text-muted-foreground italic">Clique para editar</span>}
                <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-60 transition-opacity" />
              </button>
            )}
          </div>
        );

      case 'number':
        return (
          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <Input
                  type="number"
                  value={value ?? ''}
                  onChange={(e) => handleFieldChange(definition.field_key, e.target.value ? Number(e.target.value) : null)}
                  className="h-9 text-sm flex-1 border-primary/30 focus:border-primary"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSave(definition.field_key);
                    if (e.key === 'Escape') setEditingField(null);
                  }}
                />
                <Button size="icon" variant="default" className="h-8 w-8" onClick={() => handleSave(definition.field_key)}>
                  <Check className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => setEditingField(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <button 
                className="text-sm text-foreground cursor-pointer hover:text-primary hover:bg-primary/5 px-2 py-1.5 rounded-md transition-all flex items-center gap-2 group flex-1 min-h-[36px]"
                onClick={() => setEditingField(definition.field_key)}
              >
                {value !== undefined && value !== null ? value : <span className="text-muted-foreground italic">Clique para editar</span>}
                <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-60 transition-opacity" />
              </button>
            )}
          </div>
        );

      case 'boolean':
        return (
          <Switch
            checked={value ?? false}
            onCheckedChange={(checked) => {
              handleFieldChange(definition.field_key, checked);
              updateContactCustomFields.mutate({
                contactId,
                customFields: { ...localFields, [definition.field_key]: checked },
              });
              toast.success("Campo atualizado com sucesso");
            }}
          />
        );

      case 'date':
        const dateValue = value ? (isValid(new Date(value)) ? new Date(value) : undefined) : undefined;
        return (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "h-9 justify-start text-left font-normal w-full border-border/50 hover:border-primary/50 hover:bg-primary/5",
                  !dateValue && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateValue ? format(dateValue, "dd/MM/yyyy", { locale: ptBR }) : "Selecionar data"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dateValue}
                onSelect={(date) => {
                  const isoDate = date ? date.toISOString() : null;
                  handleFieldChange(definition.field_key, isoDate);
                  updateContactCustomFields.mutate({
                    contactId,
                    customFields: { ...localFields, [definition.field_key]: isoDate },
                  });
                  toast.success("Campo atualizado com sucesso");
                }}
                locale={ptBR}
              />
            </PopoverContent>
          </Popover>
        );

      case 'select':
        return (
          <Select
            value={value || ''}
            onValueChange={(val) => {
              handleFieldChange(definition.field_key, val);
              updateContactCustomFields.mutate({
                contactId,
                customFields: { ...localFields, [definition.field_key]: val },
              });
              toast.success("Campo atualizado com sucesso");
            }}
          >
            <SelectTrigger className="h-9 text-sm border-border/50 hover:border-primary/50">
              <SelectValue placeholder="Selecionar..." />
            </SelectTrigger>
            <SelectContent>
              {(definition.options || []).map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      default:
        return null;
    }
  };

  if (!fieldDefinitions || fieldDefinitions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        Nenhum campo personalizado configurado
      </p>
    );
  }

  // Filter fields based on hideEmptyFields
  const isFieldEmpty = (fieldKey: string) => {
    const value = localFields[fieldKey];
    return value === undefined || value === null || value === '';
  };

  const visibleFields = hideEmptyFields 
    ? fieldDefinitions.filter(def => !isFieldEmpty(def.field_key))
    : fieldDefinitions;

  if (hideEmptyFields && visibleFields.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        Nenhum campo com dados
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {visibleFields.map((definition) => (
        <div key={definition.id} className="space-y-1.5 py-2 px-2 rounded-lg hover:bg-muted/30 transition-colors">
          <label className="text-xs font-medium text-foreground/70 flex items-center gap-1">
            {definition.field_name}
            {definition.is_required && <span className="text-destructive">*</span>}
          </label>
          {renderField(definition)}
        </div>
      ))}
    </div>
  );
};
