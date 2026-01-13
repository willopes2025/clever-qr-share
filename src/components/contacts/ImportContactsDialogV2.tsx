import { useState, useCallback, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Upload,
  FileText,
  AlertCircle,
  CheckCircle2,
  Download,
  Tag,
  Plus,
  ArrowLeft,
  ArrowRight,
  Columns,
  Filter,
  RefreshCw,
  Phone,
} from "lucide-react";
import { toast } from "sonner";
import { CreateFieldInlineDialog, NewFieldConfig, FieldType } from "./CreateFieldInlineDialog";
import { CustomFieldDefinition } from "@/hooks/useCustomFields";
import { normalizePhoneWithCountryCode, normalizePhoneWithoutCountryCode } from "@/lib/phone-utils";

export interface TagOption {
  id: string;
  name: string;
  color: string;
}

export interface DeduplicationConfig {
  enabled: boolean;
  field: 'phone' | 'email' | 'contact_display_id' | string;
  action: 'skip' | 'update';
}

export interface PhoneNormalizationConfig {
  mode: 'none' | 'add_ddi' | 'remove_ddi';
  countryCode: string;
}

export interface ImportStats {
  total: number;
  new: number;
  duplicates: number;
  invalid: number;
}

interface ImportContactsDialogV2Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (
    contacts: { phone: string; name?: string; email?: string; notes?: string; contact_display_id?: string; custom_fields?: Record<string, unknown> }[],
    tagIds?: string[],
    newFields?: NewFieldConfig[],
    deduplication?: DeduplicationConfig,
    phoneNormalization?: PhoneNormalizationConfig
  ) => Promise<ImportStats | void>;
  isLoading?: boolean;
  tags?: TagOption[];
  existingFields?: CustomFieldDefinition[];
}

interface ColumnMapping {
  csvColumn: string;
  targetField: string; // 'ignore' | 'name' | 'phone' | 'email' | 'notes' | 'contact_display_id' | `custom:${field_key}` | `new:${index}`
  isNewField?: boolean;
  newFieldConfig?: NewFieldConfig;
}

type ImportStep = "upload" | "mapping" | "deduplication" | "tags";

const STANDARD_FIELDS = [
  { value: "ignore", label: "Ignorar coluna", icon: "🚫" },
  { value: "phone", label: "Telefone", icon: "📱" },
  { value: "name", label: "Nome", icon: "👤" },
  { value: "email", label: "E-mail", icon: "✉️" },
  { value: "notes", label: "Notas", icon: "📝" },
  { value: "contact_display_id", label: "ID Externo", icon: "🔗" },
];

// Field type labels for display
const FIELD_TYPE_LABELS: Record<string, string> = {
  text: "Texto",
  number: "Número",
  date: "Data",
  time: "Hora",
  datetime: "Data e Hora",
  boolean: "Caixa de Seleção",
  switch: "Interruptor",
  select: "Seleção Única",
  multiselect: "Seleção Múltipla",
  url: "Link/URL",
  phone: "Telefone",
  email: "E-mail",
};

