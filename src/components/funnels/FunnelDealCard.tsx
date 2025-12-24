import { useState } from "react";
import { Clock, DollarSign, MoreHorizontal, User } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FunnelDeal, useFunnels } from "@/hooks/useFunnels";
import { DealFormDialog } from "./DealFormDialog";
import { formatForDisplay } from "@/lib/phone-utils";

interface FunnelDealCardProps {
  deal: FunnelDeal;
  onDragStart: (e: React.DragEvent) => void;
}

export const FunnelDealCard = ({ deal, onDragStart }: FunnelDealCardProps) => {
  const { deleteDeal } = useFunnels();
  const [showEdit, setShowEdit] = useState(false);

  const getTimeInStage = () => {
    const days = Math.floor((Date.now() - new Date(deal.entered_stage_at).getTime()) / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Hoje';
    if (days === 1) return '1 dia';
    return `${days} dias`;
  };

  return (
    <>
      <Card
        draggable
        onDragStart={onDragStart}
        className="cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow"
      >
        <CardContent className="p-3 space-y-2">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">
                {deal.title || deal.contact?.name || 'Sem nome'}
              </p>
              <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                <User className="h-3 w-3" />
                {formatForDisplay(deal.contact?.phone || '')}
              </p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0">
                  <MoreHorizontal className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setShowEdit(true)}>
                  Editar
                </DropdownMenuItem>
                <DropdownMenuItem 
                  className="text-destructive"
                  onClick={() => deleteDeal.mutate(deal.id)}
                >
                  Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1 text-muted-foreground">
              <Clock className="h-3 w-3" />
              {getTimeInStage()}
            </div>
            {Number(deal.value) > 0 && (
              <div className="flex items-center gap-1 font-medium text-primary">
                <DollarSign className="h-3 w-3" />
                R$ {Number(deal.value).toLocaleString('pt-BR')}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <DealFormDialog
        open={showEdit}
        onOpenChange={setShowEdit}
        funnelId={deal.funnel_id}
        stageId={deal.stage_id}
        deal={deal}
      />
    </>
  );
};
