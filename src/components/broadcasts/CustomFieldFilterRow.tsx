import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { CustomFieldDefinition } from "@/hooks/useCustomFields";
import { CustomFieldOperator } from "@/hooks/useBroadcastLists";

interface CustomFieldFilterRowProps {
  fieldKey: string;
  operator: CustomFieldOperator;
  value?: string;
  availableFields: CustomFieldDefinition[];
  onChangeField: (newFieldKey: string) => void;
  onChangeOperator: (operator: CustomFieldOperator) => void;
  onChangeValue: (value: string) => void;
  onRemove: () => void;
}

const OPERATORS: { value: CustomFieldOperator; label: string }[] = [
  { value: 'equals', label: 'Igual a' },
  { value: 'contains', label: 'Contém' },
  { value: 'not_empty', label: 'Não está vazio' },
  { value: 'empty', label: 'Está vazio' },
];

export const CustomFieldFilterRow = ({
  fieldKey,
  operator,
  value,
  availableFields,
  onChangeField,
  onChangeOperator,
  onChangeValue,
  onRemove,
}: CustomFieldFilterRowProps) => {
  const showValueInput = operator === 'equals' || operator === 'contains';

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Select value={fieldKey} onValueChange={onChangeField}>
        <SelectTrigger className="w-[140px] h-9 text-sm">
          <SelectValue placeholder="Campo" />
        </SelectTrigger>
        <SelectContent>
          {availableFields.map((field) => (
            <SelectItem key={field.id} value={field.field_key}>
              {field.field_name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={operator} onValueChange={(v) => onChangeOperator(v as CustomFieldOperator)}>
        <SelectTrigger className="w-[130px] h-9 text-sm">
          <SelectValue placeholder="Operador" />
        </SelectTrigger>
        <SelectContent>
          {OPERATORS.map((op) => (
            <SelectItem key={op.value} value={op.value}>
              {op.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {showValueInput && (
        <Input
          value={value || ''}
          onChange={(e) => onChangeValue(e.target.value)}
          placeholder="Valor"
          className="w-[120px] h-9 text-sm"
        />
      )}

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-9 w-9 text-muted-foreground hover:text-destructive"
        onClick={onRemove}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
};