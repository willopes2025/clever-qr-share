import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useAllTasks } from "@/hooks/useAllTasks";
import { UnifiedTask } from "@/hooks/useUnifiedTasks";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckCircle2, Circle, Calendar, AlertTriangle, Filter, ListTodo, CheckSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";

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
  const { tasks, pendingTasks, completedTasks, isLoading, isOrgAdmin } = useAllTasks();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "completed">("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");

  // Fetch profiles for assignee names
  const assigneeIds = useMemo(() => {
    const ids = new Set<string>();
    tasks.forEach(t => {
      if (t.assigned_to) ids.add(t.assigned_to);
      if (t.user_id) ids.add(t.user_id);
    });
    return [...ids];
  }, [tasks]);

  const { data: profiles = [] } = useQuery({
    queryKey: ['task-profiles', assigneeIds],
    queryFn: async () => {
      if (assigneeIds.length === 0) return [];
      const { data } = await supabase.from('profiles').select('id, full_name').in('id', assigneeIds);
      return data || [];
    },
    enabled: assigneeIds.length > 0,
  });

  const profileMap = useMemo(() => new Map(profiles.map(p => [p.id, p.full_name || 'Sem nome'])), [profiles]);

  const filteredTasks = useMemo(() => {
    let result = tasks;
    if (statusFilter === "pending") result = result.filter(t => !t.completed_at);
    if (statusFilter === "completed") result = result.filter(t => !!t.completed_at);
    if (priorityFilter !== "all") result = result.filter(t => (t.priority || 'medium') === priorityFilter);
    if (assigneeFilter !== "all") result = result.filter(t => t.assigned_to === assigneeFilter || t.user_id === assigneeFilter);
    return result;
  }, [tasks, statusFilter, priorityFilter, assigneeFilter]);

  const toggleComplete = async (task: UnifiedTask) => {
    const table = task.source === 'deal' ? 'deal_tasks' : 'conversation_tasks';
    const { error } = await supabase
      .from(table)
      .update({ completed_at: task.completed_at ? null : new Date().toISOString() })
      .eq('id', task.id);
    if (error) {
      toast.error('Erro ao atualizar tarefa');
    } else {
      toast.success(task.completed_at ? 'Tarefa reaberta' : 'Tarefa concluída');
      queryClient.invalidateQueries({ queryKey: ['all-tasks'] });
    }
  };

  const isOverdue = (task: UnifiedTask) => {
    if (task.completed_at || !task.due_date) return false;
    return new Date(task.due_date) < new Date(new Date().toDateString());
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
                <TableHead>Título</TableHead>
                <TableHead>Prioridade</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Carregando tarefas...
                  </TableCell>
                </TableRow>
              ) : filteredTasks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Nenhuma tarefa encontrada
                  </TableCell>
                </TableRow>
              ) : filteredTasks.map(task => (
                <TableRow key={`${task.source}-${task.id}`} className={cn(task.completed_at && "opacity-60")}>
                  <TableCell>
                    <button onClick={() => toggleComplete(task)} className="hover:scale-110 transition-transform">
                      {task.completed_at ? (
                        <CheckCircle2 className="h-5 w-5 text-primary" />
                      ) : (
                        <Circle className="h-5 w-5 text-muted-foreground" />
                      )}
                    </button>
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
                    {task.assigned_to ? profileMap.get(task.assigned_to) || '—' : profileMap.get(task.user_id) || '—'}
                  </TableCell>
                  <TableCell>
                    {task.due_date ? (
                      <div className={cn("flex items-center gap-1 text-sm", isOverdue(task) && "text-destructive")}>
                        {isOverdue(task) && <AlertTriangle className="h-3 w-3" />}
                        <Calendar className="h-3 w-3" />
                        {format(new Date(task.due_date), "dd/MM/yyyy", { locale: ptBR })}
                        {task.due_time && <span className="text-xs text-muted-foreground ml-1">{task.due_time.slice(0, 5)}</span>}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {task.source === 'deal' ? (task.deal_title ? `Deal: ${task.deal_title}` : 'Deal') : 'Conversa'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={task.completed_at ? "default" : "secondary"} className="text-xs">
                      {task.completed_at ? 'Concluída' : 'Pendente'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Tasks;
