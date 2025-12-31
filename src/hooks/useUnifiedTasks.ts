import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export interface UnifiedTask {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  due_time: string | null;
  priority: string;
  completed_at: string | null;
  task_type_id: string | null;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
  // Source info
  source: 'conversation' | 'deal';
  conversation_id?: string | null;
  contact_id?: string | null;
  deal_id?: string | null;
  deal_title?: string | null;
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
  } catch (error) {
    console.error(`[TASK-NOTIFICATION] Failed to send ${type} notification:`, error);
  }
};

interface UseUnifiedTasksParams {
  conversationId?: string | null;
  contactId?: string | null;
  dealId?: string | null;
}

export const useUnifiedTasks = ({ conversationId, contactId, dealId }: UseUnifiedTasksParams) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['unified-tasks', conversationId, contactId, dealId],
    queryFn: async () => {
      if (!conversationId && !contactId && !dealId) return [];
      
      const allTasks: UnifiedTask[] = [];

      // 1. Fetch conversation tasks
      if (conversationId || contactId) {
        let conversationQuery = supabase
          .from('conversation_tasks')
          .select('*');

        if (conversationId) {
          conversationQuery = conversationQuery.eq('conversation_id', conversationId);
        } else if (contactId) {
          conversationQuery = conversationQuery.eq('contact_id', contactId);
        }

        const { data: conversationTasks, error: convError } = await conversationQuery;
        if (convError) throw convError;

        allTasks.push(...(conversationTasks || []).map(t => ({
          ...t,
          source: 'conversation' as const,
          due_time: t.due_time || null,
          task_type_id: t.task_type_id || null,
          assigned_to: t.assigned_to || null,
        })));
      }

      // 2. If we have a contactId, find associated deals and fetch their tasks
      if (contactId) {
        const { data: deals } = await supabase
          .from('funnel_deals')
          .select('id, title')
          .eq('contact_id', contactId);

        if (deals && deals.length > 0) {
          const dealIds = deals.map(d => d.id);
          const { data: dealTasks, error: dealError } = await supabase
            .from('deal_tasks')
            .select('*')
            .in('deal_id', dealIds);

          if (dealError) throw dealError;

          allTasks.push(...(dealTasks || []).map(t => {
            const deal = deals.find(d => d.id === t.deal_id);
            return {
              ...t,
              source: 'deal' as const,
              due_time: t.due_time || null,
              task_type_id: t.task_type_id || null,
              assigned_to: t.assigned_to || null,
              deal_title: deal?.title || null,
            };
          }));
        }
      }

      // 3. If we have a dealId, fetch deal tasks and also conversation tasks for the contact
      if (dealId) {
        // Fetch deal info to get contact_id
        const { data: deal } = await supabase
          .from('funnel_deals')
          .select('id, title, contact_id')
          .eq('id', dealId)
          .single();

        if (deal) {
          // Fetch deal tasks
          const { data: dealTasks, error: dealError } = await supabase
            .from('deal_tasks')
            .select('*')
            .eq('deal_id', dealId);

          if (dealError) throw dealError;

          allTasks.push(...(dealTasks || []).map(t => ({
            ...t,
            source: 'deal' as const,
            due_time: t.due_time || null,
            task_type_id: t.task_type_id || null,
            assigned_to: t.assigned_to || null,
            deal_title: deal.title,
          })));

          // Fetch conversation tasks for the contact
          if (deal.contact_id) {
            const { data: conversationTasks, error: convError } = await supabase
              .from('conversation_tasks')
              .select('*')
              .eq('contact_id', deal.contact_id);

            if (convError) throw convError;

            allTasks.push(...(conversationTasks || []).map(t => ({
              ...t,
              source: 'conversation' as const,
              due_time: t.due_time || null,
              task_type_id: t.task_type_id || null,
              assigned_to: t.assigned_to || null,
            })));
          }
        }
      }

      // Sort: pending first, then by due_date, then by created_at
      return allTasks.sort((a, b) => {
        // Completed last
        if (a.completed_at && !b.completed_at) return 1;
        if (!a.completed_at && b.completed_at) return -1;
        
        // Then by due_date
        if (a.due_date && b.due_date) {
          return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
        }
        if (a.due_date) return -1;
        if (b.due_date) return 1;
        
        // Then by created_at
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    },
    enabled: !!(conversationId || contactId || dealId) && !!user,
  });

  const pendingTasks = tasks.filter(t => !t.completed_at);
  const completedTasks = tasks.filter(t => t.completed_at);

  const invalidateQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['unified-tasks'] });
    queryClient.invalidateQueries({ queryKey: ['conversation-tasks'] });
    queryClient.invalidateQueries({ queryKey: ['deal-tasks'] });
    queryClient.invalidateQueries({ queryKey: ['calendar-tasks'] });
  };

  const createTask = useMutation({
    mutationFn: async (taskData: {
      title: string;
      description?: string;
      due_date?: string;
      due_time?: string;
      priority?: string;
      task_type_id?: string | null;
      assigned_to?: string | null;
      source: 'conversation' | 'deal';
    }) => {
      if (!user) throw new Error('Usuário não autenticado');

      const { source, ...rest } = taskData;

      if (source === 'deal' && dealId) {
        const { data, error } = await supabase
          .from('deal_tasks')
          .insert({
            user_id: user.id,
            deal_id: dealId,
            ...rest,
          })
          .select()
          .single();
        if (error) throw error;
        return { ...data, source: 'deal' as const };
      } else {
        const { data, error } = await supabase
          .from('conversation_tasks')
          .insert({
            user_id: user.id,
            conversation_id: conversationId,
            contact_id: contactId,
            ...rest,
          })
          .select()
          .single();
        if (error) throw error;
        return { ...data, source: 'conversation' as const };
      }
    },
    onSuccess: (data) => {
      invalidateQueries();
      toast.success('Tarefa criada com sucesso');
      if (data.assigned_to) {
        sendTaskNotification('task_assigned', data.id, data.title, data.assigned_to);
      } else {
        sendTaskNotification('task_created', data.id, data.title, null);
      }
    },
    onError: (error) => {
      console.error('Error creating task:', error);
      toast.error('Erro ao criar tarefa');
    },
  });

  const updateTask = useMutation({
    mutationFn: async ({ id, source, ...updates }: Partial<UnifiedTask> & { id: string; source: 'conversation' | 'deal' }) => {
      const table = source === 'deal' ? 'deal_tasks' : 'conversation_tasks';
      const { data, error } = await supabase
        .from(table)
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return { ...data, source };
    },
    onSuccess: (data) => {
      invalidateQueries();
      toast.success('Tarefa atualizada');
      sendTaskNotification('task_updated', data.id, data.title, data.assigned_to);
    },
    onError: (error) => {
      console.error('Error updating task:', error);
      toast.error('Erro ao atualizar tarefa');
    },
  });

  const toggleComplete = useMutation({
    mutationFn: async (task: UnifiedTask) => {
      const table = task.source === 'deal' ? 'deal_tasks' : 'conversation_tasks';
      const { data, error } = await supabase
        .from(table)
        .update({
          completed_at: task.completed_at ? null : new Date().toISOString(),
        })
        .eq('id', task.id)
        .select()
        .single();
      if (error) throw error;
      return { ...data, source: task.source };
    },
    onSuccess: (data) => {
      invalidateQueries();
      toast.success(data.completed_at ? 'Tarefa concluída' : 'Tarefa reaberta');
    },
    onError: (error) => {
      console.error('Error toggling task:', error);
      toast.error('Erro ao atualizar tarefa');
    },
  });

  const deleteTask = useMutation({
    mutationFn: async (task: UnifiedTask) => {
      const table = task.source === 'deal' ? 'deal_tasks' : 'conversation_tasks';
      const { error } = await supabase
        .from(table)
        .delete()
        .eq('id', task.id);
      if (error) throw error;
      return task;
    },
    onSuccess: (task) => {
      invalidateQueries();
      toast.success('Tarefa excluída');
      sendTaskNotification('task_deleted', task.id, task.title, task.assigned_to);
    },
    onError: (error) => {
      console.error('Error deleting task:', error);
      toast.error('Erro ao excluir tarefa');
    },
  });

  return {
    tasks,
    pendingTasks,
    completedTasks,
    isLoading,
    createTask,
    updateTask,
    toggleComplete,
    deleteTask,
  };
};
