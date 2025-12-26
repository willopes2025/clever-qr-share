import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X, Plus } from "lucide-react";

export type FieldType =
  | "text"
  | "number"
  | "date"
  | "time"
  | "datetime"
  | "boolean"
  | "switch"
  | "select"
  | "multi_select"
  | "url"
  | "phone"
  | "email";

export interface NewFieldConfig {
  field_name: string;
  field_key: string;
  field_type: FieldType;
  options?: string[];
  is_required?: boolean;
}

interface CreateFieldInlineDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateField: (config: NewFieldConfig) => void;
  suggestedName?: string;
}

const FIELD_TYPES: { value: FieldType; label: string; description: string }[] = [
  { value: "text", label: "Texto", description: "String livre" },
  { value: "number", label: "Número", description: "Valor numérico" },
  { value: "date", label: "Data", description: "Data (DD/MM/AAAA)" },
  { value: "time", label: "Hora", description: "Horário (HH:mm)" },
  { value: "datetime", label: "Data e Hora", description: "Data + horário" },
  { value: "boolean", label: "Caixa de Seleção", description: "Sim/Não" },
  { value: "switch", label: "Interruptor", description: "Liga/Desliga" },
  { value: "select", label: "Seleção Única", description: "Dropdown com opções" },
  { value: "multi_select", label: "Seleção Múltipla", description: "Várias opções" },
  { value: "url", label: "Link/URL", description: "Endereço web" },
  { value: "phone", label: "Telefone", description: "Número de telefone" },
  { value: "email", label: "E-mail", description: "Endereço de email" },
];

export const CreateFieldInlineDialog = ({
  open,
  onOpenChange,
  onCreateField,
  suggestedName = "",
}: CreateFieldInlineDialogProps) => {
  const [fieldName, setFieldName] = useState(suggestedName);
  const [fieldType, setFieldType] = useState<FieldType>("text");
  const [isRequired, setIsRequired] = useState(false);
  const [options, setOptions] = useState<string[]>([]);
  const [newOption, setNewOption] = useState("");

  const needsOptions = fieldType === "select" || fieldType === "multi_select";

  const generateFieldKey = (name: string) => {
    return name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");
  };

  const handleAddOption = () => {
    if (newOption.trim() && !options.includes(newOption.trim())) {
      setOptions([...options, newOption.trim()]);
      setNewOption("");
    }
  };

  const handleRemoveOption = (opt: string) => {
    setOptions(options.filter((o) => o !== opt));
  };

  const handleSubmit = () => {
    if (!fieldName.trim()) return;

    const config: NewFieldConfig = {
      field_name: fieldName.trim(),
      field_key: generateFieldKey(fieldName),
      field_type: fieldType,
      is_required: isRequired,
    };

    if (needsOptions && options.length > 0) {
      config.options = options;
    }

    onCreateField(config);
    
    // Reset form
    setFieldName("");
    setFieldType("text");
    setIsRequired(false);
    setOptions([]);
    setNewOption("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Criar Novo Campo</DialogTitle>
          <DialogDescription>
            Configure um novo campo personalizado para seus contatos
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Field Name */}
          <div className="space-y-2">
            <Label htmlFor="field-name">Nome do Campo</Label>
            <Input
              id="field-name"
              value={fieldName}
              onChange={(e) => setFieldName(e.target.value)}
              placeholder="Ex: Empresa, Produto, Data de Nascimento..."
            />
            {fieldName && (
              <p className="text-xs text-muted-foreground">
                Chave: <code className="bg-muted px-1 rounded">{generateFieldKey(fieldName)}</code>
              </p>
            )}
          </div>

          {/* Field Type */}
          <div className="space-y-2">
            <Label>Tipo do Campo</Label>
            <Select value={fieldType} onValueChange={(v) => setFieldType(v as FieldType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FIELD_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    <div className="flex flex-col">
                      <span>{type.label}</span>
                      <span className="text-xs text-muted-foreground">{type.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Options for select/multi_select */}
          {needsOptions && (
            <div className="space-y-2">
              <Label>Opções</Label>
              <div className="flex gap-2">
                <Input
                  value={newOption}
                  onChange={(e) => setNewOption(e.target.value)}
                  placeholder="Adicionar opção..."
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddOption())}
                />
                <Button type="button" size="icon" variant="outline" onClick={handleAddOption}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {options.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {options.map((opt) => (
                    <Badge key={opt} variant="secondary" className="gap-1">
                      {opt}
                      <button
                        type="button"
                        onClick={() => handleRemoveOption(opt)}
                        className="ml-1 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              {needsOptions && options.length === 0 && (
                <p className="text-xs text-amber-500">
                  Adicione pelo menos uma opção para este tipo de campo
                </p>
              )}
            </div>
          )}

          {/* Required checkbox */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="is-required"
              checked={isRequired}
              onCheckedChange={(checked) => setIsRequired(checked === true)}
            />
            <Label htmlFor="is-required" className="text-sm font-normal">
              Campo obrigatório
            </Label>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!fieldName.trim() || (needsOptions && options.length === 0)}
            >
              Criar Campo
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
