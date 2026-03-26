import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Copy, Scissors, AlertTriangle, Loader2 } from "lucide-react";
import { useCustomFields, CustomFieldDefinition } from "@/hooks/useCustomFields";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface TransferFieldDataDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const TransferFieldDataDialog = ({ open, onOpenChange }: TransferFieldDataDialogProps) => {
  const { fieldDefinitions, isLoading: fieldsLoading } = useCustomFields();
  const { user } = useAuth();
  const [sourceFieldKey, setSourceFieldKey] = useState("");
  const [targetFieldKey, setTargetFieldKey] = useState("");
  const [mode, setMode] = useState<"copy" | "move">("copy");
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewCount, setPreviewCount] = useState<number | null>(null);

  const sourceField = fieldDefinitions?.find(f => f.field_key === sourceFieldKey);
  const targetField = fieldDefinitions?.find(f => f.field_key === targetFieldKey);

  const availableTargets = fieldDefinitions?.filter(f => f.field_key !== sourceFieldKey) || [];

  useEffect(() => {
    if (!open) {
      setSourceFieldKey("");
      setTargetFieldKey("");
      setMode("copy");
      setPreviewCount(null);
    }
  }, [open]);

  // Count records with data in source field
  useEffect(() => {
    if (!sourceField || !user) {
      setPreviewCount(null);
      return;
    }

    const fetchCount = async () => {
      const table = sourceField.entity_type === "contact" ? "contacts" : "funnel_deals";
      const { data, error } = await supabase
        .from(table)
        .select("id, custom_fields")
        .not("custom_fields", "is", null);

      if (!error && data) {
        const count = data.filter((row: any) => {
          const cf = row.custom_fields as Record<string, any> | null;
          return cf && cf[sourceFieldKey] !== undefined && cf[sourceFieldKey] !== null && cf[sourceFieldKey] !== "";
        }).length;
        setPreviewCount(count);
      }
    };

    fetchCount();
  }, [sourceFieldKey, sourceField, user]);

  const handleTransfer = async () => {
    if (!sourceField || !targetField || !user) return;

    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke("transfer-field-data", {
        body: {
          source_field_key: sourceFieldKey,
          target_field_key: targetFieldKey,
          source_entity_type: sourceField.entity_type,
          target_entity_type: targetField.entity_type,
          mode,
          user_id: user.id,
        },
      });

      if (error) throw error;

      toast.success(
        `${data.transferred} registro(s) ${mode === "copy" ? "copiado(s)" : "movido(s)"} com sucesso!`
      );
      onOpenChange(false);
    } catch (err: any) {
      toast.error("Erro na transferência: " + (err.message || "Erro desconhecido"));
    } finally {
      setIsProcessing(false);
    }
  };

  const entityLabel = (type: string) =>
    type === "contact" ? "Contato" : "Lead";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Transferir Dados entre Campos</DialogTitle>
          <DialogDescription>
            Copie ou mova valores de um campo personalizado para outro.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* Mode selection */}
          <div className="space-y-2">
            <Label>Tipo de operação</Label>
            <RadioGroup value={mode} onValueChange={(v) => setMode(v as "copy" | "move")} className="flex gap-4">
              <div className="flex items-center gap-2 p-3 rounded-lg border cursor-pointer hover:bg-muted/50 flex-1" onClick={() => setMode("copy")}>
                <RadioGroupItem value="copy" id="copy" />
                <Copy className="h-4 w-4 text-muted-foreground" />
                <div>
                  <Label htmlFor="copy" className="cursor-pointer font-medium">Copiar</Label>
                  <p className="text-xs text-muted-foreground">Mantém dados na origem</p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-3 rounded-lg border cursor-pointer hover:bg-muted/50 flex-1" onClick={() => setMode("move")}>
                <RadioGroupItem value="move" id="move" />
                <Scissors className="h-4 w-4 text-muted-foreground" />
                <div>
                  <Label htmlFor="move" className="cursor-pointer font-medium">Mover</Label>
                  <p className="text-xs text-muted-foreground">Limpa dados da origem</p>
                </div>
              </div>
            </RadioGroup>
          </div>

          {/* Source field */}
          <div className="space-y-2">
            <Label>Campo de origem</Label>
            <Select value={sourceFieldKey} onValueChange={(v) => { setSourceFieldKey(v); setTargetFieldKey(""); }}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o campo de origem" />
              </SelectTrigger>
              <SelectContent>
                {(fieldDefinitions || []).map((field) => (
                  <SelectItem key={field.id} value={field.field_key}>
                    <span className="flex items-center gap-2">
                      {field.field_name}
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {entityLabel(field.entity_type)}
                      </Badge>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {previewCount !== null && (
              <p className="text-xs text-muted-foreground">
                {previewCount} registro(s) com dados neste campo
              </p>
            )}
          </div>

          {/* Arrow */}
          {sourceFieldKey && (
            <div className="flex justify-center">
              <ArrowRight className="h-5 w-5 text-muted-foreground" />
            </div>
          )}

          {/* Target field */}
          {sourceFieldKey && (
            <div className="space-y-2">
              <Label>Campo de destino</Label>
              <Select value={targetFieldKey} onValueChange={setTargetFieldKey}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o campo de destino" />
                </SelectTrigger>
                <SelectContent>
                  {availableTargets.map((field) => (
                    <SelectItem key={field.id} value={field.field_key}>
                      <span className="flex items-center gap-2">
                        {field.field_name}
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          {entityLabel(field.entity_type)}
                        </Badge>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Cross-entity warning */}
          {sourceField && targetField && sourceField.entity_type !== targetField.entity_type && (
            <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/30 rounded-lg">
              <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
              <p className="text-xs text-destructive">
                Transferência entre entidades diferentes ({entityLabel(sourceField.entity_type)} → {entityLabel(targetField.entity_type)}).
                Os dados serão vinculados via contato associado ao deal.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isProcessing}>
            Cancelar
          </Button>
          <Button
            onClick={handleTransfer}
            disabled={!sourceFieldKey || !targetFieldKey || isProcessing}
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processando...
              </>
            ) : (
              <>
                {mode === "copy" ? <Copy className="h-4 w-4 mr-2" /> : <Scissors className="h-4 w-4 mr-2" />}
                {mode === "copy" ? "Copiar Dados" : "Mover Dados"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
