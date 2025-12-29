import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "@/hooks/use-toast";

export interface SIPConfig {
  id: string;
  user_id: string;
  phone_number_id: string;
  phone_number: string;
  label: string;
  sip_username: string | null;
  sip_domain: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AIPhoneCall {
  id: string;
  user_id: string;
  contact_id: string | null;
  conversation_id: string | null;
  agent_config_id: string | null;
  sip_config_id: string | null;
  elevenlabs_conversation_id: string | null;
  sip_call_id: string | null;
  to_number: string;
  status: string;
  duration_seconds: number;
  transcript: string | null;
  recording_url: string | null;
  error_message: string | null;
  created_at: string;
  ended_at: string | null;
}

export const useElevenLabsSIP = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch SIP configurations
  const { data: sipConfigs, isLoading: isLoadingSIP } = useQuery({
    queryKey: ['elevenlabs-sip-configs', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('elevenlabs_sip_config')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as SIPConfig[];
    },
    enabled: !!user?.id,
  });

  // Get active SIP config
  const activeSIPConfig = sipConfigs?.find(c => c.is_active) || sipConfigs?.[0];

  // Create SIP config
  const createSIPConfig = useMutation({
    mutationFn: async (config: {
      phone_number_id: string;
      phone_number: string;
      label: string;
      sip_username?: string;
      sip_domain?: string;
    }) => {
      if (!user?.id) throw new Error('Usuário não autenticado');

      const { data, error } = await supabase
        .from('elevenlabs_sip_config')
        .insert({
          user_id: user.id,
          ...config,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['elevenlabs-sip-configs'] });
      toast({
        title: "Configuração SIP salva",
        description: "O número SIP foi configurado com sucesso.",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao salvar",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    },
  });

  // Delete SIP config
  const deleteSIPConfig = useMutation({
    mutationFn: async (configId: string) => {
      const { error } = await supabase
        .from('elevenlabs_sip_config')
        .delete()
        .eq('id', configId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['elevenlabs-sip-configs'] });
      toast({
        title: "Configuração removida",
        description: "A configuração SIP foi removida.",
      });
    },
  });

  // Initiate AI phone call
  const initiateCall = useMutation({
    mutationFn: async (params: {
      contactPhone: string;
      contactId?: string;
      conversationId?: string;
      agentConfigId: string;
      sipConfigId: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('elevenlabs-sip-call', {
        body: params,
      });

      if (error) throw error;
      
      // Handle structured error responses
      if (!data.success) {
        const errorWithCode = new Error(data.error || 'Erro ao iniciar chamada') as Error & { 
          code?: string; 
          phoneNumber?: string;
        };
        errorWithCode.code = data.error_code;
        errorWithCode.phoneNumber = data.phone_number;
        throw errorWithCode;
      }
      
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['ai-phone-calls'] });
      toast({
        title: "Chamada iniciada",
        description: "A ligação está sendo realizada pela IA.",
      });
    },
    onError: (error: Error & { code?: string; phoneNumber?: string }) => {
      let title = "Erro ao iniciar chamada";
      let description = error.message || "Erro desconhecido";
      
      // Provide specific guidance based on error code
      if (error.code === 'invalid_provider_config') {
        title = "Configuração SIP inválida";
        description = `O SIP trunk para ${error.phoneNumber || 'este número'} precisa ser reconfigurado no ElevenLabs. Acesse o painel ElevenLabs, apague e recrie o número, depois atualize o Phone Number ID nas configurações.`;
      } else if (error.code === 'agent_not_found') {
        title = "Agente não encontrado";
      } else if (error.code === 'phone_number_not_found') {
        title = "Número SIP não encontrado";
      }
      
      toast({
        title,
        description,
        variant: "destructive",
      });
    },
  });

  // Fetch call history
  const { data: callHistory, isLoading: isLoadingCalls } = useQuery({
    queryKey: ['ai-phone-calls', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('ai_phone_calls')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as AIPhoneCall[];
    },
    enabled: !!user?.id,
  });

  // Check if SIP is configured
  const isSIPConfigured = !!activeSIPConfig;

  return {
    sipConfigs,
    activeSIPConfig,
    isLoadingSIP,
    createSIPConfig,
    deleteSIPConfig,
    initiateCall,
    callHistory,
    isLoadingCalls,
    isSIPConfigured,
  };
};
