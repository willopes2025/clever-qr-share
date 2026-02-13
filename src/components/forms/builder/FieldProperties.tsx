import { useState, useEffect } from "react";
import { FormField, UpdateFieldData } from "@/hooks/useForms";
import { useCustomFields } from "@/hooks/useCustomFields";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Plus, Trash2, Settings } from "lucide-react";

interface FieldPropertiesProps {
  field: FormField | null;
  onUpdate: (updates: UpdateFieldData) => void;
}

const contactFields = [
  { value: 'name', label: 'Nome' },
  { value: 'email', label: 'E-mail' },
  { value: 'phone', label: 'Telefone' },
];

export const FieldProperties = ({ field, onUpdate }: FieldPropertiesProps) => {
  const { fieldDefinitions, leadFieldDefinitions } = useCustomFields();
  const [localField, setLocalField] = useState<FormField | null>(field);

  useEffect(() => {
    setLocalField(field);
  }, [field]);

  if (!localField) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-muted/30 p-6 text-center">
        <Settings className="h-8 w-8 text-muted-foreground mb-3" />
        <h3 className="font-medium mb-1">Propriedades do Campo</h3>
        <p className="text-sm text-muted-foreground">
          Selecione um campo para editar suas propriedades
        </p>
      </div>
    );
  }

  const handleChange = (key: keyof UpdateFieldData, value: any) => {
    setLocalField({ ...localField, [key]: value });
    onUpdate({ [key]: value });
  };

  const handleOptionChange = (index: number, key: 'value' | 'label', value: string) => {
    const newOptions = [...(localField.options || [])];
    newOptions[index] = { ...newOptions[index], [key]: value };
    handleChange('options', newOptions);
  };

  const addOption = () => {
    const newOptions = [
      ...(localField.options || []),
      { value: `option${(localField.options?.length || 0) + 1}`, label: `Opção ${(localField.options?.length || 0) + 1}` },
    ];
    handleChange('options', newOptions);
  };

  const removeOption = (index: number) => {
    const newOptions = localField.options?.filter((_, i) => i !== index);
    handleChange('options', newOptions);
  };

  const hasOptions = ['select', 'multi_select', 'radio', 'checkbox'].includes(localField.field_type);
  const isLayoutField = ['heading', 'paragraph', 'divider'].includes(localField.field_type);
  const isDistrictField = localField.field_type === 'district';

  const UF_LIST = [
    'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG',
    'PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'
  ];

  const currentUfs: string[] = (localField.settings as any)?.ufs || [];

  const toggleUf = (uf: string) => {
    const newUfs = currentUfs.includes(uf)
      ? currentUfs.filter(u => u !== uf)
      : [...currentUfs, uf];
    handleChange('settings', { ...(localField.settings || {}), ufs: newUfs });
  };

  return (
    <div className="h-full flex flex-col bg-muted/30">
      <div className="p-4 border-b">
        <h3 className="font-medium text-sm">Propriedades</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Configure as opções do campo
        </p>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Basic Properties */}
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="label">Label</Label>
              <Input
                id="label"
                value={localField.label}
                onChange={(e) => handleChange('label', e.target.value)}
              />
            </div>

            {!isLayoutField && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="placeholder">Placeholder</Label>
                  <Input
                    id="placeholder"
                    value={localField.placeholder || ''}
                    onChange={(e) => handleChange('placeholder', e.target.value || null)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="help_text">Texto de Ajuda</Label>
                  <Textarea
                    id="help_text"
                    value={localField.help_text || ''}
                    onChange={(e) => handleChange('help_text', e.target.value || null)}
                    rows={2}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="required">Obrigatório</Label>
                  <Switch
                    id="required"
                    checked={localField.required}
                    onCheckedChange={(checked) => handleChange('required', checked)}
                  />
                </div>
              </>
            )}
          </div>

          {/* Options for selection fields */}
          {hasOptions && (
            <>
              <Separator />
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Opções</Label>
                  <Button variant="ghost" size="sm" onClick={addOption}>
                    <Plus className="h-4 w-4 mr-1" />
                    Adicionar
                  </Button>
                </div>
                <div className="space-y-2">
                  {localField.options?.map((option, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Input
                        value={option.label}
                        onChange={(e) => handleOptionChange(index, 'label', e.target.value)}
                        placeholder="Texto da opção"
                        className="flex-1"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => removeOption(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* UF filter for district fields */}
          {isDistrictField && (
            <>
              <Separator />
              <div className="space-y-3">
                <Label className="text-sm font-medium">Filtrar por UFs</Label>
                <p className="text-xs text-muted-foreground">
                  Selecione os estados para filtrar os distritos. Deixe vazio para não carregar automaticamente.
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {UF_LIST.map((uf) => (
                    <Button
                      key={uf}
                      type="button"
                      variant={currentUfs.includes(uf) ? "default" : "outline"}
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => toggleUf(uf)}
                    >
                      {uf}
                    </Button>
                  ))}
                </div>
                {currentUfs.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Selecionados: {currentUfs.join(', ')}
                  </p>
                )}
              </div>
            </>
          )}

          {/* Mapping to Lead */}
          {!isLayoutField && (
            <>
              <Separator />
              <div className="space-y-3">
                <Label className="text-sm font-medium">Mapeamento para o Lead</Label>
                <p className="text-xs text-muted-foreground">
                  Defina como este dado será salvo no perfil do contato
                </p>

                <Select
                  value={localField.mapping_type || 'none'}
                  onValueChange={(value) => {
                    if (value === 'none') {
                      handleChange('mapping_type', null);
                      handleChange('mapping_target', null);
                    } else {
                      handleChange('mapping_type', value);
                      // Clear target when changing type
                      if (value !== localField.mapping_type) {
                        handleChange('mapping_target', null);
                      }
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Não salvar no perfil</SelectItem>
                    <SelectItem value="contact_field">Campo nativo do contato</SelectItem>
                    <SelectItem value="custom_field">Campo personalizado (Contato)</SelectItem>
                    <SelectItem value="lead_field">Campo personalizado (Lead)</SelectItem>
                    <SelectItem value="new_custom_field">Criar novo campo de Contato</SelectItem>
                    <SelectItem value="new_lead_field">Criar novo campo de Lead</SelectItem>
                  </SelectContent>
                </Select>

                {localField.mapping_type === 'contact_field' && (
                  <Select
                    value={localField.mapping_target || ''}
                    onValueChange={(value) => handleChange('mapping_target', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o campo..." />
                    </SelectTrigger>
                    <SelectContent>
                      {contactFields.map((cf) => (
                        <SelectItem key={cf.value} value={cf.value}>
                          {cf.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {localField.mapping_type === 'custom_field' && (
                  <Select
                    value={localField.mapping_target || ''}
                    onValueChange={(value) => handleChange('mapping_target', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o campo..." />
                    </SelectTrigger>
                    <SelectContent>
                      {fieldDefinitions?.map((cf) => (
                        <SelectItem key={cf.field_key} value={cf.field_key}>
                          {cf.field_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {localField.mapping_type === 'lead_field' && (
                  <Select
                    value={localField.mapping_target || ''}
                    onValueChange={(value) => handleChange('mapping_target', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o campo de lead..." />
                    </SelectTrigger>
                    <SelectContent>
                      {leadFieldDefinitions?.map((cf) => (
                        <SelectItem key={cf.field_key} value={cf.field_key}>
                          {cf.field_name}
                        </SelectItem>
                      ))}
                      {(!leadFieldDefinitions || leadFieldDefinitions.length === 0) && (
                        <SelectItem value="" disabled>
                          Nenhum campo de lead definido
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                )}

                {localField.mapping_type === 'new_custom_field' && (
                  <div className="space-y-2">
                    <Input
                      placeholder="Nome do novo campo de contato..."
                      value={localField.mapping_target || ''}
                      onChange={(e) => handleChange('mapping_target', e.target.value)}
                    />
                    <div className="flex items-center justify-between">
                      <Label htmlFor="create_on_submit" className="text-xs">Criar automaticamente</Label>
                      <Switch
                        id="create_on_submit"
                        checked={localField.create_custom_field_on_submit}
                        onCheckedChange={(checked) => handleChange('create_custom_field_on_submit', checked)}
                      />
                    </div>
                  </div>
                )}

                {localField.mapping_type === 'new_lead_field' && (
                  <div className="space-y-2">
                    <Input
                      placeholder="Nome do novo campo de lead..."
                      value={localField.mapping_target || ''}
                      onChange={(e) => handleChange('mapping_target', e.target.value)}
                    />
                    <div className="flex items-center justify-between">
                      <Label htmlFor="create_on_submit" className="text-xs">Criar automaticamente</Label>
                      <Switch
                        id="create_on_submit"
                        checked={localField.create_custom_field_on_submit}
                        onCheckedChange={(checked) => handleChange('create_custom_field_on_submit', checked)}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Campo será salvo no Deal/Lead quando roteado para funil
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};
