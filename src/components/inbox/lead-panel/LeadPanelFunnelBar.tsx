import { useState } from "react";
import { Target, Plus, ChevronRight, Clock } from "lucide-react";
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
          <SelectTrigger className="h-8 text-sm flex-1 border-0 bg-transparent p-0 hover:bg-transparent focus:ring-0 shadow-none">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-xs">{currentFunnel?.name} -</span>
              <Badge 
                variant="secondary"
                className="font-medium"
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
          <SelectContent>
            {currentFunnel?.stages?.map((stage) => (
              <SelectItem key={stage.id} value={stage.id}>
                <div className="flex items-center gap-2">
                  <div 
                    className="w-2.5 h-2.5 rounded-full" 
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
    </div>
  );
};
