import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * Consolidated realtime subscription for conversations and messages.
 * This replaces multiple individual subscriptions with a single global one.
 */
export const useGlobalRealtime = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('global-realtime-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversations' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['conversations'] });
          queryClient.invalidateQueries({ queryKey: ['unread-count'] });
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'inbox_messages' },
        (payload) => {
          const msg = payload.new as { conversation_id?: string };
          if (msg.conversation_id) {
            queryClient.invalidateQueries({ queryKey: ['messages', msg.conversation_id] });
          }
          queryClient.invalidateQueries({ queryKey: ['conversations'] });
          queryClient.invalidateQueries({ queryKey: ['unread-count'] });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'contacts' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['conversations'] });
          queryClient.invalidateQueries({ queryKey: ['contacts'] });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'funnel_deals' },
        () => {
          // NOTE: Do NOT invalidate ['funnels'] here. The funnels cache only
          // contains funnel/stage metadata (deals are loaded separately via
          // useFunnelDeals / useStageDealCounts). Invalidating ['funnels']
          // would re-trigger the heavy Funnels-page query for every realtime
          // event and slow the Inbox down significantly.
          queryClient.invalidateQueries({ queryKey: ['contact-deal'] });
          queryClient.invalidateQueries({ queryKey: ['funnel-deals'] });
          queryClient.invalidateQueries({ queryKey: ['stage-deal-counts'] });
          queryClient.invalidateQueries({ queryKey: ['funnel-metrics'] });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'message_reactions' },
        (payload) => {
          const r = payload.new as { conversation_id?: string } | null;
          const rOld = payload.old as { conversation_id?: string } | null;
          const convId = r?.conversation_id || rOld?.conversation_id;
          if (convId) {
            queryClient.invalidateQueries({ queryKey: ['messages', convId] });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);
};
