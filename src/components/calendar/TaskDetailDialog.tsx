import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CalendarTask } from "@/hooks/useCalendarTasks";
import { TaskTypeSelector } from "./TaskTypeSelector";
import { AssigneeSelector } from "./AssigneeSelector";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trash2, Check, X, Pencil, Calendar, Clock, User, Tag, MessageSquare } from "lucide-react";
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
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { parseDateOnly } from "@/lib/date-utils";

interface TaskDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: CalendarTask | null;
}

export function TaskDetailDialog({ open, onOpenChange, task }: TaskDetailDialogProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleGoToChat = () => {
    if (task?.conversation_id) {
      navigate(`/inbox?conversationId=${task.conversation_id}`);
      onOpenChange(false);
    }
  };

  const [editData, setEditData] = useState({
    title: "",
    description: "",
    due_date: "",
    due_time: "",
    task_type_id: null as string | null,
    assigned_to: null as string | null,
    priority: "normal",
  });

  useEffect(() => {
    if (task) {
      setEditData({
        title: task.title || "",
        description: task.description || "",
        due_date: task.due_date || "",
        due_time: task.due_time || "",
        task_type_id: task.task_type_id,
        assigned_to: task.assigned_to,
        priority: task.priority || "normal",
      });
      setIsEditing(false);
    }
  }, [task]);

  const handleSave = async () => {
    if (!task) return;
    setIsSaving(true);

    try {
      const table = task.source === 'conversation' ? 'conversation_tasks' : 'deal_tasks';
      const { error } = await supabase
        .from(table)
        .update({
          title: editData.title,
          description: editData.description || null,
          due_date: editData.due_date || null,
          due_time: editData.due_time || null,
          task_type_id: editData.task_type_id,
          assigned_to: editData.assigned_to,
          priority: editData.priority,
        })
        .eq('id', task.id);

      if (error) throw error;

      toast.success("Tarefa atualizada");
      queryClient.invalidateQueries({ queryKey: ['calendar-tasks'] });
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating task:', error);
      toast.error("Erro ao atualizar tarefa");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleComplete = async () => {
    if (!task) return;

    try {
      const table = task.source === 'conversation' ? 'conversation_tasks' : 'deal_tasks';
      const { error } = await supabase
        .from(table)
        .update({
          completed_at: task.completed_at ? null : new Date().toISOString(),
        })
        .eq('id', task.id);

      if (error) throw error;

      toast.success(task.completed_at ? "Tarefa reaberta" : "Tarefa concluída");
      queryClient.invalidateQueries({ queryKey: ['calendar-tasks'] });
    } catch (error) {
      console.error('Error toggling task:', error);
      toast.error("Erro ao atualizar tarefa");
    }
  };

  const handleDelete = async () => {
    if (!task) return;

    try {
      const table = task.source === 'conversation' ? 'conversation_tasks' : 'deal_tasks';
      const { error } = await supabase
        .from(table)
        .delete()
        .eq('id', task.id);

      if (error) throw error;

      toast.success("Tarefa excluída");
      queryClient.invalidateQueries({ queryKey: ['calendar-tasks'] });
      onOpenChange(false);
    } catch (error) {
      console.error('Error deleting task:', error);
      toast.error("Erro ao excluir tarefa");
    }
  };

  if (!task) return null;

  const typeColor = task.task_type?.color || '#6B7280';

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: typeColor }}
              />
              {isEditing ? "Editar Tarefa" : "Detalhes da Tarefa"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {isEditing ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="title">Título</Label>
                  <Input
                    id="title"
                    value={editData.title}
                    onChange={(e) => setEditData({ ...editData, title: e.target.value })}
                    placeholder="Título da tarefa"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea
                    id="description"
                    value={editData.description}
                    onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                    placeholder="Descrição (opcional)"
                    className="min-h-[80px]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="due_date">Data</Label>
                    <Input
                      id="due_date"
                      type="date"
                      value={editData.due_date}
                      onChange={(e) => setEditData({ ...editData, due_date: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="due_time">Hora</Label>
                    <Input
                      id="due_time"
                      type="time"
                      value={editData.due_time}
                      onChange={(e) => setEditData({ ...editData, due_time: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Tipo de Tarefa</Label>
                  <TaskTypeSelector
                    value={editData.task_type_id}
                    onChange={(value) => setEditData({ ...editData, task_type_id: value })}
                    compact
                  />
                </div>

                <div className="space-y-2">
                  <Label>Responsável</Label>
                  <AssigneeSelector
                    value={editData.assigned_to}
                    onChange={(value) => setEditData({ ...editData, assigned_to: value })}
                    compact
                  />
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="ghost" onClick={() => setIsEditing(false)}>
                    <X className="h-4 w-4 mr-1" />
                    Cancelar
                  </Button>
                  <Button onClick={handleSave} disabled={isSaving || !editData.title.trim()}>
                    <Check className="h-4 w-4 mr-1" />
                    Salvar
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div>
                  <h3 className={`text-lg font-medium ${task.completed_at ? 'line-through text-muted-foreground' : ''}`}>
                    {task.title}
                  </h3>
                  {task.description && (
                    <p className="text-muted-foreground mt-1">{task.description}</p>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  {task.due_date && (
                    <Badge variant="secondary" className="gap-1">
                      <Calendar className="h-3 w-3" />
                      {format(parseDateOnly(task.due_date), "dd 'de' MMMM", { locale: ptBR })}
                    </Badge>
                  )}
                  {task.due_time && (
                    <Badge variant="secondary" className="gap-1">
                      <Clock className="h-3 w-3" />
                      {task.due_time.slice(0, 5)}
                    </Badge>
                  )}
                  {task.task_type && (
                    <Badge 
                      variant="outline"
                      style={{ borderColor: task.task_type.color, color: task.task_type.color }}
                    >
                      <Tag className="h-3 w-3 mr-1" />
                      {task.task_type.name}
                    </Badge>
                  )}
                  {task.completed_at && (
                    <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
                      <Check className="h-3 w-3 mr-1" />
                      Concluída
                    </Badge>
                  )}
                </div>

                {task.assignee && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <User className="h-4 w-4" />
                    Responsável: {task.assignee.full_name || 'Sem nome'}
                  </div>
                )}

                {(task.contact_name || task.deal_title) && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    {task.source === 'conversation' && task.conversation_id ? (
                      <>
                        <MessageSquare className="h-4 w-4" />
                        Contato:{' '}
                        <button
                          onClick={handleGoToChat}
                          className="font-medium text-primary hover:underline cursor-pointer flex items-center gap-1"
                        >
                          {task.contact_name}
                        </button>
                      </>
                    ) : (
                      <>
                        Negócio: <span className="font-medium">{task.deal_title}</span>
                      </>
                    )}
                  </div>
                )}

                <div className="flex justify-between items-center pt-4 border-t">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setIsDeleting(true)}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Excluir
                  </Button>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleToggleComplete}
                    >
                      {task.completed_at ? (
                        <>
                          <X className="h-4 w-4 mr-1" />
                          Reabrir
                        </>
                      ) : (
                        <>
                          <Check className="h-4 w-4 mr-1" />
                          Concluir
                        </>
                      )}
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => setIsEditing(true)}
                    >
                      <Pencil className="h-4 w-4 mr-1" />
                      Editar
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleting} onOpenChange={setIsDeleting}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir tarefa?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
