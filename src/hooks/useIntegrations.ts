import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";
import type { Json } from "@/integrations/supabase/types";

export interface Integration {
  id: string;
  user_id: string;
  provider: string;
  credentials: Json;
  settings: Json;
  is_active: boolean;
  last_sync_at: string | null;
  sync_error: string | null;
  created_at: string;
  updated_at: string;
}

export type IntegrationProvider = 
  | 'google_sheets'
  | 'google_calendar'
  | 'mercado_pago'
  | 'hotmart'
  | 'eduzz'
  | 'kiwify'
  | 'rd_station'
  | 'hubspot'
  | 'pipedrive'
  | 'zapier'
  | 'make'
  | 'n8n'
  | 'facebook_pixel'
  | 'google_analytics'
  | 'vono_voip'
  | 'meta_whatsapp'
  | 'asaas'
  | 'ssotica';

export const useIntegrations = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: integrations = [], isLoading, error, refetch } = useQuery({
    queryKey: ['integrations', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('integrations')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Integration[];
    },
    enabled: !!user?.id,
    refetchOnMount: 'always',
    staleTime: 0,
  });

  const connectIntegration = useMutation({
    mutationFn: async ({ 
      provider, 
      credentials, 
      settings 
    }: { 
      provider: IntegrationProvider; 
      credentials?: Record<string, string>; 
      settings?: Record<string, unknown>; 
    }) => {
      if (!user?.id) throw new Error('Usuário não autenticado');

      const { data, error } = await supabase
        .from('integrations')
        .upsert({
          user_id: user.id,
          provider,
          credentials: (credentials || {}) as Json,
          settings: (settings || {}) as Json,
          is_active: true,
        }, {
          onConflict: 'user_id,provider',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
      toast.success('Integração conectada com sucesso!');
    },
    onError: (error) => {
      console.error('Error connecting integration:', error);
      toast.error('Erro ao conectar integração');
    },
  });

  const updateIntegration = useMutation({
    mutationFn: async ({ 
      id, 
      credentials, 
      settings,
      is_active 
    }: { 
      id: string; 
      credentials?: Record<string, string>; 
      settings?: Record<string, unknown>;
      is_active?: boolean;
    }) => {
      const updateData: Record<string, unknown> = {};
      if (credentials !== undefined) updateData.credentials = credentials as Json;
      if (settings !== undefined) updateData.settings = settings as Json;
      if (is_active !== undefined) updateData.is_active = is_active;

      const { data, error } = await supabase
        .from('integrations')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
      toast.success('Integração atualizada!');
    },
    onError: (error) => {
      console.error('Error updating integration:', error);
      toast.error('Erro ao atualizar integração');
    },
  });

  const disconnectIntegration = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('integrations')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
      toast.success('Integração desconectada');
    },
    onError: (error) => {
      console.error('Error disconnecting integration:', error);
      toast.error('Erro ao desconectar integração');
    },
  });

  const getIntegration = (provider: IntegrationProvider) => {
    return integrations.find(i => i.provider === provider);
  };

  const isConnected = (provider: IntegrationProvider) => {
    const integration = getIntegration(provider);
    return integration?.is_active ?? false;
  };

  return {
    integrations,
    isLoading,
    error,
    refetch,
    connectIntegration,
    updateIntegration,
    disconnectIntegration,
    getIntegration,
    isConnected,
  };
};
