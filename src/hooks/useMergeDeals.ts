import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface MergeDealsPayload {
  masterId: string;
  secondaryIds: string[];
  // Final field values to apply on the master
  fields: {
    title?: string | null;
    value?: number | null;
    responsible_id?: string | null;
    stage_id: string;
    custom_fields?: Record<string, unknown>;
    contact_custom_fields?: Record<string, unknown>;
  };
  mergeTags: boolean;
  mergeNotes: boolean;
  mergeConversations: boolean;
  // Contact id of the master (used for tag/note merges)
  masterContactId: string | null;
  // Contact ids of the secondaries (for tag/note merges)
  secondaryContactIds: string[];
  // Conversation id of the master deal (target for conversation merge)
  masterConversationId: string | null;
  // Conversation ids of the secondaries (sources to migrate into master)
  secondaryConversationIds: string[];
}

/**
 * Merges multiple funnel deals into one (the master).
 * - Master keeps its id (preserves history, integrations, conversation links).
 * - Secondaries are deleted after migrating references (chatbot executions, automation logs, calendly events).
 * - Optionally merges tags and notes from secondary contacts into the master contact.
 */
export const useMergeDeals = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: MergeDealsPayload) => {
      // A união roda numa edge function com privilégios de serviço: as políticas
      // RLS de conversas/mensagens bloqueiam vendedores de carteira ao mover
      // histórico de conversas que não são deles.
      const { data, error } = await supabase.functions.invoke('merge-leads', {
        body: { mode: 'deals', ...payload },
      });
      if (error) {
        const detail = (data as { error?: string } | null)?.error;
        throw new Error(detail || error.message);
      }
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      return { mergedCount: (data as { mergedCount?: number })?.mergedCount ?? payload.secondaryIds.length + 1 };
    },
    onSuccess: (result) => {
      toast.success(`${result.mergedCount} leads unidos em 1 com sucesso`);
      queryClient.invalidateQueries({ queryKey: ['funnels'] });
      queryClient.invalidateQueries({ queryKey: ['funnel-deals'] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['inbox-messages'] });
      queryClient.invalidateQueries({ queryKey: ['messages'] });
    },
    onError: (error: Error) => {
      console.error('[useMergeDeals] Error:', error);
      toast.error(`Erro ao unir leads: ${error.message}`);
    },
  });
};
