import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useCustomFields } from "@/hooks/useCustomFields";

interface DealCustomFieldsEditorProps {
  values: Record<string, unknown>;
  onChange: (values: Record<string, unknown>) => void;
}

export const DealCustomFieldsEditor = ({ values, onChange }: DealCustomFieldsEditorProps) => {
  const { leadFieldDefinitions } = useCustomFields();

  const handleChange = (key: string, value: unknown) => {
    onChange({ ...values, [key]: value });
  };

  if (!leadFieldDefinitions || leadFieldDefinitions.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4 border-t pt-4">
      <Label className="text-sm font-medium text-muted-foreground">Campos do Lead</Label>
      
      {leadFieldDefinitions.map((field) => (
        <div key={field.id} className="space-y-2">
          <Label htmlFor={field.field_key} className="text-sm">
            {field.field_name}
            {field.is_required && <span className="text-destructive ml-1">*</span>}
          </Label>
          
          {field.field_type === 'text' && (
            <Input
              id={field.field_key}
              value={(values[field.field_key] as string) || ''}
              onChange={(e) => handleChange(field.field_key, e.target.value)}
              placeholder={`Digite ${field.field_name.toLowerCase()}`}
              required={field.is_required || false}
            />
          )}
          
          {field.field_type === 'number' && (
            <Input
              id={field.field_key}
              type="number"
              value={(values[field.field_key] as number) || ''}
              onChange={(e) => handleChange(field.field_key, Number(e.target.value))}
              placeholder="0"
              required={field.is_required || false}
            />
          )}
          
          {field.field_type === 'date' && (
            <Input
              id={field.field_key}
              type="date"
              value={(values[field.field_key] as string) || ''}
              onChange={(e) => handleChange(field.field_key, e.target.value)}
              required={field.is_required || false}
            />
          )}
          
          {field.field_type === 'select' && (
            <Select
              value={(values[field.field_key] as string) || ''}
              onValueChange={(v) => handleChange(field.field_key, v)}
              required={field.is_required || false}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma opção" />
              </SelectTrigger>
              <SelectContent>
                {(field.options as string[] || []).map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          
          {field.field_type === 'boolean' && (
            <div className="flex items-center space-x-2">
              <Checkbox
                id={field.field_key}
                checked={(values[field.field_key] as boolean) || false}
                onCheckedChange={(checked) => handleChange(field.field_key, checked)}
              />
              <label htmlFor={field.field_key} className="text-sm text-muted-foreground">
                Marcar como {field.field_name.toLowerCase()}
              </label>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
