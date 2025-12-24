import { useState } from "react";
import { Target, Plus, ChevronRight, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useFunnels } from "@/hooks/useFunnels";
import { DealFormDialog } from "@/components/funnels/DealFormDialog";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface FunnelDealSectionProps {
  contactId: string;
  conversationId?: string;
}

export const FunnelDealSection = ({ contactId, conversationId }: FunnelDealSectionProps) => {
  const { funnels, updateDeal, useContactDeal } = useFunnels();
  const { data: activeDeal, isLoading } = useContactDeal(contactId);
  const [showDealForm, setShowDealForm] = useState(false);
  const navigate = useNavigate();

  const formatCurrency = (value: number, currency: string = 'BRL') => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency,
    }).format(value);
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Funil de Vendas</span>
        </div>
        <div className="h-16 bg-muted/50 rounded-lg animate-pulse" />
      </div>
    );
  }

  if (!activeDeal) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Funil de Vendas</span>
          </div>
        </div>
        
        <div className="bg-muted/30 rounded-lg p-4 text-center">
          <p className="text-sm text-muted-foreground mb-3">
            Este contato não está em nenhum funil
          </p>
          <Button 
            size="sm" 
            onClick={() => setShowDealForm(true)}
            className="gap-1"
          >
            <Plus className="h-3 w-3" />
            Adicionar ao Funil
          </Button>
        </div>

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
  const availableStages = currentFunnel?.stages?.filter(s => !s.is_final) || [];

  const handleStageChange = async (newStageId: string) => {
    await updateDeal.mutateAsync({ id: activeDeal.id, stage_id: newStageId });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Funil de Vendas</span>
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-7 text-xs gap-1"
          onClick={() => navigate('/funnels')}
        >
          Ver Funil
          <ChevronRight className="h-3 w-3" />
        </Button>
      </div>

      <div className="bg-muted/30 rounded-lg p-3 space-y-3">
        {/* Funnel & Stage */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {currentFunnel?.name}
          </span>
          <Badge 
            variant="outline" 
            style={{ 
              borderColor: currentStage?.color,
              color: currentStage?.color
            }}
          >
            {currentStage?.name}
          </Badge>
        </div>

        {/* Deal Title */}
        {activeDeal.title && (
          <p className="text-sm font-medium">{activeDeal.title}</p>
        )}

        {/* Value */}
        {activeDeal.value > 0 && (
          <div className="flex items-center gap-1 text-sm">
            <DollarSign className="h-3 w-3 text-primary" />
            <span className="font-semibold text-primary">
              {formatCurrency(activeDeal.value, activeDeal.currency || 'BRL')}
            </span>
          </div>
        )}

        {/* Time in Stage */}
        {activeDeal.entered_stage_at && (
          <p className="text-xs text-muted-foreground">
            Na etapa há {formatDistanceToNow(new Date(activeDeal.entered_stage_at), { locale: ptBR })}
          </p>
        )}

        <Separator />

        {/* Quick Stage Change */}
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Mover para:</label>
          <Select 
            value={activeDeal.stage_id} 
            onValueChange={handleStageChange}
            disabled={updateDeal.isPending}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Selecionar etapa" />
            </SelectTrigger>
            <SelectContent>
              {currentFunnel?.stages?.map((stage) => (
                <SelectItem key={stage.id} value={stage.id}>
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-2 h-2 rounded-full" 
                      style={{ backgroundColor: stage.color }} 
                    />
                    {stage.name}
                    {stage.is_final && (
                      <span className="text-xs text-muted-foreground">
                        ({stage.final_type === 'won' ? 'Ganho' : 'Perdido'})
                      </span>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
};
