import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import { useEffect } from 'react';

export interface Campaign {
  id: string;
  user_id: string;
  name: string;
  template_id: string | null;
  list_id: string | null;
  status: 'draft' | 'scheduled' | 'sending' | 'completed' | 'cancelled';
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  total_contacts: number;
  sent: number;
  delivered: number;
  failed: number;
  created_at: string;
  updated_at: string;
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

export const useCampaignRealtime = (campaignId: string | null) => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  useEffect(() => {
    if (!campaignId) return;

    const channel = supabase
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

    return () => {
      supabase.removeChannel(channel);
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
    mutationFn: async (id: string) => {
      const { data: campaign, error } = await supabase
        .from('campaigns')
        .update({
          status: 'sending',
          started_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return campaign;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      toast.success('Campanha iniciada!');
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

  return {
    createCampaign,
    updateCampaign,
    deleteCampaign,
    startCampaign,
    cancelCampaign,
  };
};
