import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export interface VoipCall {
  id: string;
  user_id: string;
  organization_id: string | null;
  contact_id: string | null;
  conversation_id: string | null;
  deal_id: string | null;
  voip_config_id: string | null;
  external_call_id: string | null;
  device_id: string | null;
  caller: string;
  called: string;
  direction: string;
  status: string;
  duration_seconds: number | null;
  ai_enabled: boolean;
  ai_transcript: string | null;
  elevenlabs_conversation_id: string | null;
  recording_id: string | null;
  recording_url: string | null;
  started_at: string;
  answered_at: string | null;
  ended_at: string | null;
  created_at: string;
}

interface MakeCallParams {
  contactPhone: string;
  contactId?: string;
  conversationId?: string;
  dealId?: string;
  srcNumber?: string;
  deviceId?: string;
  useAI?: boolean;
}

export const useVoipCalls = (contactId?: string, conversationId?: string) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: calls = [], isLoading } = useQuery({
    queryKey: ['voip-calls', contactId, conversationId],
    queryFn: async () => {
      if (!user?.id) return [];
      
      let query = supabase
        .from('voip_calls')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (contactId) {
        query = query.eq('contact_id', contactId);
      } else if (conversationId) {
        query = query.eq('conversation_id', conversationId);
      } else {
        query = query.eq('user_id', user.id);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as VoipCall[];
    },
    enabled: !!user?.id,
  });

  const { data: activeCall } = useQuery({
    queryKey: ['voip-active-call', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('voip_calls')
        .select('*')
        .eq('user_id', user.id)
        .in('status', ['pending', 'ringing', 'answered'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as VoipCall | null;
    },
    enabled: !!user?.id,
    refetchInterval: (data) => data ? 2000 : false, // Poll while there's an active call
  });

  const makeCall = useMutation({
    mutationFn: async (params: MakeCallParams) => {
      const { data, error } = await supabase.functions.invoke('vono-click-to-call', {
        body: params,
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Erro ao iniciar chamada');
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['voip-calls'] });
      queryClient.invalidateQueries({ queryKey: ['voip-active-call'] });
      toast.success('Chamada iniciada!');
    },
    onError: (error: Error) => {
      console.error('Error making call:', error);
      toast.error(error.message || 'Erro ao fazer chamada');
    },
  });

  const endCall = useMutation({
    mutationFn: async (callId: string) => {
      const { data, error } = await supabase.functions.invoke('vono-api', {
        body: { 
          action: 'end-call',
          callId,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['voip-calls'] });
      queryClient.invalidateQueries({ queryKey: ['voip-active-call'] });
      toast.success('Chamada encerrada');
    },
    onError: (error) => {
      console.error('Error ending call:', error);
      toast.error('Erro ao encerrar chamada');
    },
  });

  return {
    calls,
    activeCall,
    isLoading,
    makeCall,
    endCall,
    hasActiveCall: !!activeCall,
  };
};
