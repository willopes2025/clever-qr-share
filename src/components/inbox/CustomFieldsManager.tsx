import { useState, useEffect, useMemo } from "react";
import { Plus, Trash2, GripVertical, Settings, User, Target, Pencil, X, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { CustomFieldDefinition, FieldType, useCustomFields } from "@/hooks/useCustomFields";
import { useFieldRequiredRules } from "@/hooks/useFieldRequiredRules";
import { useFunnels } from "@/hooks/useFunnels";
import { inferFieldType } from "@/utils/inferFieldType";
import { toast } from "sonner";

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

const FIELD_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  FIELD_TYPE_OPTIONS.map(o => [o.value, o.label])
);

// Cálculo simples de similaridade (Dice coefficient sobre bigramas)
function similarity(a: string, b: string): number {
  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
  const sa = norm(a);
  const sb = norm(b);
  if (sa === sb) return 1;
  if (sa.length < 2 || sb.length < 2) return 0;
  const bigrams = (s: string) => {
    const set = new Set<string>();
    for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2));
    return set;
  };
  const A = bigrams(sa);
  const B = bigrams(sb);
  let inter = 0;
  A.forEach(x => { if (B.has(x)) inter++; });
  return (2 * inter) / (A.size + B.size);
}

interface RequiredRulesEditorProps {
  fieldId: string;
}

