import { CalendarTask } from "@/hooks/useCalendarTasks";
import { TaskEventCard } from "./TaskEventCard";
import { format, isSameDay, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

interface DayViewProps {
  currentDate: Date;
  tasks: CalendarTask[];
  onTaskClick: (task: CalendarTask) => void;
}

export function DayView({ currentDate, tasks, onTaskClick }: DayViewProps) {
  const isCurrentDay = isToday(currentDate);

  const dayTasks = tasks.filter(task => {
    if (!task.due_date) return false;
    return isSameDay(new Date(task.due_date), currentDate);
  });

  // Agrupar por horário
  const tasksWithTime = dayTasks.filter(t => t.due_time);
  const tasksWithoutTime = dayTasks.filter(t => !t.due_time);

  // Criar slots de hora
  const hours = Array.from({ length: 24 }, (_, i) => i);

  const getTasksForHour = (hour: number) => {
    return tasksWithTime.filter(task => {
      const taskHour = parseInt(task.due_time!.split(':')[0], 10);
      return taskHour === hour;
    });
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Cabeçalho do dia */}
      <div
        className={cn(
          "p-4 border-b text-center",
          isCurrentDay && "bg-primary/10"
        )}
      >
        <div className="text-sm text-muted-foreground">
          {format(currentDate, 'EEEE', { locale: ptBR })}
        </div>
        <div
          className={cn(
            "text-2xl font-bold",
            isCurrentDay && "text-primary"
          )}
        >
          {format(currentDate, "d 'de' MMMM", { locale: ptBR })}
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4">
          {/* Tarefas sem horário */}
          {tasksWithoutTime.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-muted-foreground mb-2">
                Dia inteiro
              </h3>
              <div className="space-y-2">
                {tasksWithoutTime.map(task => (
                  <TaskEventCard
                    key={task.id}
                    task={task}
                    onClick={() => onTaskClick(task)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Timeline por hora */}
          <div className="space-y-0">
            {hours.map(hour => {
              const hourTasks = getTasksForHour(hour);
              
              if (hourTasks.length === 0 && hour < 6) return null;
              if (hourTasks.length === 0 && hour > 21) return null;

              return (
                <div
                  key={hour}
                  className="flex gap-4 min-h-[60px] border-t first:border-t-0"
                >
                  <div className="w-16 py-2 text-sm text-muted-foreground text-right pr-4">
                    {String(hour).padStart(2, '0')}:00
                  </div>
                  <div className="flex-1 py-2 space-y-1">
                    {hourTasks.map(task => (
                      <TaskEventCard
                        key={task.id}
                        task={task}
                        onClick={() => onTaskClick(task)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {dayTasks.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              Nenhuma tarefa para este dia
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
