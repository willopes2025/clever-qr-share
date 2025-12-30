import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "./useOrganization";
import { toast } from "sonner";

export interface LeadDistributionSettings {
  id: string;
  organization_id: string;
  is_enabled: boolean;
  distribution_mode: string;
  eligible_members: string[];
  last_assigned_index: number;
  created_at: string;
  updated_at: string;
}

export function useLeadDistribution() {
  const { organization, isAdmin } = useOrganization();
  const queryClient = useQueryClient();

  // Fetch distribution settings
  const { data: settings, isLoading } = useQuery({
    queryKey: ['lead-distribution-settings', organization?.id],
    queryFn: async () => {
      if (!organization) return null;

      const { data, error } = await supabase
        .from('lead_distribution_settings')
        .select('*')
        .eq('organization_id', organization.id)
        .maybeSingle();

      if (error) throw error;
      return data as LeadDistributionSettings | null;
    },
    enabled: !!organization?.id,
  });

  // Create or update settings
  const updateSettings = useMutation({
    mutationFn: async (data: {
      is_enabled?: boolean;
      distribution_mode?: string;
      eligible_members?: string[];
    }) => {
      if (!organization) throw new Error('Organização não encontrada');
      if (!isAdmin) throw new Error('Sem permissão');

      if (settings?.id) {
        // Update existing
        const { error } = await supabase
          .from('lead_distribution_settings')
          .update({
            ...data,
            updated_at: new Date().toISOString(),
          })
          .eq('id', settings.id);

        if (error) throw error;
      } else {
        // Create new
        const { error } = await supabase
          .from('lead_distribution_settings')
          .insert({
            organization_id: organization.id,
            ...data,
          });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-distribution-settings'] });
      toast.success('Configurações de distribuição atualizadas');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Assign conversation to member
  const assignConversation = useMutation({
    mutationFn: async ({ conversationId, memberId }: { conversationId: string; memberId: string }) => {
      const { error } = await supabase
        .from('conversations')
        .update({ assigned_to: memberId })
        .eq('id', conversationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      toast.success('Conversa atribuída');
    },
    onError: () => {
      toast.error('Erro ao atribuir conversa');
    },
  });

  return {
    settings,
    isLoading,
    updateSettings,
    assignConversation,
    isEnabled: settings?.is_enabled || false,
  };
}
