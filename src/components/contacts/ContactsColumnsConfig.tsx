import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronUp, ChevronDown, GripVertical } from "lucide-react";
import { CustomFieldDefinition } from "@/hooks/useCustomFields";

export interface ColumnDefinition {
  id: string;
  label: string;
  category: 'contact' | 'custom_contact' | 'deal' | 'custom_deal';
}

const CONTACT_COLUMNS: ColumnDefinition[] = [
  { id: 'contact_display_id', label: 'ID', category: 'contact' },
  { id: 'phone', label: 'Telefone', category: 'contact' },
  { id: 'name', label: 'Nome', category: 'contact' },
  { id: 'email', label: 'Email', category: 'contact' },
  { id: 'tags', label: 'Tags', category: 'contact' },
  { id: 'status', label: 'Status', category: 'contact' },
  { id: 'created_at', label: 'Criado em', category: 'contact' },
];

const DEAL_COLUMNS: ColumnDefinition[] = [
  { id: 'deal_funnel', label: 'Funil', category: 'deal' },
  { id: 'deal_stage', label: 'Etapa', category: 'deal' },
  { id: 'deal_value', label: 'Valor do Deal', category: 'deal' },
  { id: 'deal_expected_close', label: 'Previsão Fechamento', category: 'deal' },
  { id: 'deal_time_in_stage', label: 'Tempo na Etapa', category: 'deal' },
];

interface ContactsColumnsConfigProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  visibleColumns: string[];
  columnOrder: string[];
  fieldDefinitions: CustomFieldDefinition[];
  onSave: (visibleColumns: string[], columnOrder: string[]) => void;
}

export function ContactsColumnsConfig({
  open,
  onOpenChange,
  visibleColumns,
  columnOrder,
  fieldDefinitions,
  onSave,
}: ContactsColumnsConfigProps) {
  const [localVisible, setLocalVisible] = useState<string[]>(visibleColumns);
  const [localOrder, setLocalOrder] = useState<string[]>(columnOrder);

  // Build custom columns from field definitions
  const customContactColumns: ColumnDefinition[] = fieldDefinitions.map(field => ({
    id: `custom_contact_${field.field_key}`,
    label: field.field_name,
    category: 'custom_contact' as const,
  }));

  const customDealColumns: ColumnDefinition[] = fieldDefinitions.map(field => ({
    id: `custom_deal_${field.field_key}`,
    label: field.field_name,
    category: 'custom_deal' as const,
  }));

  const allColumns = [...CONTACT_COLUMNS, ...customContactColumns, ...DEAL_COLUMNS, ...customDealColumns];

  useEffect(() => {
    if (open) {
      setLocalVisible(visibleColumns);
      // Ensure all columns are in order, adding any new ones at the end
      const allColumnIds = allColumns.map(c => c.id);
      const existingOrder = columnOrder.filter(id => allColumnIds.includes(id));
      const newColumns = allColumnIds.filter(id => !existingOrder.includes(id));
      setLocalOrder([...existingOrder, ...newColumns]);
    }
  }, [open, visibleColumns, columnOrder, fieldDefinitions]);

  const toggleColumn = (columnId: string) => {
    setLocalVisible(prev => 
      prev.includes(columnId) 
        ? prev.filter(id => id !== columnId)
        : [...prev, columnId]
    );
  };

  const moveColumn = (columnId: string, direction: 'up' | 'down') => {
    const currentIndex = localOrder.indexOf(columnId);
    if (currentIndex === -1) return;
    
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= localOrder.length) return;
    
    const newOrder = [...localOrder];
    [newOrder[currentIndex], newOrder[newIndex]] = [newOrder[newIndex], newOrder[currentIndex]];
    setLocalOrder(newOrder);
  };

  const handleSave = () => {
    // Filter order to only include visible columns
    const orderedVisible = localOrder.filter(id => localVisible.includes(id));
    onSave(localVisible, orderedVisible);
    onOpenChange(false);
  };

  const renderCategory = (title: string, columns: ColumnDefinition[], icon: string) => {
    const orderedColumns = [...columns].sort((a, b) => {
      const aIndex = localOrder.indexOf(a.id);
      const bIndex = localOrder.indexOf(b.id);
      return aIndex - bIndex;
    });

    return (
      <div className="mb-6">
        <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
          <span>{icon}</span> {title}
        </h4>
        <div className="space-y-1">
          {orderedColumns.map((column) => (
            <div
              key={column.id}
              className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <GripVertical className="h-4 w-4 text-muted-foreground/50" />
                <Checkbox
                  checked={localVisible.includes(column.id)}
                  onCheckedChange={() => toggleColumn(column.id)}
                  id={column.id}
                />
                <label
                  htmlFor={column.id}
                  className="text-sm cursor-pointer select-none"
                >
                  {column.label}
                </label>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => moveColumn(column.id, 'up')}
                  disabled={localOrder.indexOf(column.id) === 0}
                >
                  <ChevronUp className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => moveColumn(column.id, 'down')}
                  disabled={localOrder.indexOf(column.id) === localOrder.length - 1}
                >
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Configurar Colunas</DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          {renderCategory('Dados do Contato', CONTACT_COLUMNS, '📋')}
          {customContactColumns.length > 0 && renderCategory('Campos Personalizados do Contato', customContactColumns, '📝')}
          {renderCategory('Dados do Funil', DEAL_COLUMNS, '🎯')}
          {customDealColumns.length > 0 && renderCategory('Campos Personalizados do Deal', customDealColumns, '📝')}
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
