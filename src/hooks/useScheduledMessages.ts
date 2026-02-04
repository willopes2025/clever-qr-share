import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface ScheduledTaskMessage {
  id: string;
  task_id: string;
  conversation_id: string;
  contact_id: string;
  user_id: string;
  template_id: string | null;
  message_content: string;
  scheduled_at: string;
  status: 'pending' | 'sent' | 'failed' | 'cancelled';
  sent_at: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateScheduledMessageData {
  task_id: string;
  conversation_id: string;
  contact_id: string;
  template_id?: string | null;
  message_content: string;
  scheduled_at: string;
}

export const useScheduledMessages = (taskId?: string) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const messageQuery = useQuery({
    queryKey: ['scheduled-task-message', taskId],
    queryFn: async () => {
      if (!taskId) return null;

      const { data, error } = await supabase
        .from('scheduled_task_messages')
        .select('*')
        .eq('task_id', taskId)
        .maybeSingle();

      if (error) throw error;
      return data as ScheduledTaskMessage | null;
    },
    enabled: !!taskId && !!user?.id,
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateScheduledMessageData) => {
      if (!user?.id) throw new Error('User not authenticated');

      const { data: result, error } = await supabase
        .from('scheduled_task_messages')
        .insert({
          ...data,
          user_id: user.id,
          status: 'pending',
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-task-message'] });
      toast.success('Mensagem agendada com sucesso!');
    },
    onError: (error) => {
      console.error('Error creating scheduled message:', error);
      toast.error('Erro ao agendar mensagem');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: Partial<ScheduledTaskMessage> & { id: string }) => {
      const { error } = await supabase
        .from('scheduled_task_messages')
        .update(data)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-task-message'] });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('scheduled_task_messages')
        .update({ status: 'cancelled' })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-task-message'] });
      toast.success('Agendamento cancelado');
    },
    onError: () => {
      toast.error('Erro ao cancelar agendamento');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('scheduled_task_messages')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-task-message'] });
    },
  });

  return {
    scheduledMessage: messageQuery.data,
    isLoading: messageQuery.isLoading,
    createScheduledMessage: createMutation.mutateAsync,
    updateScheduledMessage: updateMutation.mutate,
    cancelScheduledMessage: cancelMutation.mutate,
    deleteScheduledMessage: deleteMutation.mutate,
    isCreating: createMutation.isPending,
  };
};
