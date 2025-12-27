import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { TaskTypeSelector } from "./TaskTypeSelector";
import { AssigneeSelector } from "./AssigneeSelector";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useGoogleCalendar } from "@/hooks/useGoogleCalendar";

interface CreateTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDate?: Date;
}

export function CreateTaskDialog({ open, onOpenChange, defaultDate }: CreateTaskDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { isConnected, syncTaskToGoogle } = useGoogleCalendar();

  const [isLoading, setIsLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState<Date | undefined>(defaultDate || new Date());
  const [dueTime, setDueTime] = useState("");
  const [priority, setPriority] = useState<string>("normal");
  const [taskTypeId, setTaskTypeId] = useState<string | null>(null);
  const [assignedTo, setAssignedTo] = useState<string | null>(null);
  const [syncWithGoogle, setSyncWithGoogle] = useState(false);

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setDueDate(defaultDate || new Date());
    setDueTime("");
    setPriority("normal");
    setTaskTypeId(null);
    setAssignedTo(null);
    setSyncWithGoogle(false);
  };

  const handleCreate = async () => {
    if (!title.trim() || !user?.id) return;

    setIsLoading(true);
    try {
      const taskData = {
        user_id: user.id,
        title: title.trim(),
        description: description.trim() || null,
        due_date: dueDate ? format(dueDate, 'yyyy-MM-dd') : null,
        due_time: dueTime || null,
        priority,
        task_type_id: taskTypeId,
        assigned_to: assignedTo,
        sync_with_google: syncWithGoogle,
      };

      const { data, error } = await supabase
        .from('conversation_tasks')
        .insert(taskData)
        .select()
        .single();

      if (error) throw error;

      // Sincronizar com Google se solicitado
      if (syncWithGoogle && isConnected && data && dueDate) {
        await syncTaskToGoogle.mutateAsync({
          id: data.id,
          title: title.trim(),
          description: description.trim(),
          due_date: format(dueDate, 'yyyy-MM-dd'),
          due_time: dueTime || undefined,
          source: 'conversation',
        });
      }

      queryClient.invalidateQueries({ queryKey: ['calendar-tasks'] });
      toast.success('Tarefa criada com sucesso');
      resetForm();
      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao criar tarefa:', error);
      toast.error('Erro ao criar tarefa');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Nova Tarefa</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          {/* Tipo de tarefa */}
          <div className="space-y-2">
            <Label>Tipo de tarefa</Label>
            <TaskTypeSelector value={taskTypeId} onChange={setTaskTypeId} />
          </div>

          {/* Título */}
          <div className="space-y-2">
            <Label htmlFor="title">Título *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Ligar para cliente"
            />
          </div>

          {/* Descrição */}
          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detalhes da tarefa..."
              rows={3}
            />
          </div>

          {/* Data e hora */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Data</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dueDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dueDate ? format(dueDate, "dd/MM/yyyy") : "Selecionar"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dueDate}
                    onSelect={setDueDate}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label htmlFor="time">Horário</Label>
              <Input
                id="time"
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
              />
            </div>
          </div>

          {/* Prioridade */}
          <div className="space-y-2">
            <Label>Prioridade</Label>
            <Select value={priority} onValueChange={setPriority}>
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
          </div>

          {/* Atribuir para */}
          <div className="space-y-2">
            <Label>Atribuir para</Label>
            <AssigneeSelector value={assignedTo} onChange={setAssignedTo} />
          </div>

          {/* Sincronizar com Google */}
          {isConnected && (
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Sincronizar com Google Calendar</Label>
                <p className="text-sm text-muted-foreground">
                  Adicionar esta tarefa ao seu Google Calendar
                </p>
              </div>
              <Switch
                checked={syncWithGoogle}
                onCheckedChange={setSyncWithGoogle}
              />
            </div>
          )}

          {/* Botões */}
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={!title.trim() || isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Criar Tarefa
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
