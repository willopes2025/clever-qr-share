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
      const { masterId, secondaryIds, fields, mergeTags, mergeNotes, masterContactId, secondaryContactIds } = payload;

      // 1. Fetch the master deal current stage to detect a stage change
      const { data: masterDeal, error: masterErr } = await supabase
        .from('funnel_deals')
        .select('stage_id')
        .eq('id', masterId)
        .single();
      if (masterErr || !masterDeal) throw new Error('Lead principal não encontrado');

      const stageChanged = masterDeal.stage_id !== fields.stage_id;

      // 2. Update master deal with chosen field values
      const updatePayload: Record<string, unknown> = {
        stage_id: fields.stage_id,
        updated_at: new Date().toISOString(),
      };
      if (stageChanged) updatePayload.entered_stage_at = new Date().toISOString();
      if (fields.title !== undefined) updatePayload.title = fields.title;
      if (fields.value !== undefined) updatePayload.value = fields.value;
      if (fields.responsible_id !== undefined) updatePayload.responsible_id = fields.responsible_id;
      if (fields.custom_fields !== undefined) updatePayload.custom_fields = fields.custom_fields as never;

      const { error: updErr } = await supabase
        .from('funnel_deals')
        .update(updatePayload)
        .eq('id', masterId);
      if (updErr) throw updErr;

      // 3. If contact custom fields were chosen and master has a contact, merge them in
      if (masterContactId && fields.contact_custom_fields && Object.keys(fields.contact_custom_fields).length > 0) {
        const { data: contact } = await supabase
          .from('contacts')
          .select('custom_fields')
          .eq('id', masterContactId)
          .single();
        const merged = { ...(contact?.custom_fields as Record<string, unknown> || {}), ...fields.contact_custom_fields };
        await supabase
          .from('contacts')
          .update({ custom_fields: merged as never })
          .eq('id', masterContactId);
      }

      // 4. Record stage change in history if needed
      if (stageChanged) {
        await supabase.from('funnel_deal_history').insert({
          deal_id: masterId,
          from_stage_id: masterDeal.stage_id,
          to_stage_id: fields.stage_id,
          notes: `União de leads: ${secondaryIds.join(', ')}`,
        });
      }

      // 5. Migrate references from secondary deals to master
      // chatbot_executions
      await supabase
        .from('chatbot_executions')
        .update({ deal_id: masterId })
        .in('deal_id', secondaryIds);
      // automation_execution_log
      await supabase
        .from('automation_execution_log')
        .update({ deal_id: masterId })
        .in('deal_id', secondaryIds);
      // calendly_events
      await supabase
        .from('calendly_events')
        .update({ deal_id: masterId })
        .in('deal_id', secondaryIds);

      // 6. Optionally merge tags from secondary contacts into master contact
      if (mergeTags && masterContactId && secondaryContactIds.length > 0) {
        const validSecondaryContactIds = secondaryContactIds.filter(cid => cid && cid !== masterContactId);
        if (validSecondaryContactIds.length > 0) {
          const { data: tagsToCopy } = await supabase
            .from('contact_tags')
            .select('tag_id')
            .in('contact_id', validSecondaryContactIds);

          if (tagsToCopy && tagsToCopy.length > 0) {
            const uniqueTagIds = Array.from(new Set(tagsToCopy.map(t => t.tag_id)));
            const rows = uniqueTagIds.map(tag_id => ({ contact_id: masterContactId, tag_id }));
            await supabase
              .from('contact_tags')
              .upsert(rows, { onConflict: 'contact_id,tag_id' });
          }
        }
      }

      // 7. Optionally migrate notes from secondary contacts to master contact
      if (mergeNotes && masterContactId && secondaryContactIds.length > 0) {
        const validSecondaryContactIds = secondaryContactIds.filter(cid => cid && cid !== masterContactId);
        if (validSecondaryContactIds.length > 0) {
          await supabase
            .from('conversation_notes')
            .update({ contact_id: masterContactId })
            .in('contact_id', validSecondaryContactIds);
        }
      }

      // 8. Delete secondary deals
      const { error: delErr } = await supabase
        .from('funnel_deals')
        .delete()
        .in('id', secondaryIds);
      if (delErr) throw delErr;

      return { mergedCount: secondaryIds.length + 1 };
    },
    onSuccess: (result) => {
      toast.success(`${result.mergedCount} leads unidos em 1 com sucesso`);
      queryClient.invalidateQueries({ queryKey: ['funnels'] });
      queryClient.invalidateQueries({ queryKey: ['funnel-deals'] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
    onError: (error: Error) => {
      console.error('[useMergeDeals] Error:', error);
      toast.error(`Erro ao unir leads: ${error.message}`);
    },
  });
};
