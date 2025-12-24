import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface Funnel {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  is_default: boolean;
  color: string;
  display_order: number;
  created_at: string;
  updated_at: string;
  stages?: FunnelStage[];
}

export interface FunnelStage {
  id: string;
  funnel_id: string;
  name: string;
  color: string;
  display_order: number;
  is_final: boolean;
  final_type: string | null;
  probability: number;
  created_at: string;
  deals?: FunnelDeal[];
}

export interface FunnelDeal {
  id: string;
  user_id: string;
  funnel_id: string;
  stage_id: string;
  contact_id: string;
  conversation_id: string | null;
  title: string | null;
  value: number;
  currency: string;
  expected_close_date: string | null;
  closed_at: string | null;
  close_reason_id: string | null;
  source: string | null;
  notes: string | null;
  entered_stage_at: string;
  created_at: string;
  updated_at: string;
  contact?: {
    id: string;
    name: string | null;
    phone: string;
    email: string | null;
  };
  close_reason?: CloseReason | null;
}

export interface CloseReason {
  id: string;
  user_id: string;
  type: 'won' | 'lost';
  name: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
}

export interface FunnelAutomation {
  id: string;
  user_id: string;
  funnel_id: string;
  stage_id: string | null;
  name: string;
  trigger_type: string;
  trigger_config: unknown;
  action_type: string;
  action_config: unknown;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const useFunnels = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch all funnels with stages and deals
  const { data: funnels, isLoading, refetch } = useQuery({
    queryKey: ['funnels', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('funnels')
        .select(`
          *,
          stages:funnel_stages(
            *,
            deals:funnel_deals(
              *,
              contact:contacts(id, name, phone, email),
              close_reason:funnel_close_reasons(*)
            )
          )
        `)
        .order('display_order', { ascending: true });

      if (error) throw error;
      
      // Sort stages and deals
      return (data || []).map((funnel) => ({
        ...funnel,
        stages: (funnel.stages || [])
          .sort((a: { display_order: number }, b: { display_order: number }) => a.display_order - b.display_order)
          .map((stage: { deals?: { updated_at: string }[] }) => ({
            ...stage,
            deals: (stage.deals || []).sort((a: { updated_at: string }, b: { updated_at: string }) => 
              new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
            )
          }))
      })) as Funnel[];
    },
    enabled: !!user?.id
  });

  // Fetch close reasons
  const { data: closeReasons } = useQuery({
    queryKey: ['close-reasons', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('funnel_close_reasons')
        .select('*')
        .eq('is_active', true)
        .order('display_order');
      if (error) throw error;
      return data as CloseReason[];
    },
    enabled: !!user?.id
  });

  // Fetch automations
  const { data: automations } = useQuery({
    queryKey: ['funnel-automations', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('funnel_automations')
        .select('*')
        .order('created_at');
      if (error) throw error;
      return data as FunnelAutomation[];
    },
    enabled: !!user?.id
  });

