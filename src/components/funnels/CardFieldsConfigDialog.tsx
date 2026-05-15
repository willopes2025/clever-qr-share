import { useEffect, useState } from "react";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCustomFields } from "@/hooks/useCustomFields";

interface CardFieldsConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedKeys: string[];
  onSave: (keys: string[]) => void;
}

export const CardFieldsConfigDialog = ({
  open,
  onOpenChange,
  selectedKeys,
  onSave,
}: CardFieldsConfigDialogProps) => {
  const { leadFieldDefinitions, contactFieldDefinitions } = useCustomFields();
  const allFields = [...(leadFieldDefinitions || []), ...(contactFieldDefinitions || [])];
  const [selected, setSelected] = useState<string[]>(selectedKeys);

  useEffect(() => {
    if (open) setSelected(selectedKeys);
  }, [open, selectedKeys]);

  const toggle = (k: string) =>
    setSelected((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]));

  const move = (idx: number, dir: -1 | 1) => {
    const next = [...selected];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    setSelected(next);
  };

  const fieldName = (k: string) =>
    allFields.find((f) => f.field_key === k)?.field_name || k;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Campos exibidos no card</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Selecione e ordene os campos personalizados que aparecerão em cada card do funil.
          </p>

          <ScrollArea className="h-[320px] border rounded-lg p-2">
            <div className="space-y-1">
              {allFields.map((field) => {
                const isSelected = selected.includes(field.field_key);
                const idx = selected.indexOf(field.field_key);
                return (
                  <div
                    key={field.id}
                    className="flex items-center gap-2 p-2 rounded hover:bg-muted/50"
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggle(field.field_key)}
                    />
                    <span className="flex-1 text-sm">
                      {field.field_name}
                      <span className="ml-1 text-[10px] text-muted-foreground">
                        ({field.entity_type === "contact" ? "contato" : "lead"})
                      </span>
                    </span>
                    {isSelected && (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => move(idx, -1)}
                          disabled={idx === 0}
                        >
                          <ChevronUp className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => move(idx, 1)}
                          disabled={idx === selected.length - 1}
                        >
                          <ChevronDown className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
              {allFields.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum campo personalizado criado ainda.
                </p>
              )}
            </div>
          </ScrollArea>

          {selected.length > 0 && (
            <div>
              <p className="text-xs font-medium mb-1">Ordem dos campos:</p>
              <div className="flex flex-wrap gap-1">
                {selected.map((k, i) => (
                  <span key={k} className="text-xs bg-muted px-2 py-0.5 rounded">
                    {i + 1}. {fieldName(k)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => {
              onSave(selected);
              onOpenChange(false);
            }}
          >
            <Check className="h-4 w-4 mr-2" />
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
