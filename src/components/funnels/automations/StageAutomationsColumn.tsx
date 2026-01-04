import { Plus, ClipboardPaste } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FunnelAutomation, FunnelStage } from "@/hooks/useFunnels";
import { AutomationCard } from "./AutomationCard";
import { cn } from "@/lib/utils";

interface StageAutomationsColumnProps {
  stage: FunnelStage;
  automations: FunnelAutomation[];
  clipboardAutomation: FunnelAutomation | null;
  onAddAutomation: (stageId: string) => void;
  onEditAutomation: (automation: FunnelAutomation) => void;
  onDeleteAutomation: (automation: FunnelAutomation) => void;
  onToggleActive: (automation: FunnelAutomation) => void;
  onCopyAutomation: (automation: FunnelAutomation) => void;
  onPasteAutomation: (stageId: string) => void;
  onDragStart: (automation: FunnelAutomation) => void;
  onDragEnd: () => void;
  onDrop: (stageId: string) => void;
  isDragOver: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
}

export const StageAutomationsColumn = ({
  stage,
  automations,
  clipboardAutomation,
  onAddAutomation,
  onEditAutomation,
  onDeleteAutomation,
  onToggleActive,
  onCopyAutomation,
  onPasteAutomation,
  onDragStart,
  onDragEnd,
  onDrop,
  isDragOver,
  onDragOver,
  onDragLeave,
}: StageAutomationsColumnProps) => {
  const stageAutomations = automations.filter(a => a.stage_id === stage.id);

  return (
    <div
      className={cn(
        "flex flex-col h-full min-w-[280px] max-w-[280px] rounded-xl border bg-muted/30 transition-all",
        isDragOver && "ring-2 ring-primary ring-offset-2 bg-primary/5"
      )}
      onDragOver={(e) => {
        e.preventDefault();
        onDragOver(e);
      }}
      onDragLeave={onDragLeave}
      onDrop={(e) => {
        e.preventDefault();
        onDrop(stage.id);
      }}
    >
      {/* Header */}
      <div className="p-3 border-b bg-card/50 rounded-t-xl">
        <div className="flex items-center gap-2">
          <div
            className="h-3 w-3 rounded-full shrink-0"
            style={{ backgroundColor: stage.color }}
          />
          <h3 className="font-medium text-sm truncate flex-1">{stage.name}</h3>
          <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
            {stageAutomations.length}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="p-2 space-y-1 border-b">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start h-8 text-xs"
          onClick={() => onAddAutomation(stage.id)}
        >
          <Plus className="h-3 w-3 mr-2" />
          Adicionar automação
        </Button>
        
        {clipboardAutomation && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start h-8 text-xs text-primary"
            onClick={() => onPasteAutomation(stage.id)}
          >
            <ClipboardPaste className="h-3 w-3 mr-2" />
            Colar automação
          </Button>
        )}
      </div>

      {/* Automations list */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-2">
          {stageAutomations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-xs">
              <p>Nenhuma automação</p>
              <p>nesta etapa</p>
            </div>
          ) : (
            stageAutomations.map((automation) => (
              <div
                key={automation.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('automation', JSON.stringify(automation));
                  onDragStart(automation);
                }}
                onDragEnd={onDragEnd}
              >
                <AutomationCard
                  automation={automation}
                  onEdit={onEditAutomation}
                  onDelete={onDeleteAutomation}
                  onToggleActive={onToggleActive}
                  onCopy={onCopyAutomation}
                />
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
};
