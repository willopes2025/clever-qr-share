import { useState } from "react";
import { Plus, Check, Calendar, Trash2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useDealTasks, DealTask } from "@/hooks/useDealTasks";
import { cn } from "@/lib/utils";

interface DealTasksSectionProps {
  dealId: string;
}

export const DealTasksSection = ({ dealId }: DealTasksSectionProps) => {
  const { tasks, createTask, toggleComplete, deleteTask, isLoading } = useDealTasks(dealId);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDueDate, setNewTaskDueDate] = useState("");

  const handleAddTask = () => {
    if (!newTaskTitle.trim()) return;
    
    createTask.mutate({
      deal_id: dealId,
      title: newTaskTitle.trim(),
      due_date: newTaskDueDate || undefined,
    });
    
    setNewTaskTitle("");
    setNewTaskDueDate("");
  };

  const isOverdue = (task: DealTask) => {
    if (!task.due_date || task.completed_at) return false;
    return new Date(task.due_date) < new Date();
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('pt-BR', { 
      day: '2-digit', 
      month: 'short' 
    });
  };

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Carregando tarefas...</div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Input
          placeholder="Nova tarefa..."
          value={newTaskTitle}
          onChange={(e) => setNewTaskTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
          className="h-8 text-sm"
        />
        <Input
          type="date"
          value={newTaskDueDate}
          onChange={(e) => setNewTaskDueDate(e.target.value)}
          className="h-8 text-sm w-32"
        />
        <Button 
          size="sm" 
          onClick={handleAddTask}
          disabled={!newTaskTitle.trim() || createTask.isPending}
          className="h-8 px-2"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-1.5 max-h-48 overflow-y-auto">
        {tasks.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-2">
            Nenhuma tarefa
          </p>
        ) : (
          tasks.map((task) => (
            <div 
              key={task.id}
              className={cn(
                "flex items-center gap-2 p-2 rounded-md border group",
                task.completed_at && "bg-muted/50",
                isOverdue(task) && !task.completed_at && "border-destructive/50 bg-destructive/5"
              )}
            >
              <Checkbox
                checked={!!task.completed_at}
                onCheckedChange={(checked) => 
                  toggleComplete.mutate({ id: task.id, completed: !!checked })
                }
              />
              
              <div className="flex-1 min-w-0">
                <p className={cn(
                  "text-sm truncate",
                  task.completed_at && "line-through text-muted-foreground"
                )}>
                  {task.title}
                </p>
              </div>

              {task.due_date && (
                <Badge 
                  variant={isOverdue(task) ? "destructive" : "secondary"}
                  className="text-[10px] h-5 shrink-0"
                >
                  {isOverdue(task) && <AlertCircle className="h-3 w-3 mr-0.5" />}
                  <Calendar className="h-3 w-3 mr-0.5" />
                  {formatDate(task.due_date)}
                </Badge>
              )}

              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 shrink-0"
                onClick={() => deleteTask.mutate(task.id)}
              >
                <Trash2 className="h-3 w-3 text-destructive" />
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
