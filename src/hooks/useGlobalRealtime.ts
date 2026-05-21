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
        (payload) => {
          // Atualização otimista: aplica o patch direto nas queries em cache
          // para evitar refetch completo (4 round-trips) a cada mudança.
          const next = (payload.new || {}) as Record<string, any>;
          const oldRow = (payload.old || {}) as Record<string, any>;
          const convId = (next.id || oldRow.id) as string | undefined;

          if (payload.eventType === 'UPDATE' && convId) {
            queryClient.setQueriesData({ queryKey: ['conversations'] }, (data: any) => {
              if (!Array.isArray(data)) return data;
              let touched = false;
              const updated = data.map((c: any) => {
                if (c.id !== convId) return c;
                touched = true;
                return { ...c, ...next };
              });
              return touched ? updated : data;
            });
            queryClient.invalidateQueries({ queryKey: ['unread-count'], refetchType: 'active' });
            return;
          }

          // INSERT/DELETE: precisam de refetch (nova linha não está no cache).
          queryClient.invalidateQueries({ queryKey: ['conversations'], refetchType: 'active' });
          queryClient.invalidateQueries({ queryKey: ['unread-count'], refetchType: 'active' });
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'inbox_messages' },
        (payload) => {
          const msg = payload.new as {
            conversation_id?: string;
            content?: string | null;
            direction?: 'inbound' | 'outbound' | null;
            created_at?: string | null;
          };
          if (msg.conversation_id) {
            queryClient.invalidateQueries({ queryKey: ['messages', msg.conversation_id], refetchType: 'active' });
          }
          // Atualização otimista da lista do inbox: bumpa last_message_at,
          // preview e direction sem refazer a query pesada.
          if (msg.conversation_id) {
            queryClient.setQueriesData({ queryKey: ['conversations'] }, (data: any) => {
              if (!Array.isArray(data)) return data;
              let touched = false;
              const updated = data.map((c: any) => {
                if (c.id !== msg.conversation_id) return c;
                touched = true;
                return {
                  ...c,
                  last_message_at: msg.created_at ?? c.last_message_at,
                  last_message_preview: msg.content ?? c.last_message_preview,
                  last_message_direction: msg.direction ?? c.last_message_direction,
                  unread_count: msg.direction === 'inbound' ? (c.unread_count || 0) + 1 : c.unread_count,
                };
              });
              return touched ? updated : data;
            });
          }
          queryClient.invalidateQueries({ queryKey: ['unread-count'], refetchType: 'active' });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'contacts' },
        (payload) => {
          const next = (payload.new || {}) as Record<string, any>;
          const contactId = next.id as string | undefined;
          if (!contactId) return;
          // Só mexe na lista se o contato realmente está no cache visível —
          // editar um contato qualquer não deve forçar refetch das 200 linhas.
          let foundInInbox = false;
          queryClient.setQueriesData({ queryKey: ['conversations'] }, (data: any) => {
            if (!Array.isArray(data)) return data;
            let touched = false;
            const updated = data.map((c: any) => {
              if (c.contact_id !== contactId) return c;
              touched = true;
              foundInInbox = true;
              return { ...c, contact: { ...(c.contact || {}), ...next } };
            });
            return touched ? updated : data;
          });
          queryClient.invalidateQueries({ queryKey: ['contacts'], refetchType: 'active' });
          if (foundInInbox) {
            // Pode haver detalhes (deal, tags) que dependem do contato em
            // outras telas — invalida só essas, não a lista do inbox.
            queryClient.invalidateQueries({ queryKey: ['contact', contactId] });
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'funnel_deals' },
        () => {
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
