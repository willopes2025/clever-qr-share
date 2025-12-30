import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { Json } from "@/integrations/supabase/types";

export interface CallEvent {
  id: string;
  call_id: string;
  event_type: string;
  event_data: Json;
  created_at: string;
}

export const useCallEvents = (callId?: string) => {
  const { user } = useAuth();

  const { data: events, isLoading } = useQuery({
    queryKey: ['call-events', callId],
    queryFn: async () => {
      if (!callId) return [];
      
      const { data, error } = await supabase
        .from('call_events')
        .select('*')
        .eq('call_id', callId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as CallEvent[];
    },
    enabled: !!callId && !!user?.id,
  });

  return {
    events,
    isLoading,
  };
};
