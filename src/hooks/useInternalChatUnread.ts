import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const useInternalChatUnread = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['internal-chat-total-unread', user?.id],
    queryFn: async () => {
      if (!user) return 0;

      // Get read statuses
      const { data: readStatuses } = await supabase
        .from('internal_chat_read_status')
        .select('target_type, target_id, last_read_at')
        .eq('user_id', user.id);

      const statuses = readStatuses || [];
      let total = 0;

      // Count unread DMs (messages mentioning me)
      const { count: allDmCount } = await supabase
        .from('internal_messages')
        .select('id', { count: 'exact', head: true })
        .is('conversation_id', null)
        .is('contact_id', null)
        .neq('user_id', user.id)
        .contains('mentions', [user.id]);

      if (allDmCount && allDmCount > 0) {
        // Subtract already-read ones by checking per-member read status
        // Simpler approach: count all unread DMs after earliest untracked time
        const dmReadEntries = statuses.filter(s => s.target_type === 'member');
        
        if (dmReadEntries.length === 0) {
          total += allDmCount;
        } else {
          // For DMs we need per-sender counting
          // Get distinct senders
          const { data: senders } = await supabase
            .from('internal_messages')
            .select('user_id')
            .is('conversation_id', null)
            .is('contact_id', null)
            .neq('user_id', user.id)
            .contains('mentions', [user.id]);

          const uniqueSenders = [...new Set((senders || []).map(s => s.user_id))];
          
          for (const senderId of uniqueSenders) {
            const readEntry = statuses.find(
              r => r.target_type === 'member' && r.target_id === senderId
            );
            let query = supabase
              .from('internal_messages')
              .select('id', { count: 'exact', head: true })
              .is('conversation_id', null)
              .is('contact_id', null)
              .eq('user_id', senderId)
              .contains('mentions', [user.id]);
            if (readEntry?.last_read_at) {
              query = query.gt('created_at', readEntry.last_read_at);
            }
            const { count } = await query;
            total += count || 0;
          }
        }
      }

      // Count unread group messages
      const { data: myGroups } = await supabase
        .from('internal_chat_group_members')
        .select('group_id')
        .eq('user_id', user.id);

      for (const gm of myGroups || []) {
        const readEntry = statuses.find(
          r => r.target_type === 'group' && r.target_id === gm.group_id
        );
        let query = supabase
          .from('internal_group_messages')
          .select('id', { count: 'exact', head: true })
          .eq('group_id', gm.group_id)
          .neq('user_id', user.id);
        if (readEntry?.last_read_at) {
          query = query.gt('created_at', readEntry.last_read_at);
        }
        const { count } = await query;
        total += count || 0;
      }

      return total;
    },
    enabled: !!user,
    refetchInterval: 30000,
  });
};
