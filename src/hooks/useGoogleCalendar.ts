import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export interface GoogleCalendarIntegration {
  id: string;
  user_id: string;
  access_token: string;
  refresh_token: string;
  token_expires_at: string;
  calendar_id: string;
  is_active: boolean;
  last_sync_at: string | null;
  created_at: string;
  updated_at: string;
}

export function useGoogleCalendar() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: integration, isLoading } = useQuery({
    queryKey: ['google-calendar-integration', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from('google_calendar_integrations')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      return data as GoogleCalendarIntegration | null;
    },
    enabled: !!user?.id,
  });

  const connectGoogle = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('google-calendar-integration', {
        body: { action: 'authorize' },
      });

      if (error) throw error;
      
      if (data?.authUrl) {
        window.location.href = data.authUrl;
      }
      
      return data;
    },
    onError: (error) => {
      console.error('Erro ao conectar Google Calendar:', error);
      toast.error('Erro ao conectar Google Calendar');
    },
  });

  const disconnectGoogle = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Usuário não autenticado');

      const { error } = await supabase
        .from('google_calendar_integrations')
        .delete()
        .eq('user_id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['google-calendar-integration'] });
      toast.success('Google Calendar desconectado');
    },
    onError: (error) => {
      console.error('Erro ao desconectar Google Calendar:', error);
      toast.error('Erro ao desconectar Google Calendar');
    },
  });

  const syncTaskToGoogle = useMutation({
    mutationFn: async (task: {
      id: string;
      title: string;
      description?: string;
      due_date: string;
      due_time?: string;
      source: 'conversation' | 'deal';
    }) => {
      const { data, error } = await supabase.functions.invoke('google-calendar-integration', {
        body: { 
          action: 'sync-event',
          task,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['conversation-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['deal-tasks'] });
      toast.success('Tarefa sincronizada com Google Calendar');
    },
    onError: (error) => {
      console.error('Erro ao sincronizar tarefa:', error);
      toast.error('Erro ao sincronizar tarefa');
    },
  });

  const removeFromGoogle = useMutation({
    mutationFn: async (task: {
      id: string;
      google_event_id: string;
      source: 'conversation' | 'deal';
    }) => {
      const { data, error } = await supabase.functions.invoke('google-calendar-integration', {
        body: { 
          action: 'delete-event',
          task,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-tasks'] });
      toast.success('Tarefa removida do Google Calendar');
    },
    onError: (error) => {
      console.error('Erro ao remover tarefa:', error);
      toast.error('Erro ao remover tarefa do Google Calendar');
    },
  });

  return {
    integration,
    isLoading,
    isConnected: !!integration?.is_active,
    connectGoogle,
    disconnectGoogle,
    syncTaskToGoogle,
    removeFromGoogle,
  };
}
