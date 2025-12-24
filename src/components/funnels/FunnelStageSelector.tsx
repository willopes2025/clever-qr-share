import { useState } from "react";
import { Target, Plus, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useFunnels } from "@/hooks/useFunnels";
import { DealFormDialog } from "./DealFormDialog";

interface FunnelStageSelectorProps {
  contactId: string;
  conversationId?: string;
}

export const FunnelStageSelector = ({ contactId, conversationId }: FunnelStageSelectorProps) => {
  const { funnels, updateDeal, useContactDeal } = useFunnels();
  const { data: currentDeal, isLoading } = useContactDeal(contactId);
  const [showAddDeal, setShowAddDeal] = useState(false);
  const [selectedFunnelId, setSelectedFunnelId] = useState<string | null>(null);

  if (isLoading) return null;

  const currentFunnel = funnels?.find(f => f.id === currentDeal?.funnel_id);
  const currentStage = currentFunnel?.stages?.find(s => s.id === currentDeal?.stage_id);

  const handleStageChange = async (stageId: string) => {
    if (currentDeal) {
      await updateDeal.mutateAsync({ id: currentDeal.id, stage_id: stageId });
    }
  };

  const handleAddToFunnel = (funnelId: string) => {
    setSelectedFunnelId(funnelId);
    setShowAddDeal(true);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {currentDeal ? (
            <Button variant="outline" size="sm" className="gap-2">
              <div 
                className="h-2 w-2 rounded-full" 
                style={{ backgroundColor: currentStage?.color }}
              />
              <span className="max-w-[100px] truncate">{currentStage?.name}</span>
              <ChevronDown className="h-3 w-3" />
            </Button>
          ) : (
            <Button variant="outline" size="sm" className="gap-2">
              <Target className="h-4 w-4" />
              <span>Funil</span>
              <Plus className="h-3 w-3" />
            </Button>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {currentDeal ? (
            <>
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                {currentFunnel?.name}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {currentFunnel?.stages?.filter(s => !s.is_final).map((stage) => (
                <DropdownMenuItem
                  key={stage.id}
                  onClick={() => handleStageChange(stage.id)}
                  className="gap-2"
                >
                  <div 
                    className="h-2 w-2 rounded-full" 
                    style={{ backgroundColor: stage.color }}
                  />
                  {stage.name}
                  {stage.id === currentDeal.stage_id && (
                    <Badge variant="secondary" className="ml-auto text-xs">Atual</Badge>
                  )}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                Fechar como
              </DropdownMenuLabel>
              {currentFunnel?.stages?.filter(s => s.is_final).map((stage) => (
                <DropdownMenuItem
                  key={stage.id}
                  onClick={() => handleStageChange(stage.id)}
                  className="gap-2"
                >
                  <div 
                    className="h-2 w-2 rounded-full" 
                    style={{ backgroundColor: stage.color }}
                  />
                  {stage.name}
                </DropdownMenuItem>
              ))}
            </>
          ) : (
            <>
              <DropdownMenuLabel>Adicionar ao Funil</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {funnels?.length ? (
                funnels.map((funnel) => (
                  <DropdownMenuItem
                    key={funnel.id}
                    onClick={() => handleAddToFunnel(funnel.id)}
                    className="gap-2"
                  >
                    <div 
                      className="h-2 w-2 rounded-full" 
                      style={{ backgroundColor: funnel.color }}
                    />
                    {funnel.name}
                  </DropdownMenuItem>
                ))
              ) : (
                <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                  Nenhum funil criado
                </div>
              )}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {selectedFunnelId && (
        <DealFormDialog
          open={showAddDeal}
          onOpenChange={(open) => {
            setShowAddDeal(open);
            if (!open) setSelectedFunnelId(null);
          }}
          funnelId={selectedFunnelId}
          stageId={funnels?.find(f => f.id === selectedFunnelId)?.stages?.[0]?.id}
          contactId={contactId}
          conversationId={conversationId}
        />
      )}
    </>
  );
};
