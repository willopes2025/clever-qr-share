import { useState } from "react";
import { Plus, Trash2, GripVertical, Settings, User, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { CustomFieldDefinition, useCustomFields } from "@/hooks/useCustomFields";

const FIELD_TYPE_LABELS: Record<string, string> = {
  text: "Texto",
  number: "Número",
  boolean: "Sim/Não",
  date: "Data",
  select: "Seleção",
};

export const CustomFieldsManager = () => {
  const { fieldDefinitions, createField, updateField, deleteField, isLoading } = useCustomFields();
  const [isOpen, setIsOpen] = useState(false);
  const [isAddingField, setIsAddingField] = useState(false);
  const [newField, setNewField] = useState({
    field_name: "",
    field_key: "",
    field_type: "text" as CustomFieldDefinition['field_type'],
    entity_type: "contact" as "contact" | "lead",
    options: [] as string[],
    is_required: false,
    display_order: 0,
  });
  const [newOption, setNewOption] = useState("");

  const handleAddField = async () => {
    if (!newField.field_name || !newField.field_key) return;

    await createField.mutateAsync({
      ...newField,
      display_order: (fieldDefinitions?.length || 0),
    });

    setNewField({
      field_name: "",
      field_key: "",
      field_type: "text",
      entity_type: "contact",
      options: [],
      is_required: false,
      display_order: 0,
    });
    setIsAddingField(false);
  };

  const handleDeleteField = async (id: string) => {
    await deleteField.mutateAsync(id);
  };

  const handleAddOption = () => {
    if (!newOption.trim()) return;
    setNewField(prev => ({
      ...prev,
      options: [...prev.options, newOption.trim()],
    }));
    setNewOption("");
  };

  const handleRemoveOption = (index: number) => {
    setNewField(prev => ({
      ...prev,
      options: prev.options.filter((_, i) => i !== index),
    }));
  };

  const generateFieldKey = (name: string) => {
    return name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
          <Settings className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Campos Personalizados</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Existing fields */}
          {fieldDefinitions && fieldDefinitions.length > 0 ? (
            <div className="space-y-2">
              {fieldDefinitions.map((field) => (
                <div
                  key={field.id}
                  className="flex items-center gap-2 p-2 rounded-lg border border-border bg-muted/30"
                >
                  <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{field.field_name}</span>
                      <Badge 
                        variant={field.entity_type === 'lead' ? 'default' : 'secondary'} 
                        className="text-xs"
                      >
                        {field.entity_type === 'lead' ? (
                          <><Target className="h-3 w-3 mr-1" />Lead</>
                        ) : (
                          <><User className="h-3 w-3 mr-1" />Contato</>
                        )}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {FIELD_TYPE_LABELS[field.field_type] || field.field_type}
                      </Badge>
                      {field.is_required && (
                        <Badge variant="destructive" className="text-xs">
                          Obrigatório
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">{field.field_key}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => handleDeleteField(field.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhum campo personalizado criado
            </p>
          )}

          <Separator />

          {/* Add new field form */}
          {isAddingField ? (
            <div className="space-y-4 p-3 rounded-lg border border-border bg-muted/20">
              {/* Entity Type Selector */}
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
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span>Contato</span>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="lead" id="entity-lead" />
                    <Label htmlFor="entity-lead" className="flex items-center gap-1.5 cursor-pointer">
                      <Target className="h-4 w-4 text-primary" />
                      <span>Lead/Deal</span>
                    </Label>
                  </div>
                </RadioGroup>
                <p className="text-xs text-muted-foreground">
                  {newField.entity_type === 'lead' 
                    ? 'Campos de Lead são específicos de cada negócio no funil.' 
                    : 'Campos de Contato são compartilhados entre todos os negócios.'}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="field_name">Nome do Campo</Label>
                <Input
                  id="field_name"
                  value={newField.field_name}
                  onChange={(e) => {
                    const name = e.target.value;
                    setNewField(prev => ({
                      ...prev,
                      field_name: name,
                      field_key: generateFieldKey(name),
                    }));
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
                    field_type: val as CustomFieldDefinition['field_type'],
                    options: val === 'select' ? prev.options : [],
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Texto</SelectItem>
                    <SelectItem value="number">Número</SelectItem>
                    <SelectItem value="boolean">Sim/Não</SelectItem>
                    <SelectItem value="date">Data</SelectItem>
                    <SelectItem value="select">Seleção</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Options for select type */}
              {newField.field_type === 'select' && (
                <div className="space-y-2">
                  <Label>Opções</Label>
                  <div className="flex gap-2">
                    <Input
                      value={newOption}
                      onChange={(e) => setNewOption(e.target.value)}
                      placeholder="Nova opção"
                      onKeyDown={(e) => e.key === 'Enter' && handleAddOption()}
                    />
                    <Button size="sm" onClick={handleAddOption}>Adicionar</Button>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {newField.options.map((opt, i) => (
                      <Badge
                        key={i}
                        variant="secondary"
                        className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                        onClick={() => handleRemoveOption(i)}
                      >
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
                <Button onClick={handleAddField} className="flex-1" disabled={!newField.field_name || !newField.field_key}>
                  Salvar Campo
                </Button>
                <Button variant="outline" onClick={() => setIsAddingField(false)}>
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setIsAddingField(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Campo
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