  // Create funnel
  const createFunnel = useMutation({
    mutationFn: async (data: { name: string; description?: string; color?: string }) => {
      const { data: funnel, error } = await supabase
        .from('funnels')
        .insert({
          user_id: user!.id,
          name: data.name,
          description: data.description || null,
          color: data.color || '#3B82F6'
        })
        .select()
        .single();
      
      if (error) throw error;

      // Create default stages
      const defaultStages = [
        { name: 'Novo Lead', color: '#94A3B8', display_order: 0, probability: 10 },
        { name: 'Contato Inicial', color: '#3B82F6', display_order: 1, probability: 25 },
        { name: 'Proposta Enviada', color: '#8B5CF6', display_order: 2, probability: 50 },
        { name: 'Negociação', color: '#F59E0B', display_order: 3, probability: 75 },
        { name: 'Ganho', color: '#22C55E', display_order: 4, is_final: true, final_type: 'won', probability: 100 },
        { name: 'Perdido', color: '#EF4444', display_order: 5, is_final: true, final_type: 'lost', probability: 0 },
      ];

      await supabase.from('funnel_stages').insert(
        defaultStages.map(stage => ({ ...stage, funnel_id: funnel.id }))
      );

      return funnel;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['funnels'] });
      toast.success("Funil criado com sucesso");
    },
    onError: () => toast.error("Erro ao criar funil")
  });

  // Update funnel
  const updateFunnel = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; name?: string; description?: string; color?: string; is_default?: boolean }) => {
      const { error } = await supabase.from('funnels').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['funnels'] });
      toast.success("Funil atualizado");
    },
    onError: () => toast.error("Erro ao atualizar funil")
  });

  // Delete funnel
  const deleteFunnel = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('funnels').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['funnels'] });
      toast.success("Funil excluído");
    },
    onError: () => toast.error("Erro ao excluir funil")
  });

  // Create stage
  const createStage = useMutation({
    mutationFn: async (data: { funnel_id: string; name: string; color?: string; is_final?: boolean; final_type?: 'won' | 'lost' | null }) => {
      const { data: stages } = await supabase
        .from('funnel_stages')
        .select('display_order')
        .eq('funnel_id', data.funnel_id)
        .order('display_order', { ascending: false })
        .limit(1);
      
      const nextOrder = (stages?.[0]?.display_order || 0) + 1;
      
      const { error } = await supabase.from('funnel_stages').insert({
        ...data,
        display_order: nextOrder,
        color: data.color || '#3B82F6'
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['funnels'] });
      toast.success("Etapa criada");
    },
    onError: () => toast.error("Erro ao criar etapa")
  });

  // Update stage
  const updateStage = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; name?: string; color?: string; display_order?: number; is_final?: boolean; final_type?: 'won' | 'lost' | null; probability?: number }) => {
      const { error } = await supabase.from('funnel_stages').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['funnels'] });
    }
  });

  // Delete stage
  const deleteStage = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('funnel_stages').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['funnels'] });
      toast.success("Etapa excluída");
    },
    onError: () => toast.error("Erro ao excluir etapa")
  });

  // Create deal
  const createDeal = useMutation({
    mutationFn: async (data: { 
      funnel_id: string; 
      stage_id: string; 
      contact_id: string; 
      conversation_id?: string;
      title?: string; 
      value?: number; 
      expected_close_date?: string;
      source?: string;
    }) => {
      const { error } = await supabase.from('funnel_deals').insert({
        user_id: user!.id,
        ...data,
        value: data.value || 0
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['funnels'] });
      queryClient.invalidateQueries({ queryKey: ['contact-deal'] });
      toast.success("Deal criado");
    },
    onError: () => toast.error("Erro ao criar deal")
  });

  // Update deal
  const updateDeal = useMutation({
    mutationFn: async ({ id, ...data }: { 
      id: string; 
      stage_id?: string; 
      title?: string; 
      value?: number; 
      expected_close_date?: string | null;
      closed_at?: string | null;
      close_reason_id?: string | null;
      notes?: string;
    }) => {
      // Get current deal to check stage change
      const { data: currentDeal } = await supabase
        .from('funnel_deals')
        .select('stage_id')
        .eq('id', id)
        .single();

      const updateData: Record<string, unknown> = { ...data };
      
      // If stage changed, update entered_stage_at and create history
      if (data.stage_id && currentDeal && data.stage_id !== currentDeal.stage_id) {
        updateData.entered_stage_at = new Date().toISOString();
        
        // Create history entry
        await supabase.from('funnel_deal_history').insert({
          deal_id: id,
          from_stage_id: currentDeal.stage_id,
          to_stage_id: data.stage_id
        });

        // Trigger automations
        try {
          await supabase.functions.invoke('process-funnel-automations', {
            body: { dealId: id, fromStageId: currentDeal.stage_id, toStageId: data.stage_id }
          });
        } catch (e) {
          console.error('Error triggering automations:', e);
        }
      }

      const { error } = await supabase.from('funnel_deals').update(updateData).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['funnels'] });
      queryClient.invalidateQueries({ queryKey: ['contact-deal'] });
    }
  });

  // Delete deal
  const deleteDeal = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('funnel_deals').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['funnels'] });
      queryClient.invalidateQueries({ queryKey: ['contact-deal'] });
      toast.success("Deal excluído");
    },
    onError: () => toast.error("Erro ao excluir deal")
  });

  // Close reasons mutations
  const createCloseReason = useMutation({
    mutationFn: async (data: { type: 'won' | 'lost'; name: string }) => {
      const { error } = await supabase.from('funnel_close_reasons').insert({
        user_id: user!.id,
        ...data
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['close-reasons'] });
      toast.success("Motivo criado");
    }
  });

  const deleteCloseReason = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('funnel_close_reasons').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['close-reasons'] });
      toast.success("Motivo excluído");
    }
  });

  // Automation mutations
  const createAutomation = useMutation({
    mutationFn: async (data: { funnel_id: string; stage_id?: string | null; name: string; trigger_type: string; trigger_config?: Record<string, unknown>; action_type: string; action_config?: Record<string, unknown>; is_active?: boolean }) => {
      const { error } = await supabase.from('funnel_automations').insert([{
        user_id: user!.id,
        funnel_id: data.funnel_id,
        stage_id: data.stage_id || null,
        name: data.name,
        trigger_type: data.trigger_type as 'on_stage_enter' | 'on_stage_exit' | 'on_deal_won' | 'on_deal_lost' | 'on_time_in_stage',
        trigger_config: (data.trigger_config || {}) as Record<string, never>,
        action_type: data.action_type as 'send_message' | 'send_template' | 'add_tag' | 'remove_tag' | 'notify_user' | 'move_stage',
        action_config: (data.action_config || {}) as Record<string, never>,
        is_active: data.is_active ?? true
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['funnel-automations'] });
      toast.success("Automação criada");
    }
  });

  const updateAutomation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; is_active?: boolean; name?: string; trigger_type?: string; action_type?: string; trigger_config?: unknown; action_config?: unknown }) => {
      const updateData: Record<string, unknown> = {};
      if (data.is_active !== undefined) updateData.is_active = data.is_active;
      if (data.name) updateData.name = data.name;
      if (data.trigger_type) updateData.trigger_type = data.trigger_type;
      if (data.action_type) updateData.action_type = data.action_type;
      if (data.trigger_config) updateData.trigger_config = data.trigger_config;
      if (data.action_config) updateData.action_config = data.action_config;
      const { error } = await supabase.from('funnel_automations').update(updateData).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['funnel-automations'] });
      toast.success("Automação atualizada");
    }
  });

  const deleteAutomation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('funnel_automations').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['funnel-automations'] });
      toast.success("Automação excluída");
    }
  });

  // Get deal by contact
  const useContactDeal = (contactId: string | undefined) => {
    return useQuery({
      queryKey: ['contact-deal', contactId],
      queryFn: async () => {
        if (!contactId) return null;
        const { data, error } = await supabase
          .from('funnel_deals')
          .select(`
            *,
            funnel:funnels(id, name),
            stage:funnel_stages(id, name, color)
          `)
          .eq('contact_id', contactId)
          .is('closed_at', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (error) throw error;
        return data;
      },
      enabled: !!contactId
    });
  };

  return {
    funnels,
    isLoading,
    refetch,
    closeReasons,
    automations,
    createFunnel,
    updateFunnel,
    deleteFunnel,
    createStage,
    updateStage,
    deleteStage,
    createDeal,
    updateDeal,
    deleteDeal,
    createCloseReason,
    deleteCloseReason,
    createAutomation,
    updateAutomation,
    deleteAutomation,
    useContactDeal
  };
};
