import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export interface ConversationTask {
  id: string;
  user_id: string;
  contact_id: string | null;
  conversation_id: string | null;
  title: string;
  description: string | null;
  due_date: string | null;
  due_time: string | null;
  priority: string;
  completed_at: string | null;
  reminder_at: string | null;
  task_type_id: string | null;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
}

export const useConversationTasks = (conversationId: string | null, contactId: string | null) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['conversation-tasks', conversationId, contactId],
    queryFn: async () => {
      if (!conversationId && !contactId) return [];
      
      let query = supabase
        .from('conversation_tasks')
        .select('*')
        .order('completed_at', { ascending: true, nullsFirst: true })
        .order('due_date', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false });

      if (conversationId) {
        query = query.eq('conversation_id', conversationId);
      } else if (contactId) {
        query = query.eq('contact_id', contactId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ConversationTask[];
    },
    enabled: !!(conversationId || contactId),
  });

  const pendingTasks = tasks.filter(t => !t.completed_at);
  const completedTasks = tasks.filter(t => t.completed_at);

  const createTask = useMutation({
    mutationFn: async (taskData: {
      title: string;
      description?: string;
      due_date?: string;
      due_time?: string;
      priority?: string;
      reminder_at?: string;
      task_type_id?: string | null;
      assigned_to?: string | null;
    }) => {
      if (!user) throw new Error('Usuário não autenticado');
      
      const { data, error } = await supabase
        .from('conversation_tasks')
        .insert({
          user_id: user.id,
          conversation_id: conversationId,
          contact_id: contactId,
          ...taskData,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversation-tasks', conversationId, contactId] });
      toast.success('Tarefa criada com sucesso');
    },
    onError: (error) => {
      console.error('Error creating task:', error);
      toast.error('Erro ao criar tarefa');
    },
  });

  const updateTask = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ConversationTask> & { id: string }) => {
      const { data, error } = await supabase
        .from('conversation_tasks')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversation-tasks', conversationId, contactId] });
      toast.success('Tarefa atualizada');
    },
    onError: (error) => {
      console.error('Error updating task:', error);
      toast.error('Erro ao atualizar tarefa');
    },
  });

  const toggleComplete = useMutation({
    mutationFn: async (task: ConversationTask) => {
      const { data, error } = await supabase
        .from('conversation_tasks')
        .update({
          completed_at: task.completed_at ? null : new Date().toISOString(),
        })
        .eq('id', task.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['conversation-tasks', conversationId, contactId] });
      toast.success(data.completed_at ? 'Tarefa concluída' : 'Tarefa reaberta');
    },
    onError: (error) => {
      console.error('Error toggling task:', error);
      toast.error('Erro ao atualizar tarefa');
    },
  });

  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('conversation_tasks')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversation-tasks', conversationId, contactId] });
      toast.success('Tarefa excluída');
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
