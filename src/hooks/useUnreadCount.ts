import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * Counts unread conversations exactly the same way the Inbox "Não lidas"
 * tab does. Delegates all the heavy filtering (org scope, channel
 * restrictions, hidden/notification-only instances, ghost + warming
 * exclusion) to a single SECURITY DEFINER RPC on the database, so the
 * sidebar badge is one round-trip instead of five.
 */
export const useUnreadCount = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['unread-count', user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      const { data, error } = await supabase.rpc('get_inbox_unread_count');
      if (error) throw error;
      return (data as number) ?? 0;
    },
    enabled: !!user?.id,
    staleTime: 30_000,
  });
};
