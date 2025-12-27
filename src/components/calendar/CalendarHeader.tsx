import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, CalendarDays, Plus, RefreshCw } from "lucide-react";
import { format, addMonths, subMonths, addWeeks, subWeeks, addDays, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ViewMode } from "@/hooks/useCalendarTasks";
import { useGoogleCalendar } from "@/hooks/useGoogleCalendar";
import { cn } from "@/lib/utils";

interface CalendarHeaderProps {
  currentDate: Date;
  onDateChange: (date: Date) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onCreateTask: () => void;
}

export function CalendarHeader({
  currentDate,
  onDateChange,
  viewMode,
  onViewModeChange,
  onCreateTask,
}: CalendarHeaderProps) {
  const { isConnected, connectGoogle } = useGoogleCalendar();

  const navigatePrevious = () => {
    switch (viewMode) {
      case 'day':
        onDateChange(subDays(currentDate, 1));
        break;
      case 'week':
        onDateChange(subWeeks(currentDate, 1));
        break;
      case 'month':
        onDateChange(subMonths(currentDate, 1));
        break;
    }
  };

  const navigateNext = () => {
    switch (viewMode) {
      case 'day':
        onDateChange(addDays(currentDate, 1));
        break;
      case 'week':
        onDateChange(addWeeks(currentDate, 1));
        break;
      case 'month':
        onDateChange(addMonths(currentDate, 1));
        break;
    }
  };

  const goToToday = () => {
    onDateChange(new Date());
  };

  const getTitle = () => {
    switch (viewMode) {
      case 'day':
        return format(currentDate, "d 'de' MMMM 'de' yyyy", { locale: ptBR });
      case 'week':
        return format(currentDate, "MMMM 'de' yyyy", { locale: ptBR });
      case 'month':
        return format(currentDate, "MMMM 'de' yyyy", { locale: ptBR });
    }
  };

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
      <div className="flex items-center gap-2">
        <CalendarDays className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold capitalize">{getTitle()}</h1>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {/* Navegação */}
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" onClick={navigatePrevious}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={goToToday}>
            Hoje
          </Button>
          <Button variant="outline" size="icon" onClick={navigateNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Seletor de visualização */}
        <div className="flex items-center border rounded-lg p-0.5">
          {(['day', 'week', 'month'] as ViewMode[]).map((mode) => (
            <Button
              key={mode}
              variant={viewMode === mode ? 'default' : 'ghost'}
              size="sm"
              className="h-8 px-3"
              onClick={() => onViewModeChange(mode)}
            >
              {mode === 'day' ? 'Dia' : mode === 'week' ? 'Semana' : 'Mês'}
            </Button>
          ))}
        </div>

        {/* Sync Google Calendar */}
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "gap-2",
            isConnected && "text-green-600 border-green-600"
          )}
          onClick={() => !isConnected && connectGoogle.mutate()}
        >
          <RefreshCw className="h-4 w-4" />
          {isConnected ? 'Sincronizado' : 'Conectar Google'}
        </Button>

        {/* Criar tarefa */}
        <Button size="sm" className="gap-2" onClick={onCreateTask}>
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Nova Tarefa</span>
        </Button>
      </div>
    </div>
  );
}
