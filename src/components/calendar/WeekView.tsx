import { CalendarTask } from "@/hooks/useCalendarTasks";
import { TaskEventCard } from "./TaskEventCard";
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

interface WeekViewProps {
  currentDate: Date;
  tasks: CalendarTask[];
  onTaskClick: (task: CalendarTask) => void;
  onDayClick: (date: Date) => void;
}

export function WeekView({ currentDate, tasks, onTaskClick, onDayClick }: WeekViewProps) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const getTasksForDay = (day: Date) => {
    return tasks.filter(task => {
      if (!task.due_date) return false;
      return isSameDay(new Date(task.due_date), day);
    });
  };

  return (
    <div className="flex-1 overflow-auto">
      <div className="grid grid-cols-7 min-w-[800px]">
        {days.map((day, index) => {
          const dayTasks = getTasksForDay(day);
          const isCurrentDay = isToday(day);

          return (
            <div
              key={index}
              className="border-r last:border-r-0"
            >
              {/* Cabeçalho do dia */}
              <div
                onClick={() => onDayClick(day)}
                className={cn(
                  "p-3 border-b text-center cursor-pointer transition-colors hover:bg-muted/50",
                  isCurrentDay && "bg-primary/10"
                )}
              >
                <div className="text-sm text-muted-foreground">
                  {format(day, 'EEE', { locale: ptBR })}
                </div>
                <div
                  className={cn(
                    "text-lg font-semibold",
                    isCurrentDay && "text-primary"
                  )}
                >
                  {format(day, 'd')}
                </div>
              </div>

              {/* Lista de tarefas */}
              <ScrollArea className="h-[calc(100vh-300px)]">
                <div className="p-2 space-y-2">
                  {dayTasks.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      Sem tarefas
                    </div>
                  ) : (
                    dayTasks.map(task => (
                      <TaskEventCard
                        key={task.id}
                        task={task}
                        onClick={() => onTaskClick(task)}
                      />
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          );
        })}
      </div>
    </div>
  );
}
