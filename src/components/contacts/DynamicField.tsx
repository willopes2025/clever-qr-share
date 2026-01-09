import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { CustomFieldDefinition } from "@/hooks/useCustomFields";

interface DynamicFieldProps {
  definition: CustomFieldDefinition;
  value: unknown;
  onChange: (value: unknown) => void;
  onAddOption?: (fieldId: string, option: string) => void;
}

export const DynamicField = ({
  definition,
  value,
  onChange,
  onAddOption,
}: DynamicFieldProps) => {
  const [isAddingOption, setIsAddingOption] = useState(false);
  const [newOption, setNewOption] = useState("");

  const handleAddOption = () => {
    if (newOption.trim() && onAddOption) {
      onAddOption(definition.id, newOption.trim());
      onChange(newOption.trim());
      setNewOption("");
      setIsAddingOption(false);
    }
  };

  const options = (definition.options as string[]) || [];

  switch (definition.field_type) {
    case "text":
    case "phone":
      return (
        <Input
          placeholder={`Digite ${definition.field_name.toLowerCase()}`}
          value={(value as string) || ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case "number":
      return (
        <Input
          type="number"
          placeholder={`Digite ${definition.field_name.toLowerCase()}`}
          value={(value as string) || ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case "email":
      return (
        <Input
          type="email"
          placeholder="email@exemplo.com"
          value={(value as string) || ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case "url":
      return (
        <Input
          type="url"
          placeholder="https://exemplo.com"
          value={(value as string) || ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case "date":
      return (
        <Input
          type="date"
          value={(value as string) || ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case "time":
      return (
        <Input
          type="time"
          value={(value as string) || ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case "datetime":
      return (
        <Input
          type="datetime-local"
          value={(value as string) || ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case "boolean":
      return (
        <div className="flex items-center gap-2">
          <Checkbox
            checked={(value as boolean) || false}
            onCheckedChange={(checked) => onChange(checked)}
          />
          <span className="text-sm text-muted-foreground">Sim</span>
        </div>
      );

    case "switch":
      return (
        <div className="flex items-center gap-2">
          <Switch
            checked={(value as boolean) || false}
            onCheckedChange={(checked) => onChange(checked)}
          />
          <span className="text-sm text-muted-foreground">
            {value ? "Ativo" : "Inativo"}
          </span>
        </div>
      );

    case "select":
      return (
        <div className="space-y-2">
          {isAddingOption ? (
            <div className="flex gap-2">
              <Input
                placeholder="Nova opção..."
                value={newOption}
                onChange={(e) => setNewOption(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddOption();
                  }
                  if (e.key === "Escape") {
                    setIsAddingOption(false);
                    setNewOption("");
                  }
                }}
                autoFocus
              />
              <Button type="button" size="sm" onClick={handleAddOption}>
                Adicionar
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setIsAddingOption(false);
                  setNewOption("");
                }}
              >
                Cancelar
              </Button>
            </div>
          ) : (
            <Select
              value={(value as string) || ""}
              onValueChange={(val) => {
                if (val === "__add_new__") {
                  setIsAddingOption(true);
                } else {
                  onChange(val);
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {options.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
                {onAddOption && (
                  <SelectItem value="__add_new__" className="text-primary">
                    <div className="flex items-center gap-2">
                      <Plus className="h-4 w-4" />
                      Adicionar nova opção
                    </div>
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          )}
        </div>
      );

    case "multi_select":
      const selectedValues = (value as string[]) || [];
      return (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1 min-h-[32px] p-1 border rounded-md">
            {selectedValues.map((val) => (
              <span
                key={val}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary rounded text-sm"
              >
                {val}
                <button
                  type="button"
                  className="hover:text-destructive"
                  onClick={() =>
                    onChange(selectedValues.filter((v) => v !== val))
                  }
                >
                  ×
                </button>
              </span>
            ))}
            {selectedValues.length === 0 && (
              <span className="text-muted-foreground text-sm p-1">
                Nenhum selecionado
              </span>
            )}
          </div>
          {isAddingOption ? (
            <div className="flex gap-2">
              <Input
                placeholder="Nova opção..."
                value={newOption}
                onChange={(e) => setNewOption(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddOption();
                  }
                  if (e.key === "Escape") {
                    setIsAddingOption(false);
                    setNewOption("");
                  }
                }}
                autoFocus
              />
              <Button type="button" size="sm" onClick={handleAddOption}>
                Adicionar
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setIsAddingOption(false);
                  setNewOption("");
                }}
              >
                Cancelar
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-1">
              {options
                .filter((opt) => !selectedValues.includes(opt))
                .map((opt) => (
                  <Button
                    key={opt}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onChange([...selectedValues, opt])}
                  >
                    {opt}
                  </Button>
                ))}
              {onAddOption && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsAddingOption(true)}
                  className="text-primary"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Nova
                </Button>
              )}
            </div>
          )}
        </div>
      );

    default:
      return (
        <Input
          placeholder={`Digite ${definition.field_name.toLowerCase()}`}
          value={(value as string) || ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }
};
