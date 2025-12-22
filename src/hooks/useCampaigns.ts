import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import { useEffect } from 'react';

export type SendingMode = 'sequential' | 'random';

export interface Campaign {
  id: string;
  user_id: string;
  name: string;
  template_id: string | null;
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
  created_at: string;
  updated_at: string;
  // Campaign-specific sending settings
  message_interval_min: number | null;
  message_interval_max: number | null;
  daily_limit: number | null;
  allowed_start_hour: number | null;
  allowed_end_hour: number | null;
  allowed_days: string[] | null;
  timezone: string | null;
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
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Campaign[];
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
      list_id: string | null;
      scheduled_at: string | null;
      message_interval_min?: number;
      message_interval_max?: number;
      daily_limit?: number;
      allowed_start_hour?: number;
      allowed_end_hour?: number;
      allowed_days?: string[];
      timezone?: string;
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

      const { data: campaign, error } = await supabase
        .from('campaigns')
        .insert({
          user_id: user.id,
          name: data.name,
          template_id: data.template_id,
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
        })
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      toast.success('Campanha iniciada! Acompanhe o progresso em tempo real.');
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
