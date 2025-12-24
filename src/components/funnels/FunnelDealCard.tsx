import { useState } from "react";
import { Clock, DollarSign, MoreHorizontal, User, FileText, Calendar } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FunnelDeal, useFunnels } from "@/hooks/useFunnels";
import { DealFormDialog } from "./DealFormDialog";
import { formatForDisplay } from "@/lib/phone-utils";
import { cn } from "@/lib/utils";

interface FunnelDealCardProps {
  deal: FunnelDeal;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  isDragging?: boolean;
}

export const FunnelDealCard = ({ deal, onDragStart, onDragEnd, isDragging }: FunnelDealCardProps) => {
  const { deleteDeal } = useFunnels();
  const [showEdit, setShowEdit] = useState(false);

  const getTimeInStage = () => {
    const days = Math.floor((Date.now() - new Date(deal.entered_stage_at).getTime()) / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Hoje';
    if (days === 1) return '1 dia';
    return `${days} dias`;
  };

  const daysInStage = Math.floor((Date.now() - new Date(deal.entered_stage_at).getTime()) / (1000 * 60 * 60 * 24));
  const isOverdue = daysInStage > 7;

  const hasNotes = !!deal.notes;
  const hasExpectedDate = !!deal.expected_close_date;
  const customFieldsCount = Object.keys(deal.custom_fields || {}).length;

  return (
    <>
      <Card
        draggable
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        className={cn(
          "cursor-grab active:cursor-grabbing transition-all duration-200 hover:shadow-md hover:-translate-y-0.5",
          isDragging && "opacity-50 scale-95 shadow-lg rotate-2"
        )}
      >
        <CardContent className="p-3 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">
                {deal.title || deal.contact?.name || 'Sem nome'}
              </p>
              <p className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                <User className="h-3 w-3 shrink-0" />
                {deal.contact?.name && (
                  <span className="truncate">{deal.contact.name}</span>
                )}
                {!deal.contact?.name && formatForDisplay(deal.contact?.phone || '')}
              </p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
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

          {/* Value and Time */}
          <div className="flex items-center justify-between text-xs">
            <div className={cn(
              "flex items-center gap-1",
              isOverdue ? "text-destructive" : "text-muted-foreground"
            )}>
              <Clock className="h-3 w-3" />
              {getTimeInStage()}
            </div>
            {Number(deal.value) > 0 && (
              <div className="flex items-center gap-1 font-semibold text-primary">
                <DollarSign className="h-3 w-3" />
                R$ {Number(deal.value).toLocaleString('pt-BR')}
              </div>
            )}
          </div>

          {/* Indicators */}
          <div className="flex items-center gap-1 flex-wrap">
            {hasNotes && (
              <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                <FileText className="h-3 w-3 mr-0.5" />
                Notas
              </Badge>
            )}
            {hasExpectedDate && (
              <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                <Calendar className="h-3 w-3 mr-0.5" />
                {new Date(deal.expected_close_date!).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
              </Badge>
            )}
            {customFieldsCount > 0 && (
              <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                +{customFieldsCount} campos
              </Badge>
            )}
          </div>

          {/* Source */}
          {deal.source && (
            <div className="text-[10px] text-muted-foreground truncate">
              Origem: {deal.source}
            </div>
          )}
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
