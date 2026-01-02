import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export interface AgentIntegration {
  id: string;
  agent_config_id: string;
  user_id: string;
  integration_type: 'api' | 'webhook_in' | 'webhook_out';
  name: string;
  description: string | null;
  is_active: boolean;
  api_base_url: string | null;
  api_auth_type: 'bearer' | 'api_key' | 'basic' | 'oauth2' | 'none' | null;
  api_credentials: Record<string, string>;
  api_headers: Record<string, string>;
  webhook_url: string | null;
  webhook_token: string | null;
  webhook_target_url: string | null;
  webhook_events: string[] | null;
  webhook_payload_template: Record<string, any> | null;
  last_used_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface WebhookLog {
  id: string;
  integration_id: string;
  user_id: string;
  direction: 'in' | 'out';
  event_type: string | null;
  payload: Record<string, any> | null;
  response_status: number | null;
  response_body: string | null;
  error_message: string | null;
  created_at: string;
}

export interface CreateIntegrationData {
  agent_config_id: string;
  integration_type: 'api' | 'webhook_in' | 'webhook_out';
  name: string;
  description?: string;
  api_base_url?: string;
  api_auth_type?: 'bearer' | 'api_key' | 'basic' | 'oauth2' | 'none';
  api_credentials?: Record<string, string>;
  api_headers?: Record<string, string>;
  webhook_target_url?: string;
  webhook_events?: string[];
  webhook_payload_template?: Record<string, any>;
}

// Generate secure random token
const generateToken = () => {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
};

export const useAgentIntegrations = (agentConfigId: string | null) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: integrations, isLoading, error } = useQuery({
    queryKey: ['agent-integrations', agentConfigId],
    queryFn: async () => {
      if (!agentConfigId) return [];
      
      const { data, error } = await supabase
        .from('ai_agent_integrations')
        .select('*')
        .eq('agent_config_id', agentConfigId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as AgentIntegration[];
    },
    enabled: !!agentConfigId && !!user,
  });

  const createIntegration = useMutation({
    mutationFn: async (data: CreateIntegrationData) => {
      if (!user?.id) throw new Error('Usuário não autenticado');

      const integrationData: any = {
        ...data,
        user_id: user.id,
      };

      // For incoming webhooks, generate URL and token
      if (data.integration_type === 'webhook_in') {
        const token = generateToken();
        integrationData.webhook_token = token;
        // URL will be constructed on the frontend using the integration ID
      }

      const { data: result, error } = await supabase
        .from('ai_agent_integrations')
        .insert(integrationData)
        .select()
        .single();

      if (error) throw error;

      // Update webhook_url with the integration ID
      if (data.integration_type === 'webhook_in' && result) {
        const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/agent-integration-webhook?integration_id=${result.id}&token=${result.webhook_token}`;
        
        const { data: updated, error: updateError } = await supabase
          .from('ai_agent_integrations')
          .update({ webhook_url: webhookUrl })
          .eq('id', result.id)
          .select()
          .single();

        if (updateError) throw updateError;
        return updated as AgentIntegration;
      }

      return result as AgentIntegration;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-integrations', agentConfigId] });
      toast.success('Integração criada com sucesso!');
    },
    onError: (error: any) => {
      toast.error('Erro ao criar integração: ' + error.message);
    },
  });

  const updateIntegration = useMutation({
    mutationFn: async ({ id, ...data }: Partial<AgentIntegration> & { id: string }) => {
      const { data: result, error } = await supabase
        .from('ai_agent_integrations')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return result as AgentIntegration;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-integrations', agentConfigId] });
      toast.success('Integração atualizada!');
    },
    onError: (error: any) => {
      toast.error('Erro ao atualizar integração: ' + error.message);
    },
  });

  const deleteIntegration = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('ai_agent_integrations')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-integrations', agentConfigId] });
      toast.success('Integração removida!');
    },
    onError: (error: any) => {
      toast.error('Erro ao remover integração: ' + error.message);
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('ai_agent_integrations')
        .update({ is_active })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-integrations', agentConfigId] });
    },
  });

  const testApiConnection = useMutation({
    mutationFn: async (integration: AgentIntegration) => {
      if (!integration.api_base_url) throw new Error('URL base não configurada');

      const headers: Record<string, string> = {
        ...integration.api_headers,
      };

      // Add auth headers based on type
      if (integration.api_auth_type === 'bearer' && integration.api_credentials?.token) {
        headers['Authorization'] = `Bearer ${integration.api_credentials.token}`;
      } else if (integration.api_auth_type === 'api_key' && integration.api_credentials?.api_key) {
        headers[integration.api_credentials.header_name || 'X-API-Key'] = integration.api_credentials.api_key;
      } else if (integration.api_auth_type === 'basic' && integration.api_credentials?.username) {
        const auth = btoa(`${integration.api_credentials.username}:${integration.api_credentials.password || ''}`);
        headers['Authorization'] = `Basic ${auth}`;
      }

      const response = await fetch(integration.api_base_url, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        throw new Error(`Erro ${response.status}: ${response.statusText}`);
      }

      return { success: true, status: response.status };
    },
    onSuccess: () => {
      toast.success('Conexão testada com sucesso!');
    },
    onError: (error: any) => {
      toast.error('Erro ao testar conexão: ' + error.message);
    },
  });

  const testWebhookOut = useMutation({
    mutationFn: async (integration: AgentIntegration) => {
      if (!integration.webhook_target_url) throw new Error('URL de destino não configurada');

      const payload = integration.webhook_payload_template || {
        event: 'test',
        timestamp: new Date().toISOString(),
        data: { message: 'Teste de webhook' },
      };

      const response = await fetch(integration.webhook_target_url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      // Log the attempt
      if (user?.id) {
        await supabase.from('ai_agent_webhook_logs').insert({
          integration_id: integration.id,
          user_id: user.id,
          direction: 'out',
          event_type: 'test',
          payload,
          response_status: response.status,
          response_body: await response.text().catch(() => null),
        });
      }

      if (!response.ok) {
        throw new Error(`Erro ${response.status}: ${response.statusText}`);
      }

      return { success: true, status: response.status };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhook-logs'] });
      toast.success('Webhook enviado com sucesso!');
    },
    onError: (error: any) => {
      toast.error('Erro ao enviar webhook: ' + error.message);
    },
  });

  return {
    integrations: integrations || [],
    isLoading,
    error,
    createIntegration,
    updateIntegration,
    deleteIntegration,
    toggleActive,
    testApiConnection,
    testWebhookOut,
  };
};

export const useWebhookLogs = (integrationId: string | null) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['webhook-logs', integrationId],
    queryFn: async () => {
      if (!integrationId) return [];
      
      const { data, error } = await supabase
        .from('ai_agent_webhook_logs')
        .select('*')
        .eq('integration_id', integrationId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as WebhookLog[];
    },
    enabled: !!integrationId && !!user,
  });
};
