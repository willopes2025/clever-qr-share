import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FieldType } from "@/hooks/useCustomFields";
import { X } from "lucide-react";

const FIELD_TYPE_OPTIONS: { value: FieldType; label: string }[] = [
  { value: "text", label: "Texto" },
  { value: "number", label: "Número" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Telefone" },
  { value: "url", label: "URL" },
  { value: "date", label: "Data" },
  { value: "time", label: "Hora" },
  { value: "datetime", label: "Data e Hora" },
  { value: "boolean", label: "Checkbox" },
  { value: "switch", label: "Switch" },
  { value: "select", label: "Seleção única" },
  { value: "multi_select", label: "Seleção múltipla" },
];

interface InlineFieldCreatorProps {
  onSave: (field: {
    field_name: string;
    field_key: string;
    field_type: FieldType;
    is_required: boolean;
    options: string[];
    display_order: number;
  }) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

const generateFieldKey = (name: string): string => {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
};

export const InlineFieldCreator = ({
  onSave,
  onCancel,
  isLoading,
}: InlineFieldCreatorProps) => {
  const [fieldName, setFieldName] = useState("");
  const [fieldType, setFieldType] = useState<FieldType>("text");

  const handleSave = () => {
    if (!fieldName.trim()) return;

    onSave({
      field_name: fieldName.trim(),
      field_key: generateFieldKey(fieldName),
      field_type: fieldType,
      is_required: false,
      options: [],
      display_order: 0,
    });
  };

  return (
    <div className="p-3 border rounded-lg bg-muted/30 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Novo Campo</span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={onCancel}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Input
          placeholder="Nome do campo"
          value={fieldName}
          onChange={(e) => setFieldName(e.target.value)}
          autoFocus
        />
        <Select
          value={fieldType}
          onValueChange={(val) => setFieldType(val as FieldType)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FIELD_TYPE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancelar
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={handleSave}
          disabled={!fieldName.trim() || isLoading}
        >
          {isLoading ? "Criando..." : "Criar e Adicionar"}
        </Button>
      </div>
    </div>
  );
};
