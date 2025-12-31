import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export interface DealTask {
  id: string;
  user_id: string;
  deal_id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  completed_at: string | null;
  priority: string;
  assigned_to?: string | null;
  created_at: string;
  updated_at: string;
}

// Helper to send notification
const sendTaskNotification = async (
  type: 'task_created' | 'task_assigned' | 'task_updated' | 'task_deleted',
  taskId: string,
  taskTitle: string,
  recipientUserId?: string | null
) => {
  try {
    await supabase.functions.invoke('send-whatsapp-notification', {
      body: {
        type,
        data: { taskId, taskTitle },
        recipientUserId,
      },
    });
    console.log(`[DEAL-TASK-NOTIFICATION] Sent ${type} notification for task ${taskId}`);
  } catch (error) {
    console.error(`[DEAL-TASK-NOTIFICATION] Failed to send ${type} notification:`, error);
  }
};

export const useDealTasks = (dealId?: string) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['deal-tasks', dealId],
    queryFn: async () => {
      if (!dealId) return [];
      
      const { data, error } = await supabase
        .from('deal_tasks')
        .select('*')
        .eq('deal_id', dealId)
        .order('due_date', { ascending: true, nullsFirst: false });

      if (error) throw error;
      return data as DealTask[];
    },
    enabled: !!dealId && !!user,
  });

  const createTask = useMutation({
    mutationFn: async (data: { 
      deal_id: string; 
      title: string; 
      description?: string;
      due_date?: string;
      priority?: string;
      assigned_to?: string | null;
    }) => {
      const { data: createdTask, error } = await supabase
        .from('deal_tasks')
        .insert({
          ...data,
          user_id: user!.id,
        })
        .select()
        .single();

      if (error) throw error;
      return createdTask;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['deal-tasks'] });
      toast.success('Tarefa criada');
      
      // Send notification
      if (data.assigned_to) {
        sendTaskNotification('task_assigned', data.id, data.title, data.assigned_to);
      } else {
        sendTaskNotification('task_created', data.id, data.title);
      }
    },
    onError: () => {
      toast.error('Erro ao criar tarefa');
    },
  });

  const updateTask = useMutation({
    mutationFn: async ({ id, ...data }: Partial<DealTask> & { id: string }) => {
      const { data: updatedTask, error } = await supabase
        .from('deal_tasks')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return updatedTask;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['deal-tasks'] });
      
      // Send notification
      if (data) {
        sendTaskNotification('task_updated', data.id, data.title, data.assigned_to);
      }
    },
  });

  const toggleComplete = useMutation({
    mutationFn: async ({ id, completed }: { id: string; completed: boolean }) => {
      const { error } = await supabase
        .from('deal_tasks')
        .update({ completed_at: completed ? new Date().toISOString() : null })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deal-tasks'] });
    },
  });

  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      // First fetch the task to get info for notification
      const { data: taskToDelete } = await supabase
        .from('deal_tasks')
        .select('id, title, assigned_to')
        .eq('id', id)
        .single();

      const { error } = await supabase
        .from('deal_tasks')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return taskToDelete;
    },
    onSuccess: (taskData) => {
      queryClient.invalidateQueries({ queryKey: ['deal-tasks'] });
      toast.success('Tarefa removida');
      
      // Send notification
      if (taskData) {
        sendTaskNotification('task_deleted', taskData.id, taskData.title, taskData.assigned_to);
      }
    },
  });

  const pendingTasks = tasks.filter(t => !t.completed_at);
  const overdueTasks = pendingTasks.filter(t => 
    t.due_date && new Date(t.due_date) < new Date()
  );
  
  // Next scheduled task (first pending task with due_date)
  const nextTask = pendingTasks.find(t => t.due_date) || null;

  return {
    tasks,
    isLoading,
    createTask,
    updateTask,
    toggleComplete,
    deleteTask,
    pendingTasks,
    overdueTasks,
    pendingCount: pendingTasks.length,
    overdueCount: overdueTasks.length,
    nextTask,
  };
};

// Hook para contar tarefas em atraso de todos os deals
export const useAllOverdueTasks = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['all-overdue-tasks'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('deal_tasks')
        .select('id')
        .is('completed_at', null)
        .lt('due_date', today);

      if (error) throw error;
      return data?.length || 0;
    },
    enabled: !!user,
  });
};
