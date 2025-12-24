import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Funnel, FunnelStage, useFunnels } from "@/hooks/useFunnels";
import { FunnelDealCard } from "./FunnelDealCard";
import { DealFormDialog } from "./DealFormDialog";
import { StageFormDialog } from "./StageFormDialog";

interface FunnelKanbanViewProps {
  funnel: Funnel;
}

export const FunnelKanbanView = ({ funnel }: FunnelKanbanViewProps) => {
  const { updateDeal } = useFunnels();
  const [showDealForm, setShowDealForm] = useState(false);
  const [showStageForm, setShowStageForm] = useState(false);
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
  const [draggedDealId, setDraggedDealId] = useState<string | null>(null);
  const [dragOverStageId, setDragOverStageId] = useState<string | null>(null);

  const stages = funnel.stages || [];

  const handleDragStart = (e: React.DragEvent, dealId: string) => {
    setDraggedDealId(dealId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    setDragOverStageId(stageId);
  };

  const handleDragLeave = () => {
    setDragOverStageId(null);
  };

  const handleDrop = async (e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    setDragOverStageId(null);
    
    if (draggedDealId) {
      await updateDeal.mutateAsync({ id: draggedDealId, stage_id: stageId });
      setDraggedDealId(null);
    }
  };

  const handleAddDeal = (stageId: string) => {
    setSelectedStageId(stageId);
    setShowDealForm(true);
  };

  const getStageValue = (stage: FunnelStage) => {
    return (stage.deals || []).reduce((sum, deal) => sum + Number(deal.value || 0), 0);
  };

  return (
    <>
      <ScrollArea className="w-full">
        <div className="flex gap-4 pb-4 min-w-max">
          {stages.map((stage) => (
            <div
              key={stage.id}
              className={cn(
                "flex flex-col w-[300px] bg-muted/30 rounded-xl transition-all shrink-0",
                dragOverStageId === stage.id && "ring-2 ring-primary bg-primary/5"
              )}
              onDragOver={(e) => handleDragOver(e, stage.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, stage.id)}
            >
              {/* Stage Header */}
              <div className="p-3 border-b border-border/50">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <div 
                      className="h-3 w-3 rounded-full" 
                      style={{ backgroundColor: stage.color }}
                    />
                    <span className="font-medium text-sm">{stage.name}</span>
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                      {stage.deals?.length || 0}
                    </span>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  R$ {getStageValue(stage).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
              </div>

              {/* Deals */}
              <div className="flex-1 p-2 space-y-2 min-h-[200px] max-h-[calc(100vh-350px)] overflow-y-auto">
                {(stage.deals || []).map((deal) => (
                  <FunnelDealCard
                    key={deal.id}
                    deal={deal}
                    onDragStart={(e) => handleDragStart(e, deal.id)}
                  />
                ))}
                
                {!stage.is_final && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-muted-foreground hover:text-foreground"
                    onClick={() => handleAddDeal(stage.id)}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Adicionar
                  </Button>
                )}
              </div>
            </div>
          ))}

          {/* Add Stage Button */}
          <div className="flex items-start">
            <Button
              variant="outline"
              className="h-auto py-8 px-6 flex-col gap-2"
              onClick={() => setShowStageForm(true)}
            >
              <Plus className="h-5 w-5" />
              <span className="text-xs">Nova Etapa</span>
            </Button>
          </div>
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      <DealFormDialog
        open={showDealForm}
        onOpenChange={setShowDealForm}
        funnelId={funnel.id}
        stageId={selectedStageId || undefined}
      />

      <StageFormDialog
        open={showStageForm}
        onOpenChange={setShowStageForm}
        funnelId={funnel.id}
      />
    </>
  );
};
