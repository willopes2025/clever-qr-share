import { useState } from "react";
import { format, parse } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCustomFields } from "@/hooks/useCustomFields";
import { useFieldRequiredRules } from "@/hooks/useFieldRequiredRules";
import { useFunnels } from "@/hooks/useFunnels";
import { getRequiredFieldsForStage } from "@/lib/required-fields";
import { isDateLikeFieldName, parseAnyDateValue } from "@/lib/date-utils";

interface DealCustomFieldsEditorProps {
  values: Record<string, unknown>;
  onChange: (values: Record<string, unknown>) => void;
  /** Quando informado, calcula obrigatoriedade condicional por etapa do funil. */
  funnelId?: string;
  stageId?: string;
}

export const DealCustomFieldsEditor = ({ values, onChange, funnelId, stageId }: DealCustomFieldsEditorProps) => {
  const { leadFieldDefinitions } = useCustomFields();
  const { rules } = useFieldRequiredRules();
  const { funnels } = useFunnels();

  // Calcula quais field_keys são obrigatórios na etapa atual
  const requiredKeys = (() => {
    if (!funnelId || !stageId || !leadFieldDefinitions) return new Set<string>();
    const funnel = funnels?.find((f) => f.id === funnelId);
    if (!funnel) return new Set<string>();
    const required = getRequiredFieldsForStage({
      funnelId,
      stageId,
      stages: funnel.stages || [],
      fieldDefinitions: leadFieldDefinitions,
      rules: rules || [],
    });
    return new Set(required.map((f) => f.field_key));
  })();

  const isFieldRequired = (field: { field_key: string; is_required: boolean }) =>
    field.is_required || requiredKeys.has(field.field_key);

  const handleChange = (key: string, value: unknown) => {
    onChange({ ...values, [key]: value });
  };

  const toggleMultiSelectValue = (key: string, option: string) => {
    const currentValues = Array.isArray(values[key])
      ? (values[key] as string[])
      : typeof values[key] === 'string' && values[key]
        ? [values[key] as string]
        : [];

    const nextValues = currentValues.includes(option)
      ? currentValues.filter((value) => value !== option)
      : [...currentValues, option];

    handleChange(key, nextValues);
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
            {isFieldRequired(field) && <span className="text-destructive ml-1">*</span>}
          </Label>
          
          {field.field_type === 'text' && (
            isDateLikeFieldName(field.field_name) ? (
              <DateFieldPicker
                value={normalizeDateLikeValue((values[field.field_key] as string) || '')}
                onChange={(v) => handleChange(field.field_key, v)}
              />
            ) : (
              <Input
                id={field.field_key}
                value={(values[field.field_key] as string) || ''}
                onChange={(e) => handleChange(field.field_key, e.target.value)}
                placeholder={`Digite ${field.field_name.toLowerCase()}`}
                required={isFieldRequired(field)}
              />
            )
          )}

          {field.field_type === 'url' && (
            <Input
              id={field.field_key}
              type="url"
              value={(values[field.field_key] as string) || ''}
              onChange={(e) => handleChange(field.field_key, e.target.value)}
              placeholder="https://exemplo.com"
              required={isFieldRequired(field)}
            />
          )}

          {field.field_type === 'phone' && (
            <Input
              id={field.field_key}
              type="tel"
              value={(values[field.field_key] as string) || ''}
              onChange={(e) => handleChange(field.field_key, e.target.value)}
              placeholder="(00) 00000-0000"
              required={isFieldRequired(field)}
            />
          )}

          {field.field_type === 'email' && (
            <Input
              id={field.field_key}
              type="email"
              value={(values[field.field_key] as string) || ''}
              onChange={(e) => handleChange(field.field_key, e.target.value)}
              placeholder="email@exemplo.com"
              required={isFieldRequired(field)}
            />
          )}
          
          {field.field_type === 'number' && (
            <Input
              id={field.field_key}
              type="number"
              value={(values[field.field_key] as number) || ''}
              onChange={(e) => handleChange(field.field_key, Number(e.target.value))}
              placeholder="0"
              required={isFieldRequired(field)}
            />
          )}
          
          {field.field_type === 'date' && (
            <DateFieldPicker
              value={(values[field.field_key] as string) || ''}
              onChange={(v) => handleChange(field.field_key, v)}
            />
          )}

          {field.field_type === 'time' && (
            <Input
              id={field.field_key}
              type="time"
              value={(values[field.field_key] as string) || ''}
              onChange={(e) => handleChange(field.field_key, e.target.value)}
              required={isFieldRequired(field)}
            />
          )}

          {field.field_type === 'datetime' && (
            <DateTimeFieldPicker
              value={(values[field.field_key] as string) || ''}
              onChange={(v) => handleChange(field.field_key, v)}
            />
          )}
          
          {field.field_type === 'select' && (
            <Select
              value={(values[field.field_key] as string) || ''}
              onValueChange={(v) => handleChange(field.field_key, v)}
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

          {field.field_type === 'multi_select' && (
            <div className="space-y-2 rounded-md border border-border p-3">
              <div className="flex flex-wrap gap-2">
                {(Array.isArray(values[field.field_key]) ? (values[field.field_key] as string[]) : []).length > 0 ? (
                  (values[field.field_key] as string[]).map((selected) => (
                    <span
                      key={selected}
                      className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
                    >
                      {selected}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">Nenhuma etapa selecionada</span>
                )}
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                {(field.options as string[] || []).map((option) => {
                  const selectedValues = Array.isArray(values[field.field_key])
                    ? (values[field.field_key] as string[])
                    : [];
                  const isSelected = selectedValues.includes(option);

                  return (
                    <Button
                      key={option}
                      type="button"
                      variant={isSelected ? 'default' : 'outline'}
                      className="justify-start"
                      onClick={() => toggleMultiSelectValue(field.field_key, option)}
                    >
                      {option}
                    </Button>
                  );
                })}
              </div>
            </div>
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

          {field.field_type === 'switch' && (
            <div className="flex items-center space-x-2">
              <Switch
                id={field.field_key}
                checked={(values[field.field_key] as boolean) || false}
                onCheckedChange={(checked) => handleChange(field.field_key, checked)}
              />
              <label htmlFor={field.field_key} className="text-sm text-muted-foreground">
                {field.field_name}
              </label>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

function normalizeDateLikeValue(raw: string): string {
  if (!raw) return '';
  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parsed = parseAnyDateValue(raw);
  if (!parsed) return '';
  return format(parsed, 'yyyy-MM-dd');
}

function DateFieldPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const normalized = value ? (/^\d{4}-\d{2}-\d{2}$/.test(value) ? value : (parseAnyDateValue(value) ? format(parseAnyDateValue(value)!, 'yyyy-MM-dd') : '')) : '';
  const selected = normalized ? parse(normalized, 'yyyy-MM-dd', new Date()) : undefined;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !normalized && "text-muted-foreground")}>
          <CalendarIcon className="mr-2 h-4 w-4" />
          {normalized ? format(parse(normalized, 'yyyy-MM-dd', new Date()), 'dd/MM/yyyy') : "Selecione uma data"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(d) => onChange(d ? format(d, 'yyyy-MM-dd') : '')}
          initialFocus
          className="p-3 pointer-events-auto"
        />
      </PopoverContent>
    </Popover>
  );
}

function DateTimeFieldPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [datePart, timePart] = (value || '').split('T');
  const selected = datePart ? parse(datePart, 'yyyy-MM-dd', new Date()) : undefined;

  const updateDate = (d: Date | undefined) => {
    const newDate = d ? format(d, 'yyyy-MM-dd') : '';
    onChange(newDate ? `${newDate}T${timePart || '00:00'}` : '');
  };

  const updateTime = (t: string) => {
    onChange(datePart ? `${datePart}T${t}` : `${format(new Date(), 'yyyy-MM-dd')}T${t}`);
  };

  return (
    <div className="flex gap-2">
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className={cn("flex-1 justify-start text-left font-normal", !datePart && "text-muted-foreground")}>
            <CalendarIcon className="mr-2 h-4 w-4" />
            {datePart ? format(parse(datePart, 'yyyy-MM-dd', new Date()), 'dd/MM/yyyy') : "Data"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selected}
            onSelect={updateDate}
            initialFocus
            className="p-3 pointer-events-auto"
          />
        </PopoverContent>
      </Popover>
      <Input
        type="time"
        value={timePart || ''}
        onChange={(e) => updateTime(e.target.value)}
        className="w-28"
      />
    </div>
  );
}
