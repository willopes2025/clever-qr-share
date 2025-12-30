import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";
import { Json } from "@/integrations/supabase/types";

export interface FusionPBXConfig {
  id: string;
  user_id: string;
  name: string | null;
  domain: string;
  host: string;
  api_key: string | null;
  esl_password: string | null;
  esl_port: number | null;
  verto_wss_url: string | null;
  stun_servers: string[] | null;
  turn_servers: Json | null;
  is_active: boolean | null;
  organization_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Extension {
  id: string;
  user_id: string;
  fusionpbx_config_id: string;
  extension_number: string;
  sip_password: string;
  display_name: string | null;
  caller_id_name: string | null;
  caller_id_number: string | null;
  voicemail_enabled: boolean | null;
  webrtc_enabled: boolean | null;
  is_active: boolean;
  organization_id: string | null;
  created_at: string;
  updated_at: string;
}

export const useFusionPBXConfig = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: configs, isLoading: isLoadingConfigs } = useQuery({
    queryKey: ['fusionpbx-configs', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('fusionpbx_configs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as unknown as FusionPBXConfig[];
    },
    enabled: !!user?.id,
  });

  // Buscar extensões do usuário
  const { data: extensions, isLoading: isLoadingExtensions } = useQuery({
    queryKey: ['extensions', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('extensions')
        .select(`
          *,
          fusionpbx_configs (
            id,
            name,
            domain
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as (Extension & { fusionpbx_configs: Pick<FusionPBXConfig, 'id' | 'name' | 'domain'> })[];
    },
    enabled: !!user?.id,
  });

  // Criar configuração FusionPBX
  const createConfig = useMutation({
    mutationFn: async (config: { name: string; domain: string; host: string; api_key?: string; verto_wss_url?: string }) => {
      if (!user?.id) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('fusionpbx_configs')
        .insert({
          name: config.name,
          domain: config.domain,
          host: config.host,
          api_key: config.api_key || null,
          verto_wss_url: config.verto_wss_url || null,
          user_id: user.id
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fusionpbx-configs'] });
      toast.success('Configuração FusionPBX criada com sucesso');
    },
    onError: (error: any) => {
      toast.error(`Erro ao criar configuração: ${error.message}`);
    }
  });

  // Atualizar configuração FusionPBX
  const updateConfig = useMutation({
    mutationFn: async ({ id, ...config }: Partial<FusionPBXConfig> & { id: string }) => {
      const { data, error } = await supabase
        .from('fusionpbx_configs')
        .update(config)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fusionpbx-configs'] });
      toast.success('Configuração atualizada com sucesso');
    },
    onError: (error: any) => {
      toast.error(`Erro ao atualizar configuração: ${error.message}`);
    }
  });

  // Deletar configuração FusionPBX
  const deleteConfig = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('fusionpbx_configs')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fusionpbx-configs'] });
      queryClient.invalidateQueries({ queryKey: ['extensions'] });
      toast.success('Configuração removida com sucesso');
    },
    onError: (error: any) => {
      toast.error(`Erro ao remover configuração: ${error.message}`);
    }
  });

  // Criar extensão
  const createExtension = useMutation({
    mutationFn: async (extension: Omit<Extension, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
      if (!user?.id) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('extensions')
        .insert({
          ...extension,
          user_id: user.id
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['extensions'] });
      toast.success('Ramal criado com sucesso');
    },
    onError: (error: any) => {
      toast.error(`Erro ao criar ramal: ${error.message}`);
    }
  });

  // Atualizar extensão
  const updateExtension = useMutation({
    mutationFn: async ({ id, ...extension }: Partial<Extension> & { id: string }) => {
      const { data, error } = await supabase
        .from('extensions')
        .update(extension)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['extensions'] });
      toast.success('Ramal atualizado com sucesso');
    },
    onError: (error: any) => {
      toast.error(`Erro ao atualizar ramal: ${error.message}`);
    }
  });

  // Deletar extensão
  const deleteExtension = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('extensions')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['extensions'] });
      toast.success('Ramal removido com sucesso');
    },
    onError: (error: any) => {
      toast.error(`Erro ao remover ramal: ${error.message}`);
    }
  });

  const activeConfig = configs?.find(c => c.is_active) || configs?.[0];
  const activeExtension = extensions?.find(e => e.is_active) || extensions?.[0];
  const isConfigured = !!activeConfig && !!activeExtension;

  return {
    configs,
    extensions,
    activeConfig,
    activeExtension,
    isConfigured,
    isLoading: isLoadingConfigs || isLoadingExtensions,
    createConfig,
    updateConfig,
    deleteConfig,
    createExtension,
    updateExtension,
    deleteExtension,
  };
};