const RequiredRulesEditor = ({ fieldId }: RequiredRulesEditorProps) => {
  const { funnels } = useFunnels();
  const { rules, upsertRule, deleteRule } = useFieldRequiredRules();

  const fieldRules = (rules || []).filter((r) => r.field_definition_id === fieldId);

  const [draftFunnelId, setDraftFunnelId] = useState<string>("");
  const [draftStageId, setDraftStageId] = useState<string>("");

  const draftFunnel = funnels?.find((f) => f.id === draftFunnelId);
  const draftStages = (draftFunnel?.stages || []).slice().sort(
    (a, b) => a.display_order - b.display_order,
  );

  // Funis que ainda não têm regra para este campo
  const availableFunnels = (funnels || []).filter(
    (f) => !fieldRules.some((r) => r.funnel_id === f.id),
  );

  const handleAdd = async () => {
    if (!draftFunnelId || !draftStageId) return;
    await upsertRule.mutateAsync({
      field_definition_id: fieldId,
      funnel_id: draftFunnelId,
      from_stage_id: draftStageId,
    });
    setDraftFunnelId("");
    setDraftStageId("");
  };

  return (
    <div className="space-y-2 pt-2 border-t border-border/60">
      <Label className="text-xs text-muted-foreground">
        Regras de obrigatoriedade por etapa
      </Label>
      <p className="text-[11px] text-muted-foreground -mt-1">
        Torne o campo obrigatório a partir de uma etapa específica de um funil.
      </p>

      {fieldRules.length > 0 && (
        <div className="space-y-1.5">
          {fieldRules.map((rule) => {
            const f = funnels?.find((x) => x.id === rule.funnel_id);
            const s = f?.stages?.find((x) => x.id === rule.from_stage_id);
            return (
              <div
                key={rule.id}
                className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-muted/40 border border-border/60 text-xs"
              >
                <span className="font-medium truncate flex-1">
                  {f?.name || "Funil removido"}
                </span>
                <span className="text-muted-foreground">a partir de</span>
                <Badge variant="outline" className="text-[10px]">
                  {s?.name || "Etapa removida"}
                </Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-destructive hover:text-destructive"
                  onClick={() => deleteRule.mutate(rule.id)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {availableFunnels.length > 0 && (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Select
            value={draftFunnelId}
            onValueChange={(v) => {
              setDraftFunnelId(v);
              setDraftStageId("");
            }}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Funil" />
            </SelectTrigger>
            <SelectContent>
              {availableFunnels.map((f) => (
                <SelectItem key={f.id} value={f.id} className="text-xs">
                  {f.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={draftStageId}
            onValueChange={setDraftStageId}
            disabled={!draftFunnelId}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="A partir da etapa" />
            </SelectTrigger>
            <SelectContent>
              {draftStages.map((s) => (
                <SelectItem key={s.id} value={s.id} className="text-xs">
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8"
            onClick={handleAdd}
            disabled={!draftFunnelId || !draftStageId || upsertRule.isPending}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
};

interface CustomFieldsManagerProps {
  /** Quando provido, o componente vira controlado e não renderiza o botão trigger. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Ao abrir, foca o editor no campo informado. */
  initialEditFieldId?: string | null;
}

export const CustomFieldsManager = ({ open: openProp, onOpenChange, initialEditFieldId }: CustomFieldsManagerProps = {}) => {
  const { fieldDefinitions, createField, updateField, deleteField, isLoading } = useCustomFields();
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = openProp !== undefined;
  const isOpen = isControlled ? !!openProp : internalOpen;
  const setIsOpen = (v: boolean) => {
    if (isControlled) onOpenChange?.(v);
    else setInternalOpen(v);
  };

  const [isAddingField, setIsAddingField] = useState(false);
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [editData, setEditData] = useState<{
    field_name: string;
    field_type: FieldType;
    entity_type: "contact" | "lead";
    options: string[];
    is_required: boolean;
  }>({ field_name: "", field_type: "text", entity_type: "contact", options: [], is_required: false });
  const [editOption, setEditOption] = useState("");

  const [newField, setNewField] = useState({
    field_name: "",
    field_key: "",
    field_type: "text" as FieldType,
    entity_type: "contact" as "contact" | "lead",
    options: [] as string[],
    is_required: false,
    display_order: 0,
  });
  const [newOption, setNewOption] = useState("");

  // Auto-focus no campo quando abrir com initialEditFieldId
  useEffect(() => {
    if (isOpen && initialEditFieldId && fieldDefinitions) {
      const target = fieldDefinitions.find(f => f.id === initialEditFieldId);
      if (target) startEditing(target);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialEditFieldId, fieldDefinitions]);

  // Detectar possíveis duplicatas (mesma entity_type, similaridade > 0.85)
  const duplicateIds = useMemo(() => {
    const ids = new Set<string>();
    if (!fieldDefinitions) return ids;
    for (let i = 0; i < fieldDefinitions.length; i++) {
      for (let j = i + 1; j < fieldDefinitions.length; j++) {
        const a = fieldDefinitions[i];
        const b = fieldDefinitions[j];
        if (a.entity_type !== b.entity_type) continue;
        if (similarity(a.field_name, b.field_name) > 0.85) {
          ids.add(a.id);
          ids.add(b.id);
        }
      }
    }
    return ids;
  }, [fieldDefinitions]);

  const handleAddField = async () => {
    if (!newField.field_name || !newField.field_key) return;
    // Validação anti-duplicata
    const exists = fieldDefinitions?.some(
      f => f.entity_type === newField.entity_type && f.field_key === newField.field_key
    );
    if (exists) {
      toast.error("Já existe um campo com essa chave para este tipo de entidade.");
      return;
    }
    await createField.mutateAsync({
      ...newField,
      display_order: (fieldDefinitions?.length || 0),
    });
    setNewField({ field_name: "", field_key: "", field_type: "text", entity_type: "contact", options: [], is_required: false, display_order: 0 });
    setIsAddingField(false);
  };

  const handleDeleteField = async (id: string) => {
    await deleteField.mutateAsync(id);
  };

  const startEditing = (field: CustomFieldDefinition) => {
    setEditingFieldId(field.id);
    setEditData({
      field_name: field.field_name,
      field_type: field.field_type,
      entity_type: field.entity_type,
      options: field.options || [],
      is_required: field.is_required,
    });
    setEditOption("");
  };

  const handleSaveEdit = async () => {
    if (!editingFieldId || !editData.field_name.trim()) return;
    await updateField.mutateAsync({
      id: editingFieldId,
      field_name: editData.field_name.trim(),
      field_type: editData.field_type,
      entity_type: editData.entity_type,
      options: editData.options,
      is_required: editData.is_required,
    });
    setEditingFieldId(null);
  };

  const handleAddOption = () => {
    if (!newOption.trim()) return;
    setNewField(prev => ({ ...prev, options: [...prev.options, newOption.trim()] }));
    setNewOption("");
  };

  const handleRemoveOption = (index: number) => {
    setNewField(prev => ({ ...prev, options: prev.options.filter((_, i) => i !== index) }));
  };

  const handleAddEditOption = () => {
    if (!editOption.trim()) return;
    setEditData(prev => ({ ...prev, options: [...prev.options, editOption.trim()] }));
    setEditOption("");
  };

  const handleRemoveEditOption = (index: number) => {
    setEditData(prev => ({ ...prev, options: prev.options.filter((_, i) => i !== index) }));
  };

  const generateFieldKey = (name: string) => {
    return name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  };

  const showOptions = (type: FieldType) => type === 'select' || type === 'multi_select';

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {!isControlled && (
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
            <Settings className="h-3.5 w-3.5" />
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Campos Personalizados</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
          {fieldDefinitions && fieldDefinitions.length > 0 ? (
            <div className="space-y-2">
              {fieldDefinitions.map((field) => (
                <div key={field.id}>
                  {editingFieldId === field.id ? (
                    <div className="space-y-3 p-3 rounded-lg border border-primary/30 bg-muted/20">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Editando campo</span>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditingFieldId(null)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>

                      <RadioGroup
                        value={editData.entity_type}
                        onValueChange={(val) => setEditData(prev => ({ ...prev, entity_type: val as 'contact' | 'lead' }))}
                        className="flex gap-4"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="contact" id={`edit-entity-contact-${field.id}`} />
                          <Label htmlFor={`edit-entity-contact-${field.id}`} className="flex items-center gap-1.5 cursor-pointer text-sm">
                            <User className="h-3.5 w-3.5 text-muted-foreground" /> Contato
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="lead" id={`edit-entity-lead-${field.id}`} />
                          <Label htmlFor={`edit-entity-lead-${field.id}`} className="flex items-center gap-1.5 cursor-pointer text-sm">
                            <Target className="h-3.5 w-3.5 text-primary" /> Lead
                          </Label>
                        </div>
                      </RadioGroup>

                      <Input
                        value={editData.field_name}
                        onChange={(e) => setEditData(prev => ({ ...prev, field_name: e.target.value }))}
                        placeholder="Nome do campo"
                        autoFocus
                      />

                      <Select
                        value={editData.field_type}
                        onValueChange={(val) => setEditData(prev => ({
                          ...prev,
                          field_type: val as FieldType,
                          options: showOptions(val as FieldType) ? prev.options : [],
                        }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {FIELD_TYPE_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {showOptions(editData.field_type) && (
                        <div className="space-y-2">
                          <Label className="text-xs">Opções</Label>
                          <div className="flex gap-2">
                            <Input
                              value={editOption}
                              onChange={(e) => setEditOption(e.target.value)}
                              placeholder="Nova opção"
                              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddEditOption())}
                            />
                            <Button size="sm" type="button" onClick={handleAddEditOption}>+</Button>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {editData.options.map((opt, i) => (
                              <Badge key={i} variant="secondary" className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground" onClick={() => handleRemoveEditOption(i)}>
                                {opt} ×
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        <Switch
                          checked={editData.is_required}
                          onCheckedChange={(checked) => setEditData(prev => ({ ...prev, is_required: checked }))}
                        />
                        <Label className="text-sm">Campo obrigatório</Label>
                      </div>

                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleSaveEdit} disabled={!editData.field_name.trim() || updateField.isPending} className="flex-1">
                          {updateField.isPending ? "Salvando..." : "Salvar"}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingFieldId(null)}>Cancelar</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 p-2 rounded-lg border border-border bg-muted/30">
                      <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">{field.field_name}</span>
                          <Badge variant={field.entity_type === 'lead' ? 'default' : 'secondary'} className="text-xs">
                            {field.entity_type === 'lead' ? <><Target className="h-3 w-3 mr-1" />Lead</> : <><User className="h-3 w-3 mr-1" />Contato</>}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {FIELD_TYPE_LABELS[field.field_type] || field.field_type}
                          </Badge>
                          {field.is_required && (
                            <Badge variant="destructive" className="text-xs">Obrigatório</Badge>
                          )}
                          {duplicateIds.has(field.id) && (
                            <Badge variant="outline" className="text-xs border-amber-500/60 text-amber-600 dark:text-amber-400">
                              <AlertTriangle className="h-3 w-3 mr-1" /> Possível duplicata
                            </Badge>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">{field.field_key}</span>
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEditing(field)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDeleteField(field.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum campo personalizado criado</p>
          )}

          <Separator />

          {isAddingField ? (
            <div className="space-y-4 p-3 rounded-lg border border-border bg-muted/20">
              <div className="space-y-2">
                <Label>Este campo pertence a</Label>
                <RadioGroup
                  value={newField.entity_type}
                  onValueChange={(val) => setNewField(prev => ({ ...prev, entity_type: val as 'contact' | 'lead' }))}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="contact" id="entity-contact" />
                    <Label htmlFor="entity-contact" className="flex items-center gap-1.5 cursor-pointer">
                      <User className="h-4 w-4 text-muted-foreground" /> Contato
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="lead" id="entity-lead" />
                    <Label htmlFor="entity-lead" className="flex items-center gap-1.5 cursor-pointer">
                      <Target className="h-4 w-4 text-primary" /> Lead/Deal
                    </Label>
                  </div>
                </RadioGroup>
                <p className="text-xs text-muted-foreground">
                  {newField.entity_type === 'lead' ? 'Campos de Lead são específicos de cada negócio no funil.' : 'Campos de Contato são compartilhados entre todos os negócios.'}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="field_name">Nome do Campo</Label>
                <Input
                  id="field_name"
                  value={newField.field_name}
                  onChange={(e) => {
                    const name = e.target.value;
                    setNewField(prev => ({ ...prev, field_name: name, field_key: generateFieldKey(name), field_type: inferFieldType(name) }));
                  }}
                  placeholder="Ex: Empresa"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="field_key">Chave</Label>
                <Input
                  id="field_key"
                  value={newField.field_key}
                  onChange={(e) => setNewField(prev => ({ ...prev, field_key: e.target.value }))}
                  placeholder="Ex: empresa"
                  className="font-mono text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select
                  value={newField.field_type}
                  onValueChange={(val) => setNewField(prev => ({
                    ...prev,
                    field_type: val as FieldType,
                    options: showOptions(val as FieldType) ? prev.options : [],
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FIELD_TYPE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {showOptions(newField.field_type) && (
                <div className="space-y-2">
                  <Label>Opções</Label>
                  <div className="flex gap-2">
                    <Input
                      value={newOption}
                      onChange={(e) => setNewOption(e.target.value)}
                      placeholder="Nova opção"
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddOption())}
                    />
                    <Button size="sm" type="button" onClick={handleAddOption}>Adicionar</Button>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {newField.options.map((opt, i) => (
                      <Badge key={i} variant="secondary" className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground" onClick={() => handleRemoveOption(i)}>
                        {opt} ×
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2">
                <Switch
                  id="is_required"
                  checked={newField.is_required}
                  onCheckedChange={(checked) => setNewField(prev => ({ ...prev, is_required: checked }))}
                />
                <Label htmlFor="is_required" className="text-sm">Campo obrigatório</Label>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleAddField} className="flex-1" disabled={!newField.field_name || !newField.field_key}>Salvar Campo</Button>
                <Button variant="outline" onClick={() => setIsAddingField(false)}>Cancelar</Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" className="w-full" onClick={() => setIsAddingField(true)}>
              <Plus className="h-4 w-4 mr-2" /> Adicionar Campo
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
