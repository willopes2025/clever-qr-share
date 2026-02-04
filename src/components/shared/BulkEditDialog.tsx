import { useState, useEffect, useMemo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
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
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { CustomFieldDefinition } from "@/hooks/useCustomFields";
import { FunnelStage, Funnel } from "@/hooks/useFunnels";

export interface BulkEditUpdates {
  value?: number;
  stage_id?: string;
  responsible_id?: string | null;
  expected_close_date?: string | null;
  custom_field?: { key: string; value: unknown };
  funnel_assignment?: { funnel_id: string; stage_id: string };
}

interface TeamMember {
  id: string;
  user_id: string | null;
  email: string;
  profile?: { full_name: string | null } | null;
}

interface BulkEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'deals' | 'contacts';
  selectedCount: number;
  fieldDefinitions: CustomFieldDefinition[];
  stages?: FunnelStage[];
  funnels?: Funnel[];
  members?: TeamMember[];
  onConfirm: (updates: BulkEditUpdates) => Promise<void>;
  isLoading?: boolean;
}

export const BulkEditDialog = ({
  open,
  onOpenChange,
  mode,
  selectedCount,
  fieldDefinitions,
  stages = [],
  funnels = [],
  members = [],
  onConfirm,
  isLoading,
}: BulkEditDialogProps) => {
  // What to edit toggles
  const [editValue, setEditValue] = useState(false);
  const [editStage, setEditStage] = useState(false);
  const [editResponsible, setEditResponsible] = useState(false);
  const [editExpectedDate, setEditExpectedDate] = useState(false);
  const [editCustomField, setEditCustomField] = useState(false);
  const [editFunnelAssignment, setEditFunnelAssignment] = useState(false);

  // Values
  const [valueAmount, setValueAmount] = useState<string>("");
  const [selectedStageId, setSelectedStageId] = useState<string>("");
  const [selectedResponsibleId, setSelectedResponsibleId] = useState<string>("");
  const [expectedCloseDate, setExpectedCloseDate] = useState<Date | undefined>();
  const [selectedFieldKey, setSelectedFieldKey] = useState<string>("");
  const [customFieldValue, setCustomFieldValue] = useState<unknown>("");
  const [selectedFunnelId, setSelectedFunnelId] = useState<string>("");
  const [selectedFunnelStageId, setSelectedFunnelStageId] = useState<string>("");

  // Filter field definitions by entity type
  const relevantFieldDefinitions = useMemo(() => {
    return fieldDefinitions.filter(f => 
      mode === 'deals' ? f.entity_type === 'lead' : f.entity_type === 'contact'
    );
  }, [fieldDefinitions, mode]);

  const selectedFieldDef = relevantFieldDefinitions.find(f => f.field_key === selectedFieldKey);

  // Get stages for selected funnel (for contacts mode)
  const funnelStages = useMemo(() => {
    if (!selectedFunnelId) return [];
    const funnel = funnels.find(f => f.id === selectedFunnelId);
    return funnel?.stages?.filter(s => !s.is_final) || [];
  }, [funnels, selectedFunnelId]);

  // Reset all values when dialog closes
  useEffect(() => {
    if (!open) {
      setEditValue(false);
      setEditStage(false);
      setEditResponsible(false);
      setEditExpectedDate(false);
      setEditCustomField(false);
      setEditFunnelAssignment(false);
      setValueAmount("");
      setSelectedStageId("");
      setSelectedResponsibleId("");
      setExpectedCloseDate(undefined);
      setSelectedFieldKey("");
      setCustomFieldValue("");
      setSelectedFunnelId("");
      setSelectedFunnelStageId("");
    }
  }, [open]);

  // Reset custom field value when field changes
  useEffect(() => {
    if (selectedFieldDef) {
      switch (selectedFieldDef.field_type) {
        case "boolean":
        case "switch":
          setCustomFieldValue(false);
          break;
        case "number":
          setCustomFieldValue(0);
          break;
        default:
          setCustomFieldValue("");
      }
    }
  }, [selectedFieldKey, selectedFieldDef]);

  // Reset funnel stage when funnel changes
  useEffect(() => {
    setSelectedFunnelStageId("");
  }, [selectedFunnelId]);

  const hasAnySelection = editValue || editStage || editResponsible || editExpectedDate || editCustomField || editFunnelAssignment;

  const canSubmit = () => {
    if (!hasAnySelection) return false;
    if (editValue && !valueAmount) return false;
    if (editStage && !selectedStageId) return false;
    if (editCustomField && (!selectedFieldKey || customFieldValue === "")) return false;
    if (editFunnelAssignment && (!selectedFunnelId || !selectedFunnelStageId)) return false;
    return true;
  };

  const handleConfirm = async () => {
    const updates: BulkEditUpdates = {};
    
    if (editValue) {
      updates.value = parseFloat(valueAmount.replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
    }
    if (editStage && selectedStageId) {
      updates.stage_id = selectedStageId;
    }
    if (editResponsible) {
      updates.responsible_id = selectedResponsibleId || null;
    }
    if (editExpectedDate) {
      updates.expected_close_date = expectedCloseDate ? format(expectedCloseDate, 'yyyy-MM-dd') : null;
    }
    if (editCustomField && selectedFieldKey) {
      updates.custom_field = { key: selectedFieldKey, value: customFieldValue };
    }
    if (editFunnelAssignment && selectedFunnelId && selectedFunnelStageId) {
      updates.funnel_assignment = { funnel_id: selectedFunnelId, stage_id: selectedFunnelStageId };
    }

    await onConfirm(updates);
  };

  const renderCustomFieldInput = () => {
    if (!selectedFieldDef) return null;

    switch (selectedFieldDef.field_type) {
      case "text":
      case "url":
      case "phone":
      case "email":
        return (
          <Input
            value={customFieldValue as string}
            onChange={(e) => setCustomFieldValue(e.target.value)}
            placeholder={`Digite o ${selectedFieldDef.field_name.toLowerCase()}`}
          />
        );

      case "number":
        return (
          <Input
            type="number"
            value={customFieldValue as number}
            onChange={(e) => setCustomFieldValue(Number(e.target.value))}
            placeholder="Digite o valor"
          />
        );

      case "date":
        return (
          <Input
            type="date"
            value={customFieldValue as string}
            onChange={(e) => setCustomFieldValue(e.target.value)}
          />
        );

      case "time":
        return (
          <Input
            type="time"
            value={customFieldValue as string}
            onChange={(e) => setCustomFieldValue(e.target.value)}
          />
        );

      case "datetime":
        return (
          <Input
            type="datetime-local"
            value={customFieldValue as string}
            onChange={(e) => setCustomFieldValue(e.target.value)}
          />
        );

      case "boolean":
      case "switch":
        return (
          <div className="flex items-center gap-2">
            <Switch
              checked={customFieldValue as boolean}
              onCheckedChange={(checked) => setCustomFieldValue(checked)}
            />
            <span className="text-sm text-muted-foreground">
              {customFieldValue ? "Sim" : "Não"}
            </span>
          </div>
        );

      case "select":
      case "multi_select":
        return (
          <Select value={customFieldValue as string} onValueChange={setCustomFieldValue}>
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
            value={customFieldValue as string}
            onChange={(e) => setCustomFieldValue(e.target.value)}
          />
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] grid grid-rows-[auto_1fr_auto] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Editar em Massa</DialogTitle>
          <DialogDescription>
            {selectedCount} {mode === 'deals' ? 'lead(s)' : 'contato(s)'} selecionado(s)
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="pr-4" type="always">
          <div className="space-y-6 py-4">
            <p className="text-sm text-muted-foreground">Selecione o que deseja alterar:</p>

            {/* Deal-specific fields */}
            {mode === 'deals' && (
              <>
                {/* Value */}
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id="edit-value"
                      checked={editValue}
                      onCheckedChange={(c) => setEditValue(!!c)}
                    />
                    <Label htmlFor="edit-value" className="font-medium cursor-pointer">
                      Valor
                    </Label>
                  </div>
                  {editValue && (
                    <div className="ml-7">
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                        <Input
                          className="pl-10"
                          value={valueAmount}
                          onChange={(e) => setValueAmount(e.target.value)}
                          placeholder="0,00"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Stage */}
                {stages.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <Checkbox
                        id="edit-stage"
                        checked={editStage}
                        onCheckedChange={(c) => setEditStage(!!c)}
                      />
                      <Label htmlFor="edit-stage" className="font-medium cursor-pointer">
                        Etapa
                      </Label>
                    </div>
                    {editStage && (
                      <div className="ml-7">
                        <Select value={selectedStageId} onValueChange={setSelectedStageId}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione uma etapa" />
                          </SelectTrigger>
                          <SelectContent>
                            {stages.map((stage) => (
                              <SelectItem key={stage.id} value={stage.id}>
                                <div className="flex items-center gap-2">
                                  <div
                                    className="w-2 h-2 rounded-full"
                                    style={{ backgroundColor: stage.color }}
                                  />
                                  {stage.name}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                )}

                {/* Responsible */}
                {members.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <Checkbox
                        id="edit-responsible"
                        checked={editResponsible}
                        onCheckedChange={(c) => setEditResponsible(!!c)}
                      />
                      <Label htmlFor="edit-responsible" className="font-medium cursor-pointer">
                        Responsável
                      </Label>
                    </div>
                    {editResponsible && (
                      <div className="ml-7">
                        <Select value={selectedResponsibleId} onValueChange={setSelectedResponsibleId}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione um responsável" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">Sem responsável</SelectItem>
                            {members.map((member) => (
                              <SelectItem key={member.id} value={member.user_id || ""}>
                                {member.profile?.full_name || member.email}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                )}

                {/* Expected Close Date */}
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id="edit-expected-date"
                      checked={editExpectedDate}
                      onCheckedChange={(c) => setEditExpectedDate(!!c)}
                    />
                    <Label htmlFor="edit-expected-date" className="font-medium cursor-pointer">
                      Data de Previsão
                    </Label>
                  </div>
                  {editExpectedDate && (
                    <div className="ml-7">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !expectedCloseDate && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {expectedCloseDate 
                              ? format(expectedCloseDate, "dd/MM/yyyy", { locale: ptBR })
                              : "Selecione uma data"
                            }
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={expectedCloseDate}
                            onSelect={setExpectedCloseDate}
                            locale={ptBR}
                            className="p-3 pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Contact-specific: Funnel Assignment */}
            {mode === 'contacts' && funnels.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="edit-funnel"
                    checked={editFunnelAssignment}
                    onCheckedChange={(c) => setEditFunnelAssignment(!!c)}
                  />
                  <Label htmlFor="edit-funnel" className="font-medium cursor-pointer">
                    Associar a Funil
                  </Label>
                </div>
                {editFunnelAssignment && (
                  <div className="ml-7 space-y-3">
                    <Select value={selectedFunnelId} onValueChange={setSelectedFunnelId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um funil" />
                      </SelectTrigger>
                      <SelectContent>
                        {funnels.map((funnel) => (
                          <SelectItem key={funnel.id} value={funnel.id}>
                            {funnel.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    {selectedFunnelId && funnelStages.length > 0 && (
                      <Select value={selectedFunnelStageId} onValueChange={setSelectedFunnelStageId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione uma etapa" />
                        </SelectTrigger>
                        <SelectContent>
                          {funnelStages.map((stage) => (
                            <SelectItem key={stage.id} value={stage.id}>
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-2 h-2 rounded-full"
                                  style={{ backgroundColor: stage.color }}
                                />
                                {stage.name}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Custom Field - Both modes */}
            {relevantFieldDefinitions.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="edit-custom"
                    checked={editCustomField}
                    onCheckedChange={(c) => setEditCustomField(!!c)}
                  />
                  <Label htmlFor="edit-custom" className="font-medium cursor-pointer">
                    Campo Personalizado
                  </Label>
                </div>
                {editCustomField && (
                  <div className="ml-7 space-y-3">
                    <Select value={selectedFieldKey} onValueChange={setSelectedFieldKey}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um campo" />
                      </SelectTrigger>
                      <SelectContent>
                        {relevantFieldDefinitions.map((field) => (
                          <SelectItem key={field.id} value={field.field_key}>
                            {field.field_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    {selectedFieldDef && (
                      <div className="space-y-2">
                        <Label className="text-sm text-muted-foreground">Novo valor</Label>
                        {renderCustomFieldInput()}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!canSubmit() || isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Aplicando...
              </>
            ) : (
              "Aplicar Alterações"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
