import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export interface VoipConfiguration {
  id: string;
  user_id: string;
  organization_id: string | null;
  provider: string;
  domain: string;
  api_token: string;
  api_key: string;
  default_device_id: string | null;
  default_src_number: string | null;
  elevenlabs_agent_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface VoipLine {
  id: string;
  user_id: string;
  organization_id: string | null;
  voip_config_id: string;
  external_line_id: string;
  line_number: string;
  description: string | null;
  caller_id: string | null;
  status: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export const useVoipConfig = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: config, isLoading: isLoadingConfig } = useQuery({
    queryKey: ['voip-config', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('voip_configurations')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (error) throw error;
      return data as VoipConfiguration | null;
    },
    enabled: !!user?.id,
  });

  const { data: lines = [], isLoading: isLoadingLines } = useQuery({
    queryKey: ['voip-lines', config?.id],
    queryFn: async () => {
      if (!config?.id) return [];
      
      const { data, error } = await supabase
        .from('voip_lines')
        .select('*')
        .eq('voip_config_id', config.id)
        .order('is_default', { ascending: false });

      if (error) throw error;
      return data as VoipLine[];
    },
    enabled: !!config?.id,
  });

  const saveConfig = useMutation({
    mutationFn: async (configData: Partial<VoipConfiguration>) => {
      if (!user?.id) throw new Error('Usuário não autenticado');

      const { data, error } = await supabase
        .from('voip_configurations')
        .upsert({
          user_id: user.id,
          provider: 'vono',
          domain: configData.domain || 'vono.me',
          api_token: configData.api_token || '',
          api_key: configData.api_key || '',
          default_device_id: configData.default_device_id,
          default_src_number: configData.default_src_number,
          elevenlabs_agent_id: configData.elevenlabs_agent_id,
          is_active: true,
          ...(config?.id ? { id: config.id } : {}),
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['voip-config'] });
      toast.success('Configuração VoIP salva!');
    },
    onError: (error) => {
      console.error('Error saving VoIP config:', error);
      toast.error('Erro ao salvar configuração VoIP');
    },
  });

  const deleteConfig = useMutation({
    mutationFn: async () => {
      if (!config?.id) throw new Error('Nenhuma configuração para deletar');

      const { error } = await supabase
        .from('voip_configurations')
        .delete()
        .eq('id', config.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['voip-config'] });
      queryClient.invalidateQueries({ queryKey: ['voip-lines'] });
      toast.success('Configuração VoIP removida');
    },
    onError: (error) => {
      console.error('Error deleting VoIP config:', error);
      toast.error('Erro ao remover configuração VoIP');
    },
  });

  const isConfigured = !!config && !!config.api_token && !!config.api_key;
  const defaultLine = lines.find(l => l.is_default) || lines[0];

  return {
    config,
    lines,
    defaultLine,
    isConfigured,
    isLoading: isLoadingConfig || isLoadingLines,
    saveConfig,
    deleteConfig,
  };
};