export const ImportContactsDialogV2 = ({
  open,
  onOpenChange,
  onImport,
  isLoading,
  tags = [],
  existingFields = [],
}: ImportContactsDialogV2Props) => {
  const [step, setStep] = useState<ImportStep>("upload");
  const [fileName, setFileName] = useState("");
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvPreview, setCsvPreview] = useState<string[][]>([]);
  const [csvData, setCsvData] = useState<string[][]>([]);
  const [columnMappings, setColumnMappings] = useState<Record<string, ColumnMapping>>({});
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [newFields, setNewFields] = useState<NewFieldConfig[]>([]);
  
  // Deduplication state
  const [deduplication, setDeduplication] = useState<DeduplicationConfig>({
    enabled: true,
    field: 'phone',
    action: 'skip',
  });
  
  // Phone normalization state
  const [phoneNormalization, setPhoneNormalization] = useState<PhoneNormalizationConfig>({
    mode: 'add_ddi',
    countryCode: '55',
  });
  
  // Create field dialog state
  const [showCreateField, setShowCreateField] = useState(false);
  const [creatingForColumn, setCreatingForColumn] = useState<string>("");

  const toggleTag = (tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  const validatePhone = (phone: string): boolean => {
    const cleaned = phone.replace(/\D/g, "");
    return cleaned.length >= 10 && cleaned.length <= 15;
  };

  const downloadTemplate = () => {
    const headers = "telefone,nome,email,notas,empresa,produto,valor,data,link";
    const examples = [
      "5511999999999,João Silva,joao@email.com,Cliente VIP,TechCorp,Plano Pro,R$ 99,2024-01-15,https://loja.com",
      "5521988888888,Maria Santos,maria@email.com,Lead quente,StartupXYZ,Básico,R$ 49,2024-02-01,https://site.com",
    ].join("\n");

    const csvContent = `${headers}\n${examples}`;
    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "modelo_contatos.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const parseCSV = useCallback((text: string) => {
    const lines = text.split("\n").filter((line) => line.trim());
    if (lines.length === 0) return { headers: [], data: [], preview: [] };

    const separator = lines[0].includes(";") ? ";" : ",";
    const headers = lines[0].split(separator).map((h) => h.trim().replace(/"/g, ""));
    
    const data: string[][] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(separator).map((v) => v.trim().replace(/"/g, ""));
      if (values.some((v) => v)) {
        data.push(values);
      }
    }

    return {
      headers,
      data,
      preview: data.slice(0, 3),
    };
  }, []);

  const autoDetectMappings = useCallback((headers: string[]) => {
    const mappings: Record<string, ColumnMapping> = {};
    
    headers.forEach((header) => {
      const headerLower = header.toLowerCase();
      let targetField = "ignore";

      if (headerLower.includes("phone") || headerLower.includes("telefone") || headerLower.includes("número") || headerLower.includes("numero")) {
        targetField = "phone";
      } else if (headerLower.includes("name") || headerLower.includes("nome")) {
        targetField = "name";
      } else if (headerLower.includes("email") || headerLower.includes("e-mail")) {
        targetField = "email";
      } else if (headerLower.includes("notes") || headerLower.includes("notas") || headerLower.includes("observ")) {
        targetField = "notes";
      } else if (headerLower.includes("id") || headerLower.includes("codigo") || headerLower.includes("código") || headerLower.includes("external")) {
        targetField = "contact_display_id";
      } else if (headerLower.includes("cpf") || headerLower.includes("cnpj") || headerLower.includes("documento")) {
        // Mapear CPF/CNPJ para campo personalizado se existir, ou sugerir criação
        const existingField = existingFields.find(
          (f) => f.field_key.toLowerCase() === "cpf" || f.field_key.toLowerCase() === "cnpj" || f.field_key.toLowerCase() === "documento"
        );
        if (existingField) {
          targetField = `custom:${existingField.field_key}`;
        }
      } else {
        // Check existing custom fields
        const existingField = existingFields.find(
          (f) => f.field_name.toLowerCase() === headerLower || f.field_key.toLowerCase() === headerLower
        );
        if (existingField) {
          targetField = `custom:${existingField.field_key}`;
        }
      }

      mappings[header] = { csvColumn: header, targetField };
    });

    return mappings;
  }, [existingFields]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".csv") && !file.name.endsWith(".txt")) {
      toast.error("Formato inválido", {
        description: "Por favor, envie um arquivo CSV ou TXT",
      });
      return;
    }

    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const { headers, data, preview } = parseCSV(text);
      
      setCsvHeaders(headers);
      setCsvData(data);
      setCsvPreview(preview);
      setColumnMappings(autoDetectMappings(headers));
      setStep("mapping");
    };
    reader.readAsText(file);
  };

  const handleMappingChange = (column: string, value: string) => {
    if (value === "create_new") {
      setCreatingForColumn(column);
      setShowCreateField(true);
      return;
    }

    setColumnMappings((prev) => ({
      ...prev,
      [column]: { csvColumn: column, targetField: value },
    }));
  };

  const handleCreateField = (config: NewFieldConfig) => {
    const newFieldIndex = newFields.length;
    setNewFields([...newFields, config]);
    
    setColumnMappings((prev) => ({
      ...prev,
      [creatingForColumn]: {
        csvColumn: creatingForColumn,
        targetField: `new:${newFieldIndex}`,
        isNewField: true,
        newFieldConfig: config,
      },
    }));
    
    setShowCreateField(false);
    setCreatingForColumn("");
  };

  const validContacts = useMemo(() => {
    const phoneColumn = Object.entries(columnMappings).find(
      ([, m]) => m.targetField === "phone"
    )?.[0];

    if (!phoneColumn) return [];

    return csvData.filter((row) => {
      const phoneIndex = csvHeaders.indexOf(phoneColumn);
      const phone = row[phoneIndex];
      return phone && validatePhone(phone);
    });
  }, [csvData, csvHeaders, columnMappings]);

  // Get available deduplication fields based on mappings
  const availableDeduplicationFields = useMemo(() => {
    const fields: { value: string; label: string }[] = [
      { value: 'phone', label: 'Telefone' },
    ];

    // Add email if mapped
    const hasEmail = Object.values(columnMappings).some(m => m.targetField === 'email');
    if (hasEmail) {
      fields.push({ value: 'email', label: 'E-mail' });
    }

    // Add contact_display_id if mapped
    const hasExternalId = Object.values(columnMappings).some(m => m.targetField === 'contact_display_id');
    if (hasExternalId) {
      fields.push({ value: 'contact_display_id', label: 'ID Externo' });
    }

    // Add custom fields that are mapped
    Object.values(columnMappings).forEach(mapping => {
      if (mapping.targetField.startsWith('custom:')) {
        const fieldKey = mapping.targetField.replace('custom:', '');
        const existingField = existingFields.find(f => f.field_key === fieldKey);
        if (existingField) {
          fields.push({ 
            value: `custom:${fieldKey}`, 
            label: existingField.field_name 
          });
        }
      } else if (mapping.targetField.startsWith('new:')) {
        const fieldIndex = parseInt(mapping.targetField.replace('new:', ''));
        const newField = newFields[fieldIndex];
        if (newField) {
          fields.push({ 
            value: `custom:${newField.field_key}`, 
            label: newField.field_name 
          });
        }
      }
    });

    return fields;
  }, [columnMappings, existingFields, newFields]);

  const handleImport = async () => {
    const phoneColumn = Object.entries(columnMappings).find(
      ([, m]) => m.targetField === "phone"
    )?.[0];

    if (!phoneColumn) {
      toast.error("Selecione a coluna de telefone");
      return;
    }

    const contacts = validContacts.map((row) => {
      const contact: { phone: string; name?: string; email?: string; notes?: string; contact_display_id?: string; custom_fields: Record<string, unknown> } = {
        phone: "",
        custom_fields: {},
      };

      Object.entries(columnMappings).forEach(([column, mapping]) => {
        const colIndex = csvHeaders.indexOf(column);
        const value = row[colIndex]?.trim();

        if (!value) return;

        switch (mapping.targetField) {
          case "phone":
            contact.phone = value.replace(/\D/g, "");
            break;
          case "name":
            contact.name = value;
            break;
          case "email":
            contact.email = value;
            break;
          case "notes":
            contact.notes = value;
            break;
          case "contact_display_id":
            contact.contact_display_id = value;
            break;
          case "ignore":
            break;
          default:
            if (mapping.targetField.startsWith("custom:")) {
              const fieldKey = mapping.targetField.replace("custom:", "");
              contact.custom_fields[fieldKey] = value;
            } else if (mapping.targetField.startsWith("new:")) {
              const fieldIndex = parseInt(mapping.targetField.replace("new:", ""));
              const fieldConfig = newFields[fieldIndex];
              if (fieldConfig) {
                contact.custom_fields[fieldConfig.field_key] = value;
              }
            }
            break;
        }
      });

      return contact;
    });

    try {
      await onImport(
        contacts,
        selectedTagIds.length > 0 ? selectedTagIds : undefined,
        newFields.length > 0 ? newFields : undefined,
        deduplication.enabled ? deduplication : undefined,
        phoneNormalization.mode !== 'none' ? phoneNormalization : undefined
      );
      
      // Reset state
      setStep("upload");
      setFileName("");
      setCsvHeaders([]);
      setCsvPreview([]);
      setCsvData([]);
      setColumnMappings({});
      setSelectedTagIds([]);
      setNewFields([]);
      setDeduplication({ enabled: true, field: 'phone', action: 'skip' });
      setPhoneNormalization({ mode: 'add_ddi', countryCode: '55' });
    } catch (error) {
      // Error handled by parent
    }
  };

  const renderUploadStep = () => (
    <div className="space-y-4">
      <Button variant="outline" size="sm" onClick={downloadTemplate} className="w-full">
        <Download className="w-4 h-4 mr-2" />
        Baixar Modelo de Planilha
      </Button>

      <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors border-border">
        <div className="flex flex-col items-center justify-center pt-5 pb-6">
          <Upload className="w-10 h-10 mb-3 text-muted-foreground" />
          <p className="mb-1 text-sm text-muted-foreground">
            <span className="font-semibold">Clique para enviar</span> ou arraste
          </p>
          <p className="text-xs text-muted-foreground">CSV ou TXT</p>
        </div>
        <input
          type="file"
          className="hidden"
          accept=".csv,.txt"
          onChange={handleFileChange}
        />
      </label>

      <div className="text-xs text-muted-foreground space-y-1 p-3 bg-muted/50 rounded-lg">
        <p className="font-medium">Como funciona:</p>
        <ol className="list-decimal list-inside space-y-1">
          <li>Envie seu arquivo CSV com os dados</li>
          <li>Mapeie cada coluna para um campo do sistema</li>
          <li>Crie novos campos personalizados se necessário</li>
          <li>Aplique tags (opcional) e importe</li>
        </ol>
      </div>
    </div>
  );

  const renderMappingStep = () => (
    <div className="space-y-4">
      {/* File info */}
      <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
        <FileText className="w-5 h-5 text-primary" />
        <span className="text-sm font-medium">{fileName}</span>
        <span className="text-xs text-muted-foreground ml-auto">
          {csvData.length} linhas
        </span>
      </div>

      {/* Column mappings */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-2">
            <Columns className="h-4 w-4" />
            Mapeamento de Colunas
          </Label>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setCreatingForColumn("");
              setShowCreateField(true);
            }}
            className="text-primary border-primary/50 hover:bg-primary/10"
          >
            <Plus className="h-4 w-4 mr-1" />
            Novo campo
          </Button>
        </div>
        
        <p className="text-xs text-muted-foreground">
          Associe cada coluna do CSV a um campo do sistema. Você pode criar campos personalizados com tipos específicos (texto, número, data, seleção, etc.)
        </p>
        
        <ScrollArea className="h-[280px] pr-4">
          <div className="space-y-3">
            {csvHeaders.map((header) => {
              const mapping = columnMappings[header];
              const preview = csvPreview[0]?.[csvHeaders.indexOf(header)] || "";
              
              return (
                <div key={header} className="p-3 border rounded-lg bg-card">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{header}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        ex: {preview || "(vazio)"}
                      </p>
                    </div>
                    
                    <Select
                      value={mapping?.targetField || "ignore"}
                      onValueChange={(v) => handleMappingChange(header, v)}
                    >
                      <SelectTrigger className="w-[200px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {/* Create new field option - at the top for visibility */}
                        <SelectItem value="create_new" className="text-primary font-medium bg-primary/5 border-b mb-1">
                          <span className="mr-2">
                            <Plus className="h-4 w-4 inline" />
                          </span>
                          Criar novo campo personalizado...
                        </SelectItem>
                        
                        {STANDARD_FIELDS.map((field) => (
                          <SelectItem key={field.value} value={field.value}>
                            <span className="mr-2">{field.icon}</span>
                            {field.label}
                          </SelectItem>
                        ))}
                        
                        {existingFields.length > 0 && (
                          <>
                            <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground border-t mt-1 pt-2">
                              Campos Personalizados Existentes
                            </div>
                            {existingFields.map((field) => (
                              <SelectItem key={field.id} value={`custom:${field.field_key}`}>
                                <span className="mr-2">📋</span>
                                {field.field_name}
                                <span className="ml-1 text-xs text-muted-foreground">
                                  ({FIELD_TYPE_LABELS[field.field_type] || field.field_type})
                                </span>
                              </SelectItem>
                            ))}
                          </>
                        )}
                        
                        {newFields.length > 0 && (
                          <>
                            <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground border-t mt-1 pt-2">
                              Novos Campos (serão criados)
                            </div>
                            {newFields.map((field, idx) => (
                              <SelectItem key={`new:${idx}`} value={`new:${idx}`}>
                                <span className="mr-2">✨</span>
                                {field.field_name}
                                <span className="ml-1 text-xs text-muted-foreground">
                                  ({FIELD_TYPE_LABELS[field.field_type] || field.field_type})
                                </span>
                              </SelectItem>
                            ))}
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {mapping?.isNewField && mapping.newFieldConfig && (
                    <Badge variant="secondary" className="mt-2 text-xs">
                      ✨ Novo: {FIELD_TYPE_LABELS[mapping.newFieldConfig.field_type] || mapping.newFieldConfig.field_type}
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </div>

      {/* Validation */}
      <div className="flex items-center gap-4 text-sm p-3 bg-muted/50 rounded-lg">
        {validContacts.length > 0 ? (
          <div className="flex items-center gap-1 text-green-600">
            <CheckCircle2 className="w-4 h-4" />
            {validContacts.length} contatos válidos
          </div>
        ) : (
          <div className="flex items-center gap-1 text-destructive">
            <AlertCircle className="w-4 h-4" />
            Selecione a coluna de telefone
          </div>
        )}
        {csvData.length - validContacts.length > 0 && (
          <div className="flex items-center gap-1 text-amber-500">
            <AlertCircle className="w-4 h-4" />
            {csvData.length - validContacts.length} inválidos (serão ignorados)
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-2">
        <Button variant="outline" onClick={() => setStep("upload")}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>
        <Button onClick={() => setStep("deduplication")} disabled={validContacts.length === 0}>
          Próximo
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );

  // Preview phone normalization examples
  const phoneNormalizationExamples = useMemo(() => {
    const phoneColumn = Object.entries(columnMappings).find(
      ([, m]) => m.targetField === "phone"
    )?.[0];
    
    if (!phoneColumn) return [];
    
    const phoneIndex = csvHeaders.indexOf(phoneColumn);
    return csvPreview.slice(0, 3).map((row) => {
      const original = row[phoneIndex]?.replace(/\D/g, '') || '';
      let normalized = original;
      
      if (phoneNormalization.mode === 'add_ddi') {
        normalized = normalizePhoneWithCountryCode(original, phoneNormalization.countryCode);
      } else if (phoneNormalization.mode === 'remove_ddi') {
        normalized = normalizePhoneWithoutCountryCode(original, phoneNormalization.countryCode);
      }
      
      return { original, normalized, changed: original !== normalized };
    }).filter(e => e.original);
  }, [csvPreview, columnMappings, csvHeaders, phoneNormalization]);

  const renderDeduplicationStep = () => (
    <div className="space-y-4">
      {/* Phone normalization config */}
      <div className="p-4 bg-muted/50 rounded-lg space-y-4">
        <div className="space-y-0.5">
          <Label className="text-base font-medium flex items-center gap-2">
            <Phone className="h-4 w-4" />
            Padronização de Telefones
          </Label>
          <p className="text-sm text-muted-foreground">
            Adicione ou remova o DDI para manter os números consistentes
          </p>
        </div>

        <RadioGroup
          value={phoneNormalization.mode}
          onValueChange={(mode: 'none' | 'add_ddi' | 'remove_ddi') => 
            setPhoneNormalization(prev => ({ ...prev, mode }))
          }
          className="space-y-2"
        >
          <div className="flex items-start space-x-3 p-3 rounded-lg border bg-card hover:bg-accent/50 cursor-pointer">
            <RadioGroupItem value="none" id="phone_none" className="mt-0.5" />
            <div className="space-y-1">
              <Label htmlFor="phone_none" className="font-medium cursor-pointer">
                Não alterar números
              </Label>
              <p className="text-xs text-muted-foreground">
                Mantém os telefones exatamente como estão no arquivo
              </p>
            </div>
          </div>
          <div className="flex items-start space-x-3 p-3 rounded-lg border bg-card hover:bg-accent/50 cursor-pointer">
            <RadioGroupItem value="add_ddi" id="phone_add" className="mt-0.5" />
            <div className="space-y-1 flex-1">
              <Label htmlFor="phone_add" className="font-medium cursor-pointer">
                Adicionar DDI se não tiver
              </Label>
              <p className="text-xs text-muted-foreground">
                Ex: 11999999999 → 5511999999999
              </p>
            </div>
          </div>
          <div className="flex items-start space-x-3 p-3 rounded-lg border bg-card hover:bg-accent/50 cursor-pointer">
            <RadioGroupItem value="remove_ddi" id="phone_remove" className="mt-0.5" />
            <div className="space-y-1">
              <Label htmlFor="phone_remove" className="font-medium cursor-pointer">
                Remover DDI se tiver
              </Label>
              <p className="text-xs text-muted-foreground">
                Ex: 5511999999999 → 11999999999
              </p>
            </div>
          </div>
        </RadioGroup>

        {phoneNormalization.mode !== 'none' && (
          <div className="space-y-2 pt-2 border-t">
            <Label className="text-sm font-medium">Código do país (DDI):</Label>
            <Select
              value={phoneNormalization.countryCode}
              onValueChange={(countryCode) => 
                setPhoneNormalization(prev => ({ ...prev, countryCode }))
              }
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="55">🇧🇷 +55 (Brasil)</SelectItem>
                <SelectItem value="1">🇺🇸 +1 (EUA/Canadá)</SelectItem>
                <SelectItem value="351">🇵🇹 +351 (Portugal)</SelectItem>
                <SelectItem value="54">🇦🇷 +54 (Argentina)</SelectItem>
                <SelectItem value="56">🇨🇱 +56 (Chile)</SelectItem>
                <SelectItem value="57">🇨🇴 +57 (Colômbia)</SelectItem>
                <SelectItem value="52">🇲🇽 +52 (México)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {phoneNormalization.mode !== 'none' && phoneNormalizationExamples.length > 0 && (
          <div className="space-y-2 pt-2 border-t">
            <Label className="text-sm font-medium">Preview dos seus números:</Label>
            <div className="space-y-1 text-sm font-mono bg-card p-2 rounded border">
              {phoneNormalizationExamples.map((example, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="text-muted-foreground">{example.original}</span>
                  <span className="text-muted-foreground">→</span>
                  <span className={example.changed ? "text-primary font-medium" : "text-muted-foreground"}>
                    {example.normalized}
                  </span>
                  {!example.changed && <span className="text-xs text-muted-foreground">(mantido)</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Deduplication config */}
      <div className="p-4 bg-muted/50 rounded-lg space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-base font-medium flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Evitar contatos duplicados
            </Label>
            <p className="text-sm text-muted-foreground">
              Identifica contatos que já existem na base
            </p>
          </div>
          <Switch
            checked={deduplication.enabled}
            onCheckedChange={(enabled) => 
              setDeduplication(prev => ({ ...prev, enabled }))
            }
          />
        </div>

        {deduplication.enabled && (
          <>
            <div className="space-y-2 pt-2 border-t">
              <Label className="text-sm font-medium">Campo de identificação:</Label>
              <Select
                value={deduplication.field}
                onValueChange={(field) => 
                  setDeduplication(prev => ({ ...prev, field }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableDeduplicationFields.map((field) => (
                    <SelectItem key={field.value} value={field.value}>
                      {field.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Contatos serão identificados como duplicados se tiverem o mesmo valor neste campo
              </p>
            </div>

            <div className="space-y-2 pt-2 border-t">
              <Label className="text-sm font-medium">Quando encontrar duplicata:</Label>
              <RadioGroup
                value={deduplication.action}
                onValueChange={(action: 'skip' | 'update') => 
                  setDeduplication(prev => ({ ...prev, action }))
                }
                className="space-y-2"
              >
                <div className="flex items-start space-x-3 p-3 rounded-lg border bg-card hover:bg-accent/50 cursor-pointer">
                  <RadioGroupItem value="skip" id="skip" className="mt-0.5" />
                  <div className="space-y-1">
                    <Label htmlFor="skip" className="font-medium cursor-pointer">
                      Ignorar (manter dados existentes)
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Contatos duplicados não serão importados
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-3 p-3 rounded-lg border bg-card hover:bg-accent/50 cursor-pointer">
                  <RadioGroupItem value="update" id="update" className="mt-0.5" />
                  <div className="space-y-1">
                    <Label htmlFor="update" className="font-medium cursor-pointer flex items-center gap-2">
                      <RefreshCw className="h-3 w-3" />
                      Atualizar (sobrescrever com novos dados)
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Dados existentes serão substituídos pelos novos
                    </p>
                  </div>
                </div>
              </RadioGroup>
            </div>
          </>
        )}
      </div>

      {/* Summary preview */}
      <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
        <h4 className="font-medium text-sm mb-2">Resumo da importação</h4>
        <div className="grid grid-cols-2 gap-1 text-sm">
          <div>Total no arquivo:</div>
          <div className="font-medium">{csvData.length} contatos</div>
          <div>Válidos para importar:</div>
          <div className="font-medium text-green-600">{validContacts.length} contatos</div>
          <div>Inválidos (serão ignorados):</div>
          <div className="font-medium text-amber-500">{csvData.length - validContacts.length}</div>
        </div>
        {phoneNormalization.mode !== 'none' && (
          <p className="text-xs text-muted-foreground mt-2 pt-2 border-t">
            📱 DDI +{phoneNormalization.countryCode} será {phoneNormalization.mode === 'add_ddi' ? 'adicionado' : 'removido'} dos números
          </p>
        )}
        {deduplication.enabled && (
          <p className="text-xs text-muted-foreground mt-2 pt-2 border-t">
            💡 Duplicatas serão verificadas pelo campo "{availableDeduplicationFields.find(f => f.value === deduplication.field)?.label || deduplication.field}" 
            e {deduplication.action === 'skip' ? 'ignoradas' : 'atualizadas'}
          </p>
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-2">
        <Button variant="outline" onClick={() => setStep("mapping")}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>
        <Button onClick={() => setStep("tags")}>
          Próximo
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );

  const renderTagsStep = () => (
    <div className="space-y-4">
      {/* Summary */}
      <div className="p-4 bg-muted/50 rounded-lg space-y-2">
        <h4 className="font-medium">Resumo da Importação</h4>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>Contatos válidos:</div>
          <div className="font-medium text-green-600">{validContacts.length}</div>
          
          <div>Novos campos a criar:</div>
          <div className="font-medium">{newFields.length}</div>
          
          <div>Campos mapeados:</div>
          <div className="font-medium">
            {Object.values(columnMappings).filter((m) => m.targetField !== "ignore").length}
          </div>
        </div>
      </div>

      {/* Tag selection */}
      {tags.length > 0 && (
        <div className="space-y-2 p-3 bg-muted/50 rounded-lg border">
          <Label className="text-sm font-medium flex items-center gap-2">
            <Tag className="h-4 w-4" />
            Aplicar tags aos contatos importados (opcional)
          </Label>
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <Badge
                key={tag.id}
                variant={selectedTagIds.includes(tag.id) ? "default" : "outline"}
                onClick={() => toggleTag(tag.id)}
                className="cursor-pointer transition-all hover:scale-105"
                style={{
                  backgroundColor: selectedTagIds.includes(tag.id) ? tag.color : "transparent",
                  borderColor: tag.color,
                  color: selectedTagIds.includes(tag.id) ? "#fff" : undefined,
                }}
              >
                {tag.name}
              </Badge>
            ))}
          </div>
          {selectedTagIds.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {selectedTagIds.length} tag(s) serão aplicadas
            </p>
          )}
        </div>
      )}

      {/* New fields preview */}
      {newFields.length > 0 && (
        <div className="space-y-2 p-3 bg-primary/5 rounded-lg border border-primary/20">
          <Label className="text-sm font-medium">Campos que serão criados:</Label>
          <div className="flex flex-wrap gap-2">
            {newFields.map((field, idx) => (
              <Badge key={idx} variant="secondary">
                ✨ {field.field_name} ({field.field_type})
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={() => setStep("deduplication")}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>
        <Button onClick={handleImport} disabled={isLoading || validContacts.length === 0}>
          {isLoading ? "Importando..." : `Importar ${validContacts.length} contatos`}
        </Button>
      </div>
    </div>
  );

  const getStepTitle = () => {
    switch (step) {
      case "upload":
        return "Importar Contatos";
      case "mapping":
        return "Mapear Colunas";
      case "deduplication":
        return "Configurar Deduplicação";
      case "tags":
        return "Finalizar Importação";
    }
  };

  const getStepDescription = () => {
    switch (step) {
      case "upload":
        return "Envie um arquivo CSV com os dados dos contatos";
      case "mapping":
        return "Defina como cada coluna será importada";
      case "deduplication":
        return "Configure como identificar e tratar contatos duplicados";
      case "tags":
        return "Revise e confirme a importação";
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{getStepTitle()}</DialogTitle>
            <DialogDescription>{getStepDescription()}</DialogDescription>
          </DialogHeader>

          {/* Progress indicator */}
          <div className="flex items-center gap-2 mb-4">
            {(["upload", "mapping", "deduplication", "tags"] as ImportStep[]).map((s, idx) => {
              const steps: ImportStep[] = ["upload", "mapping", "deduplication", "tags"];
              const currentIdx = steps.indexOf(step);
              return (
                <div key={s} className="flex items-center gap-2">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                      step === s
                        ? "bg-primary text-primary-foreground"
                        : currentIdx > idx
                        ? "bg-primary/20 text-primary"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {idx + 1}
                  </div>
                  {idx < 3 && (
                    <div
                      className={`w-8 h-0.5 ${
                        currentIdx > idx ? "bg-primary" : "bg-muted"
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {step === "upload" && renderUploadStep()}
          {step === "mapping" && renderMappingStep()}
          {step === "deduplication" && renderDeduplicationStep()}
          {step === "tags" && renderTagsStep()}
        </DialogContent>
      </Dialog>

      <CreateFieldInlineDialog
        open={showCreateField}
        onOpenChange={setShowCreateField}
        onCreateField={handleCreateField}
        suggestedName={creatingForColumn}
      />
    </>
  );
};
