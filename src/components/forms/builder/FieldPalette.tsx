import { useFormFields } from "@/hooks/useForms";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Type, 
  Mail, 
  Phone, 
  Hash, 
  Calendar, 
  Clock, 
  List, 
  CheckSquare, 
  Circle, 
  AlignLeft,
  Link,
  FileUp,
  Star,
  Minus,
  Heading,
  Text,
  MapPin,
  User,
  EyeOff
} from "lucide-react";

interface FieldPaletteProps {
  formId: string;
  onFieldAdded: (fieldId: string) => void;
  fieldsCount: number;
}

interface FieldTypeConfig {
  type: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  category: string;
}

const fieldTypes: FieldTypeConfig[] = [
  // Basic
  { type: 'short_text', label: 'Texto Curto', icon: Type, category: 'Básicos' },
  { type: 'long_text', label: 'Texto Longo', icon: AlignLeft, category: 'Básicos' },
  { type: 'email', label: 'E-mail', icon: Mail, category: 'Básicos' },
  { type: 'phone', label: 'Telefone', icon: Phone, category: 'Básicos' },
  { type: 'number', label: 'Número', icon: Hash, category: 'Básicos' },
  { type: 'url', label: 'URL/Link', icon: Link, category: 'Básicos' },
  
  // Date/Time
  { type: 'date', label: 'Data', icon: Calendar, category: 'Data e Hora' },
  { type: 'time', label: 'Horário', icon: Clock, category: 'Data e Hora' },
  { type: 'datetime', label: 'Data e Hora', icon: Calendar, category: 'Data e Hora' },
  
  // Selection
  { type: 'select', label: 'Lista Suspensa', icon: List, category: 'Seleção' },
  { type: 'multi_select', label: 'Seleção Múltipla', icon: CheckSquare, category: 'Seleção' },
  { type: 'radio', label: 'Botão de Opção', icon: Circle, category: 'Seleção' },
  { type: 'checkbox', label: 'Caixa de Seleção', icon: CheckSquare, category: 'Seleção' },
  { type: 'rating', label: 'Avaliação', icon: Star, category: 'Seleção' },
  
  // Special
  { type: 'name', label: 'Nome Completo', icon: User, category: 'Especiais' },
  { type: 'address', label: 'Endereço', icon: MapPin, category: 'Especiais' },
  { type: 'file', label: 'Upload de Arquivo', icon: FileUp, category: 'Especiais' },
  { type: 'hidden', label: 'Campo Oculto', icon: EyeOff, category: 'Especiais' },
  
  // Layout
  { type: 'heading', label: 'Título/Seção', icon: Heading, category: 'Layout' },
  { type: 'paragraph', label: 'Texto Informativo', icon: Text, category: 'Layout' },
  { type: 'divider', label: 'Separador', icon: Minus, category: 'Layout' },
];

const groupedFieldTypes = fieldTypes.reduce((acc, field) => {
  if (!acc[field.category]) {
    acc[field.category] = [];
  }
  acc[field.category].push(field);
  return acc;
}, {} as Record<string, FieldTypeConfig[]>);

export const FieldPalette = ({ formId, onFieldAdded, fieldsCount }: FieldPaletteProps) => {
  const { createField } = useFormFields(formId);

  const handleAddField = (fieldType: FieldTypeConfig) => {
    const defaultOptions = ['select', 'multi_select', 'radio', 'checkbox'].includes(fieldType.type)
      ? [{ value: 'option1', label: 'Opção 1' }, { value: 'option2', label: 'Opção 2' }]
      : null;

    createField.mutate(
      {
        form_id: formId,
        field_type: fieldType.type,
        label: fieldType.label,
        placeholder: null,
        help_text: null,
        required: false,
        options: defaultOptions,
        validation: null,
        mapping_type: null,
        mapping_target: null,
        create_custom_field_on_submit: false,
        conditional_logic: null,
        position: fieldsCount,
        settings: {},
      },
      {
        onSuccess: (data) => {
          onFieldAdded(data.id);
        },
      }
    );
  };

  return (
    <div className="h-full flex flex-col bg-muted/30">
      <div className="p-4 border-b">
        <h3 className="font-medium text-sm">Componentes</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Clique para adicionar ao formulário
        </p>
      </div>
      
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-4">
          {Object.entries(groupedFieldTypes).map(([category, fields]) => (
            <div key={category}>
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-1">
                {category}
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {fields.map((field) => (
                  <Button
                    key={field.type}
                    variant="outline"
                    size="sm"
                    className="h-auto py-2 px-3 justify-start gap-2 text-xs font-normal hover:bg-primary/5 hover:border-primary/30"
                    onClick={() => handleAddField(field)}
                    disabled={createField.isPending}
                  >
                    <field.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{field.label}</span>
                  </Button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};
