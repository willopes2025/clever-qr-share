import { useState, useEffect } from "react";
import { Check, ChevronUp, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useLeadPanelTabs } from "@/hooks/useLeadPanelTabs";
import { useCustomFields } from "@/hooks/useCustomFields";

interface ConfigureTabFieldsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tabId: string | null;
}

export const ConfigureTabFieldsDialog = ({ open, onOpenChange, tabId }: ConfigureTabFieldsDialogProps) => {
  const { tabs, updateTabFields } = useLeadPanelTabs();
  const { fieldDefinitions } = useCustomFields();
  const [selectedFields, setSelectedFields] = useState<string[]>([]);

  const tab = tabs?.find(t => t.id === tabId);

  useEffect(() => {
    if (tab) {
      setSelectedFields(tab.field_keys || []);
    }
  }, [tab]);

  const handleToggleField = (fieldKey: string) => {
    setSelectedFields(prev => 
      prev.includes(fieldKey) 
        ? prev.filter(k => k !== fieldKey)
        : [...prev, fieldKey]
    );
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newOrder = [...selectedFields];
    [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
    setSelectedFields(newOrder);
  };

  const handleMoveDown = (index: number) => {
    if (index === selectedFields.length - 1) return;
    const newOrder = [...selectedFields];
    [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
    setSelectedFields(newOrder);
  };

  const handleSave = async () => {
    if (!tabId) return;
    await updateTabFields.mutateAsync({ tabId, fieldKeys: selectedFields });
    onOpenChange(false);
  };

  const getFieldName = (fieldKey: string) => {
    return fieldDefinitions?.find(f => f.field_key === fieldKey)?.field_name || fieldKey;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Campos da Aba: {tab?.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Selecione quais campos serão exibidos nesta aba. Se nenhum for selecionado, todos os campos serão mostrados.
          </p>

          <ScrollArea className="h-[300px] border rounded-lg p-2">
            <div className="space-y-1">
              {fieldDefinitions?.map((field) => {
                const isSelected = selectedFields.includes(field.field_key);
                const selectedIndex = selectedFields.indexOf(field.field_key);

                return (
                  <div 
                    key={field.id}
                    className="flex items-center gap-2 p-2 rounded hover:bg-muted/50"
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => handleToggleField(field.field_key)}
                    />
                    <span className="flex-1 text-sm">{field.field_name}</span>
                    
                    {isSelected && (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => handleMoveUp(selectedIndex)}
                          disabled={selectedIndex === 0}
                        >
                          <ChevronUp className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => handleMoveDown(selectedIndex)}
                          disabled={selectedIndex === selectedFields.length - 1}
                        >
                          <ChevronDown className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}

              {(!fieldDefinitions || fieldDefinitions.length === 0) && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum campo personalizado criado ainda
                </p>
              )}
            </div>
          </ScrollArea>

          {/* Selected Fields Order Preview */}
          {selectedFields.length > 0 && (
            <div>
              <p className="text-xs font-medium mb-1">Ordem dos campos:</p>
              <div className="flex flex-wrap gap-1">
                {selectedFields.map((fieldKey, index) => (
                  <span key={fieldKey} className="text-xs bg-muted px-2 py-0.5 rounded">
                    {index + 1}. {getFieldName(fieldKey)}
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
          <Button onClick={handleSave} disabled={updateTabFields.isPending}>
            <Check className="h-4 w-4 mr-2" />
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
