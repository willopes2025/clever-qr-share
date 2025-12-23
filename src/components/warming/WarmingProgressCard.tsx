import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Play, Pause, CheckCircle2, Flame, MessageSquare, ArrowDownUp, Trash2, Clock } from "lucide-react";
import { WarmingSchedule } from "@/hooks/useWarming";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface WarmingProgressCardProps {
  schedule: WarmingSchedule;
  onToggleStatus: (scheduleId: string, status: 'active' | 'paused') => void;
  onDelete: (scheduleId: string) => void;
  isToggling?: boolean;
  isDeleting?: boolean;
}

const WARMING_LEVELS = [
  { name: 'Frio', color: 'bg-blue-500' },
  { name: 'Morno', color: 'bg-yellow-500' },
  { name: 'Aquecendo', color: 'bg-orange-500' },
  { name: 'Quente', color: 'bg-red-500' },
  { name: 'Muito Quente', color: 'bg-red-700' },
];

export function WarmingProgressCard({ schedule, onToggleStatus, onDelete, isToggling, isDeleting }: WarmingProgressCardProps) {
  const progress = (schedule.current_day / schedule.target_days) * 100;
  const dailyProgress = schedule.messages_target_today > 0 
    ? (schedule.messages_sent_today / schedule.messages_target_today) * 100 
    : 0;
  
  const warmingLevel = schedule.instance?.warming_level || 1;
  const levelInfo = WARMING_LEVELS[warmingLevel - 1] || WARMING_LEVELS[0];

  const getStatusBadge = () => {
    switch (schedule.status) {
      case 'active':
        return <Badge className="bg-green-500">Ativo</Badge>;
      case 'paused':
        return <Badge variant="secondary">Pausado</Badge>;
      case 'completed':
        return <Badge className="bg-blue-500">Concluído</Badge>;
      default:
        return null;
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flame className={`h-5 w-5 ${warmingLevel >= 4 ? 'text-red-500' : warmingLevel >= 2 ? 'text-orange-500' : 'text-blue-500'}`} />
            <CardTitle className="text-lg">{schedule.instance?.instance_name || 'Instância'}</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {getStatusBadge()}
            <Badge variant="outline" className={`${levelInfo.color} text-white`}>
              Nível {warmingLevel} - {levelInfo.name}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overall Progress */}
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-muted-foreground">Progresso Geral</span>
            <span className="font-medium">Dia {schedule.current_day} de {schedule.target_days}</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Daily Progress */}
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-muted-foreground">Progresso Hoje</span>
            <span className="font-medium">{schedule.messages_sent_today} / {schedule.messages_target_today} mensagens</span>
          </div>
          <Progress value={dailyProgress} className="h-2" />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="bg-muted/50 rounded-lg p-3">
            <MessageSquare className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
            <p className="text-lg font-bold">{schedule.total_messages_sent}</p>
            <p className="text-xs text-muted-foreground">Enviadas</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-3">
            <ArrowDownUp className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
            <p className="text-lg font-bold">{schedule.total_messages_received}</p>
            <p className="text-xs text-muted-foreground">Recebidas</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-3">
            <CheckCircle2 className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
            <p className="text-lg font-bold">
              {schedule.total_messages_sent > 0 
                ? Math.round((schedule.total_messages_received / schedule.total_messages_sent) * 100) 
                : 0}%
            </p>
            <p className="text-xs text-muted-foreground">Taxa Resposta</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          {schedule.status !== 'completed' && (
            <>
              {schedule.status === 'active' ? (
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => onToggleStatus(schedule.id, 'paused')}
                  disabled={isToggling}
                >
                  <Pause className="h-4 w-4 mr-2" />
                  Pausar
                </Button>
              ) : (
                <Button 
                  className="flex-1"
                  onClick={() => onToggleStatus(schedule.id, 'active')}
                  disabled={isToggling}
                >
                  <Play className="h-4 w-4 mr-2" />
                  Retomar
                </Button>
              )}
            </>
          )}
          
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button 
                variant="outline" 
                size="icon"
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                disabled={isDeleting}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir aquecimento?</AlertDialogTitle>
                <AlertDialogDescription>
                  Tem certeza que deseja excluir o aquecimento de "{schedule.instance?.instance_name}"? 
                  Todo o progresso será perdido e esta ação não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={() => onDelete(schedule.id)}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Excluir
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        {/* Status Info */}
        <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground border-t pt-3">
          {schedule.last_activity_at ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                    Última: {new Date(schedule.last_activity_at).toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Última atividade de aquecimento</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <span className="flex items-center gap-1 text-yellow-600">
              <Clock className="h-3 w-3" />
              Aguardando primeira execução
            </span>
          )}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Executa a cada 30min (8h-22h)
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p>O aquecimento roda automaticamente a cada 30 minutos entre 8h e 22h (horário de Brasília)</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardContent>
    </Card>
  );
}
