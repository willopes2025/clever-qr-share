import { useState, useCallback } from "react";
import { Plus, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useGrabScroll } from "@/hooks/useGrabScroll";
import { Funnel, FunnelStage, FunnelDeal, useFunnels } from "@/hooks/useFunnels";
import { useStageDealCounts, useLoadMoreDeals, DEALS_PER_PAGE } from "@/hooks/useFunnelDeals";
import { useCustomFields } from "@/hooks/useCustomFields";
import { useFieldRequiredRules } from "@/hooks/useFieldRequiredRules";
import { getMissingRequiredFields } from "@/lib/required-fields";
import { FunnelDealCard } from "./FunnelDealCard";
import { DealFormDialog } from "./DealFormDialog";
import { StageFormDialog } from "./StageFormDialog";
import { StageContextMenu } from "./StageContextMenu";
import { RequiredFieldsCheckDialog } from "./RequiredFieldsCheckDialog";
import type { CustomFieldDefinition } from "@/hooks/useCustomFields";

interface FunnelKanbanViewProps {
  funnel: Funnel;
}

export const FunnelKanbanView = ({ funnel }: FunnelKanbanViewProps) => {
  const { updateDeal } = useFunnels();
  const { data: stageCounts = {} } = useStageDealCounts(funnel.id);
  const loadMoreDeals = useLoadMoreDeals();
  const grabScroll = useGrabScroll();
  const { leadFieldDefinitions } = useCustomFields();
  const { rules: requiredRules } = useFieldRequiredRules();

  const [showDealForm, setShowDealForm] = useState(false);
  const [showStageForm, setShowStageForm] = useState(false);
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
  const [draggedDealId, setDraggedDealId] = useState<string | null>(null);
  const [dragOverStageId, setDragOverStageId] = useState<string | null>(null);
  const [loadingStageId, setLoadingStageId] = useState<string | null>(null);

  // Estado do dialog de validação de campos obrigatórios
  const [pendingMove, setPendingMove] = useState<{
    deal: FunnelDeal;
    targetStage: FunnelStage;
    missing: CustomFieldDefinition[];
  } | null>(null);

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

  const moveDealToStage = useCallback((deal: FunnelDeal, targetStage: FunnelStage, extraFields?: Record<string, unknown>) => {
    const merged = { ...(deal.custom_fields as Record<string, unknown> || {}), ...(extraFields || {}) };
    updateDeal.mutate({
      id: deal.id,
      stage_id: targetStage.id,
      ...(extraFields ? { custom_fields: merged } : {}),
      ...(targetStage.is_final ? { closed_at: new Date().toISOString() } : { closed_at: null }),
    });
  }, [updateDeal]);

  const handleDrop = useCallback((e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    setDragOverStageId(null);

    if (!draggedDealId) return;
    const targetStage = stages.find(s => s.id === stageId);
    if (!targetStage) {
      setDraggedDealId(null);
      return;
    }
    // Localiza o deal sendo arrastado
    let draggedDeal: FunnelDeal | undefined;
    for (const s of stages) {
      const d = (s.deals || []).find(x => x.id === draggedDealId);
      if (d) { draggedDeal = d; break; }
    }

    if (draggedDeal && leadFieldDefinitions) {
      const missing = getMissingRequiredFields({
        funnelId: funnel.id,
        stageId: targetStage.id,
        stages,
        fieldDefinitions: leadFieldDefinitions,
        rules: requiredRules || [],
        values: (draggedDeal.custom_fields as Record<string, unknown>) || {},
      });
      if (missing.length > 0) {
        setPendingMove({ deal: draggedDeal, targetStage, missing });
        setDraggedDealId(null);
        return;
      }
    }

    if (draggedDeal) {
      moveDealToStage(draggedDeal, targetStage);
    } else {
      // Fallback: deal not in current view; update stage + closed_at if final stage
      updateDeal.mutate({
        id: draggedDealId,
        stage_id: stageId,
        ...(targetStage.is_final ? { closed_at: new Date().toISOString() } : { closed_at: null }),
      });
    }
    setDraggedDealId(null);
  }, [draggedDealId, stages, funnel.id, leadFieldDefinitions, requiredRules, moveDealToStage, updateDeal]);

  const handleAddDeal = (stageId: string) => {
    setSelectedStageId(stageId);
    setShowDealForm(true);
  };

  const getStageValue = (stage: FunnelStage) => {
    return (stage.deals || []).reduce((sum, deal) => sum + Number(deal.value || 0), 0);
  };

  return (
    <>
      <div
        ref={grabScroll.ref}
        className={cn(
          "w-full overflow-x-auto pb-2",
          grabScroll.isGrabbing ? "cursor-grabbing select-none" : "cursor-grab"
        )}
        {...grabScroll.handlers}
      >
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
      </div>

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

      {pendingMove && (
        <RequiredFieldsCheckDialog
          open={!!pendingMove}
          onOpenChange={(o) => { if (!o) setPendingMove(null); }}
          stageName={pendingMove.targetStage.name}
          missingFields={pendingMove.missing}
          initialValues={(pendingMove.deal.custom_fields as Record<string, unknown>) || {}}
          isSubmitting={updateDeal.isPending}
          onConfirm={async (values) => {
            const extra: Record<string, unknown> = {};
            for (const f of pendingMove.missing) extra[f.field_key] = values[f.field_key];
            await Promise.resolve(moveDealToStage(pendingMove.deal, pendingMove.targetStage, extra));
            setPendingMove(null);
          }}
        />
      )}
    </>
  );
};
