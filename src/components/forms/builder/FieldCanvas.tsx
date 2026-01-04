import { FormField } from "@/hooks/useForms";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { GripVertical, Trash2, FileEdit } from "lucide-react";
import { FieldPreview } from "./FieldPreview";

interface FieldCanvasProps {
  fields: FormField[];
  selectedFieldId: string | null;
  onSelectField: (id: string | null) => void;
  onDeleteField: (id: string) => void;
  onUpdateOrder: (orderedIds: string[]) => void;
}

export const FieldCanvas = ({
  fields,
  selectedFieldId,
  onSelectField,
  onDeleteField,
  onUpdateOrder,
}: FieldCanvasProps) => {
  const handleDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData('text/plain', index.toString());
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    const sourceIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
    
    if (sourceIndex === targetIndex) return;

    const newFields = [...fields];
    const [movedField] = newFields.splice(sourceIndex, 1);
    newFields.splice(targetIndex, 0, movedField);
    
    onUpdateOrder(newFields.map(f => f.id));
  };

  if (fields.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-muted/10 p-8">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <FileEdit className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="font-medium text-lg mb-2">Seu formulário está vazio</h3>
        <p className="text-muted-foreground text-center max-w-sm text-sm">
          Clique nos componentes à esquerda para adicionar campos ao seu formulário.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="p-4 border-b">
        <h3 className="font-medium text-sm">Preview do Formulário</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Arraste para reordenar • Clique para editar
        </p>
      </div>
      
      <ScrollArea className="flex-1">
        <div className="p-6 max-w-2xl mx-auto space-y-3">
          {fields.map((field, index) => (
            <div
              key={field.id}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, index)}
              onClick={() => onSelectField(field.id)}
              className={cn(
                "group relative border rounded-lg p-4 cursor-pointer transition-all",
                "hover:border-primary/50 hover:shadow-sm",
                selectedFieldId === field.id
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border bg-card"
              )}
            >
              {/* Drag Handle */}
              <div className="absolute left-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing">
                <GripVertical className="h-4 w-4 text-muted-foreground" />
              </div>

              {/* Delete Button */}
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 top-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteField(field.id);
                }}
              >
                <Trash2 className="h-3 w-3" />
              </Button>

              {/* Field Content */}
              <div className="pl-4">
                <FieldPreview field={field} />
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};
