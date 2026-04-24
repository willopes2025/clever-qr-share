import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import { useEffect } from 'react';

export type SendingMode = 'sequential' | 'random';

export interface MetaVariableMapping {
  variable_index: number; // 1, 2, 3...
  source: 'contact_name' | 'contact_phone' | 'contact_email' | 'contact_custom_field' | 'lead_custom_field' | 'deal_value' | 'deal_name' | 'fixed_text';
  field_key?: string; // for custom fields
  fixed_value?: string; // for fixed text
  label?: string; // display label
}

export interface Campaign {
  id: string;
  user_id: string;
  name: string;
  template_id: string | null;
  meta_template_id: string | null;
  meta_phone_number_id: string | null;
  list_id: string | null;
  instance_id: string | null;
  instance_ids: string[] | null;
  sending_mode: SendingMode | null;
  status: 'draft' | 'scheduled' | 'sending' | 'completed' | 'cancelled' | 'failed';
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  total_contacts: number;
  sent: number;
  delivered: number;
  failed: number;
  skipped: number;
  created_at: string;
  updated_at: string;
  meta_variable_mappings: MetaVariableMapping[] | null;
  // Campaign-specific sending settings
  message_interval_min: number | null;
  message_interval_max: number | null;
  daily_limit: number | null;
  allowed_start_hour: number | null;
  allowed_end_hour: number | null;
  allowed_days: string[] | null;
  timezone: string | null;
  // Duplicate control settings
  skip_already_sent: boolean | null;
  skip_mode: 'same_campaign' | 'same_template' | 'same_list' | 'any_campaign' | 'has_tag' | null;
  skip_days_period: number | null;
  skip_tag_id: string | null;
  // Tag on delivery
  tag_on_delivery_id: string | null;
  // Batch sending settings
  batch_enabled: boolean | null;
  batch_size: number | null;
  batch_pause_minutes: number | null;
  // AI Agent settings
  ai_enabled: boolean | null;
  ai_prompt: string | null;
  ai_knowledge_base: string | null;
  ai_max_interactions: number | null;
  ai_response_delay_min: number | null;
  ai_response_delay_max: number | null;
  ai_handoff_keywords: string[] | null;
  ai_active_hours_start: number | null;
  ai_active_hours_end: number | null;
  // Dispatch mode (template vs chatbot flow)
  dispatch_mode?: 'template' | 'chatbot' | null;
  chatbot_flow_id?: string | null;
  template?: {
    id: string;
    name: string;
    content: string;
  } | null;
  list?: {
    id: string;
    name: string;
  } | null;
}

export interface CampaignMessage {
  id: string;
  campaign_id: string;
  contact_id: string;
  phone: string;
  contact_name: string | null;
  message_content: string;
  status: 'pending' | 'queued' | 'sending' | 'sent' | 'delivered' | 'failed';
  error_message: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  created_at: string;
}

export const useCampaigns = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['campaigns', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('campaigns')
        .select(`
          *,
          template:message_templates(id, name, content),
          list:broadcast_lists(id, name)
        `)
        // RLS policy handles organization-level access
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as unknown as Campaign[];
    },
    enabled: !!user?.id,
  });
};

