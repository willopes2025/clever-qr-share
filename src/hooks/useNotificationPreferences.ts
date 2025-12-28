import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface NotificationPreferences {
  id: string;
  user_id: string;
  notify_new_message: boolean;
  notify_new_deal: boolean;
  notify_deal_stage_change: boolean;
  notify_deal_assigned: boolean;
  notify_task_due: boolean;
  notify_task_assigned: boolean;
  notify_calendly_event: boolean;
  notify_ai_handoff: boolean;
  notify_campaign_complete: boolean;
  notify_instance_disconnect: boolean;
  only_if_responsible: boolean;
  notification_instance_id: string | null;
  created_at: string;
  updated_at: string;
}

export const NOTIFICATION_TYPES = [
  { key: 'notify_new_message', label: 'Nova mensagem no inbox', description: 'Receber notificação quando uma nova mensagem chegar' },
  { key: 'notify_new_deal', label: 'Novo deal criado', description: 'Receber notificação quando um novo deal for criado no funil' },
  { key: 'notify_deal_stage_change', label: 'Deal mudou de etapa', description: 'Receber notificação quando um deal mudar de etapa' },
  { key: 'notify_deal_assigned', label: 'Deal atribuído a mim', description: 'Receber notificação quando um deal for atribuído a você' },
  { key: 'notify_task_due', label: 'Tarefa vencida', description: 'Receber notificação quando uma tarefa vencer' },
  { key: 'notify_task_assigned', label: 'Tarefa atribuída a mim', description: 'Receber notificação quando uma tarefa for atribuída a você' },
  { key: 'notify_calendly_event', label: 'Evento Calendly agendado', description: 'Receber notificação quando um evento Calendly for agendado' },
  { key: 'notify_ai_handoff', label: 'IA solicitou atendimento humano', description: 'Receber notificação quando a IA solicitar handoff' },
  { key: 'notify_campaign_complete', label: 'Campanha finalizada', description: 'Receber notificação quando uma campanha for concluída' },
  { key: 'notify_instance_disconnect', label: 'Instância desconectou', description: 'Receber notificação quando uma instância WhatsApp desconectar' },
] as const;

export function useNotificationPreferences() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: preferences, isLoading } = useQuery({
    queryKey: ['notification-preferences', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (error) throw error;
      return data as NotificationPreferences | null;
    },
    enabled: !!user?.id,
  });

  const createPreferences = useMutation({
    mutationFn: async (data: Partial<NotificationPreferences>) => {
      if (!user?.id) throw new Error('Usuário não autenticado');
      
      const { data: result, error } = await supabase
        .from('notification_preferences')
        .insert({
          user_id: user.id,
          ...data,
        })
        .select()
        .single();
      
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-preferences'] });
      toast.success('Preferências de notificação salvas');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao salvar preferências: ${error.message}`);
    },
  });

  const updatePreferences = useMutation({
    mutationFn: async (data: Partial<NotificationPreferences>) => {
      if (!user?.id) throw new Error('Usuário não autenticado');
      
      const { data: result, error } = await supabase
        .from('notification_preferences')
        .update({
          ...data,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)
        .select()
        .single();
      
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-preferences'] });
      toast.success('Preferências de notificação atualizadas');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar preferências: ${error.message}`);
    },
  });

  const savePreferences = async (data: Partial<NotificationPreferences>) => {
    if (preferences) {
      return updatePreferences.mutateAsync(data);
    } else {
      return createPreferences.mutateAsync(data);
    }
  };

  return {
    preferences,
    isLoading,
    savePreferences,
    isSaving: createPreferences.isPending || updatePreferences.isPending,
  };
}
