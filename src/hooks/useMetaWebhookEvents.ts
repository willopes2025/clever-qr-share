import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface MetaWebhookEvent {
  id: string;
  user_id: string;
  received_at: string;
  method: string;
  status_code: number | null;
  phone_number_id: string | null;
  event_type: string | null;
  payload: Record<string, unknown> | null;
  error: string | null;
  signature_valid: boolean | null;
  created_at: string;
}

export const useMetaWebhookEvents = (limit = 20) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: events, isLoading, refetch } = useQuery({
    queryKey: ['meta-webhook-events', user?.id, limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meta_webhook_events')
        .select('*')
        .order('received_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data as MetaWebhookEvent[];
    },
    enabled: !!user,
    refetchInterval: 10000, // Refetch every 10 seconds
  });

  const lastEvent = events?.[0] || null;
  const lastPostEvent = events?.find(e => e.method === 'POST') || null;

  return {
    events,
    isLoading,
    refetch,
    lastEvent,
    lastPostEvent,
    invalidate: () => queryClient.invalidateQueries({ queryKey: ['meta-webhook-events'] }),
  };
};
