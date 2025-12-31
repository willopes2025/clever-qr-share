import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronUp, ChevronDown, GripVertical } from "lucide-react";

export interface ColumnDefinition {
  id: string;
  label: string;
  type: string;
  fixed?: boolean;
}

interface ColumnsConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  columns: ColumnDefinition[];
  visibleColumns: string[];
  columnOrder: string[];
  onSave: (visibleColumns: string[], columnOrder: string[]) => void;
}

export const ColumnsConfigDialog = ({
  open,
  onOpenChange,
  columns,
  visibleColumns,
  columnOrder,
  onSave,
}: ColumnsConfigDialogProps) => {
  const [localVisible, setLocalVisible] = useState<string[]>(visibleColumns);
  const [localOrder, setLocalOrder] = useState<string[]>(columnOrder);

  useEffect(() => {
    if (open) {
      setLocalVisible([...visibleColumns]);
      setLocalOrder([...columnOrder]);
    }
  }, [open, visibleColumns, columnOrder]);

  const toggleColumn = (colId: string) => {
    if (localVisible.includes(colId)) {
      setLocalVisible(localVisible.filter((id) => id !== colId));
    } else {
      setLocalVisible([...localVisible, colId]);
    }
  };

  const moveColumn = (colId: string, direction: "up" | "down") => {
    const currentIndex = localOrder.indexOf(colId);
    if (currentIndex === -1) return;

    const newIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= localOrder.length) return;

    const newOrder = [...localOrder];
    [newOrder[currentIndex], newOrder[newIndex]] = [
      newOrder[newIndex],
      newOrder[currentIndex],
    ];
    setLocalOrder(newOrder);
  };

  const handleSave = () => {
    onSave(localVisible, localOrder);
    onOpenChange(false);
  };

  // Get columns in current order
  const orderedColumns = localOrder
    .map((id) => columns.find((c) => c.id === id))
    .filter(Boolean) as ColumnDefinition[];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Configurar Colunas</DialogTitle>
        </DialogHeader>

        <div className="space-y-1 py-4 max-h-[400px] overflow-y-auto">
          {orderedColumns.map((col, index) => (
            <div
              key={col.id}
              className="flex items-center gap-2 p-2 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
            >
              <GripVertical className="h-4 w-4 text-muted-foreground" />
              <Checkbox
                checked={localVisible.includes(col.id)}
                onCheckedChange={() => toggleColumn(col.id)}
                disabled={col.fixed}
              />
              <span className="flex-1 text-sm">{col.label}</span>
              <div className="flex gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  disabled={index === 0}
                  onClick={() => moveColumn(col.id, "up")}
                >
                  <ChevronUp className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  disabled={index === orderedColumns.length - 1}
                  onClick={() => moveColumn(col.id, "down")}
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave}>Salvar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
