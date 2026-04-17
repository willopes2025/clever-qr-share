import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const useUnreadCount = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['unread-count', user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      
      const { data, error } = await supabase
        .from('conversations')
        .select('unread_count')
        .gt('unread_count', 0)
        .neq('status', 'archived');
      
      if (error) throw error;
      return data?.reduce((sum, c) => sum + c.unread_count, 0) || 0;
    },
    enabled: !!user?.id,
    staleTime: 30000,
  });
};
