import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Check, X } from "lucide-react";
import { format, parseISO, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { CustomFieldDefinition, useCustomFields } from "@/hooks/useCustomFields";

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
                  className="h-8 text-sm flex-1"
                  autoFocus
                />
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleSave(definition.field_key)}>
                  <Check className="h-3 w-3 text-primary" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingField(null)}>
                  <X className="h-3 w-3" />
                </Button>
              </>
            ) : (
              <span 
                className="text-sm text-foreground cursor-pointer hover:text-primary flex-1"
                onClick={() => setEditingField(definition.field_key)}
              >
                {value || <span className="text-muted-foreground">Não definido</span>}
              </span>
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
                  className="h-8 text-sm flex-1"
                  autoFocus
                />
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleSave(definition.field_key)}>
                  <Check className="h-3 w-3 text-primary" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingField(null)}>
                  <X className="h-3 w-3" />
                </Button>
              </>
            ) : (
              <span 
                className="text-sm text-foreground cursor-pointer hover:text-primary flex-1"
                onClick={() => setEditingField(definition.field_key)}
              >
                {value !== undefined && value !== null ? value : <span className="text-muted-foreground">Não definido</span>}
              </span>
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
                  "h-8 justify-start text-left font-normal w-full",
                  !dateValue && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-3 w-3" />
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
            }}
          >
            <SelectTrigger className="h-8 text-sm">
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
      <p className="text-xs text-muted-foreground text-center py-2">
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
      <p className="text-xs text-muted-foreground text-center py-2">
        Nenhum campo com dados
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {visibleFields.map((definition) => (
        <div key={definition.id} className="space-y-1">
          <label className="text-xs text-muted-foreground flex items-center gap-1">
            {definition.field_name}
            {definition.is_required && <span className="text-destructive">*</span>}
          </label>
          {renderField(definition)}
        </div>
      ))}
    </div>
  );
};
