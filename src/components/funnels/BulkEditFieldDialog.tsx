import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { CustomFieldDefinition } from "@/hooks/useCustomFields";

interface BulkEditFieldDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  fieldDefinitions: CustomFieldDefinition[];
  onConfirm: (fieldKey: string, value: unknown) => void;
  isLoading?: boolean;
}

export const BulkEditFieldDialog = ({
  open,
  onOpenChange,
  selectedCount,
  fieldDefinitions,
  onConfirm,
  isLoading,
}: BulkEditFieldDialogProps) => {
  const [selectedField, setSelectedField] = useState<string>("");
  const [fieldValue, setFieldValue] = useState<unknown>("");

  const selectedFieldDef = fieldDefinitions.find(f => f.field_key === selectedField);

  useEffect(() => {
    if (!open) {
      setSelectedField("");
      setFieldValue("");
    }
  }, [open]);

  useEffect(() => {
    // Reset value when field changes
    if (selectedFieldDef) {
      switch (selectedFieldDef.field_type) {
        case "boolean":
        case "switch":
          setFieldValue(false);
          break;
        case "number":
          setFieldValue(0);
          break;
        default:
          setFieldValue("");
      }
    }
  }, [selectedField, selectedFieldDef]);

  const handleConfirm = () => {
    if (selectedField) {
      onConfirm(selectedField, fieldValue);
    }
  };

  const renderValueInput = () => {
    if (!selectedFieldDef) return null;

    switch (selectedFieldDef.field_type) {
      case "text":
      case "url":
      case "phone":
      case "email":
        return (
          <Input
            value={fieldValue as string}
            onChange={(e) => setFieldValue(e.target.value)}
            placeholder={`Digite o ${selectedFieldDef.field_name.toLowerCase()}`}
          />
        );

      case "number":
        return (
          <Input
            type="number"
            value={fieldValue as number}
            onChange={(e) => setFieldValue(Number(e.target.value))}
            placeholder="Digite o valor"
          />
        );

      case "date":
        return (
          <Input
            type="date"
            value={fieldValue as string}
            onChange={(e) => setFieldValue(e.target.value)}
          />
        );

      case "time":
        return (
          <Input
            type="time"
            value={fieldValue as string}
            onChange={(e) => setFieldValue(e.target.value)}
          />
        );

      case "datetime":
        return (
          <Input
            type="datetime-local"
            value={fieldValue as string}
            onChange={(e) => setFieldValue(e.target.value)}
          />
        );

      case "boolean":
      case "switch":
        return (
          <div className="flex items-center gap-2">
            <Switch
              checked={fieldValue as boolean}
              onCheckedChange={(checked) => setFieldValue(checked)}
            />
            <span className="text-sm text-muted-foreground">
              {fieldValue ? "Sim" : "Não"}
            </span>
          </div>
        );

      case "select":
        return (
          <Select value={fieldValue as string} onValueChange={setFieldValue}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione uma opção" />
            </SelectTrigger>
            <SelectContent>
              {(selectedFieldDef.options || []).map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case "multi_select":
        return (
          <Select value={fieldValue as string} onValueChange={setFieldValue}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione uma opção" />
            </SelectTrigger>
            <SelectContent>
              {(selectedFieldDef.options || []).map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      default:
        return (
          <Input
            value={fieldValue as string}
            onChange={(e) => setFieldValue(e.target.value)}
          />
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Campo em Massa</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {selectedCount} deal(s) selecionado(s)
          </p>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Campo personalizado</Label>
            <Select value={selectedField} onValueChange={setSelectedField}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um campo" />
              </SelectTrigger>
              <SelectContent>
                {fieldDefinitions.map((field) => (
                  <SelectItem key={field.id} value={field.field_key}>
                    {field.field_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedFieldDef && (
            <div className="space-y-2">
              <Label>Novo valor</Label>
              {renderValueInput()}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedField || isLoading}
          >
            {isLoading ? "Aplicando..." : "Aplicar a todos"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
