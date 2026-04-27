import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useAllTasks, AllTaskItem } from "@/hooks/useAllTasks";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckCircle2, Circle, Calendar, AlertTriangle, Filter, ListTodo, CheckSquare, ExternalLink, Phone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { EditTaskDialog } from "@/components/tasks/EditTaskDialog";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { Pencil } from "lucide-react";

const priorityColors: Record<string, string> = {
  high: "text-destructive",
  medium: "text-amber-500",
  low: "text-muted-foreground",
};

const priorityLabels: Record<string, string> = {
  high: "Alta",
  medium: "Média",
  low: "Baixa",
};

const Tasks = () => {
  const { tasks, pendingTasks, completedTasks, isLoading, isOrgAdmin, assigneeIds } = useAllTasks();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "overdue" | "completed">("pending");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");

  // Completion dialog state
  const [completingTask, setCompletingTask] = useState<AllTaskItem | null>(null);
  const [completionNotes, setCompletionNotes] = useState("");

  // Edit dialog state
  const [editingTask, setEditingTask] = useState<AllTaskItem | null>(null);

  // Fetch team members for assignee picker
  const { members } = useTeamMembers();
  const allAssignees = useMemo(
    () =>
      (members || [])
        .filter((m: any) => m.user_id)
        .map((m: any) => ({
          id: m.user_id as string,
          name: (m.profile?.full_name as string) || (m.email as string) || "Sem nome",
        })),
    [members]
  );

  // Fetch profiles for assignee names (display in table)
  const { data: profiles = [] } = useQuery({
    queryKey: ['task-profiles', assigneeIds],
    queryFn: async () => {
      if (assigneeIds.length === 0) return [];
      const { data } = await supabase.from('profiles').select('id, full_name').in('id', assigneeIds);
      return data || [];
    },
    enabled: assigneeIds.length > 0,
  });

  const profileMap = useMemo(() => {
    const map = new Map(profiles.map(p => [p.id, p.full_name || 'Sem nome']));
    // Fallback to team members if profile not found
    allAssignees.forEach(a => { if (!map.has(a.id)) map.set(a.id, a.name); });
    return map;
  }, [profiles, allAssignees]);

  const isOverdue = (task: AllTaskItem) => {
    if (task.completed_at || !task.due_date) return false;
    return new Date(task.due_date + 'T00:00:00') < new Date(new Date().toDateString());
  };

  const filteredTasks = useMemo(() => {
    let result = tasks;
    if (statusFilter === "pending") result = result.filter(t => !t.completed_at);
    if (statusFilter === "overdue") result = result.filter(t => isOverdue(t));
    if (statusFilter === "completed") result = result.filter(t => !!t.completed_at);
    if (priorityFilter !== "all") result = result.filter(t => (t.priority || 'medium') === priorityFilter);
    if (assigneeFilter !== "all") result = result.filter(t => t.assigned_to === assigneeFilter);
    return result;
  }, [tasks, statusFilter, priorityFilter, assigneeFilter]);

  const overdueTasks = useMemo(() => tasks.filter(t => isOverdue(t)), [tasks]);

  const handleToggleComplete = (task: AllTaskItem) => {
    if (task.completed_at) {
      // Reopen task directly
      reopenTask(task);
    } else {
      // Open completion dialog
      setCompletingTask(task);
      setCompletionNotes("");
    }
  };

  const reopenTask = async (task: AllTaskItem) => {
    const table = task.source === 'deal' ? 'deal_tasks' : 'conversation_tasks';
    const { error } = await supabase
      .from(table)
      .update({ completed_at: null } as any)
      .eq('id', task.id);
    if (error) {
      toast.error('Erro ao reabrir tarefa');
    } else {
      toast.success('Tarefa reaberta');
      queryClient.invalidateQueries({ queryKey: ['all-tasks'] });
    }
  };

  const confirmCompletion = async () => {
    if (!completingTask) return;
    const table = completingTask.source === 'deal' ? 'deal_tasks' : 'conversation_tasks';
    const { error } = await supabase
      .from(table)
      .update({ completed_at: new Date().toISOString() } as any)
      .eq('id', completingTask.id);
    if (error) {
      toast.error('Erro ao concluir tarefa');
    } else {
      toast.success('Tarefa concluída');
      queryClient.invalidateQueries({ queryKey: ['all-tasks'] });
    }
    setCompletingTask(null);
    setCompletionNotes("");
  };

  const navigateToOrigin = (task: AllTaskItem) => {
    if (task.conversation_id) {
      navigate(`/inbox?conversationId=${task.conversation_id}`);
    } else if (task.contact_id) {
      navigate(`/inbox?contactId=${task.contact_id}`);
    }
  };

  const getStatusBadge = (task: AllTaskItem) => {
    if (task.completed_at) {
      return <Badge className="text-xs bg-primary/10 text-primary border-primary/20">Concluída</Badge>;
    }
    if (isOverdue(task)) {
      return <Badge variant="destructive" className="text-xs">Atrasada</Badge>;
    }
    return <Badge variant="secondary" className="text-xs">Pendente</Badge>;
  };

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Tarefas</h1>
            <p className="text-muted-foreground text-sm">
              {isOrgAdmin ? 'Todas as tarefas da organização' : 'Suas tarefas'}
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ListTodo className="h-4 w-4" />
            <span>{pendingTasks.length} pendentes</span>
            {overdueTasks.length > 0 && (
              <>
                <AlertTriangle className="h-4 w-4 ml-2 text-destructive" />
                <span className="text-destructive">{overdueTasks.length} atrasadas</span>
              </>
            )}
            <CheckSquare className="h-4 w-4 ml-2" />
            <span>{completedTasks.length} concluídas</span>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
            <SelectTrigger className="w-[160px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="pending">Pendentes</SelectItem>
              <SelectItem value="overdue">Atrasadas</SelectItem>
              <SelectItem value="completed">Concluídas</SelectItem>
            </SelectContent>
          </Select>

          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Prioridade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="high">Alta</SelectItem>
              <SelectItem value="medium">Média</SelectItem>
              <SelectItem value="low">Baixa</SelectItem>
            </SelectContent>
          </Select>

          {isOrgAdmin && assigneeIds.length > 0 && (
            <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Responsável" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {assigneeIds.map(id => (
                  <SelectItem key={id} value={id}>{profileMap.get(id) || 'Sem nome'}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Table */}
        <div className="border rounded-xl overflow-hidden bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"></TableHead>
                <TableHead className="w-[80px]">Código</TableHead>
                <TableHead>Lead</TableHead>
                <TableHead>Título</TableHead>
                <TableHead>Prioridade</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                    Carregando tarefas...
                  </TableCell>
                </TableRow>
              ) : filteredTasks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                    Nenhuma tarefa encontrada
                  </TableCell>
                </TableRow>
              ) : filteredTasks.map(task => (
                <TableRow
                  key={`${task.source}-${task.id}`}
                  className={cn("group cursor-pointer hover:bg-muted/40", task.completed_at && "opacity-60")}
                  onClick={() => setEditingTask(task)}
                >
                  <TableCell>
                    <button onClick={(e) => { e.stopPropagation(); handleToggleComplete(task); }} className="hover:scale-110 transition-transform">
                      {task.completed_at ? (
                        <CheckCircle2 className="h-5 w-5 text-primary" />
                      ) : (
                        <Circle className="h-5 w-5 text-muted-foreground" />
                      )}
                    </button>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs font-mono text-muted-foreground">
                      {task.contact_display_id || '—'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-0.5">
                      <span className="text-sm font-medium block">{task.contact_name || '—'}</span>
                      {task.contact_phone && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {task.contact_phone}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={cn("font-medium", task.completed_at && "line-through text-muted-foreground")}>
                      {task.title}
                    </span>
                    {task.description && (
                      <p className="text-xs text-muted-foreground truncate max-w-[300px]">{task.description}</p>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className={cn("text-sm font-medium", priorityColors[task.priority || 'medium'])}>
                      {priorityLabels[task.priority || 'medium']}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm">
                    {task.assigned_to ? profileMap.get(task.assigned_to) || '—' : '—'}
                  </TableCell>
                  <TableCell>
                    {task.due_date ? (
                      <div className={cn("flex items-center gap-1 text-sm", isOverdue(task) && "text-destructive")}>
                        {isOverdue(task) && <AlertTriangle className="h-3 w-3" />}
                        <Calendar className="h-3 w-3" />
                        {format(new Date(task.due_date + 'T00:00:00'), "dd/MM/yyyy", { locale: ptBR })}
                        {task.due_time && <span className="text-xs text-muted-foreground ml-1">{task.due_time.slice(0, 5)}</span>}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {(task.conversation_id || task.contact_id) ? (
                      <button
                        onClick={(e) => { e.stopPropagation(); navigateToOrigin(task); }}
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" />
                        {task.source === 'deal' ? (task.deal_title ? `Deal: ${task.deal_title}` : 'Deal') : 'Conversa'}
                      </button>
                    ) : (
                      <Badge variant="outline" className="text-xs">
                        {task.source === 'deal' ? (task.deal_title ? `Deal: ${task.deal_title}` : 'Deal') : 'Conversa'}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(task)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Completion Dialog */}
      <Dialog open={!!completingTask} onOpenChange={(open) => { if (!open) setCompletingTask(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Concluir tarefa</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Tarefa: <span className="font-medium text-foreground">{completingTask?.title}</span>
            </p>
            <Textarea
              placeholder="O que foi feito? (opcional)"
              value={completionNotes}
              onChange={(e) => setCompletionNotes(e.target.value)}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompletingTask(null)}>Cancelar</Button>
            <Button onClick={confirmCompletion}>Concluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default Tasks;
