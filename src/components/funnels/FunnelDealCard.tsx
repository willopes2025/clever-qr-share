import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Clock, DollarSign, MoreHorizontal, User, Calendar, CheckSquare, 
  AlertCircle, MessageCircle, Flame, Phone, ListTodo, ArrowRight, ArrowRightLeft
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FunnelDeal, useFunnels } from "@/hooks/useFunnels";
import { DealFormDialog } from "./DealFormDialog";
import { MoveDealFunnelDialog } from "./MoveDealFunnelDialog";
import { formatForDisplay } from "@/lib/phone-utils";
import { cn } from "@/lib/utils";
import { useDealTasks } from "@/hooks/useDealTasks";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { differenceInHours, differenceInDays, format, isPast, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";

interface FunnelDealCardProps {
  deal: FunnelDeal;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  isDragging?: boolean;
}

export const FunnelDealCard = ({ deal, onDragStart, onDragEnd, isDragging }: FunnelDealCardProps) => {
  const navigate = useNavigate();
  const { deleteDeal } = useFunnels();
  const [showEdit, setShowEdit] = useState(false);
  const [showMoveFunnel, setShowMoveFunnel] = useState(false);
  const { pendingCount, overdueCount, nextTask } = useDealTasks(deal.id);
  const { members } = useTeamMembers();

  const responsible = members?.find(m => m.user_id === deal.responsible_id);

  const handleGoToChat = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (deal.conversation_id) {
      navigate(`/inbox?conversationId=${deal.conversation_id}`);
    } else if (deal.contact_id) {
      navigate(`/inbox?contactId=${deal.contact_id}`);
    }
  };

  const getTimeInStage = () => {
    const days = Math.floor((Date.now() - new Date(deal.entered_stage_at).getTime()) / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Hoje';
    if (days === 1) return '1 dia';
    return `${days}d`;
  };

  const daysInStage = Math.floor((Date.now() - new Date(deal.entered_stage_at).getTime()) / (1000 * 60 * 60 * 24));

  // Urgency calculation: red if no next action OR overdue task OR >7 days without action
  const getUrgencyStatus = () => {
    if (deal.next_action_required && !nextTask) return 'critical'; // Needs action but none scheduled
    if (overdueCount > 0) return 'critical'; // Has overdue tasks
    if (daysInStage > 7 && !nextTask) return 'warning'; // Long time without action
    if (daysInStage > 3) return 'attention';
    return 'healthy';
  };

  const urgencyStatus = getUrgencyStatus();
  const urgencyColors = {
    critical: 'border-l-destructive bg-destructive/5',
    warning: 'border-l-orange-500 bg-orange-500/5',
    attention: 'border-l-yellow-500 bg-yellow-500/5',
    healthy: 'border-l-green-500'
  };

  // Temperature based on activity and value
  const getTemperature = () => {
    const hoursSinceUpdate = differenceInHours(new Date(), new Date(deal.updated_at || deal.created_at));
    const hasHighValue = Number(deal.value) >= 1000;
    
    if (hoursSinceUpdate <= 24 && hasHighValue) return 'hot';
    if (hoursSinceUpdate <= 48 || hasHighValue) return 'warm';
    return 'cold';
  };

  const temperature = getTemperature();
  const tempConfig = {
    hot: { color: 'text-red-500', label: 'Quente' },
    warm: { color: 'text-orange-500', label: 'Morno' },
    cold: { color: 'text-blue-400', label: 'Frio' }
  };

  const handleCardClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-dropdown-trigger]')) return;
    setShowEdit(true);
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  const getNextActionDisplay = () => {
    if (!nextTask?.due_date) return null;
    const dueDate = new Date(nextTask.due_date);
    const isOverdue = isPast(dueDate) && !isToday(dueDate);
    const daysDiff = differenceInDays(dueDate, new Date());
    
    let label = format(dueDate, "dd/MMM", { locale: ptBR });
    if (isToday(dueDate)) label = 'Hoje';
    else if (daysDiff === 1) label = 'Amanhã';
    else if (daysDiff === -1) label = 'Ontem';
    
    return { label, isOverdue, title: nextTask.title };
  };

  const nextActionDisplay = getNextActionDisplay();

  return (
    <>
      <TooltipProvider>
        <Card
          draggable
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onClick={handleCardClick}
          className={cn(
            "cursor-pointer active:cursor-grabbing transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 group border-l-4",
            urgencyColors[urgencyStatus],
            isDragging && "opacity-50 scale-95 shadow-lg rotate-2"
          )}
        >
          <CardContent className="p-3 space-y-2">
            {/* Header: Title + Avatar + Actions */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="font-semibold text-sm truncate flex-1">
                    {deal.title || deal.contact?.name || 'Sem nome'}
                  </p>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Flame className={cn("h-3.5 w-3.5 shrink-0", tempConfig[temperature].color)} />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">
                      Lead {tempConfig[temperature].label}
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Phone className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span className="text-xs text-muted-foreground truncate">
                    {formatForDisplay(deal.contact?.phone || '')}
                  </span>
                </div>
              </div>
              
              <div className="flex items-center gap-1">
                {/* Responsible Avatar */}
                {responsible && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Avatar className="h-6 w-6 border-2 border-background">
                        <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                          {getInitials(responsible.profile?.full_name || responsible.email)}
                        </AvatarFallback>
                      </Avatar>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">
                      {responsible.profile?.full_name || responsible.email}
                    </TooltipContent>
                  </Tooltip>
                )}
                
                {/* Quick Actions */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={handleGoToChat}
                  title="Ir para conversa"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                </Button>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      data-dropdown-trigger
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setShowEdit(true)}>
                      Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setShowMoveFunnel(true)}>
                      <ArrowRightLeft className="h-4 w-4 mr-2" />
                      Mover para outro funil
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      className="text-destructive"
                      onClick={() => deleteDeal.mutate(deal.id)}
                    >
                      Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Stats Row: Value | Time | Temperature */}
            <div className="flex items-center gap-2 text-xs">
              {Number(deal.value) > 0 && (
                <div className="flex items-center gap-1 font-semibold text-primary">
                  <DollarSign className="h-3 w-3" />
                  R$ {Number(deal.value).toLocaleString('pt-BR')}
                </div>
              )}
              <div className="flex items-center gap-1 text-muted-foreground">
                <Clock className="h-3 w-3" />
                {getTimeInStage()}
              </div>
            </div>

            {/* Next Action Badge */}
            {nextActionDisplay && (
              <div className={cn(
                "flex items-center gap-1.5 text-xs rounded-md px-2 py-1",
                nextActionDisplay.isOverdue 
                  ? "bg-destructive/10 text-destructive" 
                  : "bg-primary/10 text-primary"
              )}>
                <Calendar className="h-3 w-3 shrink-0" />
                <span className="font-medium">{nextActionDisplay.label}</span>
                <ArrowRight className="h-3 w-3 shrink-0" />
                <span className="truncate">{nextActionDisplay.title}</span>
              </div>
            )}

            {/* Alert: Needs Next Action */}
            {deal.next_action_required && !nextTask && (
              <div className="flex items-center gap-1.5 text-xs bg-destructive/10 text-destructive rounded-md px-2 py-1 animate-pulse">
                <AlertCircle className="h-3 w-3 shrink-0" />
                <span className="font-medium">Agendar próxima ação!</span>
              </div>
            )}

            {/* Task & Date Indicators */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {pendingCount > 0 && (
                <Badge 
                  variant={overdueCount > 0 ? "destructive" : "secondary"} 
                  className="h-5 px-1.5 text-[10px] gap-0.5"
                >
                  <ListTodo className="h-3 w-3" />
                  {pendingCount}
                  {overdueCount > 0 && (
                    <span className="ml-0.5">({overdueCount}⚠)</span>
                  )}
                </Badge>
              )}
              {deal.expected_close_date && (
                <Badge variant="outline" className="h-5 px-1.5 text-[10px] gap-0.5">
                  <Calendar className="h-3 w-3" />
                  {format(new Date(deal.expected_close_date), "dd/MMM", { locale: ptBR })}
                </Badge>
              )}
              {deal.source && (
                <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                  {deal.source}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </TooltipProvider>

      <DealFormDialog
        open={showEdit}
        onOpenChange={setShowEdit}
        funnelId={deal.funnel_id}
        stageId={deal.stage_id}
        deal={deal}
      />

      <MoveDealFunnelDialog
        deal={deal}
        currentFunnelId={deal.funnel_id}
        open={showMoveFunnel}
        onOpenChange={setShowMoveFunnel}
      />
    </>
  );
};