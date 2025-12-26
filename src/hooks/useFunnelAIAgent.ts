import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface FunnelAIAgentConfig {
  id: string;
  user_id: string;
  funnel_id: string;
  campaign_id: string | null;
  agent_name: string;
  personality_prompt: string | null;
  behavior_rules: string | null;
  greeting_message: string | null;
  fallback_message: string;
  goodbye_message: string | null;
  max_interactions: number;
  response_delay_min: number;
  response_delay_max: number;
  active_hours_start: number;
  active_hours_end: number;
  handoff_keywords: string[];
  is_active: boolean;
  response_mode: 'text' | 'audio' | 'both';
  voice_id: string | null;
  created_at: string;
  updated_at: string;
}

// Fetch agent config by funnel ID
export const useFunnelAgentConfig = (funnelId: string | null) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['funnel-agent-config', funnelId],
    queryFn: async () => {
      if (!funnelId || !user) return null;

      const { data, error } = await supabase
        .from('ai_agent_configs')
        .select('*')
        .eq('funnel_id', funnelId)
        .maybeSingle();

      if (error) throw error;
      return data as FunnelAIAgentConfig | null;
    },
    enabled: !!funnelId && !!user,
  });
};

// Mutations for funnel agent config
export const useFunnelAgentConfigMutations = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const upsertConfig = useMutation({
    mutationFn: async (data: Partial<FunnelAIAgentConfig> & { funnel_id: string }) => {
      if (!user) throw new Error('User not authenticated');

      // Check if config exists for this funnel
      const { data: existing } = await supabase
        .from('ai_agent_configs')
        .select('id')
        .eq('funnel_id', data.funnel_id)
        .maybeSingle();

      if (existing) {
        const { data: updated, error } = await supabase
          .from('ai_agent_configs')
          .update(data)
          .eq('id', existing.id)
          .select()
          .single();
        if (error) throw error;
        return updated;
      } else {
        const { data: created, error } = await supabase
          .from('ai_agent_configs')
          .insert({ 
            ...data, 
            user_id: user.id,
            campaign_id: null, // Funnel configs don't have campaign_id
          })
          .select()
          .single();
        if (error) throw error;
        return created;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['funnel-agent-config', variables.funnel_id] });
    },
    onError: (error) => {
      toast.error('Erro ao salvar configuração: ' + error.message);
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ funnelId, isActive }: { funnelId: string; isActive: boolean }) => {
      if (!user) throw new Error('User not authenticated');

      const { data: existing } = await supabase
        .from('ai_agent_configs')
        .select('id')
        .eq('funnel_id', funnelId)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('ai_agent_configs')
          .update({ is_active: isActive })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        // Create a default config
        const { error } = await supabase
          .from('ai_agent_configs')
          .insert({
            funnel_id: funnelId,
            user_id: user.id,
            is_active: isActive,
            agent_name: 'Assistente',
            fallback_message: 'Desculpe, não entendi. Poderia reformular?',
          });
        if (error) throw error;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['funnel-agent-config', variables.funnelId] });
    },
  });

  return { upsertConfig, toggleActive };
};
