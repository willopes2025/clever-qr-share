import { useState, useCallback } from "react";
import { Plus, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Funnel, FunnelStage, useFunnels } from "@/hooks/useFunnels";
import { useStageDealCounts, useLoadMoreDeals, DEALS_PER_PAGE } from "@/hooks/useFunnelDeals";
import { FunnelDealCard } from "./FunnelDealCard";
import { DealFormDialog } from "./DealFormDialog";
import { StageFormDialog } from "./StageFormDialog";
import { StageContextMenu } from "./StageContextMenu";

interface FunnelKanbanViewProps {
  funnel: Funnel;
}

export const FunnelKanbanView = ({ funnel }: FunnelKanbanViewProps) => {
  const { updateDeal } = useFunnels();
  const { data: stageCounts = {} } = useStageDealCounts(funnel.id);
  const loadMoreDeals = useLoadMoreDeals();
  
  const [showDealForm, setShowDealForm] = useState(false);
  const [showStageForm, setShowStageForm] = useState(false);
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
  const [draggedDealId, setDraggedDealId] = useState<string | null>(null);
  const [dragOverStageId, setDragOverStageId] = useState<string | null>(null);
  const [loadingStageId, setLoadingStageId] = useState<string | null>(null);

  const stages = funnel.stages || [];

  // Track how many deals are loaded per stage
  const getLoadedDealsCount = (stage: FunnelStage) => (stage.deals || []).length;
  const getTotalDealsCount = (stage: FunnelStage) => stageCounts[stage.id] || getLoadedDealsCount(stage);
  const hasMoreDeals = (stage: FunnelStage) => getLoadedDealsCount(stage) < getTotalDealsCount(stage);

  const handleLoadMore = async (stageId: string) => {
    const stage = stages.find(s => s.id === stageId);
    if (!stage) return;
    
    setLoadingStageId(stageId);
    try {
      await loadMoreDeals.mutateAsync({
        stageId,
        funnelId: funnel.id,
        offset: getLoadedDealsCount(stage)
      });
    } finally {
      setLoadingStageId(null);
    }
  };

  const handleDragStart = useCallback((e: React.DragEvent, dealId: string) => {
    setDraggedDealId(dealId);
    e.dataTransfer.effectAllowed = 'move';
    // Add dragging class for visual feedback
    (e.target as HTMLElement).style.opacity = '0.5';
  }, []);

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    (e.target as HTMLElement).style.opacity = '1';
    setDraggedDealId(null);
    setDragOverStageId(null);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    if (dragOverStageId !== stageId) {
      setDragOverStageId(stageId);
    }
  }, [dragOverStageId]);

  const handleDragLeave = useCallback(() => {
    setDragOverStageId(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    setDragOverStageId(null);
    
    if (draggedDealId) {
      // Fire and forget - optimistic update handles UI
      updateDeal.mutate({ id: draggedDealId, stage_id: stageId });
      setDraggedDealId(null);
    }
  }, [draggedDealId, updateDeal]);

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
                "flex flex-col w-[300px] bg-muted/30 rounded-xl transition-all duration-200 shrink-0 group/stage",
                dragOverStageId === stage.id && "ring-2 ring-primary bg-primary/5 scale-[1.02]"
              )}
              onDragOver={(e) => handleDragOver(e, stage.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, stage.id)}
            >
              {/* Stage Header */}
              <div className="p-3 border-b border-border/50 group">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div 
                      className="h-3 w-3 rounded-full shrink-0 ring-2 ring-background shadow-sm" 
                      style={{ backgroundColor: stage.color }}
                    />
                    <span className="font-medium text-sm truncate">{stage.name}</span>
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full shrink-0">
                      {getTotalDealsCount(stage)}
                    </span>
                  </div>
                  <StageContextMenu stage={stage} stages={stages} funnelId={funnel.id} />
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-xs text-muted-foreground font-medium">
                    R$ {getStageValue(stage).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                  {stage.probability > 0 && (
                    <div className="text-xs text-muted-foreground">
                      {stage.probability}% prob.
                    </div>
                  )}
                </div>
              </div>

              {/* Deals */}
              <div className="flex-1 p-2 space-y-2 min-h-[200px] max-h-[calc(100vh-350px)] overflow-y-auto">
                <AnimatePresence mode="popLayout">
                  {(stage.deals || []).map((deal) => (
                    <motion.div
                      key={deal.id}
                      layout
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ duration: 0.2 }}
                    >
                      <FunnelDealCard
                        deal={deal}
                        onDragStart={(e) => handleDragStart(e, deal.id)}
                        onDragEnd={handleDragEnd}
                        isDragging={draggedDealId === deal.id}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
                
                {/* Load More Button */}
                {hasMoreDeals(stage) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    onClick={() => handleLoadMore(stage.id)}
                    disabled={loadingStageId === stage.id}
                  >
                    {loadingStageId === stage.id ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        Carregando...
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4 mr-1" />
                        Carregar mais ({getTotalDealsCount(stage) - getLoadedDealsCount(stage)})
                      </>
                    )}
                  </Button>
                )}

                {!stage.is_final && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-muted-foreground hover:text-foreground hover:bg-muted/50"
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
              className="h-auto py-8 px-6 flex-col gap-2 border-dashed hover:border-primary hover:bg-primary/5"
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
