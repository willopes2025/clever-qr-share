import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertCircle } from "lucide-react";
import type { CustomFieldDefinition } from "@/hooks/useCustomFields";
import { isFieldFilled } from "@/lib/required-fields";

interface RequiredFieldsCheckDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stageName: string;
  missingFields: CustomFieldDefinition[];
  initialValues: Record<string, unknown>;
  onConfirm: (values: Record<string, unknown>) => Promise<void> | void;
  isSubmitting?: boolean;
}

/**
 * Dialog que bloqueia a mudança de etapa quando há campos personalizados
 * obrigatórios não preenchidos. Exibe inputs inline para que o usuário
 * preencha tudo antes de mover.
 */
export const RequiredFieldsCheckDialog = ({
  open,
  onOpenChange,
  stageName,
  missingFields,
  initialValues,
  onConfirm,
  isSubmitting,
}: RequiredFieldsCheckDialogProps) => {
  const [values, setValues] = useState<Record<string, unknown>>(initialValues);

  useEffect(() => {
    if (open) setValues(initialValues || {});
  }, [open, initialValues]);

  const handleChange = (key: string, value: unknown) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const allFilled = missingFields.every((f) => isFieldFilled(values?.[f.field_key]));

  const renderInput = (field: CustomFieldDefinition) => {
    const value = values[field.field_key];
    switch (field.field_type) {
      case "number":
        return (
          <Input
            id={field.field_key}
            type="number"
            value={(value as number | string) ?? ""}
            onChange={(e) =>
              handleChange(
                field.field_key,
                e.target.value === "" ? "" : Number(e.target.value),
              )
            }
          />
        );
      case "date":
        return (
          <Input
            id={field.field_key}
            type="date"
            value={(value as string) || ""}
            onChange={(e) => handleChange(field.field_key, e.target.value)}
          />
        );
      case "time":
        return (
          <Input
            id={field.field_key}
            type="time"
            value={(value as string) || ""}
            onChange={(e) => handleChange(field.field_key, e.target.value)}
          />
        );
      case "datetime":
        return (
          <Input
            id={field.field_key}
            type="datetime-local"
            value={(value as string) || ""}
            onChange={(e) => handleChange(field.field_key, e.target.value)}
          />
        );
      case "email":
        return (
          <Input
            id={field.field_key}
            type="email"
            value={(value as string) || ""}
            onChange={(e) => handleChange(field.field_key, e.target.value)}
          />
        );
      case "phone":
        return (
          <Input
            id={field.field_key}
            type="tel"
            value={(value as string) || ""}
            onChange={(e) => handleChange(field.field_key, e.target.value)}
          />
        );
      case "url":
        return (
          <Input
            id={field.field_key}
            type="url"
            value={(value as string) || ""}
            onChange={(e) => handleChange(field.field_key, e.target.value)}
          />
        );
      case "boolean":
        return (
          <div className="flex items-center gap-2">
            <Checkbox
              id={field.field_key}
              checked={!!value}
              onCheckedChange={(c) => handleChange(field.field_key, !!c)}
            />
            <Label htmlFor={field.field_key} className="text-sm text-muted-foreground">
              Confirmar
            </Label>
          </div>
        );
      case "switch":
        return (
          <div className="flex items-center gap-2">
            <Switch
              id={field.field_key}
              checked={!!value}
              onCheckedChange={(c) => handleChange(field.field_key, c)}
            />
            <Label htmlFor={field.field_key} className="text-sm text-muted-foreground">
              {field.field_name}
            </Label>
          </div>
        );
      case "select":
        return (
          <Select
            value={(value as string) || ""}
            onValueChange={(v) => handleChange(field.field_key, v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {(field.options || []).map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case "multi_select": {
        const selected = Array.isArray(value) ? (value as string[]) : [];
        const toggle = (opt: string) => {
          const next = selected.includes(opt)
            ? selected.filter((s) => s !== opt)
            : [...selected, opt];
          handleChange(field.field_key, next);
        };
        return (
          <div className="grid gap-2 sm:grid-cols-2">
            {(field.options || []).map((opt) => {
              const isSelected = selected.includes(opt);
              return (
                <Button
                  key={opt}
                  type="button"
                  variant={isSelected ? "default" : "outline"}
                  size="sm"
                  className="justify-start"
                  onClick={() => toggle(opt)}
                >
                  {opt}
                </Button>
              );
            })}
          </div>
        );
      }
      default:
        return (
          <Input
            id={field.field_key}
            value={(value as string) || ""}
            onChange={(e) => handleChange(field.field_key, e.target.value)}
            placeholder={`Digite ${field.field_name.toLowerCase()}`}
          />
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            Campos obrigatórios
          </DialogTitle>
          <DialogDescription>
            Para mover este lead para <strong>{stageName}</strong>, preencha os campos
            abaixo:
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
          {missingFields.map((field) => (
            <div key={field.id} className="space-y-2">
              <Label htmlFor={field.field_key} className="text-sm">
                {field.field_name}
                <span className="text-destructive ml-1">*</span>
              </Label>
              {renderInput(field)}
            </div>
          ))}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button
            onClick={() => onConfirm(values)}
            disabled={!allFilled || isSubmitting}
          >
            {isSubmitting ? "Salvando..." : "Preencher e mover"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
