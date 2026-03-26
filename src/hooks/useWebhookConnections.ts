import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface WebhookConnection {
  id: string;
  user_id: string;
  name: string;
  direction: string;
  webhook_token: string;
  target_url: string | null;
  is_active: boolean;
  last_received_at: string | null;
  last_sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WebhookLog {
  id: string;
  connection_id: string | null;
  user_id: string;
  direction: string;
  action: string | null;
  status: string;
  request_payload: any;
  response_payload: any;
  error_message: string | null;
  created_at: string;
}

export function useWebhookConnections() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const connectionsQuery = useQuery({
    queryKey: ['webhook-connections'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('webhook_connections')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as WebhookConnection[];
    },
    enabled: !!user,
  });

  const createConnection = useMutation({
    mutationFn: async (params: { name: string; direction: string; target_url?: string }) => {
      const { data, error } = await supabase
        .from('webhook_connections')
        .insert({ ...params, user_id: user!.id })
        .select()
        .single();
      if (error) throw error;
      return data as WebhookConnection;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhook-connections'] });
      toast.success('Webhook criado com sucesso');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const updateConnection = useMutation({
    mutationFn: async (params: { id: string; name?: string; target_url?: string; is_active?: boolean }) => {
      const { id, ...updates } = params;
      const { error } = await supabase.from('webhook_connections').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhook-connections'] });
      toast.success('Webhook atualizado');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteConnection = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('webhook_connections').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhook-connections'] });
      toast.success('Webhook removido');
    },
    onError: (err: any) => toast.error(err.message),
  });

  return {
    connections: connectionsQuery.data || [],
    isLoading: connectionsQuery.isLoading,
    createConnection,
    updateConnection,
    deleteConnection,
  };
}

export function useWebhookLogs(connectionId?: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['webhook-logs', connectionId],
    queryFn: async () => {
      let query = supabase
        .from('webhook_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (connectionId) {
        query = query.eq('connection_id', connectionId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as WebhookLog[];
    },
    enabled: !!user,
    refetchInterval: 30000,
  });
}
