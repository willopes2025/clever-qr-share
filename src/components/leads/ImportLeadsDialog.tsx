import { useState, useMemo } from "react";
import { Company } from "@/pages/LeadSearch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Tag, AlertCircle, CheckCircle2, ArrowLeft, ArrowRight, Plus, Settings2 } from "lucide-react";
import { useContacts } from "@/hooks/useContacts";
import { useCustomFields, CustomFieldDefinition } from "@/hooks/useCustomFields";
import { CreateFieldInlineDialog, NewFieldConfig } from "@/components/contacts/CreateFieldInlineDialog";
import { toast } from "sonner";
import { toTitleCase } from "@/lib/utils";

interface ImportLeadsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companies: Company[];
  onSuccess: () => void;
}

type ImportStep = "summary" | "mapping" | "tags";

interface SourceField {
  key: string;
  label: string;
  icon: string;
  getValue: (company: Company) => string | number | null | undefined;
  suggestedType: "text" | "number" | "date";
}

const SOURCE_FIELDS: SourceField[] = [
  { key: "cnpj", label: "CNPJ", icon: "🏢", getValue: (c) => c.cnpj, suggestedType: "text" },
  { key: "razao_social", label: "Razão Social", icon: "📋", getValue: (c) => c.razao_social, suggestedType: "text" },
  { key: "nome_fantasia", label: "Nome Fantasia", icon: "🏷️", getValue: (c) => c.nome_fantasia, suggestedType: "text" },
  { key: "capital_social", label: "Capital Social", icon: "💰", getValue: (c) => c.capital_social, suggestedType: "number" },
  { key: "data_abertura", label: "Data de Abertura", icon: "📅", getValue: (c) => c.data_abertura, suggestedType: "date" },
  { key: "porte", label: "Porte", icon: "📊", getValue: (c) => c.porte, suggestedType: "text" },
  { key: "natureza_juridica", label: "Natureza Jurídica", icon: "⚖️", getValue: (c) => c.natureza_juridica, suggestedType: "text" },
  { key: "cnae_principal", label: "CNAE Principal", icon: "🏭", getValue: (c) => c.cnae_principal, suggestedType: "text" },
  { key: "situacao_cadastral", label: "Situação Cadastral", icon: "✅", getValue: (c) => typeof c.situacao_cadastral === 'string' ? c.situacao_cadastral : c.situacao_cadastral?.situacao_atual, suggestedType: "text" },
  { key: "telefone2", label: "Telefone 2", icon: "📞", getValue: (c) => c.telefone2, suggestedType: "text" },
  { key: "municipio", label: "Município", icon: "🏙️", getValue: (c) => c.endereco?.municipio, suggestedType: "text" },
  { key: "uf", label: "UF", icon: "🗺️", getValue: (c) => c.endereco?.uf, suggestedType: "text" },
  { key: "bairro", label: "Bairro", icon: "📍", getValue: (c) => c.endereco?.bairro, suggestedType: "text" },
  { key: "cep", label: "CEP", icon: "📮", getValue: (c) => c.endereco?.cep, suggestedType: "text" },
  { key: "endereco_completo", label: "Endereço Completo", icon: "🏠", getValue: (c) => {
    if (!c.endereco?.logradouro) return null;
    return `${c.endereco.logradouro}, ${c.endereco.numero || 'S/N'} - ${c.endereco.bairro || ''}, ${c.endereco.cep || ''}`.trim();
  }, suggestedType: "text" },
];

// Standard fields that are handled automatically
const STANDARD_FIELDS = [
  { value: "ignore", label: "🚫 Ignorar" },
  { value: "notes", label: "📝 Notas" },
];

interface FieldMapping {
  sourceKey: string;
  targetType: "ignore" | "notes" | "existing" | "new";
  targetFieldKey?: string; // for existing custom fields
  newFieldConfig?: NewFieldConfig; // for fields to be created
}

