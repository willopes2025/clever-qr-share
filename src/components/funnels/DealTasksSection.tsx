import { useState } from "react";
import { Plus, Calendar, Trash2, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  const [newTaskDescription, setNewTaskDescription] = useState("");
  const [newTaskDueDate, setNewTaskDueDate] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [expandedTask, setExpandedTask] = useState<string | null>(null);

  const handleAddTask = () => {
    if (!newTaskTitle.trim()) return;
    
    createTask.mutate({
      deal_id: dealId,
      title: newTaskTitle.trim(),
      description: newTaskDescription.trim() || undefined,
      due_date: newTaskDueDate || undefined,
    });
    
    setNewTaskTitle("");
    setNewTaskDescription("");
    setNewTaskDueDate("");
    setShowAddForm(false);
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
      {/* Add Task Form */}
      {showAddForm ? (
        <div className="space-y-2 p-2 border rounded-md bg-background">
          <Input
            placeholder="Título da tarefa..."
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            className="h-8 text-sm"
            autoFocus
          />
          <Textarea
            placeholder="Descrição (opcional)..."
            value={newTaskDescription}
            onChange={(e) => setNewTaskDescription(e.target.value)}
            className="min-h-[60px] text-sm resize-none"
          />
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={newTaskDueDate}
              onChange={(e) => setNewTaskDueDate(e.target.value)}
              className="h-8 text-sm flex-1"
              placeholder="Data de vencimento"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => {
                setShowAddForm(false);
                setNewTaskTitle("");
                setNewTaskDescription("");
                setNewTaskDueDate("");
              }}
            >
              Cancelar
            </Button>
            <Button 
              size="sm" 
              onClick={handleAddTask}
              disabled={!newTaskTitle.trim() || createTask.isPending}
            >
              <Plus className="h-4 w-4 mr-1" />
              Adicionar
            </Button>
          </div>
        </div>
      ) : (
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => setShowAddForm(true)}
          className="w-full h-8 text-xs"
        >
          <Plus className="h-3 w-3 mr-1" />
          Nova Tarefa
        </Button>
      )}

      {/* Tasks List */}
      <div className="space-y-1.5 max-h-64 overflow-y-auto">
        {tasks.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-2">
            Nenhuma tarefa
          </p>
        ) : (
          tasks.map((task) => (
            <div 
              key={task.id}
              className={cn(
                "p-2 rounded-md border group",
                task.completed_at && "bg-muted/50",
                isOverdue(task) && !task.completed_at && "border-destructive/50 bg-destructive/5"
              )}
            >
              <div className="flex items-start gap-2">
                <Checkbox
                  checked={!!task.completed_at}
                  onCheckedChange={(checked) => 
                    toggleComplete.mutate({ id: task.id, completed: !!checked })
                  }
                  className="mt-0.5"
                />
                
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    "text-sm",
                    task.completed_at && "line-through text-muted-foreground"
                  )}>
                    {task.title}
                  </p>
                  
                  {/* Description preview or expanded */}
                  {task.description && (
                    <div className="mt-1">
                      {expandedTask === task.id ? (
                        <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                          {task.description}
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground truncate">
                          {task.description}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {task.description && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5"
                      onClick={() => setExpandedTask(expandedTask === task.id ? null : task.id)}
                    >
                      {expandedTask === task.id ? (
                        <ChevronUp className="h-3 w-3" />
                      ) : (
                        <ChevronDown className="h-3 w-3" />
                      )}
                    </Button>
                  )}
                  
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 opacity-0 group-hover:opacity-100"
                    onClick={() => deleteTask.mutate(task.id)}
                  >
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              </div>

              {task.due_date && (
                <div className="mt-1.5 ml-6">
                  <Badge 
                    variant={isOverdue(task) ? "destructive" : "secondary"}
                    className="text-[10px] h-5"
                  >
                    {isOverdue(task) && <AlertCircle className="h-3 w-3 mr-0.5" />}
                    <Calendar className="h-3 w-3 mr-0.5" />
                    {formatDate(task.due_date)}
                  </Badge>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
