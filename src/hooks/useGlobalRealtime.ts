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
  const { user, session, isAuthenticatedStable } = useAuth();

  useEffect(() => {
    if (!isAuthenticatedStable || !user?.id || !session?.access_token) return;

    console.log('[Realtime] enabled global realtime');

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
          queryClient.invalidateQueries({ queryKey: ['contact-deal'] });
          queryClient.invalidateQueries({ queryKey: ['funnel-deals'] });
          queryClient.invalidateQueries({ queryKey: ['funnels'] });
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
  }, [isAuthenticatedStable, user?.id, session?.access_token, queryClient]);
};
