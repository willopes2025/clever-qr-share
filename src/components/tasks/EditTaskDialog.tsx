import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AllTaskItem } from "@/hooks/useAllTasks";
import { Trash2 } from "lucide-react";

interface EditTaskDialogProps {
  task: AllTaskItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignees: { id: string; name: string }[];
}

export const EditTaskDialog = ({ task, open, onOpenChange, assignees }: EditTaskDialogProps) => {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("");
  const [priority, setPriority] = useState<string>("medium");
  const [assignedTo, setAssignedTo] = useState<string>("none");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (task) {
      setTitle(task.title || "");
      setDescription(task.description || "");
      setDueDate(task.due_date || "");
      setDueTime(task.due_time ? task.due_time.slice(0, 5) : "");
      setPriority(task.priority || "medium");
      setAssignedTo(task.assigned_to || "none");
    }
  }, [task]);

  if (!task) return null;
  const table = task.source === "deal" ? "deal_tasks" : "conversation_tasks";

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error("Título é obrigatório");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from(table)
      .update({
        title: title.trim(),
        description: description.trim() || null,
        due_date: dueDate || null,
        due_time: dueTime ? `${dueTime}:00` : null,
        priority,
        assigned_to: assignedTo === "none" ? null : assignedTo,
      } as any)
      .eq("id", task.id);
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar: " + error.message);
      return;
    }
    toast.success("Tarefa atualizada");
    queryClient.invalidateQueries({ queryKey: ["all-tasks"] });
    onOpenChange(false);
  };

  const handleDelete = async () => {
    if (!confirm("Excluir esta tarefa?")) return;
    setDeleting(true);
    const { error } = await supabase.from(table).delete().eq("id", task.id);
    setDeleting(false);
    if (error) {
      toast.error("Erro ao excluir: " + error.message);
      return;
    }
    toast.success("Tarefa excluída");
    queryClient.invalidateQueries({ queryKey: ["all-tasks"] });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar tarefa</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Título</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Descrição</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Data</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Hora</Label>
              <Input type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Prioridade</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">Alta</SelectItem>
                  <SelectItem value="medium">Média</SelectItem>
                  <SelectItem value="low">Baixa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Responsável</Label>
              <Select value={assignedTo} onValueChange={setAssignedTo}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem responsável</SelectItem>
                  {assignees.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter className="flex sm:justify-between gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            disabled={deleting || saving}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Excluir
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
