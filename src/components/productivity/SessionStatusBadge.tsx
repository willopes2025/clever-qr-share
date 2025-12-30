import { useState, useEffect } from 'react';
import { Coffee, Utensils, Clock, Play, Pause } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useActivitySession } from '@/hooks/useActivitySession';
import { cn } from '@/lib/utils';

export const SessionStatusBadge = () => {
  const { currentSession, switchSession, startSession, endSession, loading } = useActivitySession();
  const [elapsed, setElapsed] = useState('00:00');

  // Update elapsed time every second
  useEffect(() => {
    if (!currentSession) {
      setElapsed('00:00');
      return;
    }

    const updateElapsed = () => {
      const start = new Date(currentSession.started_at);
      const now = new Date();
      const diffMs = now.getTime() - start.getTime();
      const hours = Math.floor(diffMs / 3600000);
      const minutes = Math.floor((diffMs % 3600000) / 60000);
      const seconds = Math.floor((diffMs % 60000) / 1000);

      if (hours > 0) {
        setElapsed(`${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
      } else {
        setElapsed(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
      }
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);
    return () => clearInterval(interval);
  }, [currentSession]);

  if (loading) {
    return (
      <Badge variant="outline" className="animate-pulse">
        <Clock className="h-3 w-3 mr-1" />
        --:--
      </Badge>
    );
  }

  const getStatusConfig = () => {
    if (!currentSession) {
      return {
        icon: Pause,
        label: 'Offline',
        color: 'bg-muted text-muted-foreground',
      };
    }

    switch (currentSession.session_type) {
      case 'work':
        return {
          icon: Play,
          label: 'Trabalhando',
          color: 'bg-green-500/10 text-green-600 border-green-500/20',
        };
      case 'break':
        return {
          icon: Coffee,
          label: 'Intervalo',
          color: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
        };
      case 'lunch':
        return {
          icon: Utensils,
          label: 'Almoço',
          color: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
        };
      default:
        return {
          icon: Clock,
          label: 'Ativo',
          color: 'bg-primary/10 text-primary',
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Badge 
          variant="outline" 
          className={cn(
            'cursor-pointer hover:opacity-80 transition-opacity gap-1.5',
            config.color
          )}
        >
          <Icon className="h-3 w-3" />
          <span className="hidden sm:inline">{config.label}</span>
          <span className="font-mono text-xs">{elapsed}</span>
        </Badge>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="z-[100] bg-popover border border-border shadow-lg">
        <DropdownMenuItem onClick={() => currentSession ? switchSession('work') : startSession('work')}>
          <Play className="h-4 w-4 mr-2 text-green-600" />
          Iniciar Trabalho
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => currentSession ? switchSession('break') : startSession('break')}>
          <Coffee className="h-4 w-4 mr-2 text-amber-600" />
          Intervalo
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => currentSession ? switchSession('lunch') : startSession('lunch')}>
          <Utensils className="h-4 w-4 mr-2 text-orange-600" />
          Almoço
        </DropdownMenuItem>
        {currentSession && (
          <DropdownMenuItem onClick={() => endSession()} className="text-destructive">
            <Pause className="h-4 w-4 mr-2" />
            Encerrar Sessão
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