export const useCampaignMessages = (campaignId: string | null) => {
  return useQuery({
    queryKey: ['campaign-messages', campaignId],
    queryFn: async () => {
      if (!campaignId) return [];
      
      const { data, error } = await supabase
        .from('campaign_messages')
        .select('*')
        .eq('campaign_id', campaignId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as CampaignMessage[];
    },
    enabled: !!campaignId,
  });
};

export const useCampaignRealtime = (campaignId: string | null) => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  useEffect(() => {
    if (!campaignId) return;

    // Subscribe to campaign updates
    const campaignChannel = supabase
      .channel(`campaign-${campaignId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'campaigns',
          filter: `id=eq.${campaignId}`,
        },
        (payload) => {
          queryClient.setQueryData(['campaigns', user?.id], (old: Campaign[] | undefined) => {
            if (!old) return old;
            return old.map(c => c.id === campaignId ? { ...c, ...payload.new } : c);
          });
        }
      )
      .subscribe();

    // Subscribe to campaign messages updates
    const messagesChannel = supabase
      .channel(`campaign-messages-${campaignId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'campaign_messages',
          filter: `campaign_id=eq.${campaignId}`,
        },
        () => {
          // Invalidate to refetch messages
          queryClient.invalidateQueries({ queryKey: ['campaign-messages', campaignId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(campaignChannel);
      supabase.removeChannel(messagesChannel);
    };
  }, [campaignId, queryClient, user?.id]);
};

export const useCampaignMutations = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const createCampaign = useMutation({
    mutationFn: async (data: {
      name: string;
      template_id: string | null;
      meta_template_id?: string | null;
      meta_phone_number_id?: string | null;
      list_id: string | null;
      scheduled_at: string | null;
      message_interval_min?: number;
      message_interval_max?: number;
      daily_limit?: number;
      allowed_start_hour?: number;
      allowed_end_hour?: number;
      allowed_days?: string[];
      timezone?: string;
      // Duplicate control settings
      skip_already_sent?: boolean;
      skip_mode?: 'same_campaign' | 'same_template' | 'same_list' | 'any_campaign' | 'has_tag';
      skip_days_period?: number;
      skip_tag_id?: string | null;
      // Tag on delivery
      tag_on_delivery_id?: string | null;
      // Batch sending
      batch_enabled?: boolean;
      batch_size?: number;
      batch_pause_minutes?: number;
      // AI settings
      ai_enabled?: boolean;
      ai_prompt?: string;
      ai_knowledge_base?: string;
      ai_max_interactions?: number;
      ai_response_delay_min?: number;
      ai_response_delay_max?: number;
      ai_handoff_keywords?: string[];
      ai_active_hours_start?: number;
      ai_active_hours_end?: number;
      meta_variable_mappings?: MetaVariableMapping[] | null;
      dispatch_mode?: 'template' | 'chatbot';
      chatbot_flow_id?: string | null;
    }) => {
      if (!user?.id) throw new Error('User not authenticated');

      // Get contact count from list
      let totalContacts = 0;
      if (data.list_id) {
        const { count } = await supabase
          .from('broadcast_list_contacts')
          .select('*', { count: 'exact', head: true })
          .eq('list_id', data.list_id);
        totalContacts = count || 0;
      }

      const insertData: Record<string, unknown> = {
          user_id: user.id,
          name: data.name,
          template_id: data.template_id,
          meta_template_id: data.meta_template_id || null,
          meta_phone_number_id: data.meta_phone_number_id || null,
          list_id: data.list_id,
          scheduled_at: data.scheduled_at,
          status: data.scheduled_at ? 'scheduled' : 'draft',
          total_contacts: totalContacts,
          message_interval_min: data.message_interval_min,
          message_interval_max: data.message_interval_max,
          daily_limit: data.daily_limit,
          allowed_start_hour: data.allowed_start_hour,
          allowed_end_hour: data.allowed_end_hour,
          allowed_days: data.allowed_days,
          timezone: data.timezone,
          skip_already_sent: data.skip_already_sent,
          skip_mode: data.skip_mode,
          skip_days_period: data.skip_days_period,
          skip_tag_id: data.skip_tag_id,
          tag_on_delivery_id: data.tag_on_delivery_id,
          batch_enabled: data.batch_enabled,
          batch_size: data.batch_size,
          batch_pause_minutes: data.batch_pause_minutes,
          ai_enabled: data.ai_enabled,
          ai_prompt: data.ai_prompt,
          ai_knowledge_base: data.ai_knowledge_base,
          ai_max_interactions: data.ai_max_interactions,
          ai_response_delay_min: data.ai_response_delay_min,
          ai_response_delay_max: data.ai_response_delay_max,
          ai_handoff_keywords: data.ai_handoff_keywords,
          ai_active_hours_start: data.ai_active_hours_start,
          ai_active_hours_end: data.ai_active_hours_end,
          meta_variable_mappings: data.meta_variable_mappings || null,
          dispatch_mode: data.dispatch_mode || 'template',
          chatbot_flow_id: data.chatbot_flow_id || null,
      };

      const { data: campaign, error } = await supabase
        .from('campaigns')
        .insert(insertData as any)
        .select()
        .single();

      if (error) throw error;
      return campaign;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      toast.success('Campanha criada com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao criar campanha: ' + error.message);
    },
  });

  const updateCampaign = useMutation({
    mutationFn: async ({ id, ...data }: {
      id: string;
      name?: string;
      template_id?: string | null;
      meta_template_id?: string | null;
      meta_phone_number_id?: string | null;
      list_id?: string | null;
      scheduled_at?: string | null;
      status?: string;
      message_interval_min?: number;
      message_interval_max?: number;
      daily_limit?: number;
      allowed_start_hour?: number;
      allowed_end_hour?: number;
      allowed_days?: string[];
      timezone?: string;
      skip_already_sent?: boolean;
      skip_mode?: 'same_campaign' | 'same_template' | 'same_list' | 'any_campaign' | 'has_tag';
      skip_days_period?: number;
      skip_tag_id?: string | null;
      tag_on_delivery_id?: string | null;
      batch_enabled?: boolean;
      batch_size?: number;
      batch_pause_minutes?: number;
      ai_enabled?: boolean;
      ai_prompt?: string;
      ai_knowledge_base?: string;
      ai_max_interactions?: number;
      ai_response_delay_min?: number;
      ai_response_delay_max?: number;
      ai_handoff_keywords?: string[];
      ai_active_hours_start?: number;
      ai_active_hours_end?: number;
      meta_variable_mappings?: MetaVariableMapping[] | null;
    }) => {
      const updateData: Record<string, unknown> = { ...data };
      
      // Update contact count if list changed
      if (data.list_id) {
        const { count } = await supabase
          .from('broadcast_list_contacts')
          .select('*', { count: 'exact', head: true })
          .eq('list_id', data.list_id);
        updateData.total_contacts = count || 0;
      }

      const { data: campaign, error } = await supabase
        .from('campaigns')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return campaign;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      toast.success('Campanha atualizada com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao atualizar campanha: ' + error.message);
    },
  });

  const deleteCampaign = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('campaigns')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      toast.success('Campanha excluída com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao excluir campanha: ' + error.message);
    },
  });

  const startCampaign = useMutation({
    mutationFn: async ({ 
      campaignId, 
      instanceIds, 
      sendingMode 
    }: { 
      campaignId: string; 
      instanceIds: string[]; 
      sendingMode: SendingMode;
    }) => {
      const { data, error } = await supabase.functions.invoke('start-campaign', {
        body: { campaignId, instanceIds, sendingMode }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Failed to start campaign');
      
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      toast.success(data?.message || 'Campanha iniciada! Acompanhe o progresso em tempo real.');
    },
    onError: (error) => {
      toast.error('Erro ao iniciar campanha: ' + error.message);
    },
  });

  const cancelCampaign = useMutation({
    mutationFn: async (id: string) => {
      const { data: campaign, error } = await supabase
        .from('campaigns')
        .update({
          status: 'cancelled',
          completed_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return campaign;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      toast.success('Campanha cancelada!');
    },
    onError: (error) => {
      toast.error('Erro ao cancelar campanha: ' + error.message);
    },
  });

  const resumeCampaign = useMutation({
    mutationFn: async ({ 
      campaignId, 
      instanceIds, 
      sendingMode 
    }: { 
      campaignId: string; 
      instanceIds: string[]; 
      sendingMode: SendingMode;
    }) => {
      const { data, error } = await supabase.functions.invoke('resume-campaign', {
        body: { campaignId, instanceIds, sendingMode }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Failed to resume campaign');
      
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      toast.success(data.message || 'Campanha retomada!');
    },
    onError: (error) => {
      toast.error('Erro ao retomar campanha: ' + error.message);
    },
  });

  return {
    createCampaign,
    updateCampaign,
    deleteCampaign,
    startCampaign,
    cancelCampaign,
    resumeCampaign,
  };
};
