import { Plus, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FunnelAutomation } from "@/hooks/useFunnels";
import { AutomationCard } from "./AutomationCard";

interface GlobalAutomationsColumnProps {
  automations: FunnelAutomation[];
  onAddAutomation: () => void;
  onEditAutomation: (automation: FunnelAutomation) => void;
  onDeleteAutomation: (automation: FunnelAutomation) => void;
  onToggleActive: (automation: FunnelAutomation) => void;
  onCopyAutomation: (automation: FunnelAutomation) => void;
}

export const GlobalAutomationsColumn = ({
  automations,
  onAddAutomation,
  onEditAutomation,
  onDeleteAutomation,
  onToggleActive,
  onCopyAutomation,
}: GlobalAutomationsColumnProps) => {
  const globalAutomations = automations.filter(a => !a.stage_id);

  return (
    <div className="flex flex-col h-full min-w-[280px] max-w-[280px] rounded-xl border bg-gradient-to-b from-muted/50 to-muted/20">
      {/* Header */}
      <div className="p-3 border-b bg-card/50 rounded-t-xl">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center">
            <Globe className="h-3.5 w-3.5 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="font-medium text-sm">Globais</h3>
            <p className="text-[10px] text-muted-foreground">Todas as etapas</p>
          </div>
          <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
            {globalAutomations.length}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="p-2 border-b">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start h-8 text-xs"
          onClick={onAddAutomation}
        >
          <Plus className="h-3 w-3 mr-2" />
          Adicionar automação global
        </Button>
      </div>

      {/* Automations list */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-2">
          {globalAutomations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-xs">
              <p>Automações globais</p>
              <p>se aplicam a todas</p>
              <p>as etapas do funil</p>
            </div>
          ) : (
            globalAutomations.map((automation) => (
              <AutomationCard
                key={automation.id}
                automation={automation}
                onEdit={onEditAutomation}
                onDelete={onDeleteAutomation}
                onToggleActive={onToggleActive}
                onCopy={onCopyAutomation}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
};
