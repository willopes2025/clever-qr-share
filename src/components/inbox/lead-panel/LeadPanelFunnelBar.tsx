import { useState } from "react";
import { Target, Plus, ChevronRight, Clock, ArrowRightLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useFunnels } from "@/hooks/useFunnels";
import { DealFormDialog } from "@/components/funnels/DealFormDialog";
import { MoveDealFunnelDialog } from "@/components/funnels/MoveDealFunnelDialog";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface LeadPanelFunnelBarProps {
  contactId: string;
  conversationId?: string;
}

export const LeadPanelFunnelBar = ({ contactId, conversationId }: LeadPanelFunnelBarProps) => {
  const { funnels, updateDeal, useContactDeal } = useFunnels();
  const { data: activeDeal, isLoading } = useContactDeal(contactId);
  const [showDealForm, setShowDealForm] = useState(false);
  const [showMoveFunnel, setShowMoveFunnel] = useState(false);
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="px-3 py-2 border-b border-border/30">
        <div className="h-10 bg-muted/30 rounded animate-pulse" />
      </div>
    );
  }

  if (!activeDeal) {
    return (
      <div className="px-3 py-2 border-b border-border/30">
        <Button 
          variant="outline" 
          size="sm" 
          className="w-full h-9 gap-2 text-muted-foreground hover:text-foreground"
          onClick={() => setShowDealForm(true)}
        >
          <Plus className="h-3.5 w-3.5" />
          Adicionar ao Funil
        </Button>

        <DealFormDialog
          open={showDealForm}
          onOpenChange={setShowDealForm}
          contactId={contactId}
          conversationId={conversationId}
        />
      </div>
    );
  }

  const currentFunnel = funnels?.find(f => f.id === activeDeal.funnel_id);
  const currentStage = currentFunnel?.stages?.find(s => s.id === activeDeal.stage_id);

  const handleStageChange = async (newStageId: string) => {
    await updateDeal.mutateAsync({ id: activeDeal.id, stage_id: newStageId });
  };

  return (
    <div className="px-3 py-2 border-b border-border/30 space-y-2">
      {/* Funnel + Stage Dropdown */}
      <div className="flex items-center gap-2">
        <Target className="h-4 w-4 text-muted-foreground shrink-0" />
        
        <Select 
          value={activeDeal.stage_id} 
          onValueChange={handleStageChange}
          disabled={updateDeal.isPending}
        >
          <SelectTrigger className="h-8 text-sm flex-1 min-w-0 border border-border/50 bg-muted/30 px-2 hover:bg-muted/50 focus:ring-1 focus:ring-primary/30 rounded-md cursor-pointer">
            <div className="flex items-center gap-2 min-w-0 overflow-hidden">
              <span className="text-muted-foreground text-xs shrink-0">{currentFunnel?.name} -</span>
              <Badge 
                variant="secondary"
                className="font-medium shrink-0"
                style={{ 
                  backgroundColor: `${currentStage?.color}20`,
                  color: currentStage?.color,
                  borderColor: `${currentStage?.color}40`
                }}
              >
                {currentStage?.name}
              </Badge>
            </div>
          </SelectTrigger>
          <SelectContent className="z-[100]">
            {currentFunnel?.stages?.map((stage) => (
              <SelectItem key={stage.id} value={stage.id} className="cursor-pointer">
                <div className="flex items-center gap-2">
                  <div 
                    className="w-2.5 h-2.5 rounded-full shrink-0" 
                    style={{ backgroundColor: stage.color }} 
                  />
                  {stage.name}
                  {stage.is_final && (
                    <span className="text-xs text-muted-foreground ml-1">
                      ({stage.final_type === 'won' ? 'Ganho' : 'Perdido'})
                    </span>
                  )}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button 
          variant="ghost" 
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={() => setShowMoveFunnel(true)}
          title="Mover para outro funil"
        >
          <ArrowRightLeft className="h-3.5 w-3.5" />
        </Button>

        <Button 
          variant="ghost" 
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={() => navigate('/funnels')}
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Time in Stage */}
      {activeDeal.entered_stage_at && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground pl-6">
          <Clock className="h-3 w-3" />
          <span>Na etapa há {formatDistanceToNow(new Date(activeDeal.entered_stage_at), { locale: ptBR })}</span>
        </div>
      )}

      {/* Move to Another Funnel Dialog */}
      <MoveDealFunnelDialog
        deal={activeDeal as any}
        currentFunnelId={activeDeal.funnel_id}
        open={showMoveFunnel}
        onOpenChange={setShowMoveFunnel}
      />
    </div>
  );
};