export const ImportLeadsDialog = ({
  open,
  onOpenChange,
  companies,
  onSuccess,
}: ImportLeadsDialogProps) => {
  const { tags, importContacts, createTag } = useContacts();
  const { fieldDefinitions, createField } = useCustomFields();
  
  const [step, setStep] = useState<ImportStep>("summary");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [newTagName, setNewTagName] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [skipWithoutPhone, setSkipWithoutPhone] = useState(true);
  
  // Mapping state
  const [mappings, setMappings] = useState<Record<string, FieldMapping>>({});
  const [newFieldsToCreate, setNewFieldsToCreate] = useState<NewFieldConfig[]>([]);
  const [createFieldDialogOpen, setCreateFieldDialogOpen] = useState(false);
  const [currentFieldForCreate, setCurrentFieldForCreate] = useState<string>("");

  const companiesWithPhone = companies.filter(c => c.telefone);
  const companiesWithoutPhone = companies.filter(c => !c.telefone);

  // Count how many companies have data for each field
  const fieldDataCounts = useMemo(() => {
    const toCheck = skipWithoutPhone ? companiesWithPhone : companies;
    const counts: Record<string, number> = {};
    SOURCE_FIELDS.forEach(field => {
      counts[field.key] = toCheck.filter(c => {
        const val = field.getValue(c);
        return val !== null && val !== undefined && val !== '';
      }).length;
    });
    return counts;
  }, [companies, companiesWithPhone, skipWithoutPhone]);

  // Initialize mappings with auto-detection
  const initializeMappings = () => {
    const newMappings: Record<string, FieldMapping> = {};
    
    SOURCE_FIELDS.forEach(field => {
      // Check if there's an existing custom field with matching key
      const existingField = fieldDefinitions?.find(
        f => f.field_key === field.key || f.field_name.toLowerCase() === field.label.toLowerCase()
      );
      
      if (existingField) {
        newMappings[field.key] = {
          sourceKey: field.key,
          targetType: "existing",
          targetFieldKey: existingField.field_key,
        };
      } else {
        // Default to creating a new field with the same name
        newMappings[field.key] = {
          sourceKey: field.key,
          targetType: "new",
          newFieldConfig: {
            field_name: field.label,
            field_key: field.key,
            field_type: field.suggestedType,
          },
        };
      }
    });
    
    setMappings(newMappings);
  };

  const handleToggleTag = (tagId: string) => {
    setSelectedTags(prev => 
      prev.includes(tagId) 
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;
    
    try {
      const result = await createTag.mutateAsync({ 
        name: newTagName.trim(), 
        color: '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0')
      });
      if (result) {
        setSelectedTags(prev => [...prev, result.id]);
        setNewTagName("");
      }
    } catch (error) {
      console.error('Error creating tag:', error);
    }
  };

  const handleMappingChange = (sourceKey: string, value: string) => {
    if (value === "ignore") {
      setMappings(prev => ({
        ...prev,
        [sourceKey]: { sourceKey, targetType: "ignore" }
      }));
    } else if (value === "notes") {
      setMappings(prev => ({
        ...prev,
        [sourceKey]: { sourceKey, targetType: "notes" }
      }));
    } else if (value === "create_new") {
      // Open create field dialog
      const sourceField = SOURCE_FIELDS.find(f => f.key === sourceKey);
      setCurrentFieldForCreate(sourceKey);
      setCreateFieldDialogOpen(true);
    } else {
      // Existing field
      setMappings(prev => ({
        ...prev,
        [sourceKey]: { sourceKey, targetType: "existing", targetFieldKey: value }
      }));
    }
  };

  const handleCreateNewField = (config: NewFieldConfig) => {
    setNewFieldsToCreate(prev => [...prev.filter(f => f.field_key !== config.field_key), config]);
    setMappings(prev => ({
      ...prev,
      [currentFieldForCreate]: {
        sourceKey: currentFieldForCreate,
        targetType: "new",
        newFieldConfig: config,
      }
    }));
    setCreateFieldDialogOpen(false);
  };

  const getMappingDisplayValue = (sourceKey: string): string => {
    const mapping = mappings[sourceKey];
    if (!mapping) return "new";
    
    if (mapping.targetType === "ignore") return "ignore";
    if (mapping.targetType === "notes") return "notes";
    if (mapping.targetType === "existing" && mapping.targetFieldKey) return mapping.targetFieldKey;
    if (mapping.targetType === "new") return "create_new";
    
    return "new";
  };

  const handleImport = async () => {
    setIsImporting(true);
    
    try {
      // First, create all new fields
      const fieldsToCreate = Object.values(mappings)
        .filter(m => m.targetType === "new" && m.newFieldConfig)
        .map(m => m.newFieldConfig!);
      
      // Dedupe and create fields
      const uniqueFields = fieldsToCreate.reduce((acc, field) => {
        if (!acc.find(f => f.field_key === field.field_key)) {
          acc.push(field);
        }
        return acc;
      }, [] as NewFieldConfig[]);

      for (const field of uniqueFields) {
        // Check if field already exists
        const exists = fieldDefinitions?.find(f => f.field_key === field.field_key);
        if (!exists) {
          await createField.mutateAsync({
            field_name: field.field_name,
            field_key: field.field_key,
            field_type: field.field_type,
            options: field.options || [],
            is_required: field.is_required || false,
            display_order: (fieldDefinitions?.length || 0) + 1,
          });
        }
      }

      // Filter companies based on settings
      const toImport = skipWithoutPhone ? companiesWithPhone : companies;
      
      if (toImport.length === 0) {
        toast.error('Nenhuma empresa com telefone para importar');
        return;
      }

      // Build notes fields to append
      const notesFields = Object.values(mappings)
        .filter(m => m.targetType === "notes")
        .map(m => SOURCE_FIELDS.find(f => f.key === m.sourceKey)!)
        .filter(Boolean);

      // Format contacts for import
      const contacts = toImport.map(company => {
        const ddd = company.endereco?.ddd || '';
        const phone = company.telefone || '';
        const fullPhone = ddd + phone;
        
        // Normalize to Brazilian format with country code
        let normalizedPhone = fullPhone.replace(/\D/g, '');
        if (normalizedPhone.length >= 10 && normalizedPhone.length <= 11 && !normalizedPhone.startsWith('55')) {
          normalizedPhone = '55' + normalizedPhone;
        }

        // Campos que devem receber formatação Primeira Maiúscula
        const titleCaseFields = [
          'razao_social', 'nome_fantasia', 'porte', 'natureza_juridica', 
          'cnae_principal', 'municipio', 'bairro', 'endereco_completo'
        ];

        // Build custom_fields based on mappings
        const customFields: Record<string, string> = {};
        
        Object.values(mappings).forEach(mapping => {
          if (mapping.targetType === "ignore" || mapping.targetType === "notes") return;
          
          const sourceField = SOURCE_FIELDS.find(f => f.key === mapping.sourceKey);
          if (!sourceField) return;
          
          const value = sourceField.getValue(company);
          if (value === null || value === undefined || value === '') return;
          
          const targetKey = mapping.targetType === "existing" 
            ? mapping.targetFieldKey 
            : mapping.newFieldConfig?.field_key;
          
          if (targetKey) {
            // Aplica toTitleCase apenas em campos de texto específicos
            const formattedValue = titleCaseFields.includes(mapping.sourceKey) 
              ? toTitleCase(String(value))
              : String(value);
            customFields[targetKey] = formattedValue;
          }
        });

        // Build notes from notes-mapped fields
        const notesLines = notesFields
          .map(field => {
            const value = field.getValue(company);
            if (!value) return null;
            // Aplica toTitleCase nas notas também se for um campo de texto
            const formattedValue = titleCaseFields.includes(field.key) 
              ? toTitleCase(String(value))
              : String(value);
            return `${field.label}: ${formattedValue}`;
          })
          .filter(Boolean);

        return {
          phone: normalizedPhone,
          name: toTitleCase(company.nome_fantasia || company.razao_social),
          email: company.email?.toLowerCase() || undefined,
          notes: notesLines.length > 0 ? notesLines.join('\n') : undefined,
          custom_fields: customFields,
        };
      });

      // Import using the existing hook
      const result = await importContacts.mutateAsync({
        contacts,
        tagIds: selectedTags.length > 0 ? selectedTags : undefined,
      });

      const importedCount = result?.length || 0;
      toast.success(`${importedCount} contatos importados com sucesso!`);
      onSuccess();
      
      // Reset state
      setStep("summary");
      setMappings({});
      setSelectedTags([]);
      setNewFieldsToCreate([]);
    } catch (error) {
      console.error('Import error:', error);
      toast.error('Erro ao importar contatos');
    } finally {
      setIsImporting(false);
    }
  };

  const handleNext = () => {
    if (step === "summary") {
      initializeMappings();
      setStep("mapping");
    } else if (step === "mapping") {
      setStep("tags");
    }
  };

  const handleBack = () => {
    if (step === "mapping") {
      setStep("summary");
    } else if (step === "tags") {
      setStep("mapping");
    }
  };

  const handleClose = () => {
    setStep("summary");
    setMappings({});
    setSelectedTags([]);
    setNewFieldsToCreate([]);
    onOpenChange(false);
  };

  const currentSourceField = SOURCE_FIELDS.find(f => f.key === currentFieldForCreate);

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Importar Leads para Contatos
            </DialogTitle>
            <DialogDescription className="flex items-center gap-2">
              {step === "summary" && "Resumo das empresas selecionadas"}
              {step === "mapping" && "Configure como os dados serão importados"}
              {step === "tags" && "Aplique tags aos contatos importados"}
              
              {/* Step indicator */}
              <div className="ml-auto flex items-center gap-1">
                <Badge variant={step === "summary" ? "default" : "secondary"} className="text-xs">1</Badge>
                <span className="text-muted-foreground">→</span>
                <Badge variant={step === "mapping" ? "default" : "secondary"} className="text-xs">2</Badge>
                <span className="text-muted-foreground">→</span>
                <Badge variant={step === "tags" ? "default" : "secondary"} className="text-xs">3</Badge>
              </div>
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-hidden">
            {/* Step 1: Summary */}
            {step === "summary" && (
              <div className="space-y-4 py-4">
                <div className="bg-muted rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      Com telefone
                    </span>
                    <Badge variant="default">{companiesWithPhone.length}</Badge>
                  </div>
                  {companiesWithoutPhone.length > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <AlertCircle className="h-4 w-4 text-yellow-500" />
                        Sem telefone
                      </span>
                      <Badge variant="secondary">{companiesWithoutPhone.length}</Badge>
                    </div>
                  )}
                </div>

                {companiesWithoutPhone.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="skip_without_phone"
                      checked={skipWithoutPhone}
                      onCheckedChange={(c) => setSkipWithoutPhone(!!c)}
                    />
                    <Label htmlFor="skip_without_phone" className="text-sm">
                      Ignorar empresas sem telefone
                    </Label>
                  </div>
                )}

                <div className="bg-muted/50 rounded-lg p-4">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Settings2 className="h-4 w-4" />
                    Campos disponíveis para importação
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {SOURCE_FIELDS.map(field => (
                      <div key={field.key} className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <span>{field.icon}</span>
                          <span className="text-muted-foreground">{field.label}</span>
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {fieldDataCounts[field.key]}/{skipWithoutPhone ? companiesWithPhone.length : companies.length}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Mapping */}
            {step === "mapping" && (
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-3 py-4">
                  <p className="text-sm text-muted-foreground mb-4">
                    Para cada campo, escolha como deseja importar os dados: ignorar, adicionar às notas, usar campo existente ou criar novo campo.
                  </p>
                  
                  {SOURCE_FIELDS.map(field => {
                    const hasData = fieldDataCounts[field.key] > 0;
                    
                    return (
                      <div 
                        key={field.key} 
                        className={`flex items-center gap-3 p-3 rounded-lg border ${hasData ? 'bg-background' : 'bg-muted/30 opacity-60'}`}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span>{field.icon}</span>
                            <span className="font-medium">{field.label}</span>
                            <Badge variant="outline" className="text-xs">
                              {fieldDataCounts[field.key]} registros
                            </Badge>
                          </div>
                          {companies.length > 0 && (
                            <p className="text-xs text-muted-foreground mt-1 truncate max-w-[300px]">
                              Ex: {String(field.getValue(companies[0]) || '-')}
                            </p>
                          )}
                        </div>
                        
                        <Select
                          value={getMappingDisplayValue(field.key)}
                          onValueChange={(v) => handleMappingChange(field.key, v)}
                          disabled={!hasData}
                        >
                          <SelectTrigger className="w-[200px]">
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                          <SelectContent>
                            {STANDARD_FIELDS.map(sf => (
                              <SelectItem key={sf.value} value={sf.value}>
                                {sf.label}
                              </SelectItem>
                            ))}
                            
                            <SelectItem value="create_new" className="text-primary">
                              <span className="flex items-center gap-2">
                                <Plus className="h-3 w-3" />
                                Criar novo campo...
                              </span>
                            </SelectItem>
                            
                            {fieldDefinitions && fieldDefinitions.length > 0 && (
                              <>
                                <SelectItem value="---" disabled>
                                  ── Campos existentes ──
                                </SelectItem>
                                {fieldDefinitions.map(fd => (
                                  <SelectItem key={fd.field_key} value={fd.field_key}>
                                    📋 {fd.field_name}
                                  </SelectItem>
                                ))}
                              </>
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}

            {/* Step 3: Tags */}
            {step === "tags" && (
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Tag className="h-4 w-4" />
                    Aplicar Tags (opcional)
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {tags?.map((tag) => (
                      <Badge
                        key={tag.id}
                        variant={selectedTags.includes(tag.id) ? "default" : "outline"}
                        className="cursor-pointer"
                        style={selectedTags.includes(tag.id) ? { backgroundColor: tag.color } : {}}
                        onClick={() => handleToggleTag(tag.id)}
                      >
                        {tag.name}
                      </Badge>
                    ))}
                  </div>
                  
                  <div className="flex gap-2 mt-2">
                    <input
                      type="text"
                      placeholder="Nova tag..."
                      value={newTagName}
                      onChange={(e) => setNewTagName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleCreateTag()}
                      className="flex-1 px-3 py-1.5 text-sm border rounded-md bg-background"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleCreateTag}
                      disabled={!newTagName.trim()}
                    >
                      Criar
                    </Button>
                  </div>
                </div>

                {/* Summary of what will be imported */}
                <div className="bg-muted rounded-lg p-4 space-y-2 mt-4">
                  <h4 className="font-medium text-sm">Resumo da importação</h4>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>• {skipWithoutPhone ? companiesWithPhone.length : companies.length} contatos serão importados</p>
                    <p>• {Object.values(mappings).filter(m => m.targetType === "new").length} novos campos serão criados</p>
                    <p>• {Object.values(mappings).filter(m => m.targetType === "existing").length} campos existentes serão usados</p>
                    <p>• {selectedTags.length} tag(s) serão aplicadas</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            {step !== "summary" && (
              <Button variant="outline" onClick={handleBack}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>
            )}
            
            {step === "summary" && (
              <Button variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
            )}
            
            {step !== "tags" ? (
              <Button 
                onClick={handleNext}
                disabled={skipWithoutPhone && companiesWithPhone.length === 0}
              >
                Próximo
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button 
                onClick={handleImport} 
                disabled={isImporting || (skipWithoutPhone && companiesWithPhone.length === 0)}
              >
                <Download className="h-4 w-4 mr-2" />
                {isImporting ? "Importando..." : `Importar ${skipWithoutPhone ? companiesWithPhone.length : companies.length} Contatos`}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Field Dialog */}
      <CreateFieldInlineDialog
        open={createFieldDialogOpen}
        onOpenChange={setCreateFieldDialogOpen}
        onCreateField={handleCreateNewField}
        suggestedName={currentSourceField?.label || ""}
      />
    </>
  );
};
