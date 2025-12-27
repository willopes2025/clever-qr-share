import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useConversationTasks, ConversationTask } from "@/hooks/useConversationTasks";
import { useTaskTypes } from "@/hooks/useTaskTypes";
import { Plus, Calendar, Clock, Trash2, Pencil, CheckSquare, X, Check, ChevronDown, ChevronUp, User, Tag } from "lucide-react";
import { format, isPast, isToday, isTomorrow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { TaskTypeSelector } from "@/components/calendar/TaskTypeSelector";
import { AssigneeSelector } from "@/components/calendar/AssigneeSelector";

interface TasksTabProps {
  conversationId: string | null;
  contactId: string | null;
}

const priorityColors: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  normal: "bg-blue-500/10 text-blue-600",
  high: "bg-orange-500/10 text-orange-600",
  urgent: "bg-destructive/10 text-destructive",
};

const priorityLabels: Record<string, string> = {
  low: "Baixa",
  normal: "Normal",
  high: "Alta",
  urgent: "Urgente",
};

export const TasksTab = ({ conversationId, contactId }: TasksTabProps) => {
  const { pendingTasks, completedTasks, isLoading, createTask, updateTask, toggleComplete, deleteTask } = useConversationTasks(conversationId, contactId);
  const { taskTypes } = useTaskTypes();
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [newDueTime, setNewDueTime] = useState("");
  const [newPriority, setNewPriority] = useState("normal");
  const [newTaskTypeId, setNewTaskTypeId] = useState<string | null>(null);
  const [newAssignedTo, setNewAssignedTo] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTask, setEditTask] = useState<Partial<ConversationTask> & { task_type_id?: string | null; assigned_to?: string | null }>({});
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    await createTask.mutateAsync({
      title: newTitle.trim(),
      description: newDescription.trim() || undefined,
      due_date: newDueDate || undefined,
      due_time: newDueTime || undefined,
      priority: newPriority,
      task_type_id: newTaskTypeId,
      assigned_to: newAssignedTo,
    });
    resetForm();
  };

  const resetForm = () => {
    setNewTitle("");
    setNewDescription("");
    setNewDueDate("");
    setNewDueTime("");
    setNewPriority("normal");
    setNewTaskTypeId(null);
    setNewAssignedTo(null);
    setIsCreating(false);
  };

  const handleUpdate = async (id: string) => {
    await updateTask.mutateAsync({ id, ...editTask });
    setEditingId(null);
    setEditTask({});
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await deleteTask.mutateAsync(deleteId);
    setDeleteId(null);
  };

  const startEditing = (task: ConversationTask) => {
    setEditingId(task.id);
    setEditTask({
      title: task.title,
      description: task.description || "",
      due_date: task.due_date || "",
      due_time: task.due_time || "",
      priority: task.priority,
      task_type_id: (task as any).task_type_id || null,
      assigned_to: (task as any).assigned_to || null,
    });
  };

  const getTaskType = (typeId: string | null | undefined) => {
    if (!typeId) return null;
    return taskTypes.find(t => t.id === typeId);
  };

  const getDueDateLabel = (date: string) => {
    const d = new Date(date + 'T00:00:00');
    if (isToday(d)) return "Hoje";
    if (isTomorrow(d)) return "Amanhã";
    if (isPast(d)) return "Atrasada";
    return format(d, "dd MMM", { locale: ptBR });
  };

  const getDueDateColor = (date: string) => {
    const d = new Date(date + 'T00:00:00');
    if (isPast(d) && !isToday(d)) return "text-destructive";
    if (isToday(d)) return "text-orange-600";
    return "text-muted-foreground";
  };

  const renderTask = (task: ConversationTask) => {
    const isEditing = editingId === task.id;

    if (isEditing) {
      return (
        <div key={task.id} className="p-3 rounded-lg border bg-card space-y-3">
          <Input
            placeholder="Título da tarefa"
            value={editTask.title || ""}
            onChange={(e) => setEditTask({ ...editTask, title: e.target.value })}
            autoFocus
          />
          <Textarea
            placeholder="Descrição (opcional)"
            value={editTask.description || ""}
            onChange={(e) => setEditTask({ ...editTask, description: e.target.value })}
            className="min-h-[60px]"
          />
          <div className="grid grid-cols-2 gap-2">
            <Input
              type="date"
              value={editTask.due_date || ""}
              onChange={(e) => setEditTask({ ...editTask, due_date: e.target.value })}
            />
            <Input
              type="time"
              value={editTask.due_time || ""}
              onChange={(e) => setEditTask({ ...editTask, due_time: e.target.value })}
            />
          </div>
          <Select
            value={editTask.priority || "normal"}
            onValueChange={(value) => setEditTask({ ...editTask, priority: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Baixa</SelectItem>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="high">Alta</SelectItem>
              <SelectItem value="urgent">Urgente</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            <TaskTypeSelector
              value={editTask.task_type_id || null}
              onChange={(value) => setEditTask({ ...editTask, task_type_id: value })}
              compact
            />
            <AssigneeSelector
              value={editTask.assigned_to || null}
              onChange={(value) => setEditTask({ ...editTask, assigned_to: value })}
              compact
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
              <X className="h-4 w-4" />
            </Button>
            <Button size="sm" onClick={() => handleUpdate(task.id)} disabled={updateTask.isPending}>
              <Check className="h-4 w-4" />
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div
        key={task.id}
        className={cn(
          "p-3 rounded-lg border bg-card",
          task.completed_at && "opacity-60"
        )}
      >
        <div className="flex items-start gap-3">
          <Checkbox
            checked={!!task.completed_at}
            onCheckedChange={() => toggleComplete.mutate(task)}
            className="mt-0.5"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <p className={cn("font-medium", task.completed_at && "line-through")}>
                  {task.title}
                </p>
                {task.description && (
                  <p className="text-sm text-muted-foreground mt-1">{task.description}</p>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Badge className={priorityColors[task.priority]} variant="secondary">
                  {priorityLabels[task.priority]}
                </Badge>
              </div>
            </div>
            <div className="flex items-center gap-3 mt-2 text-xs flex-wrap">
              {task.due_date && (
                <span className={cn("flex items-center gap-1", getDueDateColor(task.due_date))}>
                  <Calendar className="h-3 w-3" />
                  {getDueDateLabel(task.due_date)}
                </span>
              )}
              {task.due_time && (
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {task.due_time.slice(0, 5)}
                </span>
              )}
              {getTaskType(task.task_type_id) && (
                <span 
                  className="flex items-center gap-1"
                  style={{ color: getTaskType(task.task_type_id)?.color }}
                >
                  <Tag className="h-3 w-3" />
                  {getTaskType(task.task_type_id)?.name}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            {!task.completed_at && (
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEditing(task)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-destructive hover:text-destructive"
              onClick={() => setDeleteId(task.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="p-4 border-b">
        {isCreating ? (
          <div className="space-y-3">
            <Input
              placeholder="Título da tarefa"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              autoFocus
            />
            <Textarea
              placeholder="Descrição (opcional)"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              className="min-h-[60px]"
            />
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="date"
                value={newDueDate}
                onChange={(e) => setNewDueDate(e.target.value)}
              />
              <Input
                type="time"
                value={newDueTime}
                onChange={(e) => setNewDueTime(e.target.value)}
              />
            </div>
            <Select value={newPriority} onValueChange={setNewPriority}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Baixa</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="high">Alta</SelectItem>
                <SelectItem value="urgent">Urgente</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <TaskTypeSelector
                value={newTaskTypeId}
                onChange={setNewTaskTypeId}
                compact
              />
              <AssigneeSelector
                value={newAssignedTo}
                onChange={setNewAssignedTo}
                compact
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="ghost" onClick={resetForm}>
                <X className="h-4 w-4 mr-1" />
                Cancelar
              </Button>
              <Button size="sm" onClick={handleCreate} disabled={!newTitle.trim() || createTask.isPending}>
                <Check className="h-4 w-4 mr-1" />
                Criar
              </Button>
            </div>
          </div>
        ) : (
          <Button onClick={() => setIsCreating(true)} className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            Nova Tarefa
          </Button>
        )}
      </div>

      <ScrollArea className="flex-1">
        {pendingTasks.length === 0 && completedTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-muted-foreground">
            <CheckSquare className="h-12 w-12 mb-2 opacity-50" />
            <p>Nenhuma tarefa ainda</p>
            <p className="text-sm">Crie tarefas para organizar o atendimento</p>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            {pendingTasks.map(renderTask)}
            
            {completedTasks.length > 0 && (
              <Collapsible open={showCompleted} onOpenChange={setShowCompleted}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full justify-between">
                    <span>Concluídas ({completedTasks.length})</span>
                    {showCompleted ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-3 mt-2">
                  {completedTasks.map(renderTask)}
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>
        )}
      </ScrollArea>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir tarefa?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
