import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { CalendarHeader } from "@/components/calendar/CalendarHeader";
import { MonthView } from "@/components/calendar/MonthView";
import { WeekView } from "@/components/calendar/WeekView";
import { DayView } from "@/components/calendar/DayView";
import { CalendarFilters, CalendarFiltersState } from "@/components/calendar/CalendarFilters";
import { CreateTaskDialog } from "@/components/calendar/CreateTaskDialog";
import { TaskDetailDialog } from "@/components/calendar/TaskDetailDialog";
import { useCalendarTasks, ViewMode, CalendarTask } from "@/hooks/useCalendarTasks";
import { Skeleton } from "@/components/ui/skeleton";

export default function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedTask, setSelectedTask] = useState<CalendarTask | null>(null);
  const [filters, setFilters] = useState<CalendarFiltersState>({
    taskTypes: [],
    members: [],
    showCompleted: true,
  });

  const { data: tasks = [], isLoading } = useCalendarTasks(currentDate, viewMode);

  // Filtrar tarefas
  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      // Filtrar por tipo
      if (filters.taskTypes.length > 0 && task.task_type_id) {
        if (!filters.taskTypes.includes(task.task_type_id)) return false;
      }

      // Filtrar por membro
      if (filters.members.length > 0 && task.assigned_to) {
        if (!filters.members.includes(task.assigned_to)) return false;
      }

      // Filtrar concluídas
      if (!filters.showCompleted && task.completed_at) return false;

      return true;
    });
  }, [tasks, filters]);

  const handleDayClick = (date: Date) => {
    setSelectedDate(date);
    setCreateDialogOpen(true);
  };

  const handleTaskClick = (task: CalendarTask) => {
    setSelectedTask(task);
    setDetailDialogOpen(true);
  };

  const handleCreateTask = () => {
    setSelectedDate(new Date());
    setCreateDialogOpen(true);
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col h-[calc(100vh-4rem)]">
        <div className="p-4 md:p-6 border-b">
          <CalendarHeader
            currentDate={currentDate}
            onDateChange={setCurrentDate}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            onCreateTask={handleCreateTask}
          />
        </div>

        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 overflow-auto">
            {isLoading ? (
              <div className="p-6 space-y-4">
                <Skeleton className="h-8 w-48" />
                <div className="grid grid-cols-7 gap-4">
                  {Array.from({ length: 35 }).map((_, i) => (
                    <Skeleton key={i} className="h-24" />
                  ))}
                </div>
              </div>
            ) : (
              <>
                {viewMode === 'month' && (
                  <MonthView
                    currentDate={currentDate}
                    tasks={filteredTasks}
                    onTaskClick={handleTaskClick}
                    onDayClick={handleDayClick}
                  />
                )}
                {viewMode === 'week' && (
                  <WeekView
                    currentDate={currentDate}
                    tasks={filteredTasks}
                    onTaskClick={handleTaskClick}
                    onDayClick={handleDayClick}
                  />
                )}
                {viewMode === 'day' && (
                  <DayView
                    currentDate={currentDate}
                    tasks={filteredTasks}
                    onTaskClick={handleTaskClick}
                  />
                )}
              </>
            )}
          </div>

          <CalendarFilters
            filters={filters}
            onFiltersChange={setFilters}
          />
        </div>
      </div>

      <CreateTaskDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        defaultDate={selectedDate}
      />

      <TaskDetailDialog
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        task={selectedTask}
      />
    </DashboardLayout>
  );
}
