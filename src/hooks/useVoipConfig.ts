import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface VoipConfiguration {
  id: string;
  user_id: string;
  provider: string;
  domain: string;
  api_token: string;
  api_key: string;
  default_device_id: string | null;
  default_src_number: string | null;
  is_active: boolean;
}

export const useVoipConfig = () => {
  const { user } = useAuth();

  const { data: config, isLoading } = useQuery({
    queryKey: ['voip-config', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      // Buscar da tabela integrations onde o provider é vono_voip
      const { data, error } = await supabase
        .from('integrations')
        .select('*')
        .eq('user_id', user.id)
        .eq('provider', 'vono_voip')
        .eq('is_active', true)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      // Mapear credentials para o formato esperado
      const credentials = data.credentials as Record<string, string> | null;
      
      return {
        id: data.id,
        user_id: data.user_id,
        provider: 'vono',
        domain: credentials?.domain || 'vono.me',
        api_token: credentials?.api_token || '',
        api_key: credentials?.api_key || '',
        default_device_id: credentials?.default_device_id || null,
        default_src_number: credentials?.default_src_number || null,
        is_active: data.is_active,
      } as VoipConfiguration;
    },
    enabled: !!user?.id,
  });

  const isConfigured = !!config && !!config.api_token && !!config.api_key && !!config.default_device_id;

  return {
    config,
    isConfigured,
    isLoading,
  };
};
